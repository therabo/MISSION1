import { Cartesian3, type ScreenSpaceCameraController } from 'cesium';
import type { ViewMode } from './inspectionMode';

export const INSPECTION_RANGE_METERS = 119;
export const MAX_INSPECTION_RANGE_METERS = 2000;
const keys = ['enableInputs', 'enableZoom', 'enableTranslate', 'enableLook', 'enableTilt', 'zoomFactor',
  'minimumZoomDistance', 'maximumZoomDistance', 'inertiaZoom', 'inertiaSpin', 'inertiaTranslate'] as const;

/** Native Cesium orbit with reversible settings; dedicated pivot zoom avoids globe-rate semantics. */
export function inspectionControlProfile(controller: ScreenSpaceCameraController): (mode: ViewMode) => void {
  const saved = Object.fromEntries(keys.map(key => [key, controller[key]]));
  return mode => {
    Object.assign(controller, saved);
    if (mode === 'ENTERING_INSPECTION' || mode === 'EXITING_INSPECTION') controller.enableInputs = false;
    if (mode === 'ISS_INSPECTION') Object.assign(controller, {
      enableInputs: true, enableZoom: false, enableTranslate: false, enableLook: false, enableTilt: false,
      minimumZoomDistance: 35, maximumZoomDistance: MAX_INSPECTION_RANGE_METERS,
      inertiaZoom: 0.3, inertiaSpin: 0.7, inertiaTranslate: 0,
    });
  };
}

/** Fractional wheel inputs remain fractional; at most 26% inward per event. */
export function inspectionZoomRange(range: number, wheelDelta: number): number {
  return range * Math.exp(-Math.max(-100, Math.min(100, wheelDelta)) * 0.003);
}

/** Touch spread ratio; at most one bounded deliberate gesture per update. */
export function inspectionPinchRange(range: number, previous: number, current: number): number {
  if (previous <= 0 || current <= 0) return range;
  return range * Math.max(0.7, Math.min(1.43, previous / current));
}

/** Stay outside the centered pinned GLB's conservative box, plus 5m clearance.
 * Direction-dependent bound permits close axial module views without entering
 * solar arrays during a lateral orbit. Coordinates use the shared visual frame.
 */
export function clampInspectionOffset(offset: Cartesian3): Cartesian3 {
  const range = Cartesian3.magnitude(offset);
  if (range < 1e-6) return Cartesian3.fromElements(-35, 0, 0, offset);
  const x = Math.abs(offset.x / range), y = Math.abs(offset.y / range), z = Math.abs(offset.z / range);
  const minimum = Math.max(35, Math.min(x > 1e-9 ? 29.5 / x : Infinity,
    y > 1e-9 ? 56 / y : Infinity, z > 1e-9 ? 34.6 / z : Infinity) + 5);
  return Cartesian3.multiplyByScalar(offset, Math.max(minimum, Math.min(MAX_INSPECTION_RANGE_METERS, range)) / range, offset);
}

/** Rear view; widen only for narrow aspect ratios, preserving canonical 119m. */
export function rearInspectionOffset(aspect: number, result: Cartesian3): Cartesian3 {
  return Cartesian3.fromElements(-INSPECTION_RANGE_METERS * Math.max(1, 1.2 / aspect), 0, 0, result);
}
