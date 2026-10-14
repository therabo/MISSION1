package org.mission1.telemetry;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.*;
import java.util.*;

/** Reviewed definitions only. Never creates observations from research records. */
public final class TelemetryCatalog {
    public record Definition(String parameterId, String rawItemId, String componentId,
            String label, String engineeringDescription, String category, String valueType,
            String unitQualification, String sourceUnit, String unit, Map<String,String> enumMapping,
            String associationType, List<String> associationNotes, List<String> evidence,
            List<String> unitNotes, String issLiveKey, boolean crossProviderComparable,
            Integer senseDataDecimals, String displayCategory) {
        public boolean rawOnly() { return unitQualification.equals("DISPLAY_RAW_WITH_SOURCE_UNIT"); }
        public boolean enumValue() { return valueType.equals("ENUM_CODE"); }
    }
    public record Blocked(String rawItemId, String componentId, List<String> reasons) {}
    public record Data(String version, String researchSha256, List<String> components,
            List<Definition> definitions, List<Blocked> blocked) {}
    private final Data data;
    private final String sha256;
    private record Scope(String researchSha256, Set<String> stationSystems, Set<String> controls) {}
    private final Scope scope;
    private final Set<String> blockedIds = new HashSet<>();
    private final Map<String,Definition> byRaw = new LinkedHashMap<>(), byId = new LinkedHashMap<>();
    public TelemetryCatalog(ObjectMapper mapper) {
        try (var input = getClass().getResourceAsStream("/telemetry/module-catalog.json")) {
            byte[] bytes = Objects.requireNonNull(input).readAllBytes();
            data = mapper.readValue(bytes, Data.class);
            sha256 = TelemetryRecord.hash(new String(bytes, java.nio.charset.StandardCharsets.UTF_8));
        } catch (IOException e) { throw new IllegalStateException("Telemetry registry unreadable", e); }
        try (var input = getClass().getResourceAsStream("/telemetry/source-scope.json")) {
            scope = mapper.readValue(Objects.requireNonNull(input), Scope.class);
        } catch (IOException e) { throw new IllegalStateException("Telemetry source scope unreadable", e); }
        if (!scope.researchSha256().equals(data.researchSha256())) throw new IllegalStateException("Unmatched source scope research");
        var blocked = new HashSet<String>();
        data.blocked().forEach(b -> blocked.add(b.rawItemId()));
        blockedIds.addAll(blocked);
        for (var d : data.definitions()) {
            if (blocked.contains(d.rawItemId()) || !data.components().contains(d.componentId())
                    || byRaw.put(d.rawItemId(), d) != null || byId.put(d.parameterId(),d) != null
                    || scope.stationSystems().contains(d.rawItemId()) || scope.controls().contains(d.rawItemId())
                    || d.rawOnly() && d.unit()!=null || d.enumValue() && d.enumMapping().isEmpty())
                throw new IllegalStateException("Invalid telemetry definition: " + d.rawItemId());
        }
        if (byId.size()!=131 || data.definitions().stream().filter(Definition::rawOnly).count()!=35)
            throw new IllegalStateException("Incomplete qualified component catalog");
    }
    public String version() { return data.version(); }
    public String sha256() { return sha256; }
    public String researchSha256() { return data.researchSha256(); }
    public List<Definition> definitions() { return data.definitions(); }
    public List<String> components() { return data.components(); }
    public Optional<Definition> raw(String id) { return Optional.ofNullable(byRaw.get(id)); }
    public Optional<Definition> parameter(String id) { return Optional.ofNullable(byId.get(id)); }
    public List<Definition> component(String id) { return definitions().stream().filter(d -> d.componentId().equals(id)).toList(); }
    public String classifyRaw(String id) {
        if ("STATUS".equals(id)) return "PROVIDER_LOCAL_STATUS";
        if (byRaw.containsKey(id)) return "QUALIFIED_COMPONENT_MATCH";
        if (scope.stationSystems().contains(id)) return "QUALIFIED_STATION_SYSTEM_MATCH";
        if (blockedIds.contains(id)) return "BLOCKED_DEFINITION";
        if (scope.controls().contains(id)) return "EXCLUDED_CONTROL";
        return "UNKNOWN_RAW_ID";
    }
}
