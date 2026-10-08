import { useLayoutEffect, useRef } from 'react';
import { useOverlayPresence } from '../layout/useOverlayPresence';
import { CrewPanel } from './CrewPanel';
import './CurrentCrewWorkspace.css';

/** Presence owns presentation lifetime only. CrewPanel retains the real resource
 * and legacy lazy profile architecture; neither component owns scene state. */
export function CurrentCrewWorkspace({ open, onClose }: { open: boolean; onClose: () => void }) {
  const surface = useRef<HTMLDivElement>(null);
  const animation = useRef<Animation | null>(null);
  const presence = useOverlayPresence(open, surface);
  useLayoutEffect(() => {
    const node = surface.current;
    if (!node) { animation.current?.cancel(); animation.current = null; return; }
    const style = getComputedStyle(node);
    const from = animation.current ? Number(style.opacity) : open ? 0 : 1;
    animation.current?.cancel();
    const raw = style.getPropertyValue(presence.reducedMotion ? '--motion-fast' : open ? '--motion-dock' : '--motion-ui').trim();
    const ms = parseFloat(raw) * (raw.endsWith('ms') ? 1 : 1000);
    const duration = presence.reducedMotion ? Math.min(120, Number.isFinite(ms) ? ms : 120) : Number.isFinite(ms) ? ms : open ? 240 : 200;
    node.style.opacity = open ? '1' : '0';
    animation.current = node.animate?.({ opacity: [from, open ? 1 : 0] }, {
      duration, easing: presence.reducedMotion ? 'linear' : style.getPropertyValue(open ? '--ease-state' : '--ease-exit').trim() || (open ? 'cubic-bezier(.42,0,.58,1)' : 'cubic-bezier(.42,0,1,1)'),
    }) ?? null;
  }, [open, presence.present, presence.reducedMotion]);
  useLayoutEffect(() => () => animation.current?.cancel(), []);
  if (!presence.present) return null;
  return <div ref={surface} className="crew-workspace-host" data-state={presence.state}
    aria-hidden={!presence.interactive || undefined} inert={!presence.interactive}>
    <CrewPanel onClose={onClose} workspace interactive={presence.interactive} />
  </div>;
}
