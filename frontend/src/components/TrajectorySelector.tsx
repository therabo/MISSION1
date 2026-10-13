import type { ViewMode } from '../cesium/inspectionMode';
import { SOURCE_LABELS } from '../cesium/trajectorySelection';
import type { TrajectorySource } from '../cesium/trajectorySelection';
import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import sourceChevron from '../assets/interface/source-chevron.svg';
import { useReducedMotion } from '../layout/useReducedMotion';

interface Props {
  selectedSource: TrajectorySource | null;
  viewMode: ViewMode;
  oemReason: string | null;
  sourceNotice: string | null;
  onSelect: (source: TrajectorySource) => void;
  automatic?: boolean;
  emptyLabel?: 'Waiting' | 'Unavailable';
}

export function TrajectorySelector({selectedSource, viewMode, oemReason, sourceNotice, onSelect, automatic = false, emptyLabel = 'Waiting'}: Props) {
  const descriptionId = useId();
  const reducedMotion = useReducedMotion();
  const sourceLabel = useRef<HTMLSpanElement>(null);
  const previousSource = useRef(selectedSource);
  const previousAutomatic = useRef(automatic);
  const emphasis = useRef<Animation | null>(null);
  useLayoutEffect(() => {
    const changed = previousSource.current !== selectedSource;
    const temporalChanged = previousAutomatic.current !== automatic;
    previousSource.current = selectedSource;
    previousAutomatic.current = automatic;
    const label = sourceLabel.current;
    // Continue an interrupted emphasis from its current opacity. The real select
    // value, availability and physical sample are never delayed by this effect.
    const from = emphasis.current?.playState === 'running' && label ? Number(getComputedStyle(label).opacity) : 0;
    emphasis.current?.cancel();
    emphasis.current = null;
    if (!changed || temporalChanged || automatic || reducedMotion || sourceNotice || !label?.animate) return;
    const style = getComputedStyle(label);
    const rawDuration = style.getPropertyValue('--motion-dock').trim();
    const duration = parseFloat(rawDuration) * (rawDuration.endsWith('ms') ? 1 : 1000);
    emphasis.current = label.animate({ opacity: [from, 1] }, {
      duration: Number.isFinite(duration) ? duration : 240,
      easing: style.getPropertyValue('--ease-state').trim() || 'cubic-bezier(0.42,0,0.58,1)',
    });
  }, [selectedSource, automatic, reducedMotion, sourceNotice, oemReason]);
  useEffect(() => () => emphasis.current?.cancel(), []);
  return <div className={`context-source${automatic ? ' is-automatic' : ''}`}>
    <label htmlFor={`${descriptionId}-select`}>SOURCE</label>
    <div className="context-source-control">
      <select id={`${descriptionId}-select`} aria-label="Orbital source" aria-describedby={descriptionId}
        value={selectedSource ?? ''} disabled={automatic || viewMode !== 'EARTH_OVERVIEW'}
        onChange={event => {
          const next = event.target.value;
          if (!automatic && (next === 'PRIMARY_GP_TLE' || next === 'NASA_OEM') && viewMode === 'EARTH_OVERVIEW' && !(next === 'NASA_OEM' && oemReason)) onSelect(next);
        }}>
        {!selectedSource && <option value="">{emptyLabel}</option>}
        <option value="PRIMARY_GP_TLE">GP/TLE</option>
        <option value="NASA_OEM" disabled={!!oemReason}>NASA OEM{ oemReason ? ' — unavailable' : '' }</option>
      </select>
      <span ref={sourceLabel} className="context-source-value" aria-hidden="true">{selectedSource === 'NASA_OEM' ? 'NASA OEM' : selectedSource ? 'GP/TLE' : emptyLabel}</span>
      <img src={sourceChevron} className="source-select-chevron" alt="" />
    </div>
    <span id={descriptionId} className="sr-only">{selectedSource ? SOURCE_LABELS[selectedSource] : emptyLabel}. {automatic ? 'Historical source is selected automatically from retained evidence.' : viewMode !== 'EARTH_OVERVIEW'
      ? 'Return to Earth View to change source' : oemReason ? `OEM unavailable · ${oemReason}` : 'NASA OEM is source-provided predicted ephemeris.'}</span>
    {sourceNotice && <span className="sr-only" role="status">{sourceNotice}</span>}
  </div>;
}
