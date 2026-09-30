import { describe, expect, it } from 'vitest';
import { Cartesian3, JulianDate } from 'cesium';
import { makeSampledPosition } from './sampleProperty';
import { convexFootprint, desiredGapCssPixels, earliestClearTime, footprintDistance } from './trajectoryClearance';

const hull = convexFootprint([{ x: -10, y: -10 }, { x: 10, y: -10 }, { x: 10, y: 10 }, { x: -10, y: 10 }]);
describe('screen-space source-specific trajectory clearance', () => {
  it('smoothly decreases with selected ISS range, within bounds', () => {
    const far = desiredGapCssPixels(17_000_000), medium = desiredGapCssPixels(6_000_000), close = desiredGapCssPixels(1_500_000);
    expect(far).toBeGreaterThan(medium); expect(medium).toBeGreaterThan(close); expect(close).toBeGreaterThan(0);
    const gaps = Array.from({ length: 101 }, (_, i) => desiredGapCssPixels(100 + i * 400_000));
    expect(gaps.every((g, i) => g >= 0.75 && g <= 4 && (i === 0 || g >= gaps[i - 1]))).toBe(true);
    expect(desiredGapCssPixels(0)).toBe(0.75);
    expect(desiredGapCssPixels(1e12)).toBe(4);
    expect(desiredGapCssPixels(2_000_001) - 0.75).toBeLessThan(1e-9);
    expect(4 - desiredGapCssPixels(16_999_999)).toBeLessThan(1e-9);
  });
  it('measures the footprint edge rather than only model center', () => {
    expect(footprintDistance({ x: 0, y: 0 }, hull)).toBe(0);
    expect(footprintDistance({ x: 13, y: 14 }, hull)).toBe(5);
    expect(footprintDistance({ x: 10, y: 10 }, hull)).toBe(0);
  });
  it('finds the genuine temporal start with sub-sample precision', () => {
    const radius = 4 + 0.5;
    const start = earliestClearTime(1, 60_000, [0, 30_000, 60_000], ms => ({ x: ms / 1000, y: 0 }), hull, radius)!;
    expect(start - (10 + radius) * 1000).toBeGreaterThanOrEqual(0);
    expect(start - (10 + radius) * 1000).toBeLessThanOrEqual(1);
    expect(start).not.toBe(30_000);
    expect(footprintDistance({ x: start / 1000, y: 0 }, hull)).toBeGreaterThanOrEqual(radius);
  });
  it('uses each bounded source property and never creates a new spatial curve', () => {
    // Synthetic TEST paths with different rates; no real ISS claim.
    const make = (rate: number) => makeSampledPosition([0, 30, 60].map(t => ({
      time: new Date(t * 1000).toISOString(), xMeters: t * rate, yMeters: 0, zMeters: 0,
    })));
    const starts = [1, 2].map(rate => {
      const property = make(rate);
      const pixelAt = (ms: number) => { const p = property.getValue(JulianDate.fromDate(new Date(ms)), new Cartesian3()); return p ? { x: p.x, y: p.y } : null; };
      const start = earliestClearTime(1, 60_000, [0, 30_000, 60_000], pixelAt, hull, 12)!;
      expect(pixelAt(start)!.x).toBeCloseTo(22, 2);
      expect(property.getValue(JulianDate.fromDate(new Date(30_000)))!.x).toBe(30 * rate);
      expect(property.getValue(JulianDate.fromDate(new Date(60_001)))).toBeUndefined();
      return start;
    });
    expect(Math.abs(starts[0] - starts[1] * 2)).toBeLessThan(2); // <=1ms search precision per source.
  });
  it('hides a trail without sufficient coverage or valid projection rather than extrapolating', () => {
    expect(earliestClearTime(1, 5000, [0, 30_000], ms => ({ x: ms / 1000, y: 0 }), hull, 12)).toBeNull();
    expect(earliestClearTime(1, 5000, [], () => null, hull, 12)).toBeNull();
    expect(earliestClearTime(5000, 5000, [], () => ({ x: 100, y: 0 }), hull, 12)).toBeNull();
  });
});
