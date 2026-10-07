// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import App from './App';
import { parseOrbitalWindow } from './orbital/sampleMapping';
import { orbitalPayload } from './test/orbitalFixture';
import { historicalPayload } from './test/historicalFixture';
import { ISS_MODEL } from './cesium/modelPresentation';
import { nextViewMode, type ViewMode } from './cesium/inspectionMode';
import type { SemanticMapping } from './cesium/modelPresentation';

// Synthetic TEST data only. Camera/astronomy are validated separately in real Cesium QA.
const scene = vi.hoisted(() => ({ props: {} as any, mounts: 0, unmounts: 0,
  delivery: {} as any, replay: vi.fn(), animations: [] as { element: HTMLElement; keys: unknown; options: unknown; cancel: ReturnType<typeof vi.fn> }[] }));
vi.mock('./layout/useEarthWorkspace', () => ({ useEarthWorkspace: () => null }));
vi.mock('./api/useOrbitalDelivery', () => ({ useOrbitalDelivery: () => scene.delivery }));
vi.mock('./api/useComparisonDelivery', () => ({ useComparisonDelivery: () => ({ response: null, status: 'unavailable' }) }));
vi.mock('./replay/useMissionReplay', () => ({ useMissionReplay: (...args: unknown[]) => scene.replay(...args) }));
vi.mock('./cesium/EarthView', () => ({ EarthView: (props: any) => {
  scene.props = props;
  useEffect(() => {
    scene.mounts++;
    const w = parseOrbitalWindow(orbitalPayload(), 0);
    props.onSceneTime(w.generatedMs); props.onModelStatus('ready');
    props.onPosition({ source: 'PRIMARY_GP_TLE', timeMs: w.generatedMs, ...w.response.currentGeodetic });
    return () => { scene.unmounts++; };
  }, []);
  return <div className="earth-view"><canvas tabIndex={0} /></div>;
} }));
let root: Root, node: HTMLDivElement;
const originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate');
const button = (name: string) => [...node.querySelectorAll('button')].find(b => b.textContent === name)!;
const shown = () => node.querySelector('.context-date time')?.getAttribute('datetime');
async function click(name: string) { await act(async () => button(name).click()); }
async function mode(next: ViewMode) { await act(async () => scene.props.onViewModeChange(next)); }
async function enter() { await click('ISS Inspection'); await mode('ENTERING_INSPECTION'); await mode('ISS_INSPECTION'); }
beforeEach(async () => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-28T15:00:00Z'));
  scene.mounts = scene.unmounts = 0; scene.animations = [];
  scene.delivery = { window: parseOrbitalWindow(orbitalPayload(), 0), status: 'ready', message: null };
  const histories = new Map<string, ReturnType<typeof historicalPayload>>();
  scene.replay.mockImplementation((enabled: boolean, at: string) => {
    if (!histories.has(at)) histories.set(at, historicalPayload(at));
    return { data: enabled ? histories.get(at) : null, loading: false, error: null, coverage: null };
  });
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: function(this: HTMLElement, keys: unknown, options: unknown) {
    const cancel = vi.fn(); scene.animations.push({ element: this, keys, options, cancel }); return { cancel } as unknown as Animation;
  } });
  node = document.createElement('div'); document.body.append(node); root = createRoot(node);
  await act(async () => root.render(<App />));
});
afterEach(async () => {
  if (root) await act(async () => root.unmount()); node?.remove(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  if (originalAnimate) Object.defineProperty(HTMLElement.prototype, 'animate', originalAnimate);
  else delete (HTMLElement.prototype as unknown as { animate?: unknown }).animate;
});

it('sends entry to the existing bridge and changes chrome only after the renderer reports entering', async () => {
  await click('ISS Inspection'); expect(scene.props.inspectionRequest).toBe(1);
  expect(node.querySelector('.inspection-strip')).toBeNull();
  await mode('ENTERING_INSPECTION');
  expect(node.querySelector('.inspection-strip')).not.toBeNull();
  expect(button('ISS Inspection').getAttribute('aria-pressed')).toBe('true');
  expect(button('Earth').disabled).toBe(false); expect(button('Modules').disabled).toBe(true);
  expect(node.textContent).toContain('Approaching moving ISS target');
});
it('renders S5 base identity, actual model credit, real empty selection and two actions', async () => {
  await enter(); const strip = node.querySelector('.inspection-strip')!;
  expect(strip.textContent).toContain('ISS / Inspection'); expect(strip.textContent).toContain('Spatial investigation');
  expect(strip.textContent).toContain(ISS_MODEL.credit.replace(/^ISS 3D model:\s*/, ''));
  expect(node.querySelector('.inspection-selection strong')?.textContent).toBe('None');
  expect(button('Modules').disabled).toBe(false); expect(strip.querySelector('summary')?.textContent).toBe('Orbital detail');
  expect(node.querySelector('.inspection-hint,.status-panel,.replay-controls')).toBeNull();
});
it('keeps the shared top bar mounted and its accepted Current UTC unchanged during entry/exit', async () => {
  const context = node.querySelector('.top-context-bar'), at = shown(), window = scene.props.window;
  await enter(); expect(node.querySelector('.top-context-bar')).toBe(context); expect(shown()).toBe(at);
  expect(scene.props.window).toBe(window); expect(scene.props.replay).toBeNull();
  await click('Earth'); expect(scene.props.overviewRequest).toBe(1);
  await mode('EXITING_INSPECTION'); expect(button('Earth').disabled).toBe(true);
  expect(button('Earth').getAttribute('aria-pressed')).toBe('true');
  await mode('EARTH_OVERVIEW'); expect(node.querySelector('.top-context-bar')).toBe(context);
  expect(shown()).toBe(at); expect(scene.mounts).toBe(1); expect(scene.unmounts).toBe(0);
});
it('removes Earth controls and trajectory legend throughout entry, Inspection and exit', async () => {
  for (const state of ['ENTERING_INSPECTION', 'ISS_INSPECTION', 'EXITING_INSPECTION'] as const) {
    await mode(state); expect(node.querySelector('.earth-scene-controls,.trajectory-legend')).toBeNull();
  }
  await mode('EARTH_OVERVIEW'); expect(node.querySelector('.earth-scene-controls')).not.toBeNull();
  expect(node.querySelector('.trajectory-legend')).not.toBeNull();
});
it('keeps source, temporal and Crew guards accessible during all station-focused states', async () => {
  const target = scene.replay.mock.calls.at(-1)?.[1];
  for (const state of ['ENTERING_INSPECTION', 'ISS_INSPECTION', 'EXITING_INSPECTION'] as const) {
    await mode(state);
    expect(node.querySelector<HTMLSelectElement>('select[aria-label="Orbital source"]')?.disabled).toBe(true);
    for (const name of ['Current', 'Historical', 'Crew', 'ISS Inspection']) expect(button(name).disabled).toBe(true);
    expect(button('Historical').getAttribute('aria-describedby')).toBe('inspection-navigation-guard');
    await click('Historical'); await click('Crew');
    expect(scene.replay.mock.calls.at(-1)?.[1]).toBe(target); expect(scene.props.replay).toBeNull();
    expect(node.querySelector('.crew-panel')).toBeNull();
  }
});
it('keeps accepted Historical time, envelope, source and replayAt through Inspection and return', async () => {
  await click('Historical'); const at = shown(), committed = scene.replay.mock.calls.at(-1)?.[1], data = scene.props.replay.state;
  await enter(); expect(shown()).toBe(at); expect(scene.props.replay.state).toBe(data);
  expect(scene.props.replay.atMs).toBe(Date.parse(committed));
  expect(node.querySelector('.context-date span')?.textContent).toBe('HISTORICAL DATE');
  expect(node.querySelector('.historical-time-bar')?.hasAttribute('inert')).toBe(true);
  await act(async () => vi.advanceTimersByTimeAsync(200)); expect(node.querySelector('.historical-time-bar')).toBeNull();
  await click('Earth'); await mode('EXITING_INSPECTION'); await mode('EARTH_OVERVIEW');
  expect(shown()).toBe(at); expect(scene.replay.mock.calls.at(-1)?.[1]).toBe(committed);
  expect(node.querySelector('.historical-date time')?.getAttribute('datetime')).toBe(committed);
});
it('returns safely when entry is interrupted and lets renderer completion decide the final layout', async () => {
  await click('ISS Inspection'); await mode('ENTERING_INSPECTION'); await click('Earth');
  expect(scene.props.overviewRequest).toBe(1); await mode('EXITING_INSPECTION');
  expect(node.querySelector('.inspection-strip')).not.toBeNull();
  expect(nextViewMode('EXITING_INSPECTION', 'ENTRY_COMPLETE')).toBe('EXITING_INSPECTION');
  await mode('EARTH_OVERVIEW'); expect(node.querySelector('.inspection-strip')).toBeNull();
  expect(button('ISS Inspection').disabled).toBe(false); expect(scene.mounts).toBe(1);
});
it('preserves the existing prohibition on re-entry before exit completes', async () => {
  await enter(); await click('Earth'); await mode('EXITING_INSPECTION'); await click('ISS Inspection');
  expect(scene.props.inspectionRequest).toBe(1);
  expect(nextViewMode('EXITING_INSPECTION', 'ENTER')).toBe('EXITING_INSPECTION');
  await mode('EARTH_OVERVIEW'); await click('ISS Inspection'); expect(scene.props.inspectionRequest).toBe(2);
});
it('Modules focuses the real canvas without choosing a fabricated module or changing orbit/time', async () => {
  await enter(); const canvas = node.querySelector('canvas'), window = scene.props.window, time = shown();
  await click('Modules'); expect(document.activeElement).toBe(canvas);
  expect(node.querySelector('.inspection-selection strong')?.textContent).toBe('None');
  expect(scene.props.window).toBe(window); expect(shown()).toBe(time);
});
it('keeps existing verified picking presentation without adding a Phase 7 dock', async () => {
  await enter(); const module = ISS_MODEL.semanticMappings.find(m => m.status === 'VERIFIED')!;
  await act(async () => scene.props.onModuleSelection(module as SemanticMapping));
  expect(node.querySelector('.inspection-selection strong')?.textContent).toBe(module.displayName);
  expect(node.querySelector('.module-panel')?.textContent).toContain(module.displayName);
  expect(node.querySelector('.context-dock')).toBeNull();
  await act(async () => scene.props.onModuleSelection(null));
  expect(node.querySelector('.inspection-selection strong')?.textContent).toBe('None');
});
it('orbital detail reuses the existing evidence region and keeps it outside the scene layout owners', async () => {
  await enter(); const evidence = node.querySelector('#orbital-status-evidence')!;
  expect(evidence.textContent).toContain('GP/TLE'); expect(node.querySelector('.inspection-orbital-toggle summary')?.getAttribute('aria-controls')).toBe(evidence.id);
  expect(node.querySelector('.status-panel,.replay-orbit')).toBeNull();
});
it('uses authoritative Historical details rather than the isolated Current context', async () => {
  await click('Historical'); await enter();
  expect(node.querySelector('#orbital-status-evidence')?.textContent).toContain(scene.props.replay.state.effectiveAt);
  expect(node.querySelector('#orbital-status-evidence')?.textContent).toContain('TEST-retimed-source');
  expect(node.querySelector('.earth-current-notice')).toBeNull();
});
it('has no false Current warning during coherent Inspection', async () => {
  await enter(); expect(node.querySelector('.earth-current-notice')).toBeNull();
  await mode('EXITING_INSPECTION'); expect(node.querySelector('.earth-current-notice')).toBeNull();
});
it.each(['delivery', 'scene', 'expired', 'source fallback'])('preserves legitimate %s warnings in Inspection', async kind => {
  await enter();
  if (kind === 'delivery') { scene.delivery = { ...scene.delivery, status: 'degraded', message: 'Real delivery failure TEST' }; await act(async () => root.render(<App />)); }
  if (kind === 'scene') await act(async () => scene.props.onSceneError('Real WebGL failure TEST'));
  if (kind === 'expired') await act(async () => scene.props.onSceneTime(scene.delivery.window.endMs + 1));
  if (kind === 'source fallback') await act(async () => scene.props.onSourceUnavailable('Real OEM gap TEST'));
  expect(node.querySelector('.earth-current-notice')).not.toBeNull();
});
it('dissolves only presentation surfaces for 280ms and leaves the Viewer/canvas outside animation targets', async () => {
  await mode('ENTERING_INSPECTION'); const entry = scene.animations.at(-1)!;
  expect(entry.element.className).toBe('inspection-strip'); expect(entry.options).toEqual({ duration: 280, easing: 'cubic-bezier(0.42,0,0.58,1)' });
  expect(entry.keys).toEqual({ opacity: [0, 1] });
  await mode('EARTH_OVERVIEW'); expect(entry.cancel).toHaveBeenCalledOnce();
  expect(scene.animations.at(-1)?.element.className).toBe('operational-summary');
  expect(scene.animations.every(a => !a.element.matches('.earth-view,canvas,.top-context-bar'))).toBe(true);
});
it('uses <=120ms opacity-only presentation under reduced motion', async () => {
  // Preference is read by the hook independently of navigation state.
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  await act(async () => root.unmount()); root = createRoot(node); await act(async () => root.render(<App />));
  await mode('ENTERING_INSPECTION'); expect(scene.animations.at(-1)?.options).toEqual({ duration: 120, easing: 'linear' });
  expect(scene.animations.at(-1)?.keys).toEqual({ opacity: [0, 1] });
});
