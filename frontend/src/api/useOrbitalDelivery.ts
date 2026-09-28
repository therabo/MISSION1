import { useEffect, useState } from 'react';
import { fetchOrbitalSamples } from './orbitalApi';
import { adoptWindow, deliveryFailure, initialDelivery } from '../orbital/bufferState';
import type { OrbitalDelivery } from '../orbital/bufferState';

const REFRESH_MS = 120_000;

export function useOrbitalDelivery(): OrbitalDelivery {
  const [delivery, setDelivery] = useState<OrbitalDelivery>(initialDelivery);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight: AbortController | undefined;

    async function poll(): Promise<void> {
      inFlight = new AbortController();
      try {
        const next = await fetchOrbitalSamples(inFlight.signal);
        if (!stopped) setDelivery((previous) => adoptWindow(previous, next));
      } catch (failure) {
        if (!stopped && !(failure instanceof DOMException && failure.name === 'AbortError')) {
          const message = failure instanceof Error ? failure.message : 'Orbital response could not be used.';
          setDelivery((previous) => deliveryFailure(previous, message));
        }
      } finally {
        inFlight = undefined;
        // Schedule after completion, so no refresh can overlap an outstanding request.
        if (!stopped) timer = setTimeout(() => { void poll(); }, REFRESH_MS);
      }
    }
    void poll();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      inFlight?.abort();
    };
  }, []);
  return delivery;
}
