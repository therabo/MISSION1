import { forwardOpacity } from '../test/trajectoryReference';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { Cartesian2, Cartesian3, Color, GeometryInstance, Geometry, PolylineGeometry, PrimitiveCollection, SceneTransforms, type Scene } from 'cesium';
import { fixture } from '../test/comparisonFixture';
import { parseComparison } from '../orbital/comparison';
import { adaptTrailClearance, createTrajectoryTrails, FORWARD_TRAIL, forwardBounds, orderTrails, TRAJECTORY_ACCENTS, updateTrail } from './trajectoryRendering';
beforeAll(() => { for (const name of ['HTMLCanvasElement', 'HTMLImageElement', 'ImageBitmap', 'OffscreenCanvas']) vi.stubGlobal(name, class {}); });
afterAll(() => vi.unstubAllGlobals());

describe('future only continuous trajectories', () => {
  it('retains safe future body fragments when first-exit branches merge at a tangent', () => {
    const group=createTrajectoryTrails(parseComparison(fixture(true)));
    for(const trail of group.trails){
      let previousStart: number | undefined;
      for(const gap of [300,250,190,300,0.001]){
        trail.gapSeconds=gap;updateTrail(trail,group.generatedMs,trail.source);
        const u=trail.layers[1].material.uniforms;
        if(previousStart!==undefined)expect(u.futureStart).toBe(previousStart);
        previousStart=u.futureStart;
        expect(u.maximumAlpha).toBe(.85);
        expect(trail.startMs+u.forwardEnd*(trail.endMs-trail.startMs)).toBe(group.generatedMs+.85*trail.periodSeconds*1000);
        expect(trail.layers[1].material.shaderSource).toContain('smoothstep(futureStart');
      }
      for(const layer of trail.layers){layer.primitive.destroy();layer.material.destroy();}
    }
  });
  it('cannot switch local reentry coverage at a changing first-exit epoch', () => {
    const group = createTrajectoryTrails(parseComparison(fixture(true)));
    for (const trail of group.trails) {
      const mask = trail.layers[1].material.materials.clearanceMask;
      expect(mask.shaderSource).not.toContain('materialInput.st.s');
      expect(mask.uniforms).not.toHaveProperty('initialEnd');
      for (const layer of trail.layers) { layer.primitive.destroy(); layer.material.destroy(); }
    }
  });
  it('retains physical samples, epochs, endpoint, length and builders during camera-only updates', () => {
    // Synthetic TEST orbit. Canonical hashes precede all presentation uniforms.
    const group = createTrajectoryTrails(parseComparison(fixture(true)));
    const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
    const canonical = () => group.trails.map(t => ({
      positions: hash(t.positions), epochs: hash(t.sampleTimes), count: t.positions.length,
      first: t.startMs, last: t.endMs, endpoint: t.positions.at(-1),
      length: t.positions.slice(1).reduce((sum, p, i) => sum + Cartesian3.distance(t.positions[i], p), 0),
    }));
    const initial = canonical(), primitives = group.trails.flatMap(t => t.layers.map(l => l.primitive));
    const geometries = primitives.map(p => p.geometryInstances);
    const builder = vi.spyOn(PolylineGeometry, 'createGeometry');
    const project = vi.spyOn(SceneTransforms, 'worldToWindowCoordinates').mockImplementation((scene, point, result) =>
      Cartesian2.fromElements((point.x - 6_800_000) / 10000 + scene.camera.positionWC.y / 1e6, point.y / 10000, result));
    const camera = {positionWC: new Cartesian3(0, 0, 17_000_000), frustum: {projectionMatrix: {5: 1}}};
    const scene = {camera,canvas:{clientWidth:1280,clientHeight:720},drawingBufferWidth:2560,drawingBufferHeight:1440} as unknown as Scene;
    try {
      for (let frame = 0; frame < 500; frame++) {
        camera.positionWC.y = Math.sin(frame * .1) * 12_000_000;
        camera.positionWC.z = 8_000_000 + Math.cos(frame * .2) * 5_000_000;
        for (const t of group.trails) {
          adaptTrailClearance(t, group.generatedMs, scene, [{x:-30,y:-30},{x:30,y:-30},{x:30,y:30},{x:-30,y:30}], 4, .5);
          updateTrail(t, group.generatedMs, 'PRIMARY_GP_TLE');
          const u = t.layers[1].material.uniforms;
          expect(u.maximumAlpha).toBeGreaterThan(0);
          expect(t.startMs + u.forwardEnd * (t.endMs - t.startMs)).toBe(group.generatedMs + .85 * t.periodSeconds * 1000);
          expect(t.gapSeconds).toBeGreaterThanOrEqual(.001);
          expect(t.gapSeconds!).toBeLessThan(.15 * t.periodSeconds);
        }
        expect(canonical()).toEqual(initial);
        expect(group.trails.flatMap(t => t.layers.map(l => l.primitive))).toEqual(primitives);
        expect(primitives.map(p => p.geometryInstances)).toEqual(geometries);
      }
      expect(builder).not.toHaveBeenCalled();
    } finally {
      project.mockRestore(); builder.mockRestore();
      for (const t of group.trails) for (const l of t.layers) { l.primitive.destroy(); l.material.destroy(); }
    }
  });
  it('keeps the far body available when the local model projection is missing or head-on', () => {
    const group = createTrajectoryTrails(parseComparison(fixture(true)));
    const scene = {canvas:{clientWidth:1280,clientHeight:720},drawingBufferWidth:2560,drawingBufferHeight:1440} as Scene;
    for (const t of group.trails) {
      adaptTrailClearance(t, group.generatedMs, scene, null, 4, .5);
      updateTrail(t, group.generatedMs, t.source, 1);
      expect(t.layers[1].material.uniforms.maximumAlpha).toBe(.85);
      expect(t.layers[1].material.materials.clearanceMask.uniforms.radius).toBe(0);
      expect(t.gapSeconds).toBe(.001);
      for (const l of t.layers) { l.primitive.destroy(); l.material.destroy(); }
    }
  });
  it('cannot extend the physical endpoint when a huge projected region has no local exit', () => {
    const group=createTrajectoryTrails(parseComparison(fixture(true)));
    const projection=vi.spyOn(SceneTransforms,'worldToWindowCoordinates').mockImplementation((_scene,_point,result)=>Cartesian2.fromElements(0,0,result));
    const scene={camera:{positionWC:new Cartesian3(0,0,17_000_000),frustum:{projectionMatrix:{5:1}}},canvas:{clientWidth:1280,clientHeight:720},drawingBufferWidth:2560,drawingBufferHeight:1440} as unknown as Scene;
    try{
      for(const t of group.trails){
        adaptTrailClearance(t,group.generatedMs,scene,[{x:-1e8,y:-1e8},{x:1e8,y:-1e8},{x:1e8,y:1e8},{x:-1e8,y:1e8}],4,.5);
        updateTrail(t,group.generatedMs,t.source);
        const u=t.layers[1].material.uniforms;
        expect(t.firstExitMs).toBeNull();
        expect(t.startMs+u.forwardEnd*(t.endMs-t.startMs)).toBe(group.generatedMs+.85*t.periodSeconds*1000);
        expect(u.maximumAlpha).toBe(.85);
        expect(u.futureStart).toBeCloseTo(.001/t.periodSeconds);
      }
    }finally{projection.mockRestore();for(const t of group.trails)for(const l of t.layers){l.primitive.destroy();l.material.destroy();}}
  });
  it('preserves the physical vertex buffer hash measured on fa5ed63 for both layers and sources', () => {
    // Synthetic TEST fixture, independently hashed in the untouched baseline.
    const group = createTrajectoryTrails(parseComparison(fixture(true)));
    for (const trail of group.trails) for (const layer of trail.layers) {
      const geometry = (layer.primitive.geometryInstances as GeometryInstance).geometry as Geometry;
      const bytes = Buffer.from(new Float64Array(Array.from(geometry.attributes.position!.values!)).buffer);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe('4593a73d006aaf87251bb9daa9a3af0f9cfe81425e041e53fb90b2a63faebbcb');
      layer.primitive.destroy(); layer.material.destroy();
    }
  });
  it('bounds folded segment raster coverage and retains translucent native depth', () => {
    const group = createTrajectoryTrails(parseComparison(fixture(true)));
    for (const trail of group.trails) for (const layer of trail.layers) {
      const appearance = layer.primitive.appearance!;
      expect(appearance.fragmentShaderSource).toContain('capsule(v_mission1Segment');
      expect(appearance.fragmentShaderSource).toContain('ownsOverlap(before, own, ownHidden, true)');
      expect(appearance.fragmentShaderSource).toContain('ownsOverlap(after, own, ownHidden, false)');
      expect(appearance.vertexShaderSource).toContain('clipLineSegmentToNearPlane');
      expect(appearance.getRenderState()).toMatchObject({ depthMask: false, depthTest: { enabled: true } });
      expect(appearance.material).toBe(layer.material);
      layer.primitive.destroy(); layer.material.destroy();
    }
  });
  it('protects the initial region when source projections reuse scratch output', () => {
    // Synthetic TEST screen projection, one CSS pixel per second of source time.
    const response = parseComparison(fixture(true));
    for (const samples of [response.primary.samples, response.oem.samples])
      for (const sample of samples) {
        sample.xMeters = (Date.parse(sample.time) - Date.parse(response.generatedAt)) / 1000 - 80;
        sample.yMeters = 0;
      }
    const group = createTrajectoryTrails(response);
    const projection = vi.spyOn(SceneTransforms, 'worldToWindowCoordinates').mockImplementation((_scene, point, result) =>
      Cartesian2.fromElements(point.x, point.y, result));
    const scene = { canvas: { clientWidth: 1280, clientHeight: 720 }, drawingBufferWidth: 2560, drawingBufferHeight: 1440, camera: {positionWC: new Cartesian3(0,0,7_000_000),frustum:{projectionMatrix:{5:1}}} } as unknown as Scene;
    try {
      for (const trail of group.trails) {
        adaptTrailClearance(trail, group.generatedMs, scene,
          [{ x: -10, y: -10 }, { x: 10, y: -10 }, { x: 10, y: 10 }, { x: -10, y: 10 }], .75, .5);
        expect(trail.gapSeconds).toBeCloseTo(80 + Math.sqrt(200) + 1.25, 2);
        expect(trail.firstExitMs).not.toBeNull();
        const mask=trail.layers[1].material.materials.clearanceMask.uniforms;
        expect(mask.initialExternal).toBe(true);
        expect(mask.origin.x).toBeCloseTo(-79.999,3);
      }
    } finally {
      projection.mockRestore();
      for (const trail of group.trails) for (const layer of trail.layers) { layer.primitive.destroy(); layer.material.destroy(); }
    }
  });
  it('softens the start with a deterministic Fabric smoothstep ramp, without a cap marker', () => {
    const group = createTrajectoryTrails(parseComparison(fixture(true)));
    for (const trail of group.trails) {
      trail.gapSeconds = 20;
      updateTrail(trail, group.generatedMs, trail.source);
      const material = trail.layers[1].material;
      expect(material.uniforms.startRamp).toBe(1e-6);
      expect(material.uniforms.futureStart).toBeCloseTo(.001/5580);
      expect(material.shaderSource).toContain('smoothstep(futureStart');
      expect(material.shaderSource).toContain('smoothstep');
      expect(material.shaderSource).toContain('abs(materialInput.st.t');
      expect(material.materials.clearanceMask.shaderSource).toContain('gl_FragCoord');
      expect(material.materials.clearanceMask.uniforms.radius).toBe(0);
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
      trail.gapSeconds = 75;
      const samples=trail.source==='NASA_OEM'?response.oem.samples:response.primary.samples;
      expect(trail.positions.map((p)=>p.x)).toEqual(samples.map((p)=>p.xMeters));
      expect(trail.positions).toHaveLength(181);
      expect(trail.positions[0]).not.toEqual(trail.positions[180]);
      const vertices=trail.layers.map(({primitive})=> Array.from(((primitive.geometryInstances as GeometryInstance).geometry as Geometry).attributes.position!.values!));
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
    for (const trail of group.trails) { trail.gapSeconds = 75; }
    const collection = new PrimitiveCollection({ destroyPrimitives: false });
    for (const trail of group.trails) for (const layer of trail.layers) collection.add(layer.primitive);
    const retained = group.trails.flatMap((trail) => trail.layers.map((layer) => layer.primitive));
    for (const selected of ['PRIMARY_GP_TLE', 'NASA_OEM', 'PRIMARY_GP_TLE'] as const) {
      for (const trail of group.trails) {
        trail.gapSeconds = 75;
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
    for (const trail of group.trails) { trail.gapSeconds = 75; }
    const retained = group.trails.flatMap(t => t.layers.map(l => l.primitive));
    for (const selected of ['PRIMARY_GP_TLE', 'NASA_OEM'] as const) for (const reveal of [0, 0.1, 0.5, 0.9, 1]) {
      for (const trail of group.trails) {
        updateTrail(trail, group.generatedMs, selected, reveal);
        for (const [index, layer] of trail.layers.entries()) {
          expect(layer.material.uniforms.maximumAlpha).toBe((trail.source === selected ? 0.85 : 0.08) * FORWARD_TRAIL.layers[index].alphaScale * reveal);
          expect(layer.material.uniforms.forwardStart).toBeCloseTo(75 / 5580);
          expect(layer.material.uniforms.startRamp).toBe(1e-6);
        }
      }
      expect(group.trails.flatMap(t => t.layers.map(l => l.primitive))).toEqual(retained);
    }
    group.trails[0].gapSeconds = null;
    updateTrail(group.trails[0], group.generatedMs, 'PRIMARY_GP_TLE', 1);
    expect(group.trails[0].layers[1].material.uniforms.maximumAlpha).toBe(0.85);
    for (const trail of group.trails) for (const layer of trail.layers) { layer.primitive.destroy(); layer.material.destroy(); }
  });
  it('clips each source by its own temporal grid and coverage', () => {
    const response = parseComparison(fixture(true));
    response.oem.samples = response.oem.samples.slice(2, 90);
    const group = createTrajectoryTrails(response);
    const sceneMs = group.generatedMs + 120_000;
    for (const selected of ['PRIMARY_GP_TLE', 'NASA_OEM'] as const) {
      for (const trail of group.trails) {
        trail.gapSeconds = 75;
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
