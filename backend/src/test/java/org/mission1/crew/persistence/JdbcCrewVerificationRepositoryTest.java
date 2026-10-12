package org.mission1.crew.persistence;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.mission1.crew.FixtureCrewSource;
import org.mission1.crew.application.*;
import org.mission1.crew.domain.*;
import org.mission1.source.crew.CrewHttpReader;
import org.mission1.source.crew.nasa.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;

@SpringBootTest
@Testcontainers
class JdbcCrewVerificationRepositoryTest {
  @Container
  static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:16.10")
          .withDatabaseName("mission1_test")
          .withUsername("mission1_test")
          .withPassword("test_only");

  @DynamicPropertySource
  static void database(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    r.add("spring.datasource.username", POSTGRES::getUsername);
    r.add("spring.datasource.password", POSTGRES::getPassword);
  }

  @Autowired CrewRepository runs;
  @Autowired CrewVerificationRepository verification;
  @Autowired CrewReconciliationRepository reconciliation;
  CrewReconciliationQueryService query;
  @Autowired JdbcTemplate jdbc;
  FixtureCrewSource fixture;
  CrewReconciliationService service;
  byte[] body;
  final Instant now = Instant.parse("2026-10-03T12:00:00Z");
  final NasaOperationalFeedParser parser = new NasaOperationalFeedParser();

  @BeforeEach
  void setup() throws Exception {
    jdbc.execute(
        "TRUNCATE"
            + " crew_source_article,crew_assertion_occurrence,crew_source_sync_run,crew_source_snapshot,crew_person,crew_person_external_id,crew_expedition,crew_expedition_external_id,crew_expedition_observation,crew_person_observation,crew_assignment_observation,crew_document_body,crew_source_document,crew_verification_evidence,crew_evidence_subject,crew_document_evidence,crew_identity_resolution,crew_reconciliation_run,crew_reconciliation_snapshot,crew_reconciliation_evidence,crew_reconciliation_resolution,crew_reconciled_person,crew_reconciled_person_evidence"
            + " RESTART IDENTITY CASCADE");
    fixture = new FixtureCrewSource();
    fixture.clock.time = now;
    try (var input =
        new java.util.zip.GZIPInputStream(
            getClass()
                .getResourceAsStream("/fixtures/crew/nasa/verification/operational-feed.xml.gz"))) {
      body = input.readAllBytes();
    }
    service =
        new CrewReconciliationService(
            runs,
            new CrewQueryService(runs, fixture.clock),
            verification,
            reconciliation,
            CrewReconciliationPolicy.defaults(),
            fixture.clock);
    query =
        new CrewReconciliationQueryService(
            service, new CrewQueryService(runs, fixture.clock), reconciliation, verification, runs);
  }

  @AfterEach
  void close() {
    fixture.close();
  }

  int count(String table) {
    return jdbc.queryForObject("SELECT count(*) FROM " + table, Integer.class);
  }

  CrewIngestionService.Result ll2() {
    return new CrewIngestionService(
            fixture.source,
            runs,
            new CrewIngestionPolicy(Duration.ofHours(2), Duration.ofMinutes(5)),
            fixture.clock,
            fixture.source.currentExpeditionUrl())
        .ingest();
  }

  long retainedFailure(byte[] raw, Instant captured) {
    long run =
        runs.startRun(
            CrewSource.NASA_OFFICIAL, Station.ISS, captured, NasaOperationalFeedHttpSource.URL);
    var o =
        new CrewSourceObservation(
            CrewSource.NASA_OFFICIAL,
            NasaOperationalFeedHttpSource.URL,
            captured,
            null,
            null,
            null,
            null,
            CrewHttpReader.sha256(raw),
            "NASA_RSS",
            "NasaOperationalFeedParser/1.0.0");
    return verification
        .storeFetch(
            run,
            new CrewSourceDocument(NasaSourceType.NASA_ISS_OPERATIONAL_FEED, o, raw),
            200,
            "application/rss+xml",
            NasaOperationalFeedParser.NAME,
            "1.0.0",
            List.of(),
            false,
            captured.plusMillis(1))
        .documentId();
  }

