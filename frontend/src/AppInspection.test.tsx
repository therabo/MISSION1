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
import { crewFixture, personFixture } from './test/crewFixture';

// Synthetic TEST data only. Camera/astronomy are validated separately in real Cesium QA.
const scene = vi.hoisted(() => ({ props: {} as any, mounts: 0, unmounts: 0,
  delivery: {} as any, replay: vi.fn(), crewError: null as string | null, profileError: null as string | null,
  retryCrew: vi.fn(), retryProfile: vi.fn(),
  animations: [] as { element: HTMLElement; keys: unknown; options: unknown; cancel: ReturnType<typeof vi.fn> }[] }));
vi.mock('./api/useCrewResource', () => ({ useIssCrew: () => ({ data: crewFixture(), loading: false, error: scene.crewError, refresh: scene.retryCrew }),
  useCrewMember: (id: string) => ({ data: { ...personFixture(), id }, loading: false, error: scene.profileError, refresh: scene.retryProfile }) }));
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
const button = (name: string) => [...node.querySelectorAll('button')].find(b => b.textContent === name || b.getAttribute('aria-label') === name)!;
const shown = () => node.querySelector('.context-date time')?.getAttribute('datetime');
async function click(name: string) { await act(async () => button(name).click()); }
async function mode(next: ViewMode) { await act(async () => scene.props.onViewModeChange(next)); }
async function enter() { await click('ISS Inspection'); await mode('ENTERING_INSPECTION'); await mode('ISS_INSPECTION'); }
beforeEach(async () => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-28T15:00:00Z'));
  scene.mounts = scene.unmounts = 0; scene.animations = [];
  scene.crewError = scene.profileError = null; scene.retryCrew.mockClear(); scene.retryProfile.mockClear();
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
it('keeps source/temporal guards while Crew opens immediately from station-focused states', async () => {
  const target = scene.replay.mock.calls.at(-1)?.[1];
  for (const state of ['ENTERING_INSPECTION', 'ISS_INSPECTION', 'EXITING_INSPECTION'] as const) {
    await mode(state);
    expect(node.querySelector<HTMLSelectElement>('select[aria-label="Orbital source"]')?.disabled).toBe(true);
    for (const name of ['Current', 'Historical', 'ISS Inspection']) expect(button(name).disabled).toBe(true);
    expect(button('Historical').getAttribute('aria-describedby')).toBe('inspection-navigation-guard');
    expect(button('Crew').disabled).toBe(false);
    await click('Historical'); await click('Crew');
    expect(button('Crew').hasAttribute('aria-busy')).toBe(false);
    expect(node.querySelector('.crew-workspace-host')?.hasAttribute('inert')).toBe(false);
    await click('Crew'); // Close the surface; the renderer still owns the return.
    await act(async () => vi.advanceTimersByTimeAsync(240));
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
it('uses the verified picking state in one module dock without retaining the old panel', async () => {
  await enter(); const module = ISS_MODEL.semanticMappings.find(m => m.status === 'VERIFIED')!;
  await act(async () => scene.props.onModuleSelection(module as SemanticMapping));
  expect(node.querySelector('.inspection-selection strong')?.textContent).toBe(module.displayName);
  expect(node.querySelector('.context-dock')?.textContent).toContain(module.displayName);
  expect(node.querySelectorAll('.context-dock')).toHaveLength(1);
  expect(node.querySelector('.module-panel')).toBeNull();
  expect(scene.props.moduleSelection).toBe(module);
  await act(async () => scene.props.onModuleSelection(null));
  expect(node.querySelector('.inspection-selection strong')?.textContent).toBe('None');
});
it('orbital detail reuses the existing evidence region and keeps it outside the scene layout owners', async () => {
  await enter(); const evidence = node.querySelector('#orbital-status-evidence')!;
  expect(evidence.textContent).toContain('GP/TLE'); expect(node.querySelector('.inspection-orbital-toggle summary')?.getAttribute('aria-controls')).toBe(evidence.id);
  expect(node.querySelector('.status-panel,.replay-orbit')).toBeNull();
});
it('module close reconciles the authoritative renderer prop without leaving Inspection or changing source/time', async () => {
  await enter(); const module = ISS_MODEL.semanticMappings[5], time = shown(), source = scene.props.selectedSource;
  const requests = [scene.props.inspectionRequest, scene.props.overviewRequest], window = scene.props.window;
  await act(async () => scene.props.onModuleSelection(module)); await click('Close module information');
  expect(scene.props.moduleSelection).toBeNull(); expect(node.querySelector('.inspection-selection strong')?.textContent).toBe('None');
  expect(node.querySelector('.module-dock')?.hasAttribute('inert')).toBe(true);
  expect(scene.props.selectedSource).toBe(source); expect(scene.props.window).toBe(window); expect(shown()).toBe(time);
  expect([scene.props.inspectionRequest, scene.props.overviewRequest]).toEqual(requests);
  await act(async () => vi.advanceTimersByTimeAsync(200)); expect(node.querySelector('.module-dock')).toBeNull();
});
it('Escape dismisses the selected module before any Inspection navigation', async () => {
  await enter(); await act(async () => scene.props.onModuleSelection(ISS_MODEL.semanticMappings[0]));
  await act(async () => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
  expect(scene.props.moduleSelection).toBeNull(); expect(scene.props.overviewRequest).toBe(0);
  expect(node.dataset.viewMode ?? node.querySelector('main')?.dataset.viewMode).toBe('ISS_INSPECTION');
});
it('renderer invalidation clears the dock without retaining old selected presentation', async () => {
  await enter(); await act(async () => scene.props.onModuleSelection(ISS_MODEL.semanticMappings[0]));
  await act(async () => scene.props.onModuleSelection(null)); await mode('EXITING_INSPECTION');
  expect(scene.props.moduleSelection).toBeNull(); expect(node.querySelector('.module-dock')?.getAttribute('aria-hidden')).toBe('true');
  await act(async () => vi.advanceTimersByTimeAsync(200)); expect(node.querySelector('.module-dock')).toBeNull();
});
it('selected Historical detail uses accepted UTC and preserves the existing seek/mode guards', async () => {
  await click('Historical'); await enter(); const time = shown(), state = scene.props.replay.state, at = scene.props.replay.atMs;
  await act(async () => scene.props.onModuleSelection(ISS_MODEL.semanticMappings[3]));
  expect(node.querySelector('.module-dock time')?.getAttribute('datetime')).toBe(state.effectiveAt);
  expect(node.querySelector('.module-dock')?.textContent).toContain('not reconstructed');
  expect(button('Current').disabled).toBe(true); expect(button('Historical').disabled).toBe(true);
  await click('Current'); expect(scene.props.replay.state).toBe(state); expect(scene.props.replay.atMs).toBe(at); expect(shown()).toBe(time);
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

it('Earth → Crew preserves the shared context, source, time and mounted scene', async () => {
  const context = node.querySelector('.top-context-bar'), at = shown(), window = scene.props.window, source = scene.props.selectedSource;
  await click('Crew');
  expect(node.querySelector('.crew-workspace')).not.toBeNull();
  expect(node.querySelector('.top-context-bar')).toBe(context);
  expect(button('Crew').getAttribute('aria-pressed')).toBe('true'); expect(button('Crew').getAttribute('aria-expanded')).toBe('true');
  expect(scene.props.window).toBe(window); expect(scene.props.selectedSource).toBe(source); expect(shown()).toBe(at);
  expect(scene.props.inspectionRequest).toBe(0); expect(scene.props.overviewRequest).toBe(0);
  expect(scene.mounts).toBe(1); expect(scene.unmounts).toBe(0);
});
it('Crew close returns to Earth with an inert exit and stable focus', async () => {
  await click('Crew'); const at = shown(); await click('Close crew panel');
  expect(node.querySelector('.crew-workspace-host')?.hasAttribute('inert')).toBe(true);
  await act(async () => vi.advanceTimersByTimeAsync(240));
  expect(node.querySelector('.crew-panel')).toBeNull(); expect(document.activeElement?.id).toBe('crew-launcher');
  expect(shown()).toBe(at); expect(scene.mounts).toBe(1); expect(scene.unmounts).toBe(0);
});
it.each([false, true])('opens Crew in the request interaction, independently of renderer completion (historical=%s)', async historical => {
  if (historical) await click('Historical');
  await enter(); const time = shown(); await click('Crew');
  const surface = node.querySelector('.crew-workspace');
  expect(scene.props.overviewRequest).toBe(1); expect(surface).not.toBeNull();
  expect(node.querySelector('main')?.dataset.viewMode).toBe('ISS_INSPECTION');
  expect(node.querySelector('.crew-workspace-host')?.hasAttribute('inert')).toBe(false);
  await mode('EXITING_INSPECTION'); expect(node.querySelector('.crew-workspace')).toBe(surface);
  await mode('EARTH_OVERVIEW'); expect(node.querySelector('.crew-workspace')).toBe(surface); expect(shown()).toBe(time);
  expect(scene.mounts).toBe(1); expect(scene.props.inspectionRequest).toBe(1);
});
it('Module Selected → Crew clears the authoritative selection before Earth return and stays cleared on re-entry', async () => {
  await enter(); await act(async () => scene.props.onModuleSelection(ISS_MODEL.semanticMappings[0])); await click('Crew');
  expect(scene.props.moduleSelection).toBeNull(); expect(node.querySelector('.module-dock')?.hasAttribute('inert')).toBe(true);
  expect(node.querySelector('.crew-workspace')).not.toBeNull();
  await mode('EXITING_INSPECTION'); await mode('EARTH_OVERVIEW'); await click('Close crew panel');
  await act(async () => vi.advanceTimersByTimeAsync(240)); await enter();
  expect(scene.props.moduleSelection).toBeNull(); expect(node.querySelector('.inspection-selection strong')?.textContent).toBe('None');
});
it('Crew can interrupt approach through the same return bridge', async () => {
  await click('ISS Inspection'); await mode('ENTERING_INSPECTION'); await click('Crew');
  expect(scene.props.overviewRequest).toBe(1); expect(node.querySelector('.crew-workspace')).not.toBeNull();
  await mode('EXITING_INSPECTION'); await mode('EARTH_OVERVIEW');
  expect(node.querySelectorAll('.crew-panel')).toHaveLength(1); expect(scene.props.inspectionRequest).toBe(1);
});
it('Crew requested during an existing exit does not issue another return', async () => {
  await enter(); await click('Earth'); await mode('EXITING_INSPECTION'); await click('Crew');
  expect(scene.props.overviewRequest).toBe(1); expect(node.querySelector('.crew-workspace')).not.toBeNull();
  await mode('EARTH_OVERVIEW'); expect(node.querySelector('.crew-workspace')).not.toBeNull();
});
it.each(['Crew', 'Escape', 'Close crew panel'])('closes Crew during exit using %s without restarting or reopening after the renderer flight', async action => {
  await enter(); await click('Crew'); await mode('EXITING_INSPECTION');
  if (action !== 'Escape') await click(action);
  else await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true,cancelable:true})));
  expect(node.querySelector('.crew-workspace-host')?.hasAttribute('inert')).toBe(true);
  await act(async () => vi.advanceTimersByTimeAsync(240));
  expect(node.querySelector('.crew-panel')).toBeNull();
  await mode('EARTH_OVERVIEW'); expect(node.querySelector('.crew-panel')).toBeNull(); expect(scene.props.overviewRequest).toBe(1);
});
it('rapid Crew close/reopen cancels stale presence and focus restoration', async () => {
  await click('Crew'); await click('Close crew panel'); await click('Crew');
  await act(async () => vi.advanceTimersByTimeAsync(300));
  expect(node.querySelectorAll('.crew-panel')).toHaveLength(1); expect(node.querySelector('.crew-workspace-host')?.hasAttribute('inert')).toBe(false);
  expect(document.activeElement?.id).toBe('crew-title'); expect(scene.mounts).toBe(1);
});
it.each([false, true])('keeps selected astronaut, profile DOM, disclosure and scroll through background exit completion (historical=%s)', async historical => {
  if (historical) await click('Historical');
  await enter(); await click('Crew'); await mode('EXITING_INSPECTION');
  const roster = node.querySelector<HTMLElement>('.crew-panel-content')!;
  roster.scrollTop = 140;
  const row = node.querySelector<HTMLButtonElement>(`[data-member-id="${personFixture().id}"]`)!;
  expect(row.disabled).toBe(false); await act(async () => row.click());
  const detail = node.querySelector<HTMLElement>('.crew-detail-surface')!;
  const profile = detail.querySelector<HTMLElement>('.astronaut-profile-body,.crew-historical-profile-body')!;
  profile.scrollTop = 120;
  const evidence = [...detail.querySelectorAll('details')].find(d => d.querySelector('summary')?.textContent === 'Profile source & presence evidence')!;
  await act(async () => evidence.querySelector('summary')!.click()); expect(evidence.open).toBe(true);
  await mode('EARTH_OVERVIEW');
  expect(node.querySelector('.crew-detail-surface')).toBe(detail); expect(detail.querySelector('.astronaut-profile-body,.crew-historical-profile-body')).toBe(profile);
  expect(profile.scrollTop).toBe(120); expect(roster.scrollTop).toBe(140); expect(evidence.open).toBe(true);
  expect(detail.dataset.entityId).toBe(row.dataset.memberId); expect(row.getAttribute('aria-pressed')).toBe('true');
  expect(scene.props.overviewRequest).toBe(1); expect(scene.mounts).toBe(1);
});
it.each([false, true])('allows Back and Close astronaut detail while the renderer is still exiting (historical=%s)', async historical => {
  if (historical) await click('Historical');
  await enter(); await click('Crew'); await mode('EXITING_INSPECTION');
  const row = node.querySelector<HTMLButtonElement>('.crew-roster-row')!;
  for (const action of ['Back to Crew', 'Close astronaut detail']) {
    await act(async () => row.click()); await click(action);
    await act(async () => vi.advanceTimersByTimeAsync(240));
    expect(node.querySelector('.crew-detail-surface')).toBeNull(); expect(document.activeElement).toBe(row);
    expect(node.querySelector('main')?.dataset.viewMode).toBe('EXITING_INSPECTION');
    expect(node.querySelector('.crew-workspace-host')?.hasAttribute('inert')).toBe(false);
  }
  await mode('EARTH_OVERVIEW'); expect(node.querySelector('.crew-detail-surface')).toBeNull();
});
it('reopens Crew during the same exit without another camera request or stale close focus', async () => {
  await enter(); await click('Crew'); await mode('EXITING_INSPECTION');
  await click('Close crew panel'); await click('Crew');
  await act(async () => vi.advanceTimersByTimeAsync(300));
  expect(scene.props.overviewRequest).toBe(1); expect(document.activeElement?.id).toBe('crew-title');
  const roster = node.querySelector('.crew-workspace'); await mode('EARTH_OVERVIEW');
  expect(node.querySelector('.crew-workspace')).toBe(roster);
});
it('retains functional roster and profile Retry while the background renderer is exiting', async () => {
  scene.crewError = 'TEST ONLY failed Crew refresh'; scene.profileError = 'TEST ONLY failed profile refresh';
  await enter(); await click('Crew'); await mode('EXITING_INSPECTION');
  await click('Retry crew'); expect(scene.retryCrew).toHaveBeenCalledOnce();
  await act(async () => node.querySelector<HTMLButtonElement>('.crew-roster-row')!.click());
  await click('Retry profile'); expect(scene.retryProfile).toHaveBeenCalledOnce();
  expect(node.querySelector('main')?.dataset.viewMode).toBe('EXITING_INSPECTION');
});
it('base Crew Escape works from the exposed scene and restores the stable trigger', async () => {
  await click('Crew'); const canvas = node.querySelector('canvas')!; canvas.focus();
  await act(async () => canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));
  await act(async () => vi.advanceTimersByTimeAsync(240)); expect(node.querySelector('.crew-panel')).toBeNull();
  expect(document.activeElement?.id).toBe('crew-launcher');
});
it('Historical Crew shares the S9 workspace and preserves accepted temporal/source context', async () => {
  await click('Historical'); const time = shown(), state = scene.props.replay.state, at = scene.props.replay.atMs, context = node.querySelector('.top-context-bar');
  await click('Crew'); expect(node.querySelector('#replay-crew-title')?.textContent).toContain('ISS Crew history');
  expect(node.querySelectorAll('.crew-workspace.crew-historical')).toHaveLength(1); expect(node.querySelector('.top-context-bar')).toBe(context);
  expect(scene.props.replay.state).toBe(state); expect(scene.props.replay.atMs).toBe(at); expect(shown()).toBe(time);
  await click('Close crew panel'); expect(node.querySelector('.historical-time-bar')).not.toBeNull(); expect(shown()).toBe(time);
});
it('native ISS entry closes the active Crew workspace without replacing the existing camera bridge', async () => {
  await click('Crew'); await mode('ENTERING_INSPECTION');
  expect(node.querySelector('main')?.classList.contains('has-crew-panel')).toBe(false);
  expect(node.querySelector('.crew-workspace-host')?.hasAttribute('inert')).toBe(true);
  expect(node.querySelector('.inspection-strip')).not.toBeNull();
  expect(scene.props.inspectionRequest).toBe(0); expect(scene.props.overviewRequest).toBe(0);
  await act(async () => vi.advanceTimersByTimeAsync(240)); expect(node.querySelector('.crew-panel')).toBeNull();
  expect(scene.mounts).toBe(1);
});

it('Current astronaut selection is cleared before Historical and cannot reappear as historical presence', async () => {
  await click('Crew'); await act(async () => node.querySelector<HTMLButtonElement>('.crew-roster-row')!.click());
  expect(node.querySelector('.astronaut-dock')).not.toBeNull(); const canvas = node.querySelector('canvas');
  await click('Historical'); expect(node.querySelector('.astronaut-dock')).toBeNull(); expect(node.querySelector('#replay-crew-title')).not.toBeNull();
  await click('Current'); expect(node.querySelector('.crew-workspace')).not.toBeNull(); expect(node.querySelector('.astronaut-dock')).toBeNull();
  expect(node.querySelector('.crew-current-layout')?.getAttribute('data-selected-member-id')).toBeNull(); expect(node.querySelector('canvas')).toBe(canvas); expect(scene.mounts).toBe(1);
});

it('astronaut open/switch/close preserves exact scene props, source, epoch and Viewer mount', async () => {
  await click('Crew'); const at = shown(), orbital = scene.props.window, canvas = node.querySelector('canvas'), overview = scene.props.overviewRequest;
  const rows = [...node.querySelectorAll<HTMLButtonElement>('.crew-roster-row')]; await act(async () => rows[0].click()); await act(async () => rows[1].click()); await click('Close astronaut detail');
  expect(shown()).toBe(at); expect(scene.props.window).toBe(orbital); expect(scene.props.overviewRequest).toBe(overview); expect(scene.props.selectedSource).toBe('PRIMARY_GP_TLE');
  expect(scene.props.replay).toBeNull(); expect(node.querySelector('canvas')).toBe(canvas); expect(scene.mounts).toBe(1); expect(scene.unmounts).toBe(0); expect(node.querySelector('.crew-workspace')).not.toBeNull();
});
