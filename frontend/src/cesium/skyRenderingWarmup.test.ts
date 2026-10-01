import { Cartesian3, JulianDate, Matrix4, type Viewer } from 'cesium';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { prewarmSkyDraws, warmSkyRendering } from './skyRenderingWarmup';

function fixture() {
  const camera = { position: new Cartesian3(20_000_000, 5_000_000, 3_000_000),
    direction: new Cartesian3(-1, 0, 0), up: new Cartesian3(0, 0, 1), right: new Cartesian3(0, 1, 0),
    transform: Matrix4.clone(Matrix4.IDENTITY), frustum: { far: 500_000_000 },
    get positionWC() { return this.position; },
    lookAtTransform: vi.fn((m: Matrix4) => Matrix4.clone(m, camera.transform)) };
  const moon = { show: true }, sun = { show: true }, controls = { enableInputs: true };
  const draws: { direction: Cartesian3; far: number; inputs: boolean }[] = [];
  const viewer = { camera, scene: { moon, sun, screenSpaceCameraController: controls, requestRender: vi.fn() },
    useDefaultRenderLoop: true, clock: { currentTime: JulianDate.fromIso8601('2026-09-30T15:45:59Z') },
    isDestroyed: () => false, render: vi.fn(() => draws.push({ direction: Cartesian3.clone(camera.direction),
      far: camera.frustum.far, inputs: controls.enableInputs })) } as unknown as Viewer;
  return { viewer, camera, controls, moon, sun, draws };
}
afterEach(() => { vi.useRealTimers(); });
describe('retained celestial rendering warmup', () => {
  it('submits Moon/Sun draws and restores the actual Earth camera before the final paint', () => {
    const f=fixture(), before={ position: Cartesian3.clone(f.camera.position), direction: Cartesian3.clone(f.camera.direction),
      up: Cartesian3.clone(f.camera.up), right: Cartesian3.clone(f.camera.right), far:f.camera.frustum.far };
    prewarmSkyDraws(f.viewer);
    expect(f.draws).toHaveLength(3);
    expect(f.draws[0]!.direction).not.toEqual(before.direction);
    expect(f.draws[1]!.far).toBeGreaterThan(before.far);
    expect(f.draws.every(d=>!d.inputs)).toBe(true);
    expect(f.draws[2]!.direction).toEqual(before.direction);
    expect(f.camera.position).toEqual(before.position); expect(f.camera.up).toEqual(before.up);
    expect(f.camera.right).toEqual(before.right); expect(f.camera.frustum.far).toBe(before.far);
    expect(f.controls.enableInputs).toBe(true); expect(f.viewer.useDefaultRenderLoop).toBe(true);
    expect(f.viewer.scene.moon).toBe(f.moon); expect(f.viewer.scene.sun).toBe(f.sun);
  });
  it('restores state even if a preparation render fails', () => {
    const f=fixture();vi.mocked(f.viewer.render).mockImplementationOnce(()=>{throw Error('TEST render failure');});
    expect(()=>prewarmSkyDraws(f.viewer)).toThrow('TEST render failure');
    expect(f.camera.direction).toEqual(new Cartesian3(-1,0,0));
    expect(f.camera.frustum.far).toBe(500_000_000); expect(f.controls.enableInputs).toBe(true);
    expect(f.viewer.useDefaultRenderLoop).toBe(true);
  });
  it('cancels queued preparation on teardown without enabling Inspection', () => {
    vi.useFakeTimers();const f=fixture(),ready=vi.fn(),failed=vi.fn();
    const cancel=warmSkyRendering(f.viewer,ready,failed);cancel();vi.runAllTimers();
    expect(f.viewer.render).not.toHaveBeenCalled();expect(ready).not.toHaveBeenCalled();expect(failed).not.toHaveBeenCalled();
  });
});
