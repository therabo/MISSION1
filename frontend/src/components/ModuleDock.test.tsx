// @vitest-environment jsdom
import { act, useState, type Dispatch, type SetStateAction } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ModuleInfo } from './ModuleInfo';
import { ISS_MODEL, type SemanticMapping } from '../cesium/modelPresentation';
import { telemetryFixture } from '../test/telemetryFixture';

let root: Root, host: HTMLElement, origin: HTMLCanvasElement, choose: Dispatch<SetStateAction<SemanticMapping | null>>;
let historical = false, at = '2026-10-05T12:00:00.000Z', reduced = false;
const closed = vi.fn();
function Harness() {
  const [module, setModule] = useState<SemanticMapping | null>(null); choose = setModule;
  return <ModuleInfo module={module} historical={historical} acceptedAt={at} onClose={() => { closed(); setModule(null); }} />;
}
beforeEach(async () => {
  vi.useFakeTimers(); historical = false; reduced = false; at = '2026-10-05T12:00:00.000Z'; closed.mockClear();
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  vi.stubGlobal('matchMedia', () => ({ get matches() { return reduced; }, addEventListener() {}, removeEventListener() {} }));
  host = document.createElement('div'); origin = document.createElement('canvas'); host.className = 'earth-view'; host.append(origin);
  document.body.append(host); origin.focus(); const mount = document.createElement('div'); host.append(mount); root = createRoot(mount); await act(async () => root.render(<Harness />));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); origin.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const select = async (index: number | null) => act(async () => choose(index === null ? null : ISS_MODEL.semanticMappings[index]));
const tick = async (ms: number) => act(async () => vi.advanceTimersByTime(ms));
const close = async () => act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Close module information"]')!.click());

it('opens one non-modal dock with a meaningful heading and no reference footer', async () => {
  await select(5); const dock = host.querySelector('aside')!;
  expect(dock.getAttribute('role')).toBe('region'); expect(dock.hasAttribute('aria-modal')).toBe(false);
  expect(document.activeElement?.textContent).toBe('Zvezda'); expect(dock.getAttribute('aria-labelledby')).toBe(document.activeElement?.id);
  expect(dock.textContent).toContain('Crew systems and propulsion'); expect(dock.textContent).toContain('Telemetry');
  expect(dock.querySelector('footer')).toBeNull();
  expect(dock.querySelector('h3')?.textContent).toBe('Function');
  expect(host.querySelector('.module-panel')).toBeNull();
});
it('close is immediately inert and restores focus, then removes the exit snapshot', async () => {
  await select(0); await close(); const dock = host.querySelector('aside')!;
  expect(dock.getAttribute('aria-hidden')).toBe('true'); expect(dock.hasAttribute('inert')).toBe(true); expect(document.activeElement).toBe(origin);
  await tick(199); expect(host.querySelector('aside')).not.toBeNull(); await tick(1); expect(host.querySelector('aside')).toBeNull();
});
it('A→B→C updates the same dock and only the final identity remains selected', async () => {
  await select(0); const dock = host.querySelector('aside'); await select(1); await select(2);
  expect(host.querySelector('aside')).toBe(dock); expect(host.querySelector('h2')?.textContent).toBe('Harmony');
  expect(host.querySelectorAll('aside')).toHaveLength(1); expect(dock?.getAttribute('data-entity-id')).toBe('HARMONY');
});
it('close during enter and reopen during exit cannot let an old timer remove the new dock', async () => {
  await select(0); await tick(40); await close(); await tick(70); await select(1); await tick(1000);
  expect(host.querySelector('aside')?.hasAttribute('inert')).toBe(false); expect(host.querySelector('h2')?.textContent).toBe('Columbus');
});
it('Escape closes detail from the scene without propagating to parent navigation', async () => {
  await select(0); origin.focus(); const parent = vi.fn(); window.addEventListener('keydown', parent);
  const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  await act(async () => origin.dispatchEvent(event)); expect(closed).toHaveBeenCalledOnce(); expect(event.defaultPrevented).toBe(true); expect(parent).not.toHaveBeenCalled();
  window.removeEventListener('keydown', parent);
});
it('Escape inside the dock closes once, not twice through the document listener', async () => {
  await select(0); await act(async () => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
  expect(closed).toHaveBeenCalledOnce();
});
it('honors a higher-priority dialog and an already handled Escape', async () => {
  await select(0); const dialog = document.createElement('div'); dialog.setAttribute('role', 'dialog'); dialog.tabIndex = 0; document.body.append(dialog); dialog.focus();
  await act(async () => dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))); expect(closed).not.toHaveBeenCalled(); dialog.remove();
  const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); event.preventDefault();
  await act(async () => document.dispatchEvent(event)); expect(closed).not.toHaveBeenCalled();
});
it('direct picking without a DOM trigger restores the stable 3D canvas', async () => {
  expect(origin.hasAttribute('tabindex')).toBe(false);
  origin.blur(); await select(0); await close(); expect(origin.tabIndex).toBe(0); expect(document.activeElement).toBe(origin);
});
it('external deselection does not steal focus from another control', async () => {
  await select(0); const other = document.createElement('button'); document.body.append(other); other.focus(); await select(null);
  expect(document.activeElement).toBe(other); other.remove();
});
it('updates Historical telemetry at the accepted UTC without exposing configuration or polling', async () => {
  historical = true;
  const data = telemetryFixture('TRANQUILITY', at);
  const laterAt = '2026-10-05T12:10:00.000Z';
  const later = telemetryFixture('TRANQUILITY', laterAt);
  later.parameters[0].record!.numericValue = 53;
  later.parameters[0].record!.recordTime = '2026-10-05T12:09:00Z';
  const fetch = vi.fn().mockResolvedValueOnce(Response.json(data)).mockResolvedValueOnce(Response.json(later));
  vi.stubGlobal('fetch', fetch);
  await select(12);
  expect(host.textContent).toContain('Last telemetry record');
  expect(host.querySelector('time')?.dateTime).toBe(data.parameters[0].record!.recordTime);
  expect(host.textContent).not.toContain('Configuration context');
  expect(fetch.mock.calls[0][0]).toContain(encodeURIComponent(at));
  at = '2026-10-05T12:10:00.000Z'; await act(async () => root.render(<Harness />));
  expect(host.querySelector('time')?.dateTime).toBe(later.parameters[0].record!.recordTime);
  expect(host.querySelector('.module-telemetry-value')?.textContent).toBe('53 %');
  expect(host.querySelector('h2')?.textContent).toBe('Tranquility');
  expect(fetch.mock.calls[1][0]).toContain(encodeURIComponent(at));
  await tick(180_000); expect(fetch).toHaveBeenCalledTimes(2);
});
it('unverified props cannot open a module dock', async () => {
  await act(async () => choose({ ...ISS_MODEL.semanticMappings[0], status: 'UNMAPPED' })); expect(host.querySelector('aside')).toBeNull();
});
it('reduced motion preserves exit behavior with a maximum 120ms lifetime', async () => {
  reduced = true; await select(0); await close(); await tick(119); expect(host.querySelector('aside')).not.toBeNull();
  await tick(1); expect(host.querySelector('aside')).toBeNull();
});