  @Test
  void retainedDepartureReinterpretationIsAppendOnlyAndCannotHealAcquisitionHealth()
      throws Exception {
    var raw = NasaCompletedDepartureTest.fixture();
    long old = retainedFailure(raw, Instant.parse("2026-10-10T14:09:37.143134Z"));
    var oldDocument = jdbc.queryForMap("SELECT * FROM crew_source_document WHERE id=?", old);
    var oldRun = jdbc.queryForList("SELECT * FROM crew_source_sync_run");
    var command = new NasaOperationalReprocessingService(verification, parser);
    var first = command.reprocess(32).getFirst();
    assertEquals(CrewSourceState.AVAILABLE, first.state());
    assertEquals(4, first.stored().evidenceInserted());
    assertTrue(first.stored().inserted());
    assertNotEquals(old, first.stored().documentId());
    assertEquals(
        oldDocument, jdbc.queryForMap("SELECT * FROM crew_source_document WHERE id=?", old));
    assertEquals(oldRun, jdbc.queryForList("SELECT * FROM crew_source_sync_run"));
    assertTrue(verification.latestSuccess().isEmpty());
    assertEquals(old, verification.latestParseFailure().orElseThrow().documentId());
    assertArrayEquals(raw, verification.document(first.stored().documentId()).orElseThrow().body());
    assertEquals(1, count("crew_document_body"));
    assertEquals(4, count("crew_assertion_occurrence"));
    assertEquals(10, count("crew_subject_occurrence"));
    var at = Instant.parse("2026-10-11T00:00:00Z");
    assertEquals(4, verification.evidenceAsOf(at).size());
    assertEquals(3, verification.publicEvidenceAsOf(at).size());
    var versions = verification.occurrenceVersionsAsOf(at);
    assertEquals(4, versions.size());
    assertEquals(1, versions.getFirst().observations().size());
    assertEquals(old, versions.getFirst().observations().getFirst().documentId());
    assertEquals(
        CrewOperationalTime.read(verification.evidenceAsOf(at).getFirst().value().evidenceMethod()),
        CrewOperationalTime.read(
            new JdbcCrewVerificationRepository(
                    jdbc, new com.fasterxml.jackson.databind.ObjectMapper())
                .evidenceAsOf(at)
                .getFirst()
                .value()
                .evidenceMethod()));
    assertFalse(command.reprocess(32).getFirst().stored().inserted());
    var restarted =
        new NasaOperationalReprocessingService(
            new JdbcCrewVerificationRepository(
                jdbc, new com.fasterxml.jackson.databind.ObjectMapper()),
            parser);
    assertFalse(restarted.reprocess(32).getFirst().stored().inserted());
    assertEquals(4, count("crew_verification_evidence"));
    assertEquals(10, count("crew_evidence_subject"));
  }

  @Test
  void departureMetadataRepublicationAndAbaKeepOneLogicalOccurrence() throws Exception {
    byte[] a = NasaCompletedDepartureTest.fixture();
    byte[] b =
        new String(a, StandardCharsets.UTF_8)
            .replace("Wed, 07 Oct 2026 12:48:02 +0000", "Wed, 07 Oct 2026 12:49:02 +0000")
            .getBytes(StandardCharsets.UTF_8);
    var command = new NasaOperationalReprocessingService(verification, parser);
    retainedFailure(a, Instant.parse("2026-10-10T14:09:37Z"));
    command.reprocess(32);
    retainedFailure(b, Instant.parse("2026-10-10T15:09:37Z"));
    command.reprocess(32);
    retainedFailure(a, Instant.parse("2026-10-10T16:09:37Z"));
    command.reprocess(32);
    assertEquals(2, count("crew_document_body"));
    assertEquals(4, count("crew_source_document"));
    assertEquals(5, count("crew_verification_evidence"));
    assertEquals(4, count("crew_assertion_occurrence"));
    assertEquals(10, count("crew_subject_occurrence"));
    assertEquals(14, count("crew_evidence_subject"));
    var selection =
        new CrewCompatibleVersionSelector()
            .select(
                verification.evidenceAsOf(Instant.parse("2026-10-11T00:00:00Z")),
                verification.occurrenceVersionsAsOf(Instant.parse("2026-10-11T00:00:00Z")));
    assertEquals(4, selection.evidence().size());
    assertEquals(
        Instant.parse("2026-10-07T12:48:02Z"),
        selection.evidence().stream().filter(e -> e.value().type()==CrewVerificationEvidence.Type.PERSON_DEPARTED_STATION).findFirst().orElseThrow().value().observation().sourcePublishedAt());
    assertEquals(0, count("crew_identity_binding_version"));
    assertEquals(0, count("crew_auto_decision_revision"));
  }

