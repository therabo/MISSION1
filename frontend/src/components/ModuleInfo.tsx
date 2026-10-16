import { useCallback, useRef } from 'react';
import type { SemanticMapping } from '../cesium/modelPresentation';
import { ContextDock } from './ContextDock';
import './ModuleInfo.css';
import { useModuleTelemetry } from '../telemetry/useModuleTelemetry';
import { ModuleTelemetryReadings, ModuleTelemetryTechnical } from '../telemetry/ModuleTelemetry';

interface ModuleInfoProps {
  module: SemanticMapping | null;
  onClose: () => void;
  historical?: boolean;
  acceptedAt?: string;
}

/** Source-model identity, function and backend-owned real telemetry.
 * Retained content is an inert exit snapshot;
 * App's module prop remains the sole selected state.
 */
export function ModuleInfo({ module, onClose, historical = false, acceptedAt }: ModuleInfoProps) {
  const last = useRef<SemanticMapping | null>(null);
  if (module?.status === 'VERIFIED') last.current = module;
  const shown = module?.status === 'VERIFIED' ? module : last.current;
  const telemetry = useModuleTelemetry(shown?.componentId ?? '', historical ? acceptedAt ?? null : null, module?.status === 'VERIFIED' && (!historical || !!acceptedAt));
  const restoreFocus = useCallback(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('.earth-view canvas');
    if (canvas) { canvas.tabIndex = 0; canvas.focus({ preventScroll: true }); }
  }, []);
  if (!shown) return null;
  return <ContextDock open={module?.status === 'VERIFIED'} title={shown.displayName}
    context={<><span>{shown.agency ?? 'Agency unavailable'}</span><span className="module-type"> · {shown.componentType}</span></>} entityId={shown.componentId}
    closeLabel="Close module information" onClose={onClose} className="module-dock" sceneEscape onRestoreFocus={restoreFocus}>
    <section className="module-role"><h3>Function</h3><p>{shown.role ?? 'Role unavailable for this mapped component'}</p></section>
    <ModuleTelemetryReadings data={telemetry.data} loading={telemetry.loading} error={telemetry.error} />
    <section><h3>Supporting technical detail</h3><dl>
      <div><dt>Module ID</dt><dd className="module-code">{shown.componentId}</dd></div>
      <div><dt>Asset node</dt><dd className="module-code">{shown.nodeIndex}</dd></div>
      <div className="module-type-row"><dt>Component type</dt><dd>{shown.componentType}</dd></div>
    </dl><ModuleTelemetryTechnical data={telemetry.data} />
    </section>
  </ContextDock>;
}
