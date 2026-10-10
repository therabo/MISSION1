package org.mission1;

import org.mission1.crew.persistence.JdbcCrewIdentityRepository;
import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;

import java.time.Clock;
import java.util.Set;

/** Reviewed synchronization after Flyway, before HTTP acceptance; never part of GET. */
@Configuration
class CrewCanonicalIdentityConfiguration {
    @Bean
    SmartInitializingSingleton crewReviewedIdentitySynchronization(
            JdbcCrewIdentityRepository repository,
            Clock utcClock,
            @Value("${mission1.crew.identity.review-mode:APPLY}") String mode) {
        if (!Set.of("OFF", "DRY_RUN", "APPLY").contains(mode))
            throw new IllegalArgumentException("Unknown identity review mode");
        return () -> {
            if (mode.equals("OFF")) return;
            var report =
                    mode.equals("DRY_RUN")
                            ? repository.preview(utcClock.instant())
                            : repository.apply(utcClock.instant());
            System.getLogger(getClass().getName())
                    .log(System.Logger.Level.INFO, "Reviewed Crew identity {0}: {1}", mode, report);
        };
    }
}