  @Test
  void reinterpretationRejectsCallerSuppliedReplacementBytesAndBounds() throws Exception {
    var raw = NasaCompletedDepartureTest.fixture();
    retainedFailure(raw, Instant.parse("2026-10-10T14:09:37Z"));
    var old = verification.retainedOperationalDocuments(1).getFirst();
    var forged =
        new CrewVerificationRepository.Document(
            old.id(),
            new CrewSourceDocument(
                old.source().sourceType(), old.source().observation(), "tampered".getBytes()),
            old.httpStatus(),
            old.contentType(),
            old.parserName(),
            old.parserVersion(),
            old.parsed());
    assertThrows(
        IllegalArgumentException.class,
        () ->
            verification.storeInterpretation(
                forged,
                NasaOperationalFeedParser.NAME,
                NasaOperationalFeedParser.VERSION,
                List.of(),
                true));
    assertThrows(
        IllegalArgumentException.class,
        () -> new NasaOperationalReprocessingService(verification, parser).reprocess(33));
    assertEquals(1, count("crew_source_document"));
  }

  NasaCrewVerificationIngestionService nasa(CrewVerificationHttpSource source) {
    return new NasaCrewVerificationIngestionService(
        source,
        parser,
        verification,
        runs,
        new CrewIngestionPolicy(Duration.ofHours(2), Duration.ofMinutes(10)),
        fixture.clock,
        NasaOperationalFeedHttpSource.URL,
        NasaOperationalFeedParser.NAME,
        NasaOperationalFeedParser.VERSION);
  }

  CrewVerificationHttpSource.Fetch fetch(
      Integer status, byte[] bytes, CrewSourceResult.Failure failure) {
    return new CrewVerificationHttpSource.Fetch(
        bytes,
        failure,
        status,
        "application/rss+xml",
        "test-etag",
        "Fri, 02 Oct 2026 18:14:15 GMT",
        fixture.clock.time);
  }

  NasaCrewVerificationIngestionService.Result ingest() {
    return nasa((u, e, l) -> fetch(200, body, null)).ingest();
  }

  @Test
  void emptySchemaAndV3UpgradePreserveCrewAndOrbitHistory() {
    assertEquals(12, count("flyway_schema_history"));
    var v3 =
        Flyway.configure()
            .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
            .schemas("verification_upgrade")
            .target("3")
            .load();
    assertEquals(3, v3.migrate().migrationsExecuted);
    jdbc.update(
        "INSERT INTO verification_upgrade.crew_person(id,created_at) VALUES (?,?)",
        new UUID(0, 1),
        now.atOffset(ZoneOffset.UTC));
    jdbc.update(
        "INSERT INTO"
            + " verification_upgrade.nasa_oem_ephemerides(sha256,xml,creation_date,start_time,stop_time,last_retrieved_at)"
            + " VALUES (?, ?, now(),now(),now()+interval '1 day',now())",
        "c".repeat(64),
        new byte[] {1, 2, 3});
    var latest =
        Flyway.configure()
            .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
            .schemas("verification_upgrade")
            .load();
    assertEquals(9, latest.migrate().migrationsExecuted);
    latest.validate();
    assertEquals(
        1,
        jdbc.queryForObject(
            "SELECT count(*) FROM verification_upgrade.crew_person", Integer.class));
    assertArrayEquals(
        new byte[] {1, 2, 3},
        jdbc.queryForObject(
            "SELECT xml FROM verification_upgrade.nasa_oem_ephemerides", byte[].class));
  }

  @Test
  void twoIdenticalFetchesDeduplicateRawDocumentAndEvidence() {
    var a = ingest();
    fixture.clock.time = now.plusSeconds(7200);
    var b = ingest();
    assertTrue(a.documentInserted());
    assertFalse(b.documentInserted());
    assertEquals(a.documentId(), b.documentId());
    assertEquals(2, count("crew_source_sync_run"));
    assertEquals(1, count("crew_document_body"));
    assertEquals(1, count("crew_source_document"));
    assertEquals(4, count("crew_verification_evidence"));
    assertEquals(11, count("crew_evidence_subject"));
    assertEquals(fixture.clock.time, verification.latestSuccess().orElseThrow().fetchedAt());
    assertArrayEquals(body, verification.document(a.documentId()).orElseThrow().body());
  }

