# Crew source validation — 2026-10-03 UTC

This is a dated capture, not a live Crew service. Current names and person/expedition IDs below are validation evidence only; no production current roster constants exist. Full capture metadata and exact original-body/fixture SHA-256 values are in [`capture-manifest.json`](../../../backend/src/test/resources/fixtures/crew/capture-manifest.json). All 13 initial data/document requests returned HTTP 200; one subsequent opt-in Java adapter request also returned 200. There were no retries.

## Launch Library 2

Verified [API root](https://ll.thespacedevs.com/2.3.0/) declares resources under API **2.3.0**. [Station detail](https://ll.thespacedevs.com/2.3.0/space_stations/4/) confirms external LL2 station ID **4**, International Space Station. This is a provider-specific station mapping, unrelated to NORAD 25544 or internal person IDs.

[Provider API documentation](https://ll.thespacedevs.com/2.3.0/expeditions/?format=api&ordering=-end) describes `space_station`, `is_active`, response modes and ordering. The standalone `/docs/` probe returned 403 once and was not retried. The observed JSON responses, rather than assumptions about an older API, establish the integrated contract.

Active query:

```text
https://ll.thespacedevs.com/2.3.0/expeditions/?space_station=4&is_active=true&mode=detailed&ordering=-start&limit=10
```

At `2026-10-03T08:33:38.930260Z`: `count=1`, `next=null`, expedition external ID **168**, **Expedition 75**, `start=2026-07-26T07:02:00Z`, `end=null`, `response_mode=detailed`, seven assignments. Independent expedition detail returned the same roster. The production adapter later returned `AVAILABLE`, one complete candidate and seven assignments in one request at **2026-10-03T08:49:53.858577Z** with the same original-body hash.

| Person in captured LL2 roster | LL2 astronaut ID | Observed role |
| --- | --- | --- |
| Jessica Meir | 573 | Commander |
| Anil Menon | 713 | Flight Engineer |
| Jack Hathaway | 712 | Flight Engineer |
| Sophie Adenot | 747 | Flight Engineer |
| Andrei Fedyaev | 732 | Flight Engineer |
| Anna Kikina | 649 | Flight Engineer |
| Pyotr Dubrov | 650 | Flight Engineer |

### Actual fields and shapes

| Resource | Validated fields and semantics |
| --- | --- |
| Active page | `count`, `next`, `previous`, `results`; filtering uses `space_station`, while the returned nested station field is **`spacestation`**. |
| Expedition | `id`, `url`, `response_mode`, `name`, `start`, nullable `end`, `spacestation`, `crew`, `mission_patches`, `spacewalks`. Production maps the needed domain fields; it does not mirror all histories. |
| Crew assignment | `id`, `astronaut` object, `role` object (`id`, `role`, `priority`). Commander is source role 1/priority 0; Flight Engineer is source role 3/priority 2. IDs/priorities are not universal enum values. No individual entry/departure/assignment-validity instant was supplied. |
| Nested astronaut | `id`, `url`, **`response_mode=list`**, `name`, `status`, `type`, `agency`, `image`, `in_space`, `time_in_space`, `eva_time`, `age`, `date_of_birth`, nullable `date_of_death`, `nationality`, `bio`, `wiki`, `first_flight`, `last_flight`, `social_media_links`. Detailed expedition mode does not make nested astronauts detailed. |
| Agency | Object with `id`, `name`, `abbrev`, `type` object; separate from nationality. |
| Nationality | Array of objects with `name`, `alpha_2_code`, `alpha_3_code`; model accepts zero/multiple entries and nullable optional codes. |
| Image | Object with `image_url`, `thumbnail_url`, nullable `credit`, `license` object (`id`, `name`, nullable `link`, `priority`), `single_use`, `variants`. **Not a string URL.** |
| Astronaut detail | `response_mode=detailed`; profile fields plus `flights_count`, `landings_count`, `spacewalks_count` and large `flights`, `landings`, `spacewalks` arrays. Summary flight/spacewalk counts are absent from the captured nested roster profiles. |

`in_space=true` was supplied for all seven; this means the source's generic in-space flag and **does not prove ISS physical presence**. Status/type, DOB, wiki, social links and flight/landing/EVA histories were inspected but are not exposed as domain requirements. Optional missing agency, image, bio, nationality, duration/count/time fields remain unknown; tests exercise synthetic nullable variations explicitly labeled as such.

Duration samples are ISO-8601 cumulative elapsed time, mapped to `Duration`, never a date:

| Detail | `time_in_space` | `eva_time` | Flights / landings / spacewalks |
| --- | --- | --- | --- |
| Jessica Meir / 573 | `P436DT6H28M11S` | `P1DT18H29M` | 2 / 1 / 6 |
| Sophie Adenot / 747 | `P231DT15H10M43S` | `PT19H42M` | 1 / 0 / 3 |

Jessica/Sophie images supplied `credit=null`, license `Unknown`, link null and `single_use=true`. Anil's supplied credit NASA, a NASA terms link and `single_use=false`. These observations are retained, not converted into a reusable-media permission. No image was downloaded. Biographies contain historical mission descriptions; they are not current operational evidence.

### Quota and bounded request design

The [provider overview](https://thespacedevs.com/llapi) publishes an unauthenticated limit of **15 requests/hour**. The captured JSON responses contained no quota-remaining/reset headers, ETag, Last-Modified or Retry-After. Their absence does not establish remaining quota or refresh cadence. No quota exhaustion experiment was performed.

**Nine explicit LL2 JSON requests**: eight bounded investigation requests (root, station, active query, expedition detail, detailed astronaut list limit 1, docking list limit 1, two astronaut details), plus one production-adapter opt-in request. One separate `/docs/` request returned 403. Provider documentation/browser search traffic is not counted as JSON data acquisition; it cannot establish a server-side quota balance.

Normal future structured acquisition needs **one active detailed expedition query** for roster, roles, nested profile, agency, nationality, media, durations and basic flight dates. It does not need a second expedition-detail request. Flight/spacewalk counts require explicit detail enrichment; that port performs one requested person GET, never a per-person roster-refresh loop. Future ingestion must cache/enrich only when needed and account for all calls; this milestone introduces no scheduler/cache policy. Pagination is deliberately bounded: multiple or incomplete candidates are retained as `AMBIGUOUS`; `next` is not fetched and no arbitrary candidate is selected.

The inspected docking record (`docking_events/?space_station=4&ordering=-docking&limit=1`, count 576) contained event 644, docking `2026-10-01T23:05:00Z`, departure null, Harmony forward, Crew Dragon Grace/Crew-13. This corroborates a vehicle event, not a named person's entry. Docking acquisition/refresh is not implemented.

## NASA official evidence

Five distinct pages were fetched and reviewed. Document HTML does not imply a stable Crew API or resilient extractor. Publication instants below came from article `<time datetime>`; date-only Page Last Updated is retained as prose, never invented midnight UTC. All retrieval instants are UTC.

| Source URL / category | Publication / retrieval | Facts supported | Facts not supported |
| --- | --- | --- | --- |
| [Expedition 75](https://www.nasa.gov/mission/expedition-75/) — `NASA_EXPEDITION_PAGE` | Publication instant unavailable; Page Last Updated Oct 1, 2026 (date only). Retrieved **08:34:42.372185**, 2026-10-03. | Mission start July 26, 2026 / end Spring 2027; base Crew Members section names seven; separate At the Station cards name eleven during overlap. | Exact start/end instants, a single authoritative physical count from every page section, individual arrival/departure intervals or machine-stable canonical IDs. |
| [Crew-13 members enter station](https://www.nasa.gov/blogs/spacestation/2026/10/01/crew-13-members-enter-station-join-expedition-75/) — `NASA_ISS_OPERATIONAL_POST` | Published **2026-10-02T02:01:55Z** (`2026-10-01T22:01:55-04:00`); retrieved **2026-10-03T08:34:43.318408Z**. | Named four entrants Jessica Watkins, Luke Delaney, Joshua Kutryk, Sergey Teteryatnikov; names seven already aboard. Hatch opened Oct 1 at 9:19 p.m. EDT = **2026-10-02T01:19:00Z**. | Each person's exact entry instant; present occupancy indefinitely after publication; that docking itself proves entry. Hatch time is a separate `HATCH_OPENED` event, not assigned to all entry assertions. |
| [Station crew expands / Crew-12 prepares to depart](https://www.nasa.gov/blogs/spacestation/2026/10/02/station-crew-expands-as-nasas-spacex-crew-12-prepares-to-depart/) — `NASA_ISS_OPERATIONAL_POST` | Published **2026-10-02T18:14:13Z** (`2026-10-02T14:14:13-04:00`); retrieved **2026-10-03T08:34:43.510797Z**. | Explicit count of **eleven people aboard** in that report; handover context. | Future Oct 4 command transfer or planned weather-dependent Oct 5 departure as completed events; an indefinitely current eleven-person canonical count. |
| [Visiting vehicles](https://www.nasa.gov/international-space-station/space-station-visiting-vehicles/) — `NASA_VISITING_VEHICLES` | Publication instant unavailable; Page Last Updated Oct 1 date only. Retrieved **2026-10-03T08:34:44.520775Z**. | Body configuration as of Oct 1 lists six vehicles including Crew-12/Crew-13 and Crew-13 launch/docking entries. | Individual physical presence; all sections equally fresh (page description still refers to July 26). |
| [ISS overview](https://www.nasa.gov/international-space-station/) — `NASA_STATION_OVERVIEW` | Publication instant unavailable; editorial last-update date Mar 5, 2026. Retrieved **2026-10-03T08:34:45.532377Z**. | Discovery/background and links to recent operational news. | Reliable current roster/count: editorial Expedition 74/older sections coexist with recent Crew-13 news. Not selected as a current-presence authority. |

### Real-source comparison, without reconciliation

```text
LL2 structured Expedition 75 assignments: 7
Jessica Meir, Anil Menon, Jack Hathaway, Sophie Adenot,
Andrei Fedyaev, Anna Kikina, Pyotr Dubrov.

NASA operational report: 11 physically aboard at report time
The seven above (NASA spelling Andrey Fedyaev), plus
Jessica Watkins, Luke Delaney, Joshua Kutryk, Sergey Teteryatnikov.
```

The different counts are captured real observations, compatible with an expedition base roster and temporary operational overlap. Even the NASA expedition page has separate seven-person and eleven-person sections. This evidence does not measure LL2 lag, prove a provider error, solve transliteration identity, or justify silently overwriting either source. No `NASA_AHEAD` result is computed. Source assignment count and evidence-based occupancy count remain different concepts.

## Fixtures and reproducibility

All files live under `backend/src/test/resources/fixtures/crew`. They contain selected recorded source fields/text; huge unrelated page scaffolding and history arrays are omitted. NASA outbound anchors are replaced by spans while assertion text/time is preserved. The fixture hash therefore differs from the original body hash by design. Metadata provides capture instant, exact URL, HTTP status, relevant headers, both hashes, projection purpose and fixture kind.

| Fixture | Capture UTC / URL reference above | Purpose |
| --- | --- | --- |
| `ll2/active-iss-expedition-detailed.json` | 2026-10-03T08:33:38.930260Z / active query | Seven real assignments, nested list profiles, media/duration contract. |
| `ll2/astronaut-detail.json` | 2026-10-03T08:34:39.915242Z / astronauts/573/ | Detailed counts, long cumulative space/EVA durations and nullable rights. |
| `ll2/astronaut-detail-2.json` | 2026-10-03T08:34:41.439239Z / astronauts/747/ | Independent detail shape and ISO duration sample. |
| `ll2/astronaut-nullable-fields.json` | No new capture; synthetic variation of 573 | Explicitly synthetic missing optional values and additional-field compatibility, never a real person update. |
| `nasa/expedition-roster-fragment.html` | 2026-10-03T08:34:42.372185Z / expedition page | Base seven-person mission roster. |
| `nasa/nasa-arrival-fragment.html` | 2026-10-03T08:34:43.318408Z / arrival article | Four entrants, seven already aboard, hatch/publication distinction. |
| `nasa/nasa-count-fragment.html` | 2026-10-03T08:34:43.510797Z / count article | Explicit eleven-person operational count. |
| `nasa/reviewed-count-evidence.json` | Same count-article capture | Manually reviewed, test-only evidence with original body hash; real seven/eleven comparison test. |

Synthetic malformed/HTTP/multiple-candidate variations are explicitly test mechanics, not claimed real incidents. Default tests use fixtures, localhost HTTP or mocks and never contact LL2/NASA. `LiveCrewValidation` is a manual main guarded by `MISSION1_CREW_LIVE_VALIDATION=1`, requires an external output path, and performs exactly one current query. Application startup performs **zero Crew requests**, with no scheduler, retry, N+1 enrichment, persistence or public controller.

## Automated NASA revalidation — 2026-10-03, separate from earlier captures

The [Space Station blog](https://www.nasa.gov/blogs/spacestation/) officially advertises [its RSS feed](https://www.nasa.gov/blogs/spacestation/feed/). It returned application/rss+xml; charset=UTF-8, full content:encoded HTML, stable article link/GUID, item pubDate, ETag and Last-Modified. The selected integration consumes that stable URL, at most ten items within fourteen days, with no article GET or fixed current expedition/article URL. Source discovery metadata, hashes, bounded fixture and actual parser/current comparison are in [the reconciliation dossier](../reconciliation-validation/README.md).

RSS is PARTIAL operational evidence plus separate COUNT_ONLY assertions, not an exhaustive current roster. Structured current expedition remains dynamically discovered LL2 data; NASA expedition mentions remain contextual raw text. Revalidated overview/directory/mission pages have mixed editorial rosters/date-only updates, so they were not accepted as exhaustive/time-safe runtime rosters. Exposed WordPress routes were research only. Visiting vehicles are not person occupancy authority and were not selected. A guessed expeditions URL returned 404 once and was not retried; actual directory discovery followed the official overview link.

The selected feed's exact capture SHA-256 is `12257a99814dba2d2336ca0a51533ae10a94f9e651d825e8dfa6f6b0cffeeb0e`, 53,621 bytes at 10:40:51 UTC. Conditional service validation at 11:24:52–11:24:53 UTC returned 200 then 304. Profile validation at 11:17:46–11:17:47 UTC confirmed the named Watkins and Delaney NASA /people/ URLs as HTTP200 single-person pages. Runtime adds no profile requests. Dates/names/counts remain captured evidence, not permanent invariants. Default tests use the original frozen feed plus explicitly synthetic variations, never a runtime fallback.
