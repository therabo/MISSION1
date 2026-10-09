// @vitest-environment jsdom
import { act, useState, type Dispatch, type SetStateAction } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ModuleInfo } from './ModuleInfo';
import { ISS_MODEL, type SemanticMapping } from '../cesium/modelPresentation';

let root: Root, host: HTMLElement, origin: HTMLButtonElement, choose: Dispatch<SetStateAction<SemanticMapping | null>>;
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
  host = document.createElement('div'); origin = document.createElement('button'); origin.className = 'inspection-modules'; origin.textContent = 'Modules';
  document.body.append(origin, host); origin.focus(); root = createRoot(host); await act(async () => root.render(<Harness />));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); origin.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const select = async (index: number | null) => act(async () => choose(index === null ? null : ISS_MODEL.semanticMappings[index]));
const tick = async (ms: number) => act(async () => vi.advanceTimersByTime(ms));
const close = async () => act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Close module information"]')!.click());

it('opens one non-modal dock with a meaningful heading and real provenance', async () => {
  await select(5); const dock = host.querySelector('aside')!;
  expect(dock.getAttribute('role')).toBe('region'); expect(dock.hasAttribute('aria-modal')).toBe(false);
  expect(document.activeElement?.textContent).toBe('Zvezda'); expect(dock.getAttribute('aria-labelledby')).toBe(document.activeElement?.id);
  expect(dock.textContent).toContain('Crew systems and propulsion'); expect(dock.textContent).toContain('unavailable');
  expect([...dock.querySelectorAll('a')].map(a => a.href)).toContain(ISS_MODEL.semanticMappings[5].identityEvidenceUrl);
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
it('direct picking without a DOM trigger restores the stable Modules control', async () => {
  origin.blur(); await select(0); await close(); expect(document.activeElement).toBe(origin);
});
it('external deselection does not steal focus from another control', async () => {
  await select(0); const other = document.createElement('button'); document.body.append(other); other.focus(); await select(null);
  expect(document.activeElement).toBe(other); other.remove();
});
it('does not relabel a current assessment as reconstructed Historical configuration', async () => {
  historical = true; await select(3);
  expect(host.textContent).toContain('Removed from current station'); expect(host.textContent).toContain('not reconstructed');
  expect(host.querySelector('time')?.dateTime).toBe(at);
  at = '2026-10-05T12:10:00.000Z'; await act(async () => root.render(<Harness />));
  expect(host.querySelector('time')?.dateTime).toBe(at); expect(host.querySelector('h2')?.textContent).toBe('Pirs');
});
it('unverified props cannot open a module dock', async () => {
  await act(async () => choose({ ...ISS_MODEL.semanticMappings[0], status: 'UNMAPPED' })); expect(host.querySelector('aside')).toBeNull();
});
it('reduced motion preserves exit behavior with a maximum 120ms lifetime', async () => {
  reduced = true; await select(0); await close(); await tick(119); expect(host.querySelector('aside')).not.toBeNull();
  await tick(1); expect(host.querySelector('aside')).toBeNull();
});
