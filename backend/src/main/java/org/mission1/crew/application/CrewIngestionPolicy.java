package org.mission1.crew.application;

import java.time.Duration;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

/** MISSION1 request policy, not an assertion about LL2 update cadence. */
public record CrewIngestionPolicy(Duration fixedDelay, Duration initialDelay) {
    public CrewIngestionPolicy {
        if (fixedDelay == null || fixedDelay.compareTo(Duration.ofHours(1)) < 0)
            throw new IllegalArgumentException("Crew fixed delay must be at least one hour");
        if (initialDelay == null || initialDelay.compareTo(Duration.ofMinutes(1)) < 0)
            throw new IllegalArgumentException("Crew initial delay must be at least one minute");
    }

    public Instant retryAfter(String value, Instant receivedAt) {
        if (value == null) return null;
        try {
            String trimmed = value.trim();
            if (trimmed.matches("[0-9]+")) return receivedAt.plusSeconds(Long.parseLong(trimmed));
            return ZonedDateTime.parse(trimmed, DateTimeFormatter.RFC_1123_DATE_TIME).toInstant();
        } catch (DateTimeException | ArithmeticException | NumberFormatException e) {
            return null; // Malformed header stays inspectable; normal delay still applies.
        }
    }
}
