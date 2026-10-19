// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import App from './App';
import { decodeCountryCatalog } from './geo/countryLookup';
import asset from './geo/countryAsset.json';
import { parseOrbitalWindow } from './orbital/sampleMapping';
import { orbitalPayload } from './test/orbitalFixture';
import { historicalPayload } from './test/historicalFixture';
import { parseComparison } from './orbital/comparison';
import { fixture } from './test/comparisonFixture';

const h = vi.hoisted(() => ({ props: {} as any, delivery: {} as any, comparison: {} as any,
  data: null as any, requestedAt: '', load: vi.fn(), mounts: 0 }));
vi.mock('./geo/countryCatalog', () => ({ loadCountryCatalog: () => h.load() }));
// Isolate the frozen country contract; the companion fallback has its own integration suite.
vi.mock('./geo/marineCatalog', () => ({ loadMarineCatalog: () => Promise.reject(new Error('TEST marine unavailable')) }));
vi.mock('./layout/useEarthWorkspace', () => ({ useEarthWorkspace: () => null }));
vi.mock('./api/useOrbitalDelivery', () => ({ useOrbitalDelivery: () => h.delivery }));
vi.mock('./api/useComparisonDelivery', () => ({ useComparisonDelivery: () => h.comparison }));
vi.mock('./replay/useMissionReplay', () => ({ useMissionReplay: (enabled: boolean, at: string) => {
  h.requestedAt = at; return { data: enabled ? h.data : null, loading: enabled && !h.data, error: null, coverage: null };
} }));
vi.mock('./crew/CurrentCrewWorkspace', () => ({ CurrentCrewWorkspace: () => null }));
vi.mock('./cesium/EarthView', () => ({ EarthView: (props: any) => {
  h.props = props;
  useEffect(() => { h.mounts++; props.onModelStatus('ready'); }, []);
  return <div className="earth-view" />;
} }));
const catalog = decodeCountryCatalog(JSON.parse(readFileSync(`public/geo/${asset.file}`, 'utf8')));
let root: Root, node: HTMLDivElement;
const name = () => node.querySelector('.position-over dd')!.textContent;
async function render() { await act(async () => root.render(<App />)); }
async function click(name: string) {
  await act(async () => [...node.querySelectorAll('button')].find(b => b.textContent === name || b.getAttribute('aria-label') === name)!.click());
}
async function emit(lon: number, lat: number, source = 'PRIMARY_GP_TLE', offset = 0) {
  const time = h.delivery.window.generatedMs + offset;
  await act(async () => { h.props.onSceneTime(time); h.props.onPosition({ source, timeMs: time, longitudeDegrees: lon, latitudeDegrees: lat, altitudeMeters: 420000 }); });
}
beforeEach(async () => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  vi.useFakeTimers(); h.delivery = { window: parseOrbitalWindow(orbitalPayload(), 0), status: 'ready', message: null };
  vi.setSystemTime(h.delivery.window.generatedMs); h.data = null; h.mounts = 0;
  const c = parseComparison(fixture(true)), delta = h.delivery.window.generatedMs - Date.parse(c.generatedAt);
  const shift = (s: string) => new Date(Date.parse(s)+delta).toISOString(); c.generatedAt=shift(c.generatedAt);
  c.oem.source!.startTime=shift(c.oem.source!.startTime); c.oem.source!.stopTime=shift(c.oem.source!.stopTime);
  c.oem.samples.forEach(s => { s.time=shift(s.time); }); h.comparison={ response: c, status: 'ready' };
  h.load.mockReset().mockResolvedValue(catalog);
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  node = document.createElement('div'); document.body.append(node); root=createRoot(node);
});
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('derives Current GP/OEM/fallback from the same physical readouts and shares the persistent bar across view modes', async () => {
  await render(); await emit(12.4964,41.9028); expect(name()).toBe('Italy');
  const bar = node.querySelector('.position-status-bar');
  expect(node.querySelector('.summary-latitude dd')!.textContent).toBe('41.903° N');
  for (const mode of ['ENTERING_INSPECTION','ISS_INSPECTION','EXITING_INSPECTION','EARTH_OVERVIEW']) {
    await act(async () => h.props.onViewModeChange(mode)); expect(name()).toBe('Italy');
    expect(node.querySelector('.position-status-bar')).toBe(bar);
  }
  const select=node.querySelector('select')!;
  await act(async () => { select.value='NASA_OEM'; select.dispatchEvent(new Event('change',{bubbles:true})); });
  expect(name()).toBe('—'); // old GP sample cannot label newly selected source
  await emit(139.692,35.69,'NASA_OEM'); expect(name()).toBe('Japan');
  await act(async () => h.props.onSourceUnavailable('TEST OEM fallback'));
  expect(name()).toBe('—'); await emit(-47.882,-15.794); expect(name()).toBe('Brazil');
  await emit(-140,0); expect(name()).toBe('—');
  expect(node.querySelector('[data-country-state]')!.getAttribute('data-country-state')).toBe('no-country');
  await emit(12.4964,41.9028); h.delivery={...h.delivery,status:'degraded'};
  await act(async () => h.props.onSceneTime(h.delivery.window.endMs+1)); expect(name()).toBe('—');
  expect(h.mounts).toBe(1); expect(h.load).toHaveBeenCalledTimes(1);
});

