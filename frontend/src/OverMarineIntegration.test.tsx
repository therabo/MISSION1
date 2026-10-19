// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import App from './App';
import { decodeCountryCatalog } from './geo/countryLookup';
import asset from './geo/countryAsset.json';
import marineAsset from './geo/marineAsset.json';
import { decodeMarineCatalog } from './geo/marineLookup';
import * as marineMath from './geo/marineLookup';
import { parseOrbitalWindow } from './orbital/sampleMapping';
import { orbitalPayload } from './test/orbitalFixture';
import { historicalPayload } from './test/historicalFixture';
import { parseComparison } from './orbital/comparison';
import { fixture } from './test/comparisonFixture';

const h = vi.hoisted(() => ({ props: {} as any, delivery: {} as any, comparison: {} as any,
  data: null as any, requestedAt: '', load: vi.fn(), marineLoad: vi.fn(), mounts: 0 }));
vi.mock('./geo/countryCatalog', () => ({ loadCountryCatalog: () => h.load() }));
vi.mock('./geo/marineCatalog', () => ({ loadMarineCatalog: () => h.marineLoad() }));
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
const marineCatalog = decodeMarineCatalog(JSON.parse(readFileSync(`public/geo/${marineAsset.file}`, 'utf8')));
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
  h.load.mockReset().mockResolvedValue(catalog); h.marineLoad.mockReset().mockResolvedValue(marineCatalog);
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  node = document.createElement('div'); document.body.append(node); root=createRoot(node);
});
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('uses one accepted Current context for GP/OEM/fallback and does no marine work on camera/view rerenders', async () => {
  const lookup=vi.spyOn(marineMath,'lookupMarineRegion');
  await render(); await emit(-40,30);expect(name()).toBe('Atlantic Ocean');expect(lookup).toHaveBeenCalledTimes(1);
  expect(node.querySelector('.summary-latitude dd')!.textContent).toBe('30.000° N');
  const bar=node.querySelector('.position-status-bar');
  for(const mode of ['ENTERING_INSPECTION','ISS_INSPECTION','EXITING_INSPECTION','EARTH_OVERVIEW']) {
    await act(async()=>h.props.onViewModeChange(mode));expect(name()).toBe('Atlantic Ocean');expect(node.querySelector('.position-status-bar')).toBe(bar);
  }
  expect(lookup).toHaveBeenCalledTimes(1);
  await emit(-40,30,'PRIMARY_GP_TLE',1000);expect(lookup).toHaveBeenCalledTimes(2);
  const select=node.querySelector('select')!;
  await act(async()=>{select.value='NASA_OEM';select.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(name()).toBe('—');expect(lookup).toHaveBeenCalledTimes(2);
  await emit(18,34,'NASA_OEM',2000);expect(name()).toBe('Mediterranean Sea');
  await act(async()=>h.props.onSourceUnavailable('TEST OEM unavailable'));expect(name()).toBe('—');
  await emit(12.4964,41.9028,'PRIMARY_GP_TLE',3000);expect(name()).toBe('Italy');expect(node.querySelector('.country-mark')).not.toBeNull();
  await emit(-140,0,'PRIMARY_GP_TLE',4000);expect(name()).toBe('Pacific Ocean');
  await act(async()=>h.props.onSceneTime(h.delivery.window.endMs+1));expect(name()).toBe('—');
  expect(h.mounts).toBe(1);expect(h.load).toHaveBeenCalledTimes(1);expect(h.marineLoad).toHaveBeenCalledTimes(1);
});

it.each(['GP_TLE','NASA_OEM'] as const)('uses coherent Historical %s and never installs pending/stale requested geography', async source=>{
  await render();await emit(-40,30);await click('Historical');expect(name()).toBe('Atlantic Ocean');
  h.data=historicalPayload(h.requestedAt,source);Object.assign(h.data.orbit.primary,{latitudeDegrees:34,longitudeDegrees:18});
  await render();expect(name()).toBe('Mediterranean Sea');
  for(const mode of ['ISS_INSPECTION','EARTH_OVERVIEW']){await act(async()=>h.props.onViewModeChange(mode));expect(name()).toBe('Mediterranean Sea');}
  await click('Historical back 10 minutes');const obsolete=h.requestedAt;expect(name()).toBe('Mediterranean Sea');
  await click('Historical back 10 minutes');const latest=h.requestedAt;
  h.data=historicalPayload(obsolete,source);Object.assign(h.data.orbit.primary,{latitudeDegrees:15,longitudeDegrees:-75});
  await render();expect(name()).toBe('Mediterranean Sea');
  h.data=historicalPayload(latest,source);Object.assign(h.data.orbit.primary,{latitudeDegrees:20,longitudeDegrees:38});
  await render();expect(name()).toBe('Red Sea');
  await emit(-140,-20);expect(name()).toBe('Red Sea');
  await click('Current');await emit(-140,-20);expect(name()).toBe('Pacific Ocean');
  expect(h.load).toHaveBeenCalledTimes(1);expect(h.marineLoad).toHaveBeenCalledTimes(1);
});

it('starts both catalog loads after initial render without waiting for country or water', async()=>{
  let countryReady!: (v:typeof catalog)=>void, marineReady!:(v:typeof marineCatalog)=>void;
  h.load.mockReturnValue(new Promise(r=>{countryReady=r;}));h.marineLoad.mockReturnValue(new Promise(r=>{marineReady=r;}));
  await render();expect(h.load).toHaveBeenCalledTimes(1);expect(h.marineLoad).toHaveBeenCalledTimes(1);
  await emit(-40,30);expect(name()).toBe('—');
  await act(async()=>countryReady(catalog));expect(name()).toBe('—');
  expect(node.querySelector('[data-over-state]')!.getAttribute('data-geography-dataset')).toBe('marine');
  await emit(12.4964,41.9028);expect(name()).toBe('Italy');
  await emit(-140,-20);await act(async()=>marineReady(marineCatalog));expect(name()).toBe('Pacific Ocean');
});

it('keeps country loading/failure authoritative even when marine is ready', async()=>{
  let reject!:(e:Error)=>void;h.load.mockReturnValue(new Promise((_,r)=>{reject=r;}));
  const lookup=vi.spyOn(marineMath,'lookupMarineRegion');await render();await emit(-40,30);expect(name()).toBe('—');
  expect(node.querySelector('[data-over-state]')!.getAttribute('data-country-state')).toBe('dataset-loading');
  await act(async()=>reject(new Error('TEST country failure')));expect(name()).toBe('—');
  expect(node.querySelector('[data-over-state]')!.getAttribute('data-country-state')).toBe('dataset-unavailable');
  expect(node.querySelector('.summary-latitude dd')!.textContent).toBe('30.000° N');expect(lookup).not.toHaveBeenCalled();
});

it('isolates marine failure and never hides a valid country or coordinates', async()=>{
  h.marineLoad.mockRejectedValue(new Error('TEST marine failure'));await render();await emit(12.4964,41.9028);expect(name()).toBe('Italy');
  await emit(-40,30);expect(name()).toBe('—');expect(node.querySelector('[data-over-state]')!.getAttribute('data-over-state')).toBe('dataset-unavailable');
  expect(node.querySelector('[data-over-state]')!.getAttribute('data-geography-dataset')).toBe('marine');
  expect(node.querySelector('[data-over-state]')!.getAttribute('data-country-state')).toBe('no-country');
  expect(node.querySelector('.summary-latitude dd')!.textContent).toBe('30.000° N');
  await emit(NaN,0);expect(name()).toBe('—');expect(node.querySelector('.summary-latitude dd')!.textContent).toBe('Unavailable');
});
