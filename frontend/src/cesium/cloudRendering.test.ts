// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { Ellipsoid, Event, PrimitiveCollection, type Viewer, type Primitive, type MaterialAppearance, type Material } from 'cesium';
import { CLOUD_DISPLAY_ALTITUDE_METERS, createCloudRenderer } from './cloudRendering';

describe('one non-pickable WGS84 cloud shell', () => {
  it('retains the geometry across image replacement, hides/restores it and explicitly releases its material', () => {
    const primitives = new PrimitiveCollection(), postRender = new Event();
    const viewer = { scene: { primitives, postRender, requestRender: vi.fn() } } as unknown as Viewer;
    const renderer = createCloudRenderer(viewer);
    const primitive = primitives.get(0) as Primitive;
    const material = (primitive.appearance as MaterialAppearance).material as Material;
    const destroyMaterial = vi.spyOn(material, 'destroy');
    const geometry = (primitive.geometryInstances as any).geometry;
    expect(geometry._radii.x).toBe(Ellipsoid.WGS84.radii.x + CLOUD_DISPLAY_ALTITUDE_METERS);
    expect(geometry._radii.z).toBe(Ellipsoid.WGS84.radii.z + CLOUD_DISPLAY_ALTITUDE_METERS);
    expect(primitive.allowPicking).toBe(false);
    expect((primitive.appearance.renderState as any).depthMask).toBe(false);
    expect(primitive.show).toBe(false);
    const a = document.createElement('img'), b = document.createElement('img');
    renderer.replace(a); renderer.show(true); expect(primitive.show).toBe(true);
    expect(material.uniforms.ready).toBe(0); // never draw the default white sampler
    postRender.raiseEvent(); postRender.raiseEvent();
    expect(material.uniforms.ready).toBe(0); // asynchronous geometry is still pending
    Object.defineProperty(primitive, 'ready', { value: true });
    postRender.raiseEvent(); expect(material.uniforms.ready).toBe(0);
    postRender.raiseEvent(); expect(material.uniforms.ready).toBe(1);
    renderer.replace(b); expect(material.uniforms.image).toBe(b);
    expect(primitives.length).toBe(1); expect(primitives.get(0)).toBe(primitive);
    renderer.show(false); expect(primitive.show).toBe(false);
    renderer.show(true); expect(primitive.show).toBe(true);
    renderer.destroy(); expect(primitives.length).toBe(0); expect(postRender.numberOfListeners).toBe(0);
    expect(destroyMaterial).toHaveBeenCalledTimes(1); expect(primitive.isDestroyed()).toBe(true);
  });
});
