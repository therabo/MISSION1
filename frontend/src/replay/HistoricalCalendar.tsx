import { useEffect, useLayoutEffect, useRef, type RefObject, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { ContextButton } from '../components/ContextButton';
import { useOverlayPresence } from '../layout/useOverlayPresence';
import sourceChevron from '../assets/interface/source-chevron.svg';
import { calendarDays, calendarDayAvailable, calendarDateLabel, calendarDraftUtc, editCalendarDraft, moveCalendarDate, twoDigits, validateCalendarDraft, type CalendarDraft } from './calendarDraft';
import type { Coverage } from './replayApi';
import './HistoricalCalendar.css';

interface Props {
  open: boolean; draft: CalendarDraft | null; coverage: Coverage | null;
  bar: RefObject<HTMLElement | null>; trigger: RefObject<HTMLButtonElement | null>;
  onDraft: (draft: CalendarDraft) => void; onCancel: () => void; onApply: () => void;
}
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const monthFormatter = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export function HistoricalCalendar({ open, draft, coverage, bar, trigger, onDraft, onCancel, onApply }: Props) {
  const panel = useRef<HTMLElement>(null), lastDraft = useRef(draft), focusDate = useRef(false);
  if (draft) lastDraft.current = draft; // Exit pixels only; semantic draft is discarded on close.
  const visibleDraft = draft ?? lastDraft.current;
  const presence = useOverlayPresence(open, panel, '--motion-fast', 120);
  useLayoutEffect(() => {
    if (!presence.present || !panel.current || !bar.current || !trigger.current) return;
    const position = () => {
      const surface = panel.current!, anchor = trigger.current!.getBoundingClientRect(), bounds = bar.current!.getBoundingClientRect();
      const margin = 12, width = surface.offsetWidth, height = surface.offsetHeight;
      let x = Math.max(margin, Math.min(anchor.x, window.innerWidth - margin - width));
      const below = bounds.bottom + 8, above = bounds.top - height - 8;
      let y = below + height <= window.innerHeight - margin ? below : above >= margin ? above : Math.max(margin, window.innerHeight - margin - height);
      const tools = [...document.querySelectorAll('.trajectory-legend,.earth-scene-controls')].map(e => e.getBoundingClientRect());
      const intersects = (r: DOMRect) => x < r.right && x + width > r.x && y < r.bottom && y + height > r.y;
      if (tools.some(intersects)) {
        const right = Math.max(...tools.filter(intersects).map(r => r.right)) + 8;
        if (right + width <= window.innerWidth - margin && tools.every(r => right >= r.right || right + width <= r.x)) x = right;
        else y = above >= margin ? above : Math.max(margin, Math.min(y, ...tools.filter(intersects).map(r => r.y - height - 8)));
      }
      surface.style.left = `${x}px`; surface.style.top = `${y}px`;
      const grid = surface.querySelector<HTMLElement>('.calendar-grid'), day = surface.querySelector<HTMLElement>('.calendar-day[tabindex="0"]');
      if (grid && day && grid.scrollHeight > grid.clientHeight) grid.scrollTop = day.closest<HTMLElement>('.calendar-week')!.offsetTop - grid.offsetTop;
    };
    const anchorBar = bar.current;
    position(); window.addEventListener('resize', position); anchorBar.addEventListener('animationend', position);
    return () => { window.removeEventListener('resize', position); anchorBar.removeEventListener('animationend', position); };
  }, [presence.present, visibleDraft, coverage, bar, trigger]);
  useLayoutEffect(() => {
    if (open) panel.current?.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus({ preventScroll: true });
    else if (panel.current?.contains(document.activeElement)) {
      (document.activeElement as HTMLElement)?.blur();
      const target = trigger.current?.closest('[inert]') ? document.querySelector<HTMLButtonElement>('.context-temporal button:first-child') : trigger.current;
      target?.focus({ preventScroll: true });
    }
  }, [open]);
  useLayoutEffect(() => {
    if (open && focusDate.current) {
      const grid = panel.current?.querySelector<HTMLElement>('.calendar-grid'), day = panel.current?.querySelector<HTMLElement>('.calendar-day[tabindex="0"]');
      if (grid && day && grid.scrollHeight > grid.clientHeight) grid.scrollTop = day.closest<HTMLElement>('.calendar-week')!.offsetTop - grid.offsetTop;
      panel.current?.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus({ preventScroll: true }); focusDate.current = false;
    }
  }, [open, draft]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && !panel.current?.contains(target) && !trigger.current?.contains(target) &&
          !bar.current?.querySelector('.historical-date')?.contains(target)) onCancel();
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopPropagation(); onCancel();
    };
    document.addEventListener('pointerdown', outside, true); document.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', escape, true); };
  }, [open, onCancel, bar, trigger]);
  if (!presence.present || !visibleDraft) return null;
  const validation = validateCalendarDraft(visibleDraft, coverage), days = calendarDays(visibleDraft), today = new Date();
  const navigation = (event: KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation(); focusDate.current = true; onDraft(moveCalendarDate(visibleDraft, event.key));
  };
  return createPortal(<section ref={panel} id="historical-calendar" className="historical-calendar" role="dialog" aria-modal={false}
    aria-labelledby="calendar-month" aria-describedby="calendar-help" data-state={presence.state} inert={!presence.interactive}
    aria-hidden={!presence.interactive || undefined}>
    <div className="calendar-month-row">
      <h2 id="calendar-month" aria-live="polite">{monthFormatter.format(new Date(calendarDraftUtc({ ...visibleDraft, day: 1, hour: '00', minute: '00', second: '00' })!))}</h2>
      <ContextButton className="calendar-close" aria-label="Close Historical calendar" onClick={onCancel}>×</ContextButton>
    </div>
    <div className="calendar-date-grid" role="grid" aria-label="UTC date" aria-colcount={7} onKeyDown={navigation}>
    <div role="row" className="calendar-weekdays">{weekdays.map((day, i) => <span role="columnheader" aria-label={['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][i]} key={day}>{day}</span>)}</div>
    <div className="calendar-grid">
      {Array.from({ length: days.length / 7 }, (_, row) => <div role="row" className="calendar-week" key={row}>
        {days.slice(row * 7, row * 7 + 7).map(day => {
          const adjacent = day.month !== visibleDraft.month, selected = !adjacent && day.day === visibleDraft.day;
          const current = day.year === today.getUTCFullYear() && day.month === today.getUTCMonth() + 1 && day.day === today.getUTCDate();
          const available = !adjacent && calendarDayAvailable(day, coverage);
          return <div role="gridcell" aria-selected={selected} key={calendarDateLabel(day)}>
            <button type="button" className={`calendar-day${adjacent ? ' adjacent' : ''}`} tabIndex={selected && presence.interactive ? 0 : -1}
              aria-label={`${calendarDateLabel(day)} UTC${available ? '' : ' · unavailable'}`} aria-current={current ? 'date' : undefined}
              aria-disabled={!available} onClick={() => { if (available) onDraft(editCalendarDraft(visibleDraft, day)); }}>{day.day}</button>
          </div>;
        })}
      </div>)}
    </div>
    </div>
    <div className="calendar-divider" />
    <div className="calendar-time-fields" aria-label="UTC time">
      {(['hour', 'minute', 'second'] as const).map((field, i) => <div className="calendar-time-part" key={field}>
        {i > 0 && <span className="calendar-time-separator" aria-hidden="true">:</span>}
        <label><span>{['HH', 'MM', 'SS'][i]}</span><div className="calendar-time-control">
          <select aria-label={`UTC ${field}`} value={visibleDraft[field]} onChange={event => onDraft(editCalendarDraft(visibleDraft, { [field]: event.target.value }))}>
            {Array.from({ length: field === 'hour' ? 24 : 60 }, (_, value) => <option value={twoDigits(value)} key={value}>{twoDigits(value)}</option>)}
          </select><img src={sourceChevron} alt="" />
        </div></label>
      </div>)}
    </div>
    {validation.error && <p className="calendar-error" role="status">{validation.error}</p>}
    <div className="calendar-actions">
      <ContextButton onClick={onCancel}>Cancel</ContextButton>
      <ContextButton onClick={onApply} disabled={!validation.value}>Apply</ContextButton>
    </div>
    <p id="calendar-help" className="sr-only">UTC only. Arrow keys select a day; Home and End move within the week. Page Up and Page Down change month. Scroll the date grid to view other weeks on compact screens. Changes remain a draft until Apply. Escape discards the draft.</p>
  </section>, document.body);
}
