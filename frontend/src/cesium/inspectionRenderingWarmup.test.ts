import { Cartesian3, Event, type Viewer } from 'cesium';
import { describe, expect, it, vi } from 'vitest';
import { warmInspectionRendering } from './inspectionRenderingWarmup';

function fixture() {
  const postRender = new Event(), layerAdded = new Event();
  const provider = {};
  const first = { alpha: 0.7, show: true, imageryProvider: provider };
  const hidden = { alpha: 0, show: true, imageryProvider: provider };
  const layers = [first, hidden];
  const globe = { nightFadeOutDistance: 10, nightFadeInDistance: 20 };
  const viewer = {
    camera: { positionWC: new Cartesian3(100, 0, 0) },
    scene: { globe, postRender },
    imageryLayers: { get length() { return layers.length; }, get: (i: number) => layers[i],
      contains: (layer: typeof first) => layers.includes(layer), layerAdded },
  } as unknown as Viewer;
  return { viewer, postRender, layerAdded, layers, first, hidden, provider, globe };
}

describe('inspection rendering warmup lifecycle', () => {
  it('excludes temporary sky draws from the normal scene readiness gate', () => {
    const f=fixture(), ready=vi.fn(); let sceneReady=false;
    warmInspectionRendering(f.viewer,ready,()=>sceneReady);
    for (let i=0; i<10; i++) f.postRender.raiseEvent();
    expect(ready).not.toHaveBeenCalled(); expect(f.first.alpha).toBe(0);
    sceneReady=true;
    for (let i=0; i<7; i++) f.postRender.raiseEvent();
    expect(ready).not.toHaveBeenCalled();
    f.postRender.raiseEvent(); expect(ready).toHaveBeenCalledOnce();
    expect(f.first.alpha).toBe(0.7);
  });
  it('prepares both variants and restores the original scene before enabling Inspection', () => {
    const f = fixture(), ready = vi.fn();
    warmInspectionRendering(f.viewer, ready);
    expect(f.first.alpha).toBe(0);
    const added = { alpha: 0.4, show: true, imageryProvider: f.provider };
    f.layers.push(added); f.layerAdded.raiseEvent(added);
    expect(added.alpha).toBe(0);
    f.postRender.raiseEvent(); f.postRender.raiseEvent();
    expect(f.first.alpha).toBe(0.7); expect(added.alpha).toBe(0.4);
    expect(f.hidden.alpha).toBe(0); expect(ready).not.toHaveBeenCalled();
    f.postRender.raiseEvent(); f.postRender.raiseEvent();
    expect(ready).not.toHaveBeenCalled();
    for (let i = 0; i < 3; i++) f.postRender.raiseEvent();
    expect(ready).not.toHaveBeenCalled();
    f.postRender.raiseEvent();
    expect(ready).toHaveBeenCalledOnce();
    expect(f.globe).toEqual({ nightFadeOutDistance: 10, nightFadeInDistance: 20 });
    expect(f.first.show).toBe(true); expect(f.first.imageryProvider).toBe(f.provider);
    expect(f.postRender.numberOfListeners).toBe(0); expect(f.layerAdded.numberOfListeners).toBe(0);
  });

  it.each([0, 2, 4, 6])('restores startup state when cancelled after %i frames', (frames) => {
    const f = fixture(), ready = vi.fn();
    const cancel = warmInspectionRendering(f.viewer, ready);
    for (let i = 0; i < frames; i++) f.postRender.raiseEvent();
    cancel(); cancel(); f.postRender.raiseEvent();
    expect(f.first.alpha).toBe(0.7); expect(f.hidden.alpha).toBe(0);
    expect(f.globe).toEqual({ nightFadeOutDistance: 10, nightFadeInDistance: 20 });
    expect(ready).not.toHaveBeenCalled();
    expect(f.postRender.numberOfListeners).toBe(0); expect(f.layerAdded.numberOfListeners).toBe(0);
  });
});
