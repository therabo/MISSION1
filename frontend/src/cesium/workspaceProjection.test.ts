import { Camera, Cartesian2, Cartesian3, Cartesian4, GeographicProjection, Matrix4, PerspectiveFrustum, SceneMode, type Model, type Scene } from 'cesium';
import { expect, it, vi } from 'vitest';
import { applyWorkspaceProjection, installWorkspacePicking, WorkspacePerspectiveFrustum } from './workspaceProjection';

function fixture() {
  const width = 1440, height = 900;
  const scene = { canvas: { clientWidth: width, clientHeight: height }, drawingBufferWidth: width, drawingBufferHeight: height, mapProjection: new GeographicProjection(), mode: SceneMode.SCENE3D } as Scene;
  const camera = new Camera(scene);
  camera.position = new Cartesian3(0,0,0); camera.direction = new Cartesian3(0,0,-1);
  camera.up = new Cartesian3(0,1,0); camera.right = new Cartesian3(1,0,0);
  Object.defineProperty(scene, 'camera', { value: camera });
  camera.frustum = new WorkspacePerspectiveFrustum({ fov: Math.PI / 3, aspectRatio: width / height, near: 1 });
  applyWorkspaceProjection(camera.frustum, 0.1, -0.03);
  const pick = vi.fn(); scene.pick = pick;
  const model = { minimumPixelSize: 80 } as Model;
  const nativeRay = camera.getPickRay;
  const cleanup = installWorkspacePicking(scene, () => ({ width, height }), () => model);
  return { scene, camera, width, height, pick, model, cleanup, nativeRay };
}
it('makes Cesium native rays coincide with its off-center projection at center and edges', () => {
  const { camera, width, height } = fixture();
  for (const [x,y] of [[864,423],[0,899],[1439,0],[50,890],[720,450]]) {
    const ray = camera.getPickRay(new Cartesian2(x,y))!;
    const world = Cartesian3.add(ray.origin, Cartesian3.multiplyByScalar(ray.direction, 1000, new Cartesian3()), new Cartesian3());
    const eye = Matrix4.multiplyByVector(camera.viewMatrix, new Cartesian4(world.x,world.y,world.z,1), new Cartesian4());
    const clip = Matrix4.multiplyByVector(camera.frustum.projectionMatrix, eye, new Cartesian4());
    expect((clip.x / clip.w + 1) * width / 2).toBeCloseTo(x, 6);
    expect((1 - clip.y / clip.w) * height / 2).toBeCloseTo(y, 6);
  }
});
it('picks the same ray with a symmetric GPU lens and restores the render frustum', () => {
  const { scene, camera, pick, model } = fixture();
  const frustum = camera.frustum;
  pick.mockImplementation((position: Cartesian2) => {
    expect((camera.frustum as PerspectiveFrustum).xOffset).toBe(0);
    expect((camera.frustum as PerspectiveFrustum).yOffset).toBe(0);
    const working = new PerspectiveFrustum({ xOffset: 5, yOffset: 7 });
    (camera.frustum as PerspectiveFrustum).clone(working);
    expect(working.xOffset).toBe(0); expect(working.yOffset).toBe(0);
    expect(position.x).toBeCloseTo(720, 10); expect(position.y).toBeCloseTo(450, 10);
    return { featureId: 7 };
  });
  expect(scene.pick(new Cartesian2(864,423))).toEqual({ featureId: 7 });
  expect(camera.frustum).toBe(frustum); expect(model.minimumPixelSize).toBe(80);
});
it('supports a shifted visible edge outside the symmetric lens without changing physical display scale', () => {
  const { scene, camera, pick, width, height, model } = fixture();
  const renderFrustum = camera.frustum as PerspectiveFrustum;
  const pixels = renderFrustum.getPixelDimensions(width,height,1000,1,new Cartesian2());
  pick.mockImplementation((position: Cartesian2) => {
    expect(position.x).toBeGreaterThan(0); expect(position.y).toBeLessThan(height);
    const expandedPixels = camera.frustum.getPixelDimensions(width,height,1000,1,new Cartesian2());
    expect(model.minimumPixelSize * expandedPixels.x).toBeCloseTo(80 * pixels.x, 10);
  });
  scene.pick(new Cartesian2(0,899));
  expect(camera.frustum).toBe(renderFrustum); expect(model.minimumPixelSize).toBe(80);
});
it('restores frustum and minimum footprint even if native GPU picking throws', () => {
  const { scene, camera, pick, model } = fixture(); const frustum = camera.frustum;
  pick.mockImplementation(() => { throw new Error('TEST GPU failure'); });
  expect(() => scene.pick(new Cartesian2(0,899))).toThrow('TEST GPU failure');
  expect(camera.frustum).toBe(frustum); expect(model.minimumPixelSize).toBe(80);
});
it('passes zero-offset picking through unchanged and removes the per-instance adapters', () => {
  const { scene, camera, pick, cleanup, nativeRay } = fixture();
  applyWorkspaceProjection(camera.frustum as PerspectiveFrustum, 0, 0);
  const position = new Cartesian2(123,456); scene.pick(position,3,3);
  expect(pick).toHaveBeenCalledWith(position,3,3);
  cleanup(); expect(scene.pick).toBe(pick); expect(camera.getPickRay).toBe(nativeRay);
});

it('keeps identical projection through Cesium depth-partition near planes and retains clone result identity', () => {
  const { camera, width, height } = fixture();
  const frustum = camera.frustum as WorkspacePerspectiveFrustum;
  const result = new PerspectiveFrustum();
  for (const near of [1,1000,1000000,10,0.1]) {
    expect(frustum.clone(result)).toBe(result);
    result.near = near;
    const clip = Matrix4.multiplyByVector(result.projectionMatrix,new Cartesian4(0,0,-20000000,1),new Cartesian4());
    expect((clip.x/clip.w+1)*width/2).toBeCloseTo(864,10);
    expect((1-clip.y/clip.w)*height/2).toBeCloseTo(423,10);
    expect(frustum.near).toBe(1);
  }
});
it('rescales offsets on a copied lens near change without accumulating a second shift', () => {
  const {camera}=fixture();const original=camera.frustum as WorkspacePerspectiveFrustum;
  const copy=original.clone(); const oldX=copy.xOffset,oldY=copy.yOffset;
  copy.near=100; expect(copy.xOffset).toBeCloseTo(oldX*100,12);expect(copy.yOffset).toBeCloseTo(oldY*100,12);
  original.clone(copy); expect(copy.xOffset).toBe(oldX);expect(copy.yOffset).toBe(oldY);
});
