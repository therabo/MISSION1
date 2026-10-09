// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HistoricalTimeBar } from './HistoricalTimeBar';
import { HISTORICAL_IDLE_MS } from './useHistoricalDisclosure';
import type { Coverage } from './replayApi';

const at = '2026-10-05T11:38:41.123Z';
const coverage: Coverage = { status: 'AVAILABLE', start: '2026-09-01T00:00:00Z', end: '2026-10-07T12:00:00Z',
  intervals: [{ start: '2026-09-01T00:00:00Z', end: '2026-10-07T12:00:00Z' }], limitations: [] };
let node: HTMLDivElement, root: Root, mobile: boolean, reduced: boolean;
const changes = new Set<() => void>(), step = vi.fn(), apply = vi.fn();
beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  vi.useFakeTimers(); vi.setSystemTime(new Date(coverage.end!));
  mobile = true; reduced = false; changes.clear(); step.mockClear(); apply.mockClear();
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() { return query === '(max-width: 740px)' ? mobile : reduced; },
    addEventListener(_name: string, listener: () => void) { if (query === '(max-width: 740px)') changes.add(listener); },
    removeEventListener(_name: string, listener: () => void) { changes.delete(listener); },
  }));
  node = document.createElement('div'); document.body.append(node); root = createRoot(node);
});
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.unstubAllGlobals(); vi.useRealTimers(); });
async function render(open = true, time = at) {
  await act(async () => root.render(<HistoricalTimeBar open={open} at={time} onStep={step} onApply={apply} coverage={coverage} />));
}
const bar = () => node.querySelector<HTMLElement>('.historical-time-bar')!;
const trigger = () => node.querySelector<HTMLButtonElement>('.historical-calendar-trigger')!;
const date = () => node.querySelector<HTMLButtonElement>('.historical-date')!;
const state = () => bar().dataset.disclosure;
async function click(selector = '.historical-calendar-trigger') {
  await act(async () => document.querySelector<HTMLButtonElement>(selector)!.click());
}
async function delay(ms: number) { await act(async () => vi.advanceTimersByTimeAsync(ms)); }
async function resize(isMobile: boolean) { await act(async () => { mobile = isMobile; changes.forEach(notify => notify()); }); }
async function pointer(type: string, target: HTMLElement = bar()) {
  await act(async () => {
    const event = new Event(type, { bubbles: true }); Object.defineProperty(event, 'pointerId', { value: 7 }); target.dispatchEvent(event);
  });
}
async function key(value: string, target: HTMLElement) {
  await act(async () => target.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true })));
}
async function openCalendar() { await click(); await click('.historical-date'); }

