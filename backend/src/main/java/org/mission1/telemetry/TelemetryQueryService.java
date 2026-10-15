package org.mission1.telemetry;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;

/** Local evidence only; same effective-time best-current contract as accepted Historical. */
public final class TelemetryQueryService {
    public record Source(String upstreamOrigin,String transport,String retainingProvider,String acquisitionMethod,
            String rawItemId,String providerItemId,String timeRole,String timePrecision,String timestampPolicy,
            boolean yearInferred,Integer roundingDecimals,String providerUnit,Instant receivedAt,String catalogVersion) {}
    public record Value(BigDecimal numericValue,Long enumCode,String enumLabel,Instant recordTime,Source source) {}
    public record Parameter(String parameterId,String label,String category,String valueType,String unit,
            boolean rawOnly,Value record,List<String> evidence,List<String> limitations) {}
    public record Component(String componentId,String mode,Instant requestedAt,String semantics,
            String mappingStatus,List<Parameter> parameters) {}
    public record History(String parameterId,Instant from,Instant to,List<Value> records,String nextCursor) {}
    public static final class UnknownResource extends IllegalArgumentException {
        public UnknownResource(String message) { super(message); }
    }
    private final TelemetryCatalog catalog;
    private final TelemetryRepository repository;
    private final Clock clock;
    public TelemetryQueryService(TelemetryCatalog catalog,TelemetryRepository repository,Clock clock) { this.catalog=catalog;this.repository=repository;this.clock=clock; }
    public Component component(String id,Instant at) {
        if (!catalog.components().contains(id)) throw new UnknownResource("Unknown ISS component");
        Instant selected=at==null?clock.instant():at;
        validateTime(selected);
        var definitions=catalog.component(id);
        var values=definitions.isEmpty()?Map.<String,TelemetryRecord>of():repository.selected(id,selected);
        return new Component(id,at==null?"CURRENT":"HISTORICAL",at,"EFFECTIVE_TIME_BEST_CURRENT_RECONSTRUCTION",
                definitions.isEmpty()?"NO_VERIFIED_MAPPING":"VERIFIED_MAPPING",definitions.stream().map(d -> new Parameter(d.parameterId(),d.label(),d.displayCategory(),d.valueType(),d.unit(),d.rawOnly(),
                        values.containsKey(d.parameterId())?value(values.get(d.parameterId())):null,d.evidence(),d.unitNotes())).toList());
    }
    public History history(String id,Instant from,Instant to,String cursor,int limit) {
        if (catalog.parameter(id).isEmpty()) throw new UnknownResource("Unknown telemetry parameter");
        validateTime(from);validateTime(to);
        if (from.isAfter(to) || Duration.between(from,to).compareTo(Duration.ofDays(31))>0 || limit<1 || limit>500
                || cursor!=null && !cursor.matches("[a-f0-9]{64}")) throw new IllegalArgumentException("History requires from<=to, a range <=31 days, limit 1..500 and a valid cursor");
        var rows=repository.history(id,from,to,cursor,limit+1);
        boolean more=rows.size()>limit;var page=more?rows.subList(0,limit):rows;
        return new History(id,from,to,page.stream().map(this::value).toList(),more?page.getLast().id():null);
    }
    private void validateTime(Instant time) {
        if (time==null || time.isBefore(Instant.parse("1998-01-01T00:00:00Z")) || time.isAfter(clock.instant().plusSeconds(120)))
            throw new IllegalArgumentException("Telemetry time must be a UTC instant from 1998 and no later than now + 120 seconds");
    }
    private Value value(TelemetryRecord r) {
        String retainer=switch(r.provider()) {case "SENSEDATA" -> "SenseData";case "ISS_LIVE" -> "ISS.live";default -> null;};
        String method=switch(r.provider()) {case "SENSEDATA" -> "RETAINED_BOOTSTRAP";case "ISS_LIVE" -> "RETAINED_ARCHIVE_IMPORT";default -> "NATIVE_CALLBACK";};
        String actualMethod=r.acquisitionMethod();
        if (actualMethod!=null) method=actualMethod;
        return new Value(r.numericValue(),r.enumCode(),r.enumLabel(),r.recordTime(),new Source("PUBLIC_ISS_TELEMETRY_NASA_ORIGIN_ATTRIBUTED_BY_PROVIDER","Lightstreamer ISSLIVE",retainer,method,
                r.rawItemId(),r.providerItemId(),r.timeRole(),r.timePrecision(),r.timePolicy(),r.yearInferred(),r.roundingDecimals(),r.providerUnit(),r.receivedAt(),catalog.version()));
    }
}
