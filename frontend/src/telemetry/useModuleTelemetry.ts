import { useEffect, useRef, useState } from 'react';
import { getModuleTelemetry, type ModuleTelemetry } from './telemetryApi';

export const TELEMETRY_REFRESH_MS = 60_000;
/** Serial local reads; selected identity and accepted time invalidate obsolete results. */
export function useModuleTelemetry(componentId: string, at: string | null, active: boolean) {
  const key = `${componentId}|${at ?? 'CURRENT'}|${active}`;
  const generation = useRef(0);
  const [result, setResult] = useState<{ key: string; data: ModuleTelemetry | null; error: boolean; loading: boolean }>({ key, data: null, error: false, loading: active });
  // A new selection, accepted UTC or reopening starts a new resource lifetime.
  // Reset before paint so a previous opening cannot expose a stale ready card.
  let currentResult = result;
  if (result.key !== key) {
    currentResult = { key, data: null, error: false, loading: active };
    setResult(currentResult);
  }
  useEffect(() => {
    const id = ++generation.current;
    if (!active) return;
    let current = true, running = false, completed = false;
    const visible = () => document.visibilityState !== 'hidden';
    let controller: AbortController | null = null, timer: ReturnType<typeof setTimeout> | undefined;
    const run = async () => {
      if (!current || running || !visible()) return;
      running = true; controller = new AbortController();
      setResult(previous => ({ key, data: previous.key === key ? previous.data : null, error: false, loading: true }));
      try {
        const data = await getModuleTelemetry(componentId, at, controller.signal);
        if (current && !controller.signal.aborted && generation.current === id) setResult({ key, data, error: false, loading: false });
        completed = true;
      } catch {
        if (current && !controller.signal.aborted && generation.current === id) setResult(previous => ({ key, data: previous.key === key ? previous.data : null, error: true, loading: false }));
      } finally {
        running = false;
        if (current && at === null && visible()) timer = setTimeout(() => { void run(); }, TELEMETRY_REFRESH_MS);
      }
    };
    const visibility = () => { clearTimeout(timer); if (visible() && (at === null || !completed)) void run(); };
    void run();
    document.addEventListener('visibilitychange', visibility);
    return () => { current = false; clearTimeout(timer); controller?.abort(); document.removeEventListener('visibilitychange', visibility); };
  }, [componentId, at, active, key]);
  return currentResult;
}
