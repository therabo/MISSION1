import { useEffect, useRef, useState } from 'react';
import { comparisonCanReplace } from '../cesium/trajectorySelection';
import { parseComparison, type ComparisonResponse } from '../orbital/comparison';

export interface ComparisonDelivery {
  response: ComparisonResponse | null;
  status: 'loading' | 'ready' | 'unavailable';
}

export function useComparisonDelivery(sceneTimeMs: number | null, enabled = true): ComparisonDelivery {
  const [delivery, setDelivery] = useState<ComparisonDelivery>({ response: null, status: 'loading' });
  const scene = useRef(sceneTimeMs);
  const accepted = useRef<ComparisonResponse | null>(null);
  const pending = useRef<ComparisonResponse | null>(null);
  scene.current = sceneTimeMs;
  useEffect(() => {
    const next = pending.current;
    if (next && comparisonCanReplace(accepted.current, next, sceneTimeMs)) {
      pending.current = null;
      accepted.current = next;
      setDelivery({ response: next, status: 'ready' });
    }
  }, [sceneTimeMs]);
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    async function poll(): Promise<void> {
      controller = new AbortController();
      try {
        const response = await fetch('/api/iss/orbit/comparison', { signal: controller.signal });
        if (!response.ok) throw new Error('Comparison unavailable');
        const parsed = parseComparison(await response.json());
        if (!stopped) {
          if (comparisonCanReplace(accepted.current, parsed, scene.current)) {
            pending.current = null;
            accepted.current = parsed;
            setDelivery({ response: parsed, status: 'ready' });
          } else pending.current = parsed;
        }
      } catch {
        if (!stopped && !controller.signal.aborted) {
          accepted.current = null;
          pending.current = null;
          setDelivery({ response: null, status: 'unavailable' });
        }
      } finally {
        controller = undefined;
        if (!stopped) timer = setTimeout(() => { void poll(); }, 120_000);
      }
    }
    void poll();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      controller?.abort();
    };
  }, [enabled]);
  return delivery;
}
