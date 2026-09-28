package org.mission1.source.orbital.celestrak;

public class SourceFetchException extends RuntimeException {
    private final Integer httpStatus;

    public SourceFetchException(String message, Integer httpStatus, Throwable cause) {
        super(message, cause);
        this.httpStatus = httpStatus;
    }

    public Integer httpStatus() { return httpStatus; }
}
