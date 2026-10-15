package org.mission1.telemetry;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.Instant;
import java.util.HexFormat;

/** One immutable actual-source record. Receipt never substitutes for qualified record time. */
public record TelemetryRecord(String id, String parameterId, String provider, String providerItemId,
        String rawItemId, String rawValue, BigDecimal numericValue, Long enumCode, String enumLabel,
        Instant recordTime, String originalTime, String timeRole, String timePrecision, String timePolicy,
        boolean yearInferred, Integer roundingDecimals, String providerUnit, Instant receivedAt,
        boolean snapshot, String statusClass, String statusIndicator, String statusColor, String calibratedData, String changedFields, String acquisitionMethod) {
    public TelemetryRecord(String id, String parameterId, String provider, String providerItemId,
        String rawItemId, String rawValue, BigDecimal numericValue, Long enumCode, String enumLabel,
        Instant recordTime, String originalTime, String timeRole, String timePrecision, String timePolicy,
        boolean yearInferred, Integer roundingDecimals, String providerUnit, Instant receivedAt,
        boolean snapshot, String statusClass, String statusIndicator, String statusColor, String calibratedData, String changedFields) {
        this(id,parameterId,provider,providerItemId,rawItemId,rawValue,numericValue,enumCode,enumLabel,recordTime,originalTime,timeRole,timePrecision,timePolicy,yearInferred,roundingDecimals,providerUnit,receivedAt,snapshot,statusClass,statusIndicator,statusColor,calibratedData,changedFields,null);
    }
    public int preference() { return switch(provider) { case "NATIVE" -> 3; case "ISS_LIVE" -> 2; default -> 1; }; }
    public static String hash(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}
