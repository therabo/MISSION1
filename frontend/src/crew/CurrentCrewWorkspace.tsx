import { useLayoutEffect, useRef } from 'react';
import { useOverlayPresence } from '../layout/useOverlayPresence';
import { CrewPanel } from './CrewPanel';
import { useIssCrew } from '../api/useCrewResource';
import { ReplayCrewPanel } from '../replay/ReplayCrewPanel';
import type { ReplayResult } from '../replay/replayApi';
import { CrewTemporalNotice, type CrewTemporalRequest } from './CrewTemporalNotice';
import './CurrentCrewWorkspace.css';

/** Shared Crew presentation lifetime only; accepted temporal context and the
 * real resource remain separate. No component here owns scene state. */
interface Props {
  open: boolean; onClose: () => void;
  historical?: { at: string; data: ReplayResult } | null;
  request?: CrewTemporalRequest;
}
export function CurrentCrewWorkspace({ open, onClose, historical, request }: Props) {
  const surface = useRef<HTMLDivElement>(null);
  const animation = useRef<Animation | null>(null);
  const presence = useOverlayPresence(open, surface);
  useLayoutEffect(() => {
    const node = surface.current;
    if (!node) { animation.current?.cancel(); animation.current = null; return; }
    const style = getComputedStyle(node);
    const from = animation.current ? Number(style.opacity) : open ? 0 : 1;
    animation.current?.cancel();
    const raw = style.getPropertyValue(presence.reducedMotion ? '--motion-fast' : open && !historical ? '--motion-dock' : '--motion-ui').trim();
    const ms = parseFloat(raw) * (raw.endsWith('ms') ? 1 : 1000);
    const duration = presence.reducedMotion ? Math.min(120, Number.isFinite(ms) ? ms : 120) : Number.isFinite(ms) ? ms : open && !historical ? 240 : 200;
    node.style.opacity = open ? '1' : '0';
    animation.current = node.animate?.({ opacity: [from, open ? 1 : 0] }, {
      duration, easing: presence.reducedMotion ? 'linear' : style.getPropertyValue(open ? '--ease-state' : '--ease-exit').trim() || (open ? 'cubic-bezier(.42,0,.58,1)' : 'cubic-bezier(.42,0,1,1)'),
    }) ?? null;
  }, [open, presence.present, presence.reducedMotion]);
  useLayoutEffect(() => () => animation.current?.cancel(), []);
  if (!presence.present) return null;
  return <div ref={surface} className="crew-workspace-host" data-state={presence.state}
    aria-hidden={!presence.interactive || undefined} inert={!presence.interactive}>
    <CrewWorkspaceContent historical={historical} request={request} onClose={onClose}
      interactive={presence.interactive} reducedMotion={presence.reducedMotion} />
  </div>;
}

/** One resource for the open Crew session preserves the real Current response
 * through a handoff. It is never passed to the Historical presentation. Closing
 * the session aborts it. Current polling pauses during Historical presentation. */
function CrewWorkspaceContent({ historical, request, onClose, interactive, reducedMotion }: Omit<Props, 'open'> & {
  interactive: boolean; reducedMotion: boolean;
}) {
  const current = useIssCrew(interactive && !historical);
  const group = useRef<HTMLDivElement>(null);
  const motion = useRef<Animation | null>(null);
  const acceptedKey = historical ? `historical:${historical.at}` : 'current';
  const previousKey = useRef(acceptedKey);
  useLayoutEffect(() => {
    if (previousKey.current === acceptedKey) return;
    const returnedToCurrent = !historical;
    previousKey.current = acceptedKey;
    motion.current?.cancel();
    motion.current = group.current?.animate?.({ opacity: [0, 1] }, {
      duration: reducedMotion ? 120 : 200, easing: reducedMotion ? 'linear' : 'cubic-bezier(0.42,0,0.58,1)',
    }) ?? null;
    // Temporal return requests fresh Current data while preserving the previous roster.
    if (returnedToCurrent) current.refresh();
  }, [acceptedKey, historical, reducedMotion, current.refresh]);
  useLayoutEffect(() => () => motion.current?.cancel(), []);
  return <div className="crew-workspace-group" ref={group} data-temporal-context={historical ? 'historical' : 'current'}>
    {historical ? <ReplayCrewPanel data={historical.data} at={historical.at} loading={false} error={null}
      request={request} interactive={interactive} onClose={onClose} />
      : <CrewPanel resource={current} notice={<CrewTemporalNotice request={request} />} workspace interactive={interactive} onClose={onClose} />}
  </div>;
}
