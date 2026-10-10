package org.mission1.crew.persistence;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.mission1.crew.application.*;
import org.mission1.crew.domain.*;
import org.mission1.source.crew.nasa.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.test.context.*;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;

import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;

@SpringBootTest
@Testcontainers
class JdbcCrewOccurrenceRepositoryTest {
    @Container static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16.10")
            .withDatabaseName("occurrence_test").withUsername("mission1_test").withPassword("test_only");
    @DynamicPropertySource static void database(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url",POSTGRES::getJdbcUrl);r.add("spring.datasource.username",POSTGRES::getUsername);r.add("spring.datasource.password",POSTGRES::getPassword);
    }
    @Autowired CrewVerificationRepository verification;
    @Autowired CrewRepository runs;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    static final Instant OLD = Instant.parse("2026-10-03T11:45:46.137144Z"), NEW = Instant.parse("2026-10-06T21:27:06.770331Z");
    static final List<String> NEW_TABLES = List.of("crew_source_article","crew_source_article_observation","crew_assertion_occurrence",
            "crew_assertion_version","crew_assertion_observation","crew_subject_occurrence","crew_subject_metadata_version","crew_subject_version_link");
    @BeforeEach void clear() {
        jdbc.execute("TRUNCATE "+String.join(",",NEW_TABLES)+",crew_source_sync_run,crew_source_snapshot,crew_person,crew_expedition,crew_document_body"
                        + " RESTART IDENTITY CASCADE");
    }
    byte[] fixture(String file) throws Exception { return getClass().getResourceAsStream("/fixtures/crew/nasa/occurrences/"+file).readAllBytes(); }
    NasaCrewVerificationIngestionService.Result ingest(String file,Instant at) throws Exception {
        byte[] body=fixture(file);
        var source=(CrewVerificationHttpSource)(u,e,l)->new CrewVerificationHttpSource.Fetch(body,null,200,"application/rss+xml","TEST_ONLY",null,at);
        return new NasaCrewVerificationIngestionService(source,new NasaOperationalFeedParser(),verification,runs,
                new CrewIngestionPolicy(Duration.ofHours(2),Duration.ofMinutes(10)),Clock.fixed(at,ZoneOffset.UTC),NasaOperationalFeedHttpSource.URL,
                NasaOperationalFeedParser.NAME,NasaOperationalFeedParser.VERSION).ingest();
    }
    void populate() throws Exception {
        assertEquals(CrewSyncRun.Outcome.SUCCESS,ingest("old.xml",OLD).outcome());
        assertEquals(CrewSyncRun.Outcome.SUCCESS,ingest("old-wrapper.xml",OLD.plusSeconds(1)).outcome());
        assertEquals(CrewSyncRun.Outcome.SUCCESS,ingest("new.xml",NEW).outcome());
    }
    int count(String table) { return jdbc.queryForObject("SELECT count(*) FROM "+table,Integer.class); }
    Map<String,List<Map<String,Object>>> history() {
        var result=new TreeMap<String,List<Map<String,Object>>>();
        for(var t:List.of("crew_verification_evidence","crew_evidence_subject","crew_document_evidence"))
            result.put(t,jdbc.queryForList("SELECT * FROM "+t+" ORDER BY 1,2"));
        return result;
    }
    @Test void completeRetainedProjectionMatchesInvestigationAndKeepsOldRows() throws Exception {
        populate();var before=history();var report=verification.previewOccurrenceAssociations();
        assertEquals(5,report.evidenceVersions());assertEquals(4,report.assertionOccurrences());assertEquals(11,report.subjectOccurrences());
        assertEquals(12,report.subjectPayloadVersions());assertEquals(1,report.multiVersionOccurrences());
        assertEquals(0,report.unassociatedVersions());assertEquals(0,report.conflicts());
        assertEquals(5,count("crew_assertion_version"));assertEquals(18,count("crew_subject_version_link"));assertEquals(12,count("crew_subject_metadata_version"));
        assertEquals(verification.associateRetainedOccurrences(),verification.associateRetainedOccurrences());
        assertEquals(before,history());
        assertEquals("b7c92446ed126b53d52b37dccdcf16ada88b89c16552caefb71a6fab6f7b77cf",jdbc.queryForObject("SELECT evidence_hash FROM crew_verification_evidence WHERE id=4",String.class));
        assertEquals("2e66ce03f3a9b2e00b0ed1b11086de2e633dad3cd696612c174f9af67026c4a8",jdbc.queryForObject("SELECT evidence_hash FROM crew_verification_evidence WHERE id=12",String.class));
        assertEquals(1,jdbc.queryForObject("SELECT count(DISTINCT occurrence_key) FROM crew_assertion_version WHERE"
                            + " evidence_id IN (4,12)",Integer.class));
        assertEquals(1,jdbc.queryForObject("SELECT count(DISTINCT subject_key) FROM crew_subject_version_link WHERE"
                            + " evidence_id IN (4,12) AND subject_index=6",Integer.class));
    }
    @Test void duplicateIngestionAndBackfillAreIdempotent() throws Exception {
        populate();var before=history();var counts=new TreeMap<String,Integer>();NEW_TABLES.forEach(t->counts.put(t,count(t)));
        ingest("new.xml",NEW.plusSeconds(1));verification.associateRetainedOccurrences();
        assertEquals(before,history());counts.forEach((t,n)->assertEquals(n,count(t),t));
    }
    @Test void capturedOrderingSurvivesAtoBtoAAndRestart() throws Exception {
        populate();var selector=new CrewCompatibleVersionSelector();
        var initial=selector.select(verification.evidenceAsOf(NEW),verification.occurrenceVersionsAsOf(NEW));
        assertTrue(initial.evidence().stream().anyMatch(e->e.id()==12));assertFalse(initial.evidence().stream().anyMatch(e->e.id()==4));
        ingest("old.xml",NEW.plusSeconds(1));
        var restarted=new JdbcCrewVerificationRepository(jdbc,json);
        var after=selector.select(restarted.evidenceAsOf(NEW.plusSeconds(2)),restarted.occurrenceVersionsAsOf(NEW.plusSeconds(2)));
        assertTrue(after.evidence().stream().anyMatch(e->e.id()==4));assertFalse(after.evidence().stream().anyMatch(e->e.id()==12));
        assertEquals(after,selector.select(verification.evidenceAsOf(NEW.plusSeconds(2)),verification.occurrenceVersionsAsOf(NEW.plusSeconds(2))));
    }
    @Test void successful304SupportsExistingRepresentationWithoutNewVersions() throws Exception {
        populate();var before=history();Instant at=NEW.plusSeconds(1);
        var old=verification.latestDocument(NasaOperationalFeedHttpSource.URL,NasaOperationalFeedParser.NAME,NasaOperationalFeedParser.VERSION).orElseThrow();
        long run=runs.startRun(CrewSource.NASA_OFFICIAL,Station.ISS,at,NasaOperationalFeedHttpSource.URL);
        verification.storeNotModified(run,old,at,at);
        var choice=new CrewCompatibleVersionSelector().select(verification.evidenceAsOf(at),verification.occurrenceVersionsAsOf(at)).choices().stream()
                .filter(c->c.retainedEvidenceIds().contains(12L)).findFirst().orElseThrow();
        assertEquals(at,choice.latestObservation().retrievedAt());assertEquals(12L,choice.selectedEvidenceIds().getFirst());assertEquals(before,history());
    }
    @Test void structuralConstraintsAndImmutableTriggersRejectContradictoryLinks() throws Exception {
        populate();
        for(var table:NEW_TABLES)assertThrows(RuntimeException.class,()->jdbc.update("DELETE FROM "+table),table);
        String occurrence=jdbc.queryForObject("SELECT occurrence_key FROM crew_assertion_version WHERE evidence_id=4",String.class);
        String other=jdbc.queryForObject("SELECT occurrence_key FROM crew_assertion_version WHERE evidence_id=2",String.class);
        assertThrows(RuntimeException.class,()->jdbc.update("INSERT INTO crew_assertion_version VALUES (4,?)",other));
        assertThrows(RuntimeException.class,()->jdbc.update("UPDATE crew_assertion_version SET occurrence_key=? WHERE"
                                    + " evidence_id=4",other));
        String subject=jdbc.queryForObject("SELECT subject_key FROM crew_subject_version_link WHERE evidence_id=2 AND"
                            + " subject_index=0",String.class);
        String version=jdbc.queryForObject("SELECT version_key FROM crew_subject_version_link WHERE evidence_id=2 AND"
                            + " subject_index=0",String.class);
        assertThrows(RuntimeException.class,()->jdbc.update("INSERT INTO crew_subject_version_link VALUES (4,6,?,?,?)",occurrence,subject,version));
        assertThrows(RuntimeException.class,()->jdbc.update("INSERT INTO crew_assertion_observation VALUES"
                                    + " (4,1,?,'nasa.gov:wp:nasa-blog:1053190',0)",occurrence));
    }
    @Test void sourceArticleKeepsRawGuidUrlsAndRepresentationSeparately() throws Exception {
        populate();var rows=jdbc.queryForList("SELECT * FROM crew_source_article_observation WHERE"
                            + " article_key='nasa.gov:wp:nasa-blog:1052022' ORDER BY document_id");
        assertEquals(3,rows.size());assertEquals("https://www.nasa.gov/?post_type=nasa-blog&p=1052022",rows.getFirst().get("raw_guid"));
        assertEquals(rows.getFirst().get("raw_url"),rows.getFirst().get("observed_url"));
        assertNotEquals(rows.getFirst().get("representation_hash"),rows.getLast().get("representation_hash"));
    }
    @Test void dryRunOnV5ThenAdditiveUpgradeAndBackfillPreserveLegacyData() throws Exception {
        populate();
        var v5=Flyway.configure().dataSource(POSTGRES.getJdbcUrl(),POSTGRES.getUsername(),POSTGRES.getPassword()).schemas("occurrence_legacy").target("5").load();
        v5.migrate();
        for(var t:List.of("crew_document_body","crew_source_document","crew_verification_evidence","crew_evidence_subject","crew_document_evidence","crew_source_sync_run"))
            jdbc.update("INSERT INTO occurrence_legacy."+t+" SELECT * FROM public."+t);
        try(var ds=new SingleConnectionDataSource(POSTGRES.getJdbcUrl(),POSTGRES.getUsername(),POSTGRES.getPassword(),true)) {
            ds.getConnection().createStatement().execute("SET search_path TO occurrence_legacy");
            var local=new JdbcTemplate(ds);var repository=new JdbcCrewVerificationRepository(local,json);
            var before=local.queryForList("SELECT * FROM crew_verification_evidence ORDER BY id");
            var plan=repository.previewOccurrenceAssociations();assertEquals(4,plan.assertionOccurrences());assertEquals(11,plan.subjectOccurrences());
            assertFalse(local.queryForObject("SELECT to_regclass('crew_assertion_version') IS NOT NULL",Boolean.class));
            var latest=Flyway.configure().dataSource(POSTGRES.getJdbcUrl(),POSTGRES.getUsername(),POSTGRES.getPassword()).schemas("occurrence_legacy").load();
            assertEquals(5,latest.migrate().migrationsExecuted);latest.validate();
            var applied=repository.associateRetainedOccurrences();assertEquals(plan,applied);
            assertEquals(before,local.queryForList("SELECT * FROM crew_verification_evidence ORDER BY id"));
            assertEquals(5,local.queryForObject("SELECT count(*) FROM crew_assertion_version",Integer.class));
            assertEquals(12,local.queryForObject("SELECT count(*) FROM crew_subject_metadata_version",Integer.class));
        }
    }
    @Test void failedAssociationInsertRollsBackEntireIngestAndLeavesPriorState() throws Exception {
        ingest("old.xml",OLD);var before=history();
        jdbc.execute("CREATE FUNCTION test_occurrence_reject() RETURNS trigger LANGUAGE plpgsql AS $$"
                    + " BEGIN RAISE EXCEPTION 'TEST_ONLY'; END; $$");
        jdbc.execute("CREATE TRIGGER test_reject_occurrence BEFORE INSERT ON crew_subject_version_link"
                    + " FOR EACH ROW EXECUTE FUNCTION test_occurrence_reject()");
        try { assertEquals(CrewSyncRun.Outcome.PERSISTENCE_FAILURE,ingest("new.xml",NEW).outcome()); }
        finally { jdbc.execute("DROP TRIGGER test_reject_occurrence ON crew_subject_version_link");jdbc.execute("DROP FUNCTION test_occurrence_reject()"); }
        assertEquals(before,history());assertEquals(1,count("crew_source_document"));assertEquals(4,count("crew_assertion_version"));
        assertEquals(OLD,verification.latestSuccess().orElseThrow().fetchedAt());
    }
    @Test void unsupportedLegacyScopeAndParserRemainIndependent() throws Exception {
        var bytes=fixture("old.xml");String changed=new String(bytes,StandardCharsets.UTF_8).replace("p=1052022","p=999999");
        var at=NEW.plusSeconds(1);var raw=changed.getBytes(StandardCharsets.UTF_8);
        var source=(CrewVerificationHttpSource)(u,e,l)->new CrewVerificationHttpSource.Fetch(raw,null,200,"application/rss+xml",null,null,at);
        populate();
        var result=new NasaCrewVerificationIngestionService(source,new NasaOperationalFeedParser(),verification,runs,
                new CrewIngestionPolicy(Duration.ofHours(2),Duration.ofMinutes(10)),Clock.fixed(at,ZoneOffset.UTC),NasaOperationalFeedHttpSource.URL,
                NasaOperationalFeedParser.NAME,"2.0.0").ingest();
        assertEquals(CrewSyncRun.Outcome.SUCCESS,result.outcome());
        assertTrue(verification.previewOccurrenceAssociations().unassociatedVersions()>0);
    }
    @Test void timestampMissingLegacyVersionRemainsUnassociatedWithoutInventingPublication() throws Exception {
        var bytes=fixture("old.xml");var at=OLD;
        var text=new String(bytes,StandardCharsets.UTF_8).replace("</channel>","<testOnlyLegacy>true</testOnlyLegacy></channel>");
        bytes=text.getBytes(StandardCharsets.UTF_8);
        var hash=org.mission1.source.crew.CrewHttpReader.sha256(bytes);
        var original=new CrewSourceDocument(NasaSourceType.NASA_ISS_OPERATIONAL_FEED,
                new CrewSourceObservation(CrewSource.NASA_OFFICIAL,NasaOperationalFeedHttpSource.URL,at,null,null,null,null,hash,"NASA_RSS","NasaOperationalFeedParser/1.0.0"),bytes);
        var parsed=new NasaOperationalFeedParser().verify(original).value().getLast();var o=parsed.observation();
        var legacy=new CrewVerificationEvidence(parsed.type(),parsed.station(),parsed.people(),parsed.crewCount(),parsed.sourceType(),
                new CrewSourceObservation(o.source(),o.sourceUrl(),at,null,null,null,null,hash,o.sourceVersion(),o.adapterVersion()),
                parsed.supportingExcerpt(),parsed.evidenceMethod(),parsed.completeness(),parsed.assertion());
        long run=runs.startRun(CrewSource.NASA_OFFICIAL,Station.ISS,at,NasaOperationalFeedHttpSource.URL);
        verification.storeFetch(run,original,200,"application/rss+xml",NasaOperationalFeedParser.NAME,NasaOperationalFeedParser.VERSION,List.of(legacy),true,at);
        var report=verification.previewOccurrenceAssociations();assertEquals(1,report.evidenceVersions());assertEquals(1,report.unassociatedVersions());
        assertNull(jdbc.queryForObject("SELECT source_published_at FROM crew_verification_evidence",java.sql.Timestamp.class));
        assertTrue(verification.evidenceAsOf(at).isEmpty());assertEquals(1,count("crew_assertion_version"));
    }

}
