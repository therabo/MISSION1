package org.mission1.crew.application;

import java.util.*;
import org.mission1.crew.domain.*;
import static org.mission1.crew.application.CrewOccurrenceFingerprint.*;

/** Pure conservative association/dry run. A source mention is never a canonical person (ADR-0012). */
public final class CrewOccurrencePlanner {
    public static final String VERSION = "crew-occurrence-v1";
    public record Locator(long documentId, CrewSourceArticle article, int paragraphIndex) {}
    public record Input(CrewVerificationRepository.Evidence evidence, String evidenceHash,
            String parserName, String parserVersion, List<Locator> locators,
            List<CrewOccurrenceVersion.Observation> observations) {
        public Input { locators = List.copyOf(locators); observations = List.copyOf(observations); }
    }
    public record Subject(int evidenceIndex, String occurrenceKey, String payloadKey) {}
    public record Association(Input input, String articleKey, String candidateKey, String guardKey,
            String occurrenceKey, String status, List<Subject> subjects) {
        public Association { subjects = List.copyOf(subjects); }
    }
    public record Report(int evidenceVersions, int assertionOccurrences, int subjectOccurrences,
            int subjectPayloadVersions, int multiVersionOccurrences, int conflicts,
            int ambiguousAssociations, int unassociatedVersions, List<Association> associations) {
        public Report { associations = List.copyOf(associations); }
    }

    public Report plan(List<Input> inputs, Map<Long, String> existingMembership) {
        var groups = new TreeMap<String, List<Association>>();
        var result = new ArrayList<Association>();
        for (var input : inputs.stream().sorted(Comparator.comparing(Input::evidenceHash)).toList()) {
            var e = input.evidence().value();
            String article = article(input);
            String candidate = article == null ? null : candidate(e, article);
            String guard = guard(input);
            boolean supported = "NasaOperationalFeedParser".equals(input.parserName())
                    && "1.0.0".equals(input.parserVersion())
                    && "NasaOperationalPostParser/1.0.0".equals(e.evidenceMethod());
            String status = article == null ? "UNASSOCIATED_SCOPE"
                    : !supported ? "UNSUPPORTED_SEMANTICS" : "COMPATIBLE";
            String key = candidate == null || !supported ? isolated(input) : hash(List.of(VERSION, candidate, guard));
            var a = association(input, article, candidate, guard, key, status);
            groups.computeIfAbsent(key, x -> new ArrayList<>()).add(a);
        }
        for (var group : groups.values()) {
            boolean conflict = group.stream().anyMatch(a -> group.stream().anyMatch(b -> strongConflict(a.input(), b.input())));
            boolean unordered = group.stream().anyMatch(a -> group.stream().anyMatch(b -> unordered(a.input(), b.input())));
            for (var a : group) {
                String persisted = existingMembership.get(a.input().evidence().id());
                if (persisted != null) {
                    // Existing, audited memberships are immutable; later incompatible versions cannot rewrite them.
                    result.add(association(a.input(), a.articleKey(), a.candidateKey(), a.guardKey(), persisted, a.status()));
                } else if (unordered) {
                    result.add(association(a.input(), a.articleKey(), a.candidateKey(), a.guardKey(), isolated(a.input()), "AMBIGUOUS_ORDER"));
                } else if (conflict) {
                    result.add(association(a.input(), a.articleKey(), a.candidateKey(), a.guardKey(), isolated(a.input()), "CONFLICTING_SUBJECT_KEYS"));
                } else result.add(a);
            }
        }
        // A newly ingested version must also agree with every persisted member it would join.
        var checked = new ArrayList<Association>();
        for (var a : result) {
            boolean incompatible = !existingMembership.containsKey(a.input().evidence().id())
                    && result.stream().filter(b -> existingMembership.containsKey(b.input().evidence().id()))
                        .filter(b -> b.occurrenceKey().equals(a.occurrenceKey()))
                        .anyMatch(b -> !Objects.equals(a.articleKey(), b.articleKey())
                            || !Objects.equals(a.candidateKey(), b.candidateKey()) || !a.guardKey().equals(b.guardKey())
                            || strongConflict(a.input(), b.input()));
            checked.add(incompatible ? association(a.input(), a.articleKey(), a.candidateKey(), a.guardKey(), isolated(a.input()), "CONFLICTING_SUBJECT_KEYS") : a);
        }
        checked.sort(Comparator.comparing(a -> a.input().evidenceHash()));
        var occurrenceGroups = new HashMap<String, Integer>();
        var subjects = new HashSet<String>(); var versions = new HashSet<String>();
        for (var a : checked) {
            occurrenceGroups.merge(a.occurrenceKey(), 1, Integer::sum);
            for (var s : a.subjects()) { subjects.add(s.occurrenceKey()); versions.add(s.occurrenceKey() + ":" + s.payloadKey()); }
        }
        return new Report(inputs.size(), occurrenceGroups.size(), subjects.size(), versions.size(),
                (int) occurrenceGroups.values().stream().filter(n -> n > 1).count(),
                (int) checked.stream().filter(a -> a.status().equals("CONFLICTING_SUBJECT_KEYS")).count(),
                (int) checked.stream().filter(a -> (a.status().equals("UNASSOCIATED_SCOPE") || a.status().equals("AMBIGUOUS_ORDER"))).count(),
                (int) checked.stream().filter(a -> !a.status().equals("COMPATIBLE")).count(), checked);
    }

