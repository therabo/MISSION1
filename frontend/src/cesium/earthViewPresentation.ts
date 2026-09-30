import { Cartesian3, Ellipsoid } from 'cesium';
import { smoothstep } from './inspectionMode';
import type { ViewMode } from './inspectionMode';

/** Presentation only, in meters along the WGS84 normal. Never an orbital altitude.
 * 2–10 km projected below 0.5 CSS px at the reviewed global camera; 75 km gives
 * about 3 px additional limb clearance for the deliberately enlarged model.
 */
export const EARTH_OVERVIEW_DISPLAY_LIFT_METERS = 75_000;
export const DISPLAY_LIFT_REMOVAL_FRACTION = 0.35;

export function enteringDisplayLift(progress: number): number {
  // Remove before the camera reaches close range, with zero endpoint derivatives.
  return EARTH_OVERVIEW_DISPLAY_LIFT_METERS * (1 - smoothstep(progress / DISPLAY_LIFT_REMOVAL_FRACTION));
}

export function returningDisplayLift(startLift: number, progress: number): number {
  return startLift + (EARTH_OVERVIEW_DISPLAY_LIFT_METERS - startLift) * smoothstep(progress);
}

export function displayLiftForMode(mode: ViewMode, entryProgress: number | null,
  returning: { startLift: number; progress: number } | null): number {
  if (mode === 'EARTH_OVERVIEW') return EARTH_OVERVIEW_DISPLAY_LIFT_METERS;
  if (mode === 'ENTERING_INSPECTION' && entryProgress !== null) return enteringDisplayLift(entryProgress);
  if (mode === 'EXITING_INSPECTION' && returning) return returningDisplayLift(returning.startLift, returning.progress);
  return 0;
}

/** Preserve the selected physical point; only the model receives this display point. */
export function modelDisplayPosition(physicalPosition: Cartesian3, liftMeters: number, result: Cartesian3): Cartesian3 {
  if (liftMeters === 0) return Cartesian3.clone(physicalPosition, result);
  Ellipsoid.WGS84.geodeticSurfaceNormal(physicalPosition, result);
  Cartesian3.multiplyByScalar(result, liftMeters, result);
  return Cartesian3.add(physicalPosition, result, result);
}
