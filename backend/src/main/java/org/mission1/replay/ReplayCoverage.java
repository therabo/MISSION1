package org.mission1.replay;

import java.time.Instant;
import java.util.*;

/**
 * Inclusive, sorted support intervals. Membership says applicability, not full roster or accuracy.
 */
public record ReplayCoverage(
        String status,
        Instant start,
        Instant end,
        List<Interval> intervals,
        List<String> limitations) {
    public record Interval(Instant start, Instant end) {
        public Interval {
            if (start.isAfter(end)) throw new IllegalArgumentException("Reversed coverage");
        }

        public boolean contains(Instant at) {
            return !at.isBefore(start) && !at.isAfter(end);
        }
    }

    public boolean contains(Instant at) {
        return intervals.stream().anyMatch(i -> i.contains(at));
    }

    public static ReplayCoverage of(
            List<Interval> input, Instant now, boolean partial, List<String> limits) {
        var sorted =
                input.stream()
                        .filter(i -> !i.start().isAfter(now))
                        .map(i -> new Interval(i.start(), i.end().isAfter(now) ? now : i.end()))
                        .sorted(Comparator.comparing(Interval::start).thenComparing(Interval::end))
                        .toList();
        var merged = new ArrayList<Interval>();
        for (var i : sorted) {
            if (merged.isEmpty() || i.start().isAfter(merged.getLast().end())) merged.add(i);
            else {
                var old = merged.removeLast();
                merged.add(
                        new Interval(
                                old.start(), old.end().isAfter(i.end()) ? old.end() : i.end()));
            }
        }
        return new ReplayCoverage(
                merged.isEmpty() ? "UNAVAILABLE" : partial ? "PARTIAL" : "AVAILABLE",
                merged.isEmpty() ? null : merged.getFirst().start(),
                merged.isEmpty() ? null : merged.getLast().end(),
                List.copyOf(merged),
                List.copyOf(limits));
    }

    public static ReplayCoverage intersect(ReplayCoverage a, ReplayCoverage b, Instant now) {
        var result = new ArrayList<Interval>();
        for (var x : a.intervals())
            for (var y : b.intervals()) {
                var start = x.start().isAfter(y.start()) ? x.start() : y.start();
                var end = x.end().isBefore(y.end()) ? x.end() : y.end();
                if (!start.isAfter(end)) result.add(new Interval(start, end));
            }
        return of(
                result,
                now,
                true,
                List.of("Joint support does not imply complete Crew or measured position"));
    }
}
