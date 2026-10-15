package org.mission1.telemetry;

import java.net.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.mission1.source.telemetry.*;
import org.slf4j.LoggerFactory;

/** Native queue worker plus independent retained deadlines, sharing normalization/admission/JDBC. */
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
    private RetainedTelemetryReconciler retained;
    private boolean closed;
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
                senseUri,archiveUri,nativeEndpoint,adapter,retryMillis,Duration.ofSeconds(30));
    }
    public TelemetryIngestion(TelemetryCatalog catalog, TelemetryRepository repository, TelemetryNormalizer normalizer,
            TelemetryDiagnostics diagnostics, Clock clock, TelemetryHttp http, SenseDataTelemetrySource sense,
            IssLiveTelemetrySource archive, int queueSize,int batchSize,boolean bootstrap,boolean nativeEnabled,
            URI senseUri,URI archiveUri,String nativeEndpoint,String adapter,long retryMillis,
            Duration senseTimeout) {
        this.catalog=catalog;this.repository=repository;this.normalizer=normalizer;this.diagnostics=diagnostics;this.clock=clock;
        this.http=http;this.sense=sense;this.archive=archive;this.batchSize=batchSize;this.bootstrap=bootstrap;this.nativeEnabled=nativeEnabled;
        this.senseTimeout=senseTimeout;
        this.senseUri=senseUri;this.archiveUri=archiveUri;this.nativeEndpoint=nativeEndpoint;queue=new ArrayBlockingQueue<>(queueSize);
        nativeSource=nativeEnabled?new NativeTelemetrySource(nativeEndpoint,adapter,retryMillis,catalog,clock,this::offer,diagnostics):null;
    }
    public synchronized TelemetryIngestion retained(RetainedTelemetryState state,TelemetryTimer timer,RetainedTelemetryReconciler.Policy policy) {
        if (running || retained!=null) throw new IllegalStateException("Retained lifecycle already configured");
        retained=new RetainedTelemetryReconciler(state,clock,timer,policy,bootstrap,diagnostics,this::acquire);
        return this;
    }
    public boolean offer(TelemetryNormalizer.Raw raw) {
        boolean added=queue.offer(raw);if (!added) diagnostics.queueDrops.incrementAndGet();return added;
    }
    public synchronized void start() {
        if (running || closed) return;
        running=true;worker=new Thread(this::run,"telemetry-worker");worker.setDaemon(true);worker.start();
    }
    private void run() {
        try {
            repository.initialize(catalog);
            if (retained!=null) retained.start();
            else if (bootstrap) throw new IllegalStateException("Retained acquisition requires coordinated lifecycle");
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
    private RetainedTelemetryState.Result acquire(String provider,String method) throws Exception {
        URI endpoint=provider.equals("SENSEDATA")?senseUri:archiveUri;
        try {return provider.equals("SENSEDATA")?acquireSense(method):acquireArchive(method);}
        catch(Exception failure) {
            try { repository.store(new TelemetryRepository.Acquisition(UUID.randomUUID(),provider,method,endpoint.toString(),clock.instant(),"FAILED",failure.getClass().getSimpleName(),0),List.of()); }
            catch(RuntimeException storeFailure) {diagnostics.persistenceFailures.incrementAndGet();}
            throw failure;
        }
    }
    private RetainedTelemetryState.Result acquireSense(String method) throws Exception {
        long started=System.nanoTime();
        var batch=http.initialSse(senseUri,senseTimeout,input -> sense.parse(input,clock.instant()));
        double fetch=(System.nanoTime()-started)/1e6;
        var written=persist("SENSEDATA",method,senseUri.toString(),batch.records());
        var summary=new TelemetryDiagnostics.Bootstrap(batch.fetched(),
                batch.classifications().getOrDefault("QUALIFIED_COMPONENT_MATCH",0L).intValue(),batch.malformed(),batch.unboundComponentRecords(),
                written.normalized(),written.rejected(),written.inserted(),written.admitted(),written.conflicts(),
                written.duplicates(),batch.eventBytes(),batch.parseNanos()/1e6,written.databaseNanos()/1e6,batch.classifications());
        if (method.equals("RETAINED_BOOTSTRAP")) diagnostics.senseData=summary;
        return new RetainedTelemetryState.Result(batch.fetched(),batch.records().size(),written.admitted(),written.duplicates(),written.rejected(),
                written.advanced().size(),batch.eventBytes(),Math.max(0,fetch),batch.parseNanos()/1e6,written.databaseNanos()/1e6);
    }
    private RetainedTelemetryState.Result acquireArchive(String method) throws Exception {
        int fetched=0,bytes=0,admitted=0,duplicates=0,rejected=0;long fetch=0,parse=0,database=0;
        var advanced=new HashSet<String>();
        var keys=catalog.definitions().stream().map(TelemetryCatalog.Definition::issLiveKey).filter(Objects::nonNull).distinct().sorted().toList();
        for (int start=0;start<keys.size() && start<128;start+=32) {
            if (!running) throw new InterruptedException("Telemetry stopped");
            var requested=keys.subList(start,Math.min(keys.size(),start+32));
            var uri=URI.create(archiveUri+"?sensors="+URLEncoder.encode(String.join(",",requested),java.nio.charset.StandardCharsets.UTF_8)+"&window=now-90d");
            long started=System.nanoTime();String body=http.get(uri,524288);fetch+=System.nanoTime()-started;bytes+=body.getBytes(java.nio.charset.StandardCharsets.UTF_8).length;
            started=System.nanoTime();var raw=archive.parse(body,clock.instant(),Set.copyOf(requested));parse+=System.nanoTime()-started;
            var written=persist("ISS_LIVE",method,uri.toString(),raw);fetched+=raw.size();admitted+=written.admitted();duplicates+=written.duplicates();
            rejected+=written.rejected();database+=written.databaseNanos();advanced.addAll(written.advanced());
        }
        return new RetainedTelemetryState.Result(fetched,fetched,admitted,duplicates,rejected,advanced.size(),bytes,fetch/1e6,parse/1e6,database/1e6);
    }
    private record Written(int normalized,int rejected,int inserted,int admitted,int conflicts,int duplicates,Set<String> advanced,long databaseNanos) {}
    private Written persist(String provider,String method,String endpoint,List<TelemetryNormalizer.Raw> raw) {
        int normalized=0,rejected=0,inserted=0,admitted=0,conflicts=0,duplicates=0;long databaseNanos=0;var advanced=new HashSet<String>();
        for (int start=0;start<Math.max(1,raw.size());start+=batchSize) {
            if (!running || Thread.currentThread().isInterrupted()) throw new CancellationException("Telemetry stopped");
            var part=raw.subList(start,Math.min(raw.size(),start+batchSize));var records=new ArrayList<TelemetryRecord>();var futureRejected=new ArrayList<TelemetryRecord>();
            for (var event:part) {
                var record=normalizer.normalize(event);
                if (record.isPresent()) records.add(record.get());else {
                    rejected++;diagnostics.parseRejects.incrementAndGet();normalizer.futureRejection(event).ifPresent(futureRejected::add);
                }
            }
            long started=System.nanoTime();
            var result=repository.store(new TelemetryRepository.Acquisition(UUID.randomUUID(),provider,method,endpoint,clock.instant(),"COMPLETED",null,part.size()),records,futureRejected);
            databaseNanos+=System.nanoTime()-started;
            normalized+=records.size()-result.quarantined();rejected+=result.quarantined();inserted+=result.inserted();admitted+=result.accepted();conflicts+=result.conflicts();
            duplicates+=records.size()-result.quarantined()-result.inserted();advanced.addAll(result.advancedParameters());
            diagnostics.parseRejects.addAndGet(result.quarantined());
            diagnostics.conflicts.addAndGet(result.conflicts());
        }
        return new Written(normalized,rejected,inserted,admitted,conflicts,duplicates,Set.copyOf(advanced),databaseNanos);
    }
    private static void log(String operation,Exception e) { LoggerFactory.getLogger(TelemetryIngestion.class).warn("Telemetry {} failed: {}",operation,e.getClass().getSimpleName()); }
    @Override public void close() {
        closed=true;running=false;http.close();if (retained!=null) retained.close();if (nativeSource!=null) nativeSource.close();if (worker!=null) {
            worker.interrupt();
            try {worker.join(5000);} catch(InterruptedException stop) {Thread.currentThread().interrupt();}
        }
    }
}
