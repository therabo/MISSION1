import { describe, it, expect } from 'vitest';
import { PerceptualPath, lensDistance, perceptualMetric, perceptualClock } from './perceptualPath';

describe('perceptual camera progress', () => {
  it('combines log range and apparent scale with exact endpoints over all ranges', () => {
    for (const far of [1000, 1e7, 1e12]) {
      const a = lensDistance(far, Math.PI / 3), b = lensDistance(90, 1.7);
      expect(perceptualMetric(a, a, b)).toBe(0);
      expect(perceptualMetric(b, a, b)).toBe(1);
      let previous = -Infinity;
      for (let i = 0; i <= 1000; i++) {
        const distance = Math.exp(Math.log(a) * (1 - i / 1000) + Math.log(b) * i / 1000);
        const q = perceptualMetric(distance, a, b);
        expect(q).toBeGreaterThanOrEqual(previous - 1e-12); previous = q;
      }
    }
  });
  it('inverts a path accurately even where the last metres occupy tiny parameters', () => {
    const range = (t: number) => 17_000_000 * (1 - t) + 90 * t;
    const metric = (t: number) => perceptualMetric(range(t), range(0), range(1));
    const path = new PerceptualPath(metric);
    let previous = 0;
    for (let i = 0; i <= 2000; i++) {
      const q = i / 2000, t = path.parameterAt(q);
      expect(t).toBeGreaterThanOrEqual(previous);
      expect(Math.abs(metric(t) - q)).toBeLessThan(0.0001); previous = t;
    }
    expect(path.parameterAt(-1)).toBe(0); expect(path.parameterAt(2)).toBe(1);
  });
  it('has continuous lookup derivatives and bounded temporal derivatives', () => {
    const path = new PerceptualPath(t => t * t);
    const epsilon = 1e-7;
    for (let i = 2; i < 1024; i += 7) {
      const q = i / 1024;
      const left = (path.parameterAt(q) - path.parameterAt(q - epsilon)) / epsilon;
      const right = (path.parameterAt(q + epsilon) - path.parameterAt(q)) / epsilon;
      expect(Math.abs(left - right)).toBeLessThan(0.001);
    }
    expect(perceptualClock(0)).toBe(0); expect(perceptualClock(1)).toBe(1);
    expect(perceptualClock(epsilon) / epsilon).toBeLessThan(1e-10);
    for (let i = 1; i <= 1000; i++) {
      const derivative = (perceptualClock(i / 1000) - perceptualClock((i - 1) / 1000)) * 1000;
      expect(derivative).toBeGreaterThanOrEqual(0); expect(derivative).toBeLessThan(1.112);
    }
  });
  it('rejects nonfinite ranges, invalid FOV and invalid lookups', () => {
    expect(() => lensDistance(0, 1)).toThrow(); expect(() => lensDistance(Infinity, 1)).toThrow();
    expect(() => lensDistance(90, Math.PI)).toThrow();
    expect(() => new PerceptualPath(() => NaN)).toThrow();
    expect(() => new PerceptualPath(t => t, 1)).toThrow();
  });
});
