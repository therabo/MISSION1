package org.mission1.source.telemetry;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.*;
import java.io.*;
import java.time.Instant;
import java.util.*;
import org.mission1.telemetry.*;

/** Streaming initial backfill, with bounded tokens/records and no whole-event JSON tree. */
public final class SenseDataTelemetrySource {
    public record Limits(int maximumEventBytes, int maximumRecords) {
        public static final Limits DEFAULT = new Limits(4194304, 20700); // 138 channels × 150 provider capacity.
        public Limits {
            if (maximumEventBytes < 256 || maximumEventBytes > 8388608 || maximumRecords < 1 || maximumRecords > 50550)
                throw new IllegalArgumentException("Invalid bounded SenseData limits");
        }
    }
    public record Batch(List<TelemetryNormalizer.Raw> records, Map<String,Long> classifications,
            int fetched, int malformed, int unboundComponentRecords, int eventBytes, long parseNanos) {}
    private final JsonFactory factory;
    private final TelemetryCatalog catalog;
    private final Limits limits;
    private record LineageGuard(String policy,int count,String relativeRecordDigest,long originalMinimumUnixSeconds) {}
    private final LineageGuard lineage;
    public SenseDataTelemetrySource(ObjectMapper mapper, TelemetryCatalog catalog) {
        this(mapper, catalog, Limits.DEFAULT);
    }
    public SenseDataTelemetrySource(ObjectMapper mapper, TelemetryCatalog catalog, Limits limits) {
        this.catalog=catalog; this.limits=limits;
        factory=mapper.getFactory().copy().setStreamReadConstraints(StreamReadConstraints.builder()
                .maxNestingDepth(8).maxStringLength(1024).maxNumberLength(128).maxNameLength(64).build());
        try (var input=getClass().getResourceAsStream("/telemetry/retained-lineage-guard.json")) { lineage=mapper.readValue(input,LineageGuard.class); }
        catch(java.io.IOException e) { throw new IllegalStateException(e); }
    }
    /** Compatibility with earlier recorded TEST fixtures that omit their blank terminator. */
    public List<TelemetryNormalizer.Raw> parse(String body, Instant received) throws IOException {
        if (body.length()>limits.maximumEventBytes()) throw new IOException("SenseData fixture byte limit exceeded");
        return parse(new ByteArrayInputStream((body+"\n\n").getBytes(java.nio.charset.StandardCharsets.UTF_8)), received).records();
    }
    public Batch parse(InputStream input, Instant received) throws IOException {
        long started=System.nanoTime();
        var result=new ArrayList<TelemetryNormalizer.Raw>();
        var counts=new TreeMap<String,Long>();
        int fetched=0,malformed=0,unbound=0;
        var stream=new SseRecordsInputStream(input,limits.maximumEventBytes());
        try (stream; var parser=factory.createParser(stream)) {
            if (parser.nextToken()!=JsonToken.START_ARRAY) throw new IOException("Expected SenseData record array");
            JsonToken token;
            while ((token=parser.nextToken())!=JsonToken.END_ARRAY) {
                if (token==null) throw new EOFException("Truncated SenseData array");
                if (++fetched>limits.maximumRecords()) throw new IOException("SenseData record count limit exceeded");
                var values=new HashMap<String,String>();
                var names=new HashSet<String>();
                int fields=0; boolean invalid=token!=JsonToken.START_OBJECT;
                if (invalid) parser.skipChildren();
                else while (parser.nextToken()!=JsonToken.END_OBJECT) {
                    if (parser.currentToken()!=JsonToken.FIELD_NAME) throw new IOException("Invalid SenseData object");
                    String name=parser.currentName();
                    if (++fields>16 || names.size()>=16 || !names.add(name)) invalid=true;
                    var value=parser.nextToken();
                    if (value==null) throw new EOFException("Truncated SenseData record");
                    if (Set.of("k","v","t","s","source","replay").contains(name)) {
                        String text=value.isScalarValue() && value!=JsonToken.VALUE_NULL ? parser.getText() : null;
                        if (text!=null && text.length()>128 || name.equals("k") && value!=JsonToken.VALUE_STRING
                                || !value.isScalarValue()) invalid=true;
                        if (text==null || text.length()<=128) values.put(name,text);
                    }
                    parser.skipChildren(); // vm and unknown fields never substitute for v.
                }
                String id=values.get("k");
                String classification=catalog.classifyRaw(id);
                counts.merge(classification,1L,Long::sum);
                if (invalid) { malformed++; continue; }
                var d=catalog.raw(id).orElse(null);
                if (d==null) continue;
                if (d.senseDataDecimals()==null) { unbound++; continue; }
                if ("replay".equalsIgnoreCase(values.get("source")) || "true".equals(values.get("replay")))
                    throw new IOException("Retimed replay excluded");
                result.add(new TelemetryNormalizer.Raw("SENSEDATA",d.rawItemId(),d.rawItemId(),
                        values.get("v"),values.get("t"),received,true,values.get("s"),null,null,null,null,null));
            }
            if (parser.nextToken()!=null) throw new IOException("Unexpected data after SenseData array");
        }
        rejectRebasedLineage(result);
        return new Batch(List.copyOf(result),Map.copyOf(counts),fetched,malformed,unbound,stream.bytes(),System.nanoTime()-started);
    }
    private void rejectRebasedLineage(List<TelemetryNormalizer.Raw> records) throws java.io.IOException {
        if (records.size()!=lineage.count()) return;
        try {
            long minimum=records.stream().mapToLong(r -> Long.parseLong(r.time())).min().orElseThrow();
            String digest=TelemetryRecord.hash(records.stream().map(r -> r.rawItemId()+"|"+boundedCanonical(r.value())+"|"+r.statusClass()+"|"+(Long.parseLong(r.time())-minimum)).sorted().collect(java.util.stream.Collectors.joining("\n")));
            if (digest.equals(lineage.relativeRecordDigest()) && minimum!=lineage.originalMinimumUnixSeconds()) throw new java.io.IOException("Retimed retained seed cohort excluded");
        } catch(NumberFormatException | NullPointerException ignored) { /* malformed values are rejected by normalization */ }
    }
    private static String boundedCanonical(String value) {
        var number=new java.math.BigDecimal(value);
        if (number.scale()>100 || number.scale()<-100 || number.abs().compareTo(java.math.BigDecimal.ONE.scaleByPowerOfTen(100))>=0)
            throw new NumberFormatException("Unbounded lineage value");
        return number.stripTrailingZeros().toPlainString();
    }
    static String text(com.fasterxml.jackson.databind.JsonNode value) { return value==null || value.isNull()?null:value.asText(); }
}
