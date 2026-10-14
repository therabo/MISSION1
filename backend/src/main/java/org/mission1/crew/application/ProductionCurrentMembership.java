package org.mission1.crew.application;

import org.mission1.crew.domain.CrewSource;
import org.mission1.crew.membership.*;
import org.springframework.stereotype.Service;

import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;

/** Crew membership inclusion followed by canonical identity publication. No identity research authority or write dependency. ADR-0017. */
@Service
public class ProductionCurrentMembership {
    public enum Mode {
        ACTIVE_PROJECTION
    }

    public record Selection(
            ActiveMembershipReader.Projection projection,
            List<CrewReadRepository.Person> members,
            int nonPublishableActive,
            int canonicalCollisions) {
        public Membership.HealthState health() {
            return nonPublishableActive + canonicalCollisions > 0
                    ? Membership.HealthState.DEGRADED
                    : projection.result().health();
        }
    }

    private final ActiveMembershipReader reader;
    private final CrewReadQueryService people;
    private final AtomicReference<String> lastDiagnostic = new AtomicReference<>();

    public ProductionCurrentMembership(
            ActiveMembershipReader reader,
            CrewReadQueryService people) {
        this.reader = reader;
        this.people = people;
    }

    public Mode mode() {
        return Mode.ACTIVE_PROJECTION;
    }

    public Selection select(Instant at, CrewCanonicalIdentity identity) {
        final ActiveMembershipReader.Projection projection;
        try {
            projection =
                    reader.latestCompatible()
                            .orElseThrow(
                                    () ->
                                            new CurrentProjectionUnavailable(
                                                    CurrentProjectionUnavailable.Reason.MISSING));
            if (projection.evaluatedAt().isAfter(at))
                throw new CurrentProjectionUnavailable(CurrentProjectionUnavailable.Reason.FUTURE);
        } catch (CurrentProjectionUnavailable failure) {
            String diagnostic = mode() + ":" + failure.reason();
            if (!diagnostic.equals(lastDiagnostic.getAndSet(diagnostic)))
                System.getLogger(getClass().getName())
                        .log(
                                System.Logger.Level.WARNING,
                                "crew_current_membership_mode={0}"
                                    + " crew_current_projection_health=UNAVAILABLE"
                                    + " crew_current_failure_reason={1}",
                                mode(),
                                failure.reason());
            throw failure;
        }
        var active =
                projection.result().members().stream()
                        .filter(m -> m.state() == Membership.State.ACTIVE)
                        .toList();
        var profiles = people.findPeople(active.stream().map(m -> m.human().anchor()).toList(), at);
        var published = new LinkedHashMap<UUID, CrewReadRepository.Person>();
        int nonPublishable = 0, collisions = 0;
        for (var m : active) {
            var h = m.human();
            var p = profiles.get(h.anchor());
            // Verify retained provider authority independently of the identity research.
            if (p == null
                    || !p.id().equals(identity.canonicalize(h.anchor()))
                    || p.externalIds().stream()
                            .noneMatch(
                                    e ->
                                            e.source() == CrewSource.LAUNCH_LIBRARY_2
                                                    && h.key().equals("LL2:PERSON:" + e.value()))) {
                nonPublishable++;
                continue;
            }
            if (published.putIfAbsent(p.id(), p) != null) collisions++;
        }
        var selected =
                new Selection(
                        projection, List.copyOf(published.values()), nonPublishable, collisions);
        String diagnostic =
                mode()
                        + ":"
                        + projection.revision()
                        + ":"
                        + published.size()
                        + ":"
                        + nonPublishable
                        + ":"
                        + collisions;
        if (!diagnostic.equals(lastDiagnostic.getAndSet(diagnostic)))
            System.getLogger(getClass().getName())
                    .log(
                            nonPublishable + collisions > 0
                                    ? System.Logger.Level.WARNING
                                    : System.Logger.Level.INFO,
                            "crew_current_membership_mode={0} crew_current_projection_revision={1}"
                                + " crew_current_members={2}"
                                + " crew_current_projection_age_seconds={3}"
                                + " crew_current_projection_health={4}"
                                + " crew_current_non_publishable_active={5}"
                                + " crew_current_canonical_collisions={6}",
                            mode(),
                            projection.revision(),
                            published.size(),
                            Math.max(0, Duration.between(projection.evaluatedAt(), at).toSeconds()),
                            selected.health(),
                            nonPublishable,
                            collisions);
        return selected;
    }
}
