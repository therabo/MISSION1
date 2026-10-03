import { decodeCrew, decodeExpedition, decodePerson } from '../crew/decode';

export class CrewApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'CrewApiError';
  }
}
async function get<T>(path: string, decode: (payload: unknown) => T, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal, cache: 'no-store', headers: { Accept: 'application/json' } });
  if (!response.ok) {
    // Do not reflect arbitrary server/HTML error text into the product.
    throw new CrewApiError(
      response.status,
      response.status === 404
        ? 'This astronaut profile is unavailable.'
        : response.status === 503
          ? 'Crew information is temporarily unavailable.'
          : `Crew request failed (HTTP ${response.status}).`,
    );
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error: unknown) {
    if (signal.aborted) throw error;
    throw new Error('Crew API returned an invalid JSON response.');
  }
  return decode(payload);
}
export const getCurrentCrew = (signal: AbortSignal) => get('/api/iss/crew', decodeCrew, signal);
export const getCurrentExpedition = (signal: AbortSignal) =>
  get('/api/iss/expedition/current', decodeExpedition, signal);
export const getCrewMember = (id: string, signal: AbortSignal) =>
  get(`/api/iss/crew/${encodeURIComponent(id)}`, decodePerson, signal);
