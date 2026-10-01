import type { ViewMode } from './inspectionMode';

/** Measured presentation window, not an orbital/source quality threshold. */
export const TRAJECTORY_VISIBILITY = { hiddenRangeMeters: 100_000, visibleRangeMeters: 10_000_000 } as const;

/** Shared entry/exit policy. Range is to the displayed station, including any
 * presentation translation. Capture the actual Overview range once so a nearer
 * Earth start also begins/ends at full opacity without a mode-boundary jump.
 * No timeline, source evaluation or projected bounds are needed here.
 */
export function trajectoryVisibilityForView(mode: ViewMode, displayRangeMeters: number,
  overviewRangeMeters: number = TRAJECTORY_VISIBILITY.visibleRangeMeters): number {
  if (mode === 'ISS_INSPECTION') return 0;
  if (mode === 'EARTH_OVERVIEW') return 1;
  if (!Number.isFinite(displayRangeMeters) || displayRangeMeters <= 0 ||
    !Number.isFinite(overviewRangeMeters) || overviewRangeMeters <= 0) return 0;
  const high = Math.min(TRAJECTORY_VISIBILITY.visibleRangeMeters, overviewRangeMeters);
  const low = Math.min(TRAJECTORY_VISIBILITY.hiddenRangeMeters, high / 2);
  const x = Math.max(0, Math.min(1, Math.log(Math.max(low, displayRangeMeters) / low) / Math.log(high / low)));
  return x * x * x * (10 + x * (-15 + 6 * x));
}
