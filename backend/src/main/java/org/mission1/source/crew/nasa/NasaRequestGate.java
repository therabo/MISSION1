package org.mission1.source.crew.nasa;

import java.time.*;
import java.util.concurrent.Semaphore;
import org.mission1.crew.application.CrewEditorialRepository;

/** Shared NASA pacing for operational and editorial HTTP only; never called from GET. */
public final class NasaRequestGate {
  private final CrewEditorialRepository repository;
  private final Clock clock;
  private final Semaphore concurrent = new Semaphore(2, true);

  public NasaRequestGate(CrewEditorialRepository repository, Clock clock) {
    this.repository = repository;
    this.clock = clock;
  }

  public AutoCloseable acquire() throws InterruptedException {
    concurrent.acquire();
    try {
      Instant slot = repository.reserveNasaRequest(clock.instant());
      long delay = Duration.between(clock.instant(), slot).toMillis();
      if (delay > 3000) throw new IllegalStateException("NASA_BUDGET_COOLDOWN");
      if (delay > 0) Thread.sleep(delay);
      return concurrent::release;
    } catch (RuntimeException | InterruptedException e) {
      concurrent.release();
      throw e;
    }
  }

  public void cooldown(Instant until) {
    repository.nasaCooldown(until);
  }

  public static Instant retryAfter(String raw, Instant now) {
    if (raw != null) {
      try {
        return now.plusSeconds(Math.min(604800, Math.max(1, Long.parseLong(raw.trim()))));
      } catch (Exception ignored) {
      }
      try {
        var t =
            ZonedDateTime.parse(raw, java.time.format.DateTimeFormatter.RFC_1123_DATE_TIME)
                .toInstant();
        return t.isBefore(now)
            ? now.plusSeconds(60)
            : t.isAfter(now.plusSeconds(604800)) ? now.plusSeconds(604800) : t;
      } catch (Exception ignored) {
      }
    }
    return now.plusSeconds(900);
  }
}
