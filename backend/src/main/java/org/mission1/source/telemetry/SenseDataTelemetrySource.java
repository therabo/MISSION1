package org.mission1.source.telemetry;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.time.Instant;
import java.util.*;
import org.mission1.telemetry.*;

/** One bounded initial /events capture. STATUS, TIME controls and vm never become observations. */
public final class SenseDataTelemetrySource {
    private final ObjectMapper mapper;
    private final TelemetryCatalog catalog;
    private record LineageGuard(String policy,int count,String relativeRecordDigest,long originalMinimumUnixSeconds) {}
    private final LineageGuard lineage;
    public SenseDataTelemetrySource(ObjectMapper mapper, TelemetryCatalog catalog) {
        this.mapper=mapper; this.catalog=catalog;
        try (var input=getClass().getResourceAsStream("/telemetry/retained-lineage-guard.json")) { lineage=mapper.readValue(input,LineageGuard.class); }
        catch(java.io.IOException e) { throw new IllegalStateException(e); }
    }
    public List<TelemetryNormalizer.Raw> parse(String body, Instant received) throws java.io.IOException {
        if (body.length()>262144) throw new java.io.IOException("Oversized SenseData event");
        var result=new ArrayList<TelemetryNormalizer.Raw>();
        String event=""; StringBuilder data=new StringBuilder();
        for (String line : (body+"\n\n").split("\n",-1)) {
            line=line.replace("\r","");
            if (line.startsWith("event:")) event=line.substring(6).trim();
            if (line.startsWith("data:")) data.append(line.substring(5).trim()).append('\n');
            if (line.isEmpty()) {
                if (event.equals("records") && !data.isEmpty()) {
                    var records=mapper.readTree(data.toString());
                    if (!records.isArray() || records.size()>512) throw new java.io.IOException("Invalid SenseData records");
                    for (var r : records) {
                        var d=catalog.raw(r.path("k").asText()).orElse(null);
                        if (d==null || d.senseDataDecimals()==null) continue;
                        // Known providers must not declare a local replay as source telemetry.
                        if (r.path("source").asText().equalsIgnoreCase("replay") || r.path("replay").asBoolean(false)) throw new java.io.IOException("Retimed replay excluded");
                        result.add(new TelemetryNormalizer.Raw("SENSEDATA",d.rawItemId(),d.rawItemId(),
                                text(r.get("v")),text(r.get("t")),received,true,text(r.get("s")),null,null,null,null,null));
                    }
                    rejectRebasedLineage(result);
                    return List.copyOf(result);
                }
                event=""; data.setLength(0);
            }
        }
        throw new java.io.IOException("No retained records event");
    }
    private void rejectRebasedLineage(List<TelemetryNormalizer.Raw> records) throws java.io.IOException {
        if (records.size()!=lineage.count()) return;
        try {
            long minimum=records.stream().mapToLong(r -> Long.parseLong(r.time())).min().orElseThrow();
            String digest=TelemetryRecord.hash(records.stream().map(r -> r.rawItemId()+"|"+new java.math.BigDecimal(r.value()).stripTrailingZeros().toPlainString()+"|"+r.statusClass()+"|"+(Long.parseLong(r.time())-minimum)).sorted().collect(java.util.stream.Collectors.joining("\n")));
            if (digest.equals(lineage.relativeRecordDigest()) && minimum!=lineage.originalMinimumUnixSeconds()) throw new java.io.IOException("Retimed retained seed cohort excluded");
        } catch(NumberFormatException ignored) { /* malformed item values are rejected by normalization */ }
    }
    static String text(com.fasterxml.jackson.databind.JsonNode value) { return value==null || value.isNull()?null:value.asText(); }
}
