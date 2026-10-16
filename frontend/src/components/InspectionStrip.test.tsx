// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { InspectionStrip } from './InspectionStrip';

it('reserves Over as literal informational content with no lookup or scheduled work', async () => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  vi.useFakeTimers();
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  try {
    for (const viewMode of ['ENTERING_INSPECTION', 'ISS_INSPECTION', 'EXITING_INSPECTION'] as const) {
      // The strip only needs camera mode; it receives no position, source, time or selection.
      await act(async () => root.render(<InspectionStrip viewMode={viewMode} />));
      const over = host.querySelector('.inspection-over')!;
      expect(over.textContent).toBe('Over—');
      expect(over.querySelector('span')?.textContent).toBe('Over');
      expect(over.querySelector('strong')?.textContent).toBe('—');
      expect(over.matches('button,a,[tabindex],[role],[title],[aria-busy]')).toBe(false);
      expect(over.querySelector('button,a,[tabindex],[role],[title],[aria-busy],progress')).toBeNull();
      expect(host.textContent).not.toContain('Selected module');
      expect(host.querySelector('button,.inspection-modules-cell,.inspection-modules')).toBeNull();
      expect([...host.querySelectorAll('summary')].map(e => e.textContent)).toEqual(['Orbital detail']);
    }
    await act(async () => vi.advanceTimersByTimeAsync(180_000));
    expect(fetch).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
    expect(host.querySelector('.inspection-over')?.textContent).toBe('Over—');
  } finally {
    await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals();
  }
});
