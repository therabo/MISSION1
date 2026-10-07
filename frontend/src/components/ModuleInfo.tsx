import { useCallback, useRef } from 'react';
import { ISS_MODEL, type SemanticMapping } from '../cesium/modelPresentation';
import { ContextDock } from './ContextDock';
import './ModuleInfo.css';

interface ModuleInfoProps {
  module: SemanticMapping | null;
  onClose: () => void;
  historical?: boolean;
  acceptedAt?: string;
}

/** Source-model identity and dated assessment only, never internal telemetry or
 * a reconstructed attachment timeline. Retained content is an inert exit snapshot;
 * App's module prop remains the sole selected state.
 */
export function ModuleInfo({ module, onClose, historical = false, acceptedAt }: ModuleInfoProps) {
  const last = useRef<SemanticMapping | null>(null);
  if (module?.status === 'VERIFIED') last.current = module;
  const shown = module?.status === 'VERIFIED' ? module : last.current;
  const restoreFocus = useCallback(() => document.querySelector<HTMLElement>('.inspection-modules')?.focus({ preventScroll: true }), []);
  if (!shown) return null;
  const configurationLabel = shown.configurationStatus === 'CURRENT_CONFIRMED'
    ? 'Current station component confirmed'
    : shown.configurationStatus === 'REMOVED_FROM_CURRENT_STATION'
      ? 'Removed from current station'
      : 'Current station status unverified';
  return <ContextDock open={module?.status === 'VERIFIED'} title={shown.displayName}
    context={<><span>{shown.agency ?? 'Agency unavailable'}</span><span className="module-type"> · {shown.componentType}</span></>} entityId={shown.componentId}
    closeLabel="Close module information" onClose={onClose} className="module-dock" sceneEscape onRestoreFocus={restoreFocus}
    footer={<>
      <a className="context-button module-evidence" href={ISS_MODEL.sourcePage} target="_blank" rel="noreferrer"
        title="NASA VTAD source model" aria-label="Evidence & provenance — NASA VTAD source model">Evidence & provenance</a>
      <p><a href={shown.identityEvidenceUrl} target="_blank" rel="noreferrer">Component reference</a>
        {shown.configurationEvidenceUrl && <> · <a href={shown.configurationEvidenceUrl} target="_blank" rel="noreferrer">Configuration evidence</a></>}</p>
    </>}>
    <section className="module-role"><h3>Function / role</h3><p>{shown.role ?? 'Role unavailable for this mapped component'}</p></section>
    <section><h3>Configuration context</h3>
      <p>{configurationLabel}</p>
      <p className="module-secondary">Configuration evidence: {shown.configurationEvidenceDate ?? 'Unavailable'}<br />Assessment is separate from model geometry.</p>
      {shown.configurationStatus === 'REMOVED_FROM_CURRENT_STATION' && <p className="module-secondary">Historical NASA VTAD asset representation; this component is absent from the current ISS.</p>}
      {historical && <p className="module-secondary">Current assessment; attachment at the selected Historical UTC is not reconstructed.{acceptedAt && <time dateTime={acceptedAt}>{acceptedAt}</time>}</p>}
    </section>
    <section><h3>Limitations / availability</h3><p className="module-unavailable">Live module telemetry <strong>unavailable</strong></p>
      <p className="module-caveat">NASA VTAD geometry may differ from the current ISS.</p>
    </section>
    <section><h3>Supporting technical detail</h3><dl>
      <div><dt>Module ID</dt><dd className="module-code">{shown.componentId}</dd></div>
      <div><dt>Identity mapping</dt><dd>{shown.status === 'VERIFIED' ? 'Verified' : shown.status}</dd></div>
      <div><dt>Asset node</dt><dd className="module-code">{shown.nodeIndex}</dd></div>
      <div className="module-type-row"><dt>Component type</dt><dd>{shown.componentType}</dd></div>
    </dl><p className="module-secondary">{shown.nodeName}</p>
      <p className="module-secondary">Identity verified: {shown.identityVerifiedOn} · Earth View display: NOT TO SCALE</p>
    </section>
  </ContextDock>;
}
