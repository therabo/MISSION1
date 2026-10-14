package org.mission1;

import org.springframework.beans.factory.InitializingBean;
import org.springframework.boot.sql.init.dependency.DependsOnDatabaseInitialization;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;

/** Mutable coordination registers only. Flyway defines structure and leaves every domain table empty. */
@Configuration
class DatabaseRuntimeInitialization {
    @Bean
    @DependsOnDatabaseInitialization
    InitializingBean runtimeCoordination(JdbcTemplate jdbc, PlatformTransactionManager transactions) {
        return () -> new TransactionTemplate(transactions).executeWithoutResult(status -> {
            jdbc.update("INSERT INTO celestrak_request_state(singleton) VALUES(true) ON CONFLICT DO NOTHING");
            jdbc.update("INSERT INTO crew_nasa_request_budget VALUES(true,'epoch','epoch') ON CONFLICT DO NOTHING");
            jdbc.update("INSERT INTO crew_resource_refresh_lease VALUES(true,'epoch') ON CONFLICT DO NOTHING");
            jdbc.update("INSERT INTO crew_identity_research_sweep_lease VALUES(true,'epoch') ON CONFLICT DO NOTHING");
            jdbc.update("INSERT INTO crew_membership_projection_work VALUES(true,1,0,now(),NULL,0) ON CONFLICT DO NOTHING");
            jdbc.update("INSERT INTO crew_operational_subject_binding_work VALUES(true,1,0,now(),'epoch','epoch',NULL,0) ON CONFLICT DO NOTHING");
        });
    }
}
