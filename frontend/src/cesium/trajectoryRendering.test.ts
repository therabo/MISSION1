import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Color, GeometryInstance, PolylineGeometry, PrimitiveCollection } from 'cesium';
import { fixture } from '../test/comparisonFixture';
import { parseComparison } from '../orbital/comparison';
import { createTrajectoryTrails, FORWARD_TRAIL, forwardBounds, forwardOpacity, orderTrails, TRAJECTORY_ACCENTS, updateTrail } from './trajectoryRendering';
beforeAll(() => { for (const name of ['HTMLCanvasElement', 'HTMLImageElement', 'ImageBitmap', 'OffscreenCanvas']) vi.stubGlobal(name, class {}); });
afterAll(() => vi.unstubAllGlobals());

describe('future only continuous trajectories', () => {
  it('softens the start with a deterministic Fabric smoothstep ramp, without a cap marker', () => {
    const group = createTrajectoryTrails(parseComparison(fixture(true)));
    for (const trail of group.trails) {
      trail.gapSeconds = 20; trail.rampSeconds = 4;
      updateTrail(trail, group.generatedMs, trail.source);
      const material = trail.layers[1].material;
      expect(material.uniforms.startRamp).toBeCloseTo(4 / 5580);
      expect(material.shaderSource).toContain('smoothstep');
      expect(material.shaderSource).toContain('abs(materialInput.st.t');
      expect(material.materials.clearanceMask.shaderSource).toContain('gl_FragCoord');
      expect(material.materials.clearanceMask.uniforms.footprintCount).toBe(0);
      expect(forwardOpacity(20_000, 20_000, 100_000, 4000)).toBe(0);
      expect(forwardOpacity(20_001, 20_000, 100_000, 4000)).toBeLessThan(0.000001);
      expect(forwardOpacity(22_000, 20_000, 100_000, 4000)).toBeCloseTo(0.5, 2);
      expect(trail.layers).toHaveLength(2);
      for (const layer of trail.layers) { layer.primitive.destroy(); layer.material.destroy(); }
    }
  });
  it('has a bounded genuine future gap, common 85% horizon and no rendered past or closure', () => {
    const now = Date.parse(fixture(true).generatedAt);
    const bounds = forwardBounds(now, 5580, now + 5580_000, 75);
    expect(bounds.startMs).toBeGreaterThan(now);
    expect((bounds.startMs-now)/1000).toBe(75);
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
    const bounds = forwardBounds(now,5580,stop, 75);
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
      trail.gapSeconds = 75; trail.rampSeconds = 12;
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
      expect(trail.layers[1].material.uniforms.forwardStart).toBeCloseTo(85/5580);
      for(const layer of trail.layers){layer.primitive.destroy();layer.material.destroy();}
    }
  });
  it('changes both retained appearance materials and collection order for each selected source', () => {
    const group = createTrajectoryTrails(parseComparison(fixture(true)));
    for (const trail of group.trails) { trail.gapSeconds = 75; trail.rampSeconds = 12; }
    const collection = new PrimitiveCollection({ destroyPrimitives: false });
    for (const trail of group.trails) for (const layer of trail.layers) collection.add(layer.primitive);
    const retained = group.trails.flatMap((trail) => trail.layers.map((layer) => layer.primitive));
    for (const selected of ['PRIMARY_GP_TLE', 'NASA_OEM', 'PRIMARY_GP_TLE'] as const) {
      for (const trail of group.trails) {
        trail.gapSeconds = 75; trail.rampSeconds = 12;
        updateTrail(trail, group.generatedMs, selected);
        for (const [i, layer] of trail.layers.entries()) {
          const uniforms = layer.primitive.appearance!.material!.uniforms;
          expect(uniforms).toBe(layer.material.uniforms);
          expect(uniforms.trailColor).toEqual(Color.fromCssColorString(trail.source === selected
            ? TRAJECTORY_ACCENTS[trail.source] : FORWARD_TRAIL.inactiveColor));
          expect(uniforms.maximumAlpha).toBe((trail.source === selected ? 0.85 : 0.08) * FORWARD_TRAIL.layers[i].alphaScale);
        }
      }
      orderTrails(group, selected, collection);
      const actual = Array.from({length: collection.length}, (_, i) => collection.get(i));
      const selectedTrail = group.trails.find((trail) => trail.source === selected)!;
      const inactiveTrail = group.trails.find((trail) => trail.source !== selected)!;
      expect(actual).toEqual([...inactiveTrail.layers, ...selectedTrail.layers].map((layer) => layer.primitive));
      expect(new Set(actual)).toEqual(new Set(retained));
    }
    expect(TRAJECTORY_ACCENTS.PRIMARY_GP_TLE).not.toBe(TRAJECTORY_ACCENTS.NASA_OEM);
    collection.destroy();
    for (const trail of group.trails) for (const layer of trail.layers) { layer.primitive.destroy(); layer.material.destroy(); }
  });
  it('composes one reveal with both sources and halo/body without rebuilding or overriding temporal alpha', () => {
    const group = createTrajectoryTrails(parseComparison(fixture(true)));
    for (const trail of group.trails) { trail.gapSeconds = 75; trail.rampSeconds = 12; }
    const retained = group.trails.flatMap(t => t.layers.map(l => l.primitive));
    for (const selected of ['PRIMARY_GP_TLE', 'NASA_OEM'] as const) for (const reveal of [0, 0.1, 0.5, 0.9, 1]) {
      for (const trail of group.trails) {
        updateTrail(trail, group.generatedMs, selected, reveal);
        for (const [index, layer] of trail.layers.entries()) {
          expect(layer.material.uniforms.maximumAlpha).toBe((trail.source === selected ? 0.85 : 0.08) * FORWARD_TRAIL.layers[index].alphaScale * reveal);
          expect(layer.material.uniforms.forwardStart).toBeCloseTo(75 / 5580);
          expect(layer.material.uniforms.startRamp).toBeCloseTo(12 / 5580);
        }
      }
      expect(group.trails.flatMap(t => t.layers.map(l => l.primitive))).toEqual(retained);
    }
    group.trails[0].gapSeconds = null;
    updateTrail(group.trails[0], group.generatedMs, 'PRIMARY_GP_TLE', 1);
    expect(group.trails[0].layers.every(l => l.material.uniforms.maximumAlpha === 0)).toBe(true);
    for (const trail of group.trails) for (const layer of trail.layers) { layer.primitive.destroy(); layer.material.destroy(); }
  });
  it('clips each source by its own temporal grid and coverage', () => {
    const response = parseComparison(fixture(true));
    response.oem.samples = response.oem.samples.slice(2, 90);
    const group = createTrajectoryTrails(response);
    const sceneMs = group.generatedMs + 120_000;
    for (const selected of ['PRIMARY_GP_TLE', 'NASA_OEM'] as const) {
      for (const trail of group.trails) {
        trail.gapSeconds = 75; trail.rampSeconds = 12;
        updateTrail(trail, sceneMs, selected);
        const uniforms = trail.layers[1].material.uniforms;
        const span = trail.endMs - trail.startMs;
        expect(trail.startMs + uniforms.forwardStart * span).toBe(sceneMs + 75_000);
        expect(trail.startMs + uniforms.forwardEnd * span).toBeCloseTo(Math.min(sceneMs + 0.85 * trail.periodSeconds * 1000, trail.endMs));
        expect(forwardOpacity(sceneMs, sceneMs + 75_000, trail.endMs)).toBe(0);
      }
    }
    for (const trail of group.trails) for (const layer of trail.layers) { layer.primitive.destroy(); layer.material.destroy(); }
  });
});
