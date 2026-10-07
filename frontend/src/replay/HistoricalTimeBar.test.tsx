// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { HistoricalTimeBar } from './HistoricalTimeBar';

let node: HTMLDivElement, root: Root;
const step = vi.fn(); let reduced = false;
beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  vi.useFakeTimers(); reduced = false; step.mockClear();
  vi.stubGlobal('matchMedia', () => ({ matches: reduced, addEventListener() {}, removeEventListener() {} }));
  node = document.createElement('div'); document.body.append(node); root = createRoot(node);
});
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.unstubAllGlobals(); vi.useRealTimers(); });
async function render(open: boolean, at = '2026-10-03T12:00:00Z') {
  await act(async () => root.render(<HistoricalTimeBar open={open} at={at} onStep={step} />));
}
it('is absent in Current and exposes only approved temporal controls when Historical opens', async () => {
  await render(false); expect(node.querySelector('section')).toBeNull();
  await render(true); expect(node.querySelector('section')?.dataset.state).toBe('open');
  expect(node.querySelector('time')?.dateTime).toBe('2026-10-03T12:00:00Z');
  expect(node.querySelectorAll('button')).toHaveLength(4);
  expect(node.querySelector('.historical-calendar-trigger')?.hasAttribute('disabled')).toBe(false);
  expect(node.querySelector('.historical-calendar-trigger')?.getAttribute('aria-haspopup')).toBe('dialog');
  expect(node.querySelector('input')).toBeNull(); expect(node.textContent).not.toContain('SET UTC');
});
it('requests precisely ±600 seconds without any local committed-time state', async () => {
  await render(true);
  await act(async () => node.querySelector<HTMLButtonElement>('[aria-label="Historical back 10 minutes"]')!.click());
  await act(async () => node.querySelector<HTMLButtonElement>('[aria-label="Historical forward 10 minutes"]')!.click());
  expect(step.mock.calls).toEqual([[-600],[600]]);
  expect(node.querySelector('time')?.dateTime).toBe('2026-10-03T12:00:00Z');
});
it('retains an inert exit for exactly 160ms, with domain selection already closed', async () => {
  await render(true); await render(false);
  expect(node.querySelector('section')?.dataset.state).toBe('exiting');
  expect(node.querySelector('section')?.getAttribute('aria-hidden')).toBe('true');
  expect(node.querySelector('section')?.hasAttribute('inert')).toBe(true);
  await act(async () => vi.advanceTimersByTimeAsync(159)); expect(node.querySelector('section')).not.toBeNull();
  await act(async () => vi.advanceTimersByTimeAsync(1)); expect(node.querySelector('section')).toBeNull();
});
it('cancels a superseded exit when Historical is reopened rapidly', async () => {
  await render(true); await render(false); await act(async () => vi.advanceTimersByTimeAsync(80)); await render(true);
  await act(async () => vi.advanceTimersByTimeAsync(500)); expect(node.querySelector('section')?.dataset.state).toBe('open');
});
it('uses no more than 120ms presence under reduced motion', async () => {
  reduced = true; await render(true); await render(false);
  await act(async () => vi.advanceTimersByTimeAsync(119)); expect(node.querySelector('section')).not.toBeNull();
  await act(async () => vi.advanceTimersByTimeAsync(1)); expect(node.querySelector('section')).toBeNull();
});
