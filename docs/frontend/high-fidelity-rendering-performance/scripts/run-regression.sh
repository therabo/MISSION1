#!/bin/sh
set -eu
# Run from repository root with dev 5175, production 4175 and API 8080 ready.
# A caller may set the bundled Playwright module and an alternate evidence path.
export MISSION1_EVIDENCE_DIR="${MISSION1_EVIDENCE_DIR:-docs/frontend/high-fidelity-rendering-performance/evidence/regression}"
mkdir -p "$MISSION1_EVIDENCE_DIR"
node docs/frontend/high-fidelity-rendering-performance/scripts/browser-qa.cjs 5175 development > "$MISSION1_EVIDENCE_DIR/development.txt" 2>&1
node docs/frontend/high-fidelity-rendering-performance/scripts/browser-qa.cjs 4175 production > "$MISSION1_EVIDENCE_DIR/production.txt" 2>&1
node docs/frontend/occlusion-aware-workspace-centering/scripts/input-regression.cjs > "$MISSION1_EVIDENCE_DIR/input.txt" 2>&1
node docs/frontend/occlusion-aware-workspace-centering/scripts/visual-lint.cjs > "$MISSION1_EVIDENCE_DIR/visual-lint.txt" 2>&1
node docs/frontend/occlusion-aware-workspace-centering/scripts/transitions.cjs > "$MISSION1_EVIDENCE_DIR/transitions.txt" 2>&1
node docs/frontend/high-fidelity-rendering-performance/scripts/idle-lifecycle.cjs > "$MISSION1_EVIDENCE_DIR/idle-lifecycle.txt" 2>&1
node docs/frontend/high-fidelity-rendering-performance/scripts/full-scene-edge.cjs > "$MISSION1_EVIDENCE_DIR/full-scene-edge.txt" 2>&1
