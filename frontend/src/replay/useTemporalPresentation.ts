import { useState } from 'react';
import type { ComparisonDelivery } from '../api/useComparisonDelivery';
import type { OrbitalDelivery } from '../orbital/bufferState';
import type { TrajectorySource } from '../cesium/trajectorySelection';
import type { ReplayResult } from './replayApi';

export type TemporalPresentation =
  | { kind: 'current'; delivery: OrbitalDelivery; comparison: ComparisonDelivery; source: TrajectorySource }
  | { kind: 'historical'; at: string; data: ReplayResult };

interface Input {
  historical: boolean; at: string; data: ReplayResult | null;
  delivery: OrbitalDelivery; comparison: ComparisonDelivery; source: TrajectorySource;
}

/** A presentation latch, not a second replay clock or orbital store. Retain
 * references to the accepted envelope until its replacement is authoritative.
 * The requested replayAt and request identity still belong to useMissionReplay.
 */
export function useTemporalPresentation(input: Input) {
  const { historical, at, data, delivery, comparison, source } = input;
  const now = Date.now();
  // Same backend alignment as EarthView, advanced by elapsed wall time only
  // when preparing a Current return. No historical target is interpolated.
  const [receipt, setReceipt] = useState({ window: delivery.window, wallMs: now });
  const accepted = receipt.window === delivery.window ? receipt : { window: delivery.window, wallMs: now };
  if (accepted !== receipt) setReceipt(accepted);
  const currentAtMs = delivery.window
    ? delivery.window.generatedMs + delivery.window.requestDurationMs / 2 + now - accepted.wallMs : now;
  const [presented, setPresented] = useState<TemporalPresentation>({ kind: 'current', delivery, comparison, source });
  let next = presented;
  if (historical) {
    if (data && Date.parse(data.requestedAt) === Date.parse(at) &&
        (!data.orbit.primary || Date.parse(data.orbit.primary.effectiveAt) === Date.parse(at))) {
      if (presented.kind !== 'historical' || presented.data !== data)
        next = { kind: 'historical', at, data };
    }
  } else {
    const usable = delivery.window && currentAtMs >= delivery.window.startMs && currentAtMs <= delivery.window.endMs &&
      (source !== 'NASA_OEM' || comparison.status !== 'loading');
    // A transport failure is authoritative too: present its honest availability
    // instead of retaining an apparently live Historical scene indefinitely.
    if (presented.kind === 'current' || usable || delivery.status === 'degraded' || delivery.status === 'unavailable') {
      if (presented.kind !== 'current' || presented.delivery.window !== delivery.window || presented.delivery.status !== delivery.status ||
          presented.delivery.message !== delivery.message || presented.comparison.response !== comparison.response ||
          presented.comparison.status !== comparison.status || presented.source !== source)
        next = { kind: 'current', delivery, comparison, source };
    }
  }
  // React retries this component before committing, so labels and renderer get
  // the same accepted context in one commit (no effect-delayed UI snapshot).
  if (next !== presented) setPresented(next);
  const holding = historical ? next.kind !== 'historical' || Date.parse(next.at) !== Date.parse(at) : next.kind !== 'current';
  return { presented: next, holding, currentAtMs };
}
