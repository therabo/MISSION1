package org.mission1;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.charset.StandardCharsets;
import java.util.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;

/** Public installation contract, deliberately without Spring's reference/coordination bootstrap. */
@Testcontainers
class PublicDatabaseBaselineTest {
    @Container static final PostgreSQLContainer<?> PG = new PostgreSQLContainer<>("postgres:16.10");
    static JdbcTemplate jdbc;
    static Flyway flyway;

    @BeforeAll static void emptyInstallation() {
        var source = new DriverManagerDataSource(PG.getJdbcUrl(), PG.getUsername(), PG.getPassword());
        jdbc = new JdbcTemplate(source);
        assertEquals(0, count("SELECT count(*) FROM pg_tables WHERE schemaname='public'"));
        flyway = Flyway.configure().dataSource(source).load();
        assertEquals(1, flyway.migrate().migrationsExecuted);
    }

    static int count(String sql) { return jdbc.queryForObject(sql, Integer.class); }
    static List<String> tables() {
        return jdbc.queryForList("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'flyway_schema_history' ORDER BY tablename", String.class);
    }

    @Test void exactlyOnePublicMigrationAndIdempotentValidation() {
        assertEquals(List.of("1"), jdbc.queryForList("SELECT version FROM flyway_schema_history WHERE type='SQL' AND success", String.class));
        assertEquals("V1__initial_schema.sql", jdbc.queryForObject("SELECT script FROM flyway_schema_history WHERE version='1'", String.class));
        assertEquals(1, count("SELECT count(*) FROM flyway_schema_history"));
        assertEquals(0, flyway.migrate().migrationsExecuted);
        flyway.validate();
    }

    @Test void schemaAloneHasNoDomainOrCoordinationRows() {
        assertEquals(80, tables().size());
        for (var table : tables()) assertEquals(0, count("SELECT count(*) FROM " + table), table);
    }

    @Test void domainTablesAndOwnershipRemainComplete() {
        assertTrue(tables().containsAll(List.of("orbital_element_sets", "orbital_element_observations", "nasa_oem_ephemerides", "celestrak_request_state",
                "crew_person", "crew_identity_binding_version", "crew_person_equivalence_decision", "crew_resource", "crew_resource_acquisition",
                "crew_resource_relation", "crew_identity_research_decision_revision", "crew_operational_subject_binding_revision",
                "crew_membership_projection_revision", "crew_membership_projection_binding", "crew_subject_version_link")));
        assertEquals(634, count("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name IN (SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'flyway_schema_history')"));
        assertEquals(555, count("SELECT count(*) FROM pg_constraint WHERE connamespace='public'::regnamespace AND conrelid<>'flyway_schema_history'::regclass"));
    }

    @Test void indexCoverageAndIdentitySequencesArePreserved() {
        assertEquals(172, count("SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND tablename<>'flyway_schema_history'"));
        assertEquals(29, count("SELECT count(*) FROM pg_sequences WHERE schemaname='public'"));
        assertTrue(jdbc.queryForList("SELECT indexdef FROM pg_indexes WHERE tablename='crew_operational_subject_binding_revision'", String.class)
                .stream().anyMatch(s -> s.contains("evidence_id, subject_index, id DESC")));
        assertTrue(jdbc.queryForList("SELECT indexdef FROM pg_indexes WHERE tablename='crew_identity_research_decision_revision'", String.class)
                .stream().anyMatch(s -> s.contains("WHERE (predecessor_id IS NULL)")));
    }

    @Test void allActiveObjectNamesUsePublicDomainTerminology() {
        var names = jdbc.queryForList("""
                SELECT relname name FROM pg_class WHERE relnamespace='public'::regnamespace
                UNION ALL SELECT attname FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='public'::regnamespace AND a.attnum>0
                UNION ALL SELECT conname FROM pg_constraint WHERE connamespace='public'::regnamespace
                UNION ALL SELECT proname FROM pg_proc WHERE pronamespace='public'::regnamespace
                UNION ALL SELECT tgname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal
                UNION ALL SELECT typname FROM pg_type WHERE typnamespace='public'::regnamespace
                """, String.class);
        for (var name : names) assertFalse(name.matches("(?i).*(v7|v8|v9|v10|s10|legacy|phase|experimental|temporary|automatic|crew_auto_|crew_editorial_|crew_active_).*"), name);
    }

