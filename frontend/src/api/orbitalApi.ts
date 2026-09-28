import { parseOrbitalWindow } from '../orbital/sampleMapping';
import type { OrbitalWindow } from '../orbital/types';

export async function fetchOrbitalSamples(signal: AbortSignal): Promise<OrbitalWindow> {
  const started = performance.now();
  const response = await fetch('/api/iss/orbit/samples', { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) {
    if (response.status === 503) throw new Error('Orbital data unavailable; waiting for a verified element set.');
    throw new Error(`Orbital API returned HTTP ${response.status}.`);
  }
  const payload: unknown = await response.json();
  return parseOrbitalWindow(payload, performance.now() - started);
}