    private static String article(Input input) {
        var e = input.evidence().value();
        if (e.observation().source() != CrewSource.NASA_OFFICIAL || input.locators().isEmpty()
                || (e.observation().sourceEventAt() == null && e.observation().sourcePublishedAt() == null)) return null;
        for (var locator : input.locators()) {
            boolean matched = locator.article().paragraphs().stream().anyMatch(p -> p.index() == locator.paragraphIndex()
                    && normalize(p.text()).equals(normalize(e.supportingExcerpt())));
            if (!matched || !Objects.equals(locator.article().publishedAt(), e.observation().sourcePublishedAt())) return null;
        }
        var keys = input.locators().stream().map(l -> l.article().stableKey()).distinct().toList();
        if (keys.size() != 1 || keys.getFirst() == null) return null;
        // Exactly one matching scope per associated source document; indices only locate this version.
        for (var id : input.locators().stream().map(Locator::documentId).distinct().toList())
            if (input.locators().stream().filter(l -> l.documentId() == id).count() != 1) return null;
        var names = e.people().stream().map(p -> normalize(p.displayName())).toList();
        if (new HashSet<>(names).size() != names.size()) return null;
        return keys.getFirst();
    }

    public static String candidate(CrewVerificationEvidence e, String article) {
        var time = e.observation().sourceEventAt();
        var context = Map.of("role", time == null ? "PUBLICATION_FALLBACK" : "EXPLICIT_EVENT",
                "value", (time == null ? e.observation().sourcePublishedAt() : time).toString());
        return hash(Map.of("source", e.observation().source().name(), "article_resource", article,
                "station", e.station().name(), "type", e.type().name(), "assertion", e.assertion().name(),
                "temporal_context", context, "source_scope", normalize(e.supportingExcerpt())));
    }
    private static String guard(Input input) {
        var e = input.evidence().value();
        return hash(Arrays.asList(e.sourceType().name(), e.crewCount(), e.completeness().name(),
                e.people().stream().map(p -> normalize(p.displayName())).toList(),
                input.parserName(), input.parserVersion(), e.evidenceMethod(),
                e.observation().sourcePublishedAt() == null ? null : e.observation().sourcePublishedAt().toString(),
                e.observation().sourceEventAt() == null ? null : e.observation().sourceEventAt().toString()));
    }
    private static String isolated(Input input) { return hash(List.of(VERSION, "isolated", input.evidenceHash())); }
    private static Association association(Input input, String article, String candidate, String guard, String key, String status) {
        var subjects = new ArrayList<Subject>(); var people = input.evidence().value().people();
        for (int i = 0; i < people.size(); i++) {
            var p = people.get(i);
            String name = normalize(p.displayName());
            int ordinal = 0;
            for (int j = 0; j < i; j++) if (normalize(people.get(j).displayName()).equals(name)) ordinal++;
            String subject = hash(Map.of("assertion", key, "exact_source_mention", name,
                    "same_name_within_claim_ordinal", ordinal));
            var payloadFields = new TreeMap<String, Object>();
            payloadFields.put("source_mention", name);
            payloadFields.put("external_ids", p.externalIds().stream().map(x -> Map.of("source", x.source().name(), "value", x.value())).toList());
            payloadFields.put("official_profile_url", p.officialProfileUrl() == null ? null : p.officialProfileUrl().toString());
            String payload = hash(payloadFields);
            subjects.add(new Subject(i, subject, payload));
        }
        return new Association(input, article, candidate, guard, key, status, subjects);
    }
    private static boolean unordered(Input a, Input b) {
        if (a.evidenceHash().equals(b.evidenceHash()) || a.observations().isEmpty() || b.observations().isEmpty()) return false;
        var x = a.observations().stream().max(CrewCompatibleVersionSelector::compareObservations).orElseThrow();
        var y = b.observations().stream().max(CrewCompatibleVersionSelector::compareObservations).orElseThrow();
        return CrewCompatibleVersionSelector.compareObservations(x, y) == 0;
    }
    private static boolean strongConflict(Input a, Input b) {
        var left = a.evidence().value().people(); var right = b.evidence().value().people();
        if (left.size() != right.size()) return true;
        for (int i = 0; i < left.size(); i++) {
            var x = left.get(i); var y = right.get(i);
            for (var source : CrewSource.values()) {
                var idsX = x.externalIds().stream().filter(id -> id.source() == source).map(ExternalId::value).collect(java.util.stream.Collectors.toSet());
                var idsY = y.externalIds().stream().filter(id -> id.source() == source).map(ExternalId::value).collect(java.util.stream.Collectors.toSet());
                if (!idsX.isEmpty() && !idsY.isEmpty() && !idsX.equals(idsY)) return true;
            }
            if (x.officialProfileUrl() != null && y.officialProfileUrl() != null
                    && !x.officialProfileUrl().equals(y.officialProfileUrl())) return true;
        }
        return false;
    }
}
