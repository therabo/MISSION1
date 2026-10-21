import { describe, expect, it } from 'vitest';
import { Cartesian3, Ellipsoid, JulianDate, Matrix4, Quaternion } from 'cesium';
import { readFileSync } from 'node:fs';
import { parseComparison } from '../orbital/comparison';
import { makeSampledPosition } from './sampleProperty';
import { makeVelocityProperty } from './velocityProperty';
import { InspectionTransition, poseQuaternion, smootherstep } from './inspectionTransition';
import { rearInspectionOffset } from './inspectionControls';
import { TrajectoryVisualFrame } from './trajectoryOrientation';
import { enteringDisplayLift, modelDisplayPosition } from './earthViewPresentation';
const frame = new Matrix4();
const position = new Cartesian3(6_800_000, 0, 0);
new TrajectoryVisualFrame().update(position, new Cartesian3(0, 7500, 0), frame);
const start = { position: new Cartesian3(23_000_000, 0, 0), direction: new Cartesian3(-1, 0, 0), up: new Cartesian3(0, 0, 1), fov: Math.PI / 3 };
const end = rearInspectionOffset(16 / 9, new Cartesian3());

describe('coordinated physical-pivot camera transitions', () => {
  for (const source of ['primary', 'oem'] as const) it(`${source}: preserves the canonical desktop endpoint from arbitrary Earth poses`, () => {
    // Recorded real backend fixture, used only for deterministic TEST geometry.
    const real = parseComparison(JSON.parse(readFileSync(new URL('../test/fixtures/orbital/real-comparison.json', import.meta.url), 'utf8')));
    const time = JulianDate.fromIso8601('2026-09-30T15:45:59.975908Z');
    const physical = makeSampledPosition(real[source].samples).getValue(time)!;
    const velocity = makeVelocityProperty(real[source].samples).getValue(time)!;
    const sourceFrame = new Matrix4();
    new TrajectoryVisualFrame().update(physical, velocity, sourceFrame);
    const geo = Ellipsoid.WGS84.cartesianToCartographic(physical)!;
    const canonical = new Cartesian3(-9412786.358621413, -21163227.169227634, -3167995.3206285993);
    const starts = [canonical, Cartesian3.multiplyByScalar(canonical, 3, new Cartesian3()),
      Cartesian3.fromRadians(geo.longitude, geo.latitude, 2_000_000),
      Cartesian3.fromRadians(geo.longitude + Math.PI / 2, 0, 17_000_000),
      Cartesian3.fromRadians(geo.longitude + 70 * Math.PI / 180, geo.latitude, 17_000_000)];
    for (const camera of starts) {
      const direction = Cartesian3.normalize(Cartesian3.negate(camera, new Cartesian3()), new Cartesian3());
      const right = Cartesian3.normalize(Cartesian3.cross(direction, Cartesian3.UNIT_Z, new Cartesian3()), new Cartesian3());
      const up = Cartesian3.cross(right, direction, new Cartesian3());
      const flight = new InspectionTransition('entry', { ...start, position: camera, direction, up },
        sourceFrame, rearInspectionOffset(1280 / 720, new Cartesian3()), 100 * Math.PI / 180, 6, 0);
      const pose = flight.evaluate(sourceFrame, 1);
      const local = Matrix4.multiplyByPoint(Matrix4.inverseTransformation(sourceFrame, new Matrix4()), pose.position, new Cartesian3());
      expect(Cartesian3.distance(pose.position, physical)).toBeCloseTo(90, 6);
      expect(local.x).toBeCloseTo(-90 * Math.cos(42.5 * Math.PI / 180), 6);
      expect(local.y).toBeCloseTo(0, 6);
      expect(local.z).toBeCloseTo(90 * Math.sin(42.5 * Math.PI / 180), 6);
      expect(Math.atan2(local.z, -local.x) * 180 / Math.PI).toBeCloseTo(42.5, 6);
      expect(pose.fov * 180 / Math.PI).toBeCloseTo(100, 10);
      // The native moving-pivot handoff adopts the same frame and offset.
      const stable = Matrix4.multiplyByPoint(sourceFrame, flight.endOffset, new Cartesian3());
      expect(Cartesian3.distance(stable, pose.position)).toBeLessThan(1e-7);
    }
  });
  it('arrives at a 90m, 42.5 degree rear view, centred on either selected-source frame', () => {
    for (const sourcePosition of [position, new Cartesian3(6_798_000, 2100, 50)]) {
      const sourceFrame = new Matrix4();
      new TrajectoryVisualFrame().update(sourcePosition, new Cartesian3(-10, 7498, 30), sourceFrame);
      const flight = new InspectionTransition('entry', start, sourceFrame, end, 100 * Math.PI / 180, 5, 0);
      const pose = flight.evaluate(sourceFrame, 1);
      expect(Cartesian3.distance(pose.position, sourcePosition)).toBeCloseTo(90, 7);
      expect(end.x).toBeLessThan(0); expect(end.y).toBe(0); expect(end.z).toBeGreaterThan(0);
      expect(Math.atan2(end.z, -end.x) * 180 / Math.PI).toBeCloseTo(42.5, 10);
      expect(Cartesian3.angleBetween(pose.direction, Cartesian3.subtract(sourcePosition, pose.position, new Cartesian3()))).toBeLessThan(1e-7);
    }
  });
  it('starts gradually and keeps orientation orthonormal', () => {
    const flight = new InspectionTransition('entry', start, frame, end, 100 * Math.PI / 180, 5, 0);
    expect(flight.evaluate(frame, 0).position).toEqual(start.position);
    const first = Cartesian3.clone(flight.evaluate(frame, 0.00001).position);
    expect(Cartesian3.distance(first, start.position)).toBeLessThan(0.01);
    expect(smootherstep(0)).toBe(0); expect(smootherstep(1)).toBe(1);
    expect(enteringDisplayLift(0)).toBe(75000); expect(enteringDisplayLift(0.35)).toBe(0);
    let previousQuaternion: Quaternion | null = null;
    for (let i = 0; i <= 1000; i++) {
      const pose = flight.evaluate(frame, i / 1000);
      const quaternion = poseQuaternion(pose.direction, pose.up, new Quaternion());
      if (previousQuaternion) expect(Math.abs(Quaternion.dot(previousQuaternion, quaternion))).toBeGreaterThan(0.99);
      previousQuaternion = quaternion;
      expect(Math.abs(Cartesian3.dot(pose.direction, pose.up))).toBeLessThan(1e-10);
      expect(Number.isFinite(pose.fov)).toBe(true);
    }
  });
  it('fades in a moving selected frame without changing the initial world pose', () => {
    const flight = new InspectionTransition('entry', start, frame, end, 1.7, 5, 0);
    const moved = Matrix4.clone(frame);
    Matrix4.setTranslation(moved, new Cartesian3(6_800_000, 40_000, 0), moved);
    expect(Cartesian3.distance(flight.evaluate(moved, 0).position, start.position)).toBeLessThan(1e-7);
    expect(Cartesian3.distance(flight.evaluate(moved, 1).position, Matrix4.multiplyByPoint(moved, end, new Cartesian3()))).toBeLessThan(1e-7);
  });
  it('returns from every requested partial Back pose without position, orientation or FOV discontinuity', () => {
    const entry = new InspectionTransition('entry', start, frame, end, 1.7, 5, 0);
    for (const p of [0.1, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95, 1]) {
      const pose = entry.evaluate(frame, p);
      const exit = new InspectionTransition('exit', pose, frame, start.position, start.fov, 5, 0, start);
      const captured = Cartesian3.clone(pose.position);
      const first = exit.evaluate(frame, 0);
      expect(Cartesian3.distance(first.position, captured)).toBeLessThan(1e-6);
      expect(first.direction).toEqual(pose.direction); expect(first.up).toEqual(pose.up); expect(first.fov).toBe(pose.fov);
      expect(exit.evaluate(frame, 1)).toEqual(start);
    }
  });
  it('spreads close-range scale growth and has a smooth, monotone perceptual inverse', () => {
    const flight = new InspectionTransition('entry', start, frame, end, 100 * Math.PI / 180, 6, 0);
    let previousRange = Infinity, previousParameter = 0;
    for (let i = 0; i <= 1000; i++) {
      const range = Cartesian3.distance(flight.evaluate(frame, i / 1000).position, position);
      expect(range).toBeLessThanOrEqual(previousRange + 1e-6);
      expect(flight.pathParameter).toBeGreaterThanOrEqual(previousParameter);
      previousRange = range; previousParameter = flight.pathParameter;
    }
    const size = (p: number) => 1 / Cartesian3.distance(flight.evaluate(frame, p).position, position);
    const total = size(1) - size(0);
    expect((size(1) - size(0.95)) / total).toBeLessThan(0.03);
    expect((size(1) - size(0.8)) / total).toBeLessThan(0.3);
    expect(Cartesian3.distance(flight.evaluate(frame, 0.5).position, position)).toBeLessThan(500);
  });
  it('preserves incoming position, quaternion and FOV derivatives at all seven Back checkpoints', () => {
    const flight = new InspectionTransition('entry', start, frame, end, 1.7, 6, 0);
    const clone = (p: ReturnType<typeof flight.evaluate>) => ({ position: Cartesian3.clone(p.position),
      direction: Cartesian3.clone(p.direction), up: Cartesian3.clone(p.up), fov: p.fov });
    const dt = 1e-4;
    for (const fraction of [0.1, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95]) {
      const before = clone(flight.evaluate(frame, fraction - dt / flight.duration));
      const pose = clone(flight.evaluate(frame, fraction));
      const velocity = Cartesian3.divideByScalar(Cartesian3.subtract(pose.position, before.position, new Cartesian3()), dt, new Cartesian3());
      const q0 = poseQuaternion(before.direction, before.up, new Quaternion());
      const q1 = poseQuaternion(pose.direction, pose.up, new Quaternion());
      if (Quaternion.dot(q0, q1) < 0) Quaternion.negate(q0, q0);
      const qRate = Quaternion.multiplyByScalar(Quaternion.subtract(q1, q0, new Quaternion()), 1 / dt, new Quaternion());
      const fovRate = (pose.fov - before.fov) / dt;
      for (const sign of [1, -1]) {
      const exit = new InspectionTransition('exit', pose, frame, start.position, start.fov, 5, 0, start);
      exit.retainIncomingDerivative(frame, frame, 1e-6, velocity,
        Quaternion.multiplyByScalar(qRate, sign, new Quaternion()), fovRate, position,
        Quaternion.multiplyByScalar(q1, sign, new Quaternion()));
      const first = clone(exit.evaluate(frame, 0));
      expect(first).toEqual(pose);
      const step = Math.min(1e-5, exit.tangentDuration / 10000);
      const next = clone(exit.evaluate(frame, step / exit.duration));
      const outgoing = Cartesian3.divideByScalar(Cartesian3.subtract(next.position, pose.position, new Cartesian3()), step, new Cartesian3());
      expect(Cartesian3.distance(outgoing, velocity) / Cartesian3.magnitude(velocity)).toBeLessThan(0.005);
      const nextQ = poseQuaternion(next.direction, next.up, new Quaternion());
      if (Quaternion.dot(q1, nextQ) < 0) Quaternion.negate(nextQ, nextQ);
      const outQRate = Quaternion.multiplyByScalar(Quaternion.subtract(nextQ, q1, new Quaternion()), 1 / step, new Quaternion());
      expect(Math.hypot(outQRate.x - qRate.x, outQRate.y - qRate.y, outQRate.z - qRate.z, outQRate.w - qRate.w)).toBeLessThan(0.002);
      expect(Math.abs((next.fov - pose.fov) / step - fovRate)).toBeLessThan(0.01);
      let previous = first;
      for (let i = 1; i <= 400; i++) {
        const current = clone(exit.evaluate(frame, i * exit.tangentDuration / (400 * exit.duration)));
        expect(Cartesian3.angleBetween(previous.direction, current.direction)).toBeLessThan(0.002);
        expect(Cartesian3.angleBetween(previous.up, current.up)).toBeLessThan(0.002);
        previous = current;
      }
      expect(exit.evaluate(frame, 1)).toEqual(start);
      }
    }
  });
  it('uses the displayed station distance during the explicit Earth-focus transfer', () => {
    const entry = new InspectionTransition('entry', start, frame, end, 1.7, 6, 0);
    const exit = new InspectionTransition('exit', entry.evaluate(frame, 1), frame, start.position, start.fov, 5, 0, start, position);
    let distinguishable = false;
    for (const p of [0.82, 0.85, 0.88, 0.9, 0.95]) {
      const display = modelDisplayPosition(position, 75000 * exit.presentationAt(p), new Cartesian3());
      const pose = exit.evaluate(frame, p, display);
      const toDisplay = Cartesian3.subtract(display, pose.position, new Cartesian3());
      const toPhysical = Cartesian3.subtract(position, pose.position, new Cartesian3());
      const displayedDirection = Cartesian3.clone(pose.direction);
      const displayedFocus = Cartesian3.clone(exit.focusPoint);
      exit.evaluate(frame, p, position);
      expect(Cartesian3.distance(exit.focusPoint, displayedFocus)).toBeGreaterThan(1);
      expect(Cartesian3.angleBetween(displayedDirection, toDisplay)).toBeLessThan(start.fov / 4 + 1e-6);
      if (Cartesian3.angleBetween(toDisplay, toPhysical) > 0.001) distinguishable = true;
    }
    expect(distinguishable).toBe(true);
  });
  it('adjusts the lens continuously when Overview already starts near the station', () => {
    const close = { ...start, position: Matrix4.multiplyByPoint(frame, Cartesian3.multiplyByScalar(end, 2, new Cartesian3()), new Cartesian3()) };
    const entry = new InspectionTransition('entry', close, frame, end, 1.7, 6, 0);
    expect(Math.abs(entry.evaluate(frame, 0.9999).fov - 1.7)).toBeLessThan(0.00001);
    expect(entry.evaluate(frame, 0).fov).toBe(close.fov);
  });
  it('restores the same captured pose after ten cycles without numerical drift', () => {
    let overview = start;
    for (let i = 0; i < 10; i++) {
      const entry = new InspectionTransition('entry', overview, frame, end, 1.7, 5, 0);
      const exit = new InspectionTransition('exit', entry.evaluate(frame, 1), frame, overview.position, overview.fov, 5, 0, overview);
      overview = exit.evaluate(frame, 1);
      expect(overview).toEqual(start);
    }
  });
  it('clears Earth on a single arc from occulted and low polar viewpoints', () => {
    for (const camera of [new Cartesian3(-17_000_000, 0, 0), Cartesian3.fromDegrees(0, 85, 1000)]) {
      const flight = new InspectionTransition('entry', { ...start, position: camera }, frame, end, 1.7, 5, 0);
      for (let i = 0; i <= 1000; i++) expect(Ellipsoid.WGS84.cartesianToCartographic(flight.evaluate(frame, i / 1000).position)!.height).toBeGreaterThan(998);
      expect(Cartesian3.distance(flight.evaluate(frame, 1).position, Matrix4.multiplyByPoint(frame, end, new Cartesian3()))).toBeLessThan(1e-6);
    }
  });
});
