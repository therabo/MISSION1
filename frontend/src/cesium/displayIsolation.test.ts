import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Cartesian3, Ellipsoid, JulianDate, Matrix4, Transforms } from 'cesium';
import { parseComparison } from '../orbital/comparison';
import { parseOrbitalWindow } from '../orbital/sampleMapping';
import { createVisualWindow } from './visualWindow';
import { createTrajectoryTrails, updateTrail } from './trajectoryRendering';
import { cameraTrackingFrame } from './inspectionMode';
import { modelDisplayPosition } from './earthViewPresentation';
import { selectedPositionAt, oemPositionProperty } from './trajectorySelection';

// Recorded real-source observations, used only for deterministic offline tests.
const observation = (name: string) => JSON.parse(readFileSync(new URL(`../../../docs/frontend/trajectory-fix-review/real-${name}.json`, import.meta.url), 'utf8'));
beforeAll(() => { for (const name of ['HTMLCanvasElement', 'HTMLImageElement', 'ImageBitmap', 'OffscreenCanvas']) vi.stubGlobal(name, class {}); });
afterAll(() => vi.unstubAllGlobals());

describe('display lift isolation through selected source and renderer', () => {
  it.each(['PRIMARY_GP_TLE', 'NASA_OEM'] as const)('%s retains physical positions, timestamps, travel time, vertices and Inspection pivot', source => {
    const payload = observation('samples');
    const original = structuredClone(payload);
    const comparison = parseComparison(observation('comparison'));
    const orbital = parseOrbitalWindow(payload);
    const visual = createVisualWindow({ ...orbital, requestDurationMs: 0 });
    const oem = oemPositionProperty(comparison);
    const group = createTrajectoryTrails(comparison);
    const times = ['2026-09-30T15:45:59.875908Z', '2026-09-30T15:46:09.875908Z'].map(t => JulianDate.fromIso8601(t));
    const baseline = times.map(time => selectedPositionAt(source, visual, oem, time, new Cartesian3())!);
    const vertices = group.trails.map(t => t.positions.map(p => Cartesian3.clone(p)));
    const dt = JulianDate.secondsDifference(times[1], times[0]);
    const matrices: Matrix4[] = [];
    for (const lift of [0, 75000]) {
      for (const [i, time] of times.entries()) {
        const physical = selectedPositionAt(source, visual, oem, time, new Cartesian3())!;
        const altitude = Ellipsoid.WGS84.cartesianToCartographic(physical)!.height;
        const displayed = modelDisplayPosition(physical, lift, new Cartesian3());
        expect(physical).toEqual(baseline[i]);
        expect(Ellipsoid.WGS84.cartesianToCartographic(physical)!.height).toBe(altitude);
        expect(Cartesian3.distance(displayed, physical)).toBeCloseTo(lift, 6);
        expect(Matrix4.getTranslation(cameraTrackingFrame(physical), new Cartesian3())).toEqual(physical);
        if (i === 0) matrices.push(Transforms.eastNorthUpToFixedFrame(displayed));
      }
      expect(JulianDate.secondsDifference(times[1], times[0])).toBe(dt);
      for (const t of group.trails) { t.gapSeconds = lift === 0 ? 10 : 30; t.rampSeconds = 3; updateTrail(t, JulianDate.toDate(times[0]).getTime(), source); }
      expect(group.trails.map(t => t.positions)).toEqual(vertices);
      expect(payload).toEqual(original); // Epochs, lineage and all API physical values remain intact.
    }
    expect(matrices[0]).not.toEqual(matrices[1]);
    expect(dt).toBe(10);
    for (const t of group.trails) for (const layer of t.layers) { layer.primitive.destroy(); layer.material.destroy(); }
  });
  it('retains the physical backend velocity and epochs across display translation', () => {
    // Recorded production Orekit output at the same fixed UTC as the browser
    // evidence. Position is ITRF; velocity retains its explicitly separate TEME
    // frame. No velocity is derived from a displayed or interpolated position.
    const state = { propagationTime: '2026-09-30T15:45:59.875908Z', elementEpoch: '2026-09-29T02:38:28.580928Z',
      positionFrame: 'ITRF_2020_IERS_2010', velocityFrame: 'TEME',
      velocityMetersPerSecond: [-4102.317157042608, -2605.2896138119645, 5913.472896462791],
      positionMeters: new Cartesian3(-2739880.347441677, -6160206.766879415, -918032.7634609225) };
    const before = structuredClone(state), speed = Math.hypot(...state.velocityMetersPerSecond);
    for (const lift of [0, 75000]) {
      modelDisplayPosition(state.positionMeters, lift, new Cartesian3());
      expect(state).toEqual(before);
      expect(Math.hypot(...state.velocityMetersPerSecond)).toBe(speed);
    }
  });
});
