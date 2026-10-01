import { describe, it, expect } from 'vitest';
import { Cartesian3 } from 'cesium';
import { DisplayRetarget } from './displayRetarget';

describe('unavailable-source display continuity', () => {
  it('preserves the actual display point and converges to the immediately selected physical source', () => {
    const oldDisplay = new Cartesian3(6800000, 2000, 1000), selectedDisplay = new Cartesian3(6800100, 0, 0);
    const oldCopy = Cartesian3.clone(oldDisplay), newCopy = Cartesian3.clone(selectedDisplay);
    const bridge = new DisplayRetarget(oldDisplay, selectedDisplay, 1000);
    const delta = new Cartesian3();
    expect(Cartesian3.add(selectedDisplay, bridge.evaluate(1000, delta), new Cartesian3())).toEqual(oldDisplay);
    expect(Cartesian3.magnitude(bridge.evaluate(1800, delta))).toBe(0);
    expect(oldDisplay).toEqual(oldCopy); expect(selectedDisplay).toEqual(newCopy);
  });
  it('has zero endpoint velocity and acceleration and a monotone bounded translation', () => {
    const bridge = new DisplayRetarget(new Cartesian3(3000, 0, 0), Cartesian3.ZERO, 0), out = new Cartesian3();
    let previous = Infinity;
    for (let i = 0; i <= 1000; i++) {
      const x = bridge.evaluate(i * 0.8, out).x;
      expect(x).toBeLessThanOrEqual(previous); expect(x).toBeGreaterThanOrEqual(0); previous = x;
    }
    expect(Math.abs(bridge.evaluate(0.001, out).x - 3000)).toBeLessThan(1e-8);
    expect(Math.abs(bridge.evaluate(799.999, out).x)).toBeLessThan(1e-8);
  });
});
