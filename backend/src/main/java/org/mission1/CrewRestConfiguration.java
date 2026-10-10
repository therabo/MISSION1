package org.mission1;

import org.mission1.crew.application.*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
class CrewRestConfiguration {
    @Bean
    CrewReadQueryService crewReadQueryService(CrewReadRepository repository, CrewIdentityRepository identities) {
        return new CrewReadQueryService(repository, identities);
    }
}
