import type { ViewMode } from '../cesium/inspectionMode';
import { SOURCE_LABELS } from '../cesium/trajectorySelection';
import type { TrajectorySource } from '../cesium/trajectorySelection';
import { TRAJECTORY_ACCENTS } from '../cesium/trajectoryRendering';
import { useEffect, useId, useLayoutEffect, useRef, type CSSProperties } from 'react';
import sourceChevron from '../assets/interface/source-chevron.svg';
import { useReducedMotion } from '../layout/useReducedMotion';

interface Props {
  selectedSource: TrajectorySource;
  viewMode: ViewMode;
  oemReason: string | null;
  sourceNotice: string | null;
  onSelect: (source: TrajectorySource) => void;
  presentation?: 'legacy' | 'context';
}

export function TrajectorySelector({selectedSource, viewMode, oemReason, sourceNotice, onSelect, presentation = 'legacy'}: Props) {
  const descriptionId = useId();
  const reducedMotion = useReducedMotion();
  const sourceLabel = useRef<HTMLSpanElement>(null);
  const previousSource = useRef(selectedSource);
  const emphasis = useRef<Animation | null>(null);
  useLayoutEffect(() => {
    const changed = previousSource.current !== selectedSource;
    previousSource.current = selectedSource;
    const label = sourceLabel.current;
    // Continue an interrupted emphasis from its current opacity. The real select
    // value, availability and physical sample are never delayed by this effect.
    const from = emphasis.current?.playState === 'running' && label ? Number(getComputedStyle(label).opacity) : 0;
    emphasis.current?.cancel();
    emphasis.current = null;
    if (!changed || reducedMotion || sourceNotice || !label?.animate) return;
    const style = getComputedStyle(label);
    const rawDuration = style.getPropertyValue('--motion-dock').trim();
    const duration = parseFloat(rawDuration) * (rawDuration.endsWith('ms') ? 1 : 1000);
    emphasis.current = label.animate({ opacity: [from, 1] }, {
      duration: Number.isFinite(duration) ? duration : 240,
      easing: style.getPropertyValue('--ease-state').trim() || 'cubic-bezier(0.42,0,0.58,1)',
    });
  }, [selectedSource, reducedMotion, sourceNotice, oemReason]);
  useEffect(() => () => emphasis.current?.cancel(), []);
  if (presentation === 'context') return <div className="context-source">
    <label htmlFor={`${descriptionId}-select`}>SOURCE</label>
    <div className="context-source-control">
      <select id={`${descriptionId}-select`} aria-label="Orbital source" aria-describedby={descriptionId}
        value={selectedSource} disabled={viewMode !== 'EARTH_OVERVIEW'}
        onChange={event => {
          const next = event.target.value;
          if ((next === 'PRIMARY_GP_TLE' || next === 'NASA_OEM') && viewMode === 'EARTH_OVERVIEW' && !(next === 'NASA_OEM' && oemReason)) onSelect(next);
        }}>
        <option value="PRIMARY_GP_TLE">GP/TLE</option>
        <option value="NASA_OEM" disabled={!!oemReason}>NASA OEM{ oemReason ? ' — unavailable' : '' }</option>
      </select>
      <span ref={sourceLabel} className="context-source-value" aria-hidden="true">{selectedSource === 'NASA_OEM' ? 'NASA OEM' : 'GP/TLE'}</span>
      <img src={sourceChevron} className="source-select-chevron" alt="" />
    </div>
    <span id={descriptionId} className="sr-only">{SOURCE_LABELS[selectedSource]}. {viewMode !== 'EARTH_OVERVIEW'
      ? 'Return to Earth View to change source' : oemReason ? `OEM unavailable · ${oemReason}` : 'NASA OEM is source-provided predicted ephemeris.'}</span>
    {sourceNotice && <span className="sr-only" role="status">{sourceNotice}</span>}
  </div>;
  return <div className="scene-legend trajectory-selector" aria-label="Position / trajectory source">
      <span className="mini-label">POSITION / TRAJECTORY SOURCE</span>
      <div className="source-options" role="group" aria-label="Choose position and trajectory source">
        <button type="button" style={{'--source-accent': TRAJECTORY_ACCENTS.PRIMARY_GP_TLE} as CSSProperties} aria-pressed={selectedSource === 'PRIMARY_GP_TLE'} disabled={viewMode !== 'EARTH_OVERVIEW'} onClick={() => onSelect('PRIMARY_GP_TLE')}>
          <i aria-hidden="true" />MISSION1 GP/TLE
        </button>
        <button type="button" style={{'--source-accent': TRAJECTORY_ACCENTS.NASA_OEM} as CSSProperties} aria-pressed={selectedSource === 'NASA_OEM'} disabled={viewMode !== 'EARTH_OVERVIEW' || !!oemReason} onClick={() => onSelect('NASA_OEM')}>
          <i aria-hidden="true" />NASA OEM
        </button>
      </div>
      <small>{SOURCE_LABELS[selectedSource]}</small>
      <small>{viewMode !== 'EARTH_OVERVIEW' ? 'Return to Earth View to change source' : oemReason ? `OEM unavailable · ${oemReason}` : 'Forward only · 85% revolution · active trail highlighted'}</small>
      {sourceNotice && <p className="source-notice" role="status">{sourceNotice}</p>}
    </div>;
}
