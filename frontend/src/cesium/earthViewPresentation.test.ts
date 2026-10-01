import { describe, expect, it } from 'vitest';
import { Cartesian3, Ellipsoid, Color } from 'cesium';
import { ISS_MODEL } from './modelPresentation';
import { applyModelSilhouette, displayLiftForMode, DISPLAY_LIFT_REMOVAL_FRACTION, EARTH_OVERVIEW_DISPLAY_LIFT_METERS, enteringDisplayLift, modelDisplayPosition, returningDisplayLift, silhouetteForMode, OVERVIEW_SILHOUETTE } from './earthViewPresentation';

describe('physical and display Earth View positions', () => {
  it('shrinks only the Overview minimum footprint, preserving asset scale and scale limit', () => {
    expect(ISS_MODEL.displayMinimumPixelSize).toBe(80);
    expect(ISS_MODEL.physicalScale).toBe(1);
    expect(ISS_MODEL.displayMaximumScale).toBe(20000);
  });
  it('lifts along the selected point normal without mutating either source position or geodetic altitude', () => {
    for (const physical of [Cartesian3.fromDegrees(12, 42, 420000), Cartesian3.fromDegrees(-120, -51, 430000)]) {
      const before = Cartesian3.clone(physical);
      const altitude = Ellipsoid.WGS84.cartesianToCartographic(physical)!.height;
      const display = modelDisplayPosition(physical, EARTH_OVERVIEW_DISPLAY_LIFT_METERS, new Cartesian3());
      const normal = Ellipsoid.WGS84.geodeticSurfaceNormal(physical, new Cartesian3());
      const displacement = Cartesian3.subtract(display, physical, new Cartesian3());
      expect(Cartesian3.magnitude(displacement)).toBeCloseTo(75000, 6);
      expect(Cartesian3.angleBetween(displacement, normal)).toBeCloseTo(0, 7);
      expect(physical).toEqual(before);
      expect(Ellipsoid.WGS84.cartesianToCartographic(physical)!.height).toBe(altitude);
      expect(modelDisplayPosition(physical, 0, new Cartesian3())).toEqual(physical);
    }
  });
  it('rejects an aliased display output before it can mutate canonical physics', () => {
    const physical = Cartesian3.fromDegrees(12, 42, 420000);
    const before = Cartesian3.clone(physical);
    expect(() => modelDisplayPosition(physical, 75000, physical)).toThrow('canonical physical position');
    expect(physical).toEqual(before);
  });
  it('has zero lift in Inspection and smoothly removes Overview lift before close approach', () => {
    expect(displayLiftForMode('EARTH_OVERVIEW', null, null)).toBe(75000);
    expect(displayLiftForMode('ISS_INSPECTION', 0, {startLift:75000, progress:0})).toBe(0);
    expect(enteringDisplayLift(0)).toBe(75000);
    expect(enteringDisplayLift(DISPLAY_LIFT_REMOVAL_FRACTION)).toBe(0);
    expect(enteringDisplayLift(1)).toBe(0);
    const lifts = Array.from({length:101}, (_, i) => displayLiftForMode('ENTERING_INSPECTION', i / 100, null));
    expect(lifts.every((lift, i) => lift >= 0 && (i === 0 || lift <= lifts[i-1]))).toBe(true);
    // Zero slopes avoid a position pop at both ends of the removal curve.
    expect(75000 - enteringDisplayLift(0.00001)).toBeLessThan(0.001);
    expect(enteringDisplayLift(DISPLAY_LIFT_REMOVAL_FRACTION - 0.00001)).toBeLessThan(0.001);
  });
  it('restores lift continuously on Back, including interruption partway through entry', () => {
    for (const startLift of [0, enteringDisplayLift(0.1), 75000]) {
      expect(returningDisplayLift(startLift, 0)).toBe(startLift);
      expect(displayLiftForMode('EXITING_INSPECTION', null, {startLift,progress:1})).toBe(75000);
      expect(returningDisplayLift(startLift, 0.5)).toBeCloseTo((startLift + 75000) / 2);
    }
  });
  it('keeps the thin white perimeter in Overview and removes it smoothly for Inspection', () => {
    const overview = silhouetteForMode('EARTH_OVERVIEW', null, null);
    expect(overview.sizePixels).toBe(OVERVIEW_SILHOUETTE.sizePixels);
    expect(overview.alpha).toBe(OVERVIEW_SILHOUETTE.alpha);
    expect(overview.sizePixels).toBeGreaterThan(0);
    expect(silhouetteForMode('ISS_INSPECTION', null, null)).toEqual({ sizePixels: 0, alpha: 0, visibility: 0 });
    const entering = Array.from({ length: 101 }, (_, i) => silhouetteForMode('ENTERING_INSPECTION', i / 100, null).visibility);
    expect(entering[0]).toBe(1); expect(entering[35]).toBe(0);
    expect(entering.every((v, i) => i === 0 || v <= entering[i - 1])).toBe(true);
    const interrupted = silhouetteForMode('ENTERING_INSPECTION', 0.1, null).visibility;
    expect(silhouetteForMode('EXITING_INSPECTION', null, { startVisibility: interrupted, progress: 0 }).visibility).toBe(interrupted);
    expect(silhouetteForMode('EXITING_INSPECTION', null, { startVisibility: interrupted, progress: 1 }).visibility).toBe(1);
  });
});

describe('retained silhouette pipeline', () => {
  it('keeps an invisible outline and one-sided geometry without crossing the shader-size boundary', () => {
    const model = { silhouetteSize: 0.5, silhouetteColor: Color.WHITE.withAlpha(0.12), backFaceCulling: false };
    applyModelSilhouette(model, silhouetteForMode('ISS_INSPECTION', null, null));
    expect(model.silhouetteSize).toBeGreaterThan(0);
    expect(model.silhouetteSize).toBeLessThan(0.00001);
    expect(model.silhouetteColor.alpha).toBeGreaterThan(0);
    expect(model.silhouetteColor.alpha).toBeLessThan(1e-10);
    expect(model.backFaceCulling).toBe(true);
    applyModelSilhouette(model, silhouetteForMode('EARTH_OVERVIEW', null, null));
    expect(model.silhouetteSize).toBe(0.5);
    expect(model.silhouetteColor.alpha).toBe(0.12);
    expect(model.backFaceCulling).toBe(false);
  });
});
