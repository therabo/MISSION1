package org.mission1.crew.membership;

import java.time.Instant;
import java.util.Optional;

/** Persisted V10 read port; no materialization or identity evaluation. ADR-0017. */
public interface ActiveMembershipReader {
    record Projection(
            long revision, Instant evaluatedAt, String semanticHash, Membership.Result result) {}

    Optional<Projection> latestCompatible();
}
