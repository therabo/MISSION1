package org.mission1.telemetry;

import static org.junit.jupiter.api.Assertions.*;
import static org.mission1.telemetry.TelemetryTestSupport.*;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.*;
import java.util.stream.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

class TelemetryRegistryAuditTest {
    static final JsonNode REFERENCE;
    static {
        try (var input=TelemetryRegistryAuditTest.class.getResourceAsStream("/telemetry/TEST-qualified-component-reference.json")) {
            REFERENCE=MAPPER.readTree(input);
        } catch (java.io.IOException error) { throw new ExceptionInInitializerError(error); }
    }
    static Stream<JsonNode> expectedDefinitions() {
        return StreamSupport.stream(REFERENCE.path("definitions").spliterator(),false);
    }
    @ParameterizedTest @MethodSource("expectedDefinitions")
    void everyRuntimeDefinitionMatchesIndependentQualifiedResearchProjection(JsonNode expected) {
        var actual=CATALOG.raw(expected.path("rawItemId").asText()).orElseThrow();
        var tree=MAPPER.valueToTree(actual);
        expected.fields().forEachRemaining(field -> assertEquals(field.getValue(),tree.get(field.getKey()),actual.rawItemId()+" / "+field.getKey()));
        assertEquals("QUALIFIED_COMPONENT_MATCH",CATALOG.classifyRaw(actual.rawItemId()));
        assertSame(actual,CATALOG.parameter(actual.parameterId()).orElseThrow());
        assertTrue(CATALOG.component(actual.componentId()).contains(actual));
    }
    @Test void fullPartitionAndUnresolvedProviderBindingsRemainExplicitlyExcluded() {
        assertEquals(131,REFERENCE.path("definitions").size());assertEquals(CATALOG.researchSha256(),REFERENCE.path("researchSha256").asText());
        assertEquals(96,CATALOG.definitions().stream().filter(d -> !d.rawOnly()).count());
        assertEquals(35,CATALOG.definitions().stream().filter(TelemetryCatalog.Definition::rawOnly).count());
        for (var id:REFERENCE.path("stationSystems")) {
            assertTrue(CATALOG.raw(id.asText()).isEmpty());assertEquals("QUALIFIED_STATION_SYSTEM_MATCH",CATALOG.classifyRaw(id.asText()));
        }
        for (var id:REFERENCE.path("blocked")) {
            assertTrue(CATALOG.raw(id.asText()).isEmpty());assertEquals("BLOCKED_DEFINITION",CATALOG.classifyRaw(id.asText()));
        }
        for (var id:REFERENCE.path("controls")) assertEquals("EXCLUDED_CONTROL",CATALOG.classifyRaw(id.asText()));
        assertEquals("PROVIDER_LOCAL_STATUS",CATALOG.classifyRaw("STATUS"));assertEquals("UNKNOWN_RAW_ID",CATALOG.classifyRaw(null));
        var keys=CATALOG.definitions().stream().map(TelemetryCatalog.Definition::issLiveKey).filter(Objects::nonNull).toList();
        assertEquals(21,keys.size());assertEquals(keys.size(),keys.stream().distinct().count());
        for (var key:REFERENCE.path("unresolvedIssLiveKeys")) assertFalse(keys.contains(key.asText()));
        assertEquals(42,CATALOG.definitions().stream().filter(d -> d.senseDataDecimals()!=null).count());
    }
    @Test void russianAndEarlyQuestMappingsAndNodeTwentyHaveExactScope() {
        for (int n=1;n<=25;n++) {
            String id="RUSSEG%06d".formatted(n);
            if (n==17) { assertTrue(CATALOG.raw(id).isEmpty());continue; }
            String expected=switch(n) { case 16 -> "ZARYA";case 18 -> "RASSVET";case 19 -> "POISK";default -> "ZVEZDA"; };
            assertEquals(expected,CATALOG.raw(id).orElseThrow().componentId());
        }
        for (int n=1;n<=58;n++) {
            String id="AIRLOCK%06d".formatted(n);
            if (n==54) { assertTrue(CATALOG.raw(id).isEmpty());continue; }
            assertEquals("QUEST",CATALOG.raw(id).orElseThrow().componentId());
        }
        assertEquals("TRANQUILITY",CATALOG.raw("NODE3000020").orElseThrow().componentId());
        assertEquals(25,CATALOG.component("DESTINY").size());
        assertTrue(CATALOG.raw("USLAB000017").isEmpty());assertTrue(CATALOG.raw("USLAB000058").isEmpty());
        for (String id:List.of(" uslab000059 ","USLAB59","USLAB000059 ","uslab000059")) assertTrue(CATALOG.raw(id).isEmpty());
    }
}
