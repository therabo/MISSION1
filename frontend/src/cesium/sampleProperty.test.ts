import { describe, expect, it } from 'vitest';
import { Cartesian3, Ellipsoid, JulianDate, Math as CesiumMath, ReferenceFrame } from 'cesium';
import { parseOrbitalWindow } from '../orbital/sampleMapping';
import { orbitalPayload } from '../test/orbitalFixture';
import { makePositionProperty } from './sampleProperty';

describe('Cesium fixed-frame temporal mapping', () => {
  const window = parseOrbitalWindow(orbitalPayload());

  it('uses FIXED Cartesian meters, linear interpolation and no extrapolation', () => {
    const property = makePositionProperty(window);
    expect(property.referenceFrame).toBe(ReferenceFrame.FIXED);
    const middle = property.getValueInReferenceFrame(JulianDate.fromIso8601('2026-09-28T14:59:55Z'), ReferenceFrame.FIXED);
    expect(middle?.x).toBeCloseTo((window.response.samples[0].xMeters + window.response.samples[1].xMeters) / 2, 5);
    expect(property.getValue(JulianDate.fromIso8601('2026-09-28T14:59:49Z'))).toBeUndefined();
    expect(property.getValue(JulianDate.fromIso8601('2026-09-28T15:00:11Z'))).toBeUndefined();
  });

  it('agrees with backend WGS84 for a deterministic verified-TLE sample', () => {
    const sample = window.response.samples[1];
    const backend = window.response.currentGeodetic;
    const cartographic = Ellipsoid.WGS84.cartesianToCartographic(new Cartesian3(sample.xMeters, sample.yMeters, sample.zMeters));
    expect(cartographic).toBeDefined();
    const latDifference = Math.abs(CesiumMath.toDegrees(cartographic!.latitude) - backend.latitudeDegrees);
    const lonDifference = Math.abs(CesiumMath.toDegrees(cartographic!.longitude) - backend.longitudeDegrees);
    const heightDifference = Math.abs(cartographic!.height - backend.altitudeMeters);
    console.log(`COORDINATE_CHECK latDeg=${latDifference.toExponential(6)} lonDeg=${lonDifference.toExponential(6)} heightM=${heightDifference.toExponential(6)}`);
    expect(latDifference).toBeLessThan(0.0001);
    expect(lonDifference).toBeLessThan(0.0001);
    expect(heightDifference).toBeLessThan(1);
  });
});
