import { readFileSync } from 'node:fs';
import { Camera, Cartesian3, GeographicProjection, JulianDate, Matrix4, SceneMode, type Scene } from 'cesium';
import { describe, expect, it } from 'vitest';
import { InspectionResetTransition } from './inspectionReset';
import { clampInspectionOffset, rearInspectionOffset } from './inspectionControls';
import { TrajectoryVisualFrame } from './trajectoryOrientation';
import { parseComparison } from '../orbital/comparison';
import { makeSampledPosition } from './sampleProperty';
import { makeVelocityProperty } from './velocityProperty';

const target = rearInspectionOffset(16 / 9, new Cartesian3());
const native = (offset: Cartesian3) => {
  const camera = new Camera({ canvas: { clientWidth: 1440, clientHeight: 900 },
    drawingBufferWidth: 1440, drawingBufferHeight: 900, mapProjection: new GeographicProjection(), mode: SceneMode.SCENE3D } as Scene);
  camera.lookAtTransform(Matrix4.IDENTITY, offset);
  return { position: Cartesian3.clone(camera.position), direction: Cartesian3.clone(camera.direction),
    up: Cartesian3.clone(camera.up), fov: 100 * Math.PI / 180 };
};
const close = (a: Cartesian3, b: Cartesian3) => expect(Cartesian3.distance(a, b)).toBeLessThan(1e-8);

