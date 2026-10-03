package org.mission1;

import java.time.Clock;
import java.time.Duration;
import org.mission1.crew.application.*;
import org.mission1.source.crew.ll2.LaunchLibrary2CrewSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Composition only: persistence and ingestion remain behind application ports. */
@Configuration
class CrewIngestionConfiguration {
    @Bean CrewIngestionPolicy crewIngestionPolicy(
            @Value("${mission1.crew.ingestion.fixed-delay:PT2H}") Duration delay,
            @Value("${mission1.crew.ingestion.initial-delay:PT5M}") Duration initialDelay) {
        return new CrewIngestionPolicy(delay, initialDelay);
    }
    @Bean CrewIngestionService crewIngestionService(LaunchLibrary2CrewSource source, CrewRepository repository,
            CrewIngestionPolicy policy, Clock utcClock) {
        return new CrewIngestionService(source, repository, policy, utcClock, source.currentExpeditionUrl());
    }
    @Bean CrewQueryService crewQueryService(CrewRepository repository, Clock utcClock) {
        return new CrewQueryService(repository, utcClock);
    }
    @Bean
    @ConditionalOnProperty(name = "mission1.crew.ingestion.enabled", havingValue = "true", matchIfMissing = true)
    CrewIngestionScheduler crewIngestionScheduler(CrewIngestionService service) {
        return new CrewIngestionScheduler(service);
    }
}
