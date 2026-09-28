package org.mission1.orbital.application;

/** Client-supplied window bounds do not satisfy the Earth View sampling contract. */
public final class InvalidOrbitalSampleRequestException extends RuntimeException {
    public InvalidOrbitalSampleRequestException(String message) { super(message); }
}
