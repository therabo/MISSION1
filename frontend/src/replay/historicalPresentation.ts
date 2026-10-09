import type { ReplayResult, ReplayState } from './replayApi';
import type { TrajectorySource } from '../cesium/trajectorySelection';

/** Presentation only: the existing hook/API remain the committed-time authority. */
export function stepHistoricalUtc(at: string, seconds: -600 | 600, now = Date.now()): string {
  const next = Date.parse(at) + seconds * 1000;
  return Number.isFinite(next) && next <= now ? new Date(next).toISOString() : at;
}

export function coherentHistoricalState(data: ReplayResult | null, at: string): ReplayState | null {
  const state = data?.orbit.primary;
  return state && Date.parse(data.requestedAt) === Date.parse(at) && Date.parse(state.effectiveAt) === Date.parse(at) ? state : null;
}

/** Match the very same primary state consumed by EarthView, never Current preference. */
export function historicalSource(state: ReplayState | null): TrajectorySource | null {
  return state?.source.kind === 'NASA_OEM' ? 'NASA_OEM' : state?.source.kind === 'GP_TLE' ? 'PRIMARY_GP_TLE' : null;
}
