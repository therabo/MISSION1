import { describe, expect, it } from 'vitest';
import { Cartesian3, JulianDate, Matrix4, type ScreenSpaceCameraController } from 'cesium';
import { readFileSync } from 'node:fs';
import { TrajectoryVisualFrame } from './trajectoryOrientation';
import { makeVelocityProperty } from './velocityProperty';
import { makeSampledPosition } from './sampleProperty';
import { clampInspectionOffset, inspectionControlProfile, inspectionZoomRange, inspectionPinchRange, rearInspectionOffset } from './inspectionControls';
import { parseComparison } from '../orbital/comparison';
const real = parseComparison(JSON.parse(readFileSync(new URL('../../../docs/frontend/inspection-orientation-review/real-comparison.json', import.meta.url), 'utf8')));

describe('trajectory visual orientation and moving rear camera', () => {
  for (const source of ['primary', 'oem'] as const) it(`${source}: uses physical velocity, the verified asset axis and a continuous right-handed frame`, () => {
    const samples = real[source].samples, p = makeSampledPosition(samples), v = makeVelocityProperty(samples);
    const builder = new TrajectoryVisualFrame(), matrix = new Matrix4();
    let previous: Cartesian3 | null = null;
    for (const sample of samples) {
      const time = JulianDate.fromIso8601(sample.time), position = p.getValue(time)!, velocity = v.getValue(time)!;
      expect(builder.update(position, velocity, matrix)).toBe(matrix);
      const forward = Matrix4.multiplyByPointAsVector(matrix, Cartesian3.UNIT_X, new Cartesian3());
      const left = Matrix4.multiplyByPointAsVector(matrix, Cartesian3.UNIT_Y, new Cartesian3());
      const up = Matrix4.multiplyByPointAsVector(matrix, Cartesian3.UNIT_Z, new Cartesian3());
      expect(Cartesian3.angleBetween(forward, velocity)).toBeLessThan(1e-10);
      expect(Cartesian3.dot(forward, left)).toBeCloseTo(0, 12);
      expect(Cartesian3.dot(up, left)).toBeCloseTo(0, 12);
      expect(Cartesian3.dot(Cartesian3.cross(forward, left, new Cartesian3()), up)).toBeCloseTo(1, 12);
      expect(Matrix4.getTranslation(matrix, new Cartesian3())).toEqual(position);
      if (previous) expect(Cartesian3.dot(previous, up)).toBeGreaterThan(0.99);
      previous = up;
      const camera = Matrix4.multiplyByPoint(matrix, rearInspectionOffset(1280 / 720, new Cartesian3()), new Cartesian3());
      expect(Cartesian3.angleBetween(Cartesian3.subtract(position, camera, new Cartesian3()), velocity) * 180 / Math.PI).toBeCloseTo(42.5, 7);
    }
    expect(v.getValue(JulianDate.addSeconds(JulianDate.fromIso8601(samples[0].time), -1, new JulianDate()))).toBeUndefined();
  });
  it('selects the supplied source tangent and guards invalid / radial states', () => {
    const builder = new TrajectoryVisualFrame(), result = new Matrix4(), p = new Cartesian3(6800000, 0, 0);
    expect(builder.update(p, Cartesian3.ZERO, result)).toBeUndefined();
    expect(builder.update(p, new Cartesian3(NaN, 1, 0), result)).toBeUndefined();
    for (const v of [new Cartesian3(0, 7000, 0), new Cartesian3(0, 0, 7000), new Cartesian3(7000, 0, 0)]) {
      expect(builder.update(p, v, result)).toBeDefined();
      expect(Cartesian3.angleBetween(Matrix4.multiplyByPointAsVector(result, Cartesian3.UNIT_X, new Cartesian3()), v)).toBeLessThan(1e-10);
      expect(Array.from({ length: 16 }, (_, i) => result[i]).every(Number.isFinite)).toBe(true);
    }
  });
  it('reduces canonical distance by at least 65% and adapts narrow framing', () => {
    const offset = rearInspectionOffset(1280 / 720, new Cartesian3());
    expect(Cartesian3.magnitude(offset)).toBeCloseTo(90);
    expect(offset.x).toBeCloseTo(-90 * Math.cos(42.5 * Math.PI / 180));
    expect(offset.y).toBe(0);
    expect(offset.z).toBeCloseTo(90 * Math.sin(42.5 * Math.PI / 180));
    expect(Cartesian3.magnitude(offset)).toBeLessThanOrEqual(340 * 0.35 + 1e-8);
    expect(Cartesian3.magnitude(rearInspectionOffset(390 / 844, new Cartesian3()))).toBeGreaterThan(119);
  });
});
describe('Inspection-only navigation', () => {
  it('restores Overview, blocks transitions, avoids duplicate native zoom', () => {
    const initial = { enableInputs: true, enableZoom: true, enableTranslate: true, enableLook: true, enableTilt: true, zoomFactor: 5,
      minimumZoomDistance: 1, maximumZoomDistance: Infinity, inertiaZoom: 0.8, inertiaSpin: 0.9, inertiaTranslate: 0.9 };
    const c = { ...initial } as unknown as ScreenSpaceCameraController, apply = inspectionControlProfile(c);
    for (const mode of ['ENTERING_INSPECTION', 'EXITING_INSPECTION'] as const) { apply(mode); expect(c.enableInputs).toBe(false); }
    apply('ISS_INSPECTION'); expect(c.enableInputs).toBe(true); expect(c.enableZoom).toBe(false); expect(c.enableTranslate).toBe(false);
    apply('EARTH_OVERVIEW'); expect(c).toEqual(initial);
  });
  it('uses proportional reversible bounded wheel and pinch steps', () => {
    expect(inspectionZoomRange(100, 50) / 100).toBeCloseTo(inspectionZoomRange(1000, 50) / 1000);
    expect(inspectionZoomRange(inspectionZoomRange(119, 50), -50)).toBeCloseTo(119);
    expect(inspectionZoomRange(119, 100000)).toBeGreaterThan(119 * 0.7);
    expect(inspectionPinchRange(119, 20, 40)).toBeCloseTo(119 * 0.7);
    expect(inspectionPinchRange(119, 0, 0)).toBe(119);
  });
  it('stays outside the centered directional model box while preserving orbit direction', () => {
    for (const direction of [Cartesian3.UNIT_X, Cartesian3.UNIT_Y, Cartesian3.UNIT_Z, new Cartesian3(1, 1, 1)]) {
      const offset = Cartesian3.clone(direction), result = clampInspectionOffset(offset);
      expect(result).toBe(offset); expect(Cartesian3.magnitude(result)).toBeGreaterThanOrEqual(35);
      expect(Cartesian3.angleBetween(result, direction)).toBeLessThan(1e-10);
    }
    expect(Cartesian3.magnitude(clampInspectionOffset(new Cartesian3(-3000, 0, 0)))).toBeCloseTo(2000);
  });
});
