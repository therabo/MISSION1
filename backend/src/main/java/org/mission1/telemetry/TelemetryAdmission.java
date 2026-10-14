package org.mission1.telemetry;

import java.math.BigDecimal;

/** Pure chronology/precision policy. Source rank is only a corroborated tie preference. */
public final class TelemetryAdmission {
    public static final String POLICY = "record-chronology-v1";
    public String decide(TelemetryCatalog.Definition definition, TelemetryRecord candidate,
            TelemetryRecord latest, TelemetryRecord sameSecond) {
        if (candidate.recordTime()==null) return "UNTIMED";
        // Status 9 is a consumer-documented resend of last-good input, not a new observation.
        if ("9".equals(candidate.statusClass())) return "RESEND";
        if (sameSecond!=null) {
            if (!comparable(definition,candidate,sameSecond)) return "INCOMPARABLE";
            if (!agrees(candidate,sameSecond,definition.enumValue())) return "CONFLICT";
        }
        if (latest!=null && !comparable(definition,candidate,latest)) return "INCOMPARABLE";
        return "ACCEPTED";
    }
    public boolean comparable(TelemetryCatalog.Definition d, TelemetryRecord a, TelemetryRecord b) {
        if (a.provider().equals(b.provider())) return true;
        if (!a.provider().equals("ISS_LIVE") && !b.provider().equals("ISS_LIVE")) return true;
        return d.crossProviderComparable();
    }
    public boolean agrees(TelemetryRecord a, TelemetryRecord b, boolean enumValue) {
        BigDecimal allowance = BigDecimal.ZERO;
        if (!enumValue) {
            if (a.roundingDecimals()!=null) allowance=allowance.add(BigDecimal.valueOf(5).scaleByPowerOfTen(-a.roundingDecimals()-1));
            if (b.roundingDecimals()!=null) allowance=allowance.add(BigDecimal.valueOf(5).scaleByPowerOfTen(-b.roundingDecimals()-1));
        }
        return a.numericValue().subtract(b.numericValue()).abs().compareTo(allowance)<=0;
    }
}
