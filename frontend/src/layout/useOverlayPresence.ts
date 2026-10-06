import { useEffect, useRef, useState, type RefObject } from 'react';
import { useReducedMotion } from './useReducedMotion';

function duration(element: HTMLElement | null, token: string, fallback: number) {
  const raw = element && getComputedStyle(element).getPropertyValue(token).trim();
  if (!raw) return fallback;
  const value = parseFloat(raw);
  return Number.isFinite(value) ? value * (raw.endsWith('ms') ? 1 : 1000) : fallback;
}

/** Keep an exit visible, but inert. A reopened overlay cancels that exit. */
export function useOverlayPresence(open: boolean, element: RefObject<HTMLElement | null>) {
  const reducedMotion = useReducedMotion();
  const [present, setPresent] = useState(open);
  const latestOpen = useRef(open);
  latestOpen.current = open;
  useEffect(() => {
    if (open) {
      setPresent(true);
      return;
    }
    if (!present) return;
    const delay = reducedMotion
      ? Math.min(120, duration(element.current, '--motion-fast', 120))
      : duration(element.current, '--motion-ui', 200);
    const timer = window.setTimeout(() => {
      if (!latestOpen.current) setPresent(false);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [open, present, reducedMotion, element]);
  return { present: open || present, interactive: open, state: open ? 'open' : 'exiting', reducedMotion } as const;
}
