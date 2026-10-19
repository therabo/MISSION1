# Mission and Crew metadata cleanup — 2026-10-09

> Superseded for bottom-bar presentation on 2026-10-19: both identity blocks and dedicated quality status/evidence UI are removed. See the [shared four-field contract](../position-status-bar.md). Scientific state and WGS84 semantics remain.

Starting clean, synchronized `main`: `30c0cd4828fe46c9e6283c9e8d6eeaaf2c1938e0`. This milestone changes presentation only, with zero backend/API/domain/resource changes and no new architectural decision.

## Earth presentation and attribution

`OperationalSummary` retains only **ISS / WGS84** in its identity cell; the visible Computed position / Predicted ephemeris / Historical position subtitle is removed. Physical coordinate validity, selected-source ownership, units, buffer expiry and GP/OEM classifications are unchanged. The existing legend/source evidence still describes computed GP/TLE and source-provided predicted NASA OEM.

The identity cell centers its single label in the existing grid. Its unused subtitle styles and redundant mobile 50px identity minimum are removed. The operational bar stays 80px desktop/tablet and 120px mobile: the adjacent status control retains its legitimate 50px compact minimum and the coordinate row still needs 38px. Removing text leaves no vacant identity line or extra row. Other source/status/coordinate geometry remains accepted.

The model's `showCreditsOnScreen` option changes from true to false. Its exact `ISS_MODEL.credit`, model manifest and GLB remain intact. Cesium continues registering the credit in **Data attribution**; the existing orbital evidence retains the model note and NASA source link, and Inspection/module provenance remains unchanged. This is the only EarthView source difference: model rendering, camera, shaders, position/trajectory sampling and asset bytes are unchanged.

## Current Crew and timestamp choice

The main Current roster removes the `Last reported: … · current count unverified`, `In the retained count`, and **ASSESSMENT UTC** block. `Reported aboard` still shows `Unavailable` when no verified current count exists; all three backend counts keep their original values. There is no fourth blank summary cell. Current count cells have intrinsic height rather than the former 58px floor; narrow two-column summaries let the third count span the row. The accepted full Crew workspace and its scroll owner remain bounded by the parent.

**Last update** chooses the later finite, non-null existing value from:

- `freshness.structuredSource.lastSuccessfulFetchAt`
- `freshness.verification.lastSuccessfulFetchAt`

`latestCrewSourceUpdate` returns that API string unchanged. The label means the latest successful Crew **source collection/revalidation** operation, including an unchanged/304 response. It does not claim a newly changed payload or newly confirmed ISS presence. The caption's tooltip states its successful-fetch meaning; individual source clocks/health remain in **Data sources & freshness**. Later failures do not advance these success fields. When neither exists, the caption says **Unavailable**, with no fallback date.

The field choice follows the existing REST/domain code: `CrewRestQueryService.health` maps the latest successful run's observation retrieval time; LL2 success follows snapshot validation/persistence, and NASA success follows an AVAILABLE parse or a 304 against a previously parsed document. `contributingAssertions[].asOf` represents explicit event/publication context. `freshness.evaluatedAt`/`reconciliation.evaluatedAt` represent read-time assessment. `reconciliation.reconciledAt` is the original persisted interpretation time. Original observations remain separate from subsequent unchanged fetches. None of these alternatives is renamed into Last update. See the unchanged [Crew API timestamp contract](../../api/crew-api.md).

The caption sits beside the existing quality disclosure when space permits and wraps naturally on smaller surfaces. No fixed aggregate height, unused separator or replacement information card is added. With the same real source state, combined Current summary/evidence extent changes:

| Viewport | Before | After |
| --- | ---: | ---: |
|1440×900|143px|125px|
|1024×768|241px|150px|
|768×1024|241px|150px|
|390×844|324px|264px|
|320×568|340px|264px|

Assessment UTC remains in the API/domain and the protected sources disclosure. Historical retains its accepted assessment, retained-count caveats, effective-time context, coverage limitations and dated assertion evidence. It receives no Current Last update caption. The standalone compatibility `CrewSummary` is not the App's Current roster owner and remains unchanged.

## Validation and scope

Actual baseline: Node 24 frontend **744 tests/61 files**, Java 21 backend **382**. Final frontend **750/61**, typecheck/build and diff checks PASS. Java 21 `mvn test` and `mvn verify`: **382 each**, zero failures/errors/skips. Existing bundle-size warning only. Six focused cases cover each source clock winning, newer failure retention, missing/invalid clocks without invented fallback, and Historical metadata retention. Existing source-quality, physical-position and Current/Historical navigation tests pass.

Development 5175 and production 4175 each pass 1440×900,1024×768,768×1024,390×844 and320×568 against real API responses. Each viewport checks Earth GP/OEM identity alignment; absent on-scene model credit; preserved native attribution/orbital provenance; unchanged Crew counts and exact success timestamp; preserved NASA verification, assignment/presence caveat, unresolved reports and freshness warning; Current and Historical roster/detail navigation/focus; Historical top-date/assessment coherence; no horizontal overflow/row clipping; one persistent Cesium canvas. Zero page/console errors. The desktop attribution action follows its existing keyboard-visible policy; QA uses focus + Enter instead of a click on its visually hidden resting link.

Four representative lossless WebPs, visually inspected and decoded-RGBA checked against native PNGs: [Earth desktop](screenshots/metadata-earth-1440.webp), [Earth mobile](screenshots/metadata-earth-390.webp), [Current Crew desktop](screenshots/metadata-current-crew-1440.webp), [Current Crew narrow mobile](screenshots/metadata-current-crew-320.webp). JSON/baseline rectangles/logs remain outside Git in `/tmp/mission1-metadata-cleanup`. The dedicated scoped DOM checks substitute for the skill's unavailable shared visual-runtime scripts. Browser evidence uses Chromium/Metal, not physical Safari/Android certification.

Reproduce with Node 24 and the existing local backend:

```sh
node docs/frontend/ui-restyling-responsive/validation/interface-metadata-cleanup.cjs http://127.0.0.1:5175/ development /tmp/mission1-metadata-cleanup/development
node docs/frontend/ui-restyling-responsive/validation/interface-metadata-cleanup.cjs http://127.0.0.1:4175/ production /tmp/mission1-metadata-cleanup/production
```

Backend/runtime, ingestion, reconciliation, StationPresence, assignments, unresolved identities, source assertions/health/freshness, automatic refresh, Retry, historical reconstruction, profiles and all assets remain unchanged. Delivery uses one ordinary commit directly on main and a normal SSH push. External context is `/Users/daniel/Desktop/mission1-project.md`, outside Git.
