package org.mission1.crew.application;

import static org.junit.jupiter.api.Assertions.*;
import java.net.URI;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mission1.crew.domain.*;
import org.mission1.source.crew.CrewHttpReader;
import org.mission1.source.crew.nasa.*;

class CrewSourceOccurrenceTest {
    final CrewOccurrencePlanner planner = new CrewOccurrencePlanner();
    final CrewCompatibleVersionSelector selector = new CrewCompatibleVersionSelector();
    final Instant oldAt = Instant.parse("2026-10-03T11:45:46.137144Z");
    final Instant newAt = Instant.parse("2026-10-06T21:27:06.770331Z");
    CrewSourceDocument document(String fixture, Instant at) throws Exception {
        var bytes = getClass().getResourceAsStream("/fixtures/crew/nasa/occurrences/"+fixture).readAllBytes();
        return new CrewSourceDocument(NasaSourceType.NASA_ISS_OPERATIONAL_FEED,
                new CrewSourceObservation(CrewSource.NASA_OFFICIAL,NasaOperationalFeedHttpSource.URL,at,null,null,null,null,
                        CrewHttpReader.sha256(bytes),"NASA_RSS","NasaOperationalFeedParser/1.0.0"),bytes);
    }
    CrewOccurrencePlanner.Input input(String fixture,long id,Instant at) throws Exception {
        var doc=document(fixture,at);
        var e=new NasaOperationalFeedParser().verify(doc).value().stream()
                .filter(x->x.type()==CrewVerificationEvidence.Type.PERSON_CURRENTLY_ABOARD).findFirst().orElseThrow();
        var article=new NasaCrewArticleReader().read(doc).stream().filter(a->a.stableKey().endsWith(":1052022")).findFirst().orElseThrow();
        return new CrewOccurrencePlanner.Input(new CrewVerificationRepository.Evidence(id,id,e),
                CrewOccurrenceFingerprint.hash(List.of(fixture,id)),"NasaOperationalFeedParser","1.0.0",
                List.of(new CrewOccurrencePlanner.Locator(id,article,1)),
                List.of(new CrewOccurrenceVersion.Observation(id,id,at,at,at)));
    }
    CrewOccurrencePlanner.Input change(CrewOccurrencePlanner.Input base,CrewVerificationEvidence e,
            String parserVersion,List<CrewOccurrencePlanner.Locator> locators) {
        return new CrewOccurrencePlanner.Input(new CrewVerificationRepository.Evidence(base.evidence().id(),base.evidence().documentId(),e),
                base.evidenceHash(),base.parserName(),parserVersion,locators,base.observations());
    }
    CrewVerificationEvidence evidence(CrewVerificationEvidence old,List<PersonReference> people,
            CrewVerificationEvidence.Type type,String text,Instant event,URI url) {
        var o=old.observation();
        return new CrewVerificationEvidence(type,old.station(),people,old.crewCount(),old.sourceType(),
                new CrewSourceObservation(o.source(),url,o.retrievedAt(),o.sourcePublishedAt(),event,o.httpEtag(),o.httpLastModified(),
                        o.contentHash(),o.sourceVersion(),o.adapterVersion()),text,old.evidenceMethod(),old.completeness(),old.assertion());
    }
    List<CrewOccurrenceVersion> versions(CrewOccurrencePlanner.Report report) {
        return report.associations().stream().map(a->new CrewOccurrenceVersion(a.occurrenceKey(),a.input().evidence().id(),
                a.input().evidenceHash(),a.input().observations())).toList();
    }
    @Test void knownMetadataRevisionKeepsOneAssertionSevenMentionsAndEightOwnPayloadVersions() throws Exception {
        var a=input("old.xml",4,oldAt);var b=input("new.xml",12,newAt);
        var report=planner.plan(List.of(a,b),Map.of());
        assertEquals(1,report.assertionOccurrences());assertEquals(7,report.subjectOccurrences());
        assertEquals(8,report.subjectPayloadVersions());assertEquals(1,report.multiVersionOccurrences());
        assertEquals(0,report.conflicts());assertEquals(0,report.unassociatedVersions());
        assertEquals("c4b5613f2a908347bd4e093881cfb1e30c10c5e132974a8acc24ed8ec20f0532",
                report.associations().getFirst().candidateKey());
        var selected=selector.select(List.of(a.evidence(),b.evidence()),versions(report));
        assertEquals(List.of(12L),selected.evidence().stream().map(CrewVerificationRepository.Evidence::id).toList());
        assertNull(selected.evidence().getFirst().value().people().getFirst().officialProfileUrl());
        assertEquals(List.of(4L,12L),selected.choices().getFirst().retainedEvidenceIds());
        var fed=selected.evidence().getFirst().value().people().get(6);
        var person=new PersonReference(UUID.randomUUID(),"Andrei Fedyaev",List.of(new ExternalId(CrewSource.LAUNCH_LIBRARY_2,"732")),null);
        assertEquals(CrewIdentityResolution.Method.UNRESOLVED,new CrewPersonResolver().resolve(fed,List.of(person),Map.of()).method());
    }
    @Test void reversedInputsHaveIdenticalAssociationAndSelection() throws Exception {
        var a=input("old.xml",4,oldAt);var b=input("new.xml",12,newAt);
        var x=planner.plan(List.of(a,b),Map.of());var y=planner.plan(List.of(b,a),Map.of());assertEquals(x,y);
        assertEquals(selector.select(List.of(a.evidence(),b.evidence()),versions(x)),selector.select(List.of(b.evidence(),a.evidence()),versions(y)));
    }
    @Test void aToBToASelectsLowerEvidenceIdByLatestCapture() throws Exception {
        var a=input("old.xml",4,oldAt);var b=input("new.xml",12,newAt);
        a=new CrewOccurrencePlanner.Input(a.evidence(),a.evidenceHash(),a.parserName(),a.parserVersion(),a.locators(),
                List.of(a.observations().getFirst(),new CrewOccurrenceVersion.Observation(99,4,newAt.plusSeconds(1),newAt.plusSeconds(1),newAt.plusSeconds(1))));
        var r=planner.plan(List.of(a,b),Map.of());
        assertEquals(4,selector.select(List.of(a.evidence(),b.evidence()),versions(r)).evidence().getFirst().id());
    }
    @Test void wrapperChangeDoesNotChangeClaimIdentity() throws Exception {
        var a=input("old.xml",4,oldAt);var b=input("old-wrapper.xml",8,newAt);
        var r=planner.plan(List.of(a,b),Map.of());assertEquals(1,r.assertionOccurrences());assertEquals(7,r.subjectPayloadVersions());
    }
    @Test void metadataAdditionAndRemovalSelectNewestWithoutCarryingOldUrl() throws Exception {
        var a=input("new.xml",4,oldAt);var b=input("old.xml",12,newAt);
        var r=planner.plan(List.of(a,b),Map.of());
        assertNotNull(selector.select(List.of(a.evidence(),b.evidence()),versions(r)).evidence().getFirst().value().people().getFirst().officialProfileUrl());
        var removed=input("new.xml",13,newAt.plusSeconds(1));r=planner.plan(List.of(a,b,removed),Map.of());
        assertNull(selector.select(List.of(a.evidence(),b.evidence(),removed.evidence()),versions(r)).evidence().getFirst().value().people().getFirst().officialProfileUrl());
    }
    @ParameterizedTest @ValueSource(strings={"order","article","text","time","departure","parser","cyrillic"})
    void semanticOrInterpretationChangesRemainSeparate(String change) throws Exception {
        var a=input("old.xml",4,oldAt);var b=input("new.xml",12,newAt);var e=b.evidence().value();
        var people=new ArrayList<>(e.people());String text=e.supportingExcerpt();Instant event=e.observation().sourceEventAt();
        var type=e.type();String parserVersion=b.parserVersion();var locators=b.locators();
        switch(change){
            case "order" -> Collections.swap(people,0,1);
            case "article" -> {var old=locators.getFirst().article();var article=new CrewSourceArticle("nasa.gov:wp:nasa-blog:999999",old.rawGuid(),old.rawUrl(),old.observedUrl(),old.publishedAt(),old.representationHash(),old.paragraphs());locators=List.of(new CrewOccurrencePlanner.Locator(12,article,1));}
            case "text" -> text+=" TEST_ONLY distinct clause";
            case "time" -> event=e.observation().sourcePublishedAt().plusSeconds(1);
            case "departure" -> type=CrewVerificationEvidence.Type.PERSON_DEPARTED_STATION;
            case "parser" -> parserVersion="2.0.0";
            case "cyrillic" -> {var p=people.get(6);people.set(6,new PersonReference(null,"Андрей Федяев",p.externalIds(),null));}
        }
        b=change(b,evidence(e,people,type,text,event,e.observation().sourceUrl()),parserVersion,locators);
        assertEquals(2,planner.plan(List.of(a,b),Map.of()).assertionOccurrences());
    }
    @Test void differentStrongSubjectKeysDoNotMergeAndNullDoesNotBridgeThem() throws Exception {
        var a=input("old.xml",4,oldAt);var b=input("new.xml",12,newAt);
        var p=new ArrayList<>(b.evidence().value().people());var old=p.get(0);
        p.set(0,new PersonReference(null,old.displayName(),List.of(),URI.create("https://www.nasa.gov/people/test-only-different-human/")));
        b=change(b,evidence(b.evidence().value(),p,b.evidence().value().type(),b.evidence().value().supportingExcerpt(),null,b.evidence().value().observation().sourceUrl()),b.parserVersion(),b.locators());
        var empty=input("new.xml",13,newAt.plusSeconds(1));var r=planner.plan(List.of(a,b,empty),Map.of());
        assertEquals(3,r.assertionOccurrences());assertEquals(3,r.conflicts());
    }
    @Test void repeatedIdenticalRawScopeAndMissingArticleIdNeverAssociate() throws Exception {
        var a=input("old.xml",4,oldAt);var b=input("new.xml",12,newAt);
        b=change(b,b.evidence().value(),b.parserVersion(),List.of(b.locators().getFirst(),b.locators().getFirst()));
        var r=planner.plan(List.of(a,b),Map.of());assertEquals(2,r.assertionOccurrences());assertEquals(1,r.unassociatedVersions());
        assertNull(NasaCrewArticleReader.stableKey("https://www.nasa.gov/blogs/test-only/"));
    }
    @Test void routeChangeKeepsVerifiedArticleIdentity() throws Exception {
        var a=input("old.xml",4,oldAt);var b=input("new.xml",12,newAt);
        b=change(b,evidence(b.evidence().value(),b.evidence().value().people(),b.evidence().value().type(),b.evidence().value().supportingExcerpt(),null,
                URI.create("https://www.nasa.gov/blogs/commercialcrew/test-only-route/")),b.parserVersion(),b.locators());
        assertEquals(1,planner.plan(List.of(a,b),Map.of()).assertionOccurrences());
    }
    @Test void unknownSuccessfulLineageAndEqualCaptureTiesNeverUseDatabaseId() throws Exception {
        var a=input("old.xml",4,oldAt);var b=input("new.xml",12,oldAt);var r=planner.plan(List.of(a,b),Map.of());
        var selection=selector.select(List.of(a.evidence(),b.evidence()),versions(r));
        assertEquals(2,r.assertionOccurrences());assertEquals(2,r.ambiguousAssociations());
        assertEquals(2,selection.evidence().size());
        assertEquals(2,selector.select(List.of(a.evidence(),b.evidence()),List.of()).evidence().size());
    }
    @Test void restartUsesImmutableMembershipAndDoesNotRewriteItWhenConflictArrives() throws Exception {
        var a=input("old.xml",4,oldAt);var b=input("new.xml",12,newAt);var r=planner.plan(List.of(a,b),Map.of());
        var membership=new HashMap<Long,String>();r.associations().forEach(x->membership.put(x.input().evidence().id(),x.occurrenceKey()));
        assertEquals(r,planner.plan(List.of(b,a),membership));
        assertEquals(selector.select(List.of(a.evidence(),b.evidence()),versions(r)),new CrewCompatibleVersionSelector().select(List.of(b.evidence(),a.evidence()),versions(r)));
    }
    @Test void strongExternalIdConflictsPreventAssociationEvenWithEqualNames() throws Exception {
        var a=input("old.xml",4,oldAt);var b=input("new.xml",12,newAt);
        var pairs=new ArrayList<CrewOccurrencePlanner.Input>();
        for(var input:List.of(a,b)) {
            var e=input.evidence().value();var p=new ArrayList<>(e.people());var person=p.get(6);
            p.set(6,new PersonReference(null,person.displayName(),List.of(new ExternalId(CrewSource.NASA_OFFICIAL,
                    input.evidence().id()==4?"TEST_ONLY_A":"TEST_ONLY_B")),null));
            pairs.add(change(input,evidence(e,p,e.type(),e.supportingExcerpt(),null,e.observation().sourceUrl()),input.parserVersion(),input.locators()));
        }
        var r=planner.plan(pairs,Map.of());assertEquals(2,r.assertionOccurrences());assertEquals(2,r.conflicts());
    }
    @Test void arrivalAndDepartureRemainDistinctTypedSourceOccurrences() throws Exception {
        var a=input("old.xml",4,oldAt);var b=input("new.xml",12,newAt);
        var ea=a.evidence().value();var eb=b.evidence().value();
        a=change(a,evidence(ea,ea.people(),CrewVerificationEvidence.Type.PERSON_ENTERED_STATION,ea.supportingExcerpt(),null,ea.observation().sourceUrl()),a.parserVersion(),a.locators());
        b=change(b,evidence(eb,eb.people(),CrewVerificationEvidence.Type.PERSON_DEPARTED_STATION,eb.supportingExcerpt(),null,eb.observation().sourceUrl()),b.parserVersion(),b.locators());
        assertEquals(2,planner.plan(List.of(a,b),Map.of()).assertionOccurrences());
    }
    @Test void observationOrderReversalKeepsTheSameSelectionAndLineageRepresentative() throws Exception {
        var a=input("old.xml",4,oldAt);var b=input("new.xml",12,newAt);var report=planner.plan(List.of(a,b),Map.of());
        var values=new ArrayList<>(versions(report));var target=values.stream().filter(x->x.evidenceId()==12).findFirst().orElseThrow();
        var o=target.observations().getFirst();var duplicate=new CrewOccurrenceVersion.Observation(100,12,o.retrievedAt(),o.startedAt(),o.completedAt());
        values.remove(target);values.add(new CrewOccurrenceVersion(target.occurrenceKey(),12,target.evidenceHash(),List.of(o,duplicate)));
        var first=selector.select(List.of(a.evidence(),b.evidence()),values);
        values.remove(values.getLast());values.add(new CrewOccurrenceVersion(target.occurrenceKey(),12,target.evidenceHash(),List.of(duplicate,o)));
        Collections.reverse(values);assertEquals(first,selector.select(List.of(b.evidence(),a.evidence()),values));
    }

}
