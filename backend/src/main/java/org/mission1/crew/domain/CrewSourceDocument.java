package org.mission1.crew.domain;

import java.util.Objects;
public record CrewSourceDocument(NasaSourceType sourceType, CrewSourceObservation observation, byte[] body) {
    public CrewSourceDocument {
        Objects.requireNonNull(sourceType); Objects.requireNonNull(observation); body = body.clone();
    }
    @Override public byte[] body() { return body.clone(); }
}
