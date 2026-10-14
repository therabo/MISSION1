package org.mission1.telemetry;

import static org.junit.jupiter.api.Assertions.*;
import static org.mission1.telemetry.TelemetryTestSupport.*;
import static org.mockito.Mockito.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.flywaydb.core.Flyway;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import org.mission1.telemetry.persistence.JdbcTelemetryRepository;
import org.mission1.source.telemetry.*;

@Testcontainers
class TelemetryPostgresTest {
    @Container static final PostgreSQLContainer<?> PG=new PostgreSQLContainer<>("postgres:16.10");
    static JdbcTemplate jdbc;static Flyway flyway;static TransactionTemplate tx;static JdbcTelemetryRepository repository;
    static final Instant SEPT=Instant.parse("2026-09-14T14:10:29Z");
    @BeforeAll static void migrateV1ThenTelemetry() {
        var source=new DriverManagerDataSource(PG.getJdbcUrl(),PG.getUsername(),PG.getPassword());jdbc=new JdbcTemplate(source);
        assertEquals(1,Flyway.configure().dataSource(source).target("1").load().migrate().migrationsExecuted);
        flyway=Flyway.configure().dataSource(source).load();assertEquals(1,flyway.migrate().migrationsExecuted);flyway.validate();
        assertEquals(List.of("1","2"),jdbc.queryForList("SELECT version FROM flyway_schema_history WHERE success ORDER BY installed_rank",String.class));
        assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM telemetry_record",Integer.class));
        assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM telemetry_parameter",Integer.class));
        assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM telemetry_acquisition",Integer.class));
        tx=new TransactionTemplate(new DataSourceTransactionManager(source));repository=new JdbcTelemetryRepository(jdbc,tx,CATALOG,MAPPER);repository.initialize(CATALOG);
    }
    @BeforeEach void emptyEvidence() {
        // Test-only disposal, never a production reset path.
        jdbc.execute("TRUNCATE telemetry_record_evidence,telemetry_admission,telemetry_record,telemetry_acquisition,telemetry_bootstrap_state");
    }
    static TelemetryRepository.StoreResult store(TelemetryRecord... records) {
        String provider=records.length==0?"SENSEDATA":records[0].provider();
        return repository.store(new TelemetryRepository.Acquisition(UUID.randomUUID(),provider,"TEST_CALLBACK","https://test.invalid/",NOW,"COMPLETED",null,records.length),List.of(records));
    }
    static TelemetryRecord record(String value,Instant t,String provider) { return NORMALIZER.normalize(raw("NODE3000005",value,t,provider)).orElseThrow(); }
    static TelemetryRecord head() { return repository.selected("TRANQUILITY",NOW).get(CATALOG.raw("NODE3000005").orElseThrow().parameterId()); }
    @Test void migrationIsStructureOnlyAndRegistryInitializationIsIdempotent() {
        assertEquals(131,jdbc.queryForObject("SELECT count(*) FROM telemetry_parameter",Integer.class));repository.initialize(CATALOG);
        assertEquals(131,jdbc.queryForObject("SELECT count(*) FROM telemetry_parameter",Integer.class));assertEquals(0,flyway.migrate().migrationsExecuted);
        assertEquals(-1371784637,jdbc.queryForObject("SELECT checksum FROM flyway_schema_history WHERE version='1'",Integer.class));
        assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM information_schema.tables WHERE table_name='historical_coverage_state'",Integer.class));
    }
    @Test void repeatedRetainedRecordKeepsDateReceiptAndImmutableValue() {
        var old=record("52",SEPT,"SENSEDATA");assertEquals(1,store(old).inserted());assertEquals(0,store(old).inserted());
        assertEquals(SEPT,head().recordTime());assertEquals(NOW,head().receivedAt());
        assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM telemetry_record",Integer.class));
        assertEquals(2,jdbc.queryForObject("SELECT count(*) FROM telemetry_record_evidence",Integer.class));
        assertThrows(org.springframework.dao.DataAccessException.class,() -> jdbc.update("UPDATE telemetry_record SET raw_value='0'"));
        assertThrows(org.springframework.dao.DataAccessException.class,() -> jdbc.update("DELETE FROM telemetry_acquisition"));
    }
    @Test void newerSameValueIsObservationOlderRetrievedLaterCannotReplaceIt() {
        var first=record("52",SEPT,"SENSEDATA");var newer=record("52",SEPT.plusSeconds(100),"SENSEDATA");
        store(newer);store(first);assertEquals(newer.id(),head().id());
        assertEquals(2,repository.history(first.parameterId(),SEPT,SEPT.plusSeconds(100),null,10).size());
    }
    @Test void historicalIsBestCurrentWithoutAcquisitionFloorOrFutureFallback() {
        var r=record("52",SEPT,"SENSEDATA");store(r);
        assertTrue(repository.selected("TRANQUILITY",SEPT.minusNanos(1)).isEmpty());
        assertEquals(r.id(),repository.selected("TRANQUILITY",SEPT).get(r.parameterId()).id());
        assertEquals(NOW,repository.selected("TRANQUILITY",SEPT.plusSeconds(100)).get(r.parameterId()).receivedAt());
    }
    @Test void roundingCorroborationPrefersFullRepresentationAndConflictDoesNotReplaceHead() {
        var rounded=record("52",SEPT,"SENSEDATA");var exact=record("52.04",SEPT.plusMillis(200),"ISS_LIVE");
        store(rounded);assertEquals(1,store(exact).accepted());assertEquals(exact.id(),head().id());
        var conflict=record("56",SEPT.plusMillis(250),"ISS_LIVE");assertEquals(1,store(conflict).conflicts());assertEquals(exact.id(),head().id());
        assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM telemetry_admission WHERE decision='CONFLICT'",Integer.class));
        assertEquals(3,jdbc.queryForObject("SELECT count(*) FROM telemetry_record",Integer.class));
    }
    @Test void comparableNativeCanSupersedeRetainedButOlderNativeCannotWinByRank() {
        var retained=record("52",SEPT,"SENSEDATA");store(retained);
        var newer=record("54",NOW.minusSeconds(3600),"NATIVE");store(newer);assertEquals(newer.id(),head().id());
        var older=record("51",NOW.minusSeconds(7200),"NATIVE");store(older);assertEquals(newer.id(),head().id());
    }
    @Test void untimedNativeAndResendCannotAdvanceHead() {
        store(record("52",SEPT,"SENSEDATA"));
        var untimed=NORMALIZER.normalize(new TelemetryNormalizer.Raw("NATIVE","NODE3000005","NODE3000005","55",null,NOW,false,"24",null,null,null,null,"Value")).orElseThrow();
        store(untimed);assertEquals(SEPT,head().recordTime());
        var resend=NORMALIZER.normalize(new TelemetryNormalizer.Raw("SENSEDATA","NODE3000005","NODE3000005","55",Long.toString(SEPT.plusSeconds(100).getEpochSecond()),NOW,true,"9",null,null,null,null,null)).orElseThrow();
        store(resend);assertEquals(SEPT,head().recordTime());
        assertEquals(List.of("RESEND","UNTIMED"),jdbc.queryForList("SELECT decision FROM telemetry_admission WHERE decision<>'ACCEPTED' ORDER BY decision",String.class));
    }
    @Test void incomparableArchiveChronologyDoesNotBlindlyAdvanceNative() {
        var nativeRecord=NORMALIZER.normalize(raw("RUSSEG000025","6",NOW.minusSeconds(7200),"NATIVE")).orElseThrow();store(nativeRecord);
        var opaque=NORMALIZER.normalize(raw("RUSSEG000025","6",NOW.minusSeconds(3600),"ISS_LIVE")).orElseThrow();store(opaque);
        assertEquals(nativeRecord.id(),repository.selected("ZVEZDA",NOW).get(nativeRecord.parameterId()).id());
        assertEquals("INCOMPARABLE",jdbc.queryForObject("SELECT decision FROM telemetry_admission WHERE record_id=?",String.class,opaque.id()));
    }
    @Test void historyBoundsCursorAndTieOrdering() {
        var first=record("52",SEPT,"SENSEDATA");var second=record("53",SEPT.plusSeconds(100),"SENSEDATA");store(first,second);
        var query=new TelemetryQueryService(CATALOG,repository,Clock.fixed(NOW,ZoneOffset.UTC));
        var page=query.history(first.parameterId(),SEPT,SEPT.plusSeconds(100),null,1);assertEquals(first.id(),page.nextCursor());
        assertEquals(53,query.history(first.parameterId(),SEPT,SEPT.plusSeconds(100),page.nextCursor(),1).records().getFirst().numericValue().intValue());
        assertThrows(IllegalArgumentException.class,() -> query.history(first.parameterId(),SEPT,SEPT.plus(Duration.ofDays(32)),null,10));
        assertThrows(IllegalArgumentException.class,() -> query.history(first.parameterId(),SEPT,SEPT.plusSeconds(100),"a".repeat(64),10));
    }
    @Test void realCapturedTestFixturesPopulateQualifiedRecordsWithoutRuntimeSeeds() throws Exception {
        var sense=new SenseDataTelemetrySource(MAPPER,CATALOG);var raw=sense.parse(fixture("sensedata-events.txt"),NOW);
        var parsed=raw.stream().map(NORMALIZER::normalize).flatMap(Optional::stream).toArray(TelemetryRecord[]::new);store(parsed);
        assertEquals(42,jdbc.queryForObject("SELECT count(*) FROM telemetry_record",Integer.class));
        var archive=new IssLiveTelemetrySource(MAPPER,CATALOG);var keys=CATALOG.definitions().stream().map(TelemetryCatalog.Definition::issLiveKey).filter(Objects::nonNull).collect(java.util.stream.Collectors.toSet());
        var all=new ArrayList<>(archive.parse(fixture("isslive-stats.json"),NOW,keys));all.addAll(archive.parse(fixture("isslive-russian-stats.json"),NOW,keys));
        store(all.stream().map(NORMALIZER::normalize).flatMap(Optional::stream).toArray(TelemetryRecord[]::new));
        int heads=CATALOG.components().stream().mapToInt(id -> repository.selected(id,NOW).size()).sum();assertEquals(47,heads);
        var query=new TelemetryQueryService(CATALOG,repository,Clock.fixed(NOW,ZoneOffset.UTC));
        assertEquals(57,query.component("QUEST",null).parameters().size());
        assertTrue(query.component("CUPOLA",null).parameters().isEmpty());
        assertEquals("NO_VERIFIED_MAPPING",query.component("PIRS",null).mappingStatus());
        assertThrows(TelemetryQueryService.UnknownResource.class,() -> query.component("NONE",null));
    }
    @Test void durableBootstrapPacingSuccessAndRestart() {
        assertTrue(repository.claimBootstrap("SENSEDATA",NOW));assertFalse(repository.claimBootstrap("SENSEDATA",NOW.plusSeconds(10)));
        assertTrue(repository.claimBootstrap("SENSEDATA",NOW.plus(Duration.ofDays(1))));repository.completeBootstrap("SENSEDATA");
        var restarted=new JdbcTelemetryRepository(jdbc,tx,CATALOG,MAPPER);restarted.initialize(CATALOG);
        assertFalse(restarted.claimBootstrap("SENSEDATA",NOW.plus(Duration.ofDays(2))));
    }
    @Test void explicitRetryRequiresActualFailedAttemptAndPreservesExistingEvidence() {
        var retained=record("52",SEPT,"ISS_LIVE");store(retained);
        assertTrue(repository.claimBootstrap("SENSEDATA",NOW));
        assertFalse(repository.claimBootstrap("SENSEDATA",NOW.plusSeconds(1),true)); // in progress is not failed.
        repository.store(new TelemetryRepository.Acquisition(UUID.randomUUID(),"SENSEDATA","RETAINED_BOOTSTRAP",
                "https://test.invalid/",NOW.plusSeconds(2),"FAILED","IOException",0),List.of());
        assertFalse(repository.claimBootstrap("SENSEDATA",NOW.plusSeconds(3)));
        assertTrue(repository.claimBootstrap("SENSEDATA",NOW.plusSeconds(3),true));
        assertFalse(repository.claimBootstrap("SENSEDATA",NOW.plusSeconds(3),true));
        assertFalse(repository.claimBootstrap("SENSEDATA",NOW.plusSeconds(4),true));
        assertEquals(retained.id(),head().id());
        repository.completeBootstrap("SENSEDATA");
        assertFalse(repository.claimBootstrap("SENSEDATA",NOW.plusSeconds(5),true));
        assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM telemetry_record",Integer.class));
    }
    @Test void everyDefinitionTraversesPersistenceToItsOwnComponentRestRepresentation() {
        var all=CATALOG.definitions().stream().map(d -> NORMALIZER.normalize(raw(d.rawItemId(),"0",NOW.minusSeconds(10),"NATIVE")).orElseThrow()).toArray(TelemetryRecord[]::new);
        assertEquals(131,store(all).inserted());
        var query=new TelemetryQueryService(CATALOG,repository,Clock.fixed(NOW,ZoneOffset.UTC));int exposed=0;
        for (String component:CATALOG.components()) {
            var selected=repository.selected(component,NOW);var rest=query.component(component,null);
            assertEquals(selected.keySet(),rest.parameters().stream().filter(p -> p.record()!=null).map(TelemetryQueryService.Parameter::parameterId).collect(java.util.stream.Collectors.toSet()));
            for (var p:rest.parameters()) {
                assertNotNull(p.record());var d=CATALOG.parameter(p.parameterId()).orElseThrow();
                assertEquals(component,d.componentId());assertEquals(d.rawItemId(),p.record().source().rawItemId());
                assertEquals(d.displayCategory(),p.category());assertEquals(d.label(),p.label());assertEquals(d.unit(),p.unit());
                assertEquals(selected.get(p.parameterId()).recordTime(),p.record().recordTime());exposed++;
            }
        }
        assertEquals(131,exposed);
        assertEquals(131,jdbc.queryForObject("SELECT count(*) FROM telemetry_record_evidence",Integer.class));
    }
    @Test void largeCompleteSseEventTraversesHttpWorkerBatchesPersistenceAndComponentResponses() throws Exception {
        // TEST_ONLY valid full rings: source framing is real HTTP, values never leave this disposable DB.
        var rows=new ArrayList<String>();
        for (var d:CATALOG.definitions()) if (d.senseDataDecimals()!=null)
            for (int n=0;n<150;n++) rows.add(SenseDataStreamingTest.row(d.rawItemId(),NOW.getEpochSecond()-150+n));
        byte[] payload=SenseDataStreamingTest.event("["+String.join(",",rows)+"]");assertTrue(payload.length>262144);
        var server=com.sun.net.httpserver.HttpServer.create(new java.net.InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/events",exchange -> {
            exchange.getResponseHeaders().add("Content-Type","text/event-stream");exchange.sendResponseHeaders(200,0);
            try(var out=exchange.getResponseBody()) {
                for (int offset=0;offset<payload.length;offset+=1024) out.write(payload,offset,Math.min(1024,payload.length-offset));
            }
        });
        server.createContext("/stats",exchange -> {
            byte[] body="{\"stats\":[]}".getBytes(java.nio.charset.StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200,body.length);try(var out=exchange.getResponseBody()){out.write(body);}
        });
        server.start();var base="http://127.0.0.1:"+server.getAddress().getPort();var diagnostics=new TelemetryDiagnostics();
        try(var worker=new TelemetryIngestion(CATALOG,repository,NORMALIZER,diagnostics,Clock.fixed(NOW,ZoneOffset.UTC),
                new TelemetryHttp(Duration.ofSeconds(5)),new SenseDataTelemetrySource(MAPPER,CATALOG),new IssLiveTelemetrySource(MAPPER,CATALOG),
                8,64,true,false,java.net.URI.create(base+"/events"),java.net.URI.create(base+"/stats"),"https://push.lightstreamer.com","ISSLIVE",30000)) {
            worker.start();long deadline=System.nanoTime()+Duration.ofSeconds(30).toNanos();
            while (diagnostics.senseData==null && diagnostics.bootstrapFailures.get()==0 && System.nanoTime()<deadline) Thread.sleep(10);
            assertNotNull(diagnostics.senseData);assertEquals(6300,diagnostics.senseData.fetched());
            assertEquals(6300,diagnostics.senseData.normalized());assertEquals(6300,diagnostics.senseData.inserted());
            assertEquals(6300,diagnostics.senseData.admitted());assertEquals(0,diagnostics.senseData.duplicates());
            assertEquals(0,diagnostics.senseData.rejected());assertEquals(0,diagnostics.bootstrapFailures.get());
            assertEquals(6300,jdbc.queryForObject("SELECT count(*) FROM telemetry_record",Integer.class));
            assertEquals(6300,jdbc.queryForObject("SELECT count(*) FROM telemetry_record_evidence",Integer.class));
            var query=new TelemetryQueryService(CATALOG,repository,Clock.fixed(NOW,ZoneOffset.UTC));int heads=0;
            for (String component:CATALOG.components()) for (var parameter:query.component(component,null).parameters()) {
                if (parameter.record()==null) continue;
                assertEquals(component,CATALOG.parameter(parameter.parameterId()).orElseThrow().componentId());
                assertEquals(NOW.minusSeconds(1),parameter.record().recordTime());heads++;
            }
            assertEquals(42,heads);
            while (jdbc.queryForObject("SELECT count(*) FROM telemetry_bootstrap_state WHERE completed",Integer.class)<2
                    && diagnostics.bootstrapFailures.get()==0 && System.nanoTime()<deadline) Thread.sleep(10);
            assertEquals(2,jdbc.queryForObject("SELECT count(*) FROM telemetry_bootstrap_state WHERE completed",Integer.class));
            assertEquals(0,diagnostics.bootstrapFailures.get());
        } finally { server.stop(0); }
    }
    @Test void restReadTransactionCannotWriteAndChangesNoEvidence() {
        store(record("52",SEPT,"SENSEDATA"));
        var read=new TransactionTemplate(new DataSourceTransactionManager(jdbc.getDataSource()));read.setReadOnly(true);
        read.executeWithoutResult(status -> {assertEquals(1,repository.selected("TRANQUILITY",NOW).size());assertThrows(org.springframework.dao.DataAccessException.class,() -> jdbc.update("INSERT INTO telemetry_bootstrap_state VALUES('SENSEDATA',?,now(),false)",CATALOG.version()));});
        assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM telemetry_record",Integer.class));
    }
}
