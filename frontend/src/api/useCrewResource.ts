import { useCallback, useEffect, useState } from 'react';
import { getCrewMember, getCurrentCrew } from './crewApi';

export interface CrewResource<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}
/** Mounted only while its panel/detail is open. No polling or retained freshness cache. */
function useCrewResource<T>(load: (signal: AbortSignal) => Promise<T>): CrewResource<T> {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ data: T | null; loading: boolean; error: string | null }>({
    data: null,
    loading: true,
    error: null,
  });
  const refresh = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setResult((previous) => ({ ...previous, loading: true, error: null }));
    void load(controller.signal)
      .then((data) => {
        if (active) setResult({ data, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (active && !controller.signal.aborted)
          setResult((previous) => ({
            ...previous,
            loading: false,
            error: error instanceof Error ? error.message : 'Crew information is temporarily unavailable.',
          }));
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [load, attempt]);
  return { ...result, refresh };
}
export const useIssCrew = () => useCrewResource(getCurrentCrew);
export function useCrewMember(id: string) {
  const load = useCallback((signal: AbortSignal) => getCrewMember(id, signal), [id]);
  return useCrewResource(load);
}
