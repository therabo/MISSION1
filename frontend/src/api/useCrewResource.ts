import { useCallback, useEffect, useRef, useState } from 'react';
import { getCrewMember, getCurrentCrew } from './crewApi';

export interface CrewResource<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}
export const CURRENT_CREW_REFRESH_MS = 120_000;
/** Serial same-origin reads. Profiles remain lazy; only visible Current sessions poll. */
function useCrewResource<T>(load: (signal: AbortSignal) => Promise<T>, active = true, pollMs?: number): CrewResource<T> {
  const [attempt, setAttempt] = useState(0);
  const lastCompleted = useRef<number | null>(null);
  const lastAttempt = useRef(-1);
  const [result, setResult] = useState<{ data: T | null; loading: boolean; error: string | null }>({
    data: null,
    loading: true,
    error: null,
  });
  const refresh = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    if (!active) return;
    const manual = lastAttempt.current !== attempt;
    lastAttempt.current = attempt;
    let current = true, running = false;
    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = async () => {
      if (!current || running || pollMs && document.visibilityState === 'hidden') return;
      running = true;
      controller = new AbortController();
      setResult((previous) => ({ ...previous, loading: true, error: null }));
      try {
        const data = await load(controller.signal);
        if (current && !controller.signal.aborted) setResult({ data, loading: false, error: null });
      } catch (error) {
        if (current && !controller.signal.aborted) setResult(previous => ({ ...previous, loading: false,
          error: error instanceof Error ? error.message : 'Crew information is temporarily unavailable.' }));
      } finally {
        running = false;
        if (current && !controller.signal.aborted) lastCompleted.current = Date.now();
        if (current && pollMs && document.visibilityState !== 'hidden') timer = setTimeout(() => { void run(); }, pollMs);
      }
    };
    const visibility = () => {
      clearTimeout(timer);
      if (document.visibilityState !== 'hidden') void run();
    };
    const remaining = pollMs && lastCompleted.current !== null ? pollMs - (Date.now() - lastCompleted.current) : 0;
    if (!manual && remaining > 0) timer = setTimeout(() => { void run(); }, remaining);
    else void run();
    if (pollMs) document.addEventListener('visibilitychange', visibility);
    return () => {
      current = false;
      clearTimeout(timer);
      controller?.abort();
      if (pollMs) document.removeEventListener('visibilitychange', visibility);
    };
  }, [load, attempt, active, pollMs]);
  return { ...result, refresh };
}
export const useIssCrew = (active = true) => useCrewResource(getCurrentCrew, active, CURRENT_CREW_REFRESH_MS);
export function useCrewMember(id: string) {
  const load = useCallback((signal: AbortSignal) => getCrewMember(id, signal), [id]);
  return useCrewResource(load);
}
