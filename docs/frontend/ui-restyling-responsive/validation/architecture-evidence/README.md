# Responsive architecture evidence

The [architecture audit](../../architecture-audit.md) records the accepted 2026-10-09 layout decisions. Final repository hygiene retains this concise decision record and six representative visuals; full historical reports and corpora are recoverable under the [artifact policy](../../../qa-artifact-policy.md).

- [48-family inventory](component-inventory.csv): source, parent, layout, units, thresholds, scrolling and verdict.
- [Declaration ledger](dimension-decisions.csv): before/final decisions, including removed constraints.
- [Dimension summary](dimension-summary.json): reproducible counts and media/container thresholds.
- [Six screenshots](../../screenshots.md) and [lossless manifest](visual-files.json): 1,263,644 bytes.
- [Final validation](../../validation-summary.md) and [integration smoke](../integration-smoke.cjs): full gates plus real-data desktop/tablet/mobile interactions.

Generate future evidence outside the repository. The declaration runner defaults to a temporary directory. From the repository root, with Node 24 and the real backend:

```sh
node docs/frontend/ui-restyling-responsive/validation/architecture-dimensions.cjs
node docs/frontend/ui-restyling-responsive/validation/integration-smoke.cjs http://127.0.0.1:4175/ production /tmp/mission1-integration-smoke
node docs/frontend/ui-restyling-responsive/navigation-disclosure/controls-qa.cjs http://127.0.0.1:4175/ production /tmp/mission1-disclosure
```

Earlier comparative diagnostics require the documented archived baseline and external captures. The retained representative images describe their original capture time; they are not a current ISS data source.