  @Test
  void conditional304PreservesFetchHistoryAndSendsStoredValidators() {
    var a = ingest();
    fixture.clock.time = now.plusSeconds(7200);
    var source = mock(CrewVerificationHttpSource.class);
    when(source.fetch(any(), any(), any())).thenReturn(fetch(304, new byte[0], null));
    var b = nasa(source).ingest();
    verify(source)
        .fetch(NasaOperationalFeedHttpSource.URL, "test-etag", "Fri, 02 Oct 2026 18:14:15 GMT");
    assertEquals(a.documentId(), b.documentId());
    assertEquals(304, runs.findRun(b.runId()).orElseThrow().httpStatus());
    assertEquals(1, count("crew_document_body"));
    assertEquals(4, count("crew_verification_evidence"));
  }

  @Test
  void changedFeedRetainsBodiesAndReusesUnchangedAssertions() {
    var a = ingest();
    body =
        new String(body, StandardCharsets.UTF_8)
            .replace("<language>en-US</language>", "<language>en-US</language><extra>TEST</extra>")
            .getBytes(StandardCharsets.UTF_8);
    var b = ingest();
    assertNotEquals(a.documentId(), b.documentId());
    assertEquals(2, count("crew_document_body"));
    assertEquals(4, count("crew_verification_evidence"));
    assertEquals(8, count("crew_document_evidence"));
  }

  @Test
  void parsingFailurePersistsRawDocumentAndPreservesPriorSuccessfulState() {
    var a = ingest();
    body = "<rss>TEST broken</rss>".getBytes();
    fixture.clock.time = now.plusSeconds(1);
    var b = ingest();
    assertEquals(CrewSyncRun.Outcome.SOURCE_RESULT, b.outcome());
    assertEquals(
        CrewSourceState.MALFORMED_RESPONSE, runs.findRun(b.runId()).orElseThrow().sourceState());
    assertEquals(a.documentId(), verification.latestSuccess().orElseThrow().documentId());
    assertEquals(2, count("crew_source_document"));
    assertEquals(4, count("crew_verification_evidence"));
    assertEquals(b.runId(), verification.latestParseFailure().orElseThrow().runId());
  }

  @Test
  void deterministicResolutionUsesExistingAnchorsAndPreservesUnresolvedSpelling() {
    var ll = ll2();
    var before = runs.findSnapshot(ll.snapshotId()).orElseThrow();
    ingest();
    org.mission1.crew.LegacyCrewIdentityFixture.retainV1(jdbc, verification, now);
    var e = verification.evidenceAsOf(now);
    var resolved = verification.resolve(e, now);
    assertEquals(11, resolved.size());
    assertEquals(
        6,
        resolved.stream()
            .filter(x -> x.method() == CrewIdentityResolution.Method.EXACT_UNIQUE_NAME)
            .count());
    assertEquals(
        2,
        resolved.stream()
            .filter(x -> x.method() == CrewIdentityResolution.Method.OFFICIAL_PROFILE)
            .count());
    assertEquals(
        3,
        resolved.stream()
            .filter(x -> x.method() == CrewIdentityResolution.Method.UNRESOLVED)
            .count());
    assertEquals(9, count("crew_person"));
    assertEquals(12, count("crew_person_external_id"));
    assertEquals(7, count("crew_person_observation"));
    assertEquals(before, runs.findSnapshot(ll.snapshotId()).orElseThrow());
    var again = verification.resolve(e, now.plusSeconds(1));
    assertEquals(resolved, again);
    assertEquals(11, count("crew_identity_resolution"));
  }

