package org.mission1.crew.membership;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.json.JsonMapper;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mission1.crew.application.CurrentProjectionUnavailable;
import org.mission1.crew.persistence.JdbcActiveMembershipReader;
import org.mission1.source.crew.CrewHttpReader;
import org.springframework.jdbc.core.*;

import java.sql.ResultSet;
import java.time.*;
import java.util.*;

/** Corrupt result-set fixtures exercise the read boundary beyond V10's write-time guards. */
class ActiveMembershipReaderTest {
    @org.junit.jupiter.api.Test
    void unreadableSchemaOrMalformedSqlModelFailsWithBoundedAvailabilityDiagnostic() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(
                        anyString(),
                        org.mockito.ArgumentMatchers
                                .<RowMapper<ActiveMembershipReader.Projection>>any()))
                .thenThrow(
                        new org.springframework.jdbc.BadSqlGrammarException(
                                "TEST_ONLY", "TEST_ONLY", new java.sql.SQLException()));
        var failure =
                assertThrows(
                        CurrentProjectionUnavailable.class,
                        () ->
                                new JdbcActiveMembershipReader(
                                                jdbc,
                                                JsonMapper.builder().build(),
                                                ActiveMembershipPolicy.defaults())
                                        .latestCompatible());
        assertEquals(CurrentProjectionUnavailable.Reason.INVALID, failure.reason());
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "semantic_hash",
                "input_hash",
                "identity_mode",
                "serialized_result",
                "complete",
                "policy_version"
            })
    void incompatibleOrCorruptPersistedRevisionFailsClosed(String corrupt) throws Exception {
        var json = JsonMapper.builder().findAndAddModules().build();
        var policy = ActiveMembershipPolicy.defaults();
        var cut =
                new Membership.Cut(
                        null, null, null, null, null, null, null, null, null, List.of(), List.of(),
                        List.of(), Map.of());
        var result =
                new Membership.Result(
                        cut,
                        policy.key(),
                        List.of(),
                        List.of(),
                        List.of(),
                        new Membership.Counts(0, 0, 0, 0, 0, 0, 0, null, null, null),
                        Membership.HealthState.DEGRADED,
                        Map.of());
        String body = json.writeValueAsString(result), pins = json.writeValueAsString(cut);
        var values = new HashMap<String, String>();
        values.put(
                "semantic_hash",
                CrewHttpReader.sha256(body.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        values.put(
                "input_hash",
                CrewHttpReader.sha256(pins.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        values.put("policy_version", policy.key());
        values.put("identity_mode", Membership.MODE);
        values.put("serialized_result", body);
        values.put("result", body);
        values.put("serialized_cut", pins);
        values.put("input_cut", pins);
        values.put("health", "DEGRADED");
        values.put(corrupt, "TEST_ONLY_CORRUPT");
        ResultSet row = mock(ResultSet.class);
        when(row.getString(anyString())).thenAnswer(a -> values.get(a.getArgument(0)));
        when(row.getBoolean("complete")).thenReturn(!corrupt.equals("complete"));
        when(row.getObject("evaluated_at", OffsetDateTime.class)).thenReturn(OffsetDateTime.now());
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(
                        anyString(),
                        org.mockito.ArgumentMatchers
                                .<RowMapper<ActiveMembershipReader.Projection>>any()))
                .thenAnswer(
                        a ->
                                List.of(
                                        a.<RowMapper<ActiveMembershipReader.Projection>>getArgument(
                                                        1)
                                                .mapRow(row, 0)));
        var failure =
                assertThrows(
                        CurrentProjectionUnavailable.class,
                        () ->
                                new JdbcActiveMembershipReader(jdbc, json, policy)
                                        .latestCompatible());
        assertEquals(
                Set.of("identity_mode", "policy_version").contains(corrupt)
                        ? CurrentProjectionUnavailable.Reason.INCOMPATIBLE
                        : CurrentProjectionUnavailable.Reason.INVALID,
                failure.reason());
    }
}
