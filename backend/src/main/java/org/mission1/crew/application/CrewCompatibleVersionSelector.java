package org.mission1.crew.application;

import java.util.*;
import org.mission1.crew.domain.CrewOccurrenceVersion;

/** Pure shared Current/Replay input selection. Never fetches, writes, enriches or resolves humans. */
public final class CrewCompatibleVersionSelector {
    public static final String VERSION = "crew-compatible-selection-v1";
    public record Choice(String occurrenceKey, List<Long> selectedEvidenceIds,
            List<Long> retainedEvidenceIds, CrewOccurrenceVersion.Observation latestObservation,
            boolean ambiguousOrder) {
        public Choice { selectedEvidenceIds = List.copyOf(selectedEvidenceIds); retainedEvidenceIds = List.copyOf(retainedEvidenceIds); }
    }
    public record Selection(List<CrewVerificationRepository.Evidence> evidence, List<Choice> choices) {
        public Selection { evidence = List.copyOf(evidence); choices = List.copyOf(choices); }
    }
    private static final Comparator<CrewOccurrenceVersion.Observation> OBSERVED = Comparator
            .comparing(CrewOccurrenceVersion.Observation::retrievedAt)
            .thenComparing(CrewOccurrenceVersion.Observation::completedAt)
            .thenComparing(CrewOccurrenceVersion.Observation::startedAt);

    public static int compareObservations(CrewOccurrenceVersion.Observation a, CrewOccurrenceVersion.Observation b) {
        return OBSERVED.compare(a, b);
    }
    private static final Comparator<CrewOccurrenceVersion.Observation> LINEAGE = OBSERVED
            .thenComparingLong(CrewOccurrenceVersion.Observation::runId)
            .thenComparingLong(CrewOccurrenceVersion.Observation::documentId);

    public Selection select(List<CrewVerificationRepository.Evidence> evidence, List<CrewOccurrenceVersion> versions) {
        var byId = new HashMap<Long, CrewOccurrenceVersion>();
        for (var v : versions) {
            if (byId.putIfAbsent(v.evidenceId(), v) != null) throw new IllegalArgumentException("Contradictory evidence memberships");
        }
        var groups = new TreeMap<String, List<CrewVerificationRepository.Evidence>>();
        for (var e : evidence) {
            var v = byId.get(e.id());
            String key = v == null || v.observations().isEmpty() ? "unassociated:" + e.id() : v.occurrenceKey();
            groups.computeIfAbsent(key, x -> new ArrayList<>()).add(e);
        }
        var selected = new ArrayList<CrewVerificationRepository.Evidence>(); var choices = new ArrayList<Choice>();
        for (var entry : groups.entrySet()) {
            var members = entry.getValue(); members.sort(Comparator.comparingLong(CrewVerificationRepository.Evidence::id));
            CrewOccurrenceVersion.Observation latest = null;
            for (var e : members) {
                var v = byId.get(e.id());
                if (v != null) for (var o : v.observations()) if (latest == null || LINEAGE.compare(o, latest) > 0) latest = o;
            }
            final var selectedObservation = latest;
            var winners = new ArrayList<CrewVerificationRepository.Evidence>();
            for (var e : members) {
                var v = byId.get(e.id());
                if (latest == null || v != null && v.observations().stream().anyMatch(o -> OBSERVED.compare(o, selectedObservation) == 0)) winners.add(e);
            }
            // Acquisition/completion/start ties with different payloads have no known source order.
            // Preserve their ambiguity; never let a DB ID choose source meaning.
            selected.addAll(winners);
            choices.add(new Choice(entry.getKey(), winners.stream().map(CrewVerificationRepository.Evidence::id).toList(),
                    members.stream().map(CrewVerificationRepository.Evidence::id).toList(), latest, winners.size() > 1));
        }
        selected.sort(Comparator.comparingLong(CrewVerificationRepository.Evidence::id));
        return new Selection(selected, choices);
    }
}
