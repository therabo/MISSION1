import { describe, expect, it } from 'vitest';
import { Cartesian3, Ellipsoid, Matrix3, Matrix4, Quaternion } from 'cesium';
import { InspectionTransition, poseQuaternion, transitionDuration } from './inspectionTransition';
import { TrajectoryVisualFrame } from './trajectoryOrientation';
import { rearInspectionOffset } from './inspectionControls';
import { TransitionComposition } from './transitionComposition';
import type { CameraPose } from './cameraPose';

// Synthetic geometry only, explicitly TEST; no source or attitude claim.
const station = new Cartesian3(6_800_000, 0, 0), frame = new Matrix4();
new TrajectoryVisualFrame().update(station, new Cartesian3(0, 7500, 0), frame);
const endpoint = rearInspectionOffset(16 / 9, new Cartesian3());
function aimed(position: Cartesian3, target = Cartesian3.ZERO): CameraPose {
  const direction = Cartesian3.normalize(Cartesian3.subtract(target, position, new Cartesian3()), new Cartesian3());
  const right = Cartesian3.normalize(Cartesian3.cross(direction, Cartesian3.UNIT_Z, new Cartesian3()), new Cartesian3());
  return { position, direction, up: Cartesian3.cross(right, direction, new Cartesian3()), fov: Math.PI / 3 };
}
const earths = [aimed(new Cartesian3(23_000_000, 0, 0)), aimed(new Cartesian3(70_000_000, 0, 0)),
  aimed(new Cartesian3(8_000_000, 0, 0)), aimed(new Cartesian3(0, 23_000_000, 0)),
  aimed(new Cartesian3(6_000_000, 23_000_000, 0)), aimed(Cartesian3.fromDegrees(20, 60, 17_000_000)),
  aimed(new Cartesian3(-23_000_000, 0, 0))];
const clone = (pose: CameraPose): CameraPose => ({ position: Cartesian3.clone(pose.position),
  direction: Cartesian3.clone(pose.direction), up: Cartesian3.clone(pose.up), fov: pose.fov });

