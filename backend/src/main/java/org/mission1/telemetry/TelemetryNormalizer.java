package org.mission1.telemetry;

import java.math.*;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

/** No calibration, defaults or source-status interpretation beyond documented resend policy. */
public final class TelemetryNormalizer {
    public record Raw(String provider, String providerItemId, String rawItemId, String value,
            String time, Instant receivedAt, boolean snapshot, String statusClass,
            String statusIndicator, String statusColor, String calibratedData, String providerUnit, String changedFields) {}
    private final TelemetryCatalog catalog;
    public TelemetryNormalizer(TelemetryCatalog catalog) { this.catalog=catalog; }
    public Optional<TelemetryRecord> normalize(Raw raw) {
        var found=catalog.raw(raw.rawItemId());
        if (found.isEmpty()) return Optional.empty();
        var d=found.get();
        if (!Set.of("NATIVE","SENSEDATA","ISS_LIVE").contains(raw.provider())
                || raw.receivedAt()==null || raw.providerItemId()==null || raw.providerItemId().length()>160) return Optional.empty();
        for (var field : Arrays.asList(raw.value(),raw.time(),raw.statusClass(),raw.statusIndicator(),raw.statusColor(),raw.calibratedData(),raw.providerUnit()))
            if (field!=null && field.length()>128) return Optional.empty();
        if (raw.value()==null || raw.value().isBlank() || raw.providerUnit()!=null && raw.providerUnit().length()>64) return Optional.empty();
        try {
            BigDecimal value=new BigDecimal(raw.value().trim());
            if (value.abs().compareTo(BigDecimal.ONE.scaleByPowerOfTen(100))>=0 || value.scale()>100 || value.scale()<-100) return Optional.empty();
            Long code=d.enumValue() ? value.longValueExact() : null;
            String label=code==null ? null : d.enumMapping().getOrDefault(code.toString(),"Unknown code " + code);
            Instant time=null;
            String role, precision, policy;
            boolean inferred;
            Integer decimals=null;
            switch(raw.provider()) {
                case "SENSEDATA" -> {
                    if (d.senseDataDecimals()==null || !raw.providerItemId().equals(d.rawItemId())) return Optional.empty();
                    time=Instant.ofEpochSecond(new BigDecimal(raw.time()).longValueExact());
                    role="PROVIDER_RECONSTRUCTED_ISSLIVE_RECORD_TIME"; precision="SECOND";
                    policy="sensedata-original-unix-v1; nearest-year-inferred-upstream"; inferred=true;
                    decimals=d.senseDataDecimals();
                }
                case "ISS_LIVE" -> {
                    if (!raw.providerItemId().equals(d.issLiveKey())) return Optional.empty();
                    if (raw.time()==null || !raw.time().endsWith("Z")) return Optional.empty();
                    time=Instant.parse(raw.time()).truncatedTo(ChronoUnit.MICROS);
                    role="PROVIDER_RECORD_TIME_ROLE_UNSPECIFIED"; precision="PUBLISHED_ISO_FRACTION";
                    policy="iss-live-original-latest-t-v1"; inferred=false;
                }
                default -> {
                    role="MISSION1_RECONSTRUCTED_ISSLIVE_RECORD_TIME"; precision="SECOND";
                    policy="native-nearest-year-v1; non-snapshot; within-7d; future<=120s"; inferred=true;
                    time=nativeTime(raw.time(),raw.receivedAt(),raw.snapshot() || raw.changedFields()!=null && !raw.changedFields().contains("TimeStamp") && !raw.changedFields().contains("Value")).orElse(null);
                    if (time==null) { role="UNQUALIFIED_NATIVE_TIME"; precision="UNKNOWN"; inferred=false; }
                }
            }
            if (time!=null && (time.isBefore(Instant.parse("1998-01-01T00:00:00Z")) || time.isAfter(raw.receivedAt().plusSeconds(120)))) return Optional.empty();
            String canonical=value.stripTrailingZeros().toPlainString();
            // Untimed callbacks deduplicate raw timestamp/value, never manufacture a dated head.
            // Native source fractions must survive even when dated presentation is
            // second precision. Distinct higher-rate callbacks are separate evidence.
            String nativeTimeIdentity=raw.time();
            if (nativeTimeIdentity!=null && raw.provider().equals("NATIVE")) {
                try {
                    var number=new BigDecimal(nativeTimeIdentity);
                    if (number.scale()>=-8 && number.scale()<=32 && number.abs().compareTo(BigDecimal.ONE.scaleByPowerOfTen(8))<0)
                        nativeTimeIdentity=number.stripTrailingZeros().toPlainString();
                }
                catch (NumberFormatException ignored) { /* Unqualified original text remains evidence. */ }
            }
            String identityTime=raw.provider().equals("NATIVE") ? nativeTimeIdentity+"|"+time+"|native-original-time-identity-v1" : String.valueOf(time);
            String identity=catalog.version()+"|"+raw.provider()+"|"+d.rawItemId()+"|"+identityTime+"|"+canonical+"|"+policy;
            return Optional.of(new TelemetryRecord(TelemetryRecord.hash(identity),d.parameterId(),raw.provider(),raw.providerItemId(),d.rawItemId(),raw.value(),value,
                    code,label,time,raw.time(),role,precision,policy,inferred,decimals,raw.providerUnit(),raw.receivedAt().truncatedTo(ChronoUnit.MICROS),
                    raw.snapshot(),raw.statusClass(),raw.statusIndicator(),raw.statusColor(),raw.calibratedData(),raw.changedFields()));
        } catch (NumberFormatException | ArithmeticException | DateTimeException | NullPointerException invalid) { return Optional.empty(); }
    }
    public static Optional<Instant> nativeTime(String raw, Instant received, boolean snapshot) {
        if (snapshot || raw==null || raw.isBlank() || raw.length()>128) return Optional.empty();
        try {
            BigDecimal hours=new BigDecimal(raw);
            if (hours.compareTo(BigDecimal.valueOf(24))<0 || hours.compareTo(BigDecimal.valueOf(8808))>=0) return Optional.empty();
            int year=received.atOffset(ZoneOffset.UTC).getYear();
            Instant nearest=null;
            for (int candidate=year-1;candidate<=year+1;candidate++) {
                int days=Year.isLeap(candidate)?366:365;
                if (hours.compareTo(BigDecimal.valueOf((days+1)*24L))>=0) continue;
                Instant t=LocalDate.of(candidate,1,1).atStartOfDay().toInstant(ZoneOffset.UTC)
                        .plusSeconds(hours.subtract(BigDecimal.valueOf(24)).multiply(BigDecimal.valueOf(3600)).longValue());
                if (nearest==null || Duration.between(t,received).abs().compareTo(Duration.between(nearest,received).abs())<0) nearest=t;
            }
            if (nearest==null || nearest.isAfter(received.plusSeconds(120)) || nearest.isBefore(received.minus(Duration.ofDays(7)))) return Optional.empty();
            return Optional.of(nearest);
        } catch (RuntimeException invalid) { return Optional.empty(); }
    }
}
