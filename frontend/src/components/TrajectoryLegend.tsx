import type { TrajectorySource } from '../cesium/trajectorySelection';
interface Props { selectedSource: TrajectorySource | null; oemReason: string | null; pending?: boolean }

export function TrajectoryLegend({ selectedSource, oemReason, pending = false }: Props) {
  const nasa = selectedSource === 'NASA_OEM';
  return <div className="trajectory-legend" role="group" aria-label="Active orbital source">
    {!selectedSource ? <span>{pending ? 'Source pending' : 'Unavailable'}</span> : <span title={nasa ? (oemReason ? `NASA OEM unavailable: ${oemReason}` : 'NASA source-provided predicted ephemeris') : 'Computed from GP/TLE orbital elements'}>
      <i className={`trajectory-swatch ${nasa ? 'oem' : 'gp'}`} aria-hidden="true" />{nasa ? 'NASA OEM' : 'GP/TLE'}
    </span>}
  </div>;
}
