package org.mission1.replay;

import java.time.Instant;
import java.util.*;

/** Read-only composition port. No source client or persistence command is exposed. */
public interface ReplayHistoryRepository {
    record Structured(long runId, Instant observedAt, boolean noActive) {}

    record Oem(
            String hash,
            Instant creation,
            Instant start,
            Instant end,
            Instant retrievedAt,
            String httpLastModified) {}

    List<Structured> structured();

    List<Oem> oem();

    byte[] oemBody(String hash);
}
