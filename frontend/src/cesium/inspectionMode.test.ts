import { describe, expect, it } from 'vitest';
import { Cartesian3, Cartesian4, Ellipsoid, JulianDate, Matrix4 } from 'cesium';
import { orbitalPayload } from '../test/orbitalFixture';
import { parseOrbitalWindow } from '../orbital/sampleMapping';
import { createVisualWindow, modelPositionAt } from './visualWindow';
import { ISS_MODEL } from './modelPresentation';
import { approachMinimumPixelSize, canInspect, cameraTrackingFrame, earthOccludes, exitMinimumPixelSize, inspectionCartesianOffset, INITIAL_VIEW_MODE, inspectionPresentation, interpolateUnitDirection, movingApproachOffset, movingApproachPathClear, nextViewMode, pickAction, radialAcquisitionPosition, rebaseApproachStartTime } from './inspectionMode';

describe('ISS inspection mode', () => {
  it('enters, exits, and repeats without changing the orbital property or clock', () => {
    const window = createVisualWindow(parseOrbitalWindow(orbitalPayload()));
    const positionProperty = window.position;
    const time = JulianDate.fromIso8601('2026-09-28T15:00:00Z');
    const before = modelPositionAt(window, time, new Cartesian3());
    let mode = INITIAL_VIEW_MODE;
    expect(mode).toBe('EARTH_OVERVIEW');
    for (let cycle = 0; cycle < 3; cycle++) {
      mode = nextViewMode(mode, 'ENTER');
      expect(mode).toBe('ENTERING_INSPECTION');
      mode = nextViewMode(mode, 'ENTRY_COMPLETE');
      expect(mode).toBe('ISS_INSPECTION');
      mode = nextViewMode(mode, 'EXIT');
      expect(mode).toBe('EXITING_INSPECTION');
      mode = nextViewMode(mode, 'EXIT_COMPLETE');
      expect(mode).toBe('EARTH_OVERVIEW');
    }
    expect(window.position).toBe(positionProperty);
    expect(modelPositionAt(window, time, new Cartesian3())).toEqual(before);
    expect(JulianDate.toIso8601(time)).toBe('2026-09-28T15:00:00Z');
  });

  it('keeps an explicit ENU camera frame at the sampled point', () => {
    const position = new Cartesian3(4_000_000, 3_000_000, 5_000_000);
    const frame = cameraTrackingFrame(position);
    expect(Matrix4.getTranslation(frame, new Cartesian3())).toEqual(position);
    const east = Matrix4.getColumn(frame, 0, new Cartesian4());
    expect(Cartesian3.dot(new Cartesian3(east.x, east.y, east.z), position)).toBeCloseTo(0, 5);
  });

  it('uses the current bounded sampled position as the camera target at every scene time', () => {
    const visual = createVisualWindow(parseOrbitalWindow(orbitalPayload()));
    const property = visual.position;
    const time = JulianDate.fromIso8601('2026-09-28T15:00:00Z');
    const iso = JulianDate.toIso8601(time);
    const first = modelPositionAt(visual, time, new Cartesian3());
    const later = modelPositionAt(visual, JulianDate.addSeconds(time, 2, new JulianDate()), new Cartesian3());
    expect(first).toBeDefined();
    expect(later).toBeDefined();
    expect(Cartesian3.distance(first!, later!)).toBeGreaterThan(10_000);
    expect(visual.position).toBe(property);
    expect(JulianDate.toIso8601(time)).toBe(iso);
    expect(modelPositionAt(visual, JulianDate.fromIso8601('2026-09-28T15:10:01Z'), new Cartesian3())).toBeUndefined();
  });

  it('converges through one moving ENU target and joins the inspection pivot', () => {
    const visual = createVisualWindow(parseOrbitalWindow(orbitalPayload()));
    const start = new Cartesian3(0, 0, 16_000_000);
    const end = inspectionCartesianOffset(Math.PI / 5, -Math.PI / 18, 340, new Cartesian3());
    expect(Cartesian3.magnitude(end)).toBeCloseTo(340);
    const offset = new Cartesian3();
    let previousRange = Infinity;
    for (let step = 0; step <= 20; step++) {
      const p = step / 20;
      const time = JulianDate.addSeconds(JulianDate.fromIso8601('2026-09-28T15:00:00Z'), p * 5, new JulianDate());
      const target = modelPositionAt(visual, time, new Cartesian3())!;
      const frame = cameraTrackingFrame(target);
      const camera = Matrix4.multiplyByPoint(frame, movingApproachOffset(start, end, p, offset), new Cartesian3());
      const range = Cartesian3.distance(camera, target);
      expect(range).toBeLessThanOrEqual(previousRange + 0.01);
      expect(earthOccludes(camera, target)).toBe(false);
      previousRange = range;
    }
    expect(movingApproachOffset(start, end, 0, offset)).toEqual(start);
    expect(movingApproachOffset(start, end, 1, offset)).toEqual(end);
    expect(previousRange).toBeCloseTo(340);
    expect(movingApproachPathClear(modelPositionAt(visual, JulianDate.fromIso8601('2026-09-28T15:00:00Z'), new Cartesian3())!, start, end)).toBe(true);
  });

  it('keeps an occulted acquisition path above Earth and clears line of sight', () => {
    const station = new Cartesian3(6_800_000, 0, 0);
    const start = new Cartesian3(-17_000_000, 0, 0);
    expect(earthOccludes(start, station)).toBe(true);
    const camera = new Cartesian3();
    for (let step = 0; step <= 20; step++) {
      radialAcquisitionPosition(start, station, step / 20, camera);
      expect(Cartesian3.magnitude(camera)).toBeGreaterThan(6_700_000);
    }
    expect(earthOccludes(camera, station)).toBe(false);
  });

  it('climbs before rotating a polar start across the equator', () => {
    const start = Cartesian3.fromDegrees(0, 85, 1_000);
    const station = Cartesian3.fromDegrees(180, 0, 420_000);
    const camera = new Cartesian3();
    expect(Cartesian3.distance(radialAcquisitionPosition(start, station, 0, camera), start)).toBeLessThan(0.001);
    for (let step = 1; step <= 100; step++) {
      radialAcquisitionPosition(start, station, step / 100, camera);
      expect(Ellipsoid.WGS84.cartesianToCartographic(camera)!.height).toBeGreaterThan(999);
    }
    expect(earthOccludes(camera, station)).toBe(false);
  });

  it('turns the camera through opposite directions without an undefined vector', () => {
    const direction = interpolateUnitDirection(new Cartesian3(1, 0, 0), new Cartesian3(-1, 0, 0), 0.5, new Cartesian3());
    expect(Cartesian3.magnitude(direction)).toBeCloseTo(1);
    expect(Math.abs(direction.x)).toBeLessThan(1e-10);
    expect(Number.isFinite(direction.y) && Number.isFinite(direction.z)).toBe(true);
  });

  it('keeps the minimum footprint unchanged; close framing comes from camera range', () => {
    expect(approachMinimumPixelSize(72, 0)).toBe(72);
    expect(approachMinimumPixelSize(72, 1)).toBe(72);
    let previous = 72;
    for (let step = 1; step <= 20; step++) {
      const size = approachMinimumPixelSize(72, step / 20);
      expect(size).toBeGreaterThanOrEqual(previous);
      previous = size;
    }
    expect(exitMinimumPixelSize(72, 150, 0)).toBe(150);
    expect(exitMinimumPixelSize(72, 150, 1)).toBe(72);
    expect(exitMinimumPixelSize(72, 120, 0.5)).toBe(96);
  });

  it('adopts a replacement sampled window without restarting camera progress', () => {
    const original = createVisualWindow(parseOrbitalWindow(orbitalPayload()));
    const payload = orbitalPayload();
    const samples = payload.samples as Array<{ xMeters: number }>;
    for (const sample of samples) sample.xMeters += 1_000;
    const replacement = createVisualWindow(parseOrbitalWindow(payload));
    const before = JulianDate.fromIso8601('2026-09-28T15:00:02Z');
    const after = JulianDate.fromIso8601('2026-09-28T15:00:06Z');
    const start = JulianDate.fromIso8601('2026-09-28T15:00:00Z');
    const oldElapsed = JulianDate.secondsDifference(before, start);
    rebaseApproachStartTime(start, before, after);
    expect(JulianDate.secondsDifference(after, start)).toBe(oldElapsed);
    expect(Cartesian3.distance(modelPositionAt(original, after, new Cartesian3())!,
      modelPositionAt(replacement, after, new Cartesian3())!)).toBeCloseTo(1_000);
    expect(original.position).not.toBe(replacement.position);
  });

  it('routes ISS representations from overview and only verified features in inspection', () => {
    const destiny = ISS_MODEL.semanticMappings[0];
    expect(pickAction('EARTH_OVERVIEW', { kind: 'iss-entity' }, true)).toBe('enter-inspection');
    expect(pickAction('EARTH_OVERVIEW', { kind: 'iss-model' }, true)).toBe('enter-inspection');
    expect(pickAction('EARTH_OVERVIEW', { kind: 'iss-feature', module: destiny }, true)).toBe('enter-inspection');
    expect(pickAction('EARTH_OVERVIEW', { kind: 'other' }, true)).toBe('none');
    expect(pickAction('EARTH_OVERVIEW', { kind: 'empty' }, true)).toBe('none');
    expect(pickAction('EARTH_OVERVIEW', { kind: 'iss-entity' }, false)).toBe('none');
    expect(pickAction('ISS_INSPECTION', { kind: 'iss-feature', module: destiny }, true)).toBe('select-module');
    expect(pickAction('ISS_INSPECTION', { kind: 'iss-feature', module: null }, true)).toBe('clear-module');
    expect(pickAction('ISS_INSPECTION', { kind: 'iss-model' }, true)).toBe('clear-module');
    expect(pickAction('ISS_INSPECTION', { kind: 'empty' }, true)).toBe('clear-module');
    expect(pickAction('ENTERING_INSPECTION', { kind: 'iss-feature', module: destiny }, true)).toBe('none');
  });

  it('restores controls and clears inspection on model failure or buffer expiry', () => {
    for (const lostTarget of ['failed', 'expired'] as const) {
      let mode = nextViewMode(INITIAL_VIEW_MODE, 'ENTER');
      mode = nextViewMode(mode, 'ENTRY_COMPLETE');
      expect(canInspect(lostTarget === 'failed' ? 'failed' : 'ready', lostTarget !== 'expired')).toBe(false);
      mode = nextViewMode(mode, 'EXIT');
      expect(inspectionPresentation(mode)).toEqual({ pathVisible: true, locatorVisible: true, backVisible: false });
      expect(nextViewMode(mode, 'EXIT_COMPLETE')).toBe('EARTH_OVERVIEW');
    }
    expect(canInspect('ready', true)).toBe(true);
    expect(inspectionPresentation('EARTH_OVERVIEW')).toEqual({ pathVisible: true, locatorVisible: true, backVisible: false });
    expect(inspectionPresentation('ISS_INSPECTION')).toEqual({ pathVisible: false, locatorVisible: false, backVisible: true });
  });
});
