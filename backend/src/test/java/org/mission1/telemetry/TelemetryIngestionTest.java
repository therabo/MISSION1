package org.mission1.telemetry;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mission1.telemetry.TelemetryTestSupport.*;
import java.net.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.mission1.source.telemetry.*;

class TelemetryIngestionTest {
    TelemetryIngestion worker(TelemetryRepository repository,TelemetryHttp http,TelemetryDiagnostics diagnostics,boolean bootstrap) {
        var state=mock(RetainedTelemetryState.class);
        when(state.initializeProvider(anyString(),any(),any(),any())).thenAnswer(a -> new RetainedTelemetryState.State(a.getArgument(0),null,null,NOW,0,"NEVER_ATTEMPTED",null,null,null,false,RetainedTelemetryState.Result.EMPTY));
        when(state.providerState(anyString())).thenAnswer(a -> new RetainedTelemetryState.State(a.getArgument(0),NOW,NOW,NOW.plusSeconds(1800),0,"COMPLETED",null,null,NOW,true,RetainedTelemetryState.Result.EMPTY));
        when(state.claimProvider(anyString(),any(),any(),any(),any(),any())).thenAnswer(a -> new RetainedTelemetryState.Claim() {
            public void complete(Instant at,boolean success,RetainedTelemetryState.Result result) {}
            public void close() {}
        });
        return new TelemetryIngestion(CATALOG,repository,NORMALIZER,diagnostics,Clock.fixed(NOW,ZoneOffset.UTC),http,
                new SenseDataTelemetrySource(MAPPER,CATALOG),new IssLiveTelemetrySource(MAPPER,CATALOG),1,64,bootstrap,false,
                URI.create("https://test.invalid/events"),URI.create("https://test.invalid/stats/"),"https://push.lightstreamer.com","ISSLIVE",30000).retained(state,TelemetryTimer.owned(Clock.fixed(NOW,ZoneOffset.UTC)),new RetainedTelemetryReconciler.Policy(false,Duration.ofMinutes(30),Duration.ofHours(6)));
    }
    @Test void callbackQueueNeverBlocksAndOverloadIsCounted() {
        var diagnostics=new TelemetryDiagnostics();
        try(var worker=worker(mock(TelemetryRepository.class),mock(TelemetryHttp.class),diagnostics,false)) {
            assertTrue(worker.offer(raw("NODE3000005","52",NOW,"NATIVE")));
            assertFalse(worker.offer(raw("NODE3000005","53",NOW,"NATIVE")));assertEquals(1,diagnostics.queueDrops.get());
        }
    }
    @Test void sourcesUnavailableAfterStartupRemainIsolated() throws Exception {
        var repository=mock(TelemetryRepository.class);var http=mock(TelemetryHttp.class);var diagnostics=new TelemetryDiagnostics();
        when(repository.store(any(),any())).thenReturn(new TelemetryRepository.StoreResult(0,0,0));
        when(http.get(any(),anyInt())).thenThrow(new java.io.IOException("offline"));
        when(http.initialSse(any(),any(),any())).thenThrow(new java.io.IOException("offline"));
        var both=new CountDownLatch(2);doAnswer(a -> {both.countDown();return new TelemetryRepository.StoreResult(0,0,0);}).when(repository).store(any(),any());
        try(var worker=worker(repository,http,diagnostics,true)) {
            worker.start();assertTrue(both.await(3,TimeUnit.SECONDS));
            verify(repository,timeout(3000).times(2)).store(any(),any());
            long until=System.nanoTime()+Duration.ofSeconds(3).toNanos();while(diagnostics.bootstrapFailures.get()<2 && System.nanoTime()<until)Thread.sleep(5);assertEquals(2,diagnostics.bootstrapFailures.get());
            verify(repository).initialize(CATALOG);assertEquals("NOT_STARTED",diagnostics.nativeStatus);
        }
    }
    @Test void successfulBootstrapIsBoundedAndOneLifecycleStart() throws Exception {
        var repository=mock(TelemetryRepository.class);var http=mock(TelemetryHttp.class);var diagnostics=new TelemetryDiagnostics();
        when(repository.store(any(),any(),any())).thenReturn(new TelemetryRepository.StoreResult(1,1,0));
        when(http.initialSse(any(),any(),any())).thenAnswer(a -> new SenseDataTelemetrySource(MAPPER,CATALOG)
                .parse(new java.io.ByteArrayInputStream((fixture("sensedata-events.txt")+"\n\n").getBytes(java.nio.charset.StandardCharsets.UTF_8)),NOW));
        when(http.get(any(),anyInt())).thenReturn(fixture("isslive-stats.json"));
        try(var worker=worker(repository,http,diagnostics,true)) {
            worker.start();worker.start();verify(repository,timeout(3000).times(2)).store(any(),any(),any());
            verify(http,times(1)).get(any(),anyInt());verify(http,times(1)).initialSse(any(),any(),any());
            assertEquals(0,diagnostics.bootstrapFailures.get());assertNotNull(diagnostics.senseData);
            verify(repository,times(1)).initialize(CATALOG);
        }
    }
    @Test void databaseInitializationFailureDoesNotThrowOnReadinessThread() throws Exception {
        var repository=mock(TelemetryRepository.class);var diagnostics=new TelemetryDiagnostics();var attempted=new CountDownLatch(1);
        doAnswer(a -> {attempted.countDown();throw new IllegalStateException("database failure");}).when(repository).initialize(any());
        try(var worker=worker(repository,mock(TelemetryHttp.class),diagnostics,true)) {
            assertDoesNotThrow(worker::start);assertTrue(attempted.await(3,TimeUnit.SECONDS));
            assertFalse(diagnostics.retainedRunning);
        }
    }
    @Test void boundedHttpRejectsOversizedBodyAndClosesSilentSse() throws Exception {
        var server=com.sun.net.httpserver.HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/large",exchange -> {exchange.sendResponseHeaders(200,100);try(var output=exchange.getResponseBody()){output.write(new byte[100]);}});
        var release=new CountDownLatch(1);
        server.createContext("/silent",exchange -> {exchange.getResponseHeaders().add("Content-Type","text/event-stream");exchange.sendResponseHeaders(200,0);try {release.await(3,TimeUnit.SECONDS);}catch(InterruptedException e){Thread.currentThread().interrupt();}exchange.close();});
        server.setExecutor(Executors.newVirtualThreadPerTaskExecutor());server.start();
        try(var http=new TelemetryHttp(Duration.ofSeconds(1))) {
            var base="http://127.0.0.1:"+server.getAddress().getPort();
            assertThrows(java.io.IOException.class,() -> http.get(URI.create(base+"/large"),32));
            long started=System.nanoTime();assertThrows(java.io.IOException.class,() -> http.initialSse(URI.create(base+"/silent"),Duration.ofSeconds(1),
                    input -> new SenseDataTelemetrySource(MAPPER,CATALOG).parse(input,NOW)));
            assertTrue(Duration.ofNanos(System.nanoTime()-started).compareTo(Duration.ofSeconds(3))<0);
            started=System.nanoTime();
            assertThrows(java.io.IOException.class,() -> http.initialSse(URI.create(base+"/silent"),Duration.ofMillis(100),
                    input -> new SenseDataTelemetrySource(MAPPER,CATALOG).parse(input,NOW)));
            assertTrue(Duration.ofNanos(System.nanoTime()-started).compareTo(Duration.ofSeconds(2))<0);
        } finally {release.countDown();server.stop(0);}
    }
    @Test void shutdownClosesActiveStreamBeforeLongDeadline() throws Exception {
        var server=com.sun.net.httpserver.HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        var entered=new CountDownLatch(1);var release=new CountDownLatch(1);
        try(var executor=Executors.newVirtualThreadPerTaskExecutor();var http=new TelemetryHttp(Duration.ofSeconds(10))) {
            server.setExecutor(executor);
            server.createContext("/events",e -> {
                e.getResponseHeaders().set("Content-Type","text/event-stream");e.sendResponseHeaders(200,0);
                try(var output=e.getResponseBody()){output.write('x');output.flush();release.await(5,TimeUnit.SECONDS);}
                catch(InterruptedException stop){Thread.currentThread().interrupt();}
            });server.start();
            var request=CompletableFuture.runAsync(() -> assertThrows(java.io.IOException.class,() -> http.initialSse(
                    URI.create("http://127.0.0.1:"+server.getAddress().getPort()+"/events"),Duration.ofSeconds(60),input -> {
                        entered.countDown();while(input.read()!=-1) {}return null;
                    })));
            assertTrue(entered.await(3,TimeUnit.SECONDS));long started=System.nanoTime();http.close();request.get(2,TimeUnit.SECONDS);
            assertTrue(Duration.ofNanos(System.nanoTime()-started).compareTo(Duration.ofSeconds(2))<0);
            release.countDown();server.stop(0);
        } finally {release.countDown();server.stop(0);}
    }

}
