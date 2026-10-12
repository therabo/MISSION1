import { readFileSync } from 'node:fs';
import { Camera, Cartesian3, GeographicProjection, JulianDate, Matrix4, SceneMode, type Scene } from 'cesium';
import { describe, expect, it } from 'vitest';
import { INSPECTION_RESET_SECONDS, InspectionResetTransition } from './inspectionReset';
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

describe('Inspection reset perceptual timeline', () => {
  const offset = Cartesian3.normalize(new Cartesian3(1500, -1200, -500), new Cartesian3());
  Cartesian3.multiplyByScalar(offset, 2000, offset);
  const start = native(offset);
  const angle = Cartesian3.angleBetween(offset, target);
  const easeAt = (p: number) => 6 * p ** 5 - 15 * p ** 4 + 10 * p ** 3;

  it('takes 2.5 seconds for a meaningful reset, independently of entry/exit and source repair', () => {
    const flight = new InspectionResetTransition(start, target, 125);
    expect(INSPECTION_RESET_SECONDS).toBe(2.5);
    expect(flight.duration).toBe(2.5);
    expect(flight.startMs).toBe(125);
    // At the former completion time this remains an intermediate camera pose.
    const pose = flight.evaluate(0.8 / flight.duration);
    expect(Cartesian3.distance(pose.position, target)).toBeGreaterThan(900);
    expect(Cartesian3.magnitude(pose.position)).toBeGreaterThan(1000);
  });

  it('captures without mutating the actual Camera, active transform or local/world basis', () => {
    const camera = new Camera({ canvas: { clientWidth: 1440, clientHeight: 900 },
      drawingBufferWidth: 1440, drawingBufferHeight: 900, mapProjection: new GeographicProjection(), mode: SceneMode.SCENE3D } as Scene);
    camera.lookAtTransform(Matrix4.fromTranslation(new Cartesian3(2000000, 4000000, 5000000)), offset);
    const snapshot = () => [camera.position, camera.direction, camera.up, camera.right,
      camera.positionWC, camera.directionWC, camera.upWC, camera.rightWC].map(v => Cartesian3.clone(v));
    const before = snapshot(), transform = Matrix4.clone(camera.transform);
    const rendered = { position: camera.position, direction: camera.direction, up: camera.up, fov: 1.2 };
    const flight = new InspectionResetTransition(rendered, target, 0);
    const after = snapshot();
    before.forEach((vector, i) => expect(after[i]).toEqual(vector));
    expect(camera.transform).toEqual(transform);
    const zero = flight.evaluate(0);
    expect(zero.position).toEqual(rendered.position);
    expect(zero.direction).toEqual(rendered.direction);
    expect(zero.up).toEqual(rendered.up);
    expect(zero.fov).toBe(rendered.fov);
    close(Matrix4.multiplyByPoint(transform, zero.position, new Cartesian3()), before[4]);
    // The capture owns its data, even if native input changes the Camera later.
    Cartesian3.clone(target, camera.position);
    expect(flight.evaluate(0).position).toEqual(before[0]);
  });

  it.each([0, 0.1, 0.25, 0.5, 0.75, 0.9, 1])('coordinates position, log range, orientation and FOV at %s elapsed', p => {
    const flight = new InspectionResetTransition({ ...start, fov: 1.2 }, target, 0);
    const pose = flight.evaluate(p), u = easeAt(p), range = Cartesian3.magnitude(pose.position);
    expect(range).toBeCloseTo(Math.exp(Math.log(2000) * (1 - u) + Math.log(90) * u), 8);
    expect(Cartesian3.angleBetween(pose.direction, Cartesian3.negate(target, new Cartesian3()))).toBeCloseTo(angle * (1 - u), 7);
    expect(pose.fov).toBeCloseTo(1.2 + (flight.endFov - 1.2) * u, 12);
    close(Cartesian3.multiplyByScalar(pose.direction, -range, new Cartesian3()), pose.position);
    if (p === 0) {
      expect(pose.position).toEqual(start.position); expect(pose.direction).toEqual(start.direction); expect(pose.up).toEqual(start.up);
    } else if (p < 1) {
      expect(range).toBeGreaterThan(90); expect(range).toBeLessThan(2000);
      expect(Cartesian3.distance(pose.position, start.position)).toBeGreaterThan(1);
      expect(Cartesian3.distance(pose.position, target)).toBeGreaterThan(1);
      if (p === 0.1) expect(range).toBeGreaterThan(1900);
      if (p === 0.25) expect(range).toBeGreaterThan(1400);
      if (p === 0.5) expect(range).toBeCloseTo(Math.sqrt(2000 * 90), 8);
      if (p === 0.75) expect(range).toBeGreaterThan(120);
      if (p === 0.9) expect(range).toBeGreaterThan(92);
    } else close(pose.position, target);
  });

  it('has soft start/stop and no visible endpoint stabilization or native tracking handoff', () => {
    const flight = new InspectionResetTransition(start, target, 0);
    const initial = Cartesian3.clone(flight.evaluate(0).position);
    expect(Cartesian3.distance(flight.evaluate(0.001).position, initial)).toBeLessThan(0.001);
    const penultimate = flight.evaluate(1 - 1e-6);
    const position = Cartesian3.clone(penultimate.position), direction = Cartesian3.clone(penultimate.direction), up = Cartesian3.clone(penultimate.up);
    const end = flight.evaluate(1), accepted = native(target);
    expect(Cartesian3.distance(position, end.position)).toBeLessThan(1e-5);
    close(direction, end.direction); close(up, end.up);
    close(end.position, accepted.position); close(end.direction, accepted.direction); close(end.up, accepted.up);
  });
});

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
    for (const progress of [0.1, 0.25, 0.5, 0.75, 0.9]) {
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
        for (const p of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
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
