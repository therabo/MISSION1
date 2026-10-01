import { Cartesian3, Ellipsoid, type Model } from 'cesium';
import { smootherstep } from './inspectionTransition';
import type { ViewMode } from './inspectionMode';

/** Presentation only, in meters along the WGS84 normal. Never an orbital altitude.
 * 2–10 km projected below 0.5 CSS px at the reviewed global camera; 75 km gives
 * about 3 px additional limb clearance for the deliberately enlarged model.
 */
export const EARTH_OVERVIEW_DISPLAY_LIFT_METERS = 75_000;
export const DISPLAY_LIFT_REMOVAL_FRACTION = 0.35;
export const OVERVIEW_SILHOUETTE = { sizePixels: 0.5, alpha: 0.12 } as const;

/** Same early smooth removal as the model-only lift; never changes PBR materials. */
export function silhouetteForMode(mode: ViewMode, entryProgress: number | null,
  returning: { startVisibility: number; progress: number } | null,
  result = { sizePixels: 0, alpha: 0, visibility: 0 }): { sizePixels: number; alpha: number; visibility: number } {
  let visibility = 0;
  if (mode === 'EARTH_OVERVIEW') visibility = 1;
  else if (mode === 'ENTERING_INSPECTION' && entryProgress !== null) visibility = 1 - smootherstep(entryProgress / DISPLAY_LIFT_REMOVAL_FRACTION);
  else if (mode === 'EXITING_INSPECTION' && returning) visibility = returning.startVisibility +
    (1 - returning.startVisibility) * smootherstep(returning.progress);
  result.sizePixels = OVERVIEW_SILHOUETTE.sizePixels * visibility;
  result.alpha = OVERVIEW_SILHOUETTE.alpha * visibility;
  result.visibility = visibility;
  return result;
}

export function enteringDisplayLift(progress: number): number {
  // Remove before the camera reaches close range, with zero endpoint derivatives.
  return EARTH_OVERVIEW_DISPLAY_LIFT_METERS * (1 - smootherstep(progress / DISPLAY_LIFT_REMOVAL_FRACTION));
}

export function returningDisplayLift(startLift: number, progress: number): number {
  return startLift + (EARTH_OVERVIEW_DISPLAY_LIFT_METERS - startLift) * smootherstep(progress);
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
  if (result === physicalPosition) throw new Error('Display output must not alias the canonical physical position');
  if (liftMeters === 0) return Cartesian3.clone(physicalPosition, result);
  Ellipsoid.WGS84.geodeticSurfaceNormal(physicalPosition, result);
  Cartesian3.multiplyByScalar(result, liftMeters, result);
  return Cartesian3.add(physicalPosition, result, result);
}

/** Retain the compiled silhouette pipeline through zero visibility. A positive
 * subpixel width and negligible alpha prevent zero-visibility shader rebuilds.
 * Keep the pipeline valid even if Cesium rebuilds other model resources while
 * inspecting; 1e-12 alpha rounds to zero in the display buffer. Restore source surfaces
 * in Inspection through the public culling property, without editing geometry.
 */
export function applyModelSilhouette(model: Pick<Model, 'silhouetteSize' | 'silhouetteColor' | 'backFaceCulling'>,
  presentation: { sizePixels: number; alpha: number }): void {
  model.silhouetteSize = Math.max(1e-6, presentation.sizePixels);
  model.silhouetteColor.alpha = Math.max(1e-12, presentation.alpha);
  model.backFaceCulling = presentation.alpha === 0;
}
