import { OperationalSummary } from '../components/OperationalSummary';
import { OrbitalDetailsCloseButton } from '../components/OrbitalDetailsCloseButton';
import { coherentHistoricalState, historicalSource } from './historicalPresentation';
import type { ReplayResult } from './replayApi';

interface Props { data: ReplayResult | null; at: string; loading: boolean; error: string | null; sceneError: string | null; detailOnly?: boolean }

export function HistoricalOrbitalSummary({ data, at, loading, error, sceneError, detailOnly = false }: Props) {
  const state = coherentHistoricalState(data, at);
  const source = historicalSource(state);
  const waiting = !state && !error && (loading || !data || Date.parse(data.requestedAt) !== Date.parse(at));
  const availability = data?.orbit.availability;
  // Historical OEM does not use the current-response 300s display buffer.
  // Use its retained-state availability as delivered; do not infer OEM quality.
  const status = !source ? waiting ? 'Waiting' : 'Unavailable' : source === 'NASA_OEM'
    ? availability === 'AVAILABLE' ? 'Available' : availability === 'DEGRADED' ? 'Degraded' :
      availability === 'UNCOVERED' ? 'Uncovered' : availability === 'EXPIRED' ? 'Expired' : availability === 'UNAVAILABLE' ? 'Unavailable' : availability ?? 'Unavailable'
    : state!.quality === 'GOOD' ? 'Good' : state!.quality === 'STALE' ? 'Stale' : state!.quality === 'UNKNOWN' ? 'Unknown' : state!.quality;
  const label = source === 'NASA_OEM' ? 'NASA OEM status' : source ? 'General Perturbations quality' : 'Orbital source status';
  const tone = status === 'Available' || status === 'Good' ? 'good' : status === 'Waiting' || status === 'Unknown' ? 'unknown' : 'warning';
  const lineage = state ? `${state.source.kind} · ${state.source.classification} · Effective UTC: ${state.effectiveAt} · Frame: ${state.frame} · Source epoch: ${state.source.epoch ?? state.source.creationAt ?? 'Unavailable'} · Retrieved: ${state.source.retrievedAt} · Hash: ${state.source.contentHash} · Signed propagation offset: ${state.source.signedPropagationOffsetSeconds ?? 'Unavailable'} s` : 'Historical position unavailable';
  const position = state && source ? { source, timeMs: Date.parse(state.effectiveAt), latitudeDegrees: state.latitudeDegrees, longitudeDegrees: state.longitudeDegrees, altitudeMeters: state.altitudeMeters } : null;
  const notice = sceneError ?? error ?? (waiting ? 'Loading historical state…' : !state ? 'Orbit history unavailable at this instant.' : null);
  if (detailOnly) return <>
    <div id="orbital-status-evidence" className="orbital-status-evidence" role="region" aria-label="Historical orbital state">
      <div className="panel-head"><OrbitalDetailsCloseButton /><h2>ISS historical state</h2>
      <p>{state ? state.source.classification.replaceAll('_', ' ').toLowerCase() : 'Historical position unavailable'}</p></div>
      <dl>
        <div className="data-line"><dt>Effective UTC</dt><dd>{state?.effectiveAt ?? at}</dd></div>
        <div className="data-line"><dt>{label}</dt><dd>{status}</dd></div>
        <div className="data-line"><dt>Latitude</dt><dd>{state ? `${state.latitudeDegrees.toFixed(3)}°` : 'Unavailable'}</dd></div>
        <div className="data-line"><dt>Longitude</dt><dd>{state ? `${state.longitudeDegrees.toFixed(3)}°` : 'Unavailable'}</dd></div>
        <div className="data-line"><dt>Altitude</dt><dd>{state ? `${(state.altitudeMeters / 1000).toFixed(1)} km` : 'Unavailable'}</dd></div>
      </dl>
      <p className="historical-lineage">{lineage}</p>
    </div>
    {notice && <p id="historical-orbit-notice" className="earth-current-notice" role={error || sceneError ? 'alert' : 'status'}>{notice}</p>}
  </>;
  return <>
    <OperationalSummary position={position} selectedSource={source} sceneTimeMs={Date.parse(at)} buffer={position ? 'active' : 'waiting'}
      sourceStatus={<div className="source-state-slot"><div className="source-state-content" aria-describedby={notice ? 'historical-orbit-notice' : undefined} title={[lineage, sceneError ?? error].filter(Boolean).join(' · ')}>
        <span>{label}</span><strong className={`summary-quality ${tone}`}>{status}</strong>
      </div></div>} />
    {notice && <p id="historical-orbit-notice" className="sr-only" role={error || sceneError ? 'alert' : 'status'}>{notice}</p>}
  </>;
}