  @Test
  void reconciliationRoundTripsRelationalLineageAndRetainsLl2Profiles() {
    var ll = ll2();
    ingest();
    org.mission1.crew.LegacyCrewIdentityFixture.retainV1(jdbc, verification, now);
    var run = service.reconcile();
    var stored = reconciliation.latest().orElseThrow();
    var current = service.current();
    assertEquals(run.snapshotId(), stored.id());
    assertEquals(current, stored.value());
    assertEquals(ll.snapshotId(), stored.value().primarySnapshotId());
    assertEquals(11, stored.value().officialCrewCount());
    assertEquals(6, stored.value().presentInBoth().size());
    assertEquals(2, stored.value().onlyInNasa().size());
    assertEquals(3, stored.value().unresolved().size());
    assertEquals(ReconciliationStatus.PARTIAL_MATCH, stored.value().status());
    assertEquals(3, count("crew_reconciliation_evidence"));
    assertEquals(11, count("crew_reconciliation_resolution"));
    var canonical = query.current();
    assertEquals(
        canonical.interpretation().primarySnapshotId(),
        canonical.structuredPrimary().orElseThrow().snapshot().id());
    assertEquals(3, canonical.verificationEvidence().size());
    assertEquals(11, canonical.identityResolutions().size());
    assertTrue(
        canonical.verificationEvidence().stream()
            .flatMap(x -> x.value().people().stream())
            .anyMatch(x -> x.displayName().equals("Jessica Watkins")));
  }

  @Test
  void sameInputsReuseSnapshotButNewAlgorithmKeepsAnotherHistory() {
    ll2();
    ingest();
    org.mission1.crew.LegacyCrewIdentityFixture.retainV1(jdbc, verification, now);
    var a = service.reconcile();
    var b = service.reconcile();
    assertEquals(a.snapshotId(), b.snapshotId());
    assertFalse(b.inserted());
    assertEquals(2, count("crew_reconciliation_run"));
    var policy =
        new CrewReconciliationPolicy(
            Duration.ofHours(7), Duration.ofHours(6), Duration.ofHours(72), Duration.ofDays(14));
    var different =
        new CrewReconciliationService(
                runs,
                new CrewQueryService(runs, fixture.clock),
                verification,
                reconciliation,
                policy,
                fixture.clock)
            .reconcile();
    assertNotEquals(a.snapshotId(), different.snapshotId());
    assertEquals(2, count("crew_reconciliation_snapshot"));
  }

  @Test
  void historyAndMappingsRejectMutation() {
    ll2();
    var nasa = ingest();
    service.reconcile();
    for (var t :
        List.of(
            "crew_document_body",
            "crew_source_document",
            "crew_verification_evidence",
            "crew_evidence_subject",
            "crew_document_evidence",
            "crew_identity_resolution",
            "crew_reconciliation_snapshot",
            "crew_reconciliation_evidence",
            "crew_reconciliation_resolution",
            "crew_reconciled_person",
            "crew_reconciled_person_evidence"))
      assertThrows(RuntimeException.class, () -> jdbc.update("DELETE FROM " + t));
    assertThrows(RuntimeException.class, () -> jdbc.update("DELETE FROM crew_person"));
    assertEquals(1, count("crew_source_document"));
  }

  void rejectInserts(String table) {
    jdbc.execute(
        "CREATE FUNCTION test_reject_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN"
            + " RAISE EXCEPTION 'TEST rollback'; END; $$");
    jdbc.execute(
        "CREATE TRIGGER test_failure BEFORE INSERT ON "
            + table
            + " FOR EACH ROW EXECUTE FUNCTION test_reject_write()");
  }

  void allowInserts(String table) {
    jdbc.execute("DROP TRIGGER test_failure ON " + table);
    jdbc.execute("DROP FUNCTION test_reject_write()");
  }

  @Test
  void evidenceTransactionFailureRollsBackDocumentGraphAndRecordsFailure() {
    rejectInserts("crew_evidence_subject");
    try {
      var result = ingest();
      assertEquals(CrewSyncRun.Outcome.PERSISTENCE_FAILURE, result.outcome());
      var run = runs.findRun(result.runId()).orElseThrow();
      assertEquals(CrewSourceState.AVAILABLE, run.sourceState());
      assertEquals("PERSISTENCE_FAILURE", run.errorCode());
    } finally {
      allowInserts("crew_evidence_subject");
    }
    assertEquals(0, count("crew_document_body"));
    assertEquals(0, count("crew_source_document"));
    assertEquals(0, count("crew_verification_evidence"));
    assertEquals(1, count("crew_source_sync_run"));
    assertTrue(verification.latestSuccess().isEmpty());
  }

