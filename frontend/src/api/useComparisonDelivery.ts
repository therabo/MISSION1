import { useEffect, useState } from 'react';
import { parseComparison, type ComparisonResponse } from '../orbital/comparison';

export interface ComparisonDelivery {
  response: ComparisonResponse | null;
  status: 'loading' | 'ready' | 'unavailable';
}

export function useComparisonDelivery(): ComparisonDelivery {
  const [delivery, setDelivery] = useState<ComparisonDelivery>({ response: null, status: 'loading' });
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    async function poll(): Promise<void> {
      controller = new AbortController();
      try {
        const response = await fetch('/api/iss/orbit/comparison', { signal: controller.signal });
        if (!response.ok) throw new Error('Comparison unavailable');
        const parsed = parseComparison(await response.json());
        if (!stopped) setDelivery({ response: parsed, status: 'ready' });
      } catch {
        if (!stopped && !controller.signal.aborted) setDelivery({ response: null, status: 'unavailable' });
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
  }, []);
  return delivery;
}
