// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { beforeEach,afterEach,expect,it,vi } from 'vitest';
// Geographic loading is isolated here; real-catalog integration is covered in OverCountryIntegration.test.tsx.
vi.mock('../geo/countryCatalog', () => ({ loadCountryCatalog: () => new Promise(() => {}) }));
import App from '../App';
const mission1Wordmark = '/branding/MISSION1-logo.png';
import { replayFixture } from '../test/replayFixture';
const flags=vi.hoisted(() => ({live:[] as boolean[],comparison:[] as boolean[]}));
vi.mock('../api/useOrbitalDelivery',() => ({useOrbitalDelivery:(enabled=true) => {flags.live.push(enabled);return {window:null,status:'unavailable',message:null};}}));
vi.mock('../api/useComparisonDelivery',() => ({useComparisonDelivery:(_time:unknown,enabled=true) => {flags.comparison.push(enabled);return {response:null,status:'loading'};}}));
vi.mock('../cesium/EarthView',() => ({EarthView:({replay}:{replay:{atMs:number}|null}) => <div data-testid="scene" data-epoch={replay?.atMs ?? 'LIVE'}/> }));
vi.mock('../crew/CurrentCrewPanel',() => ({CurrentCrewPanelView:() => <aside id="crew-panel">Current Crew</aside>}));
let node:HTMLDivElement,root:Root;
beforeEach(() => {Object.defineProperty(globalThis,'IS_REACT_ACT_ENVIRONMENT',{value:true,configurable:true});vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-03T13:00:00Z'));flags.live.length=0;flags.comparison.length=0;node=document.createElement('div');document.body.append(node);root=createRoot(node);vi.stubGlobal('ResizeObserver',class {observe(){} disconnect(){}});vi.stubGlobal('requestAnimationFrame',(f:()=>void)=>setTimeout(f,0));vi.stubGlobal('fetch',vi.fn((url:string)=>{const fixture=replayFixture(url.includes('?at=')?decodeURIComponent(url.split('at=')[1]):undefined);return Promise.resolve(Response.json(url.endsWith('/coverage')?{crew:fixture.crew.coverage,orbit:fixture.orbit.coverage,joint:fixture.crew.coverage,orbitGate:'BOUNDED'}:fixture));}));});
afterEach(async() => {await act(async()=>root.unmount());node.remove();vi.unstubAllGlobals();vi.useRealTimers();});
async function click(text:string) {const button=[...node.querySelectorAll('button')].find(b=>b.textContent===text);expect(button).toBeDefined();await act(async()=>button!.click());}
it('keeps the standalone accessible wordmark mounted in LIVE and REPLAY',async()=>{
  await act(async()=>root.render(<App/>));
  const logo=node.querySelector<HTMLImageElement>('.top-brand img');
  expect(logo?.getAttribute('src')).toBe(mission1Wordmark);
  expect(logo?.alt).toBe('MISSION1');
  expect(logo?.width).toBe(2155);
  expect(logo?.height).toBe(730);
  expect(logo?.closest('[aria-hidden="true"], a, button')).toBeNull();
  expect(node.querySelector('.top-brand')?.textContent?.trim()).toBe('');
  await click('Historical');
  expect(node.querySelector('.top-brand img')).toBe(logo);
  expect(node.querySelector('.top-brand')?.textContent?.trim()).toBe('');
  await click('Current');
  expect(node.querySelector('.top-brand img')).toBe(logo);
});
it('LIVE to REPLAY to LIVE preserves scene element and restores current Crew/polling',async()=>{await act(async()=>root.render(<App/>));const scene=node.querySelector('[data-testid=scene]');expect(node.querySelector('.position-status-bar')).not.toBeNull();await click('Historical');expect(flags.live.at(-1)).toBe(false);expect(flags.comparison.at(-1)).toBe(false);expect(node.querySelector('.position-status-bar')).not.toBeNull();await act(async()=>vi.advanceTimersByTimeAsync(300));expect(node.textContent).toContain('Orbit history unavailable');await click('Crew');expect(node.textContent).toContain('ISS Crew history');await click('Current');expect(node.querySelector('[data-testid=scene]')).toBe(scene);expect(node.textContent).toContain('Current Crew');expect(node.querySelector('.position-status-bar')).not.toBeNull();expect(flags.live.at(-1)).toBe(true);expect(flags.comparison.at(-1)).toBe(true);expect(scene?.getAttribute('data-epoch')).toBe('LIVE');});
