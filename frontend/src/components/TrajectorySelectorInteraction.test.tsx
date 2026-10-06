// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TrajectorySelector } from './TrajectorySelector';
import { TrajectoryLegend } from './TrajectoryLegend';
import type { TrajectorySource } from '../cesium/trajectorySelection';
import type { ViewMode } from '../cesium/inspectionMode';

let container: HTMLDivElement, root: Root;
let reduced = false;
let listeners: Set<() => void>;
let running: { cancel: ReturnType<typeof vi.fn>; playState: string }[];
const onSelect = vi.fn(), animate = vi.fn();

beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  reduced = false; listeners = new Set(); running = []; onSelect.mockClear(); animate.mockReset();
  const media = { get matches() { return reduced; }, addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn) };
  vi.stubGlobal('matchMedia', () => media);
  animate.mockImplementation(() => {
    const animation = { playState: 'running', cancel: vi.fn(() => { animation.playState = 'idle'; }) };
    running.push(animation); return animation;
  });
  vi.stubGlobal('getComputedStyle', () => ({ opacity: '.4', getPropertyValue: (name: string) =>
    name === '--motion-dock' ? '240ms' : name === '--ease-state' ? 'cubic-bezier(0.42,0,0.58,1)' : '' }));
  Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove();
  vi.restoreAllMocks(); vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLElement.prototype, 'animate');
  expect(listeners.size).toBe(0);
});
async function render(source: TrajectorySource = 'PRIMARY_GP_TLE', reason: string | null = null,
  mode: ViewMode = 'EARTH_OVERVIEW', notice: string | null = null) {
  await act(async () => root.render(<>
    <TrajectorySelector presentation="context" selectedSource={source} viewMode={mode}
      oemReason={reason} sourceNotice={notice} onSelect={onSelect} />
    <TrajectoryLegend selectedSource={source} oemReason={reason} />
  </>));
}
async function select(value: string) {
  const input = container.querySelector('select')!;
  await act(async () => { input.value = value; input.dispatchEvent(new Event('change', { bubbles: true })); });
}

describe('native source selection and one-shot presentation emphasis', () => {
  it('changes GP/TLE → OEM → GP/TLE through the controlled source callback', async () => {
    await render(); await select('NASA_OEM'); expect(onSelect).toHaveBeenLastCalledWith('NASA_OEM');
    await render('NASA_OEM');
    expect(container.querySelector('select')?.value).toBe('NASA_OEM');
    expect(container.querySelector('.context-source-value')?.textContent).toBe('NASA OEM');
    await select('PRIMARY_GP_TLE'); expect(onSelect).toHaveBeenLastCalledWith('PRIMARY_GP_TLE');
    await render(); expect(container.querySelector('select')?.value).toBe('PRIMARY_GP_TLE');
  });
  it('disables an unusable OEM option and blocks a programmatic change too', async () => {
    await render('PRIMARY_GP_TLE', 'OEM does not cover scene time');
    expect(container.querySelector<HTMLOptionElement>('option[value="NASA_OEM"]')?.disabled).toBe(true);
    await select('NASA_OEM'); expect(onSelect).not.toHaveBeenCalled();
    expect(container.textContent).toContain('OEM unavailable · OEM does not cover scene time');
  });
  it.each(['ENTERING_INSPECTION', 'ISS_INSPECTION', 'EXITING_INSPECTION'] as const)('locks the native source selector in %s', async mode => {
    await render('NASA_OEM', null, mode);
    expect(container.querySelector('select')?.disabled).toBe(true);
    await select('PRIMARY_GP_TLE'); expect(onSelect).not.toHaveBeenCalled();
  });
  it('shows only the active labeled legend for either selection and unavailability', async () => {
    for (const source of ['PRIMARY_GP_TLE', 'NASA_OEM'] as const) {
      for (const reason of [null, 'OEM display buffer expired']) {
        await render(source, reason);
        const legend = container.querySelector('.trajectory-legend')!;
        expect(legend.textContent).toBe(source === 'NASA_OEM' ? 'NASA OEM' : 'GP/TLE');
        expect(legend.querySelectorAll('.trajectory-swatch')).toHaveLength(1);
        expect(legend.querySelector('i')?.classList.contains(source === 'NASA_OEM' ? 'oem' : 'gp')).toBe(true);
        if (reason && source === 'NASA_OEM') expect(legend.querySelector('span')?.getAttribute('title')).toContain(reason);
      }
    }
  });
  it('emphasizes only the label once per actual switch, never on initial mount or a normal rerender', async () => {
    await render(); expect(animate).not.toHaveBeenCalled();
    await render('NASA_OEM');
    expect(animate).toHaveBeenCalledWith({ opacity: [0, 1] }, { duration: 240, easing: 'cubic-bezier(0.42,0,0.58,1)' });
    await render('NASA_OEM'); expect(animate).toHaveBeenCalledTimes(1);
    running[0].playState = 'finished';
    await render(); expect(animate).toHaveBeenCalledTimes(2);
    expect(animate.mock.calls[1][0]).toEqual({ opacity: [0, 1] });
  });
  it('cancels an interrupted switch and continues from its visual opacity without queuing', async () => {
    await render(); await render('NASA_OEM'); const first = running[0];
    await render(); expect(first.cancel).toHaveBeenCalledOnce();
    expect(animate.mock.calls[1][0]).toEqual({ opacity: [.4, 1] });
  });
  it('does not delay fallback or failure reporting with source animation', async () => {
    await render(); await render('NASA_OEM'); const first = running[0];
    await render('PRIMARY_GP_TLE', 'OEM display buffer expired', 'EARTH_OVERVIEW', 'OEM display buffer expired');
    expect(first.cancel).toHaveBeenCalledOnce(); expect(animate).toHaveBeenCalledTimes(1);
    expect(container.querySelector('select')?.value).toBe('PRIMARY_GP_TLE');
    expect(container.querySelector('[role="status"]')?.textContent).toContain('expired');
  });
  it('makes source changes immediate under reduced motion and still invokes source selection', async () => {
    reduced = true; await render(); await select('NASA_OEM'); await render('NASA_OEM');
    expect(onSelect).toHaveBeenCalledWith('NASA_OEM'); expect(animate).not.toHaveBeenCalled();
    expect(container.querySelector('.trajectory-legend')?.textContent).toBe('NASA OEM');
  });
  it('cancels active emphasis when the system changes to reduced motion', async () => {
    await render(); await render('NASA_OEM'); const first = running[0];
    reduced = true; await act(async () => listeners.forEach(listener => listener()));
    expect(first.cancel).toHaveBeenCalledOnce(); expect(animate).toHaveBeenCalledTimes(1);
  });
});
