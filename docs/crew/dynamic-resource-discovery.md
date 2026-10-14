# Source-directed future Crew resource discovery — 2026-10-13

Operational Subject Binding's five default locators remain useful reference seeds. Future Crew coverage
now also follows normal retained source refreshes; no new numbered mission entry
or application redeploy is needed. [ADR-0022](../adr/0022-durable-gp-eligibility-and-source-directed-resource-discovery.md)
records the decision. This extends discovery, not identity authority.

## Production chain

1. Normal LL2 acquisition validates/persists the active ISS expedition, assignments,
   source person IDs, biography and agency metadata. Operational Subject Binding reads the latest successful
   observation for each retained provider ID, including outgoing targets; context
   older than seven days does not generate new structured candidates.
2. Source Crew mission tokens and Expedition identifiers generate bounded official
   NASA URL candidates. Fresh Crew Resource Acquisition roster relations also supply observed/verified official personal links;
   rejected relations are excluded. Compatible operational subjects and validated, available
   provider detail resources can also supply mission context. Provider details
   retain person-specific flight/landing relations. Person names are never slugged
   into URLs or used as identity crosswalks.
3. The existing durable resource queue deduplicates by exact requested URL. HTTP
   acquisition uses the existing host budget, NASA shared gate, public-address
   checks, same-host checked redirects, timeouts and body/header limits. Each
   five-minute acquisition execution claims at most one resource.
4. Mission HTML advertises a typed NASA mission resource; official mission or
   Expedition content may also advertise personal resources on already allowlisted
   agency paths. Navigation, author/credit and caption links are excluded. No
   mission-to-mission traversal or arbitrary website crawl is performed. Crew Resource Acquisition keeps
   ownership of typed Expedition roster semantics; Operational Subject Binding acquires that page's bounded
   personal links without manufacturing a named Crew roster from it.
5. Only normal validated captures enter the retained resource/version/attempt
   graph. Their exact URL, final URL/redirects, original bytes/hash, capture/validation
   instants and parsed facts remain pinned. `s10-official-resources-v2` versions the
   additional discovery links; retained v1 resources remain readable. Existing Crew Resource Acquisition
   personal captures are reused in place.
6. Unchanged Operational Subject Binding qualification and scoring decide MATCH/DEFER/CONFLICT. A URL,
   HTTP 200, name, mission token or source assignment alone is insufficient.

Source inserts already notify the durable Operational Subject Binding worker. Periodic evaluation rereads
later snapshots and resources, so new astronauts, expeditions and same-person
mission changes are evaluated after acquisition. A changed Crew Resource Acquisition relation queues its
new link without waiting for cached Expedition HTML to expire. Notification
coalescing, leases and retained queue rows survive restart. Unchanged discovery
does not update/reset queued work or reacquire a fresh resource.

## Source verification and limits

Rechecked on 2026-10-13:

