// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { useTemporalPresentation } from './useTemporalPresentation';
import { parseOrbitalWindow } from '../orbital/sampleMapping';
import { orbitalPayload } from '../test/orbitalFixture';
import { historicalPayload } from '../test/historicalFixture';
import { replayFixture } from '../test/replayFixture';
import { decodeReplay } from './replayApi';

let node: HTMLDivElement, root: Root, result: ReturnType<typeof useTemporalPresentation>;
let input: Parameters<typeof useTemporalPresentation>[0];
const at = '2026-09-28T14:50:00.000Z';
function Probe() { result = useTemporalPresentation(input); return null; }
async function render() { await act(async () => root.render(<Probe />)); }
const answer = (time = at) => decodeReplay(historicalPayload(time), time);
beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-28T15:00:00Z'));
  input = { historical: false, at, data: null, delivery: { window: parseOrbitalWindow(orbitalPayload()), status: 'ready', message: null },
    comparison: { response: null, status: 'unavailable' }, source: 'PRIMARY_GP_TLE' };
  node = document.createElement('div'); root = createRoot(node);
});
afterEach(async () => { await act(async () => root.unmount()); vi.useRealTimers(); });

it('retains the exact Current envelope and freezes only during Historical preparation', async () => {
  await render(); const current = result.presented;
  input.historical = true; await render(); expect(result.presented).toBe(current); expect(result.holding).toBe(true);
  input.data = answer(); await render(); expect(result.presented.kind).toBe('historical'); expect(result.holding).toBe(false);
  if (result.presented.kind === 'historical') expect(result.presented.data).toBe(input.data);
});
it.each([-600, 600])('holds the whole previous Historical context during a %s-second seek', async seconds => {
  input.historical = true; input.data = answer(); await render(); const previous = result.presented;
  input.at = new Date(Date.parse(at) + seconds * 1000).toISOString(); input.data = null; await render();
  expect(result.presented).toBe(previous); expect(result.holding).toBe(true);
  input.data = answer(input.at); await render(); expect(result.holding).toBe(false);
  if (result.presented.kind === 'historical') { expect(result.presented.at).toBe(input.at); expect(result.presented.data).toBe(input.data); }
});
it('rejects both stale request identity and mismatching effective state time', async () => {
  input.historical = true; input.data = answer(); await render(); const previous = result.presented;
  input.at = '2026-09-28T14:40:00Z'; await render(); expect(result.presented).toBe(previous);
  input.data = answer(input.at); input.data.orbit.primary!.effectiveAt = at; await render();
  expect(result.presented).toBe(previous); expect(result.holding).toBe(true);
});
it('returns to a usable Current snapshot and releases its normal clock', async () => {
  await render(); input.historical = true; input.data = answer(); await render();
  await act(async () => vi.advanceTimersByTimeAsync(3000)); input.historical = false; await render();
  expect(result.presented.kind).toBe('current'); expect(result.holding).toBe(false);
  expect(result.currentAtMs).toBe(input.delivery.window!.generatedMs + 3000);
});
it('preserves Historical while an expired Current buffer is refreshed, then adopts a new coherent window', async () => {
  await render(); input.historical = true; input.data = answer(); await render(); const previous = result.presented;
  await act(async () => vi.advanceTimersByTimeAsync(20000)); input.historical = false; await render();
  expect(result.presented).toBe(previous); expect(result.holding).toBe(true);
  // A fresh response receipt realigns to its backend epoch, never to Historical.
  input.delivery = { ...input.delivery, window: parseOrbitalWindow(orbitalPayload()) }; await render();
  expect(result.presented.kind).toBe('current'); expect(result.holding).toBe(false);
  expect(result.currentAtMs).toBe(input.delivery.window!.generatedMs);
});
it('accepts an authoritative Current failure and preserves its genuine warning', async () => {
  await render(); input.historical = true; input.data = answer(); await render();
  await act(async () => vi.advanceTimersByTimeAsync(20000)); input.historical = false;
  input.delivery = { ...input.delivery, status: 'degraded', message: 'Orbital refresh failed' }; await render();
  expect(result.holding).toBe(false); expect(result.presented.kind).toBe('current');
  if (result.presented.kind === 'current') expect(result.presented.delivery.message).toBe('Orbital refresh failed');
});
it('commits an authoritative unavailable Historical result without substituting Current data', async () => {
  input.historical = true; input.data = decodeReplay(replayFixture(at), at); await render();
  expect(result.holding).toBe(false); expect(result.presented.kind).toBe('historical');
  if (result.presented.kind === 'historical') expect(result.presented.data.orbit.primary).toBeNull();
});
it('UI-only rerenders at the same time retain the accepted envelope and have no temporal side effect', async () => {
  input.historical = true; input.data = answer(); await render(); const previous = result.presented;
  for (let i = 0; i < 10; i++) { input = { ...input }; await render(); expect(result.presented).toBe(previous); expect(result.holding).toBe(false); }
});
it('rapid canceled handoffs retain Current and never install an unresolved target', async () => {
  await render(); const previous = result.presented;
  for (let i = 0; i < 5; i++) {
    input.historical = true; await render(); expect(result.presented).toBe(previous); expect(result.holding).toBe(true);
    input.historical = false; await render(); expect(result.presented).toBe(previous); expect(result.holding).toBe(false);
  }
});
