package org.mission1.orbital.domain;

/** Stable, sanitized categories for CelesTrak acquisition failures. */
public enum SourceFailureCategory {
    NETWORK_ERROR, TIMEOUT, HTTP_ERROR, RATE_LIMITED_OR_BLOCKED,
    INVALID_RESPONSE, INVALID_TLE, WRONG_SATELLITE, UNKNOWN_ERROR
}
