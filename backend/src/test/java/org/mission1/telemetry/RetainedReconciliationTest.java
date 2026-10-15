package org.mission1.telemetry;

import static org.junit.jupiter.api.Assertions.*;
import static org.mission1.telemetry.TelemetryTestSupport.*;
import java.io.*;
import java.net.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.*;
import org.flywaydb.core.Flyway;
import org.mission1.api.TelemetryController;
import org.mission1.source.telemetry.*;
import org.mission1.telemetry.persistence.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;

/** TEST_ONLY providers and clock, real deadline abstraction, HTTP/parser/admission/PostgreSQL/REST. */
@Testcontainers
class RetainedReconciliationTest {
    @Container static final PostgreSQLContainer<?> PG=new PostgreSQLContainer<>("postgres:16.10");
    static JdbcTemplate jdbc;static JdbcTelemetryRepository records;static JdbcRetainedTelemetryState state;
    static final Duration INTERVAL=Duration.ofMinutes(30),MAX=Duration.ofHours(6);
    static class MutableClock extends Clock {
        volatile Instant now=NOW;
        public ZoneId getZone(){return ZoneOffset.UTC;}public Clock withZone(ZoneId ignored){return this;}public Instant instant(){return now;}
    }
    static class Timer implements TelemetryTimer {
        record Task(Instant at,Runnable action) {}
        final MutableClock clock;final PriorityQueue<Task> tasks=new PriorityQueue<>(Comparator.comparing(Task::at));boolean closed;
        Timer(MutableClock clock){this.clock=clock;}
        public synchronized void schedule(Runnable action,Instant at){if(!closed)tasks.add(new Task(at,action));}
        public synchronized void close(){closed=true;tasks.clear();}
        void due(){while(true){Task task;synchronized(this){task=tasks.peek();if(task==null||task.at().isAfter(clock.instant()))return;tasks.remove();}task.action().run();}}
        void advance(Duration duration){clock.now=clock.now.plus(duration);due();}
    }
    MutableClock clock;Timer timer;HttpServer server;TelemetryIngestion ingestion;TelemetryDiagnostics diagnostics;
    AtomicReference<String> sense=new AtomicReference<>(),archive=new AtomicReference<>();AtomicInteger senseCalls=new AtomicInteger(),archiveCalls=new AtomicInteger();
    volatile boolean senseFailure,archiveFailure;volatile CountDownLatch senseEntered,senseRelease;
    @BeforeAll static void database(){
        var source=new DriverManagerDataSource(PG.getJdbcUrl(),PG.getUsername(),PG.getPassword());jdbc=new JdbcTemplate(source);
        var flyway=Flyway.configure().dataSource(source).load();assertEquals(3,flyway.migrate().migrationsExecuted);flyway.validate();
        assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM telemetry_provider_state",Integer.class));
        records=new JdbcTelemetryRepository(jdbc,new TransactionTemplate(new DataSourceTransactionManager(source)),CATALOG,MAPPER);records.initialize(CATALOG);
        state=new JdbcRetainedTelemetryState(jdbc,CATALOG);
    }
    @BeforeEach void start() throws Exception {
        jdbc.execute("TRUNCATE telemetry_time_rejection,telemetry_record_evidence,telemetry_admission,telemetry_record,telemetry_acquisition,telemetry_bootstrap_state,telemetry_provider_state");
        clock=new MutableClock();timer=new Timer(clock);diagnostics=new TelemetryDiagnostics();sense.set(event("52",NOW.minusSeconds(60)));archive.set("{\"stats\":[]}");
        server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);server.setExecutor(Executors.newVirtualThreadPerTaskExecutor());
        server.createContext("/events",e -> {
            senseCalls.incrementAndGet();
            if(senseFailure){e.sendResponseHeaders(503,-1);e.close();return;}
            e.getResponseHeaders().set("Content-Type","text/event-stream");e.sendResponseHeaders(200,0);
            if(senseEntered!=null){senseEntered.countDown();try {senseRelease.await(10,TimeUnit.SECONDS);}catch(InterruptedException stop){Thread.currentThread().interrupt();}}
            try(var out=e.getResponseBody()){out.write(sense.get().getBytes(java.nio.charset.StandardCharsets.UTF_8));}
        });
        server.createContext("/stats",e -> {archiveCalls.incrementAndGet();if(archiveFailure){e.sendResponseHeaders(503,-1);e.close();return;}byte[] body=archive.get().getBytes();e.sendResponseHeaders(200,body.length);try(var out=e.getResponseBody()){out.write(body);}});
        server.start();launch();
    }
    void launch() throws Exception {
        String base="http://127.0.0.1:"+server.getAddress().getPort();
        ingestion=new TelemetryIngestion(CATALOG,records,NORMALIZER,diagnostics,clock,new TelemetryHttp(Duration.ofSeconds(5)),new SenseDataTelemetrySource(MAPPER,CATALOG),
                new IssLiveTelemetrySource(MAPPER,CATALOG),1024,64,true,false,URI.create(base+"/events"),URI.create(base+"/stats"),"https://push.lightstreamer.com","ISSLIVE",30000)
                .retained(state,timer,RetainedTelemetryReconciler.Policy.DEFAULT);
        ingestion.start();ingestion.start();await(() -> {synchronized(timer){return timer.tasks.size()==2;}});timer.due();
    }
    @AfterEach void stop(){if(senseRelease!=null)senseRelease.countDown();if(ingestion!=null)ingestion.close();if(server!=null)server.stop(0);}
    static String event(String value,Instant at){return "event: records\ndata: [{\"k\":\"NODE3000005\",\"v\":"+value+",\"t\":"+at.getEpochSecond()+",\"s\":24}]\n\n";}
    static void await(java.util.function.BooleanSupplier check) throws Exception {long until=System.nanoTime()+Duration.ofSeconds(10).toNanos();while(!check.getAsBoolean()&&System.nanoTime()<until)Thread.sleep(5);assertTrue(check.getAsBoolean());}
    TelemetryRecord head(){return records.selected("TRANQUILITY",clock.instant()).get(CATALOG.raw("NODE3000005").orElseThrow().parameterId());}
    int count(String table){return jdbc.queryForObject("SELECT count(*) FROM "+table,Integer.class);}
    void rest(String expected,Instant at) throws Exception {
        var mapper=MAPPER.copy().findAndRegisterModules().disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        var mvc=MockMvcBuilders.standaloneSetup(new TelemetryController(new TelemetryQueryService(CATALOG,records,clock)))
                .setMessageConverters(new MappingJackson2HttpMessageConverter(mapper)).build();
        String body=mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/iss/components/TRANQUILITY/telemetry")).andReturn().getResponse().getContentAsString();
        var parameter=mapper.readTree(body).path("parameters");var value=java.util.stream.StreamSupport.stream(parameter.spliterator(),false).filter(p -> p.path("parameterId").asText().equals(head().parameterId())).findFirst().orElseThrow().path("record");
        assertEquals(expected,value.path("numericValue").asText());assertEquals(at.toString(),value.path("recordTime").asText());
    }
    @Test void automaticDiscoverySameValueOlderDuplicatesAndRest() throws Exception {
        Instant first=NOW.minusSeconds(60);assertEquals(first,head().recordTime());assertEquals(1,senseCalls.get());assertEquals(1,archiveCalls.get());
        timer.due();assertEquals(1,senseCalls.get());
        Instant newer=NOW.minusSeconds(10);sense.set(event("53",newer));timer.advance(INTERVAL);assertEquals(newer,head().recordTime());rest("53",newer);
        assertEquals("RETAINED_RECONCILIATION",new TelemetryQueryService(CATALOG,records,clock).component("TRANQUILITY",null).parameters().stream().filter(p -> p.parameterId().equals(head().parameterId())).findFirst().orElseThrow().record().source().acquisitionMethod());
        Instant same=newer.plusSeconds(1);sense.set(event("53",same));timer.advance(INTERVAL);assertEquals(same,head().recordTime());rest("53",same);
        for(int n=0;n<12;n++)timer.advance(INTERVAL);assertEquals(3,count("telemetry_record"));assertEquals(same,head().recordTime());
        sense.set(event("51",first.minusSeconds(10)));timer.advance(INTERVAL);assertEquals(same,head().recordTime());
        assertEquals(4,count("telemetry_record"));assertEquals(2,count("telemetry_acquisition")/senseCalls.get());
        assertTrue(records.selected("TRANQUILITY",first.minusSeconds(1)).values().stream().allMatch(r -> !r.recordTime().isAfter(first.minusSeconds(1))));
    }
    @Test void issLiveAloneChangesThenSameValueNewTimeWhileNativeSilent() throws Exception {
        Instant r1=NOW.minusSeconds(5),r2=r1.plusSeconds(1);
        archive.set("{\"stats\":[{\"sensor\":\"waste_water_tank_fill_level\",\"latest\":{\"v\":12,\"t\":\""+r1+"\"}}]}");
        timer.advance(INTERVAL);String id=CATALOG.raw("NODE3000008").orElseThrow().parameterId();
        assertEquals(r1,records.selected("TRANQUILITY",clock.instant()).get(id).recordTime());
        archive.set(archive.get().replace(r1.toString(),r2.toString()));timer.advance(INTERVAL);
        var selected=records.selected("TRANQUILITY",clock.instant()).get(id);assertEquals(r2,selected.recordTime());assertEquals(12,selected.numericValue().intValue());assertEquals("RETAINED_RECONCILIATION",selected.acquisitionMethod());
        assertEquals(0,diagnostics.callbacks.get());assertEquals(1,state.providerState("ISS_LIVE").result().headsAdvanced());
    }
    @Test void bootstrapOnlyStopsAndDisabledLifecycleSchedulesNothing() {
        ingestion.close();var onlyBootstrap=new Timer(clock);var status=new TelemetryDiagnostics();
        try(var lifecycle=new RetainedTelemetryReconciler(state,clock,onlyBootstrap,new RetainedTelemetryReconciler.Policy(false,INTERVAL,MAX),true,status,
                (provider,kind) -> {throw new AssertionError("Completed bootstrap cannot refetch");})) {
            lifecycle.start();onlyBootstrap.due();assertFalse(status.retainedRunning);assertTrue(onlyBootstrap.tasks.isEmpty());
        }
        var disabled=new Timer(clock);
        try(var lifecycle=new RetainedTelemetryReconciler(state,clock,disabled,new RetainedTelemetryReconciler.Policy(false,INTERVAL,MAX),false,status,
                (provider,kind) -> {throw new AssertionError("Disabled sources cannot fetch");})) {
            lifecycle.start();assertFalse(status.retainedRunning);assertTrue(disabled.tasks.isEmpty());
        }
    }
    @Test void repeatedWakeupAndCloseCannotDuplicateSchedules() throws Exception {
        Timer.Task stale;synchronized(timer){stale=timer.tasks.peek();}
        timer.advance(INTERVAL);int calls=senseCalls.get()+archiveCalls.get();stale.action().run();timer.due();assertEquals(calls,senseCalls.get()+archiveCalls.get());
        synchronized(timer){assertEquals(2,timer.tasks.size());}
        ingestion.close();ingestion.start();timer.advance(Duration.ofDays(2));assertEquals(calls,senseCalls.get()+archiveCalls.get());assertFalse(diagnostics.retainedRunning);
    }
    @Test void freshZeroBootstrapIsSuccessfulAndReconcilesLater() throws Exception {
        ingestion.close();jdbc.execute("TRUNCATE telemetry_time_rejection,telemetry_record_evidence,telemetry_admission,telemetry_record,telemetry_acquisition,telemetry_bootstrap_state,telemetry_provider_state");
        sense.set("event: records\ndata: []\n\n");senseCalls.set(0);archiveCalls.set(0);timer=new Timer(clock);launch();
        assertEquals(0,count("telemetry_record"));assertTrue(state.providerState("SENSEDATA").bootstrapCompleted());assertEquals(1,senseCalls.get());timer.due();assertEquals(1,senseCalls.get());
        sense.set(event("57",NOW.minusSeconds(1)));timer.advance(INTERVAL);assertEquals(57,head().numericValue().intValue());assertEquals(2,senseCalls.get());
    }
    @Test void pacingSurvivesRestartAtFiveAndThirtyOneMinutes() throws Exception {
        ingestion.close();clock.now=NOW.plus(Duration.ofMinutes(5));timer=new Timer(clock);launch();assertEquals(1,senseCalls.get());
        ingestion.close();clock.now=NOW.plus(Duration.ofMinutes(31));timer=new Timer(clock);launch();assertEquals(2,senseCalls.get());timer.due();assertEquals(2,senseCalls.get());
        assertEquals(clock.instant().plus(INTERVAL),state.providerState("SENSEDATA").nextEligibleAt());assertEquals(1,count("telemetry_record"));
    }
    @Test void durableBackoffAndProviderIndependenceResetAfterSuccess() {
        senseFailure=true;timer.advance(INTERVAL);assertEquals(1,state.providerState("SENSEDATA").consecutiveFailures());
        assertEquals(clock.instant().plus(Duration.ofHours(1)),state.providerState("SENSEDATA").nextEligibleAt());assertEquals(0,state.providerState("ISS_LIVE").consecutiveFailures());
        int failedCalls=senseCalls.get();timer.advance(INTERVAL);assertEquals(failedCalls,senseCalls.get());assertEquals(3,archiveCalls.get());
        timer.advance(INTERVAL);assertEquals(2,state.providerState("SENSEDATA").consecutiveFailures());
        timer.advance(Duration.ofHours(2));assertEquals(clock.instant().plus(Duration.ofHours(4)),state.providerState("SENSEDATA").nextEligibleAt());
        timer.advance(Duration.ofHours(4));assertEquals(clock.instant().plus(MAX),state.providerState("SENSEDATA").nextEligibleAt());
        senseFailure=false;sense.set(event("55",NOW.plusSeconds(5)));timer.advance(MAX);
        assertEquals(0,state.providerState("SENSEDATA").consecutiveFailures());assertEquals(clock.instant().plus(INTERVAL),state.providerState("SENSEDATA").nextEligibleAt());assertEquals(55,head().numericValue().intValue());
        archiveFailure=true;timer.advance(INTERVAL);assertEquals(1,state.providerState("ISS_LIVE").consecutiveFailures());assertEquals(0,state.providerState("SENSEDATA").consecutiveFailures());
    }
    @Test void unrepresentableCalendarIsInvalidInputAndNotAnAcquisitionFailure() {
        sense.set(event("73",Instant.parse("+300000-01-01T00:00:00Z")));timer.advance(INTERVAL);
        assertEquals("COMPLETED",state.providerState("SENSEDATA").lastOutcome());assertEquals(0,state.providerState("SENSEDATA").consecutiveFailures());
        assertEquals(1,state.providerState("SENSEDATA").result().rejected());assertEquals(0,count("telemetry_time_rejection"));
        assertEquals(NOW.minusSeconds(60),head().recordTime());assertEquals(clock.instant().plus(INTERVAL),state.providerState("SENSEDATA").nextEligibleAt());
    }
    @Test void futureIdentityRemainsRejectedWhenClockCatchesUpAndAfterRestart() throws Exception {
        Instant future=NOW.plus(Duration.ofDays(120));sense.set(event("73",future));timer.advance(INTERVAL);
        assertEquals(1,count("telemetry_time_rejection"));assertEquals(1,count("telemetry_record"));
        assertEquals("COMPLETED",state.providerState("SENSEDATA").lastOutcome());assertEquals(0,state.providerState("SENSEDATA").consecutiveFailures());
        ingestion.close();clock.now=future.plusSeconds(60);
        sense.set("event: records\ndata: [{\"k\":\"NODE3000005\",\"v\":73,\"t\":"+future.getEpochSecond()+",\"s\":24},"
                +"{\"k\":\"NODE3000005\",\"v\":73.0,\"t\":"+future.getEpochSecond()+",\"s\":9}]\n\n");
        timer=new Timer(clock);launch();assertEquals(2,state.providerState("SENSEDATA").result().rejected());assertEquals(0,state.providerState("SENSEDATA").result().duplicates());
        assertEquals(1,count("telemetry_time_rejection"));assertEquals(1,count("telemetry_record"));assertEquals(NOW.minusSeconds(60),head().recordTime());
        assertEquals(future.getEpochSecond()+"",jdbc.queryForObject("SELECT original_time FROM telemetry_time_rejection",String.class));
        assertThrows(org.springframework.dao.DataAccessException.class,() -> jdbc.update("DELETE FROM telemetry_time_rejection"));
    }
    @Test void zeroThenPartialThenAdditionalCoverageStillSchedules() {
        sense.set("event: records\ndata: []\n\n");timer.advance(INTERVAL);assertEquals(0,state.providerState("SENSEDATA").result().mapped());
        sense.set(event("54",NOW.minusSeconds(5)));timer.advance(INTERVAL);assertEquals(54,head().numericValue().intValue());
        archive.set("{\"stats\":[{\"sensor\":\"waste_water_tank_fill_level\",\"latest\":{\"v\":12,\"t\":\""+NOW.minusSeconds(10)+"\"}}]}");timer.advance(INTERVAL);
        assertEquals(2,records.selected("TRANQUILITY",clock.instant()).size());assertTrue(state.providerState("ISS_LIVE").bootstrapCompleted());
    }
    @Test void oneOwnerEvenAfterDeadlineAcrossIndependentRepositoryInstances() {
        Instant due=NOW.plus(INTERVAL);clock.now=due;
        try(var claim=state.claimProvider("SENSEDATA",due,due,INTERVAL,MAX,"RETAINED_RECONCILIATION")) {
            assertNotNull(claim);var other=new JdbcRetainedTelemetryState(jdbc,CATALOG);
            assertNull(other.claimProvider("SENSEDATA",due,due.plus(Duration.ofDays(2)),INTERVAL,MAX,"RETAINED_BOOTSTRAP"));
            try(var independent=other.claimProvider("ISS_LIVE",due,due,INTERVAL,MAX,"RETAINED_RECONCILIATION")){assertNotNull(independent);independent.complete(due,true,RetainedTelemetryState.Result.EMPTY);}
            claim.complete(due,true,RetainedTelemetryState.Result.EMPTY);
        }
        assertNull(state.claimProvider("SENSEDATA",due,due.plusSeconds(300),INTERVAL,MAX,"RETAINED_RECONCILIATION"));
    }
    @Test void interruptedClaimRetainsPessimisticBackoffWithoutPermanentLock() {
        Instant due=NOW.plus(INTERVAL);
        try(var claim=state.claimProvider("SENSEDATA",due,due,INTERVAL,MAX,"RETAINED_RECONCILIATION")){assertNotNull(claim);}
        assertNull(state.claimProvider("SENSEDATA",due,due.plusSeconds(300),INTERVAL,MAX,"RETAINED_RECONCILIATION"));
        Instant retry=due.plus(Duration.ofHours(1));try(var claim=state.claimProvider("SENSEDATA",retry,retry,INTERVAL,MAX,"RETAINED_RECONCILIATION")){assertNotNull(claim);claim.complete(retry,true,RetainedTelemetryState.Result.EMPTY);}
    }
    @Test void largeRetainedEventAndNativeWorkerRemainConcurrent() throws Exception {
        var rows=new ArrayList<String>();for(var d:CATALOG.definitions())if(d.senseDataDecimals()!=null)for(int n=0;n<150;n++)rows.add(SenseDataStreamingTest.row(d.rawItemId(),NOW.getEpochSecond()-150+n));
        sense.set("event: records\ndata: ["+String.join(",",rows)+"]\n\n");senseEntered=new CountDownLatch(1);senseRelease=new CountDownLatch(1);
        clock.now=NOW.plus(INTERVAL);var reconciliation=CompletableFuture.runAsync(timer::due);assertTrue(senseEntered.await(3,TimeUnit.SECONDS));
        long started=System.nanoTime();assertTrue(ingestion.offer(raw("NODE3000005","61",clock.instant().minusSeconds(1),"NATIVE")));
        await(() -> head().numericValue().intValue()==61);double blockedNetworkLatency=(System.nanoTime()-started)/1e6;assertTrue(blockedNetworkLatency<2000);
        senseRelease.countDown();
        // Feed callbacks while retained batches are writing, not only during blocked I/O.
        started=System.nanoTime();for(int n=0;n<128;n++)assertTrue(ingestion.offer(raw("NODE3000008",Integer.toString(n),clock.instant().minusSeconds(200-n),"NATIVE")));
        String parameter=CATALOG.raw("NODE3000008").orElseThrow().parameterId();await(() -> records.selected("TRANQUILITY",clock.instant()).containsKey(parameter) && records.selected("TRANQUILITY",clock.instant()).get(parameter).numericValue().intValue()==127);
        double writingLatency=(System.nanoTime()-started)/1e6;reconciliation.get(30,TimeUnit.SECONDS);
        assertEquals(0,diagnostics.queueDrops.get());assertEquals(0,diagnostics.persistenceFailures.get());assertEquals(6300,state.providerState("SENSEDATA").result().fetched());
        System.out.printf("TEST_ONLY native during retained: blocked I/O %.3f ms; 128 callbacks during batches %.3f ms%n",blockedNetworkLatency,writingLatency);
    }
}