describe('Inspection reset uses one progressive local pose', () => {
  const starts = {
    'A: same direction, wrong range': Cartesian3.multiplyByScalar(target, 2000 / 90, new Cartesian3()),
    'B: same range, off axis': new Cartesian3(0, 90, 0),
    'C: off axis and far away': new Cartesian3(1500, -900, -600),
    'close zoom': Cartesian3.multiplyByScalar(target, 0.55, new Cartesian3()),
    'above pole': new Cartesian3(0, 0, 500),
    'below pole': new Cartesian3(0, 0, -500),
    'close off axis': new Cartesian3(0, 61, 0),
    'close opposite side': new Cartesian3(35, 0, 0),
  };
  it.each(Object.entries(starts))('%s advances position and range at 25/50/75%, without a snap', (_name, offset) => {
    const start = native(offset), flight = new InspectionResetTransition(start, target, 0);
    close(flight.evaluate(0).position, start.position);
    close(flight.evaluate(0).direction, start.direction); close(flight.evaluate(0).up, start.up);
    let distance = Cartesian3.distance(start.position, target);
    const startRange = Cartesian3.magnitude(start.position);
    for (const progress of [0.25, 0.5, 0.75]) {
      const pose = flight.evaluate(progress), range = Cartesian3.magnitude(pose.position);
      expect(Cartesian3.distance(pose.position, start.position)).toBeGreaterThan(0.1);
      expect(Cartesian3.distance(pose.position, target)).toBeGreaterThan(0.1);
      expect(Cartesian3.distance(pose.position, target)).toBeLessThan(distance);
      distance = Cartesian3.distance(pose.position, target);
      if (Math.abs(startRange - 90) > 1e-6) {
        expect(range).toBeGreaterThan(Math.min(startRange, 90));
        expect(range).toBeLessThan(Math.max(startRange, 90));
      } else expect(range).toBeCloseTo(90, 8);
      expect(Cartesian3.dot(pose.direction, pose.up)).toBeCloseTo(0, 12);
      expect(Cartesian3.dot(pose.direction, Cartesian3.normalize(pose.position, new Cartesian3()))).toBeCloseTo(-1, 12);
    }
    const end = flight.evaluate(1), accepted = native(target);
    close(end.position, accepted.position); close(end.direction, accepted.direction); close(end.up, accepted.up);
    expect(end.fov).toBe(accepted.fov);
  });
  it('D: stays at the accepted target through repeated resets without drift', () => {
    let pose = native(target);
    for (let cycle = 0; cycle < 20; cycle++) {
      const flight = new InspectionResetTransition(pose, target, cycle);
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const next = flight.evaluate(t); close(next.position, target); close(next.direction, pose.direction); close(next.up, pose.up);
      }
      pose = flight.evaluate(1);
    }
  });
  it('converges monotonically from valid close off-axis starts while retaining model clearance', () => {
    const offsets = [new Cartesian3(0, 61, 0), new Cartesian3(35, 0, 0), new Cartesian3(0, -61, 0)];
    // TEST camera directions cover the sphere, including both poles. All start
    // at the existing legal model-clearance boundary, the hardest outward reset.
    for (let i = 0; i <= 60; i++) {
      const z = 1 - 2 * i / 60, angle = i * Math.PI * (3 - Math.sqrt(5));
      const radial = Math.sqrt(Math.max(0, 1 - z * z));
      offsets.push(clampInspectionOffset(new Cartesian3(35 * radial * Math.cos(angle), 35 * radial * Math.sin(angle), 35 * z)));
    }
    for (const offset of offsets) {
      const flight = new InspectionResetTransition(native(offset), target, 0);
      let error = Math.abs(Cartesian3.magnitude(offset) - 90);
      for (let step = 0; step <= 400; step++) {
        const pose = flight.evaluate(step / 400);
        const next = Math.abs(Cartesian3.magnitude(pose.position) - 90);
        expect(next).toBeLessThanOrEqual(error + 1e-8);
        error = next;
      }
    }
  });
  it('restarts at the exact interrupted pose, including its orientation and range', () => {
    const first = new InspectionResetTransition(native(starts['C: off axis and far away']), target, 0);
    const middle = first.evaluate(0.5);
    const second = new InspectionResetTransition(middle, target, 400);
    close(second.evaluate(0).position, middle.position); close(second.evaluate(0).direction, middle.direction); close(second.evaluate(0).up, middle.up);
    // Construction owns a snapshot, independent of subsequent mutations.
    first.evaluate(0.75); close(second.evaluate(0).position, second.start.position);
    close(second.evaluate(1).position, target);
  });
  it.each([[1440,900], [1024,768], [768,1024], [390,844], [320,568]])('retains the accepted responsive %ix%i target and FOV', (width, height) => {
    const endpoint = rearInspectionOffset(width / height, new Cartesian3());
    const flight = new InspectionResetTransition(native(starts['C: off axis and far away']), endpoint, 0);
    const end = flight.evaluate(1);
    expect(Cartesian3.magnitude(end.position)).toBeCloseTo(90 * Math.max(1, 1.2 / (width / height)), 8);
    expect(end.position.y).toBe(0);
    expect(Math.atan2(end.position.z, -end.position.x) * 180 / Math.PI).toBeCloseTo(42.5, 10);
    expect(end.fov).toBe(100 * Math.PI / 180);
    close(end.up, native(endpoint).up);
  });
  it.each(['primary', 'oem'] as const)('%s shares Current/Historical frame handling without changing selected UTC or samples', source => {
    // Retained real backend bodies; deterministic TEST input, never a runtime fallback.
    const real = parseComparison(JSON.parse(readFileSync(new URL('../../../docs/frontend/inspection-orientation-review/real-comparison.json', import.meta.url), 'utf8')));
    const samples = real[source].samples, snapshot = JSON.stringify(samples);
    const positions = makeSampledPosition(samples), velocities = makeVelocityProperty(samples);
    const times = [samples[1].time, samples[samples.length - 2].time];
    for (const iso of times) {
      const selected = JulianDate.fromIso8601(iso), before = JulianDate.toIso8601(selected);
      for (const historical of [false, true]) {
        const flight = new InspectionResetTransition(native(starts['C: off axis and far away']), target, 0);
        for (const p of [0, 0.25, 0.5, 0.75, 1]) {
          const time = historical ? selected : JulianDate.addSeconds(selected, p * flight.duration, new JulianDate());
          const physical = positions.getValue(time)!, velocity = velocities.getValue(time)!;
          const frame = new Matrix4(); expect(new TrajectoryVisualFrame().update(physical, velocity, frame)).toBe(frame);
          const local = flight.evaluate(p), world = Matrix4.multiplyByPoint(frame, local.position, new Cartesian3());
          expect(Cartesian3.distance(world, physical)).toBeCloseTo(Cartesian3.magnitude(local.position), 7);
          if (p === 1) close(world, Matrix4.multiplyByPoint(frame, target, new Cartesian3()));
        }
        expect(JulianDate.toIso8601(selected)).toBe(before);
      }
    }
    expect(JSON.stringify(samples)).toBe(snapshot);
  });
});
