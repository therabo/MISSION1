import type { Coverage } from './replayApi';

/** UI draft only. Milliseconds retain exact replayAt identity on an unchanged Apply. */
export interface CalendarDraft {
  year: number; month: number; day: number;
  hour: string; minute: string; second: string; millisecond: number;
}
export const twoDigits = (value: number) => String(value).padStart(2, '0');
export function daysInMonth(year: number, month: number): number {
  return month === 2 ? (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28)
    : [4, 6, 9, 11].includes(month) ? 30 : 31;
}
export function calendarDraftFromUtc(at: string): CalendarDraft {
  const date = new Date(at);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(),
    hour: twoDigits(date.getUTCHours()), minute: twoDigits(date.getUTCMinutes()), second: twoDigits(date.getUTCSeconds()), millisecond: date.getUTCMilliseconds() };
}
/** Calendar controls select whole UTC seconds; an unopened/unchanged draft
 * retains its original subsecond identity. This never changes the old scene. */
export const editCalendarDraft = (draft: CalendarDraft, patch: Partial<CalendarDraft>): CalendarDraft => ({ ...draft, ...patch, millisecond: 0 });
export function calendarDraftUtc(draft: CalendarDraft): string | null {
  const { year, month, day, hour, minute, second, millisecond } = draft;
  if (![year, month, day, millisecond].every(Number.isInteger) || year < 1 || year > 9999 || month < 1 || month > 12 ||
      day < 1 || day > daysInMonth(year, month) || millisecond < 0 || millisecond > 999) return null;
  if (![hour, minute, second].every(value => /^\d{1,2}$/.test(value)) || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return null;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day); date.setUTCHours(Number(hour), Number(minute), Number(second), millisecond);
  return date.toISOString();
}
export function validateCalendarDraft(draft: CalendarDraft, coverage: Coverage | null, now = Date.now()) {
  const value = calendarDraftUtc(draft);
  if (!value) return { value: null, error: 'Enter a valid UTC date and time.' };
  const ms = Date.parse(value);
  if (ms > now) return { value: null, error: 'Choose a past UTC instant.' };
  if (!coverage) return { value: null, error: 'Historical coverage is loading.' };
  if (!coverage.start || !coverage.end || ms < Date.parse(coverage.start) || ms > Date.parse(coverage.end) ||
      !coverage.intervals.some(interval => ms >= Date.parse(interval.start) && ms <= Date.parse(interval.end)))
    return { value: null, error: 'Outside the retained orbital history.' };
  return { value, error: null };
}
export function calendarDays(draft: CalendarDraft) {
  const first = new Date(0); first.setUTCFullYear(draft.year, draft.month - 1, 1); first.setUTCHours(0, 0, 0, 0);
  const offset = (first.getUTCDay() + 6) % 7;
  const count = Math.ceil((offset + daysInMonth(draft.year, draft.month)) / 7) * 7;
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(first); date.setUTCDate(1 - offset + i);
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
  });
}
export function moveCalendarDate(draft: CalendarDraft, key: string): CalendarDraft {
  const date = new Date(0); date.setUTCFullYear(draft.year, draft.month - 1, draft.day); date.setUTCHours(0, 0, 0, 0);
  const delta = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 } as Record<string, number>)[key];
  if (delta !== undefined) date.setUTCDate(date.getUTCDate() + delta);
  else if (key === 'Home') date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  else if (key === 'End') date.setUTCDate(date.getUTCDate() + 6 - (date.getUTCDay() + 6) % 7);
  else if (key === 'PageUp' || key === 'PageDown') {
    const target = new Date(date); target.setUTCDate(1); target.setUTCMonth(target.getUTCMonth() + (key === 'PageUp' ? -1 : 1));
    target.setUTCDate(Math.min(draft.day, daysInMonth(target.getUTCFullYear(), target.getUTCMonth() + 1)));
    date.setTime(target.getTime());
  }
  return editCalendarDraft(draft, { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() });
}
export function calendarDayAvailable(day: Pick<CalendarDraft, 'year' | 'month' | 'day'>, coverage: Coverage | null, now = Date.now()) {
  const start = calendarDraftUtc({ ...day, hour: '00', minute: '00', second: '00', millisecond: 0 });
  if (!start || Date.parse(start) > now) return false;
  return !coverage || coverage.intervals.some(i => Date.parse(start) <= Date.parse(i.end) && Date.parse(start) + 86399999 >= Date.parse(i.start));
}
export const calendarDateLabel = (draft: Pick<CalendarDraft, 'year' | 'month' | 'day'>) =>
  `${String(draft.year).padStart(4, '0')}-${twoDigits(draft.month)}-${twoDigits(draft.day)}`;
