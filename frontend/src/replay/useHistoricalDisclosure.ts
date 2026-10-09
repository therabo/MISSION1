import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore,
  type FocusEvent, type PointerEvent } from 'react';

export type HistoricalDisclosure = 'COLLAPSED' | 'EXPANDED' | 'CALENDAR_OPEN';
export const HISTORICAL_IDLE_MS = 4_000;
// Matches the existing mobile representation breakpoint in styles.css.
const mobileQuery = '(max-width: 740px)';
function subscribe(notify: () => void) {
  const media = window.matchMedia?.(mobileQuery);
  media?.addEventListener('change', notify);
  return () => media?.removeEventListener('change', notify);
}

/** Presentation only: the requested/accepted Historical instant remains in App. */
export function useHistoricalDisclosure(open: boolean) {
  const mobile = useSyncExternalStore(subscribe, () => window.matchMedia?.(mobileQuery).matches ?? false, () => false);
  const [state, setState] = useState<HistoricalDisclosure>(mobile ? 'COLLAPSED' : 'EXPANDED');
  const expanded = useRef(false);
  expanded.current = open && mobile && state === 'EXPANDED';
  const timer = useRef<number | null>(null);
  const pointers = useRef(new Set<number>());
  const keyboard = useRef(false), keyboardFocus = useRef(false);
  const cancelTimer = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const activity = useCallback(() => {
    cancelTimer();
    // Portal focus events can arrive during a commit with the previous handler.
    if (!expanded.current || pointers.current.size || keyboardFocus.current) return;
    timer.current = window.setTimeout(() => {
      timer.current = null;
      if (expanded.current && !pointers.current.size && !keyboardFocus.current) setState('COLLAPSED');
    }, HISTORICAL_IDLE_MS);
  }, [cancelTimer, open, mobile, state]);

  useLayoutEffect(() => {
    cancelTimer(); pointers.current.clear(); keyboardFocus.current = false;
    setState(previous => open && previous === 'CALENDAR_OPEN' ? previous : mobile ? 'COLLAPSED' : 'EXPANDED');
  }, [open, mobile, cancelTimer]);
  useEffect(() => {
    activity();
    return cancelTimer;
  }, [activity, cancelTimer]);
  useEffect(() => {
    if (!open || !mobile) return;
    const key = () => { keyboard.current = true; };
    const pointer = () => {
      keyboard.current = false;
      // Clicking the scene can leave a mouse-focused button in the bar.
      if (keyboardFocus.current) { keyboardFocus.current = false; activity(); }
    };
    const release = (event: globalThis.PointerEvent) => {
      if (pointers.current.delete(event.pointerId)) activity();
    };
    document.addEventListener('keydown', key, true);
    document.addEventListener('pointerdown', pointer, true);
    document.addEventListener('pointerup', release, true);
    document.addEventListener('pointercancel', release, true);
    return () => {
      document.removeEventListener('keydown', key, true);
      document.removeEventListener('pointerdown', pointer, true);
      document.removeEventListener('pointerup', release, true);
      document.removeEventListener('pointercancel', release, true);
      pointers.current.clear();
    };
  }, [open, mobile, activity]);

  return { mobile, state, setState, cancelTimer, activity,
    interaction: {
      onPointerDownCapture: (event: PointerEvent<HTMLElement>) => {
        pointers.current.add(event.pointerId); keyboardFocus.current = false; cancelTimer();
      },
      onPointerMove: activity,
      onClickCapture: activity,
      onKeyDownCapture: () => { keyboard.current = true; keyboardFocus.current = true; cancelTimer(); },
      onFocusCapture: () => { keyboardFocus.current = keyboard.current; activity(); },
      onBlurCapture: (event: FocusEvent<HTMLElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          keyboardFocus.current = false; activity();
        }
      },
    },
  };
}
