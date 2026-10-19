// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import App from '../App';
import { orbitalPayload } from '../test/orbitalFixture';
import { parseOrbitalWindow } from '../orbital/sampleMapping';
import { parseComparison } from '../orbital/comparison';
import { fixture } from '../test/comparisonFixture';
import { historicalPayload } from '../test/historicalFixture';

const scene = vi.hoisted(() => ({ mounts: 0, props: {} as Record<string, any>, current: null as any, comparison: null as any, enabled: [] as boolean[], deliveryStatus: 'ready', deliveryMessage: null as string | null }));
vi.mock('../layout/useEarthWorkspace', () => ({ useEarthWorkspace: () => null }));
vi.mock('../api/useOrbitalDelivery', () => ({ useOrbitalDelivery: (enabled: boolean) => { scene.enabled.push(enabled); return { window: scene.current, status: scene.deliveryStatus, message: scene.deliveryMessage }; } }));
vi.mock('../api/useComparisonDelivery', () => ({ useComparisonDelivery: () => ({ response: scene.comparison, status: 'ready' }) }));
vi.mock('../cesium/EarthView', () => ({ EarthView: (props: Record<string, any>) => {
  scene.props = props;
  useEffect(() => { scene.mounts++; props.onSceneTime(scene.current.generatedMs); props.onModelStatus('ready');
    props.onPosition({ source: 'PRIMARY_GP_TLE', timeMs: scene.current.generatedMs, ...scene.current.response.currentGeodetic }); }, []);
  return <div data-testid="stable-viewer" />;
} }));
let root: Root, node: HTMLDivElement, fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-03T13:00:00Z'));
  scene.mounts = 0; scene.enabled = []; scene.deliveryStatus = 'ready'; scene.deliveryMessage = null; scene.current = parseOrbitalWindow(orbitalPayload(), 0);
  scene.comparison = parseComparison(fixture(true));
  const delta = scene.current.generatedMs - Date.parse(scene.comparison.generatedAt);
  const shift = (s: string) => new Date(Date.parse(s) + delta).toISOString();
  scene.comparison.generatedAt = shift(scene.comparison.generatedAt);
  scene.comparison.oem.source.startTime = shift(scene.comparison.oem.source.startTime);
  scene.comparison.oem.source.stopTime = shift(scene.comparison.oem.source.stopTime);
  scene.comparison.oem.samples.forEach((s: { time: string }) => { s.time = shift(s.time); });
  fetchMock = vi.fn((url: string) => Promise.resolve(Response.json(payload(url)))); vi.stubGlobal('fetch', fetchMock);
  node = document.createElement('div'); document.body.append(node); root = createRoot(node);
});
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.unstubAllGlobals(); vi.useRealTimers(); });
function payload(url: string, source: 'GP_TLE' | 'NASA_OEM' = 'GP_TLE') {
  const time = url.includes('?at=') ? decodeURIComponent(url.split('at=')[1]) : '2026-10-03T12:59:00.000Z';
  const data = historicalPayload(time, source);
  return url.endsWith('/coverage') ? { crew: data.crew.coverage, orbit: data.orbit.coverage, joint: data.crew.coverage, orbitGate: 'BOUNDED' } : data;
}
async function mount() { await act(async () => root.render(<App />)); }
async function click(name: string) {
  const button = [...node.querySelectorAll('button')].find(b => b.textContent === name || b.getAttribute('aria-label') === name);
  expect(button, name).toBeDefined(); await act(async () => button!.click());
}
async function tick(ms = 300) { await act(async () => vi.advanceTimersByTimeAsync(ms)); }
const time = () => node.querySelector<HTMLTimeElement>('.historical-date time')!.dateTime;

