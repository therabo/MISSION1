import type { PositionSnapshot, TrajectorySource } from '../cesium/trajectorySelection';
import type { BufferStatus } from './bufferState';

export interface PositionReadoutProps {
  position: PositionSnapshot | null;
  selectedSource: TrajectorySource | null;
  sceneTimeMs: number | null;
  buffer: BufferStatus;
}

/** The existing physical readout contract; never last-known after expiry/source/time mismatch. */
export function acceptedPhysicalPosition({ position, selectedSource, sceneTimeMs, buffer }: PositionReadoutProps) {
  return buffer === 'active' && position?.source === selectedSource && position.timeMs === sceneTimeMs &&
    [position.latitudeDegrees, position.longitudeDegrees, position.altitudeMeters].every(Number.isFinite) ? position : null;
}
