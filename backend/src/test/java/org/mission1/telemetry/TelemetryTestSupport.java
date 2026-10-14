package org.mission1.telemetry;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.*;

public final class TelemetryTestSupport {
    public static final Instant NOW=Instant.parse("2026-10-14T18:00:00Z");
    public static final ObjectMapper MAPPER=new ObjectMapper().findAndRegisterModules().disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    public static final TelemetryCatalog CATALOG=new TelemetryCatalog(MAPPER);
    public static final TelemetryNormalizer NORMALIZER=new TelemetryNormalizer(CATALOG);
    public static String fixture(String name) throws Exception {
        try (var in=TelemetryTestSupport.class.getResourceAsStream("/telemetry/TEST-"+name)) { return new String(in.readAllBytes(),java.nio.charset.StandardCharsets.UTF_8); }
    }
    public static TelemetryNormalizer.Raw raw(String item,String value,Instant time,String provider) {
        var d=CATALOG.raw(item).orElseThrow();
        return new TelemetryNormalizer.Raw(provider,provider.equals("ISS_LIVE")?d.issLiveKey():item,item,value,
                provider.equals("SENSEDATA")?Long.toString(time.getEpochSecond()):provider.equals("NATIVE")?nativeHours(time):time.toString(),
                provider.equals("NATIVE")?time.plusSeconds(10):NOW,false,"24",null,null,null,null,"Value,TimeStamp");
    }
    public static String nativeHours(Instant time) {
        var utc=time.atOffset(ZoneOffset.UTC);
        return java.math.BigDecimal.valueOf(utc.getDayOfYear()*24L).add(java.math.BigDecimal.valueOf(utc.toLocalTime().toSecondOfDay()).divide(java.math.BigDecimal.valueOf(3600),12,java.math.RoundingMode.HALF_UP)).toPlainString();
    }
}
