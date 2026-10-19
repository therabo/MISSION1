// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { InspectionStrip } from './InspectionStrip';
import { parseOrbitalWindow } from '../orbital/sampleMapping';
import { orbitalPayload } from '../test/orbitalFixture';

const window = parseOrbitalWindow(orbitalPayload(), 0);
const position = { source: 'PRIMARY_GP_TLE' as const, timeMs: window.generatedMs, ...window.response.currentGeodetic };
const positionProps = { position, selectedSource: position.source, sceneTimeMs: position.timeMs, buffer: 'active' as const };

it('reserves Over as literal informational content with no lookup or scheduled work', async () => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  vi.useFakeTimers();
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  try {
    for (const viewMode of ['ENTERING_INSPECTION', 'ISS_INSPECTION', 'EXITING_INSPECTION'] as const) {
      await act(async () => root.render(<InspectionStrip viewMode={viewMode} {...positionProps} />));
      const over = host.querySelector('.inspection-over')!;
      expect(over.textContent).toBe('Over—');
      expect(over.querySelector('span')?.textContent).toBe('Over');
      expect(over.querySelector('strong')?.textContent).toBe('—');
      expect(over.matches('button,a,[tabindex],[role],[title],[aria-busy]')).toBe(false);
      expect(over.querySelector('button,a,[tabindex],[role],[title],[aria-busy],progress')).toBeNull();
      expect(host.textContent).not.toContain('Selected module');
      expect(host.querySelector('button,.inspection-modules-cell,.inspection-modules')).toBeNull();
      expect(host.querySelector('summary,details,[aria-controls],[aria-expanded],[tabindex]')).toBeNull();
      expect(host.textContent).not.toMatch(/Orbital detail|NASA VTAD|Reference geometry/);
      expect([...host.querySelectorAll('dt')].map(e => e.textContent)).toEqual(['Latitude', 'Longitude', 'Altitude']);
      expect([...host.querySelectorAll('dd')].map(e => e.textContent)).toEqual(['4.691° N', '92.065° E', '416.4 km']);
    }
    await act(async () => vi.advanceTimersByTimeAsync(180_000));
    expect(fetch).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
    expect(host.querySelector('.inspection-over')?.textContent).toBe('Over—');
  } finally {
    await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals();
  }
});

it('uses the existing physical sample guard across source switches, missing data and buffer expiry', async () => {
  const host = document.createElement('div'); const root = createRoot(host);
  const values = () => [...host.querySelectorAll('dd')].map(e => e.textContent);
  try {
    for (const selectedSource of ['PRIMARY_GP_TLE', 'NASA_OEM', 'PRIMARY_GP_TLE'] as const) {
      await act(async () => root.render(<InspectionStrip viewMode="ISS_INSPECTION" {...positionProps} selectedSource={selectedSource} />));
      expect(values()).toEqual(selectedSource === position.source ? ['4.691° N', '92.065° E', '416.4 km'] : Array(3).fill('Unavailable'));
    }
    for (const overrides of [{ position: null }, { buffer: 'expired' as const }, { sceneTimeMs: position.timeMs + 1000 }]) {
      await act(async () => root.render(<InspectionStrip viewMode="ISS_INSPECTION" {...positionProps} {...overrides} />));
      expect(values()).toEqual(Array(3).fill('Unavailable'));
    }
    expect(host.querySelector('button,a,input,select,summary,[tabindex],[role="button"]')).toBeNull();
  } finally { await act(async () => root.unmount()); }
});
