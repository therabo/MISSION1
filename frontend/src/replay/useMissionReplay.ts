import { useEffect, useRef, useState } from "react";
import {
  fetchReplay,
  fetchReplayCoverage,
  type ReplayResult,
  type ReplayCoverage,
} from "./replayApi";
/** User-driven reads only; debounce, abort and request identity prevent stale acceptance. */
export function useMissionReplay(enabled: boolean, at: string) {
  const [data, setData] = useState<ReplayResult | null>(null),
    [coverage, setCoverage] = useState<ReplayCoverage | null>(null),
    [error, setError] = useState<string | null>(null),
    [loading, setLoading] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void fetchReplayCoverage(controller.signal)
      .then(result => { if (!controller.signal.aborted) setCoverage(result); })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [enabled]);
  useEffect(() => {
    const id = ++generation.current;
    setData(null);
    setError(null);
    setLoading(enabled);
    if (!enabled) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetchReplay(at, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted && id === generation.current)
            setData(result);
        })
        .catch((e) => {
          if (!controller.signal.aborted && id === generation.current)
            setError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted && id === generation.current)
            setLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, at]);
  return {
    data: data && Date.parse(data.requestedAt) === Date.parse(at) ? data : null,
    coverage,
    error,
    loading,
  };
}