it('enters mobile Historical collapsed with one accessible disclosure and no timer', async () => {
  await render(false); expect(bar()).toBeNull(); await render();
  expect(state()).toBe('COLLAPSED'); expect(trigger().getAttribute('aria-label')).toBe('Open Historical controls');
  expect(trigger().getAttribute('aria-expanded')).toBe('false'); expect(trigger().getAttribute('aria-controls')).toBe(bar().id);
  expect(date().hidden).toBe(true); expect(node.querySelector<HTMLElement>('.historical-steps')!.hidden).toBe(true);
  expect(trigger().querySelector('img')!.alt).toBe(''); expect(vi.getTimerCount()).toBe(0);
});
it('expands the complete bar, then collapses at exactly four idle seconds', async () => {
  await render(); await click(); expect(state()).toBe('EXPANDED'); expect(date().hidden).toBe(false);
  expect(trigger().getAttribute('aria-label')).toBe('Open Historical calendar'); expect(vi.getTimerCount()).toBe(1);
  await delay(HISTORICAL_IDLE_MS - 1); expect(state()).toBe('EXPANDED'); await delay(1);
  expect(state()).toBe('COLLAPSED'); expect(vi.getTimerCount()).toBe(0);
});
it.each(['Historical back 10 minutes', 'Historical forward 10 minutes'])('%s resets idle time and still requests exactly 600 seconds', async label => {
  await render(); await click(); await delay(3_000); await click(`[aria-label="${label}"]`);
  expect(step.mock.calls).toEqual([[label.includes('back') ? -600 : 600]]);
  expect(node.querySelector('time')!.dateTime).toBe(at);
  await delay(3_999); expect(state()).toBe('EXPANDED'); await delay(1); expect(state()).toBe('COLLAPSED');
});
it.each(['pointermove', 'click'])('%s activity restarts a single timer', async type => {
  await render(); await click(); await delay(3_000);
  if (type === 'pointermove') await pointer(type); else await act(async () => bar().click());
  expect(vi.getTimerCount()).toBe(1); await delay(3_999); expect(state()).toBe('EXPANDED');
  await delay(1); expect(state()).toBe('COLLAPSED');
});
it.each(['pointerup', 'pointercancel'])('does not collapse a held touch/pointer and restarts after %s anywhere', async release => {
  await render(); await click(); await pointer('pointerdown'); expect(vi.getTimerCount()).toBe(0);
  await delay(9_000); expect(state()).toBe('EXPANDED'); await pointer(release, document.body);
  expect(vi.getTimerCount()).toBe(1); await delay(4_000); expect(state()).toBe('COLLAPSED');
});
it('pauses while keyboard focus is in the bar and restarts after focus leaves', async () => {
  await render(); await key('Enter', trigger()); await click();
  await act(async () => trigger().focus()); await delay(9_000); expect(state()).toBe('EXPANDED');
  await key('Tab', trigger()); await act(async () => date().focus()); await delay(9_000); expect(state()).toBe('EXPANDED');
  await act(async () => date().blur()); expect(vi.getTimerCount()).toBe(1);
  await delay(4_000); expect(state()).toBe('COLLAPSED');
});
it('restores mouse focus to the compact control after automatic collapse', async () => {
  await render(); await click(); await act(async () => date().focus()); await delay(4_000);
  expect(state()).toBe('COLLAPSED'); expect(document.activeElement).toBe(trigger());
});
it('date opens the calendar, removes the bar from interaction/speech and cancels idle timing', async () => {
  await render(); await openCalendar(); expect(state()).toBe('CALENDAR_OPEN');
  expect(bar().hasAttribute('inert')).toBe(true); expect(bar().getAttribute('aria-hidden')).toBe('true');
  expect(document.querySelector('#historical-calendar')!.getAttribute('aria-hidden')).toBeNull();
  expect(document.activeElement!.classList.contains('calendar-day')).toBe(true);
  await delay(0); // Flush jsdom's focus microtask before counting scheduled timers.
  expect(vi.getTimerCount()).toBe(0);
  await delay(9_000); expect(state()).toBe('CALENDAR_OPEN'); expect(apply).not.toHaveBeenCalled();
});
it.each(['Cancel', 'Close', 'Escape', 'outside'])('%s discards the draft, restores expanded date focus and restarts idle timing', async kind => {
  await render(); await openCalendar(); await delay(5_000); await click('.calendar-day[aria-label="2026-10-04 UTC"]');
  if (kind === 'Cancel') await click('.calendar-actions button:first-child');
  if (kind === 'Close') await click('.calendar-close');
  if (kind === 'Escape') await key('Escape', document.querySelector('.calendar-day[tabindex="0"]')!);
  if (kind === 'outside') await pointer('pointerdown', document.body);
  expect(state()).toBe('EXPANDED'); expect(bar().hasAttribute('inert')).toBe(false);
  expect(document.activeElement).toBe(date()); expect(apply).not.toHaveBeenCalled(); expect(step).not.toHaveBeenCalled();
  // Escape restores keyboard focus, which must remain usable until focus leaves.
  if (kind === 'Escape') await act(async () => date().blur());
  await delay(3_999); expect(state()).toBe('EXPANDED'); await delay(1); expect(state()).toBe('COLLAPSED');
});
it('Apply commits once, collapses directly and restores the visible compact disclosure', async () => {
  await render(); await openCalendar(); await click('.calendar-day[aria-label="2026-10-04 UTC"]');
  const button = document.querySelector<HTMLButtonElement>('.calendar-actions button:last-child')!;
  await act(async () => { button.click(); button.click(); });
  expect(apply.mock.calls).toEqual([['2026-10-04T11:38:41.000Z']]); expect(state()).toBe('COLLAPSED');
  expect(document.activeElement).toBe(trigger()); expect(date().hidden).toBe(true);
  await delay(120); expect(document.querySelector('#historical-calendar')).toBeNull(); expect(vi.getTimerCount()).toBe(0);
});
it.each(['COLLAPSED', 'EXPANDED', 'CALENDAR_OPEN'])('resizing mobile %s into non-mobile normalizes persistence and cancels timing', async phase => {
  await render(); if (phase !== 'COLLAPSED') await click(); if (phase === 'CALENDAR_OPEN') await click('.historical-date');
  await resize(false); expect(state()).toBe(phase === 'CALENDAR_OPEN' ? phase : 'EXPANDED');
  expect(date().hidden).toBe(false); expect(bar().hasAttribute('inert')).toBe(false);
  await delay(0); expect(vi.getTimerCount()).toBe(0);
  await delay(9_000); expect(date().hidden).toBe(false);
  await resize(true); expect(state()).toBe(phase === 'CALENDAR_OPEN' ? phase : 'COLLAPSED');
  if (phase === 'CALENDAR_OPEN') expect(bar().hasAttribute('inert')).toBe(true);
});
it('non-mobile never starts an idle timer; entering mobile starts collapsed', async () => {
  mobile = false; await render(); expect(state()).toBe('EXPANDED'); await delay(9_000);
  expect(vi.getTimerCount()).toBe(0); await resize(true); expect(state()).toBe('COLLAPSED');
});
it.each(['EXPANDED', 'CALENDAR_OPEN'])('leaving Historical from %s clears timing/draft and re-entry starts collapsed', async phase => {
  await render(); await click(); if (phase === 'CALENDAR_OPEN') await click('.historical-date');
  await render(false); await delay(160); expect(bar()).toBeNull(); expect(document.querySelector('#historical-calendar')).toBeNull();
  expect(vi.getTimerCount()).toBe(0); await render(); expect(state()).toBe('COLLAPSED'); expect(apply).not.toHaveBeenCalled();
});
it('unmount removes the timer and media/document subscriptions', async () => {
  const remove = vi.spyOn(document, 'removeEventListener');
  await render(); await click(); expect(vi.getTimerCount()).toBe(1);
  await act(async () => root.render(null)); expect(vi.getTimerCount()).toBe(0); expect(changes.size).toBe(0);
  for (const name of ['keydown', 'pointerdown', 'pointerup', 'pointercancel']) expect(remove.mock.calls.some(([type]) => type === name)).toBe(true);
  remove.mockRestore();
});
it('reduced motion retains the four-second semantic delay and short inert exits', async () => {
  reduced = true; await render(); await click(); await delay(4_000); expect(state()).toBe('COLLAPSED');
  await render(false); await delay(119); expect(bar()).not.toBeNull(); await delay(1); expect(bar()).toBeNull();
});
