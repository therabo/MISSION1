import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { ContextButton } from '../components/ContextButton';
import { ControlIcon } from '../components/ControlIcon';
import { useOverlayPresence } from '../layout/useOverlayPresence';
import calendarTrigger from '../assets/interface/calendar-trigger.svg';
import { HistoricalCalendar } from './HistoricalCalendar';
import { calendarDraftFromUtc, validateCalendarDraft, type CalendarDraft } from './calendarDraft';
import type { Coverage } from './replayApi';
import { useHistoricalDisclosure } from './useHistoricalDisclosure';

interface Props { open: boolean; at: string; onStep: (seconds: -600 | 600) => void; pending?: boolean; presentedAt?: string;
  coverage?: Coverage | null; onApply?: (at: string) => void }

function captureCalendarMotion(phase: 'enter' | 'exit') {
  const panel = document.getElementById('historical-calendar');
  if (!panel) return;
  const style = getComputedStyle(panel);
  const matrix = style.transform.startsWith('matrix(') ? style.transform.slice(7, -1).split(',').map(Number) : [];
  panel.style.setProperty(`--calendar-${phase}-opacity`, style.opacity || '1');
  panel.style.setProperty(`--calendar-${phase}-y`, `${matrix[5] ?? 0}px`);
}

export function HistoricalTimeBar({ open, at, onStep, pending = false, presentedAt, coverage = null, onApply }: Props) {
  const bar = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const { mobile, state, setState, cancelTimer, interaction } = useHistoricalDisclosure(open);
  const calendarOpen = state === 'CALENDAR_OPEN' && open;
  const collapsed = mobile && state === 'COLLAPSED';
  const barHidden = mobile && calendarOpen;
  const [calendarDraft, setCalendarDraft] = useState<CalendarDraft | null>(null);
  const focusAfterClose = useRef(false), previousState = useRef(state);
  const interactive = useRef(false);
  interactive.current = calendarOpen;
  const presence = useOverlayPresence(open, bar, '--motion-compact', 160);
  const restoreFocus = useCallback(() => {
    if (open) (collapsed ? trigger.current : opener.current ?? trigger.current)?.focus({ preventScroll: true });
    else document.querySelector<HTMLButtonElement>('.context-temporal button:first-child')?.focus({ preventScroll: true });
  }, [open, collapsed]);
  const closeCalendar = useCallback((applied = false) => {
    if (!interactive.current) return;
    captureCalendarMotion('exit');
    cancelTimer(); interactive.current = false; focusAfterClose.current = true;
    setState(mobile && applied ? 'COLLAPSED' : 'EXPANDED'); setCalendarDraft(null);
  }, [cancelTimer, mobile, setState]);
  const cancelCalendar = useCallback(() => closeCalendar(), [closeCalendar]);
  useLayoutEffect(() => {
    // Restore only after the destination controls have become visible.
    if (focusAfterClose.current && !calendarOpen) {
      focusAfterClose.current = false; restoreFocus();
    } else if (collapsed && previousState.current === 'EXPANDED' && bar.current?.contains(document.activeElement)) {
      trigger.current?.focus({ preventScroll: true });
    }
    previousState.current = state;
  }, [calendarOpen, collapsed, state, restoreFocus]);
  useEffect(() => {
    if (!open) setCalendarDraft(null);
  }, [open]);
  const toggleCalendar = (event: MouseEvent<HTMLButtonElement>) => {
    if (!open) return;
    if (collapsed) { setState('EXPANDED'); return; }
    if (interactive.current) closeCalendar();
    else {
      cancelTimer(); opener.current = event.currentTarget; captureCalendarMotion('enter');
      setCalendarDraft(calendarDraftFromUtc(at)); setState('CALENDAR_OPEN'); interactive.current = true;
    }
  };
  const applyCalendar = () => {
    if (!interactive.current || !calendarDraft) return;
    const result = validateCalendarDraft(calendarDraft, coverage);
    if (!result.value) return;
    closeCalendar(true); onApply?.(result.value); // Exactly one domain target commit; no scene mutation here.
  };
  if (!presence.present) return null;
  // Preserve the project's ISO / UTC convention; compact text never uses local time.
  const utc = new Date(at).toISOString();
  const timestamp = utc.replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
  return <section ref={bar} id="historical-controls" className="historical-time-bar" aria-label="Historical UTC" {...interaction}
    data-state={presence.state} data-disclosure={state} data-mobile={mobile}
    aria-hidden={!presence.interactive || barHidden || undefined} inert={!presence.interactive || barHidden}>
    <button ref={trigger} type="button" className="historical-calendar-trigger" onClick={toggleCalendar}
      aria-label={collapsed ? 'Open Historical controls' : 'Open Historical calendar'}
      aria-haspopup={collapsed ? undefined : 'dialog'} aria-expanded={collapsed ? false : calendarOpen}
      aria-controls={collapsed ? 'historical-controls' : 'historical-calendar'}>
      <img src={calendarTrigger} alt="" width={36} height={36} />
    </button>
    <button type="button" className="historical-date" hidden={collapsed} onClick={toggleCalendar} aria-label={`Historical UTC date: ${timestamp}`} aria-busy={pending}
      aria-haspopup="dialog" aria-expanded={calendarOpen} aria-controls="historical-calendar"
      title={pending ? `Requested UTC. Scene remains at ${presentedAt ?? 'its last coherent instant'} until this target is resolved.` : 'Requested Historical UTC'}>
      <time dateTime={at}>
        <span className="historical-timestamp-full">{timestamp}</span>
        <span className="historical-timestamp-compact"><span>{utc.slice(0, 10)}</span><span>{utc.slice(11, 19)} UTC</span></span>
      </time>
    </button>
    <div className="historical-steps" hidden={collapsed}>
      <ContextButton icon={<ControlIcon name="previous" />} aria-label="Historical back 10 minutes" onClick={() => onStep(-600)}>-10 min</ContextButton>
      <ContextButton icon={<ControlIcon name="next" />} aria-label="Historical forward 10 minutes" disabled={Date.parse(at) + 600_000 > Date.now()} onClick={() => onStep(600)}>+10 min</ContextButton>
    </div>
    <HistoricalCalendar open={calendarOpen} draft={calendarDraft} coverage={coverage} bar={bar} trigger={trigger}
      onDraft={setCalendarDraft} onCancel={cancelCalendar} onApply={applyCalendar} />
  </section>;
}
