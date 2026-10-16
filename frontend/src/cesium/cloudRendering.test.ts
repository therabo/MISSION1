// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Ellipsoid, Event, PrimitiveCollection, type Viewer, type Primitive, type MaterialAppearance, type Material } from 'cesium';
import { CLOUD_DISPLAY_ALTITUDE_METERS, createCloudRenderer, installClouds } from './cloudRendering';
import { CLOUD_SOURCE } from './cloudSource';

// Cesium checks browser image constructors while inferring vector uniforms; jsdom lacks these.
beforeEach(() => { vi.stubGlobal('ImageBitmap', class {}); vi.stubGlobal('OffscreenCanvas', class {}); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('one non-pickable WGS84 cloud shell', () => {
  it.each([4096, 8192])('checks device capability %i before acquiring the selected representation', async limit => {
    vi.useFakeTimers();
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('TEST_ONLY provider outage'));
    const primitives = new PrimitiveCollection();
    const viewer = { canvas: { getContext: vi.fn().mockReturnValue({ MAX_TEXTURE_SIZE: 3379, getParameter: () => limit }) },
      creditDisplay: { addStaticCredit: vi.fn() },
      scene: { primitives, postRender: new Event(), requestRender: vi.fn() } } as unknown as Viewer;
    const owner = installClouds(viewer);
    try {
      owner.setCurrent(true); await vi.advanceTimersByTimeAsync(0);
      expect(fetch).toHaveBeenCalledTimes(limit >= CLOUD_SOURCE.width ? 1 : 0);
      expect(owner.lastGood).toBeNull(); expect(primitives.get(0).show).toBe(false);
      expect(vi.getTimerCount()).toBe(1);
      owner.destroy(); expect(vi.getTimerCount()).toBe(0);
    } finally { owner.destroy(); fetch.mockRestore(); vi.useRealTimers(); }
  });

  it('configures a perceptible cool shadow floor substantially below daylight brightness', () => {
    const primitives = new PrimitiveCollection();
    const viewer = { scene: { primitives, postRender: new Event(), requestRender: vi.fn() } } as unknown as Viewer;
    const renderer = createCloudRenderer(viewer);
    const material = (primitives.get(0).appearance as MaterialAppearance).material;
    const luminance = (c: { x: number; y: number; z: number }) => .2126 * c.x + .7152 * c.y + .0722 * c.z;
    const night = material.uniforms.nightTint, day = material.uniforms.dayTint;
    expect(luminance(night)).toBeGreaterThan(.1);
    expect(luminance(night)).toBeLessThan(.3 * luminance(day));
    expect(night.z).toBeGreaterThan(night.x);
    expect(material.uniforms.ready).toBe(0); // a nonzero shadow floor must not expose the default sampler
    renderer.destroy();
  });

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
