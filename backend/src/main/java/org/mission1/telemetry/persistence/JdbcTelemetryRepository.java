package org.mission1.telemetry.persistence;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.*;
import java.time.*;
import java.util.*;
import org.mission1.telemetry.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

/** Bounded batch writer; immutable evidence/admission and set-based local reads. */
public final class JdbcTelemetryRepository implements TelemetryRepository {
    private static final String RANK="CASE r.provider WHEN 'NATIVE' THEN 3 WHEN 'ISS_LIVE' THEN 2 ELSE 1 END";
    private static final String ORDER="r.record_second DESC,"+RANK+" DESC,r.record_time DESC,r.id ASC";
    private final JdbcTemplate jdbc;
    private final NamedParameterJdbcTemplate named;
    private final TransactionTemplate transaction;
    private final TelemetryCatalog catalog;
    private final ObjectMapper mapper;
    private final TelemetryAdmission admission=new TelemetryAdmission();
    public JdbcTelemetryRepository(JdbcTemplate jdbc, TransactionTemplate transaction, TelemetryCatalog catalog, ObjectMapper mapper) {
        this.jdbc=jdbc; this.named=new NamedParameterJdbcTemplate(jdbc); this.transaction=transaction; this.catalog=catalog; this.mapper=mapper;
    }
    @Override public void initialize(TelemetryCatalog ignored) {
        transaction.executeWithoutResult(tx -> {
            jdbc.update("INSERT INTO telemetry_catalog VALUES(?,?,?) ON CONFLICT DO NOTHING",catalog.version(),catalog.sha256(),catalog.researchSha256());
            if (!catalog.sha256().equals(jdbc.queryForObject("SELECT sha256 FROM telemetry_catalog WHERE version=?",String.class,catalog.version())))
                throw new IllegalStateException("Changed immutable telemetry catalog version");
            var args=new ArrayList<Object[]>();
            for (var d:catalog.definitions()) {
                try { args.add(new Object[]{catalog.version(),d.parameterId(),d.rawItemId(),d.componentId(),d.label(),d.category(),d.valueType(),d.unitQualification(),d.unit(),d.sourceUnit(),mapper.writeValueAsString(d)}); }
                catch (Exception e) { throw new IllegalStateException(e); }
            }
            jdbc.batchUpdate("INSERT INTO telemetry_parameter VALUES(?,?,?,?,?,?,?,?,?,?,?::jsonb) ON CONFLICT DO NOTHING",args);
        });
    }
    @Override public StoreResult store(Acquisition a, List<TelemetryRecord> records) {
        if (records.size()>256) throw new IllegalArgumentException("Telemetry batch exceeds 256");
        return transaction.execute(tx -> {
            // One writer lock per capability across application instances; never held during network I/O.
            jdbc.execute("SELECT pg_advisory_xact_lock(74310124)");
            jdbc.update("INSERT INTO telemetry_acquisition VALUES(?,?,?,?,?,?,?,?)",a.id(),a.provider(),a.method(),a.endpoint(),utc(a.acquiredAt()),a.outcome(),a.diagnostic(),a.itemCount());
            var unique=new LinkedHashMap<String,TelemetryRecord>();
            records.forEach(r -> unique.putIfAbsent(r.id(),r));
            if (unique.isEmpty()) return new StoreResult(0,0,0);
            var args=new ArrayList<Object[]>();
            var evidence=new ArrayList<Object[]>();
            for (var r:unique.values()) {
                args.add(new Object[]{r.id(),catalog.version(),r.parameterId(),r.provider(),r.providerItemId(),r.rawItemId(),r.rawValue(),r.numericValue(),r.enumCode(),r.enumLabel(),utc(r.recordTime()),r.recordTime()==null?null:r.recordTime().getEpochSecond(),r.originalTime(),r.timeRole(),r.timePrecision(),r.timePolicy(),r.yearInferred(),r.roundingDecimals(),r.providerUnit(),a.id(),utc(r.receivedAt())});
                evidence.add(new Object[]{a.id(),r.id(),r.snapshot(),r.statusClass(),r.statusIndicator(),r.statusColor(),r.calibratedData(),r.changedFields()});
            }
            int[] writes=jdbc.batchUpdate("INSERT INTO telemetry_record VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING",args);
            jdbc.batchUpdate("INSERT INTO telemetry_record_evidence VALUES(?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING",evidence);
            var ids=List.copyOf(unique.keySet());
            var newIds=new HashSet<>(named.queryForList("SELECT r.id FROM telemetry_record r LEFT JOIN telemetry_admission a ON a.record_id=r.id WHERE r.id IN (:ids) AND a.record_id IS NULL",Map.of("ids",ids),String.class));
            var parameters=unique.values().stream().map(TelemetryRecord::parameterId).distinct().toList();
            var latest=new HashMap<String,TelemetryRecord>();
            var values=Map.<String,Object>of("version",catalog.version(),"params",parameters);
            named.query("SELECT DISTINCT ON (r.parameter_id) r.* FROM telemetry_record r JOIN telemetry_admission a ON a.record_id=r.id AND a.decision='ACCEPTED' WHERE r.catalog_version=:version AND r.parameter_id IN (:params) ORDER BY r.parameter_id,"+ORDER,values,(rs,n) -> read(rs))
                    .forEach(r -> latest.put(r.parameterId(),r));
            var seconds=unique.values().stream().filter(r -> r.recordTime()!=null).map(r -> r.recordTime().getEpochSecond()).distinct().toList();
            var peers=new HashMap<String,TelemetryRecord>();
            if (!seconds.isEmpty()) {
                var criteria=new HashMap<String,Object>(values);criteria.put("seconds",seconds);
                named.query("SELECT DISTINCT ON (r.parameter_id,r.record_second) r.* FROM telemetry_record r JOIN telemetry_admission a ON a.record_id=r.id AND a.decision='ACCEPTED' WHERE r.catalog_version=:version AND r.parameter_id IN (:params) AND r.record_second IN (:seconds) ORDER BY r.parameter_id,r.record_second,"+RANK+" DESC,r.record_time DESC,r.id",criteria,(rs,n) -> read(rs))
                        .forEach(r -> peers.put(group(r),r));
            }
            var decisions=new ArrayList<Object[]>(); int accepted=0,conflicts=0;
            var sorted=unique.values().stream().filter(r -> newIds.contains(r.id())).sorted(Comparator
                    .comparing(TelemetryRecord::recordTime,Comparator.nullsFirst(Comparator.naturalOrder()))
                    .thenComparing(Comparator.comparingInt(TelemetryRecord::preference).reversed()).thenComparing(TelemetryRecord::id)).toList();
            for (var r:sorted) {
                var head=latest.get(r.parameterId()); var peer=peers.get(group(r));
                String result=admission.decide(catalog.parameter(r.parameterId()).orElseThrow(),r,head,peer);
                decisions.add(new Object[]{r.id(),result,peer!=null?peer.id():head!=null?head.id():null,TelemetryAdmission.POLICY});
                if (result.equals("CONFLICT")) conflicts++;
                if (result.equals("ACCEPTED")) {
                    accepted++;
                    if (peer==null || preferred(r,peer)) peers.put(group(r),r);
                    if (head==null || preferred(r,head)) latest.put(r.parameterId(),r);
                }
            }
            jdbc.batchUpdate("INSERT INTO telemetry_admission VALUES(?,?,?,?) ON CONFLICT DO NOTHING",decisions);
            return new StoreResult((int)Arrays.stream(writes).filter(n -> n>0).count(),accepted,conflicts);
        });
    }
    private static String group(TelemetryRecord r) { return r.parameterId()+"|"+(r.recordTime()==null?"untimed":r.recordTime().getEpochSecond()); }
    private static boolean preferred(TelemetryRecord a,TelemetryRecord b) {
        int time=Long.compare(a.recordTime().getEpochSecond(),b.recordTime().getEpochSecond());
        if (time!=0) return time>0;
        if (a.preference()!=b.preference()) return a.preference()>b.preference();
        int fraction=a.recordTime().compareTo(b.recordTime());
        return fraction>0 || fraction==0 && a.id().compareTo(b.id())<0;
    }
    @Override public Map<String,TelemetryRecord> selected(String component,Instant at) {
        var result=new LinkedHashMap<String,TelemetryRecord>();
        jdbc.query("""
                SELECT v.* FROM telemetry_parameter p JOIN LATERAL (
                  SELECT r.* FROM telemetry_record r JOIN telemetry_admission a ON a.record_id=r.id AND a.decision='ACCEPTED'
                  WHERE r.catalog_version=p.catalog_version AND r.parameter_id=p.parameter_id AND r.record_time<=?
                """+" ORDER BY "+ORDER+" LIMIT 1) v ON true WHERE p.catalog_version=? AND p.component_id=?",(rs,n) -> read(rs),utc(at),catalog.version(),component)
                .forEach(r -> result.put(r.parameterId(),r));
        return result;
    }
    @Override public List<TelemetryRecord> history(String parameter,Instant from,Instant to,String cursor,int limit) {
        if (cursor!=null && !Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM telemetry_record r JOIN telemetry_admission a ON a.record_id=r.id AND a.decision='ACCEPTED' WHERE r.id=? AND r.catalog_version=? AND r.parameter_id=? AND r.record_time>=? AND r.record_time<=?)",Boolean.class,cursor,catalog.version(),parameter,utc(from),utc(to))))
            throw new IllegalArgumentException("History cursor does not belong to the requested parameter/range");
        Instant lower=from.truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        if (lower.isBefore(from)) lower=lower.plusNanos(1000);
        return jdbc.query("""
                SELECT r.* FROM telemetry_record r JOIN telemetry_admission a ON a.record_id=r.id AND a.decision='ACCEPTED'
                WHERE r.catalog_version=? AND r.parameter_id=? AND r.record_time>=? AND r.record_time<=?
                AND (?::text IS NULL OR (r.record_time,r.id) > (SELECT record_time,id FROM telemetry_record WHERE id=? AND catalog_version=? AND parameter_id=?))
                ORDER BY r.record_time,r.id LIMIT ?
                """,(rs,n) -> read(rs),catalog.version(),parameter,utc(lower),utc(to),cursor,cursor,catalog.version(),parameter,limit);
    }
    @Override public boolean claimBootstrap(String provider, Instant now) {
        return claimBootstrap(provider,now,false);
    }
    @Override public boolean claimBootstrap(String provider, Instant now, boolean retryFailed) {
        return jdbc.update("""
                INSERT INTO telemetry_bootstrap_state VALUES(?,?,?,false)
                ON CONFLICT(provider,catalog_version) DO UPDATE
                SET attempted_at=greatest(EXCLUDED.attempted_at,telemetry_bootstrap_state.attempted_at+interval '1 microsecond')
                WHERE NOT telemetry_bootstrap_state.completed AND (
                  telemetry_bootstrap_state.attempted_at<=EXCLUDED.attempted_at-interval '24 hours'
                  OR (? AND EXISTS(SELECT 1 FROM telemetry_acquisition a
                    WHERE a.provider=telemetry_bootstrap_state.provider AND a.outcome='FAILED'
                    AND a.acquired_at>=telemetry_bootstrap_state.attempted_at)))
                """,provider,catalog.version(),utc(now),retryFailed)==1;
    }
    @Override public void completeBootstrap(String provider) {
        jdbc.update("UPDATE telemetry_bootstrap_state SET completed=true WHERE provider=? AND catalog_version=?",provider,catalog.version());
    }
    private static TelemetryRecord read(ResultSet r) throws SQLException {
        return new TelemetryRecord(r.getString("id"),r.getString("parameter_id"),r.getString("provider"),r.getString("provider_item_id"),r.getString("raw_item_id"),r.getString("raw_value"),r.getBigDecimal("numeric_value"),r.getObject("enum_code",Long.class),r.getString("enum_label"),instant(r,"record_time"),r.getString("original_time"),r.getString("time_role"),r.getString("time_precision"),r.getString("time_policy"),r.getBoolean("year_inferred"),r.getObject("rounding_decimals",Integer.class),r.getString("provider_unit"),instant(r,"received_at"),false,null,null,null,null,null);
    }
    private static Instant instant(ResultSet r,String column) throws SQLException { var value=r.getObject(column,OffsetDateTime.class);return value==null?null:value.toInstant(); }
    private static OffsetDateTime utc(Instant t) { return t==null?null:t.truncatedTo(java.time.temporal.ChronoUnit.MICROS).atOffset(ZoneOffset.UTC); }
}
