import { useRef } from 'react';
import { ContextButton } from '../components/ContextButton';
import { useOverlayPresence } from '../layout/useOverlayPresence';
import calendarTrigger from '../assets/interface/calendar-trigger.svg';

interface Props { open: boolean; at: string; onStep: (seconds: -600 | 600) => void; pending?: boolean; presentedAt?: string }

export function HistoricalTimeBar({ open, at, onStep, pending = false, presentedAt }: Props) {
  const bar = useRef<HTMLElement>(null);
  const presence = useOverlayPresence(open, bar, '--motion-compact', 160);
  if (!presence.present) return null;
  return <section ref={bar} className="historical-time-bar" aria-label="Historical UTC"
    data-state={presence.state} aria-hidden={!presence.interactive || undefined} inert={!presence.interactive}>
    <button type="button" className="historical-calendar-trigger" disabled aria-label="Calendar selection unavailable">
      <img src={calendarTrigger} alt="" width={36} height={36} />
    </button>
    <button type="button" className="historical-date" disabled aria-label="Historical UTC date" aria-busy={pending}
      title={pending ? `Requested UTC. Scene remains at ${presentedAt ?? 'its last coherent instant'} until this target is resolved.` : 'Requested Historical UTC'}>
      <time dateTime={at}>{new Date(at).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')}</time>
    </button>
    <div className="historical-steps">
      <ContextButton aria-label="Historical back 10 minutes" onClick={() => onStep(-600)}>-10 min</ContextButton>
      <ContextButton aria-label="Historical forward 10 minutes" disabled={Date.parse(at) + 600_000 > Date.now()} onClick={() => onStep(600)}>+10 min</ContextButton>
    </div>
  </section>;
}
