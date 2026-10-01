import { Cartesian3, Matrix3, Matrix4, Simon1994PlanetaryPositions, Transforms, type Viewer } from 'cesium';

/** Submit retained celestial draw resources before an arbitrary camera can
 * reveal them. One idle task ends with a render of the actual captured Earth
 * view. No second scene or private shader API.
 */
export function prewarmSkyDraws(viewer: Viewer): void {
  const camera = viewer.camera, scene = viewer.scene;
  const saved = { position: Cartesian3.clone(camera.position), direction: Cartesian3.clone(camera.direction),
    up: Cartesian3.clone(camera.up), right: Cartesian3.clone(camera.right), transform: Matrix4.clone(camera.transform),
    far: camera.frustum.far, inputs: scene.screenSpaceCameraController.enableInputs, loop: viewer.useDefaultRenderLoop };
  const rotation = new Matrix3(), target = new Cartesian3();
  viewer.useDefaultRenderLoop = false;
  scene.screenSpaceCameraController.enableInputs = false;
  try {
    camera.lookAtTransform(Matrix4.IDENTITY);
    for (const body of [scene.moon?.show ? Simon1994PlanetaryPositions.computeMoonPositionInEarthInertialFrame : null,
      scene.sun?.show ? Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame : null]) {
      if (!body) continue;
      body(viewer.clock.currentTime, target);
      if (!Transforms.computeIcrfToFixedMatrix(viewer.clock.currentTime, rotation))
        Transforms.computeTemeToPseudoFixedMatrix(viewer.clock.currentTime, rotation);
      Matrix3.multiplyByVector(rotation, target, target);
      // Put Earth behind this temporary view, so its occluder cannot prevent
      // the retained Moon/Sun command from reaching the GPU.
      Cartesian3.multiplyByScalar(target, 0.5, camera.position);
      camera.frustum.far = Math.max(saved.far, 2 * Cartesian3.distance(camera.positionWC, target));
      Cartesian3.normalize(Cartesian3.subtract(target, camera.positionWC, camera.direction), camera.direction);
      const axis = Math.abs(camera.direction.z) < 0.99 ? Cartesian3.UNIT_Z : Cartesian3.UNIT_Y;
      Cartesian3.normalize(Cartesian3.cross(camera.direction, axis, camera.right), camera.right);
      Cartesian3.cross(camera.right, camera.direction, camera.up);
      scene.requestRender();
      viewer.render();
    }
  } finally {
    camera.lookAtTransform(saved.transform);
    Cartesian3.clone(saved.position, camera.position); Cartesian3.clone(saved.direction, camera.direction);
    Cartesian3.clone(saved.up, camera.up); Cartesian3.clone(saved.right, camera.right);
    camera.frustum.far = saved.far;
    // Paint the restored scene while input remains locked, so retained inertia
    // cannot move the captured pose during this startup preparation.
    try { scene.requestRender(); viewer.render(); }
    finally {
      scene.screenSpaceCameraController.enableInputs = saved.inputs;
      viewer.useDefaultRenderLoop = saved.loop;
    }
  }
}

export function warmSkyRendering(viewer: Viewer, ready: () => void, failed: () => void): () => void {
  let cancelled = false;
  const run = (): void => {
    if (cancelled || viewer.isDestroyed()) return;
    try { prewarmSkyDraws(viewer); ready(); }
    catch { failed(); }
  };
  if (typeof globalThis.requestIdleCallback === 'function') {
    const id = globalThis.requestIdleCallback(run, { timeout: 1000 });
    return () => { cancelled = true; globalThis.cancelIdleCallback(id); };
  }
  const id = globalThis.setTimeout(run, 0);
  return () => { cancelled = true; globalThis.clearTimeout(id); };
}
