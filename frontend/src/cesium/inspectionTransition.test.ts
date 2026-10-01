import { describe, expect, it } from 'vitest';
import { Cartesian3, Ellipsoid, Matrix4, Quaternion } from 'cesium';
import { InspectionTransition, interruptionTangent, poseQuaternion, smootherstep } from './inspectionTransition';
import { rearInspectionOffset } from './inspectionControls';
import { TrajectoryVisualFrame } from './trajectoryOrientation';
import { enteringDisplayLift, silhouetteForMode } from './earthViewPresentation';
const frame = new Matrix4();
const position = new Cartesian3(6_800_000, 0, 0);
new TrajectoryVisualFrame().update(position, new Cartesian3(0, 7500, 0), frame);
const start = { position: new Cartesian3(23_000_000, 0, 0), direction: new Cartesian3(-1, 0, 0), up: new Cartesian3(0, 0, 1), fov: Math.PI / 3 };
const end = rearInspectionOffset(16 / 9, new Cartesian3());

describe('coordinated physical-pivot camera transitions', () => {
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
  it('uses one C2 parameter for range, orientation, FOV, lift and silhouette', () => {
    const flight = new InspectionTransition('entry', start, frame, end, 100 * Math.PI / 180, 5, 0);
    expect(flight.evaluate(frame, 0).position).toEqual(start.position);
    const first = Cartesian3.clone(flight.evaluate(frame, 0.00001).position);
    expect(Cartesian3.distance(first, start.position)).toBeLessThan(0.000003);
    expect(smootherstep(0)).toBe(0); expect(smootherstep(1)).toBe(1);
    expect(enteringDisplayLift(0)).toBe(75000); expect(enteringDisplayLift(0.35)).toBe(0);
    expect(silhouetteForMode('ENTERING_INSPECTION', 0.35, null).visibility).toBe(0);
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
  it('returns exactly to the captured Overview and preserves a partial Back tangent', () => {
    const entry = new InspectionTransition('entry', start, frame, end, 1.7, 5, 0);
    for (const p of [0.2, 0.5, 0.8, 1]) {
      const pose = entry.evaluate(frame, p);
      const exit = new InspectionTransition('exit', pose, frame, start.position, start.fov, 5, 0, start);
      const captured = Cartesian3.clone(pose.position);
      Cartesian3.fromElements(-100, 20, 40, exit.velocityCorrection);
      expect(Cartesian3.distance(exit.evaluate(frame, 0).position, captured)).toBeLessThan(1e-6);
      const delta = Cartesian3.subtract(exit.evaluate(frame, 1e-6).position, captured, new Cartesian3());
      Cartesian3.divideByScalar(delta, 5e-6, delta);
      expect(Cartesian3.distance(delta, exit.velocityCorrection)).toBeLessThan(0.01);
      expect(exit.evaluate(frame, 1)).toEqual(start);
      expect(interruptionTangent(0.12)).toBe(0); expect(interruptionTangent(1)).toBe(0);
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
