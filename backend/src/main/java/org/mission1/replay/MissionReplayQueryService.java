package org.mission1.replay;

import java.time.*;

/** One UTC instant, independent subsystem availability. No command or acquisition dependencies. */
public final class MissionReplayQueryService {
    public record Result(
            String semantics,
            Instant requestedAt,
            Instant reconstructedAt,
            CrewReplayQueryService.Result crew,
            OrbitHistoricalQueryService.Result orbit) {}

    public record Coverage(
            String semantics,
            Instant evaluatedAt,
            ReplayCoverage crew,
            ReplayCoverage orbit,
            ReplayCoverage joint,
            String orbitGate) {}

    private final CrewReplayQueryService crew;
    private final OrbitHistoricalQueryService orbit;
    private final Clock clock;

    public MissionReplayQueryService(
            CrewReplayQueryService crew, OrbitHistoricalQueryService orbit, Clock clock) {
        this.crew = crew;
        this.orbit = orbit;
        this.clock = clock;
    }

    public Result at(Instant at) {
        var now = clock.instant();
        if (at.isAfter(now))
            throw new IllegalArgumentException("Replay time must not be in the future");
        return new Result(
                "EFFECTIVE_TIME_BEST_CURRENT_RECONSTRUCTION",
                at,
                now,
                crew.at(at, now),
                orbit.at(at, now));
    }

    public Coverage coverage() {
        var now = clock.instant();
        var c = crew.coverage(now);
        var o = orbit.coverage(now);
        var joint = ReplayCoverage.intersect(c, o, now);
        boolean full =
                !c.intervals().isEmpty()
                        && c.intervals().stream()
                                .allMatch(
                                        i ->
                                                o.intervals().stream()
                                                        .anyMatch(
                                                                x ->
                                                                        !i.start()
                                                                                        .isBefore(
                                                                                                x
                                                                                                        .start())
                                                                                && !i.end()
                                                                                        .isAfter(
                                                                                                x
                                                                                                        .end())));
        return new Coverage(
                "EFFECTIVE_TIME_BEST_CURRENT_RECONSTRUCTION",
                now,
                c,
                o,
                joint,
                full ? "FULL" : joint.intervals().isEmpty() ? "INSUFFICIENT" : "BOUNDED");
    }
}
