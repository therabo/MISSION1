import { useLayoutEffect, useRef, type RefObject } from 'react';
import { useReducedMotion } from './useReducedMotion';

/** Animate chrome alone. The existing camera state machine owns spatial motion. */
export function useWorkspaceDissolve(root: RefObject<HTMLElement | null>, inspection: boolean) {
  const previous = useRef(inspection);
  const animations = useRef<Animation[]>([]);
  const reduced = useReducedMotion();
  const previousReduced = useRef(reduced);
  useLayoutEffect(() => {
    const changed = previous.current !== inspection;
    if (!changed && previousReduced.current === reduced) return;
    previous.current = inspection;
    previousReduced.current = reduced;
    animations.current.forEach(animation => animation.cancel());
    animations.current = [];
    if (!changed) return;
    const owner = root.current;
    if (!owner) return;
    const style = getComputedStyle(owner);
    const token = style.getPropertyValue(reduced ? '--motion-fast' : '--motion-workspace').trim();
    const duration = parseFloat(token) * (token.endsWith('ms') ? 1 : 1000);
    for (const element of owner.querySelectorAll<HTMLElement>('.inspection-strip, .earth-current-ui > .operational-summary')) {
      if (element.animate) animations.current.push(element.animate({ opacity: [0, 1] }, {
        duration: Number.isFinite(duration) ? duration : reduced ? 120 : 280,
        easing: reduced ? 'linear' : style.getPropertyValue('--ease-state').trim() || 'cubic-bezier(0.42,0,0.58,1)',
      }));
    }
  }, [inspection, root, reduced]);
  useLayoutEffect(() => () => animations.current.forEach(animation => animation.cancel()), []);
}
