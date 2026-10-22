import { useCallback, useEffect, useRef } from 'react';
import type { SemanticMapping } from '../cesium/modelPresentation';
import { ContextDock } from './ContextDock';
import './ModuleInfo.css';
import { useModuleTelemetry } from '../telemetry/useModuleTelemetry';
import { ModuleTelemetryReadings, ModuleTelemetrySource } from '../telemetry/ModuleTelemetry';

interface ModuleInfoProps {
  module: SemanticMapping | null;
  onClose: () => void;
  historical?: boolean;
  acceptedAt?: string;
}

/** Source-model identity, function and backend-owned real telemetry.
 * Only a settled resource enters the card, as in Crew's complete detail reveal.
 * Retained complete content is an inert exit snapshot;
 * App's module prop remains the sole selected state.
 */
export function ModuleInfo({ module, onClose, historical = false, acceptedAt }: ModuleInfoProps) {
  const selected = module?.status === 'VERIFIED' ? module : null;
  const last = useRef<{ module: SemanticMapping; telemetry: ReturnType<typeof useModuleTelemetry> } | null>(null);
  const resource = useModuleTelemetry(selected?.componentId ?? '', historical ? acceptedAt ?? null : null, !!selected && (!historical || !!acceptedAt));
  const ready = selected && (resource.data || resource.error) ? { module: selected, telemetry: resource } : null;
  if (ready) last.current = ready;
  const snapshot = selected ? ready : last.current;
  const pending = !!selected && !ready;
  // Selection can still be cancelled before the data-ready dock owns Escape.
  useEffect(() => {
    if (!pending) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('[role="dialog"],dialog')) return;
      const credits = document.querySelector<HTMLElement>('.cesium-credit-lightbox-overlay');
      if (credits && getComputedStyle(credits).display !== 'none') return;
      event.preventDefault(); event.stopPropagation(); onClose();
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [pending, onClose]);
  const restoreFocus = useCallback(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('.earth-view canvas');
    if (canvas) { canvas.tabIndex = 0; canvas.focus({ preventScroll: true }); }
  }, []);
  if (!snapshot) return null;
  const { module: shown, telemetry } = snapshot;
  return <ContextDock open={!!selected} title={shown.displayName}
    context={<><span>{shown.agency ?? 'Agency unavailable'}</span><span className="module-type"> · {shown.componentType}</span></>} entityId={shown.componentId}
    closeLabel="Close module information" onClose={onClose} className="module-dock" sceneEscape onRestoreFocus={restoreFocus}>
    <section className="module-role"><h3>Function</h3><p>{shown.role ?? 'Role unavailable for this mapped component'}</p></section>
    <ModuleTelemetryReadings data={telemetry.data} loading={telemetry.loading} error={telemetry.error} />
    <section><h3>Supporting technical detail</h3><dl>
      <div><dt>Module ID</dt><dd className="module-code">{shown.componentId}</dd></div>
      <div><dt>Asset node</dt><dd className="module-code">{shown.nodeIndex}</dd></div>
      <div className="module-type-row"><dt>Component type</dt><dd>{shown.componentType}</dd></div>
    </dl><ModuleTelemetrySource data={telemetry.data} />
    </section>
  </ContextDock>;
}
