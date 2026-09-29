import { ISS_MODEL, type SemanticMapping } from '../cesium/modelPresentation';

interface ModuleInfoProps {
  module: SemanticMapping;
  onClose: () => void;
}

/** Source-asset identity only. No orbital or module telemetry is requested here. */
export function ModuleInfo({ module, onClose }: ModuleInfoProps) {
  return <aside className="module-panel" aria-label="Selected ISS module">
    <div className="module-panel-head">
      <span className="eyebrow">NASA MODEL / VERIFIED IDENTITY</span>
      <button type="button" aria-label="Close module information" onClick={onClose}>×</button>
    </div>
    <h2>{module.displayName}</h2>
    <p className="module-source">Source asset node {module.nodeIndex}: {module.nodeName}</p>
    <p className="module-context">Named geometry in the <a href={ISS_MODEL.sourcePage} target="_blank" rel="noreferrer">NASA VTAD model</a>. This model does not establish the exact 2026 station configuration.</p>
    <div className="module-telemetry">Live module telemetry: <strong>unavailable</strong></div>
    <p className="module-scale">Earth View model display: NOT TO SCALE</p>
  </aside>;
}
