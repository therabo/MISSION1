import type { ReactNode } from 'react';
import type { BufferStatus } from '../orbital/bufferState';
import type { PositionSnapshot, TrajectorySource } from '../cesium/trajectorySelection';

interface Props {
  position: PositionSnapshot | null;
  selectedSource: TrajectorySource;
  sceneTimeMs: number | null;
  buffer: BufferStatus;
  quality: ReactNode;
}

function coordinate(value: number, positive: string, negative: string) {
  return `${Math.abs(value).toFixed(3)}° ${value < 0 ? negative : positive}`;
}

export function OperationalSummary({ position, selectedSource, sceneTimeMs, buffer, quality }: Props) {
  // The renderer owns the physical sample. Never substitute lifted display coordinates,
  // a previous source, or a last-known sample after its bounded buffer has expired.
  const physical = buffer === 'active' && position?.source === selectedSource && position.timeMs === sceneTimeMs &&
    [position.latitudeDegrees, position.longitudeDegrees, position.altitudeMeters].every(Number.isFinite) ? position : null;
  return <section className="operational-summary" aria-label="ISS operational summary">
    <div className="summary-identity"><strong>ISS / WGS84</strong><span>{selectedSource === 'PRIMARY_GP_TLE' ? 'Computed position' : 'Predicted position'}</span></div>
    <dl className="summary-position">
      <div><dt>Latitude</dt><dd>{physical ? coordinate(physical.latitudeDegrees, 'N', 'S') : 'Unavailable'}</dd></div>
      <div><dt>Longitude</dt><dd>{physical ? coordinate(physical.longitudeDegrees, 'E', 'W') : 'Unavailable'}</dd></div>
      <div><dt>Altitude</dt><dd>{physical ? `${(physical.altitudeMeters / 1000).toFixed(1)} km` : 'Unavailable'}</dd></div>
    </dl>
    {quality}
  </section>;
}
