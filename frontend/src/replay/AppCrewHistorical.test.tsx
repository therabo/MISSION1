// @vitest-environment jsdom
import { act, useEffect } from 'react';
// Geographic loading is isolated here; real-catalog integration is covered in OverCountryIntegration.test.tsx.
vi.mock('../geo/countryCatalog', () => ({ loadCountryCatalog: () => new Promise(() => {}) }));
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from '../App';
import { parseOrbitalWindow } from '../orbital/sampleMapping';
import { orbitalPayload } from '../test/orbitalFixture';
import { historicalPayload } from '../test/historicalFixture';
import { crewFixture, personFixture } from '../test/crewFixture';

// Only the renderer is mocked here. Actual replay request/decoder/latch and Crew
// resources run together. Native sky, camera and canvas are covered in browser QA.
const scene = vi.hoisted(() => ({ props: {} as any, mounts: 0, window: null as any, status: 'ready' }));
vi.mock('../layout/useEarthWorkspace', () => ({ useEarthWorkspace: () => null }));
vi.mock('../api/useOrbitalDelivery', () => ({ useOrbitalDelivery: () => ({ window: scene.window, status: scene.status, message: null }) }));
vi.mock('../api/useComparisonDelivery', () => ({ useComparisonDelivery: () => ({ response: null, status: 'unavailable' }) }));
vi.mock('../cesium/EarthView', () => ({ EarthView: (props: any) => {
  scene.props = props;
  useEffect(() => { scene.mounts++; props.onSceneTime(scene.window.generatedMs); props.onModelStatus('ready'); props.onPosition({ source: 'PRIMARY_GP_TLE', timeMs: scene.window.generatedMs, ...scene.window.response.currentGeodetic }); }, []);
  return <div className="earth-view"><canvas tabIndex={0} /></div>;
} }));
let root: Root, node: HTMLDivElement, fetchMock: ReturnType<typeof vi.fn>;
const coverage = { status: 'AVAILABLE', start: '2026-09-01T00:00:00Z', end: '2026-10-03T13:00:00Z', intervals: [{ start: '2026-09-01T00:00:00Z', end: '2026-10-03T13:00:00Z' }], limitations: [] };
function answer(url: string) {
  if (url === '/api/iss/crew') return crewFixture();
  if (url.startsWith('/api/iss/crew/')) { const person = personFixture(); person.id = url.split('/').at(-1)!; return person; }
  if (url.endsWith('/coverage')) return { crew: coverage, orbit: coverage, joint: coverage, orbitGate: 'BOUNDED' };
  const at = decodeURIComponent(url.split('at=')[1]), result = historicalPayload(at);
  result.crew.state.freshness.evaluatedAt = at;
  result.crew.state.members = result.crew.state.members.slice(0, 2).map(m => ({ ...m, name: 'TEST Historical ' + at }));
  return result;
}
beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  vi.useFakeTimers(); vi.setSystemTime(new Date(coverage.end)); scene.mounts = 0; scene.status = 'ready'; scene.window = parseOrbitalWindow(orbitalPayload());
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  fetchMock = vi.fn((url: string) => Promise.resolve(Response.json(answer(url)))); vi.stubGlobal('fetch', fetchMock);
  node = document.createElement('div'); document.body.append(node); root = createRoot(node);
});
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
async function mount() { await act(async () => root.render(<App />)); }
async function click(name: string) { const b = [...document.querySelectorAll('button')].find(b => b.textContent === name || b.getAttribute('aria-label') === name); expect(b, name).toBeDefined(); await act(async () => b!.click()); }
async function tick(ms = 300) { await act(async () => vi.advanceTimersByTimeAsync(ms)); }
const accepted = () => node.querySelector<HTMLTimeElement>('.context-date time')?.dateTime;
const assessment = () => node.querySelector<HTMLTimeElement>('.crew-assessment time')?.dateTime;
const ids = () => [...node.querySelectorAll<HTMLButtonElement>('.crew-roster-row')].map(b => b.dataset.memberId);
async function history() { await click('Historical'); await tick(); }
async function seekWhileOpen() { await click('Close crew panel'); await click('Historical back 10 minutes'); await click('Crew'); }
function deferHistory() {
  const pending: { url: string; signal: AbortSignal; resolve: (r: Response) => void }[] = [];
  fetchMock.mockImplementation((url: string, options: { signal: AbortSignal }) => url.includes('/replay?') ? new Promise<Response>(resolve => pending.push({ url, signal: options.signal, resolve })) : Promise.resolve(Response.json(answer(url))));
  return pending;
}
it('Current roster stays Current while first Historical target is pending, then atomically accepts historical roster/date/scene', async () => {
  await mount(); await click('Crew'); const old = ids(), utc = accepted(); await click('Historical');
  expect(ids()).toEqual(old); expect(node.querySelector('.crew-historical')).toBeNull(); expect(accepted()).toBe(utc); expect(scene.props.replay).toBeNull();
  await tick(); expect(ids()).toHaveLength(2); expect(node.querySelector('.crew-historical')).not.toBeNull();
  expect(assessment()).toBe(accepted()); expect(scene.props.replay.state.effectiveAt).toBe(accepted()); expect(scene.props.replay.atMs).toBe(Date.parse(accepted()!));
});
it('Historical roster never borrows the concurrently retained real Current resource', async () => {
  await mount(); await history(); await click('Crew'); expect(ids()).toHaveLength(2);
  expect(node.querySelector('.crew-roster-rows')?.textContent).toContain('TEST Historical'); expect(node.querySelector('.crew-roster-rows')?.textContent).not.toContain(crewFixture().members[0].name);
});
it('T2 pending keeps accepted T1 roster, assessment, top date and scene references until acceptance', async () => {
  await mount(); await history(); await click('Crew'); const t1 = accepted(), roster = ids(), state = scene.props.replay.state;
  const pending = deferHistory(); await seekWhileOpen(); await tick();
  expect(accepted()).toBe(t1); expect(assessment()).toBe(t1); expect(ids()).toEqual(roster); expect(scene.props.replay.state).toBe(state);
  expect(node.querySelector('.crew-temporal-pending')).not.toBeNull();
  await act(async () => pending[0].resolve(Response.json(answer(pending[0].url))));
  expect(accepted()).not.toBe(t1); expect(assessment()).toBe(accepted()); expect(scene.props.replay.state.effectiveAt).toBe(accepted()); expect(node.querySelector('.crew-roster-rows')?.textContent).toContain(accepted());
});
it('seek failure retains T1 with truthful local error; retry queries the exact failed T2 without recreating scene', async () => {
  await mount(); await history(); await click('Crew'); const t1 = accepted(), canvas = node.querySelector('canvas');
  fetchMock.mockImplementation((url: string) => url.includes('/replay?') ? Promise.resolve(new Response('', { status: 503 })) : Promise.resolve(Response.json(answer(url))));
  await seekWhileOpen(); await tick(); expect(assessment()).toBe(t1); expect(node.querySelector('.crew-error')?.textContent).toContain('previous accepted context');
  const target = fetchMock.mock.calls.filter(([url]) => url.includes('/replay?')).at(-1)![0];
  fetchMock.mockImplementation((url: string) => Promise.resolve(Response.json(answer(url)))); await click('Retry historical crew'); await tick();
  expect(fetchMock.mock.calls.filter(([url]) => url.includes('/replay?')).at(-1)![0]).toBe(target);
  expect(assessment()).toBe(accepted()); expect(accepted()).not.toBe(t1); expect(node.querySelector('canvas')).toBe(canvas); expect(scene.mounts).toBe(1);
});
it('Historical return retains accepted H until Current is prepared and then uses the real retained Current roster without blank flash', async () => {
  await mount(); await click('Crew'); const realCurrent = ids(); await history(); const t = accepted();
  const window = scene.window; scene.window = null; scene.status = 'loading'; await click('Current');
  expect(assessment()).toBe(t); expect(node.querySelector('.crew-historical')).not.toBeNull(); expect(scene.props.replay.atMs).toBe(Date.parse(t!));
  scene.window = window; scene.status = 'ready'; await act(async () => root.render(<App />));
  expect(node.querySelector('.crew-historical')).toBeNull(); expect(ids()).toEqual(realCurrent); expect(scene.props.replay).toBeNull();
  expect(node.querySelector('.crew-loading')).toBeNull(); expect(node.querySelector('.earth-current-notice')).toBeNull();
});
it('closing Historical Crew preserves accepted time, state/source, canvas and replay target', async () => {
  await mount(); await history(); await click('Crew'); const at = accepted(), state = scene.props.replay.state, source = scene.props.selectedSource, canvas = node.querySelector('canvas');
  await click('Close crew panel'); await tick(); expect(accepted()).toBe(at); expect(scene.props.replay.state).toBe(state); expect(scene.props.selectedSource).toBe(source); expect(node.querySelector('canvas')).toBe(canvas);
  await click('Crew'); expect(assessment()).toBe(at); expect(scene.mounts).toBe(1);
});
it('rapid Current → Historical → Current → Historical ends on latest intent with one surface and no stale Current selection', async () => {
  await mount(); await click('Crew'); await act(async () => node.querySelector<HTMLButtonElement>('.crew-roster-row')!.click());
  await click('Historical'); await tick(50); await click('Current'); await click('Historical'); await tick();
  expect(node.querySelectorAll('.crew-workspace')).toHaveLength(1); expect(node.querySelector('.astronaut-dock')).toBeNull();
  expect(assessment()).toBe(accepted()); expect(ids()).toHaveLength(2); expect(scene.mounts).toBe(1);
});
it('overlapping T2/T3 requests abort T2 and cannot let late T2 overwrite the accepted T3 roster/scene', async () => {
  await mount(); await history(); await click('Crew'); const old = accepted(), pending = deferHistory();
  await seekWhileOpen(); await tick(); await seekWhileOpen(); await tick(); expect(pending[0].signal.aborted).toBe(true);
  await act(async () => pending[0].resolve(Response.json(answer(pending[0].url)))); expect(assessment()).toBe(old);
  await act(async () => pending[1].resolve(Response.json(answer(pending[1].url)))); const t3 = accepted();
  expect(assessment()).toBe(t3); expect(scene.props.replay.state.effectiveAt).toBe(t3);
  await act(async () => pending[0].resolve(Response.json(answer(pending[0].url)))); expect(assessment()).toBe(t3);
});
it('Earth Calendar Apply → Crew and close → Cancel → reopen inherit accepted UTC without an internal calendar', async () => {
  await mount(); await history(); await click('Open Historical calendar'); await click('2026-10-02 UTC'); await click('Apply'); await tick();
  await click('Crew'); const t2 = accepted(); expect(t2).toContain('2026-10-02'); expect(assessment()).toBe(t2);
  expect(node.querySelector('.crew-workspace .historical-time-bar,.crew-workspace [role="dialog"]')).toBeNull();
  await click('Close crew panel'); await click('Open Historical calendar'); await click('2026-10-01 UTC'); await click('Cancel'); await click('Crew');
  expect(assessment()).toBe(t2); expect(accepted()).toBe(t2);
});
it('Calendar Apply pending then reopening Crew retains T1 and accepts only the matching T2 envelope', async () => {
  await mount(); await history(); await click('Crew'); const t1 = accepted(); await click('Close crew panel'); const pending = deferHistory();
  await click('Open Historical calendar'); await click('2026-10-02 UTC'); await click('Apply'); await click('Crew'); await tick();
  expect(assessment()).toBe(t1); await act(async () => pending[0].resolve(Response.json(answer(pending[0].url)))); expect(assessment()).toBe(accepted()); expect(accepted()).toContain('2026-10-02');
});
it('Current S8 remains functional after an accepted Historical round-trip with selection focus restored', async () => {
  await mount(); await click('Crew'); await history(); await click('Current');
  const row = node.querySelector<HTMLButtonElement>('.crew-roster-row')!; await act(async () => row.click()); expect(node.querySelector('.astronaut-dock')).not.toBeNull();
  await click('Close astronaut detail'); await tick(); expect(document.activeElement?.getAttribute('data-member-id')).toBe(row.dataset.memberId); expect(scene.mounts).toBe(1);
});
it('Historical base Escape returns to the same accepted Earth context and stable Crew launcher', async () => {
  await mount(); await history(); await click('Crew'); const t = accepted();
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))); await tick();
  expect(node.querySelector('.crew-panel')).toBeNull(); expect(document.activeElement?.id).toBe('crew-launcher'); expect(accepted()).toBe(t); expect(scene.props.replay.atMs).toBe(Date.parse(t!));
});
it('accepted temporal handoff preserves focus on the stable mode control when the user selected it', async () => {
  await mount(); await click('Crew');
  const historical = [...node.querySelectorAll<HTMLButtonElement>('.context-temporal button')].find(b => b.textContent === 'Historical')!;
  historical.focus(); await click('Historical'); await tick(); expect(document.activeElement).toBe(historical);
  const current = [...node.querySelectorAll<HTMLButtonElement>('.context-temporal button')].find(b => b.textContent === 'Current')!;
  current.focus(); await click('Current'); expect(document.activeElement).toBe(current);
});
