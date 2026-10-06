// @vitest-environment jsdom
import { act, useEffect } from 'react';
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
vi.mock('./layout/useEarthWorkspace', () => ({ useEarthWorkspace: () => null }));
vi.mock('./crew/CrewPanel', () => ({ CrewPanel: ({ onClose }: { onClose: () => void }) => <button onClick={onClose}>Close legacy Crew</button> }));
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

describe('Phase 2 App presentation wiring without a WebGL test double for domain state', () => {
  it('renders physical values and Cesium UTC, and sends scene controls to the stable existing bridge', async () => {
    await act(async () => root.render(<App />));
    expect(container.textContent).toContain('4.691° N'); expect(container.textContent).toContain('416.4 km');
    expect(container.querySelector('.context-date time')?.textContent).toBe('2026-09-28 15:00:00 UTC');
    await click('Zoom out'); await click('Zoom in'); await click('Reset view');
    expect(harness.zoomOut).toHaveBeenCalledOnce(); expect(harness.zoomIn).toHaveBeenCalledOnce(); expect(harness.resetView).toHaveBeenCalledOnce();
    expect(harness.mounts).toBe(1); expect(harness.unmounts).toBe(0);
  });
  it('keeps source, hook enablement and Viewer lifetime through evidence and existing Crew presentation updates', async () => {
    await act(async () => root.render(<App />));
    const originalWindow = harness.props.window;
    await act(async () => container.querySelector('summary')!.click());
    await click('Crew');
    expect(container.querySelector('.operational-summary')).toBeNull();
    expect(container.textContent).toContain('Close legacy Crew');
    await click('Close legacy Crew');
    expect(container.querySelector('.operational-summary')).not.toBeNull();
    expect(harness.props.window).toBe(originalWindow);
    expect(harness.props.selectedSource).toBe('PRIMARY_GP_TLE'); expect(harness.props.replay).toBeNull();
    expect(harness.orbital.mock.calls.every(([enabled]) => enabled === true)).toBe(true);
    expect(harness.comparison.mock.calls.every(([, enabled]) => enabled === true)).toBe(true);
    expect(harness.mounts).toBe(1); expect(harness.unmounts).toBe(0);
  });
  it('cannot select unavailable OEM, and keeps accepted source guards when Inspection starts', async () => {
    await act(async () => root.render(<App />));
    const select = container.querySelector('select')!;
    expect(select.querySelector('option[value="NASA_OEM"]')?.hasAttribute('disabled')).toBe(true);
    await act(async () => { select.value = 'NASA_OEM'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(harness.props.selectedSource).toBe('PRIMARY_GP_TLE');
    await click('ISS Inspection'); expect(harness.props.inspectionRequest).toBe(1);
    await act(async () => (harness.props.onViewModeChange as (mode: ViewMode) => void)('ENTERING_INSPECTION'));
    const options = container.querySelectorAll<HTMLButtonElement>('.source-options button');
    expect([...options].every(option => option.disabled)).toBe(true);
    expect(harness.mounts).toBe(1); expect(harness.unmounts).toBe(0);
  });
  it('uses the existing source selection and preserves the legacy OEM screen, without redesigning Phase 3', async () => {
    // Source fixture is synthetic TEST data. Align its coverage to the App clock.
    const comparison = parseComparison(fixture(true));
    const delta = Date.parse(orbitalPayload().generatedAt as string) - Date.parse(comparison.generatedAt);
    const shift = (date: string) => new Date(Date.parse(date) + delta).toISOString();
    comparison.generatedAt = shift(comparison.generatedAt);
    comparison.oem.source!.startTime = shift(comparison.oem.source!.startTime);
    comparison.oem.source!.stopTime = shift(comparison.oem.source!.stopTime);
    comparison.oem.samples.forEach(sample => { sample.time = shift(sample.time); });
    harness.comparison.mockReturnValue({ response: comparison, status: 'ready' });
    await act(async () => root.render(<App />));
    const select = container.querySelector('select')!;
    await act(async () => { select.value = 'NASA_OEM'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(harness.props.selectedSource).toBe('NASA_OEM');
    expect(container.querySelector('.status-panel')).not.toBeNull();
    expect(harness.mounts).toBe(1); expect(harness.unmounts).toBe(0);
  });
});
