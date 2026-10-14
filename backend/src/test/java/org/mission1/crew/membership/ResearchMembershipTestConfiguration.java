package org.mission1.crew.membership;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.mission1.crew.application.*;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;

/** Explicit test wiring of SHADOW lifecycle research; no selectable production rollback mode. */
@TestConfiguration(proxyBeanMethods = false)
public class ResearchMembershipTestConfiguration {
    @Bean @Primary
    ActiveMembershipPolicy researchLifecycle() { return ActiveMembershipPolicy.defaults(); }

    @Bean @Primary
    RetainedMembershipInputs researchInputs(JdbcTemplate jdbc, ObjectMapper json,
            CrewEditorialRepository resources, CrewVerificationRepository evidence,
            ActiveMembershipPolicy policy) {
        return new RetainedMembershipInputs(jdbc, json, resources, evidence, policy);
    }
}
