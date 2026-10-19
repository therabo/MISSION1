import { coherentHistoricalState } from './historicalPresentation';
import type { ReplayResult } from './replayApi';

interface Props { data: ReplayResult | null; at: string; loading: boolean; error: string | null; sceneError: string | null; inspecting: boolean }

/** Preserve Historical loading/error notices without the former quality/status presentation. */
export function HistoricalOrbitNotice({ data, at, loading, error, sceneError, inspecting }: Props) {
  const state = coherentHistoricalState(data, at);
  const waiting = !state && !error && (loading || !data || Date.parse(data.requestedAt) !== Date.parse(at));
  const notice = sceneError ?? error ?? (waiting ? 'Loading historical state…' : !state ? 'Orbit history unavailable at this instant.' : null);
  return notice ? <p className={inspecting ? 'earth-current-notice' : 'sr-only'} role={error || sceneError ? 'alert' : 'status'}>{notice}</p> : null;
}
