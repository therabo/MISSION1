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
        return new TelemetryIngestion(CATALOG,repository,NORMALIZER,diagnostics,Clock.fixed(NOW,ZoneOffset.UTC),http,
                new SenseDataTelemetrySource(MAPPER,CATALOG),new IssLiveTelemetrySource(MAPPER,CATALOG),1,64,bootstrap,false,
                URI.create("https://test.invalid/events"),URI.create("https://test.invalid/stats/"),"https://push.lightstreamer.com","ISSLIVE",30000);
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
        when(repository.claimBootstrap(anyString(),any())).thenReturn(true);
        when(repository.store(any(),any())).thenReturn(new TelemetryRepository.StoreResult(0,0,0));
        when(http.get(any(),anyBoolean(),anyInt())).thenThrow(new java.io.IOException("offline"));
        var both=new CountDownLatch(2);doAnswer(a -> {both.countDown();return new TelemetryRepository.StoreResult(0,0,0);}).when(repository).store(any(),any());
        try(var worker=worker(repository,http,diagnostics,true)) {
            worker.start();assertTrue(both.await(3,TimeUnit.SECONDS));assertEquals(2,diagnostics.bootstrapFailures.get());
            verify(repository).initialize(CATALOG);assertEquals("NOT_STARTED",diagnostics.nativeStatus);
        }
    }
    @Test void successfulBootstrapIsBoundedAndOneLifecycleStart() throws Exception {
        var repository=mock(TelemetryRepository.class);var http=mock(TelemetryHttp.class);var diagnostics=new TelemetryDiagnostics();
        when(repository.claimBootstrap(anyString(),any())).thenReturn(true);
        when(repository.store(any(),any())).thenReturn(new TelemetryRepository.StoreResult(1,1,0));
        when(http.get(any(),eq(true),anyInt())).thenReturn(fixture("sensedata-events.txt"));
        when(http.get(any(),eq(false),anyInt())).thenReturn(fixture("isslive-stats.json"));
        var completed=new CountDownLatch(2);doAnswer(a -> {completed.countDown();return null;}).when(repository).completeBootstrap(anyString());
        try(var worker=worker(repository,http,diagnostics,true)) {
            worker.start();worker.start();assertTrue(completed.await(3,TimeUnit.SECONDS));
            verify(http,times(2)).get(any(),anyBoolean(),anyInt());assertEquals(0,diagnostics.bootstrapFailures.get());
            verify(repository,times(1)).initialize(CATALOG);
        }
    }
    @Test void databaseInitializationFailureDoesNotThrowOnReadinessThread() throws Exception {
        var repository=mock(TelemetryRepository.class);var diagnostics=new TelemetryDiagnostics();var attempted=new CountDownLatch(1);
        doAnswer(a -> {attempted.countDown();throw new IllegalStateException("database failure");}).when(repository).initialize(any());
        try(var worker=worker(repository,mock(TelemetryHttp.class),diagnostics,true)) {
            assertDoesNotThrow(worker::start);assertTrue(attempted.await(3,TimeUnit.SECONDS));
            verify(repository,never()).claimBootstrap(anyString(),any());
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
            assertThrows(java.io.IOException.class,() -> http.get(URI.create(base+"/large"),false,32));
            long started=System.nanoTime();assertThrows(java.io.IOException.class,() -> http.get(URI.create(base+"/silent"),true,1024));
            assertTrue(Duration.ofNanos(System.nanoTime()-started).compareTo(Duration.ofSeconds(3))<0);
        } finally {release.countDown();server.stop(0);}
    }
}
