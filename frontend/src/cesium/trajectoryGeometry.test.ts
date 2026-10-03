import { describe, expect, it } from 'vitest';
import { ArcType, Cartesian3, GeometryAttribute, PolylineGeometry, PolylineMaterialAppearance } from 'cesium';
import { trajectoryGeometry } from './trajectoryGeometry';

describe('retained trajectory presentation attributes', () => {
  // Synthetic TEST coordinates exercise both signs and relative-to-eye precision.
  const points = [
    new Cartesian3(6_800_123.456, -1_234_567.89, 42.125),
    new Cartesian3(6_799_654.321, -1_230_000.012, -65_537.25),
    new Cartesian3(6_795_432.109, -1_220_321.789, 131_073.125),
    new Cartesian3(6_780_123.001, -1_210_987.654, 234_567.891),
  ];

  it.each([8, 20])('preserves native positions, indices, time fractions and width %s', width => {
    const before = points.map(p => Cartesian3.clone(p));
    const native = PolylineGeometry.createGeometry(new PolylineGeometry({
      positions: points, width, arcType: ArcType.NONE,
      vertexFormat: PolylineMaterialAppearance.VERTEX_FORMAT,
    }))!;
    const actual = trajectoryGeometry(points, width);
    for (const name of ['position', 'prevPosition', 'nextPosition', 'expandAndWidth', 'st']) {
      const key = name as keyof typeof native.attributes;
      expect(actual.attributes[key]!.values).toEqual(native.attributes[key]!.values);
    }
    expect(actual.indices).toEqual(native.indices);
    expect(actual.boundingSphere).toEqual(native.boundingSphere);
    expect(points).toEqual(before);
  });

  it('gives every segment vertex the same genuine adjacent endpoints, including open caps', () => {
    const actual = trajectoryGeometry(points, 20);
    const attributes = actual.attributes as unknown as Record<string, GeometryAttribute>;
    for (let segment = 0; segment < points.length - 1; segment++) {
      for (const [name, index] of [['before', Math.max(0, segment - 1)],
        ['after', Math.min(points.length - 1, segment + 2)]] as const) {
        const high = attributes[`${name}High`].values!, low = attributes[`${name}Low`].values!;
        const expected = [points[index].x, points[index].y, points[index].z];
        for (let vertex = 0; vertex < 4; vertex++) for (let axis = 0; axis < 3; axis++) {
          const offset = (segment * 4 + vertex) * 3 + axis;
          expect(Math.abs(high[offset] + low[offset] - expected[axis])).toBeLessThan(.005);
          expect(Math.abs(high[offset] % 65536)).toBe(0);
        }
      }
    }
  });

  it('rejects a changed native segment layout instead of assigning neighbors to wrong vertices', () => {
    expect(() => trajectoryGeometry([points[0], points[1], points[1], points[2]], 8))
      .toThrow('Unexpected retained polyline segment layout');
  });
});