    @Test void atomicLineageAndImmutableHistoryGuardsRemainInstalled() {
        assertEquals(25, count("SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace"));
        assertEquals(117, count("SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal"));
        assertEquals(2, count("SELECT count(*) FROM pg_views WHERE schemaname='public'"));
        assertEquals(0, count("SELECT count(*) FROM pg_type WHERE typnamespace='public'::regnamespace AND typtype NOT IN ('c','b')"));
        assertEquals(1, count("SELECT count(*) FROM pg_trigger WHERE tgname='crew_membership_production_atomic' AND tgdeferrable AND tginitdeferred"));
        assertEquals(1, count("SELECT count(*) FROM pg_trigger WHERE tgname='crew_operational_subject_binding_atomic' AND tgdeferrable AND tginitdeferred"));
        assertEquals(List.of("crew_membership_notify", "crew_identity_research_notify_source",
                "crew_operational_subject_binding_notify"), statementInsertTriggerFunctions("crew_resource_acquisition"));
        assertEquals(List.of("crew_membership_notify", "crew_identity_research_notify_source"),
                statementInsertTriggerFunctions("crew_resource_relation"));
        assertEquals(List.of("crew_membership_notify", "crew_operational_subject_binding_notify"),
                statementInsertTriggerFunctions("crew_identity_binding_version"));
    }

    static List<String> statementInsertTriggerFunctions(String table) {
        return jdbc.queryForList("""
                SELECT p.proname FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
                WHERE t.tgrelid=?::regclass AND NOT t.tgisinternal
                  AND (t.tgtype & 1)=0 AND (t.tgtype & 2)=0 AND (t.tgtype & 4)<>0
                ORDER BY t.tgname
                """, String.class, table);
    }

    @Test void migrationContainsDdlAndNoTopLevelDataStatements() throws Exception {
        String sql;
        try (var input = getClass().getResourceAsStream("/db/migration/V1__initial_schema.sql")) {
            sql = new String(Objects.requireNonNull(input).readAllBytes(), StandardCharsets.UTF_8);
        }
        // Trigger bodies necessarily write work notifications when future source rows arrive.
        var ddl = sql.replaceAll("(?s)\\$function\\$.*?\\$function\\$", "").replaceAll("(?m)--.*$", "");
        assertFalse(ddl.matches("(?s).*(?:^|;)\\s*(?i:INSERT|UPDATE|DELETE|COPY)\\b.*"));
        assertFalse(sql.contains("flyway_schema_history"));
        assertFalse(sql.contains("OWNER TO"));
        assertFalse(sql.contains("GRANT "));
    }

    @Test void timeHashesAndExplicitAuthorityModesRemainTyped() {
        assertEquals("timestamp with time zone", jdbc.queryForObject("SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='crew_membership_projection_revision' AND column_name='evaluated_at'", String.class));
        assertEquals("bytea", jdbc.queryForObject("SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='crew_operational_resource_version' AND column_name='body'", String.class));
        var definition = jdbc.queryForObject("SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='crew_membership_identity_mode_check'", String.class);
        assertTrue(definition.contains("IDENTITY_RESEARCH_SHADOW"));
        assertTrue(definition.contains("OPERATIONAL_SUBJECT_BINDING"));
    }

    @Test void runtimeCoordinationIsExplicitAndCreatesNoSourceHistory() {
        var manager = new DataSourceTransactionManager(jdbc.getDataSource());
        new TransactionTemplate(manager).executeWithoutResult(tx -> {
            try { new DatabaseRuntimeInitialization().runtimeCoordination(jdbc, manager).afterPropertiesSet(); }
            catch (Exception e) { throw new AssertionError(e); }
            assertEquals(6, tables().stream().mapToInt(t -> count("SELECT count(*) FROM " + t)).sum());
            assertEquals(0, count("SELECT count(*) FROM orbital_element_sets"));
            assertEquals(0, count("SELECT count(*) FROM crew_person"));
            tx.setRollbackOnly();
        });
    }

    @Test void runtimeRestartCannotResetCooldownSuspensionOrWorkerProgress() {
        var manager = new DataSourceTransactionManager(jdbc.getDataSource());
        new TransactionTemplate(manager).executeWithoutResult(tx -> {
            try {
                var initialize = new DatabaseRuntimeInitialization().runtimeCoordination(jdbc, manager);
                initialize.afterPropertiesSet();
                jdbc.update("UPDATE celestrak_request_state SET next_eligible_at='2030-01-01Z',suspended=true");
                jdbc.update("UPDATE crew_operational_subject_binding_work SET generation=8,completed_generation=7");
                var before = jdbc.queryForMap("SELECT * FROM celestrak_request_state");
                initialize.afterPropertiesSet();
                assertEquals(before, jdbc.queryForMap("SELECT * FROM celestrak_request_state"));
                assertEquals(7, count("SELECT completed_generation FROM crew_operational_subject_binding_work"));
                assertEquals(6, tables().stream().mapToInt(t -> count("SELECT count(*) FROM " + t)).sum());
            } catch (Exception e) { throw new AssertionError(e); }
            tx.setRollbackOnly();
        });
    }
}
