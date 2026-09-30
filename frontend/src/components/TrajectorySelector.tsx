import type { ViewMode } from '../cesium/inspectionMode';
import { SOURCE_LABELS } from '../cesium/trajectorySelection';
import type { TrajectorySource } from '../cesium/trajectorySelection';

interface Props {
  selectedSource: TrajectorySource;
  viewMode: ViewMode;
  oemReason: string | null;
  sourceNotice: string | null;
  onSelect: (source: TrajectorySource) => void;
}

export function TrajectorySelector({selectedSource, viewMode, oemReason, sourceNotice, onSelect}: Props) {
  return <div className="scene-legend trajectory-selector" aria-label="Position / trajectory source">
      <span className="mini-label">POSITION / TRAJECTORY SOURCE</span>
      <div className="source-options" role="group" aria-label="Choose position and trajectory source">
        <button type="button" aria-pressed={selectedSource === 'PRIMARY_GP_TLE'} disabled={viewMode !== 'EARTH_OVERVIEW'} onClick={() => onSelect('PRIMARY_GP_TLE')}>
          <i aria-hidden="true" />MISSION1 GP/TLE
        </button>
        <button type="button" aria-pressed={selectedSource === 'NASA_OEM'} disabled={viewMode !== 'EARTH_OVERVIEW' || !!oemReason} onClick={() => onSelect('NASA_OEM')}>
          <i aria-hidden="true" />NASA OEM
        </button>
      </div>
      <small>{SOURCE_LABELS[selectedSource]}</small>
      <small>{viewMode !== 'EARTH_OVERVIEW' ? 'Return to Earth View to change source' : oemReason ? `OEM unavailable · ${oemReason}` : 'Forward only · 85% revolution · active trail highlighted'}</small>
      {sourceNotice && <p className="source-notice" role="status">{sourceNotice}</p>}
    </div>;
}
