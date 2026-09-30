import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { GeometryInstance, PolylineGeometry } from 'cesium';
import { fixture } from '../test/comparisonFixture';
import { parseComparison } from '../orbital/comparison';
import { createTrajectoryTrails, FORWARD_TRAIL, forwardBounds, forwardOpacity, updateTrail } from './trajectoryRendering';
beforeAll(() => { for (const name of ['HTMLCanvasElement', 'HTMLImageElement', 'ImageBitmap', 'OffscreenCanvas']) vi.stubGlobal(name, class {}); });
afterAll(() => vi.unstubAllGlobals());

describe('future only continuous trajectories', () => {
  it('has a bounded genuine future gap, common 85% horizon and no rendered past or closure', () => {
    const now = Date.parse(fixture(true).generatedAt);
    const bounds = forwardBounds(now, 5580, now + 5580_000);
    expect(bounds.startMs).toBeGreaterThan(now);
    expect((bounds.startMs-now)/1000).toBeGreaterThanOrEqual(10);
    expect((bounds.startMs-now)/1000).toBeLessThanOrEqual(40);
    expect((bounds.endMs-now)/5580_000).toBeCloseTo(0.85);
    expect(forwardOpacity(now-1, bounds.startMs, bounds.endMs)).toBe(0);
    expect(forwardOpacity(now, bounds.startMs, bounds.endMs)).toBe(0);
    expect(forwardOpacity(bounds.endMs+1, bounds.startMs, bounds.endMs)).toBe(0);
    const alphas = Array.from({length:101},(_,i)=>forwardOpacity(bounds.startMs+i*(bounds.endMs-bounds.startMs)/100,bounds.startMs,bounds.endMs));
    expect(alphas[0]).toBe(1); expect(alphas[100]).toBe(0);
    expect(alphas.every((alpha,i)=>i===0 || alpha<=alphas[i-1])).toBe(true);
    expect(alphas[50]).toBeCloseTo(0.5);
  });
  it('ends and dissolves at real partial OEM coverage without invented remaining samples', () => {
    const now = Date.parse(fixture(true).generatedAt);
    const stop = now+900_000;
    const bounds = forwardBounds(now,5580,stop);
    expect(bounds.endMs).toBe(stop);
    expect(forwardOpacity(stop,bounds.startMs,bounds.endMs)).toBe(0);
  });
  it('preserves both exact centerlines and reuses geometry while colors and temporal clipping swap', () => {
    const response = parseComparison(fixture(true));
    response.oem.samples = response.oem.samples.map((sample)=>({...sample,xMeters:sample.xMeters+3000}));
    const group = createTrajectoryTrails(response);
    expect(group.trails).toHaveLength(2);
    const now=Date.parse(response.generatedAt);
    for (const trail of group.trails) {
      const samples=trail.source==='NASA_OEM'?response.oem.samples:response.primary.samples;
      expect(trail.positions.map((p)=>p.x)).toEqual(samples.map((p)=>p.xMeters));
      expect(trail.positions).toHaveLength(181);
      expect(trail.positions[0]).not.toEqual(trail.positions[180]);
      const vertices=trail.layers.map(({primitive})=> Array.from(PolylineGeometry.createGeometry((primitive.geometryInstances as GeometryInstance).geometry as unknown as PolylineGeometry)!.attributes.position!.values!));
      expect(vertices[0]).toEqual(vertices[1]);
      const primitives=trail.layers.map((layer)=>layer.primitive);
      updateTrail(trail,now,'PRIMARY_GP_TLE');
      const alpha=trail.layers[1].material.uniforms.maximumAlpha;
      updateTrail(trail,now+10_000,'NASA_OEM');
      expect(trail.layers.map((layer)=>layer.primitive)).toEqual(primitives);
      expect(trail.layers[1].material.uniforms.maximumAlpha).toBe(trail.source==='NASA_OEM'?FORWARD_TRAIL.activeAlpha:FORWARD_TRAIL.inactiveAlpha);
      expect(trail.layers[1].material.uniforms.maximumAlpha).not.toBe(alpha);
      expect(trail.layers[1].material.uniforms.forwardStart).toBeCloseTo(50/5580);
      for(const layer of trail.layers){layer.primitive.destroy();layer.material.destroy();}
    }
  });
});
