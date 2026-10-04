# Context reviewed for the correction

Read the complete pasted milestone request and matching project AGENTS instructions.
Recursively inventoried docs and project-local skills; searched both MISSION1
checkouts and parent instruction locations. Only the supplied
`/Users/daniel/Documents/ChatGPT/MISSION1/AGENTS.md` applies. The target repository
is `/Users/daniel/Desktop/MISSION1`; `/Users/daniel/Desktop/mission1-project.md`
was read in its current header and accepted camera/graphics/replay/centering
sections, remains outside Git and is updated separately. No subagents were used.

## Skills and references read

- `/Users/daniel/.codex/skills/frontend-design-codex/SKILL.md`
- `/Users/daniel/.codex/skills/software-architect/SKILL.md` and `references/adr-guide.md`
- Project-local `iss-3d-earth-view`: SKILL, earth-view-contract, cesium-scene-conventions
- `iss-3d-station-view`: SKILL, station-model-mapping, scene-coordinate-conventions
- `devops-local-platform`: SKILL, local-runtime-contract, ci-definition-of-done
- `architecture-decisions`: SKILL and ADR threshold guidance
- `mission-replay`: SKILL, replay-time-model, state-reconstruction
- `iss-ground-segment-architecture`: SKILL, architecture-principles

Project skill root: `/Users/daniel/Documents/ChatGPT/MISSION1/.codex/skills`.
The shared frontend visual runtime is absent on this host; existing equivalent
Playwright/visual-lint diagnostics are reused. No skill requires delegation here.

## Documents read

Current and relevant historical sections (large archival frame tables were read
in bounded sections, not every old raster reopened):

- `frontend/README.md`
- `docs/frontend/earth-visualization.md`
- `docs/frontend/iss-inspection-mode.md`
- `docs/frontend/dynamic-workspace-centering/README.md` and its QA scripts/results
- `docs/frontend/camera-transition-perfecting-review/README.md`
- `docs/frontend/camera-transition-perfecting-review/perceptual/results.md`
- `docs/frontend/camera-transition-perfecting-review/focus-optimization/README.md` and `results.md`
- `docs/frontend/crew-earth-view-panel-review/README.md`
- `docs/frontend/trajectory-rendering-artifact-review/dark-side-oblique-fixes/README.md`
- `docs/architecture/04-earth-view-orbital-delivery.md` and `06-mission-replay.md`
- `docs/replay/README.md`, `crew-replay.md`, validation/context-reviewed.md
- `docs/adr/README.md`, ADR-0006 (including accepted camera/focus clarification),
  and ADR-0011 (effective-time Replay; checked again before final documentation)

Replay architecture/frontend docs describe no rectangular crop and need no change.
The previous centering dossier is retained with an additive supersession note.

## Implementation and tests inspected

- Complete preceding milestone diff `f8ca08b3134773327cf18549402b8acc8bb0d99e..47b295601da2ba6a90112e4b4212985c48d4be79`
  for runtime helpers, geometry/hook tests, App, styles, EarthView, AppReplay test
  and current documentation; binary evidence inventoried, preserved.
- App.tsx, styles.css, EarthView.tsx (Viewer initialization, resize, warmup,
  source/focus/camera lifecycle, picking, controls, transition tick and cleanup)
- workspaceGeometry.ts/test, useEarthWorkspace.ts/test, inspectionControls.ts,
  transitionComposition.ts, skyRenderingWarmup.ts, inspectionRenderingWarmup.ts
- frontend/package.json and established browser/input/idle/transition QA scripts
- Final ownership audit reread crew/CrewPanel.tsx, replay/ReplayCrewPanel.tsx,
  replay/ReplayControls.tsx, App Replay/dashboard branches and responsive Crew/Replay CSS
- api/useOrbitalDelivery.ts and api/useComparisonDelivery.ts during the
  clock-leap QA diagnosis; existing buffer/Inspect availability remained unchanged
- Installed Cesium 1.145.0 PerspectiveFrustum, PerspectiveOffCenterFrustum,
  Camera/getPickRay, Picking/getPickPerspectiveCullingVolume/pickBegin,
  PickFramebuffer, Scene working-frustum/depth passes and ScreenSpaceCameraController input paths
- Authoritative Cesium public PerspectiveFrustum, Camera and Scene documentation
- GlobeFS computeEllipsoidPosition, GlobeSurfaceShaderSet shader order,
  built-in metersPerPixel/windowToEyeCoordinates, Globe material lifecycle,
  Material/Fabric and authoritative public Globe.material/Material documentation

No external ISS field, endpoint, unit, reference frame or asset is newly relied
upon or modified. Existing verified backend data is used for browser QA.
