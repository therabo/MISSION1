# Final clean restyling validation

Validated from the cleaned `ui/restyling` feature snapshot, starting at accepted `b3036793614280f0842acb21c3145dd7b3f0097a`. Repository hygiene changes documentation and QA tooling; all 397 existing frontend/backend source, asset and test files remain byte-identical to that accepted baseline. Required model inventory/semantic-review metadata and real recorded test inputs are retained.

| Gate | Result |
| --- | --- |
| Node 24 full frontend suite | 736 tests / 61 files PASS |
| TypeScript typecheck | PASS |
| Production build | PASS; existing Cesium chunk-size warning |
| Java 21 `mvn test` | 382 tests PASS, zero failures/errors/skips |
| Java 21 `mvn verify` | 382 tests PASS, zero failures/errors/skips; BUILD SUCCESS |
| Production browser smoke | All four viewports PASS; 34 captured states, zero page/console errors |
| Product/source freeze against accepted feature | 397 files byte-identical |
| Documentation links / QA relative module imports | No missing targets |
| `git diff --check` | PASS |

The [reusable integration smoke](validation/integration-smoke.cjs) covers 1440×900, 768×1024, 390×844 and 320×568 against the real PostgreSQL/backend and production build. Each viewport checks Current GP/TLE and NASA OEM, Crew without routine Refresh, Inspection, native semantic module picking and Close, native Cesium wheel/Reset, Historical date selection, expanded controls, calendar draft/Cancel and Historical Crew. Both phone sizes additionally check collapsed disclosure. Calendar geometry verifies viewport centering in compact mode; draft edits retain the accepted UTC. Viewer and canvas identity stay persistent. Desktop, phone calendar and narrow module screenshots were inspected visually.

All smoke output remains under `/tmp/mission1-hygiene-feature-smoke`, outside Git. The [six retained screenshots](screenshots.md) document the final accepted architecture at their original capture time, with a matching lossless manifest. The external `/Users/daniel/.codex/exports/mission1-responsive-review/` directory is unchanged and outside Git.

The first post-cleanup frontend run exposed two model metadata dependencies, which were restored before the full passing rerun. The new smoke harness initially compared two equivalent ISO timestamp spellings; its assertion now compares UTC instants. Neither correction changed application behavior. Raw diagnostic output is external.

Integration uses `git merge --squash ui/restyling` so main receives this clean tree without the iterative feature/QA history. Full tests/typecheck/build, Java 21 test/verify and the same four-viewport smoke must pass again from the integration commit on main; final SHAs and those results are recorded in the external project context.

Earlier detailed validation conclusions remain in the [architecture audit](architecture-audit.md) and historical milestone documents. The [QA artifact policy](../qa-artifact-policy.md) explains removal and archive recovery. Browser evidence certifies this Chromium/Metal environment; physical mobile browsers and native two-finger pinch remain unverified.