describe('explicit spherical presentation focus', () => {
  it.each(earths.map((earth, i) => [i, earth] as const))('clears Earth and keeps a positive, continuous focus from arbitrary Earth pose %i', (_, earth) => {
    const flight = new InspectionTransition('entry', earth, frame, endpoint, 100 * Math.PI / 180, 6, 0);
    const initialFocus = Cartesian3.clone(flight.focusPoint);
    let blend = -1, previous: Cartesian3 | null = null;
    for (let i = 0; i <= 2000; i++) {
      const pose = flight.evaluate(frame, i / 2000);
      expect(Ellipsoid.WGS84.cartesianToCartographic(pose.position)!.height).toBeGreaterThan(998);
      const ray = Cartesian3.subtract(flight.focusPoint, pose.position, new Cartesian3());
      expect(Cartesian3.magnitude(ray)).toBeGreaterThan(1);
      expect(Cartesian3.angleBetween(ray, pose.direction)).toBeLessThan(1e-7);
      expect(Math.abs(Cartesian3.dot(pose.direction, pose.up))).toBeLessThan(1e-10);
      if (i >= 300 && i <= 1700) {
        const toStation = Cartesian3.subtract(station, pose.position, new Cartesian3());
        expect(Cartesian3.angleBetween(toStation, pose.direction)).toBeLessThan(Math.PI / 12 + 1e-7);
      }
      expect(flight.focusBlend).toBeGreaterThanOrEqual(blend); blend = flight.focusBlend;
      if (previous) expect(Cartesian3.angleBetween(previous, pose.direction)).toBeLessThan(0.01);
      previous = Cartesian3.clone(pose.direction);
    }
    expect(Cartesian3.distance(flight.focusPoint, station)).toBeLessThan(1e-6);
    flight.evaluate(frame, 0);
    expect(flight.focusPoint).toEqual(initialFocus);
    expect(flight.pose).toEqual(earth);
  });

  it('has C1 direction and focal position across both focus-rail boundaries', () => {
    const earth = earths[0]!;
    const entry = new InspectionTransition('entry', earth, frame, endpoint, 1.7, 6, 0);
    const exit = new InspectionTransition('exit', clone(entry.evaluate(frame, 1)), frame, earth.position, earth.fov, 5, 0, earth);
    const epsilon = 1e-7;
    for (const flight of [entry, exit]) {
      // Locate the exact rail boundary in time; its budget belongs to the
      // hybrid metric, so it is not generally a round time percentage.
      let low=0, high=1;
      for (let i=0; i<50; i++) {
        const middle=(low+high)/2; flight.evaluate(frame,middle);
        if (flight === entry ? flight.focusBlend<1 : flight.focusBlend===0) low=middle;
        else high=middle;
      }
      for (const p of [0.05, 0.1, 0.3, 0.4, (low+high)/2, 0.5, 0.6, 0.7, 0.9, 0.95]) {
        const samples = [p - epsilon, p, p + epsilon].map(t => { flight.evaluate(frame, t); return Cartesian3.clone(flight.focusPoint); });
        const left = Cartesian3.divideByScalar(Cartesian3.subtract(samples[1]!, samples[0]!, new Cartesian3()), epsilon, new Cartesian3());
        const right = Cartesian3.divideByScalar(Cartesian3.subtract(samples[2]!, samples[1]!, new Cartesian3()), epsilon, new Cartesian3());
        expect(Cartesian3.distance(left, right)).toBeLessThan(0.05 + 0.002 * Cartesian3.magnitude(left));
      }
    }
  });

  it('restores Earth from actual close, far, 90 degree and 180 degree Inspection poses', () => {
    const earth = earths[0]!;
    for (const offset of [endpoint, new Cartesian3(0, -120, 60), new Cartesian3(65, 0, 60),
      new Cartesian3(-20, 0, 10), new Cartesian3(-2000, 0, 0)]) {
      const start = aimed(Matrix4.multiplyByPoint(frame, offset, new Cartesian3()), station);
      const exit = new InspectionTransition('exit', start, frame, earth.position, earth.fov, 5, 0, earth);
      const firstFocus = Cartesian3.clone(exit.focusPoint);
      expect(exit.evaluate(frame, 0)).toEqual(start);
      expect(exit.focusPoint).toEqual(firstFocus);
      let blend = -1;
      for (let i = 0; i <= 1000; i++) {
        const pose = exit.evaluate(frame, i / 1000);
        expect(Ellipsoid.WGS84.cartesianToCartographic(pose.position)!.height).toBeGreaterThan(998);
        expect(exit.focusBlend).toBeGreaterThanOrEqual(blend); blend = exit.focusBlend;
      }
      expect(exit.pose).toEqual(earth);
      expect(Cartesian3.distance(exit.focusPoint, Cartesian3.ZERO)).toBeLessThan(1e-6);
    }
  });

  it('retains the actual focus point and its derivative at all seven partial Back poses', () => {
    const earth = earths[0]!, entry = new InspectionTransition('entry', earth, frame, endpoint, 1.7, 6, 0);
    const dt = 1e-5;
    for (const p of [.1, .2, .35, .5, .65, .8, .95]) {
      const previous = clone(entry.evaluate(frame, p - dt / 6)), previousFocus = Cartesian3.clone(entry.focusPoint);
      const start = clone(entry.evaluate(frame, p)), focus = Cartesian3.clone(entry.focusPoint);
      const velocity = Cartesian3.divideByScalar(Cartesian3.subtract(start.position, previous.position, new Cartesian3()), dt, new Cartesian3());
      const focusVelocity = Cartesian3.divideByScalar(Cartesian3.subtract(focus, previousFocus, new Cartesian3()), dt, new Cartesian3());
      const q0 = poseQuaternion(previous.direction, previous.up, new Quaternion()), q1 = poseQuaternion(start.direction, start.up, new Quaternion());
      if (Quaternion.dot(q0, q1) < 0) Quaternion.negate(q0, q0);
      const rate = Quaternion.multiplyByScalar(Quaternion.subtract(q1, q0, new Quaternion()), 1 / dt, new Quaternion());
      const exit = new InspectionTransition('exit', start, frame, earth.position, earth.fov, 5, 0, earth, station, focus);
      exit.retainIncomingDerivative(frame, frame, 1e-7, velocity, rate, (start.fov - previous.fov) / dt, station, q1, focusVelocity);
      exit.evaluate(frame, 0); expect(Cartesian3.distance(exit.focusPoint, focus)).toBeLessThan(1e-6);
      const step = Math.min(1e-6, exit.tangentDuration / 10000);
      exit.evaluate(frame, step / exit.duration);
      const outgoing = Cartesian3.divideByScalar(Cartesian3.subtract(exit.focusPoint, focus, new Cartesian3()), step, new Cartesian3());
      expect(Cartesian3.distance(outgoing, focusVelocity) / Math.max(1, Cartesian3.magnitude(focusVelocity))).toBeLessThan(.01);
    }
  });

  it('keeps the captured quaternion branch when a moving frame crosses 180 degrees', () => {
    const entry = new InspectionTransition('entry', earths[0]!, frame, endpoint, 1.7, 6, 0);
    const close = clone(entry.evaluate(frame, 1));
    const rolled = { ...close, position: Cartesian3.subtract(station,
      Cartesian3.multiplyByScalar(close.direction, 23_000_000, new Cartesian3()), new Cartesian3()),
      up: Cartesian3.negate(close.up, new Cartesian3()) };
    const composition = new TransitionComposition(rolled, station, null, frame, endpoint);
    const directions: Cartesian3[] = [], ups: Cartesian3[] = [];
    for (const angle of [-1e-5, 0, 1e-5]) {
      const rotation = Matrix3.fromQuaternion(Quaternion.fromAxisAngle(close.direction, angle));
      const moved = Matrix4.multiply(Matrix4.fromRotationTranslation(rotation), frame, new Matrix4());
      const pose = clone(rolled);
      composition.evaluate(pose, station, moved, .2);
      directions.push(Cartesian3.clone(pose.direction)); ups.push(Cartesian3.clone(pose.up));
    }
    expect(Cartesian3.angleBetween(directions[0]!, directions[2]!)).toBeLessThan(.001);
    expect(Cartesian3.angleBetween(ups[0]!, ups[2]!)).toBeLessThan(.001);
  });

  it('bounds duration, preserves canonical timing, and adapts to close/far geometry', () => {
    const canonical = aimed(new Cartesian3(23_373_499, 0, 0));
    expect(transitionDuration('entry', canonical, station, 1)).toBe(6);
    expect(transitionDuration('exit', canonical, station, 1)).toBe(5);
    expect(transitionDuration('entry', earths[1]!, station, 1)).toBeGreaterThan(6);
    expect(transitionDuration('entry', earths[2]!, station, 1)).toBeLessThan(6);
    for (const earth of earths) expect(transitionDuration('entry', earth, station, 2)).toBeGreaterThanOrEqual(4);
  });
});
