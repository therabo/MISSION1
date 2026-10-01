import { describe, expect, it } from 'vitest';
import { trajectoryVisibilityForView as visibility, TRAJECTORY_VISIBILITY } from './trajectoryVisibility';

const modes = ['ENTERING_INSPECTION', 'EXITING_INSPECTION'] as const;
describe('range-aware trajectory transition visibility', () => {
  it('keeps stable Inspection hidden at every navigable zoom and Overview fully visible', () => {
    for (const range of [50, 90, 233.723, 2000, 1e7]) {
      expect(visibility('ISS_INSPECTION', range)).toBe(0);
      expect(visibility('EARTH_OVERVIEW', range)).toBe(1);
    }
  });
  it('keeps both directions hidden throughout close departure, including maximum Inspection zoom', () => {
    for (const mode of modes) for (const range of [50, 90, 2000, 10_000, TRAJECTORY_VISIBILITY.hiddenRangeMeters])
      expect(visibility(mode, range)).toBe(0);
  });
  it('reveals monotonically within bounds and fades with the same curve on approach', () => {
    const ranges = Array.from({ length: 1001 }, (_, i) => 100_000 * 100 ** (i / 1000));
    const exit = ranges.map(r => visibility('EXITING_INSPECTION', r));
    const entry = [...ranges].reverse().map(r => visibility('ENTERING_INSPECTION', r));
    expect(exit[0]).toBe(0); expect(exit.at(-1)).toBe(1);
    expect(exit.every((v, i) => v >= 0 && v <= 1 && (i === 0 || v >= exit[i - 1]))).toBe(true);
    expect(entry).toEqual([...exit].reverse());
    expect(visibility('EXITING_INSPECTION', 1_000_000)).toBeCloseTo(0.5);
  });
  it('has vanishing first/second boundary derivatives without a hard alpha step', () => {
    for (const mode of modes) {
      const at = (x: number) => visibility(mode, 100_000 * 100 ** x), h = 1e-4;
      expect(at(h) / h).toBeLessThan(1e-6);
      expect((1 - at(1 - h)) / h).toBeLessThan(1e-6);
      expect((at(2*h) - 2*at(h)) / (h*h)).toBeLessThan(0.01);
      expect(Math.abs((at(1 - 2*h) - 2*at(1 - h) + 1) / (h*h))).toBeLessThan(0.01);
    }
  });
  it('reverses continuously at arbitrary actual ranges rather than resetting an opacity timer', () => {
    for (const range of [98.888, 123.092, 195, 425.35, 6534.49, 300_000, 2_734_813.68, 13_000_000]) {
      expect(visibility('ENTERING_INSPECTION', range)).toBe(visibility('EXITING_INSPECTION', range));
      expect(Math.abs(visibility('EXITING_INSPECTION', range * (1 + 1e-8)) - visibility('ENTERING_INSPECTION', range))).toBeLessThan(1e-8);
    }
  });
  it('caps the far edge at the captured regional Earth range and keeps a 2km departure hidden', () => {
    for (const overviewRange of [4000, 50_000, 1_600_000, 16_500_000]) for (const mode of modes) {
      expect(visibility(mode, overviewRange, overviewRange)).toBe(1);
      expect(visibility(mode, 2000, overviewRange)).toBe(0);
    }
  });
  it('fails closed for undefined/nonfinite transition range and reaches normal far opacity', () => {
    for (const mode of modes) {
      for (const r of [NaN, Infinity, -1, 0]) expect(visibility(mode, r)).toBe(0);
      expect(visibility(mode, 20_000_000)).toBe(1);
    }
  });
});
