package org.mission1;

import org.mission1.crew.application.*;
import org.mission1.source.crew.CrewHttpReader;
import org.mission1.source.crew.ll2.LaunchLibrary2CrewEventSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.*;

import java.net.URI;
import java.time.*;

/** Event-aware scheduling composition; existing source flags remain authoritative. */
@Configuration
class CrewRefreshConfiguration {
    @Bean
    CrewEventSource crewEventSource(
            CrewHttpReader http,
            @Value("${mission1.crew.ll2.base-url:https://ll.thespacedevs.com/2.3.0/}") URI base,
            @Value("${mission1.crew.ll2.iss-external-id:4}") int station) {
        return new LaunchLibrary2CrewEventSource(http, base, station);
    }

    @Bean
    CrewRefreshPolicy crewRefreshPolicy(
            @Value("${mission1.crew.ingestion.fixed-delay:PT2H}") Duration roster,
            @Value("${mission1.crew.verification.fixed-delay:PT2H}") Duration nasa,
            @Value("${mission1.crew.refresh.catalog-interval:PT6H}") Duration catalog,
            @Value("${mission1.crew.refresh.pre-window:PT6H}") Duration pre,
            @Value("${mission1.crew.refresh.post-window:PT6H}") Duration post,
            @Value("${mission1.crew.refresh.crewed-interval:PT30M}") Duration crewed,
            @Value("${mission1.crew.refresh.unknown-interval:PT1H}") Duration unknown,
            @Value("${mission1.crew.refresh.follow-up-interval:PT1H}") Duration follow,
            @Value("${mission1.crew.refresh.follow-up-horizon:PT24H}") Duration horizon,
            @Value("${mission1.crew.refresh.catalog-max-age:PT12H}") Duration age,
            @Value("${mission1.crew.refresh.max-follow-up-attempts:6}") int attempts,
            @Value("${mission1.crew.refresh.ll2-hourly-budget:12}") int budget) {
        return new CrewRefreshPolicy(
                new CrewRefreshPolicy.Settings(
                        roster, nasa, catalog, pre, post, crewed, unknown, follow, horizon, age,
                        attempts, budget));
    }

    @Bean
    @ConditionalOnProperty(name = "mission1.crew.refresh.event-aware.enabled", havingValue = "true")
    CrewRefreshCoordinator crewRefreshCoordinator(
            CrewRefreshPolicy policy,
            CrewRefreshRepository refresh,
            CrewRepository runs,
            CrewVerificationRepository verification,
            CrewReconciliationQueryService query,
            CrewReconciliationService reconciliation,
            CrewIngestionService roster,
            NasaCrewVerificationIngestionService nasa,
            CrewEventSource events,
            Clock utcClock,
            @Value("${mission1.crew.ingestion.enabled:true}") boolean rosterEnabled,
            @Value("${mission1.crew.verification.enabled:true}") boolean nasaEnabled,
            @Value("${mission1.crew.refresh.catalog-enabled:true}") boolean catalogEnabled,
            @Value("${mission1.crew.ingestion.initial-delay:PT5M}") Duration rosterInitial,
            @Value("${mission1.crew.verification.initial-delay:PT10M}") Duration nasaInitial,
            @Value("${mission1.crew.refresh.catalog-initial-delay:PT15M}")
                    Duration catalogInitial) {
        return new CrewRefreshCoordinator(
                policy,
                refresh,
                runs,
                verification,
                query,
                reconciliation,
                roster,
                nasa,
                events,
                utcClock,
                rosterEnabled,
                nasaEnabled,
                catalogEnabled,
                rosterInitial,
                nasaInitial,
                catalogInitial);
    }

    @Bean
    @ConditionalOnProperty(name = "mission1.crew.refresh.event-aware.enabled", havingValue = "true")
    CrewRefreshScheduler crewRefreshScheduler(CrewRefreshCoordinator coordinator) {
        return new CrewRefreshScheduler(coordinator);
    }
}
