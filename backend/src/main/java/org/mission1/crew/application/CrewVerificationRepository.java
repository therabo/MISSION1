package org.mission1.crew.application;

import org.mission1.crew.domain.*;

import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

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
            long runId,
            long documentId,
            Instant retrievedAt,
            String parserName,
            String parserVersion) {}

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

    List<CrewIdentityResolution> resolve(List<Evidence> evidence, Instant asOf);

    List<CrewIdentityResolution> resolutionsAsOf(Instant asOf);

    Optional<CrewSourceDocument> document(long id);
}
