import { convexFootprint, footprintDistance } from '../test/trajectoryReference';
import { describe, expect, it } from 'vitest';
import { BoundingSphere, Cartesian3, JulianDate, Matrix4, type Model, type Scene } from 'cesium';
import { makeSampledPosition } from './sampleProperty';
import { desiredGapCssPixels, displayedModelNearDepth, earliestClearTime, initialRegion, initialRegionDistance, segmentDistance, protectedCircle } from './trajectoryClearance';

const hull = convexFootprint([{ x: -10, y: -10 }, { x: 10, y: -10 }, { x: 10, y: 10 }, { x: -10, y: 10 }]);
describe('screen-space source-specific trajectory clearance', () => {
  it.each([Cartesian3.UNIT_X, Cartesian3.UNIT_Y, Cartesian3.UNIT_Z])(
    'uses positive camera depth and the enhanced displayed sphere for globe visibility %j', direction => {
      const center = Cartesian3.multiplyByScalar(direction, 10_000_000, new Cartesian3());
      const model = { boundingSphere: new BoundingSphere(center, 70), scale: 1,
        minimumPixelSize: 120, maximumScale: 1000, modelMatrix: Matrix4.fromTranslation(center) } as Model;
      const scene = { drawingBufferWidth: 2560, drawingBufferHeight: 1440,
        camera: { positionWC: Cartesian3.ZERO, directionWC: direction, getPixelSize: () => 100 } } as unknown as Scene;
      expect(displayedModelNearDepth(scene, model)).toBe(10_000_000 - 6000);
      expect(model.boundingSphere.center).toEqual(center);
      expect(model.scale).toBe(1);
    });
  it('respects maximum display scale and keeps a camera-plane intersection conservative', () => {
    const model = { boundingSphere: new BoundingSphere(new Cartesian3(0, 0, 500), 70),
      scale: 1, minimumPixelSize: 120, maximumScale: 10,
      modelMatrix: Matrix4.fromTranslation(new Cartesian3(0, 0, 500)) } as Model;
    const scene = { drawingBufferWidth: 2560, drawingBufferHeight: 1440,
      camera: { positionWC: Cartesian3.ZERO, directionWC: Cartesian3.UNIT_Z, getPixelSize: () => 100 } } as unknown as Scene;
    expect(displayedModelNearDepth(scene, model)).toBe(-200);
    model.minimumPixelSize = 0;
    expect(displayedModelNearDepth(scene, model)).toBe(430);
  });
  it('includes the minimum-pixel shift of an off-origin asset without moving physical values', () => {
    const model = { boundingSphere: new BoundingSphere(new Cartesian3(0, 0, 10_000), 70),
      scale: 1, minimumPixelSize: 20, maximumScale: 1000,
      modelMatrix: Matrix4.fromTranslation(new Cartesian3(0, 0, 10_020)) } as Model;
    const scene = { drawingBufferWidth: 2560, drawingBufferHeight: 1440,
      camera: { positionWC: Cartesian3.ZERO, directionWC: Cartesian3.UNIT_Z, getPixelSize: () => 100 } } as unknown as Scene;
    expect(displayedModelNearDepth(scene, model)).toBeCloseTo(10_020 - 20 * (1000 / 70) - 1000);
    expect(model.boundingSphere.center.z).toBe(10_000);
    expect(model.modelMatrix[14]).toBe(10_020);
  });
  it('smoothly decreases with selected ISS range, within bounds', () => {
    const far = desiredGapCssPixels(17_000_000), medium = desiredGapCssPixels(6_000_000), close = desiredGapCssPixels(1_500_000);
    expect(far).toBeGreaterThan(medium); expect(medium).toBeGreaterThan(close); expect(close).toBeGreaterThan(0);
    const gaps = Array.from({ length: 101 }, (_, i) => desiredGapCssPixels(100 + i * 400_000));
    expect(gaps.every((g, i) => g >= 0.75 && g <= 4 && (i === 0 || g >= gaps[i - 1]))).toBe(true);
    expect(desiredGapCssPixels(0)).toBe(0.75);
    expect(desiredGapCssPixels(1e12)).toBe(4);
    expect(desiredGapCssPixels(2_000_001) - 0.75).toBeLessThan(1e-9);
    expect(4 - desiredGapCssPixels(16_999_999)).toBeLessThan(1e-9);
  });
  it('measures the footprint edge rather than only model center', () => {
    expect(footprintDistance({ x: 0, y: 0 }, hull)).toBe(0);
    expect(footprintDistance({ x: 13, y: 14 }, hull)).toBe(5);
    expect(footprintDistance({ x: 10, y: 10 }, hull)).toBe(0);
  });
  it('does not mask empty corners of a rotated footprint as an axis-aligned box would', () => {
    const diamond = convexFootprint([{ x: 0, y: -10 }, { x: 10, y: 0 }, { x: 0, y: 10 }, { x: -10, y: 0 }]);
    expect(footprintDistance({ x: 8, y: 8 }, diamond)).toBeCloseTo(6 / Math.sqrt(2));
    expect(footprintDistance({ x: 5, y: 5 }, diamond)).toBe(0);
  });
  it('finds the genuine temporal start with sub-sample precision', () => {
    const radius = 4 + 0.5;
    const start = earliestClearTime(1, 60_000, [0, 30_000, 60_000], ms => ({ x: ms / 1000, y: 0 }), hull, radius)!;
    expect(start - (Math.sqrt(200) + radius) * 1000).toBeGreaterThanOrEqual(0);
    expect(start - (Math.sqrt(200) + radius) * 1000).toBeLessThanOrEqual(2);
    expect(start).not.toBe(30_000);
    expect(footprintDistance({ x: start / 1000, y: 0 }, hull)).toBeGreaterThanOrEqual(radius);
  });
  it('uses each bounded source property and never creates a new spatial curve', () => {
    // Synthetic TEST paths with different rates; no real ISS claim.
    const make = (rate: number) => makeSampledPosition([0, 30, 60].map(t => ({
      time: new Date(t * 1000).toISOString(), xMeters: t * rate, yMeters: 0, zMeters: 0,
    })));
    const starts = [1, 2].map(rate => {
      const property = make(rate);
      const pixelAt = (ms: number) => { const p = property.getValue(JulianDate.fromDate(new Date(ms)), new Cartesian3()); return p ? { x: p.x, y: p.y } : null; };
      const start = earliestClearTime(1, 60_000, [0, 30_000, 60_000], pixelAt, hull, 12)!;
      expect(pixelAt(start)!.x).toBeCloseTo(Math.sqrt(200) + 12, 2);
      expect(property.getValue(JulianDate.fromDate(new Date(30_000)))!.x).toBe(30 * rate);
      expect(property.getValue(JulianDate.fromDate(new Date(60_001)))).toBeUndefined();
      return start;
    });
    expect(Math.abs(starts[0] - starts[1] * 2)).toBeLessThan(2); // <=1ms search precision per source.
  });
  it('returns no local exit without covered valid projection rather than extrapolating', () => {
    expect(earliestClearTime(1, 5000, [0, 30_000], ms => ({ x: ms / 1000, y: 0 }), hull, 12)).toBeNull();
    expect(earliestClearTime(1, 5000, [], () => null, hull, 12)).toBeNull();
    expect(earliestClearTime(5000, 5000, [], () => ({ x: 100, y: 0 }), hull, 12)).toBeNull();
  });
  it('skips an upstream fragment already clear of the lifted displayed hull', () => {
    // Synthetic TEST projection: displayed station at x=0, real source at x=-80.
    // Old radial-distance search accepted t=1ms, revealing both sides of the ISS.
    for (const rate of [1, 1.1]) {
      const pixelAt = (ms: number) => ({ x: -80 + rate * ms / 1000, y: 0 });
      const start = earliestClearTime(1, 120_000, [0, 30_000, 60_000, 90_000, 120_000], pixelAt, hull, 1.25)!;
      expect(start).toBeGreaterThan(80_000 / rate);
      expect(pixelAt(start).x).toBeGreaterThanOrEqual(Math.sqrt(200) + 1.25);
      expect(footprintDistance(pixelAt(start), hull)).toBeGreaterThanOrEqual(1.25);
      expect(start - (80 + Math.sqrt(200) + 1.25) * 1000 / rate).toBeLessThanOrEqual(1);
    }
  });
  it('uses the actual projected future direction for rotated and lifted poses', () => {
    for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 3]) {
      const dx = Math.cos(angle), dy = Math.sin(angle);
      const support = Math.max(...hull.map(p => p.x * dx + p.y * dy));
      const scratch = { x: 0, y: 0 };
      const pixelAt = (ms: number) => { scratch.x = dx * (-80 + ms / 1000); scratch.y = dy * (-80 + ms / 1000); return scratch; };
      const start = earliestClearTime(1, 120_000, [0, 30_000, 60_000, 90_000, 120_000], pixelAt, hull, 2)!;
      const point = pixelAt(start);
      expect(point.x * dx + point.y * dy).toBeGreaterThanOrEqual(support + 2 - 1e-9);
      expect(footprintDistance(point, hull)).toBeGreaterThanOrEqual(2 - 1e-9);
    }
  });
  it('does not render a stale start during reveal or partial Back at any checkpoint', () => {
    for (const checkpoint of [0.1, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95]) {
        const shifted = hull.map(p => ({ x: p.x + checkpoint * 80, y: p.y }));
        const start = earliestClearTime(1, 120_000, [0, 30_000, 60_000, 90_000, 120_000], ms => ({ x: ms / 1000, y: 0 }), shifted, 1)!;
        expect(start / 1000).toBeGreaterThanOrEqual(checkpoint * 80 + Math.sqrt(200) + 1);
      }
  });
  it('returns no local exit without covered projected motion', () => {
    expect(earliestClearTime(1, 60_000, [0, 30_000], () => ({ x: 50, y: 0 }), hull, 1)).toBeNull();
    expect(earliestClearTime(1, 60_000, [0, 30_000], ms => ({ x: -80 + ms / 1000, y: 0 }), hull, 1)).toBeNull();
  });
  it('finds the first exit before an invalid camera-plane projection in the same sample interval', () => {
    // Synthetic TEST screen projection: covered future positions, finite until
    // the camera plane at 50s; the 60s sample itself cannot be projected.
    let calls = 0;
    const at = (ms: number) => { calls++; return ms < 50_000 ? { x: ms / 1000, y: 0 } : null; };
    const first = earliestClearTime(0, 90_000, [0,60_000,90_000], at, hull, 2)!;
    expect(first).toBeGreaterThanOrEqual((Math.sqrt(200)+2)*1000);
    expect(first).toBeLessThan((Math.sqrt(200)+2)*1000+1);
    expect(calls).toBeLessThan(45);
    expect(earliestClearTime(0, 90_000, [0,60_000,90_000], ms => ms < 50_000 ? {x:0,y:0} : null, hull, 2)).toBeNull();
  });
  it('finds the first exit and ignores later reentries', () => {
    // Synthetic TEST path: initial inside -> exit -> reentry -> exit.
    const at = (ms: number) => ({ x: ms <= 30_000 ? ms / 1000 : 30 - (ms - 30_000) / 1000, y: 0 });
    const exit = earliestClearTime(0, 90_000, [0, 30_000, 60_000, 90_000], at, hull, 2)!;
    expect(exit).toBeGreaterThanOrEqual((Math.sqrt(200) + 2) * 1000);
    expect(exit).toBeLessThan((Math.sqrt(200) + 2) * 1000 + 1);
    expect(earliestClearTime(0, 30_000, [0, 30_000], at, hull, 2)).toBe(exit);
  });
  it('handles tiny, zero, reversed initial projections without direction normalization', () => {
    const starts = [-1e-8, 0, 1e-8].map(noise => earliestClearTime(0, 60_000,
      [0, 10_000, 30_000, 60_000], ms => ({ x: ms <= 10_000 ? noise * ms / 10_000 : (ms - 10_000) / 1000, y: 0 }), hull, 2)!);
    expect(starts.every(Number.isFinite)).toBe(true);
    expect(Math.max(...starts) - Math.min(...starts)).toBeLessThanOrEqual(1);
    expect(starts[0]).toBeCloseTo(10_000 + (Math.sqrt(200) + 2) * 1000, 0);
  });
  it('bounds the search to the local interval even with a full orbital epoch grid', () => {
    let calls = 0;
    expect(earliestClearTime(0, 2000, Array.from({length:181},(_,i)=>i*30_000), () => {
      calls++; return {x:0,y:0};
    }, hull, 2)).toBeNull();
    expect(calls).toBe(2);
  });
  it('uses the second camera projection immediately, without a held previous gap', () => {
    const first = earliestClearTime(0, 120_000, [30_000,60_000,90_000], ms=>({x:ms/1000,y:0}), hull, 2)!;
    const second = earliestClearTime(0, 120_000, [30_000,60_000,90_000], ms=>({x:ms/500,y:0}), hull, 2)!;
    expect(second).toBeCloseTo(first/2, 0);
    expect(earliestClearTime(0, 120_000, [30_000,60_000,90_000], ms=>({x:ms/500,y:0}), hull, 2)).toBe(second);
  });
  it('rejects nonfinite local projections without NaN uniforms', () => {
    for (const x of [NaN, Infinity, -Infinity])
      expect(earliestClearTime(0, 60_000, [30_000], () => ({x,y:0}), hull, 1)).toBeNull();
  });
  it('encloses the footprint in a curved compact shape and leaves the far trail clear', () => {
    const c = protectedCircle(hull,{x:0,y:0,radius:0});
    expect(c).toEqual({x:0,y:0,radius:Math.sqrt(200)});
    for (const p of hull) expect(Math.hypot(p.x-c.x,p.y-c.y)).toBeLessThanOrEqual(c.radius);
    expect(Math.hypot(100-c.x,100-c.y)).toBeGreaterThan(c.radius+2);
    const shifted = hull.map(p=>({x:p.x+40,y:p.y-20}));
    expect(protectedCircle(shifted,c)).toEqual({x:40,y:-20,radius:Math.sqrt(200)});
  });
  it('bounds mathematical segment capsule coverage at sides, caps and joins', () => {
    expect(segmentDistance({x:5,y:0},0,0,10,0)).toBe(0);
    expect(segmentDistance({x:5,y:2},0,0,10,0)).toBe(2);
    expect(segmentDistance({x:-2,y:0},0,0,10,0)).toBe(2);
    expect(segmentDistance({x:-3,y:4},0,0,10,0)).toBe(5);
    expect(segmentDistance({x:10,y:0},0,0,10,0)).toBe(0);
    expect(segmentDistance({x:10,y:0},10,0,10,10)).toBe(0);
    expect(segmentDistance({x:0,y:0},0,0,0,0)).toBe(0);
  });
  it('protects the initial lifted-source approach but releases later reentries to the station circle', () => {
    const region = initialRegion(hull, {x:-80,y:0}, 2,
      {x:0,y:0,radius:0,ax:0,ay:0,tx:0,ty:0,ux:0,uy:0,external:false});
    expect(initialRegionDistance({x:-40,y:0},region)).toBeLessThan(0);
    expect(initialRegionDistance({x:-40,y:40},region)).toBeGreaterThan(0);
    expect(initialRegionDistance({x:region.radius,y:0},region)).toBeCloseTo(0);
    // After the first exit, a genuine later sample here is outside the circle.
    // It must survive even though it lies in the initial approach triangle.
    expect(Math.hypot(-40-region.x,region.y)-region.radius).toBeGreaterThan(0);
  });
});
