import type { BufferStatus } from '../orbital/bufferState';
import type { PositionSnapshot, TrajectorySource } from '../cesium/trajectorySelection';

export interface PositionReadoutProps {
  position: PositionSnapshot | null;
  selectedSource: TrajectorySource | null;
  sceneTimeMs: number | null;
  buffer: BufferStatus;
}

function coordinate(value: number, positive: string, negative: string) {
  return `${Math.abs(value).toFixed(3)}° ${value < 0 ? negative : positive}`;
}

/** Shared physical readouts for Earth and Inspection; never lifted model coordinates. */
export function PositionReadouts({ position, selectedSource, sceneTimeMs, buffer }: PositionReadoutProps) {
  // Never substitute a previous source or a last-known sample after buffer expiry.
  const physical = buffer === 'active' && position?.source === selectedSource && position.timeMs === sceneTimeMs &&
    [position.latitudeDegrees, position.longitudeDegrees, position.altitudeMeters].every(Number.isFinite) ? position : null;
  return <dl className="summary-position">
    <div className="summary-latitude"><dt>Latitude</dt><dd className={!physical ? 'measurement-unavailable' : undefined}>{physical ? coordinate(physical.latitudeDegrees, 'N', 'S') : 'Unavailable'}</dd></div>
    <div className="summary-longitude"><dt>Longitude</dt><dd className={!physical ? 'measurement-unavailable' : undefined}>{physical ? coordinate(physical.longitudeDegrees, 'E', 'W') : 'Unavailable'}</dd></div>
    <div className="summary-altitude"><dt>Altitude</dt><dd className={!physical ? 'measurement-unavailable' : undefined}>{physical ? `${(physical.altitudeMeters / 1000).toFixed(1)} km` : 'Unavailable'}</dd></div>
  </dl>;
}