it.each(['GP_TLE','NASA_OEM'] as const)('uses accepted Historical %s, retains outgoing result while seeking, and ignores stale requests', async source => {
  await render(); await emit(12.4964,41.9028); await click('Historical'); expect(name()).toBe('Italy');
  const at=h.requestedAt; h.data=historicalPayload(at,source);
  Object.assign(h.data.orbit.primary,{latitudeDegrees:35.69,longitudeDegrees:139.692});
  await render(); expect(name()).toBe('Japan');
  for(const mode of ['ISS_INSPECTION','EARTH_OVERVIEW']) {await act(async()=>h.props.onViewModeChange(mode)); expect(name()).toBe('Japan');}
  await click('Historical back 10 minutes'); expect(name()).toBe('Japan');
  const acceptedAt=h.requestedAt;
  await click('Historical back 10 minutes'); const newestAt=h.requestedAt;
  h.data=historicalPayload(acceptedAt,source); Object.assign(h.data.orbit.primary,{latitudeDegrees:-15.794,longitudeDegrees:-47.882});
  await render(); expect(name()).toBe('Japan'); // obsolete async result cannot install a country
  h.data=historicalPayload(newestAt,source); Object.assign(h.data.orbit.primary,{latitudeDegrees:-15.794,longitudeDegrees:-47.882});
  await render(); expect(name()).toBe('Brazil');
  await emit(-100,40); expect(name()).toBe('Brazil'); // historical callback cannot replace accepted state
  await click('Current'); await emit(12.4964,41.9028); expect(name()).toBe('Italy');
  expect(h.load).toHaveBeenCalledTimes(1);
});

it('handles delayed catalog readiness against the latest accepted input and isolates dataset failure', async () => {
  let ready!: (c: typeof catalog) => void; h.load.mockReturnValue(new Promise(resolve => {ready=resolve;}));
  await render(); await emit(12.4964,41.9028); expect(name()).toBe('—');
  expect(node.querySelector('[data-country-state]')!.getAttribute('data-country-state')).toBe('dataset-loading');
  await emit(139.692,35.69); await act(async()=>ready(catalog)); expect(name()).toBe('Japan');
  await emit(NaN,0); expect(name()).toBe('—'); expect(node.querySelector('.summary-latitude dd')!.textContent).toBe('Unavailable');
});
it('does not hide physical coordinates when catalog initialization fails', async () => {
  h.load.mockRejectedValue(new Error('TEST local catalog failure')); await render(); await emit(12.4964,41.9028);
  expect(name()).toBe('—'); expect(node.querySelector('[data-country-state]')!.getAttribute('data-country-state')).toBe('dataset-unavailable');
  expect(node.querySelector('.summary-latitude dd')!.textContent).toBe('41.903° N');
});
