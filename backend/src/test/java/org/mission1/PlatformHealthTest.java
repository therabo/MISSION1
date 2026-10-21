package org.mission1;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthContributor;
import org.springframework.boot.actuate.health.HealthContributorRegistry;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.boot.availability.AvailabilityChangeEvent;
import org.springframework.boot.availability.ReadinessState;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.ApplicationContext;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Actual migrated PostgreSQL/HTTP health; test defaults disable remote acquisition. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(locations = {"file:src/main/resources/application.properties", "classpath:application.properties"})
@Testcontainers
class PlatformHealthTest {
    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16.10");

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        properties.add("spring.datasource.username", POSTGRES::getUsername);
        properties.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired TestRestTemplate http;
    @Autowired ApplicationContext context;
    @Autowired HealthContributorRegistry contributors;
    private HealthContributor originalDatabase;

    @AfterEach
    void restoreHealth() {
        if (originalDatabase != null) {
            contributors.unregisterContributor("db");
            contributors.registerContributor("db", originalDatabase);
        }
        AvailabilityChangeEvent.publish(context, ReadinessState.ACCEPTING_TRAFFIC);
    }

    @Test void migratedDatabaseAndSpringAreHealthyWithoutExposingDetails() {
        for (String path : new String[]{"", "/liveness", "/readiness"}) {
            var response = http.getForEntity("/actuator/health" + path, JsonNode.class);
            assertEquals(HttpStatus.OK, response.getStatusCode());
            assertEquals("UP", response.getBody().path("status").asText());
            assertFalse(response.getBody().has("components"));
            assertFalse(response.getBody().has("details"));
        }
    }

    @Test void emptyMissionDataDoesNotControlReadiness() {
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE,
                http.getForEntity("/api/iss/state", String.class).getStatusCode());
        assertEquals(HttpStatus.OK,
                http.getForEntity("/actuator/health/readiness", String.class).getStatusCode());
    }

    @Test void springRefusalChangesReadinessButNotLiveness() {
        AvailabilityChangeEvent.publish(context, ReadinessState.REFUSING_TRAFFIC);
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE,
                http.getForEntity("/actuator/health/readiness", String.class).getStatusCode());
        assertEquals(HttpStatus.OK,
                http.getForEntity("/actuator/health/liveness", String.class).getStatusCode());
    }

    @Test void databaseFailureChangesReadinessButNotLivenessOrHealthDetails() {
        originalDatabase = contributors.unregisterContributor("db");
        assertNotNull(originalDatabase);
        contributors.registerContributor("db", (HealthIndicator) () ->
                Health.down().withDetail("TEST_ONLY_PRIVATE_DETAIL", "must not be exposed").build());
        var response = http.getForEntity("/actuator/health/readiness", String.class);
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        assertFalse(response.getBody().contains("TEST_ONLY_PRIVATE_DETAIL"));
        assertEquals(HttpStatus.OK,
                http.getForEntity("/actuator/health/liveness", String.class).getStatusCode());
    }

    @Test void sensitiveManagementEndpointsAreNotExposed() {
        for (String endpoint : new String[]{"env", "beans", "configprops", "mappings",
                "heapdump", "metrics", "loggers", "shutdown", "flyway"}) {
            assertEquals(HttpStatus.NOT_FOUND,
                    http.getForEntity("/actuator/" + endpoint, String.class).getStatusCode(), endpoint);
        }
    }
}
