package org.mission1;

import org.mission1.crew.application.CrewVerificationRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Supported additive backfill after Flyway and singleton creation, before the HTTP server's
 * lifecycle starts accepting requests. No provider calls or read-path writes (ADR-0012).
 */
@Configuration
class CrewOccurrenceConfiguration {
    @Bean
    SmartInitializingSingleton crewOccurrenceAssociations(CrewVerificationRepository repository,
            @Value("${mission1.crew.occurrences.backfill-mode:APPLY}") String mode) {
        if (!java.util.Set.of("APPLY", "DRY_RUN", "OFF").contains(mode))
            throw new IllegalArgumentException("Unknown occurrence backfill mode");
        return () -> {
            if (mode.equals("OFF")) return;
            var report = mode.equals("DRY_RUN") ? repository.previewOccurrenceAssociations()
                    : repository.associateRetainedOccurrences();
            System.getLogger(getClass().getName()).log(System.Logger.Level.INFO,
                    "Crew occurrence {0}: evidence={1}, assertions={2}, subjects={3}, subjectVersions={4}, multiVersion={5}, conflicts={6}, ambiguous={7}, unassociated={8}",
                    mode, report.evidenceVersions(), report.assertionOccurrences(), report.subjectOccurrences(),
                    report.subjectPayloadVersions(), report.multiVersionOccurrences(), report.conflicts(),
                    report.ambiguousAssociations(), report.unassociatedVersions());
        };
    }
}
