import { Cartesian3, JulianDate, ReferenceFrame, type SampledPositionProperty } from 'cesium';
import type { ComparisonResponse } from '../orbital/comparison';
import type { ViewMode } from './inspectionMode';
import type { VisualWindow } from './visualWindow';
import { makeSampledPosition } from './sampleProperty';

export type TrajectorySource = 'PRIMARY_GP_TLE' | 'NASA_OEM';
export const DEFAULT_TRAJECTORY_SOURCE: TrajectorySource = 'PRIMARY_GP_TLE';
export const COMPARISON_VALID_SECONDS = 300;
export const SOURCE_LABELS = {
  PRIMARY_GP_TLE: 'MISSION1 GP/TLE propagated state',
  NASA_OEM: 'NASA predicted ephemeris',
} as const;

/** Project response-age limit; coverage, not receipt age alone, governs stored OEM usability. */
export function oemUnavailableReason(response: ComparisonResponse | null, sceneMs: number | null): string | null {
  if (!response || sceneMs === null) return 'Waiting for NASA OEM';
  if (response.oem.availability === 'UNAVAILABLE') return response.oem.reason.replaceAll('_', ' ');
  if (Math.abs(sceneMs - Date.parse(response.generatedAt)) > COMPARISON_VALID_SECONDS * 1000) return 'OEM display buffer expired';
  const { source, samples } = response.oem;
  if (!source || samples.length < 2 || sceneMs < Date.parse(source.startTime) || sceneMs > Date.parse(source.stopTime) ||
      sceneMs < Date.parse(samples[0].time) || sceneMs > Date.parse(samples[samples.length - 1].time)) return 'OEM does not cover scene time';
  return null;
}

/** A normal refresh may be slightly ahead of the backend-aligned scene clock.
 * Keep evaluating the previous bounded prediction until the new one covers that
 * clock, rather than freezing, extrapolating, or spuriously changing source.
 * True outages/coverage loss are adopted immediately; only a <=3s alignment seam waits.
 */
export function comparisonCanReplace(previous: ComparisonResponse | null, incoming: ComparisonResponse,
  sceneMs: number | null): boolean {
  if (sceneMs === null || oemUnavailableReason(previous, sceneMs) || incoming.oem.availability === 'UNAVAILABLE') return true;
  const generated = Date.parse(incoming.generatedAt);
  const first = incoming.oem.samples[0];
  return !(first && Date.parse(first.time) <= generated && generated > sceneMs && generated - sceneMs <= 3000);
}

export function requestedSource(current: TrajectorySource, next: TrajectorySource, mode: ViewMode,
  response: ComparisonResponse | null, sceneMs: number | null): TrajectorySource {
  if (mode !== 'EARTH_OVERVIEW' || (next === 'NASA_OEM' && oemUnavailableReason(response, sceneMs))) return current;
  return next;
}

export function effectiveSource(requested: TrajectorySource, response: ComparisonResponse | null,
  sceneMs: number): TrajectorySource {
  return requested === 'NASA_OEM' && oemUnavailableReason(response, sceneMs) ? 'PRIMARY_GP_TLE' : requested;
}

export function oemPositionProperty(response: ComparisonResponse): SampledPositionProperty {
  return makeSampledPosition(response.oem.samples);
}

/** One physical sampled target for model, approach and moving Inspection ENU pivot.
 * A source change selects a property immediately, with no cross-source interpolation.
 * OEM remains bounded; the mandatory primary animation buffer gates both products.
 */
export function selectedPositionAt(source: TrajectorySource, primary: VisualWindow | null,
  oem: SampledPositionProperty | null, time: JulianDate, result: Cartesian3): Cartesian3 | undefined {
  const sceneMs = JulianDate.toDate(time).getTime();
  if (!primary || sceneMs < primary.orbital.startMs || sceneMs > primary.orbital.endMs) return undefined;
  const property = source === 'NASA_OEM' ? oem : primary.position;
  return property?.getValueInReferenceFrame(time, ReferenceFrame.FIXED, result);
}

export interface PositionSnapshot {
  source: TrajectorySource;
  timeMs: number;
  latitudeDegrees: number;
  longitudeDegrees: number;
  altitudeMeters: number;
}