  @Test
  void reconciliationWriteFailureKeepsPreviousCanonicalSnapshot() {
    ll2();
    ingest();
    org.mission1.crew.LegacyCrewIdentityFixture.retainV1(jdbc, verification, now);
    var a = service.reconcile();
    fixture.clock.time = now.plusSeconds(7 * 3600);
    rejectInserts("crew_reconciled_person");
    try {
      assertThrows(RuntimeException.class, service::reconcile);
    } finally {
      allowInserts("crew_reconciled_person");
    }
    assertEquals(a.snapshotId(), reconciliation.latest().orElseThrow().id());
    assertEquals("FAILURE", reconciliation.latestRun().orElseThrow().result());
    assertEquals(1, count("crew_reconciliation_snapshot"));
    assertEquals(
        1,
        jdbc.queryForObject(
            "SELECT count(*) FROM crew_reconciliation_run WHERE result_state='FAILURE'",
            Integer.class));
  }

  @Test
  void rateLimitAndNormalEligibilitySurviveCoordinatorRestart() {
    var source = mock(CrewVerificationHttpSource.class);
    when(source.fetch(any(), any(), any()))
        .thenReturn(
            fetch(
                429,
                new byte[0],
                new CrewSourceResult.Failure(
                    CrewSourceResult.FailureCode.HTTP_ERROR, 429, "10800")));
    assertEquals(CrewSyncRun.Outcome.SOURCE_RESULT, nasa(source).ingest().outcome());
    fixture.clock.time = now.plusSeconds(7200);
    assertEquals(CrewSyncRun.Outcome.SKIPPED_RATE_LIMIT, nasa(source).ingestScheduled().outcome());
    verify(source, times(1)).fetch(any(), any(), any());
    fixture.clock.time = now.plusSeconds(10800);
    when(source.fetch(any(), any(), any())).thenReturn(fetch(200, body, null));
    assertEquals(CrewSyncRun.Outcome.SUCCESS, nasa(source).ingestScheduled().outcome());
    fixture.clock.time = fixture.clock.time.plusSeconds(60);
    assertEquals(CrewSyncRun.Outcome.SKIPPED_NOT_DUE, nasa(source).ingestScheduled().outcome());
    verify(source, times(2)).fetch(any(), any(), any());
  }

  @Test
  void unavailableVerificationDegradesInterpretationWithoutErasingSources() {
    ll2();
    ingest();
    service.reconcile();
    fixture.clock.time = now.plusSeconds(1);
    nasa((u, e, l) ->
            fetch(
                500,
                new byte[0],
                new CrewSourceResult.Failure(CrewSourceResult.FailureCode.HTTP_ERROR, 500, null)))
        .ingest();
    service.reconcile();
    var s = service.current();
    assertEquals(ReconciliationStatus.VERIFICATION_UNAVAILABLE, s.status());
    assertTrue(
        s.people().stream()
            .noneMatch(p -> p.presence() == CrewReconciliationSnapshot.Presence.CONFIRMED_ABOARD));
    assertEquals(4, count("crew_verification_evidence"));
    assertEquals(7, count("crew_person_observation"));
  }

  @Test
  void queryReevaluatesFreshnessWithoutWritingHistoryOrResolvingIdentities() {
    ll2();
    ingest();
    service.reconcile();
    int audits = count("crew_identity_resolution");
    fixture.clock.time = now.plusSeconds(7 * 3600);
    assertEquals(ReconciliationStatus.STALE, service.current().status());
    assertEquals(audits, count("crew_identity_resolution"));
    assertEquals(1, count("crew_reconciliation_snapshot"));
  }

