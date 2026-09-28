package org.mission1.source.orbital.celestrak;

import org.mission1.orbital.domain.SourceFailureCategory;

public class SourceFetchException extends RuntimeException {
    private final Integer httpStatus;
    private final SourceFailureCategory category;

    public SourceFetchException(String message, Integer httpStatus, SourceFailureCategory category, Throwable cause) {
        super(message, cause);
        this.httpStatus = httpStatus;
        this.category = java.util.Objects.requireNonNull(category);
    }

    public Integer httpStatus() { return httpStatus; }
    public SourceFailureCategory category() { return category; }
}
