package org.mission1.source.telemetry;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.*;
import org.mission1.telemetry.*;

/** Explicit qualified keys only; imports latest.t/v, never aggregates or window/feed clocks. */
public final class IssLiveTelemetrySource {
    private final ObjectMapper mapper;
    private final Map<String,TelemetryCatalog.Definition> keys=new HashMap<>();
    public IssLiveTelemetrySource(ObjectMapper mapper, TelemetryCatalog catalog) {
        this.mapper=mapper;
        catalog.definitions().stream().filter(d -> d.issLiveKey()!=null).forEach(d -> keys.put(d.issLiveKey(),d));
    }
    public List<TelemetryNormalizer.Raw> parse(String body, Instant received, Set<String> requested) throws java.io.IOException {
        if (body.length()>524288) throw new java.io.IOException("Oversized ISS.live response");
        var root=mapper.readTree(body);
        var rows=root.path("stats");
        if (!rows.isArray() || rows.size()>128) throw new java.io.IOException("Invalid ISS.live stats");
        var result=new ArrayList<TelemetryNormalizer.Raw>();
        for (var row:rows) {
            String key=row.path("sensor").asText(); var d=keys.get(key);
            if (d==null || !requested.contains(key) || row.path("latest").isNull() || row.path("latest").isMissingNode()) continue;
            var latest=row.path("latest");
            result.add(new TelemetryNormalizer.Raw("ISS_LIVE",key,d.rawItemId(),SenseDataTelemetrySource.text(latest.get("v")),
                    SenseDataTelemetrySource.text(latest.get("t")),received,true,null,null,null,null,SenseDataTelemetrySource.text(row.path("unit").get("symbol")),null));
        }
        return List.copyOf(result);
    }
}
