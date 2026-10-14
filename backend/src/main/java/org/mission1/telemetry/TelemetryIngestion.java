package org.mission1.telemetry;

import java.net.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.mission1.source.telemetry.*;
import org.slf4j.LoggerFactory;

/** Independent daemon worker. Bootstrap, SDK callback handoff and JDBC never block readiness. */
public final class TelemetryIngestion implements AutoCloseable {
    private final TelemetryCatalog catalog;
    private final TelemetryRepository repository;
    private final TelemetryNormalizer normalizer;
    private final TelemetryDiagnostics diagnostics;
    private final Clock clock;
    private final TelemetryHttp http;
    private final SenseDataTelemetrySource sense;
    private final IssLiveTelemetrySource archive;
    private final BlockingQueue<TelemetryNormalizer.Raw> queue;
    private final int batchSize;
    private final boolean bootstrap, nativeEnabled;
    private final boolean retryFailedBootstrap;
    private final Duration senseTimeout;
    private final URI senseUri, archiveUri;
    private final String nativeEndpoint;
    private final NativeTelemetrySource nativeSource;
    private volatile boolean running;
    private Thread worker;
    public TelemetryIngestion(TelemetryCatalog catalog, TelemetryRepository repository, TelemetryNormalizer normalizer,
            TelemetryDiagnostics diagnostics, Clock clock, TelemetryHttp http, SenseDataTelemetrySource sense,
            IssLiveTelemetrySource archive, int queueSize,int batchSize,boolean bootstrap,boolean nativeEnabled,
            URI senseUri,URI archiveUri,String nativeEndpoint,String adapter,long retryMillis) {
        this(catalog,repository,normalizer,diagnostics,clock,http,sense,archive,queueSize,batchSize,bootstrap,nativeEnabled,
                senseUri,archiveUri,nativeEndpoint,adapter,retryMillis,false,Duration.ofSeconds(30));
    }
    public TelemetryIngestion(TelemetryCatalog catalog, TelemetryRepository repository, TelemetryNormalizer normalizer,
            TelemetryDiagnostics diagnostics, Clock clock, TelemetryHttp http, SenseDataTelemetrySource sense,
            IssLiveTelemetrySource archive, int queueSize,int batchSize,boolean bootstrap,boolean nativeEnabled,
            URI senseUri,URI archiveUri,String nativeEndpoint,String adapter,long retryMillis,
            boolean retryFailedBootstrap,Duration senseTimeout) {
        this.catalog=catalog;this.repository=repository;this.normalizer=normalizer;this.diagnostics=diagnostics;this.clock=clock;
        this.http=http;this.sense=sense;this.archive=archive;this.batchSize=batchSize;this.bootstrap=bootstrap;this.nativeEnabled=nativeEnabled;
        this.retryFailedBootstrap=retryFailedBootstrap;this.senseTimeout=senseTimeout;
        this.senseUri=senseUri;this.archiveUri=archiveUri;this.nativeEndpoint=nativeEndpoint;queue=new ArrayBlockingQueue<>(queueSize);
        nativeSource=nativeEnabled?new NativeTelemetrySource(nativeEndpoint,adapter,retryMillis,catalog,clock,this::offer,diagnostics):null;
    }
    public boolean offer(TelemetryNormalizer.Raw raw) {
        boolean added=queue.offer(raw);if (!added) diagnostics.queueDrops.incrementAndGet();return added;
    }
    public synchronized void start() {
        if (running) return;
        running=true;worker=new Thread(this::run,"telemetry-worker");worker.setDaemon(true);worker.start();
    }
    private void run() {
        try {
            repository.initialize(catalog);
            if (bootstrap) { bootstrapSense();bootstrapArchive(); }
        } catch (RuntimeException failure) { diagnostics.persistenceFailures.incrementAndGet();log("initialization",failure); }
        try { if (running && nativeEnabled) nativeSource.start(); }
        catch (RuntimeException failure) { diagnostics.nativeStatus="START_FAILED";log("native start",failure); }
        while (running) {
            try {
                var first=queue.poll(1,TimeUnit.SECONDS);if (first==null) continue;
                var batch=new ArrayList<TelemetryNormalizer.Raw>();batch.add(first);queue.drainTo(batch,batchSize-1);
                persist("NATIVE","NATIVE_CALLBACK",nativeEndpoint,batch);
            } catch (InterruptedException stop) { Thread.currentThread().interrupt();break; }
            catch (RuntimeException failure) { diagnostics.persistenceFailures.incrementAndGet();log("native persistence",failure); }
        }
    }
    private void bootstrapSense() {
        if (!claimBootstrap("SENSEDATA")) return;
        try {
            var batch=http.initialSse(senseUri,senseTimeout,input -> sense.parse(input,clock.instant()));
            var written=persist("SENSEDATA","RETAINED_BOOTSTRAP",senseUri.toString(),batch.records());
            diagnostics.senseData=new TelemetryDiagnostics.Bootstrap(batch.fetched(),
                    batch.classifications().getOrDefault("QUALIFIED_COMPONENT_MATCH",0L).intValue(),batch.malformed(),batch.unboundComponentRecords(),
                    written.normalized(),batch.records().size()-written.normalized(),written.inserted(),written.admitted(),written.conflicts(),
                    written.normalized()-written.inserted(),batch.eventBytes(),batch.parseNanos()/1e6,written.databaseNanos()/1e6,batch.classifications());
            repository.completeBootstrap("SENSEDATA");
        } catch (Exception failure) { failed("SENSEDATA",senseUri,failure); }
    }
    private void bootstrapArchive() {
        if (!claimBootstrap("ISS_LIVE")) return;
        try {
            var keys=catalog.definitions().stream().map(TelemetryCatalog.Definition::issLiveKey).filter(Objects::nonNull).distinct().sorted().toList();
            for (int start=0;start<keys.size() && start<128;start+=32) {
                var requested=keys.subList(start,Math.min(keys.size(),start+32));
                var uri=URI.create(archiveUri+"?sensors="+URLEncoder.encode(String.join(",",requested),java.nio.charset.StandardCharsets.UTF_8)+"&window=now-90d");
                String body=http.get(uri,524288);
                persist("ISS_LIVE","RETAINED_ARCHIVE_IMPORT",uri.toString(),archive.parse(body,clock.instant(),Set.copyOf(requested)));
            }
            repository.completeBootstrap("ISS_LIVE");
        } catch (Exception failure) { failed("ISS_LIVE",archiveUri,failure); }
    }
    private boolean claimBootstrap(String provider) {
        return retryFailedBootstrap ? repository.claimBootstrap(provider,clock.instant(),true) : repository.claimBootstrap(provider,clock.instant());
    }
    private record Written(int normalized,int inserted,int admitted,int conflicts,long databaseNanos) {}
    private Written persist(String provider,String method,String endpoint,List<TelemetryNormalizer.Raw> raw) {
        int normalized=0,inserted=0,admitted=0,conflicts=0;long databaseNanos=0;
        for (int start=0;start<Math.max(1,raw.size());start+=batchSize) {
            var part=raw.subList(start,Math.min(raw.size(),start+batchSize));var records=new ArrayList<TelemetryRecord>();
            for (var event:part) {
                var record=normalizer.normalize(event);
                if (record.isPresent()) records.add(record.get());else diagnostics.parseRejects.incrementAndGet();
            }
            long started=System.nanoTime();
            var result=repository.store(new TelemetryRepository.Acquisition(UUID.randomUUID(),provider,method,endpoint,clock.instant(),"COMPLETED",null,part.size()),records);
            databaseNanos+=System.nanoTime()-started;
            normalized+=records.size();inserted+=result.inserted();admitted+=result.accepted();conflicts+=result.conflicts();
            diagnostics.conflicts.addAndGet(result.conflicts());
        }
        return new Written(normalized,inserted,admitted,conflicts,databaseNanos);
    }
    private void failed(String provider,URI endpoint,Exception failure) {
        diagnostics.bootstrapFailures.incrementAndGet();log(provider+" bootstrap",failure);
        try { repository.store(new TelemetryRepository.Acquisition(UUID.randomUUID(),provider,"RETAINED_BOOTSTRAP",endpoint.toString(),clock.instant(),"FAILED",failure.getClass().getSimpleName(),0),List.of()); }
        catch (RuntimeException storeFailure) { diagnostics.persistenceFailures.incrementAndGet(); }
        if (failure instanceof InterruptedException) Thread.currentThread().interrupt();
    }
    private static void log(String operation,Exception e) { LoggerFactory.getLogger(TelemetryIngestion.class).warn("Telemetry {} failed: {}",operation,e.getClass().getSimpleName()); }
    @Override public void close() {
        running=false;if (nativeSource!=null) nativeSource.close();if (worker!=null) worker.interrupt();http.close();
    }
}