- [LL2 astronaut detail](https://ll.thespacedevs.com/2.3.0/astronauts/713/) returned
  HTTP 200 and supplies `id`, `agency.abbrev`, `bio`, `flights`, `landings`,
  `flights_count`, and person-specific `flights[].mission.name`. LL2 is curated
  provider metadata, not NASA authority or onboard telemetry. The existing
  [active-expedition contract](source-validation/README.md) supplies assignment,
  expedition and nested profile context; no new upstream field is introduced.
- [NASA Crew-13](https://www.nasa.gov/mission/nasas-spacex-crew-13/) returned HTTP
  200 and advertises `/wp-json/wp/v2/mission/992288`; its content links to official
  personal resources. [NASA Expedition 75](https://www.nasa.gov/mission/expedition-75/)
  is the existing Crew Resource Acquisition source category. Current numbers are verification examples,
  not production constants in the dynamic layer.
- **Inference/candidate rule:** a source `CREW-N` token suggests
  `/mission/nasas-spacex-crew-N/`; `Expedition N` suggests `/mission/expedition-N/`.
  These observed NASA conventions are not guarantees of future URLs, publication
  or identity. N is bounded to 1–999. A missing, mismatched or unsupported resource
  never becomes authoritative evidence.

Each evaluation admits at most 256 unique allowlisted candidates. Each resource
admits at most 64 unique acquisition links. Overflow fails closed instead of
silently accepting incomplete work. Subject/provider/completeness bounds remain.
Operational Subject Binding's own LL2 requests remain at most 3/hour with the combined 15/hour guard and
inherited provider Retry-After; other hosts remain at most 12/hour. NASA additionally
uses the existing shared concurrency/pacing/cooldown gate. Successful resources
refresh after seven days; failed resources wait at least one hour and honor later
Retry-After. Qualification validity remains 30 days. Resources are not fetched by
GET endpoints. Disabling Operational Subject Binding acquisition still disables acquisition.

## Static locator audit

| Existing seed | Role after this change | Dynamic route |
| --- | --- | --- |
| NASA Crew-12 mission | Compatibility/reference seed | Any source-discovered Crew-N → candidate HTML → advertised typed mission |
| NASA Crew-13 mission | Compatibility/reference seed | Same route, independent of the seed list |
| CSA Joshua Kutryk personal page | Useful known personal resource | Official mission/Expedition/source personal links on the allowlisted CSA path |
| ESA Sophie Adenot personal page | Useful known personal resource | Official mission/Expedition/source personal links on the allowlisted ESA path |
| GCTC `main.php?id=154` directory | Reviewed native-directory reference seed | Retained as a fixed directory category; no guessed directory/row or person-name URL |

Existing NASA Crew Resource Acquisition discovery already finds the current Expedition through official
topic/taxonomy/mission data. Agency personal coverage depends on actual qualified
source links; this change does not promise that every future agency publishes one.
The directory seed is a stable category, not a finite Crew mission whitelist.

## Controlled future proof and safety

`OperationalDynamicDiscoveryPostgresTest` uses explicitly SYNTHETIC Crew-42 with
zero configured seeds. Normal loopback LL2 adapter → ingestion → fresh retained
assignment → automatic queue → existing budgeted official-resource transport with
controlled source bodies → typed graph → production Operational Subject Binding evaluation yields MATCH
with an official named-roster and person-specific successful flight witness.
Later Crew-73/Expedition-95/new-person and same-provider mission changes queue new
work; changed official resource relations queue new links immediately and rejected
relations do not. Unchanged observations do not duplicate work. All fixture bytes remain test-only.

Additional tests reject foreign/unsafe links, stale resources, unsupported numbers,
unbounded fanout and unqualified evidence. Existing resource-acquisition and
operational-binding negative, wrong-link, contradiction, threshold, margin and
completeness tests remain passing. Canonical Identity authority, Identity Research
SHADOW, Operational Subject Binding releases/thresholds/gates and Crew
Membership/Lifecycle are unchanged.
Historical coverage begins with observations acquired by this installation;
pre-installation archive intake/backfill is not a production requirement.

## Mission-name-agnostic relation smoke test — 2026-10-13

Controlled SYNTHETIC **Alex-1** and **Aurora** pass with zero static seeds and no
production changes. Normal LL2 source intake supplies new astronaut IDs and
person-specific flights with distinct mission IDs. Normal NASA Crew Resource Acquisition
and parsing retain an explicit official mission link in the roster member's
source DOM; Operational Subject Binding automatically queues that exact `observed_url`, validates the
mission HTML, follows official personal/typed-resource links and reaches MATCH
through qualified personal-resource and successful-flight evidence. Both cases
have empty recognized mission-token sets and GENERIC_ROLE_TEXT captions.

The durable discovery key is the source-advertised URL, with retained resource,
astronaut and flight identifiers preserving lineage. Renaming either mission to
**Nimbus** while retaining IDs/relations leaves all work/deadlines unchanged and
still MATCHes. Unchanged inputs add no work/requests; two same-name **Aurora**
missions with distinct source relations queue distinct URLs. No resource work or
Operational Subject Binding decision is manually inserted. Synthetic names/IDs do not occur in production.

The Crew-N slug fallback in `OperationalResourceDiscovery.missions`, recognized
mission-token extraction in `IdentityFeatures.missions`, Crew-scoped named-roster
qualification in `OperationalResources.parse`, and optional Crew flight-caption
classification in `NasaEditorialParser.mention` remain unchanged. They provide
source-specific enrichment/alternate witnesses; they are not prerequisites for
the tested generic official-relation discovery and qualified-person path. A bare
unknown mission display name still does not invent an official URL. Valid source
relations remain required; this does not expand identity or presence authority.

Crew-42 and the new cases pass; `mvn test` and `mvn verify` each pass 1,189 tests
with zero failures/errors/skips, and diff checks pass. No frontend or migration change.
