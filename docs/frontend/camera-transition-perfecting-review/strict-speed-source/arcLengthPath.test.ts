import { describe, expect, it } from 'vitest';
import { Cartesian3 } from 'cesium';
import { ArcLengthPath, cubicBezier } from './arcLengthPath';

describe('camera spatial arc length', () => {
  for (const scale of [0.001, 1, 17_000_000]) {
    for (const curved of [false, true]) {
      it(`traverses ${curved ? 'curved' : 'straight'} ${scale}m paths at equal physical intervals, in either direction`, () => {
        const a = new Cartesian3(0, 0, 0), b = new Cartesian3(scale / 3, curved ? scale / 2 : 0, 0);
        const c = new Cartesian3(2 * scale / 3, curved ? scale / 2 : 0, 0), d = new Cartesian3(scale, 0, 0);
        for (const reversed of [false, true]) {
          const path = new ArcLengthPath((t, r) => cubicBezier(a, b, c, d, reversed ? 1 - t : t, r));
          expect(path.at(0, new Cartesian3())).toEqual(reversed ? d : a);
          expect(path.at(1, new Cartesian3())).toEqual(reversed ? a : d);
          const previous = path.at(0, new Cartesian3()), point = new Cartesian3();
          for (let i = 1; i <= 1000; i++) {
            path.at(i / 1000, point);
            expect(Math.abs(Cartesian3.distance(previous, point) / (path.length / 1000) - 1)).toBeLessThan(0.00001);
            Cartesian3.clone(point, previous);
          }
          for (let i = 1; i < path.cumulative.length; i++) expect(path.cumulative[i]).toBeGreaterThan(path.cumulative[i - 1]!);
          expect(path.parameterAt(-1)).toBe(0); expect(path.parameterAt(2)).toBe(1);
        }
      });
    }
  }
  it('handles a coincident zero-length path without division by zero', () => {
    const point = new Cartesian3(1, 2, 3), path = new ArcLengthPath((_t, r) => Cartesian3.clone(point, r));
    expect(path.length).toBe(0);
    for (const u of [0, 0.1, 0.5, 1]) {
      expect(path.parameterAt(u)).toBe(u); expect(path.at(u, new Cartesian3())).toEqual(point);
    }
  });
  it('rejects invalid tables and nonfinite geometry', () => {
    expect(() => new ArcLengthPath((_t, r) => r, 0)).toThrow();
    expect(() => new ArcLengthPath((_t, r) => Cartesian3.fromElements(NaN, 0, 0, r))).toThrow();
  });
});
