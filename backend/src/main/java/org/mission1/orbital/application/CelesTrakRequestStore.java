package org.mission1.orbital.application;

import java.time.Instant;

/** Durable request reservation, independent of successful orbital observations. */
public interface CelesTrakRequestStore {
    record State(Instant nextEligibleAt, boolean suspended) { }
    State state();
    /** Reserve the whole cooldown before network I/O; false means another owner won. */
    boolean reserve(Instant at, Instant nextEligibleAt);
    /** Non-200 responses require operator investigation, including across restarts. */
    void suspend();
}