  @Test
  void overlappingFetchIsSkippedWithoutSecondNetworkRequest() throws Exception {
    var entered = new java.util.concurrent.CountDownLatch(1);
    var release = new java.util.concurrent.CountDownLatch(1);
    var requests = new java.util.concurrent.atomic.AtomicInteger();
    var ingestion =
        nasa(
            (u, e, l) -> {
              requests.incrementAndGet();
              entered.countDown();
              try {
                if (!release.await(10, java.util.concurrent.TimeUnit.SECONDS))
                  throw new IllegalStateException("TEST timeout");
              } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException(ex);
              }
              return fetch(200, body, null);
            });
    try (var executor = java.util.concurrent.Executors.newSingleThreadExecutor()) {
      var first = executor.submit(ingestion::ingest);
      assertTrue(entered.await(10, java.util.concurrent.TimeUnit.SECONDS));
      try {
        assertEquals(CrewSyncRun.Outcome.SKIPPED_OVERLAP, ingestion.ingest().outcome());
      } finally {
        release.countDown();
      }
      assertEquals(
          CrewSyncRun.Outcome.SUCCESS,
          first.get(10, java.util.concurrent.TimeUnit.SECONDS).outcome());
    }
    assertEquals(1, requests.get());
    assertEquals(2, count("crew_source_sync_run"));
    assertEquals(1, count("crew_source_document"));
  }

  @Test
  void documentWriteFailureLeavesOnlyOperationalFailureRun() {
    rejectInserts("crew_source_document");
    try {
      var result = ingest();
      assertEquals(CrewSyncRun.Outcome.PERSISTENCE_FAILURE, result.outcome());
      var run = runs.findRun(result.runId()).orElseThrow();
      assertEquals(CrewSourceState.AVAILABLE, run.sourceState());
      assertEquals("PERSISTENCE_FAILURE", run.errorCode());
    } finally {
      allowInserts("crew_source_document");
    }
    assertEquals(0, count("crew_document_body"));
    assertEquals(0, count("crew_verification_evidence"));
    assertEquals(1, count("crew_source_sync_run"));
  }

  @Test
  void identityAmbiguityIsAuditedWithoutAllocatingAnInventedPerson() {
    ll2();
    ingest();
    var original =
        jdbc.queryForMap("SELECT * FROM crew_person_observation WHERE display_name='Jessica Meir'");
    var duplicate = UUID.randomUUID();
    jdbc.update(
        "INSERT INTO crew_person(id,created_at) VALUES (?,?)",
        duplicate,
        now.atOffset(ZoneOffset.UTC));
    jdbc.update(
        "INSERT INTO crew_person_external_id(person_id,source,external_id) VALUES"
            + " (?,'LAUNCH_LIBRARY_2','TEST_DUPLICATE')",
        duplicate);
    jdbc.update(
        "INSERT INTO"
            + " crew_person_observation(snapshot_id,person_id,source,external_id,display_name,in_space,career_present,nationalities)"
            + " VALUES (?,?,'LAUNCH_LIBRARY_2',?,'Jessica Meir',true,false,'[]'::jsonb)",
        original.get("snapshot_id"),
        duplicate,
        "TEST_DUPLICATE");
    var resolution = verification.resolve(verification.evidenceAsOf(now), now);
    var ambiguous =
        resolution.stream()
            .filter(r -> r.method() == CrewIdentityResolution.Method.AMBIGUOUS)
            .toList();
    assertEquals(1, ambiguous.size());
    assertNull(ambiguous.getFirst().personId());
    assertEquals(2, ambiguous.getFirst().candidates().size());
    service.reconcile();
    assertEquals(ReconciliationStatus.AMBIGUOUS, service.current().status());
  }

  void temporalAssertion(
      CrewVerificationEvidence.Type type,
      String name,
      java.net.URI profile,
      Instant eventAt,
      CrewVerificationEvidence.Assertion assertion) {
    fixture.clock.time = fixture.clock.time.plusSeconds(1);
    byte[] raw =
        ("TEST_ONLY temporal " + type + eventAt + assertion).getBytes(StandardCharsets.UTF_8);
    var observation =
        new CrewSourceObservation(
            CrewSource.NASA_OFFICIAL,
            NasaOperationalFeedHttpSource.URL,
            fixture.clock.time,
            fixture.clock.time,
            eventAt,
            null,
            null,
            CrewHttpReader.sha256(raw),
            "TEST_ONLY",
            "TestOnlyTemporalParser/1");
    var doc = new CrewSourceDocument(NasaSourceType.NASA_ISS_OPERATIONAL_FEED, observation, raw);
    var evidence =
        new CrewVerificationEvidence(
            type,
            Station.ISS,
            List.of(new PersonReference(null, name, List.of(), profile)),
            null,
            NasaSourceType.NASA_ISS_OPERATIONAL_POST,
            observation,
            "TEST_ONLY named temporal assertion",
            "TestOnlyTemporalParser/1",
            CrewVerificationEvidence.Completeness.PARTIAL,
            assertion);
    long run =
        runs.startRun(
            CrewSource.NASA_OFFICIAL,
            Station.ISS,
            fixture.clock.time,
            NasaOperationalFeedHttpSource.URL);
    verification.storeFetch(
        run,
        doc,
        200,
        "application/rss+xml",
        "TestOnlyTemporalParser",
        "1",
        List.of(evidence),
        true,
        fixture.clock.time);
  }

  @Test
  void persistedLateOldArrivalCannotRewindCompletedDepartureAndPlansRemainInert() {
    ll2();
    ingest();
    service.reconcile();
    var id =
        jdbc.queryForObject(
            "SELECT person_id FROM crew_person_external_id WHERE source='NASA_OFFICIAL'"
                + " AND external_id='profile:jessica-u-meir'",
            UUID.class);
    var profile = java.net.URI.create("https://www.nasa.gov/people/jessica-u-meir/");
    temporalAssertion(
        CrewVerificationEvidence.Type.PERSON_DEPARTED_STATION,
        "Jessica Meir",
        profile,
        now.minusSeconds(300),
        CrewVerificationEvidence.Assertion.COMPLETED);
    service.reconcile();
    temporalAssertion(
        CrewVerificationEvidence.Type.PERSON_ENTERED_STATION,
        "Jessica Meir",
        profile,
        now.minusSeconds(600),
        CrewVerificationEvidence.Assertion.COMPLETED);
    service.reconcile();
    temporalAssertion(
        CrewVerificationEvidence.Type.PERSON_ENTERED_STATION,
        "Jessica Meir",
        profile,
        now.plusSeconds(86400),
        CrewVerificationEvidence.Assertion.PLANNED);
    service.reconcile();
    var state =
        service.current().people().stream()
            .filter(x -> x.personId().equals(id))
            .findFirst()
            .orElseThrow();
    assertEquals(CrewReconciliationSnapshot.Presence.CONFIRMED_NOT_ABOARD, state.presence());
    assertEquals(now.minusSeconds(300), state.assertionAsOf());
    assertNull(service.current().officialCrewCount());
    assertEquals(4, count("crew_source_document"));
    assertEquals(7, count("crew_verification_evidence"));
  }

  @Test
  void resolverFollowsSuccessfulAtoBtoAInsteadOfSnapshotInsertionOrder() throws Exception {
    ll2();
    ingest();
    var evidence = verification.evidenceAsOf(now);
    var item =
        evidence.stream()
            .filter(
                e ->
                    e.value().people().stream()
                        .anyMatch(p -> p.displayName().equals("Sophie Adenot")))
            .findFirst()
            .orElseThrow();
    int subject =
        java.util.stream.IntStream.range(0, item.value().people().size())
            .filter(i -> item.value().people().get(i).displayName().equals("Sophie Adenot"))
            .findFirst()
            .orElseThrow();
    var a =
        verification.resolve(evidence, now).stream()
            .filter(r -> r.evidenceId() == item.id() && r.subjectIndex() == subject)
            .findFirst()
            .orElseThrow();
    assertEquals(1, a.candidates().size());
    assertNull(a.personId());
    String original = fixture.body;
    fixture.body = original.replace("Sophie Adenot", "TEST_ONLY Changed Metadata");
    fixture.clock.time = now.plusSeconds(1);
    ll2();
    var b =
        verification.resolve(evidence, fixture.clock.time).stream()
            .filter(r -> r.evidenceId() == item.id() && r.subjectIndex() == subject)
            .findFirst()
            .orElseThrow();
    assertTrue(b.candidates().isEmpty());
    fixture.body = original;
    fixture.clock.time = now.plusSeconds(2);
    ll2();
    var again =
        verification.resolve(evidence, fixture.clock.time).stream()
            .filter(r -> r.evidenceId() == item.id() && r.subjectIndex() == subject)
            .findFirst()
            .orElseThrow();
    assertEquals(a.candidates(), again.candidates());
    assertNotEquals(a.id(), again.id());
    assertEquals(
        again,
        verification.resolutionsAsOf(fixture.clock.time).stream()
            .filter(r -> r.evidenceId() == item.id() && r.subjectIndex() == subject)
            .findFirst()
            .orElseThrow());
  }
}
