package org.mission1.crew.application;

import static org.junit.jupiter.api.Assertions.*;
import java.time.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;

class CrewIngestionPolicyTest {
    final CrewIngestionPolicy policy = new CrewIngestionPolicy(Duration.ofHours(2), Duration.ofMinutes(5));
    final Instant now = Instant.parse("2026-10-03T10:00:00Z");
    @Test void retryAfterSecondsAndHttpDateHaveExactEligibility() {
        assertEquals(now.plusSeconds(10800), policy.retryAfter("10800", now));
        assertEquals(now.plusSeconds(10800), policy.retryAfter("Sat, 03 Oct 2026 13:00:00 GMT", now));
        assertEquals(now, policy.retryAfter("0", now));
    }
    @ParameterizedTest @NullAndEmptySource @ValueSource(strings = {"unknown", "-1", "9999999999999999999999999", "9223372036854775807"})
    void invalidRetryAfterDoesNotCrashScheduler(String header) { assertNull(policy.retryAfter(header, now)); }
    @Test void unsafeIntervalsAndImmediateStartupAreRejected() {
        assertThrows(IllegalArgumentException.class, () -> new CrewIngestionPolicy(Duration.ofMinutes(10), Duration.ofMinutes(5)));
        assertThrows(IllegalArgumentException.class, () -> new CrewIngestionPolicy(Duration.ofHours(2), Duration.ZERO));
        assertThrows(IllegalArgumentException.class, () -> new CrewIngestionPolicy(null, Duration.ofMinutes(5)));
    }
}
