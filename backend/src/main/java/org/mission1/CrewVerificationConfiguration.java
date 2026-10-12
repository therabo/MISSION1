package org.mission1;

import org.mission1.crew.application.*;
import org.mission1.source.crew.nasa.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.*;

import java.net.http.HttpClient;
import java.time.*;

@Configuration
class CrewVerificationConfiguration {
    @Bean
    CrewReconciliationPolicy crewReconciliationPolicy(
            @Value("${mission1.crew.verification.primary-max-age:PT6H}") Duration primary,
            @Value("${mission1.crew.verification.fetch-max-age:PT6H}") Duration fetch,
            @Value("${mission1.crew.verification.current-assertion-max-age:P7D}")
                    Duration assertion,
            @Value("${mission1.crew.verification.event-implication-max-age:P14D}") Duration event) {
        return new CrewReconciliationPolicy(primary, fetch, assertion, event);
    }

    @Bean
    NasaOperationalFeedParser nasaOperationalFeedParser() {
        return new NasaOperationalFeedParser();
    }

    @Bean
    NasaCrewVerificationIngestionService nasaCrewVerificationIngestionService(
            CrewRepository runs,
            CrewVerificationRepository repository,
            NasaOperationalFeedParser parser,
            org.springframework.beans.factory.ObjectProvider<NasaRequestGate> gates,
            Clock utcClock,
            @Value("${mission1.crew.request-timeout:PT20S}") Duration timeout,
            @Value("${mission1.crew.verification.fixed-delay:PT2H}") Duration delay,
            @Value("${mission1.crew.verification.initial-delay:PT10M}") Duration initial) {
        var policy = new CrewIngestionPolicy(delay, initial);
        if (initial.compareTo(Duration.ofMinutes(6)) < 0)
            throw new IllegalArgumentException("NASA startup delay must be at least six minutes");
        var source =
                new NasaOperationalFeedHttpSource(
                        HttpClient.newBuilder()
                                .connectTimeout(timeout)
                                .followRedirects(HttpClient.Redirect.NEVER)
                                .build(),
                        utcClock,
                        timeout,gates.getIfAvailable());
        return new NasaCrewVerificationIngestionService(
                source,
                parser,
                repository,
                runs,
                policy,
                utcClock,
                NasaOperationalFeedHttpSource.URL,
                NasaOperationalFeedParser.NAME,
                NasaOperationalFeedParser.VERSION);
    }

    @Bean
    CrewReconciliationService crewReconciliationService(
            CrewRepository primary,
            CrewQueryService query,
            CrewVerificationRepository verification,
            CrewReconciliationRepository repository,
            CrewReconciliationPolicy policy,
            Clock utcClock,
            CrewIdentityRepository identities,
            org.mission1.crew.operational.OperationalProductionBindings bindings) {
        return new CrewReconciliationService(
                primary, query, verification, repository, policy, utcClock, identities)
                .bindings(bindings);
    }

    @Bean
    CrewReconciliationQueryService crewReconciliationQueryService(
            CrewReconciliationService service,
            CrewQueryService query,
            CrewReconciliationRepository repository,
            CrewVerificationRepository verification,
            CrewRepository primary) {
        return new CrewReconciliationQueryService(
                service, query, repository, verification, primary);
    }

    @Bean
    @ConditionalOnProperty(
            name = "mission1.crew.verification.enabled",
            havingValue = "true",
            matchIfMissing = true)
    @org.springframework.boot.autoconfigure.condition.ConditionalOnExpression("!${mission1.crew.refresh.event-aware.enabled:false}")
    CrewVerificationScheduler crewVerificationScheduler(
            NasaCrewVerificationIngestionService service,
            CrewReconciliationService reconciliation) {
        return new CrewVerificationScheduler(service, reconciliation);
    }
}
