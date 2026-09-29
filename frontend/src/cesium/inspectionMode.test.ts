import { describe, expect, it } from 'vitest';
import { Cartesian3, Cartesian4, JulianDate, Matrix4 } from 'cesium';
import { orbitalPayload } from '../test/orbitalFixture';
import { parseOrbitalWindow } from '../orbital/sampleMapping';
import { createVisualWindow, modelPositionAt } from './visualWindow';
import { ISS_MODEL } from './modelPresentation';
import { approachTargetAt, canInspect, cameraTrackingFrame, closeApproachPose, INITIAL_VIEW_MODE, inspectionPresentation, nextViewMode, pickAction } from './inspectionMode';

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

  it('targets the bounded future sampled position without changing sample or scene time', () => {
    const visual = createVisualWindow(parseOrbitalWindow(orbitalPayload()));
    const property = visual.position;
    const time = JulianDate.fromIso8601('2026-09-28T15:00:00Z');
    const iso = JulianDate.toIso8601(time);
    const expected = modelPositionAt(visual, JulianDate.addSeconds(time, 3.6, new JulianDate()), new Cartesian3());
    expect(approachTargetAt(visual, time, 3.6)).toEqual(expected);
    expect(visual.position).toBe(property);
    expect(JulianDate.toIso8601(time)).toBe(iso);
    expect(approachTargetAt(visual, JulianDate.fromIso8601('2026-09-28T15:09:59Z'), 3.6)).toBeUndefined();
  });

  it('joins the moving close approach at its starting pose and finishes at the inspection offset', () => {
    const start = { heading: -2.9, pitch: 0.15, range: 60_000 };
    const end = { heading: 0.61, pitch: -0.17, range: 340 };
    expect(closeApproachPose(start, end, 0)).toEqual(start);
    const middle = closeApproachPose(start, end, 0.5);
    expect(middle.range).toBeLessThan(start.range);
    expect(middle.range).toBeGreaterThan(end.range);
    expect(closeApproachPose(start, end, 1).range).toBeCloseTo(end.range);
    expect(closeApproachPose(start, end, 1).pitch).toBeCloseTo(end.pitch);
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
