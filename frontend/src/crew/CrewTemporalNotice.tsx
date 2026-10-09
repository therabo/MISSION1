import { utc } from './presentation';

/** Request feedback is separate from the accepted roster/date. No clock or data
 * is owned here; retry is an explicit read through the existing replay hook. */
export interface CrewTemporalRequest {
  historical: boolean;
  at: string;
  pending: boolean;
  error: string | null;
  onRetry: () => void;
}

export function CrewTemporalNotice({ request }: { request?: CrewTemporalRequest }) {
  if (!request) return null;
  if (request.error) return <div className="crew-error" role="alert">
    <p>Historical request for {utc(request.at)} failed: {request.error}</p>
    <p>The previous accepted context remains displayed.</p>
    <button type="button" onClick={request.onRetry}>Retry historical crew</button>
  </div>;
  return request.pending ? <p className="crew-temporal-pending" role="status">
    {request.historical ? `Resolving Historical target ${utc(request.at)}.` : 'Preparing Current context.'}
    {' '}Showing the previous accepted context.
  </p> : null;
}
