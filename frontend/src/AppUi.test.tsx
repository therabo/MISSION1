// @vitest-environment jsdom
import { act, useEffect } from 'react';
// Geographic loading is isolated here; real-catalog integration is covered in OverCountryIntegration.test.tsx.
vi.mock('./geo/countryCatalog', () => ({ loadCountryCatalog: () => new Promise(() => {}) }));
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseOrbitalWindow } from './orbital/sampleMapping';
import { orbitalPayload } from './test/orbitalFixture';
import { parseComparison } from './orbital/comparison';
import { fixture } from './test/comparisonFixture';
import type { PositionSnapshot } from './cesium/trajectorySelection';
import type { ViewMode } from './cesium/inspectionMode';
import App from './App';

const harness = vi.hoisted(() => ({
  mounts: 0, unmounts: 0, props: {} as Record<string, unknown>,
  zoomIn: vi.fn(), zoomOut: vi.fn(), resetView: vi.fn(),
  orbital: vi.fn(), comparison: vi.fn(), replay: vi.fn(),
}));
vi.mock('./api/useOrbitalDelivery', () => ({ useOrbitalDelivery: (...args: unknown[]) => harness.orbital(...args) }));
vi.mock('./api/useComparisonDelivery', () => ({ useComparisonDelivery: (...args: unknown[]) => harness.comparison(...args) }));
vi.mock('./replay/useMissionReplay', () => ({ useMissionReplay: (...args: unknown[]) => harness.replay(...args) }));
vi.mock('./crew/CurrentCrewPanel', () => ({ CurrentCrewPanelView: ({ onClose }: { onClose: () => void }) => <button onClick={onClose}>Close Crew</button> }));
vi.mock('./layout/useEarthWorkspace', () => ({ useEarthWorkspace: () => null }));
vi.mock('./cesium/EarthView', () => ({ EarthView: (props: {
  onControlsReady: (controls: unknown) => void; onSceneTime: (time: number) => void;
  onPosition: (position: PositionSnapshot) => void; onModelStatus: (status: string) => void;
  onViewModeChange: (mode: ViewMode) => void;
}) => {
  harness.props = props as unknown as Record<string, unknown>;
  useEffect(() => {
    harness.mounts++;
    const orbital = parseOrbitalWindow(orbitalPayload(), 0);
    props.onSceneTime(orbital.generatedMs);
    props.onPosition({ source: 'PRIMARY_GP_TLE', timeMs: orbital.generatedMs, ...orbital.response.currentGeodetic });
    props.onModelStatus('ready');
    props.onControlsReady({ zoomIn: harness.zoomIn, zoomOut: harness.zoomOut, resetView: harness.resetView });
    return () => { harness.unmounts++; props.onControlsReady(null); };
  }, []);
  return <div className="test-stable-viewer" />;
} }));

let root: Root, container: HTMLDivElement;
beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  harness.mounts = 0; harness.unmounts = 0; harness.zoomIn.mockClear(); harness.zoomOut.mockClear(); harness.resetView.mockClear();
  harness.orbital.mockReturnValue({ window: parseOrbitalWindow(orbitalPayload(), 0), status: 'ready', message: null });
  harness.comparison.mockReturnValue({ response: null, status: 'loading' });
  harness.replay.mockReturnValue({ data: null, loading: false, error: null, coverage: null });
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); vi.clearAllMocks();
});
async function click(name: string) {
  const button = [...container.querySelectorAll('button')].find(el => el.getAttribute('aria-label') === name || el.textContent === name);
  expect(button, name).toBeDefined(); await act(async () => button!.click());
}

