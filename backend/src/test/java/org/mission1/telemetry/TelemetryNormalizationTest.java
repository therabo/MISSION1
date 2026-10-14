package org.mission1.telemetry;

import static org.junit.jupiter.api.Assertions.*;
import static org.mission1.telemetry.TelemetryTestSupport.*;
import static org.mockito.Mockito.*;
import java.time.*;
import java.util.*;
import java.util.stream.Stream;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import org.mission1.source.telemetry.*;
import com.lightstreamer.client.ItemUpdate;

class TelemetryNormalizationTest {
    static Stream<TelemetryCatalog.Definition> definitions() { return CATALOG.definitions().stream(); }
    @ParameterizedTest @MethodSource("definitions") void completeCatalogHasGenericNormalization(TelemetryCatalog.Definition d) {
        var event=raw(d.rawItemId(),"0",NOW.minusSeconds(100),"NATIVE");
        var result=NORMALIZER.normalize(event).orElseThrow();
        assertEquals(d.parameterId(),result.parameterId());assertEquals(d.rawItemId(),result.rawItemId());
        if (d.rawOnly()) assertNull(d.unit());
        if (d.enumValue()) assertEquals(d.enumMapping().getOrDefault("0","Unknown code 0"),result.enumLabel());
    }
    @Test void integrityAndNoProductionSampleSeeds() throws Exception {
        assertEquals(131,CATALOG.definitions().size());assertEquals(35,CATALOG.definitions().stream().filter(TelemetryCatalog.Definition::rawOnly).count());
        assertEquals(14,CATALOG.components().size());
        assertEquals(131,CATALOG.definitions().stream().map(TelemetryCatalog.Definition::parameterId).distinct().count());
        Map<String,Integer> expected=Map.of("DESTINY",25,"HARMONY",7,"POISK",1,"ZVEZDA",21,"RASSVET",1,"ZARYA",1,"QUEST",57,"TRANQUILITY",16,"UNITY",2);
        expected.forEach((id,count) -> assertEquals(count,CATALOG.component(id).size()));
        assertEquals("water_recovery",CATALOG.raw("NODE3000005").orElseThrow().displayCategory());
        assertEquals("oxygen_generation",CATALOG.raw("NODE3000010").orElseThrow().displayCategory());
        assertEquals("thermal_cooling",CATALOG.raw("NODE3000005").orElseThrow().category());
        for (String id:List.of("COLUMBUS","PIRS","CUPOLA","KIBO_EXPOSED_FACILITY","KIBO_PRESSURIZED_MODULE")) assertTrue(CATALOG.component(id).isEmpty());
        for (String id:List.of("USLAB000058","NODE3000011","AIRLOCK000054","RUSSEG000017","STATUS","TIME_000001","CSAMT000001")) assertTrue(CATALOG.raw(id).isEmpty());
        String registry=new String(getClass().getResourceAsStream("/telemetry/module-catalog.json").readAllBytes());
        assertFalse(registry.contains("retainedRecords"));assertFalse(registry.contains("publishedRecordTime"));assertFalse(registry.contains("acquiredAt"));
    }
    @Test void itemSpecificEnumsUnknownAndMissing() {
        assertEquals("FAIL",CATALOG.raw("USLAB000062").orElseThrow().enumMapping().get("0"));
        assertEquals("CLOSED",CATALOG.raw("AIRLOCK000050").orElseThrow().enumMapping().get("0"));
        assertEquals("Not-Off Failed",CATALOG.raw("NODE1000001").orElseThrow().enumMapping().get("3"));
        assertEquals("Unknown code 2",NORMALIZER.normalize(raw("NODE1000001","2",NOW,"NATIVE")).orElseThrow().enumLabel());
        assertTrue(CATALOG.raw("RUSSEG000002").orElseThrow().enumMapping().get("0").toLowerCase().contains("undetermined"));
        assertTrue(CATALOG.raw("RUSSEG000024").orElseThrow().enumMapping().get("0").toLowerCase().contains("pre-start"));
        assertTrue(NORMALIZER.normalize(raw("NODE1000001",null,NOW,"NATIVE")).isEmpty());
    }
    @ParameterizedTest @NullAndEmptySource @ValueSource(strings={" ","NaN","Infinity","1e101","1e-101","not-number"}) void malformedNumbersNeverBecomeZero(String value) {
        assertTrue(NORMALIZER.normalize(raw("NODE3000005",value,NOW,"NATIVE")).isEmpty());
    }
    @Test void boundedFieldsFractionalEnumsAndFutureRetainedDates() {
        assertTrue(NORMALIZER.normalize(raw("NODE1000001","1.5",NOW,"NATIVE")).isEmpty());
        assertTrue(NORMALIZER.normalize(raw("NODE3000005","1".repeat(129),NOW,"NATIVE")).isEmpty());
        assertTrue(NORMALIZER.normalize(raw("NODE3000005","52",NOW.plusSeconds(121),"SENSEDATA")).isEmpty());
    }
    @Test void inferredYearBoundariesAndAmbiguities() {
        var jan=Instant.parse("2027-01-01T00:05:00Z");
        assertEquals(Instant.parse("2026-12-31T23:00:00Z"),TelemetryNormalizer.nativeTime("8783",jan,false).orElseThrow());
        assertEquals(Instant.parse("2024-12-31T23:00:00Z"),TelemetryNormalizer.nativeTime("8807",Instant.parse("2025-01-01T00:00:00Z"),false).orElseThrow());
        assertTrue(TelemetryNormalizer.nativeTime("6400",NOW,false).isEmpty());
        assertTrue(TelemetryNormalizer.nativeTime("0",NOW,false).isEmpty());
        assertTrue(TelemetryNormalizer.nativeTime(nativeHours(NOW.plusSeconds(3600)),NOW,false).isEmpty());
        assertTrue(TelemetryNormalizer.nativeTime(nativeHours(NOW),NOW,true).isEmpty());
    }
    @Test void sdkDeltaCopyUsesReconstructedStateAndPreservesSnapshot() {
        ItemUpdate update=mock(ItemUpdate.class);when(update.getItemName()).thenReturn("NODE3000005");
        when(update.getValue("Value")).thenReturn("52");when(update.getValue("TimeStamp")).thenReturn(nativeHours(NOW));
        when(update.isValueChanged("TimeStamp")).thenReturn(true);
        var delta=NativeTelemetrySource.copy(update,Clock.fixed(NOW,ZoneOffset.UTC));
        assertEquals("52",delta.value());assertEquals(nativeHours(NOW),delta.time());
        assertNotNull(NORMALIZER.normalize(delta).orElseThrow().recordTime());
        when(update.isSnapshot()).thenReturn(true);
        var snapshot=NORMALIZER.normalize(NativeTelemetrySource.copy(update,Clock.fixed(NOW,ZoneOffset.UTC))).orElseThrow();
        assertNull(snapshot.recordTime());assertFalse(snapshot.yearInferred());
        when(update.isSnapshot()).thenReturn(false);when(update.isValueChanged("TimeStamp")).thenReturn(false);
        var amendment=NativeTelemetrySource.copy(update,Clock.fixed(NOW,ZoneOffset.UTC));
        assertEquals(nativeHours(NOW),amendment.time());assertNull(NORMALIZER.normalize(amendment).orElseThrow().recordTime());
        when(update.getValue("TimeStamp")).thenReturn("1e-100000000");when(update.isValueChanged("TimeStamp")).thenReturn(true);
        var bounded=NORMALIZER.normalize(NativeTelemetrySource.copy(update,Clock.fixed(NOW,ZoneOffset.UTC))).orElseThrow();
        assertNull(bounded.recordTime());assertEquals(64,bounded.id().length());assertFalse(bounded.yearInferred());
    }
    @Test void distinctNativeFractionsRemainSeparateEvidenceWithinTheSamePublishedSecond() {
        var a=raw("NODE3000005","52",NOW,"NATIVE");
        var b=new TelemetryNormalizer.Raw(a.provider(),a.providerItemId(),a.rawItemId(),a.value(),
                new java.math.BigDecimal(a.time()).add(new java.math.BigDecimal("0.0000277778")).toPlainString(),a.receivedAt(),false,"24",null,null,null,null,"TimeStamp");
        var first=NORMALIZER.normalize(a).orElseThrow();var second=NORMALIZER.normalize(b).orElseThrow();
        assertEquals(first.recordTime(),second.recordTime());assertNotEquals(first.id(),second.id());
        assertNotEquals(first.originalTime(),second.originalTime());
    }
    @Test void sensedataRetainedParsingPreservesDatesRoundingAndExcludesControlsMeans() throws Exception {
        var source=new SenseDataTelemetrySource(MAPPER,CATALOG);var rows=source.parse(fixture("sensedata-events.txt"),NOW);
        assertEquals(42,rows.size());assertFalse(rows.stream().anyMatch(r -> r.rawItemId().equals("STATUS")));
        var tank=rows.stream().filter(r -> r.rawItemId().equals("NODE3000005")).findFirst().orElseThrow();
        var record=NORMALIZER.normalize(tank).orElseThrow();assertEquals(52,record.numericValue().intValue());
        assertEquals(Instant.parse("2026-09-14T14:10:29Z"),record.recordTime());assertEquals(NOW,record.receivedAt());
        assertTrue(record.yearInferred());assertEquals(0,record.roundingDecimals());
        var modified=fixture("sensedata-events.txt").replace("\"vm\":-0.02","\"vm\":123456");
        assertEquals(rows,source.parse(modified,NOW));
    }
    @Test void retimedSeedAndDeclaredReplayAreRejected() throws Exception {
        var source=new SenseDataTelemetrySource(MAPPER,CATALOG);String body=fixture("sensedata-events.txt");
        var pattern=java.util.regex.Pattern.compile("\"t\":(\\d+)");var matcher=pattern.matcher(body);StringBuilder changed=new StringBuilder();
        while(matcher.find()) matcher.appendReplacement(changed,"\"t\":"+(Long.parseLong(matcher.group(1))+86400));matcher.appendTail(changed);
        assertThrows(java.io.IOException.class,() -> source.parse(changed.toString(),NOW));
        assertThrows(java.io.IOException.class,() -> source.parse(body.replace("\"k\":\"NODE3000005\"","\"k\":\"NODE3000005\",\"replay\":true"),NOW));
    }
    @Test void archiveUsesExplicitLatestRecordsAndRegistryDecoder() throws Exception {
        var source=new IssLiveTelemetrySource(MAPPER,CATALOG);
        var keys=CATALOG.definitions().stream().map(TelemetryCatalog.Definition::issLiveKey).filter(Objects::nonNull).collect(java.util.stream.Collectors.toSet());
        var rows=new ArrayList<>(source.parse(fixture("isslive-stats.json"),NOW,keys));
        rows.addAll(source.parse(fixture("isslive-russian-stats.json"),NOW,keys));
        assertTrue(rows.stream().anyMatch(r -> r.rawItemId().equals("RUSSEG000025")));
        assertTrue(rows.stream().allMatch(r -> CATALOG.raw(r.rawItemId()).isPresent()));
        var record=NORMALIZER.normalize(rows.stream().filter(r -> r.rawItemId().equals("RUSSEG000025")).findFirst().orElseThrow()).orElseThrow();
        assertEquals(Instant.parse("2026-09-08T15:54:39.203Z"),record.recordTime());assertTrue(record.enumLabel().contains("desaturate"));
        assertEquals("PROVIDER_RECORD_TIME_ROLE_UNSPECIFIED",record.timeRole());
        assertTrue(source.parse(fixture("isslive-stats.json"),NOW,Set.of()).isEmpty());
    }
}
