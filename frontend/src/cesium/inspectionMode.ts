import type { ModelLoadStatus, SemanticMapping } from './modelPresentation';
import { Cartesian3, Ellipsoid, IntersectionTests, JulianDate, Matrix4, Ray, Transforms } from 'cesium';

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

/** A camera navigation frame at the existing sampled position, never ISS attitude. */
export function cameraTrackingFrame(position: Cartesian3, result?: Matrix4): Matrix4 {
  return Transforms.eastNorthUpToFixedFrame(position, undefined, result);
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
  if (dot < -0.9995) {
    Cartesian3.mostOrthogonalAxis(start, directionOrthogonal);
    Cartesian3.normalize(Cartesian3.cross(start, directionOrthogonal, directionOrthogonal), directionOrthogonal);
    result.x = start.x / a * Math.cos(Math.PI * p) + directionOrthogonal.x * Math.sin(Math.PI * p);
    result.y = start.y / a * Math.cos(Math.PI * p) + directionOrthogonal.y * Math.sin(Math.PI * p);
    result.z = start.z / a * Math.cos(Math.PI * p) + directionOrthogonal.z * Math.sin(Math.PI * p);
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

/** Cesium HeadingPitchRange expressed as a Cartesian offset in the target's ENU frame. */
export function inspectionCartesianOffset(heading: number, pitch: number, range: number, result: Cartesian3): Cartesian3 {
  const horizontal = Math.cos(pitch) * range;
  result.x = -Math.sin(heading) * horizontal;
  result.y = Math.cos(heading) * horizontal;
  result.z = -Math.sin(pitch) * range;
  return result;
}

/** Interpolate camera-relative offset while targeting the current sampled ISS point. */
export function movingApproachOffset(start: Cartesian3, end: Cartesian3, progress: number, result: Cartesian3): Cartesian3 {
  const p = Math.max(0, Math.min(1, progress));
  if (p === 0) return Cartesian3.clone(start, result);
  if (p === 1) return Cartesian3.clone(end, result);
  const startRange = Cartesian3.magnitude(start);
  const endRange = Cartesian3.magnitude(end);
  const turn = smoothstep(p);
  const weight = Math.exp(Math.log(startRange) * (1 - turn) + Math.log(endRange) * turn);
  // The direction changes inside the moving ENU frame; the range is explicit.
  interpolateUnitDirection(start, end, turn, result);
  return Cartesian3.multiplyByScalar(result, weight, result);
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

/** Keep an occulted initial camera above the globe while acquiring the station's radial direction. */
const acquisitionOrthogonal = new Cartesian3();
export function radialAcquisitionPosition(start: Cartesian3, station: Cartesian3, progress: number, result: Cartesian3): Cartesian3 {
  // First clear the highest WGS84 radius along the starting radial, then
  // rotate on that outer shell. A polar start could otherwise cut the equator.
  const climb = smoothstep(Math.min(1, progress / 0.2));
  const p = smoothstep(Math.max(0, (progress - 0.2) / 0.8));
  const a = Cartesian3.magnitude(start);
  const b = Cartesian3.magnitude(station);
  const shellRadius = Math.max(a, b + 1_000_000, Ellipsoid.WGS84.maximumRadius + 1_000_000);
  const dot = Math.max(-1, Math.min(1, Cartesian3.dot(start, station) / (a * b)));
  const angle = Math.acos(dot);
  const sine = Math.sin(angle);
  if (sine <= 1e-6 && dot < 0) {
    Cartesian3.mostOrthogonalAxis(start, acquisitionOrthogonal);
    Cartesian3.normalize(Cartesian3.cross(start, acquisitionOrthogonal, acquisitionOrthogonal), acquisitionOrthogonal);
    result.x = start.x / a * Math.cos(Math.PI * p) + acquisitionOrthogonal.x * Math.sin(Math.PI * p);
    result.y = start.y / a * Math.cos(Math.PI * p) + acquisitionOrthogonal.y * Math.sin(Math.PI * p);
    result.z = start.z / a * Math.cos(Math.PI * p) + acquisitionOrthogonal.z * Math.sin(Math.PI * p);
  } else {
    const startWeight = sine > 1e-6 ? Math.sin((1 - p) * angle) / sine : 1 - p;
    const endWeight = sine > 1e-6 ? Math.sin(p * angle) / sine : p;
    result.x = start.x / a * startWeight + station.x / b * endWeight;
    result.y = start.y / a * startWeight + station.y / b * endWeight;
    result.z = start.z / a * startWeight + station.z / b * endWeight;
  }
  Cartesian3.normalize(result, result);
  return Cartesian3.multiplyByScalar(result, a + (shellRadius - a) * climb, result);
}

const pathOffset = new Cartesian3();
const pathPosition = new Cartesian3();

/** Sample the intended camera path once at entry; an Earth-intersecting path uses acquisition. */
export function movingApproachPathClear(station: Cartesian3, startOffset: Cartesian3, endOffset: Cartesian3, frame: Matrix4 = cameraTrackingFrame(station)): boolean {
  for (let step = 0; step <= 32; step++) {
    movingApproachOffset(startOffset, endOffset, step / 32, pathOffset);
    Matrix4.multiplyByPoint(frame, pathOffset, pathPosition);
    if ((Ellipsoid.WGS84.cartesianToCartographic(pathPosition)?.height ?? -1) < 1_000 || earthOccludes(pathPosition, station)) return false;
  }
  return true;
}

/** Presentation-only footprint; the GLB scale and sampled orbital position do not change. */
export function approachMinimumPixelSize(farSize: number, _progress: number): number {
  return farSize;
}

export function exitMinimumPixelSize(farSize: number, currentSize: number, progress: number): number {
  return currentSize + (farSize - currentSize) * smoothstep(progress);
}

/** Preserve animation progress if a refreshed backend window realigns scene time. */
export function rebaseApproachStartTime(startTime: JulianDate, oldSceneTime: JulianDate, newSceneTime: JulianDate): void {
  JulianDate.addSeconds(startTime, JulianDate.secondsDifference(newSceneTime, oldSceneTime), startTime);
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
