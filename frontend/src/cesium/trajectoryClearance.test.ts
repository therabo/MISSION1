import { describe, expect, it } from 'vitest';
import { Cartesian3, JulianDate } from 'cesium';
import { makeSampledPosition } from './sampleProperty';
import { clearanceSearchDue, convexFootprint, desiredGapCssPixels, earliestClearTime, footprintDistance } from './trajectoryClearance';

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
  it('skips an upstream fragment already clear of the lifted displayed hull', () => {
    // Synthetic TEST projection: displayed station at x=0, real source at x=-80.
    // Old radial-distance search accepted t=1ms, revealing both sides of the ISS.
    for (const rate of [1, 1.1]) {
      const pixelAt = (ms: number) => ({ x: -80 + rate * ms / 1000, y: 0 });
      const start = earliestClearTime(1, 120_000, [0, 30_000, 60_000, 90_000, 120_000], pixelAt, hull, 1.25)!;
      expect(start).toBeGreaterThan(80_000 / rate);
      expect(pixelAt(start).x).toBeGreaterThanOrEqual(11.25);
      expect(footprintDistance(pixelAt(start), hull)).toBeGreaterThanOrEqual(1.25);
      expect(start - 91_250 / rate).toBeLessThanOrEqual(1);
    }
  });
  it('uses the actual projected future direction for rotated and lifted poses', () => {
    for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 3]) {
      const dx = Math.cos(angle), dy = Math.sin(angle);
      const support = Math.max(...hull.map(p => p.x * dx + p.y * dy));
      const scratch = { x: 0, y: 0 };
      const pixelAt = (ms: number) => { scratch.x = dx * (-80 + ms / 1000); scratch.y = dy * (-80 + ms / 1000); return scratch; };
      const start = earliestClearTime(1, 120_000, [0, 30_000, 60_000, 90_000, 120_000], pixelAt, hull, 2)!;
      const point = pixelAt(start);
      expect(point.x * dx + point.y * dy).toBeGreaterThanOrEqual(support + 2 - 1e-9);
      expect(footprintDistance(point, hull)).toBeGreaterThanOrEqual(2 - 1e-9);
    }
  });
  it('does not render a stale start during reveal or partial Back at any checkpoint', () => {
    for (const mode of ['ENTERING_INSPECTION', 'EXITING_INSPECTION'] as const)
      for (const checkpoint of [0.1, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95]) {
        expect(clearanceSearchDue(mode, checkpoint, false)).toBe(true);
        const shifted = hull.map(p => ({ x: p.x + checkpoint * 80, y: p.y }));
        const start = earliestClearTime(1, 120_000, [0, 30_000, 60_000, 90_000, 120_000], ms => ({ x: ms / 1000, y: 0 }), shifted, 1)!;
        expect(start / 1000).toBeGreaterThanOrEqual(checkpoint * 80 + 11);
      }
    expect(clearanceSearchDue('EARTH_OVERVIEW', 99, false)).toBe(false);
    expect(clearanceSearchDue('EARTH_OVERVIEW', 100, false)).toBe(true);
    expect(clearanceSearchDue('EARTH_OVERVIEW', 0, true)).toBe(true);
  });
  it('hides a downstream start without covered projected motion', () => {
    expect(earliestClearTime(1, 60_000, [0, 30_000], () => ({ x: 50, y: 0 }), hull, 1)).toBeNull();
    expect(earliestClearTime(1, 60_000, [0, 30_000], ms => ({ x: -80 + ms / 1000, y: 0 }), hull, 1)).toBeNull();
  });
});
