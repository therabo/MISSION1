import type { ModelLoadStatus, SemanticMapping } from './modelPresentation';
import { Cartesian3, Ellipsoid, IntersectionTests, Ray } from 'cesium';

export type ViewMode = 'EARTH_OVERVIEW' | 'ENTERING_INSPECTION' | 'ISS_INSPECTION' | 'EXITING_INSPECTION';
export type ViewEvent = 'ENTER' | 'ENTRY_COMPLETE' | 'EXIT' | 'EXIT_COMPLETE';

export const INITIAL_VIEW_MODE: ViewMode = 'EARTH_OVERVIEW';

export function nextViewMode(mode: ViewMode, event: ViewEvent): ViewMode {
  if (event === 'ENTER' && mode === 'EARTH_OVERVIEW') return 'ENTERING_INSPECTION';
  if (event === 'ENTRY_COMPLETE' && mode === 'ENTERING_INSPECTION') return 'ISS_INSPECTION';
  if (event === 'EXIT' && (mode === 'ENTERING_INSPECTION' || mode === 'ISS_INSPECTION')) return 'EXITING_INSPECTION';
  if (event === 'EXIT_COMPLETE' && mode === 'EXITING_INSPECTION') return 'EARTH_OVERVIEW';
  return mode;
}

export function smoothstep(progress: number): number {
  const p = Math.max(0, Math.min(1, progress));
  return p * p * (3 - 2 * p);
}

const directionOrthogonal = new Cartesian3();

/** Shortest stable turn between directions, including the opposite-vector case. */
export function interpolateUnitDirection(start: Cartesian3, end: Cartesian3, progress: number, result: Cartesian3): Cartesian3 {
  const p = Math.max(0, Math.min(1, progress));
  const a = Cartesian3.magnitude(start);
  const b = Cartesian3.magnitude(end);
  const dot = Math.max(-1, Math.min(1, Cartesian3.dot(start, end) / (a * b)));
  if (p === 0) return Cartesian3.normalize(start, result);
  if (p === 1) return Cartesian3.normalize(end, result);
  if (dot < -0.9995) {
    directionOrthogonal.x = end.x / b - start.x / a * dot;
    directionOrthogonal.y = end.y / b - start.y / a * dot;
    directionOrthogonal.z = end.z / b - start.z / a * dot;
    if (Cartesian3.magnitudeSquared(directionOrthogonal) < 1e-16) {
      Cartesian3.mostOrthogonalAxis(start, directionOrthogonal);
      Cartesian3.cross(start, directionOrthogonal, directionOrthogonal);
    }
    Cartesian3.normalize(directionOrthogonal, directionOrthogonal);
    const angle = Math.acos(dot);
    result.x = start.x / a * Math.cos(angle * p) + directionOrthogonal.x * Math.sin(angle * p);
    result.y = start.y / a * Math.cos(angle * p) + directionOrthogonal.y * Math.sin(angle * p);
    result.z = start.z / a * Math.cos(angle * p) + directionOrthogonal.z * Math.sin(angle * p);
  } else if (dot > 0.9995) {
    result.x = start.x / a * (1 - p) + end.x / b * p;
    result.y = start.y / a * (1 - p) + end.y / b * p;
    result.z = start.z / a * (1 - p) + end.z / b * p;
  } else {
    const angle = Math.acos(dot);
    const sine = Math.sin(angle);
    const aw = Math.sin((1 - p) * angle) / sine;
    const bw = Math.sin(p * angle) / sine;
    result.x = start.x / a * aw + end.x / b * bw;
    result.y = start.y / a * aw + end.y / b * bw;
    result.z = start.z / a * aw + end.z / b * bw;
  }
  return Cartesian3.normalize(result, result);
}

const occlusionRay = new Ray(new Cartesian3(), new Cartesian3());

/** Whether the WGS84 globe interrupts the segment from camera to station. */
export function earthOccludes(camera: Cartesian3, station: Cartesian3): boolean {
  const distance = Cartesian3.distance(camera, station);
  Cartesian3.clone(camera, occlusionRay.origin);
  Cartesian3.normalize(Cartesian3.subtract(station, camera, occlusionRay.direction), occlusionRay.direction);
  const intersection = IntersectionTests.rayEllipsoid(occlusionRay, Ellipsoid.WGS84);
  return !!intersection && intersection.start < distance - 1;
}

export type IssPick =
  | { kind: 'iss-entity' | 'iss-model' }
  | { kind: 'iss-feature'; module: SemanticMapping | null }
  | { kind: 'other' | 'empty' };

export type PickAction = 'enter-inspection' | 'select-module' | 'clear-module' | 'none';

/** Resolve identity before camera distance; far geometry enters inspection but never names a module. */
export function pickAction(mode: ViewMode, pick: IssPick, modelReady: boolean): PickAction {
  if (mode === 'EARTH_OVERVIEW') {
    return modelReady && ['iss-entity', 'iss-model', 'iss-feature'].includes(pick.kind)
      ? 'enter-inspection' : 'none';
  }
  if (mode !== 'ISS_INSPECTION') return 'none';
  return pick.kind === 'iss-feature' && pick.module ? 'select-module' : 'clear-module';
}

export function canInspect(model: ModelLoadStatus, validBuffer: boolean): boolean {
  return model === 'ready' && validBuffer;
}

export function inspectionPresentation(mode: ViewMode): {
  pathVisible: boolean; locatorVisible: boolean; backVisible: boolean;
} {
  const overview = mode === 'EARTH_OVERVIEW' || mode === 'EXITING_INSPECTION';
  return { pathVisible: overview, locatorVisible: overview, backVisible: !overview };
}
