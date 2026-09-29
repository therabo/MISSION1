import { ISS_MODEL, type SemanticMapping } from '../cesium/modelPresentation';

interface ModuleInfoProps {
  module: SemanticMapping;
  onClose: () => void;
}

/** Source-asset identity only. No orbital or module telemetry is requested here. */
export function ModuleInfo({ module, onClose }: ModuleInfoProps) {
  const configurationLabel = module.configurationStatus === 'CURRENT_CONFIRMED'
    ? 'Current station component confirmed'
    : module.configurationStatus === 'REMOVED_FROM_CURRENT_STATION'
      ? 'Removed from current station'
      : 'Current station status unverified';
  return <aside className="module-panel" aria-label="Selected ISS module">
    <div className="module-panel-head">
      <span className="eyebrow">NASA MODEL / VERIFIED IDENTITY</span>
      <button type="button" aria-label="Close module information" onClick={onClose}>×</button>
    </div>
    <h2>{module.displayName}</h2>
    <p className="module-identity">{module.componentId} · {module.componentType}</p>
    {module.agency && <p className="module-detail">Agency: {module.agency}</p>}
    {module.role && <p className="module-detail">{module.role}</p>}
    <p className={`module-configuration ${module.configurationStatus === 'REMOVED_FROM_CURRENT_STATION' ? 'is-historical' : ''}`}>
      Configuration: <strong>{configurationLabel}</strong>
      {module.configurationStatus === 'REMOVED_FROM_CURRENT_STATION' && <span>Historical NASA VTAD asset representation; this component is absent from the current ISS.</span>}
    </p>
    <p className="module-source">Source asset node {module.nodeIndex}: {module.nodeName}</p>
    <p className="module-context">Mapping: {module.status}. Named geometry in the <a href={ISS_MODEL.sourcePage} target="_blank" rel="noreferrer">NASA VTAD model</a>. <a href={module.identityEvidenceUrl} target="_blank" rel="noreferrer">Component reference</a>{module.configurationEvidenceUrl && <> · <a href={module.configurationEvidenceUrl} target="_blank" rel="noreferrer">Configuration evidence</a></>}.</p>
    <p className="module-caveat">Model geometry reflects the NASA VTAD source asset and may differ from the current ISS.</p>
    <div className="module-telemetry">Live module telemetry: <strong>unavailable</strong></div>
    <p className="module-scale">Earth View model display: NOT TO SCALE</p>
  </aside>;
}
