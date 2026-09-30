import { describe, expect, it } from 'vitest';
import { Cartesian3, JulianDate, Matrix4 } from 'cesium';
import { fixture } from '../test/comparisonFixture';
import { parseComparison } from '../orbital/comparison';
import { parseOrbitalWindow } from '../orbital/sampleMapping';
import { orbitalPayload } from '../test/orbitalFixture';
import { createVisualWindow } from './visualWindow';
import { cameraTrackingFrame } from './inspectionMode';
import { comparisonCanReplace, DEFAULT_TRAJECTORY_SOURCE, effectiveSource, oemPositionProperty, oemUnavailableReason, requestedSource, selectedPositionAt, SOURCE_LABELS } from './trajectorySelection';

function setup() {
  const response = parseComparison(fixture(true));
  // Synthetic test-only aligned motion; never a runtime fallback.
  const payload = orbitalPayload();
  payload.generatedAt = response.generatedAt;
  payload.windowStart = response.primary.samples[0].time;
  const time = Date.parse(response.generatedAt);
  payload.windowEnd = new Date(time + 20_000).toISOString();
  payload.stepSeconds = 10;
  payload.samples = [0, 10, 20].map((seconds) => ({ time: new Date(time + seconds * 1000).toISOString(), xMeters: 6_800_000, yMeters: seconds * 1000, zMeters: 0 }));
  const primary = createVisualWindow(parseOrbitalWindow(payload, 0));
  response.oem.samples = response.oem.samples.map((sample) => ({...sample, xMeters:sample.xMeters + 3000}));
  return { response, primary, oem: oemPositionProperty(response), time: JulianDate.fromIso8601(response.generatedAt), sceneMs: time };
}

describe('selected physical position and camera target', () => {
  it('defaults to primary and switches both ways without cross-source interpolation or path mutation', () => {
    const {response, primary, oem, time, sceneMs} = setup();
    const before = JSON.stringify(response);
    expect(DEFAULT_TRAJECTORY_SOURCE).toBe('PRIMARY_GP_TLE');
    const source = requestedSource(DEFAULT_TRAJECTORY_SOURCE, 'NASA_OEM', 'EARTH_OVERVIEW', response, sceneMs);
    expect(source).toBe('NASA_OEM');
    expect(selectedPositionAt(source, primary, oem, time, new Cartesian3())).toEqual(oem.getValue(time));
    const back = requestedSource(source, 'PRIMARY_GP_TLE', 'EARTH_OVERVIEW', response, sceneMs);
    expect(selectedPositionAt(back, primary, oem, time, new Cartesian3())).toEqual(primary.position.getValue(time));
    expect(selectedPositionAt(source, primary, oem, time, new Cartesian3())).not.toEqual(primary.position.getValue(time));
    expect(JSON.stringify(response)).toBe(before);
    expect(SOURCE_LABELS[source]).toBe('NASA predicted ephemeris');
    expect(SOURCE_LABELS[back]).toBe('MISSION1 GP/TLE propagated state');
  });
  it('uses the same selected moving ENU pivot for approach and final Inspection; returning preserves the source', () => {
    const {primary, oem, time, response, sceneMs} = setup();
    for (const source of ['PRIMARY_GP_TLE', 'NASA_OEM'] as const) {
      for (const seconds of [0, 5, 10, 20]) {
        const epoch = JulianDate.addSeconds(time, seconds, new JulianDate());
        const position = selectedPositionAt(source, primary, oem, epoch, new Cartesian3())!;
        expect(Matrix4.getTranslation(cameraTrackingFrame(position), new Cartesian3())).toEqual(position);
      }
      for (const mode of ['ENTERING_INSPECTION', 'ISS_INSPECTION', 'EXITING_INSPECTION'] as const) {
        expect(requestedSource(source, source === 'NASA_OEM' ? 'PRIMARY_GP_TLE' : 'NASA_OEM', mode, response, sceneMs)).toBe(source);
      }
      expect(requestedSource(source, source, 'EARTH_OVERVIEW', response, sceneMs)).toBe(source);
    }
  });
  it('rejects unavailable, uncovered and expired OEM; explicitly resolves back to primary', () => {
    const {response, primary, oem, time, sceneMs} = setup();
    expect(oemUnavailableReason(response, sceneMs)).toBeNull();
    response.oem.availability = 'UNAVAILABLE';
    expect(effectiveSource('NASA_OEM', response, sceneMs)).toBe('PRIMARY_GP_TLE');
    expect(requestedSource('PRIMARY_GP_TLE', 'NASA_OEM', 'EARTH_OVERVIEW', response, sceneMs)).toBe('PRIMARY_GP_TLE');
    response.oem.availability = 'AVAILABLE';
    response.oem.samples = response.oem.samples.slice(1);
    expect(oemUnavailableReason(response, sceneMs)).toContain('does not cover');
    expect(oemUnavailableReason(null, sceneMs)).toContain('Waiting');
    expect(oemUnavailableReason(response, sceneMs + 301_000)).toContain('expired');
    expect(selectedPositionAt('NASA_OEM', primary, oem, JulianDate.addSeconds(time, 21, new JulianDate()), new Cartesian3())).toBeUndefined();
    expect(oem.getValue(JulianDate.addSeconds(time, -1, new JulianDate()))).toBeUndefined();
    expect(oem.getValue(JulianDate.addSeconds(time, 6000, new JulianDate()))).toBeUndefined();
  });
});

it('retains a valid moving OEM through a normal refresh clock seam, then adopts atomically', () => {
  const previous = parseComparison(fixture(true));
  const now = Date.parse(previous.generatedAt) + 120_000;
  const incoming = parseComparison(fixture(true));
  incoming.generatedAt = new Date(now+500).toISOString();
  for (const product of [incoming.primary,incoming.oem]) {
    product.samples = product.samples.map((sample)=>({...sample,time:new Date(Date.parse(sample.time)+120_500).toISOString()}));
  }
  expect(comparisonCanReplace(previous,incoming,now)).toBe(false);
  expect(effectiveSource('NASA_OEM',previous,now)).toBe('NASA_OEM');
  expect(comparisonCanReplace(previous,incoming,now+500)).toBe(true);
  expect(effectiveSource('NASA_OEM',incoming,now+500)).toBe('NASA_OEM');
  incoming.oem.availability='UNAVAILABLE';
  expect(comparisonCanReplace(previous,incoming,now)).toBe(true);
  incoming.oem.availability='DEGRADED';
  incoming.oem.samples=incoming.oem.samples.slice(2);
  expect(comparisonCanReplace(previous,incoming,now)).toBe(true);
});
