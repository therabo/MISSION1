import type { ReactNode } from 'react';
import type { BufferStatus } from '../orbital/bufferState';
import type { PositionSnapshot, TrajectorySource } from '../cesium/trajectorySelection';

interface Props {
  position: PositionSnapshot | null;
  selectedSource: TrajectorySource;
  sceneTimeMs: number | null;
  buffer: BufferStatus;
  sourceStatus?: ReactNode;
}

function coordinate(value: number, positive: string, negative: string) {
  return `${Math.abs(value).toFixed(3)}° ${value < 0 ? negative : positive}`;
}

export function OperationalSummary({ position, selectedSource, sceneTimeMs, buffer, sourceStatus }: Props) {
  // The renderer owns the physical sample. Never substitute lifted display coordinates,
  // a previous source, or a last-known sample after its bounded buffer has expired.
  const physical = buffer === 'active' && position?.source === selectedSource && position.timeMs === sceneTimeMs &&
    [position.latitudeDegrees, position.longitudeDegrees, position.altitudeMeters].every(Number.isFinite) ? position : null;
  const nasaSelected = selectedSource === 'NASA_OEM';
  return <section className="operational-summary" aria-label="ISS operational summary">
    <div className="summary-identity"><strong>ISS / WGS84</strong><span>{nasaSelected ? 'Predicted ephemeris' : 'Computed position'}</span></div>
    <dl className="summary-position">
      <div className="summary-latitude"><dt>Latitude</dt><dd className={!physical ? 'measurement-unavailable' : undefined}>{physical ? coordinate(physical.latitudeDegrees, 'N', 'S') : 'Unavailable'}</dd></div>
      <div className="summary-longitude"><dt>Longitude</dt><dd className={!physical ? 'measurement-unavailable' : undefined}>{physical ? coordinate(physical.longitudeDegrees, 'E', 'W') : 'Unavailable'}</dd></div>
      <div className="summary-altitude"><dt>Altitude</dt><dd className={!physical ? 'measurement-unavailable' : undefined}>{physical ? `${(physical.altitudeMeters / 1000).toFixed(1)} km` : 'Unavailable'}</dd></div>
    </dl>
    {sourceStatus}
  </section>;
}
