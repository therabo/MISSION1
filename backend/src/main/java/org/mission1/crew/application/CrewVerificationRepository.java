package org.mission1.crew.application;

import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.mission1.crew.domain.*;

/** NASA document/evidence extension of the existing Crew history, using the same sync-run table. */
public interface CrewVerificationRepository {
  record Document(
      long id,
      CrewSourceDocument source,
      Integer httpStatus,
      String contentType,
      String parserName,
      String parserVersion,
      boolean parsed) {}

  record Evidence(long id, long documentId, CrewVerificationEvidence value) {}

  record Verification(long runId, long documentId, Instant fetchedAt) {}

  record ParseFailure(
      long runId, long documentId, Instant retrievedAt, String parserName, String parserVersion) {}

  record Stored(long documentId, boolean inserted, int evidenceInserted) {}

  Optional<Document> latestDocument(URI url, String parserName, String parserVersion);

  Stored storeFetch(
      long runId,
      CrewSourceDocument document,
      Integer status,
      String contentType,
      String parserName,
      String parserVersion,
      List<CrewVerificationEvidence> evidence,
      boolean parsed,
      Instant completedAt);

  void storeNotModified(long runId, Document document, Instant retrievedAt, Instant completedAt);

  Optional<Verification> latestSuccess();

  Optional<ParseFailure> latestParseFailure();

  List<Evidence> evidenceAsOf(Instant asOf);

  /** Release boundary: the new timed-departure interpretation is shadow-only until activation. */
  default List<Evidence> publicEvidenceAsOf(Instant asOf) {
    return evidenceAsOf(asOf).stream()
        .filter(e -> !e.value().evidenceMethod().startsWith(CrewOperationalTime.METHOD + "|"))
        .toList();
  }

  /** Explicit bounded reinterpretation input; no transport acquisition or freshness update. */
  default List<Document> retainedOperationalDocuments(int limit) {
    return List.of();
  }

  default Stored storeInterpretation(
      Document retained,
      String parserName,
      String parserVersion,
      List<CrewVerificationEvidence> evidence,
      boolean parsed) {
    throw new UnsupportedOperationException("Retained reinterpretation unavailable");
  }

  /** Read-only successful occurrence-version lineage; legacy ports retain independent versions. */
  default List<CrewOccurrenceVersion> occurrenceVersionsAsOf(Instant asOf) {
    return List.of();
  }

  /** Explicit write boundary, never called by GET. Preview performs no mutations. */
  default CrewOccurrencePlanner.Report previewOccurrenceAssociations() {
    return new CrewOccurrencePlanner().plan(List.of(), java.util.Map.of());
  }

  default CrewOccurrencePlanner.Report associateRetainedOccurrences() {
    return previewOccurrenceAssociations();
  }

  List<CrewIdentityResolution> resolve(List<Evidence> evidence, Instant asOf);

  List<CrewIdentityResolution> resolutionsAsOf(Instant asOf);

  Optional<CrewSourceDocument> document(long id);
}
