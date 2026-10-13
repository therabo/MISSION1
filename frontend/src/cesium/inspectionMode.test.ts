import { modelPositionAt } from '../test/visualSample';
import { describe, expect, it } from 'vitest';
import { Cartesian3, JulianDate } from 'cesium';
import { orbitalPayload } from '../test/orbitalFixture';
import { parseOrbitalWindow } from '../orbital/sampleMapping';
import { createVisualWindow } from './visualWindow';
import { ISS_MODEL } from './modelPresentation';
import { canInspect, INITIAL_VIEW_MODE, inspectionPresentation, interpolateUnitDirection, nextViewMode, pickAction } from './inspectionMode';

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




  it('turns the camera through opposite directions without an undefined vector', () => {
    const direction = interpolateUnitDirection(new Cartesian3(1, 0, 0), new Cartesian3(-1, 0, 0), 0.5, new Cartesian3());
    expect(Cartesian3.magnitude(direction)).toBeCloseTo(1);
    expect(Math.abs(direction.x)).toBeLessThan(1e-10);
    expect(Number.isFinite(direction.y) && Number.isFinite(direction.z)).toBe(true);
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