function availableComparison() {
  // Synthetic TEST source fixture; align coverage to the recorded App test clock.
  const comparison = parseComparison(fixture(true));
  const delta = Date.parse(orbitalPayload().generatedAt as string) - Date.parse(comparison.generatedAt);
  const shift = (date: string) => new Date(Date.parse(date) + delta).toISOString();
  comparison.generatedAt = shift(comparison.generatedAt);
  comparison.oem.source!.startTime = shift(comparison.oem.source!.startTime);
  comparison.oem.source!.stopTime = shift(comparison.oem.source!.stopTime);
  comparison.oem.samples.forEach(sample => { sample.time = shift(sample.time); });
  return comparison;
}
async function choose(source: 'PRIMARY_GP_TLE' | 'NASA_OEM') {
  const select = container.querySelector('select')!;
  await act(async () => { select.value = source; select.dispatchEvent(new Event('change', { bubbles: true })); });
}

describe('App presentation wiring without a WebGL test double for domain state', () => {
  it('renders physical values and Cesium UTC, and sends scene controls to the stable existing bridge', async () => {
    await act(async () => root.render(<App />));
    expect(container.textContent).toContain('4.691° N'); expect(container.textContent).toContain('416.4 km');
    expect(container.querySelector('.context-date time')?.textContent).toBe('2026-09-28 15:00:00 UTC');
    await click('Zoom out'); await click('Zoom in'); await click('Reset view');
    expect(harness.zoomOut).toHaveBeenCalledOnce(); expect(harness.zoomIn).toHaveBeenCalledOnce(); expect(harness.resetView).toHaveBeenCalledOnce();
    expect(harness.mounts).toBe(1); expect(harness.unmounts).toBe(0);
  });
  it('keeps source, hook enablement and Viewer lifetime through shared bar and existing Crew presentation updates', async () => {
    await act(async () => root.render(<App />));
    const originalWindow = harness.props.window;
    expect(container.querySelector('.source-state-slot summary')).toBeNull();
    await click('Crew');
    expect(container.querySelector('.position-status-bar')).not.toBeNull();
    expect(container.querySelector('main')?.classList.contains('has-crew-panel')).toBe(true);
    expect(container.querySelectorAll('.top-context-bar')).toHaveLength(1);
    expect(container.querySelector('.crew-workspace-host')).not.toBeNull();
    expect(container.textContent).toContain('Close Crew');
    await click('Close Crew');
    expect(container.querySelector('.position-status-bar')).not.toBeNull();
    expect(harness.props.window).toBe(originalWindow);
    expect(harness.props.selectedSource).toBe('PRIMARY_GP_TLE'); expect(harness.props.replay).toBeNull();
    expect(harness.orbital.mock.calls.every(([enabled]) => enabled === true)).toBe(true);
    expect(harness.comparison.mock.calls.every(([, enabled]) => enabled === true)).toBe(true);
    expect(harness.mounts).toBe(1); expect(harness.unmounts).toBe(0);
  });
  it.each(['PRIMARY_GP_TLE', 'NASA_OEM'] as const)('presents Current %s physical fields with the accepted formatter in Inspection', async source => {
    harness.comparison.mockReturnValue({ response: availableComparison(), status: 'ready' });
    await act(async () => root.render(<App />));
    if (source === 'NASA_OEM') await choose(source);
    const physical = { source, timeMs: Date.parse(orbitalPayload().generatedAt as string), ...parseOrbitalWindow(orbitalPayload(), 0).response.currentGeodetic };
    await act(async () => {
      (harness.props.onPosition as (p: PositionSnapshot) => void)(physical);
      (harness.props.onViewModeChange as (m: ViewMode) => void)('ISS_INSPECTION');
    });
    const strip = container.querySelector('.position-status-bar')!;
    const rows = Object.fromEntries([...strip.querySelectorAll('.summary-position > div')].map(e => [e.querySelector('dt')!.textContent, e.querySelector('dd')!.textContent]));
    expect(rows).toEqual({ Latitude: '4.691° N', Longitude: '92.065° E', Altitude: '416.4 km' });
    expect(container.querySelector('#orbital-status-evidence')).toBeNull();
    expect(strip.querySelector('button,a,summary,[tabindex]')).toBeNull();
    expect(harness.props.selectedSource).toBe(source); expect(harness.mounts).toBe(1);
  });
  it('does not reuse a previous source sample when switching GP → OEM → GP before Inspection', async () => {
    harness.comparison.mockReturnValue({ response: availableComparison(), status: 'ready' });
    await act(async () => root.render(<App />));
    const values = () => [...container.querySelectorAll('.position-status-bar .summary-position dd')].map(e => e.textContent);
    const current = parseOrbitalWindow(orbitalPayload(), 0);
    for (const source of ['NASA_OEM', 'PRIMARY_GP_TLE'] as const) {
      await choose(source);
      await act(async () => (harness.props.onViewModeChange as (m: ViewMode) => void)('ISS_INSPECTION'));
      expect(values()).toEqual(Array(3).fill('Unavailable'));
      await act(async () => (harness.props.onPosition as (p: PositionSnapshot) => void)({ source, timeMs: current.generatedMs, ...current.response.currentGeodetic }));
      expect(values()).toEqual(['4.691° N', '92.065° E', '416.4 km']);
      await act(async () => (harness.props.onViewModeChange as (m: ViewMode) => void)('EARTH_OVERVIEW'));
    }
  });
  it('cannot select unavailable OEM, and keeps accepted source guards when Inspection starts', async () => {
    await act(async () => root.render(<App />));
    const select = container.querySelector('select')!;
    expect(select.querySelector('option[value="NASA_OEM"]')?.hasAttribute('disabled')).toBe(true);
    await act(async () => { select.value = 'NASA_OEM'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(harness.props.selectedSource).toBe('PRIMARY_GP_TLE');
    await click('ISS Inspection'); expect(harness.props.inspectionRequest).toBe(1);
    await act(async () => (harness.props.onViewModeChange as (mode: ViewMode) => void)('ENTERING_INSPECTION'));
    expect(container.querySelector<HTMLSelectElement>('select[aria-label="Orbital source"]')?.disabled).toBe(true);
    expect(container.querySelector('select[aria-label="Orbital source"]')?.getAttribute('aria-describedby')).toBeTruthy();
    expect(harness.mounts).toBe(1); expect(harness.unmounts).toBe(0);
  });
  it('uses the existing source selection and the shared Earth shell for the approved OEM state', async () => {
    const comparison = availableComparison();
    harness.comparison.mockReturnValue({ response: comparison, status: 'ready' });
    await act(async () => root.render(<App />));
    const select = container.querySelector('select')!;
    await act(async () => { select.value = 'NASA_OEM'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(harness.props.selectedSource).toBe('NASA_OEM');
    expect(container.querySelector('.status-panel')).toBeNull();
    expect(container.querySelector('.source-state-slot,#orbital-status-evidence')).toBeNull();
    expect(container.querySelector('.position-status-bar')?.textContent).not.toContain('General Perturbations quality');
    expect(harness.mounts).toBe(1); expect(harness.unmounts).toBe(0);
  });
});

describe('Orbital source guards and persistent application context', () => {
  it('switches both ways without remounting the Viewer, resetting camera controls, UTC or unrelated replay state', async () => {
    harness.comparison.mockReturnValue({ response: availableComparison(), status: 'ready' });
    await act(async () => root.render(<App />));
    const originalWindow = harness.props.window;
    const originalUtc = container.querySelector('.context-date time')?.textContent;
    const replayAt = harness.replay.mock.calls.at(-1)?.[1];
    await choose('NASA_OEM');
    expect(harness.props.selectedSource).toBe('NASA_OEM');
    expect(container.querySelectorAll('.trajectory-legend > span')).toHaveLength(1);
    expect(container.querySelectorAll('.summary-position dd')).toHaveLength(3);
    expect(container.querySelector('.summary-quality')).toBeNull();
    expect(container.querySelector('.trajectory-legend')?.textContent).toBe('NASA OEM');
    expect(container.querySelector('.position-status-bar')?.textContent).not.toContain('General Perturbations quality');
    await choose('PRIMARY_GP_TLE');
    expect(harness.props.selectedSource).toBe('PRIMARY_GP_TLE');
    expect(container.querySelector('.summary-quality')).toBeNull();
    expect(container.querySelector('.trajectory-legend')?.textContent).toBe('GP/TLE');
    expect(container.querySelector('.context-date time')?.textContent).toBe(originalUtc);
    expect(harness.replay.mock.calls.at(-1)?.[1]).toBe(replayAt);
    expect(harness.props.window).toBe(originalWindow);
    expect(harness.props.inspectionRequest).toBe(0); expect(harness.props.overviewRequest).toBe(0);
    expect(harness.resetView).not.toHaveBeenCalled();
    expect(harness.mounts).toBe(1); expect(harness.unmounts).toBe(0);
  });
  it.each(['unavailable', 'uncovered', 'expired', 'missing samples'] as const)('cannot select OEM with %s data under existing domain guards', async condition => {
    const response = availableComparison();
    if (condition === 'unavailable') { response.oem.availability = 'UNAVAILABLE'; response.oem.reason = 'NO_VALID_OEM_FILE'; }
    if (condition === 'uncovered') response.oem.source!.startTime = new Date(Date.parse(response.generatedAt) + 1000).toISOString();
    if (condition === 'expired') response.generatedAt = new Date(Date.parse(response.generatedAt) - 301_000).toISOString();
    if (condition === 'missing samples') response.oem.samples = [];
    harness.comparison.mockReturnValue({ response, status: 'ready' });
    await act(async () => root.render(<App />));
    expect(container.querySelector<HTMLOptionElement>('option[value="NASA_OEM"]')?.disabled).toBe(true);
    await choose('NASA_OEM');
    expect(harness.props.selectedSource).toBe('PRIMARY_GP_TLE');
    expect(container.querySelector('.summary-quality')).toBeNull();
    expect(container.querySelectorAll('.trajectory-legend > span')).toHaveLength(1);
  });
  it('uses the existing renderer fallback callback and announces its reason immediately', async () => {
    harness.comparison.mockReturnValue({ response: availableComparison(), status: 'ready' });
    await act(async () => root.render(<App />)); await choose('NASA_OEM');
    await act(async () => (harness.props.onSourceUnavailable as (reason: string) => void)('OEM does not cover scene time'));
    expect(harness.props.selectedSource).toBe('PRIMARY_GP_TLE');
    expect(container.querySelector('.earth-current-notice')?.textContent).toContain('Returned to GP/TLE');
    expect(container.querySelector('.earth-current-notice')?.textContent).toContain('OEM does not cover scene time');
    expect(container.querySelector('.summary-quality')).toBeNull();
    expect(harness.mounts).toBe(1);
  });
  it('keeps OEM selected through the shared Crew workspace and its return', async () => {
    harness.comparison.mockReturnValue({ response: availableComparison(), status: 'ready' });
    await act(async () => root.render(<App />)); await choose('NASA_OEM');
    await click('Crew'); expect(harness.props.selectedSource).toBe('NASA_OEM');
    await click('Close Crew');
    expect(container.querySelector('select')?.value).toBe('NASA_OEM');
    expect(container.querySelector('.source-state-slot,#orbital-status-evidence')).toBeNull();
    expect(harness.mounts).toBe(1); expect(harness.unmounts).toBe(0);
  });
  it('keeps the actual expired-buffer reason distinct from the renderer fallback notification', async () => {
    const response = availableComparison();
    harness.comparison.mockReturnValue({ response, status: 'ready' });
    await act(async () => root.render(<App />)); await choose('NASA_OEM');
    response.generatedAt = new Date(Date.parse(response.generatedAt) - 301_000).toISOString();
    await act(async () => (harness.props.onSourceUnavailable as (reason: string) => void)('NASA OEM became unavailable at scene time; returned to MISSION1 GP/TLE.'));
    expect(container.querySelector('.earth-current-notice')?.textContent).toContain('OEM display buffer expired');
    expect(container.querySelector('.earth-current-notice')?.textContent).toContain('Returned to GP/TLE');
    expect(container.querySelector('select')?.value).toBe('PRIMARY_GP_TLE');
  });
});
