package org.mission1;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.time.*;
import org.mission1.telemetry.*;
import org.mission1.telemetry.persistence.JdbcTelemetryRepository;
import org.mission1.source.telemetry.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Configuration
class TelemetryConfiguration {
    @Bean TelemetryCatalog telemetryCatalog(ObjectMapper mapper) { return new TelemetryCatalog(mapper); }
    @Bean TelemetryRepository telemetryRepository(JdbcTemplate jdbc,PlatformTransactionManager tx,TelemetryCatalog catalog,ObjectMapper mapper) {
        return new JdbcTelemetryRepository(jdbc,new TransactionTemplate(tx),catalog,mapper);
    }
    @Bean TelemetryDiagnostics telemetryDiagnostics() { return new TelemetryDiagnostics(); }
    @Bean TelemetryQueryService telemetryQueryService(TelemetryCatalog catalog,TelemetryRepository repository,Clock utcClock) { return new TelemetryQueryService(catalog,repository,utcClock); }
    @Bean(destroyMethod="close")
    @ConditionalOnProperty(name="mission1.telemetry.enabled",havingValue="true",matchIfMissing=true)
    TelemetryIngestion telemetryIngestion(TelemetryCatalog catalog,TelemetryRepository repository,ObjectMapper mapper,TelemetryDiagnostics diagnostics,Clock utcClock,
            @Value("${mission1.telemetry.timeout:PT15S}") Duration timeout,
            @Value("${mission1.telemetry.queue-size:1024}") int queue,
            @Value("${mission1.telemetry.batch-size:64}") int batch,
            @Value("${mission1.telemetry.bootstrap-enabled:true}") boolean bootstrap,
            @Value("${mission1.telemetry.native-enabled:true}") boolean nativeEnabled,
            @Value("${mission1.telemetry.sensedata-endpoint:https://iss.telemetry.space/events}") URI sense,
            @Value("${mission1.telemetry.isslive-endpoint:https://api.iss.live/api/telemetry/stats/}") URI archive,
            @Value("${mission1.telemetry.native-endpoint:https://push.lightstreamer.com}") URI nativeEndpoint,
            @Value("${mission1.telemetry.adapter-set:ISSLIVE}") String adapter,
            @Value("${mission1.telemetry.native-retry:PT30S}") Duration retry) {
        if (queue<1 || queue>8192 || batch<1 || batch>256 || timeout.compareTo(Duration.ofSeconds(1))<0 || timeout.compareTo(Duration.ofSeconds(60))>0 || retry.compareTo(Duration.ofSeconds(5))<0)
            throw new IllegalArgumentException("Invalid bounded telemetry configuration");
        for (var endpoint:new URI[]{sense,archive,nativeEndpoint})
            if (!"https".equals(endpoint.getScheme()) || endpoint.getHost()==null || endpoint.getUserInfo()!=null || endpoint.getQuery()!=null)
                throw new IllegalArgumentException("Telemetry endpoints require HTTPS without credentials/query");
        return new TelemetryIngestion(catalog,repository,new TelemetryNormalizer(catalog),diagnostics,utcClock,new TelemetryHttp(timeout),
                new SenseDataTelemetrySource(mapper,catalog),new IssLiveTelemetrySource(mapper,catalog),queue,batch,bootstrap,nativeEnabled,sense,archive,nativeEndpoint.toString(),adapter,retry.toMillis());
    }
    @Bean @ConditionalOnProperty(name="mission1.telemetry.enabled",havingValue="true",matchIfMissing=true)
    TelemetryStartup telemetryStartup(TelemetryIngestion ingestion) { return new TelemetryStartup(ingestion); }
    static final class TelemetryStartup {
        private final TelemetryIngestion ingestion;
        TelemetryStartup(TelemetryIngestion ingestion) { this.ingestion=ingestion; }
        @EventListener(ApplicationReadyEvent.class) public void ready() { ingestion.start(); }
    }
}
