package org.mission1.telemetry;

import static org.junit.jupiter.api.Assertions.*;
import static org.mission1.telemetry.TelemetryTestSupport.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.junit.jupiter.api.*;
import org.mission1.source.telemetry.SenseDataTelemetrySource;

class SenseDataStreamingTest {
    static byte[] event(String records) { return ("event: records\ndata: "+records+"\n\n").getBytes(StandardCharsets.UTF_8); }
    static String row(String id,long time) { return "{\"k\":\""+id+"\",\"v\":0,\"t\":"+time+",\"s\":24,\"vm\":99}"; }
    static final class Chunked extends ByteArrayInputStream {
        boolean closed;
        Chunked(byte[] data) { super(data); }
        @Override public synchronized int read(byte[] target,int offset,int size) { return super.read(target,offset,Math.min(size,3)); }
        @Override public void close() { closed=true; }
    }
    SenseDataTelemetrySource source() { return new SenseDataTelemetrySource(MAPPER,CATALOG); }
    @Test void legitimateFullChannelRingsLargerThan256KiBAreIncrementallyParsed() throws Exception {
        // TEST_ONLY: the pinned provider has 150 slots per channel, not one record.
        var rows=new ArrayList<String>();
        for (var definition:CATALOG.definitions()) if (definition.senseDataDecimals()!=null)
            for (int n=0;n<150;n++) rows.add(row(definition.rawItemId(),NOW.getEpochSecond()-150+n));
        byte[] body=event("["+String.join(",",rows)+"]");assertTrue(body.length>262144);
        var input=new Chunked(body);var batch=source().parse(input,NOW);
        assertTrue(input.closed);assertEquals(6300,batch.fetched());assertEquals(6300,batch.records().size());
        assertEquals(body.length,batch.eventBytes());assertEquals(0,batch.malformed());assertEquals(0,batch.unboundComponentRecords());
        assertEquals(6300,batch.classifications().get("QUALIFIED_COMPONENT_MATCH"));
        assertEquals(6300,batch.records().stream().filter(r -> NORMALIZER.normalize(r).isPresent()).count());
    }
    @Test void multilineCrLfCommentsAndLaterLiveEventsDoNotChangeInitialBackfill() throws Exception {
        String first=": heartbeat\r\nevent: records\r\ndata: [\r\ndata: "+row("NODE3000005",NOW.getEpochSecond()-1)+"\r\ndata: ]\r\n\r\n";
        var input=new Chunked((first+"event: records\ndata: "+"x".repeat(100000)).getBytes(StandardCharsets.UTF_8));
        var batch=source().parse(input,NOW);assertEquals(1,batch.records().size());assertTrue(input.closed);
        assertEquals(first.getBytes(StandardCharsets.UTF_8).length,batch.eventBytes());
        assertEquals("0",batch.records().getFirst().value());
    }
    @Test void crOnlySseFramingClosesAtItsBlankTerminator() throws Exception {
        String body="event: records\rdata: ["+row("NODE3000005",NOW.getEpochSecond()-1)+"]\r\r";
        assertEquals(1,source().parse(new Chunked(body.getBytes(StandardCharsets.UTF_8)),NOW).records().size());
    }
    @Test void everyRawItemIsClassifiedWithExactIdsAndNoPrefixFallback() throws Exception {
        var ids=List.of("NODE3000005","USLAB000017","AIRLOCK000054","RUSSEG000017","TIME_000001","STATUS","USLAB999999"," node3000005 ");
        var body=event(ids.stream().map(id -> row(id,NOW.getEpochSecond()-1)).collect(java.util.stream.Collectors.joining(",","[","]")));
        var batch=source().parse(new Chunked(body),NOW);
        assertEquals(8,batch.fetched());assertEquals(1,batch.records().size());
        assertEquals(Map.of("QUALIFIED_COMPONENT_MATCH",1L,"QUALIFIED_STATION_SYSTEM_MATCH",1L,
                "BLOCKED_DEFINITION",2L,"EXCLUDED_CONTROL",1L,"PROVIDER_LOCAL_STATUS",1L,"UNKNOWN_RAW_ID",2L),batch.classifications());
        assertEquals(batch.fetched(),batch.classifications().values().stream().mapToLong(Long::longValue).sum());
    }
    @Test void eventAndRecordCountAreHardBoundsAndCloseOnFailure() {
        var rows=event("["+String.join(",",Collections.nCopies(20,row("NODE3000005",NOW.getEpochSecond())))+"]");
        var small=new SenseDataTelemetrySource(MAPPER,CATALOG,new SenseDataTelemetrySource.Limits(256,100));
        var input=new Chunked(rows);assertThrows(IOException.class,() -> small.parse(input,NOW));assertTrue(input.closed);
        var few=new SenseDataTelemetrySource(MAPPER,CATALOG,new SenseDataTelemetrySource.Limits(4096,2));
        assertThrows(IOException.class,() -> few.parse(new Chunked(event("["+String.join(",",Collections.nCopies(3,row("NODE3000005",NOW.getEpochSecond())))+"]")),NOW));
    }
    @Test void partialJsonAndMissingSseTerminatorAreRejected() {
        for (String body:List.of("event: records\ndata: [", "event: records\ndata: []\n", "event: records\ndata: [1\n\n"))
            assertThrows(IOException.class,() -> source().parse(new Chunked(body.getBytes(StandardCharsets.UTF_8)),NOW));
    }
    @Test void malformedRecordFieldsAreIsolatedAndMeansNeverBecomeValues() throws Exception {
        String valid=row("NODE3000005",NOW.getEpochSecond()-1);
        String malformed="{\"k\":\"NODE3000005\",\"v\":{},\"t\":1,\"s\":24}";
        String oversized=valid.replace("\"v\":0","\"v\":\""+"9".repeat(129)+"\"");
        var batch=source().parse(new Chunked(event("["+malformed+","+oversized+","+valid+"]")),NOW);
        assertEquals(3,batch.fetched());assertEquals(2,batch.malformed());assertEquals(1,batch.records().size());
        assertEquals("0",batch.records().getFirst().value());
    }
    @Test void futureDatesRemainOriginalInputAndAreRejectedByUnchangedNormalizationPolicy() throws Exception {
        long future=NOW.plusSeconds(121).getEpochSecond();
        var batch=source().parse(new Chunked(event("["+row("NODE3000005",future)+"]")),NOW);
        assertEquals(Long.toString(future),batch.records().getFirst().time());
        assertTrue(NORMALIZER.normalize(batch.records().getFirst()).isEmpty());
    }
}
