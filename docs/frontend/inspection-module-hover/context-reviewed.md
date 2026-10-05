# Context reviewed

- Project instructions: `/Users/daniel/Documents/ChatGPT/MISSION1/AGENTS.md`; no additional checkout-local AGENTS.md found.
- External context: `/Users/daniel/Desktop/mission1-project.md`, current baseline and relevant historical Inspection/module/camera records, especially accepted sections 49–51. Kept outside Git.
- Required skills: project `iss-3d-station-view` (primary), `iss-3d-earth-view`, `devops-local-platform`; personal `frontend-design-codex`, `software-architect`. Station mapping, Cesium scene conventions, local runtime and CI references applied. No subagents.
- Accepted docs: frontend README; `iss-inspection-mode.md`, `iss-model.md`, `rendering-quality.md`, `earth-visualization.md`; semantic map/inventory, Inspection orientation asset axes, occlusion-aware workspace and accepted high-fidelity/rendering-restoration evidence.
- ADR index and relevant 0006/0011 integration context. No significant structural change: local Viewer interaction state, existing resolver and pinned public visual API.
- Existing runtime: EarthView click/input/lifecycle, modelPresentation/manifest, inspectionMode/controls, workspace projection/picking, retained material shader and graphics policy. Existing module-center/native-GPU browser QA infrastructure reused.
- Cesium pinned 1.145 implementation audited locally: ModelFeature/feature table, Model/feature styling, Material/CPUStyling shaders, Camera and View movement-event semantics. No private implementation APIs imported or accessed by production code.
- Authoritative public API verification: [ModelFeature](https://cesium.com/learn/cesiumjs/ref-doc/ModelFeature.html), [Model](https://cesium.com/learn/cesiumjs/ref-doc/Model.html), [Camera](https://cesium.com/learn/cesiumjs/ref-doc/Camera.html). CustomShader documentation was considered during visual audit; the retained material shader remains unchanged.
- The shared skill visual-runtime scripts were unavailable on this host. Existing repository Playwright/visual-lint conventions and bundled browser dependencies were used.