it('switches Current ↔ Historical through the existing replay hook and keeps one Viewer and shared top bar', async () => {
  await mount(); const viewer = node.querySelector('[data-testid="stable-viewer"]'), header = node.querySelector('header');
  expect(node.querySelector('.historical-time-bar')).toBeNull(); await click('Historical');
  expect(scene.enabled.at(-1)).toBe(false); expect(scene.props.replay).toBeNull(); expect(scene.props.holding).toBe(true);
  expect(node.textContent).toContain('CURRENT DATE'); expect(node.querySelector('header')).toBe(header);
  await tick(); expect(scene.props.replay.state.effectiveAt).toBe(time());
  await click('Current'); expect(scene.enabled.at(-1)).toBe(true); expect(scene.props.replay).toBeNull();
  expect(node.querySelector('.historical-time-bar')?.getAttribute('inert')).not.toBeNull();
  await tick(160); expect(node.querySelector('.historical-time-bar')).toBeNull();
  expect(node.querySelector('[data-testid="stable-viewer"]')).toBe(viewer); expect(scene.mounts).toBe(1);
});
it('persists committed UTC and independent Current source preference across the Current round-trip', async () => {
  await mount(); const select = node.querySelector('select')!;
  await act(async () => { select.value = 'NASA_OEM'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  await click('Historical'); await tick(); await click('Historical back 10 minutes'); await tick(); const committed = time();
  expect(node.querySelector('select')?.value).toBe('PRIMARY_GP_TLE'); expect(node.querySelector('select')?.disabled).toBe(true);
  await click('Current'); expect(node.querySelector('select')?.value).toBe('NASA_OEM');
  await click('Historical'); expect(time()).toBe(committed); await tick(); expect(scene.props.replay.state.effectiveAt).toBe(committed);
  expect(scene.mounts).toBe(1);
});
it('accumulates rapid repeated ±600s clicks with functional updates and debounces to the final request', async () => {
  await mount(); await click('Historical'); await tick(); const initial = Date.parse(time()); fetchMock.mockClear();
  const back = node.querySelector<HTMLButtonElement>('[aria-label="Historical back 10 minutes"]')!;
  await act(async () => { back.click(); back.click(); back.click(); });
  expect(Date.parse(time())).toBe(initial - 1800000);
  expect(node.querySelectorAll('.measurement-unavailable')).toHaveLength(0); expect(scene.props.holding).toBe(true);
  expect(scene.props.replay.atMs).toBe(initial); expect(node.querySelector('header time')?.getAttribute('datetime')).toBe(new Date(initial).toISOString());
  await tick(); expect(fetchMock).toHaveBeenCalledTimes(1); expect(scene.props.replay.state.effectiveAt).toBe(time());
  await click('Historical forward 10 minutes'); expect(Date.parse(time())).toBe(initial - 1200000);
});
it('aborts a seek in flight, never shows its old values under the new UTC, and accepts only the last result', async () => {
  const pending: { url: string; signal: AbortSignal; resolve: (r: Response) => void }[] = [];
  fetchMock.mockImplementation((url: string, options: { signal: AbortSignal }) => url.endsWith('/coverage')
    ? Promise.resolve(Response.json(payload(url))) : new Promise<Response>(resolve => pending.push({ url, signal: options.signal, resolve })));
  await mount(); await click('Historical'); await tick(); const first = pending[0];
  await click('Historical back 10 minutes'); expect(first.signal.aborted).toBe(true); await tick();
  await act(async () => first.resolve(Response.json(payload(first.url))));
  expect(node.querySelectorAll('.measurement-unavailable')).toHaveLength(0); expect(scene.props.replay).toBeNull();
  expect(scene.props.holding).toBe(true); expect(node.textContent).toContain('CURRENT DATE');
  const final = pending[1]; await act(async () => final.resolve(Response.json(payload(final.url, 'NASA_OEM'))));
  expect(scene.props.replay.state.effectiveAt).toBe(time()); expect(scene.props.selectedSource).toBe('NASA_OEM');
  expect(node.querySelector('.trajectory-legend')?.textContent).toBe('NASA OEM');
  expect(node.querySelector('.source-state-content')).toBeNull();
  expect([...node.querySelectorAll('.position-status-bar dt')].map(e => e.textContent)).toEqual(['Latitude', 'Longitude', 'Altitude', 'Over']);
  expect(scene.mounts).toBe(1);
});

async function historicalSceneSample() {
  const at = Date.parse(time());
  await act(async () => {
    scene.props.onSceneTime(at);
    scene.props.onPosition({ source: 'PRIMARY_GP_TLE', timeMs: at, latitudeDegrees: 1, longitudeDegrees: 2, altitudeMeters: 400000 });
  });
}

it('exits Historical with the coherent Current clock/position and no false waiting notice before the next renderer tick', async () => {
  await mount(); const currentUtc = node.querySelector('header time')?.getAttribute('datetime');
  const currentValues = [...node.querySelectorAll('.summary-position dd')].map(e => e.textContent);
  await click('Historical'); await tick(); await click('Historical back 10 minutes'); await tick();
  await historicalSceneSample(); await click('Current');
  expect(node.querySelector('header time')?.getAttribute('datetime')).toBe(currentUtc);
  expect([...node.querySelectorAll('.summary-position dd')].map(e => e.textContent)).toEqual(currentValues);
  expect(node.querySelector('.earth-current-notice')).toBeNull();
  expect(node.querySelector('.historical-time-bar')?.getAttribute('inert')).not.toBeNull();
  await tick(160); expect(node.querySelector('.earth-current-notice')).toBeNull();
});

it.each(['Current → Historical', 'Historical → Current'])('keeps the shared legend/control nodes and positioning container through %s', async direction => {
  await mount(); const legend = node.querySelector('.trajectory-legend'), controls = node.querySelector('.earth-scene-controls');
  const container = legend!.parentElement;
  if (direction === 'Historical → Current') { await click('Historical'); await tick(); await historicalSceneSample(); }
  await click(direction === 'Historical → Current' ? 'Current' : 'Historical');
  expect(node.querySelector('.trajectory-legend')).toBe(legend);
  expect(node.querySelector('.earth-scene-controls')).toBe(controls);
  expect(legend!.parentElement).toBe(container); expect(controls!.parentElement).toBe(container);
  expect(scene.mounts).toBe(1);
});

it.each(['waiting', 'expired', 'delivery failure', 'scene error', 'source fallback'])('still renders the genuine %s warning after Historical exit', async kind => {
  await mount(); await click('Historical'); await tick(); await historicalSceneSample();
  if (kind === 'delivery failure') { scene.deliveryStatus = 'degraded'; scene.deliveryMessage = 'Orbital refresh failed'; }
  if (kind === 'scene error') await act(async () => scene.props.onSceneError('WebGL scene failed'));
  await click('Current');
  await act(async () => {
    if (kind === 'waiting') scene.props.onSceneTime(scene.current.startMs - 1);
    if (kind === 'expired') scene.props.onSceneTime(scene.current.endMs + 1);
    if (kind === 'source fallback') scene.props.onSourceUnavailable('OEM does not cover scene time');
  });
  const expected = kind === 'expired' ? 'Orbital buffer expired' : kind === 'scene error' ? 'WebGL scene failed' :
    kind === 'source fallback' ? 'Returned to GP/TLE' : kind === 'delivery failure' ? 'Orbital refresh failed' : 'Waiting for orbital samples';
  expect(node.querySelector('.earth-current-notice')?.textContent).toContain(expected);
});

it.each([false, true])('rapid temporal switching keeps Current presentation coherent and one Viewer (reduced motion: %s)', async reduced => {
  vi.stubGlobal('matchMedia', () => ({ matches: reduced, addEventListener() {}, removeEventListener() {} }));
  await mount(); const currentUtc = node.querySelector('header time')?.getAttribute('datetime');
  for (let i = 0; i < 4; i++) {
    await click('Historical'); await tick(); await historicalSceneSample(); await click('Current');
    expect(node.querySelector('.earth-current-notice')).toBeNull();
    expect(node.querySelector('header time')?.getAttribute('datetime')).toBe(currentUtc);
    await tick(30);
  }
  await tick(200); expect(node.querySelector('.historical-time-bar')).toBeNull(); expect(scene.mounts).toBe(1);
});
