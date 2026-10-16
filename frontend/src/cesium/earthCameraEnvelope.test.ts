import { Camera, Cartesian3, Ellipsoid, Event, GeographicProjection, PerspectiveFrustum, SceneMode,
  type Scene, type ScreenSpaceCameraController, type Viewer } from 'cesium';
import { describe, expect, it } from 'vitest';
import { EARTH_VIEW_MAX_HEIGHT_METERS as far, EARTH_VIEW_MIN_HEIGHT_METERS as near, EARTH_VIEW_REFERENCE,
  earthControllerMinimum, earthZoomAmount, installEarthCameraEnvelope } from './earthCameraEnvelope';
import { EARTH_RESET_HEIGHT_METERS, EarthResetTransition, earthResetTarget } from './earthReset';
import { inspectionControlProfile, rearInspectionOffset } from './inspectionControls';
import type { ViewMode } from './inspectionMode';

// TEST camera/target geometry only; these coordinates never enter orbital data.
function runtime(width = 1440, height = 900) {
  const controller = { enableInputs: true, enableZoom: true, enableTranslate: true, enableLook: true, enableTilt: true,
    zoomFactor: 5, minimumZoomDistance: 1, maximumZoomDistance: Infinity, inertiaZoom: .8, inertiaSpin: .9,
    inertiaTranslate: .9 } as ScreenSpaceCameraController;
  const scene = { canvas: { clientWidth: width, clientHeight: height }, drawingBufferWidth: width,
    drawingBufferHeight: height, mapProjection: new GeographicProjection(), mode: SceneMode.SCENE3D,
    preUpdate: new Event(), preRender: new Event(), screenSpaceCameraController: controller } as unknown as Scene;
  const camera = new Camera(scene);
  camera.setView({ destination: Cartesian3.fromDegrees(-51.3, 51.765, EARTH_RESET_HEIGHT_METERS) });
  return { camera, controller, scene, viewer: { camera, scene } as Viewer };
}

describe('reference-derived Earth camera envelope', () => {
  it('inverts both measured tangent limbs and contains the exact accepted Reset height', () => {
    expect(near).toBeCloseTo(7_098_413.244215858, 5);
    expect(far).toBeCloseTo(78_704_202.44720191, 5);
    expect(near).toBeLessThan(EARTH_RESET_HEIGHT_METERS);
    expect(far).toBeGreaterThan(EARTH_RESET_HEIGHT_METERS);
    for (const [height, pixels] of [[near, EARTH_VIEW_REFERENCE.nearDiameterPixels], [far, EARTH_VIEW_REFERENCE.farDiameterPixels]]) {
      const radius = Ellipsoid.WGS84.maximumRadius;
      const projected = EARTH_VIEW_REFERENCE.longSidePixels * radius /
        (Math.sqrt((radius + height) ** 2 - radius ** 2) * Math.tan(Math.PI / 6));
      expect(projected).toBeCloseTo(pixels, 9);
    }
  });

  it.each([[1440,900], [1024,768], [768,1024], [390,844], [320,568]])(
    'uses the existing longer-side lens without per-viewport ranges at %sx%s', (width, height) => {
      const { camera } = runtime(width, height), lens = camera.frustum as PerspectiveFrustum;
      expect(lens.fov).toBe(Math.PI / 3);
      for (const altitude of [near, far]) {
        const radius = Ellipsoid.WGS84.maximumRadius;
        const focal = height / (2 * Math.tan(lens.fovy! / 2));
        const diameter = 2 * focal * radius / Math.sqrt((radius + altitude) ** 2 - radius ** 2);
        const expected = altitude === near ? 2680 / 2880 : 375 / 2880;
        expect(diameter / Math.max(width, height)).toBeCloseTo(expected, 12);
      }
    });

  it.each([near, far])('makes repeated forbidden toolbar steps a no-op at %s', height => {
    const { camera } = runtime();
    camera.setView({ destination: Cartesian3.fromDegrees(-51.3, 51.765, height) });
    const before = Cartesian3.clone(camera.positionWC), amount = height * (height === near ? .2 : -.2);
    for (let i = 0; i < 100; i++) expect(earthZoomAmount(camera, amount)).toBe(0);
    expect(camera.positionWC).toEqual(before);
    expect(earthZoomAmount(camera, -amount)).not.toBe(0);
  });

  it.each([[-170,0], [80,51.765], [0,90], [0,-90]])('stops buttons before either boundary at %s/%s', (lon, lat) => {
    const { camera } = runtime();
    for (const [height, amount, expected] of [[near * 1.01, near * .2, near], [far * .99, -far * .2, far]]) {
      camera.setView({ destination: Cartesian3.fromDegrees(lon, lat, height) });
      const allowed = earthZoomAmount(camera, amount);
      expect(Math.abs(allowed)).toBeLessThan(Math.abs(amount));
      camera.zoomIn(allowed);
      expect(camera.positionCartographic.height).toBeCloseTo(expected, 5);
      expect(earthZoomAmount(camera, amount)).toBe(0);
    }
  });

  it('preserves ordinary steps and handles tilted/outward-facing toolbar zoom', () => {
    const { camera } = runtime();
    expect(earthZoomAmount(camera, 1000)).toBe(1000);
    camera.setView({ destination: Cartesian3.fromDegrees(0, 0, far - 100), orientation: { heading: 0, pitch: .3, roll: 0 } });
    const step = earthZoomAmount(camera, 1_000_000);
    expect(step).toBeGreaterThan(0); expect(step).toBeLessThan(1_000_000);
    camera.zoomIn(step);
    expect(camera.positionCartographic.height).toBeCloseTo(far, 5);
  });

  it.each([-Math.PI / 2, -.7, -.1, .2])('cancels native minimum scaling at pitch %s', pitch => {
    const { camera } = runtime();
    camera.setView({ orientation: { heading: .7, pitch, roll: .2 } });
    const factor = Math.max(.25, Math.min(1, Math.abs(Cartesian3.dot(camera.positionWC, camera.directionWC) / Cartesian3.magnitude(camera.positionWC))));
    expect(earthControllerMinimum(camera) * factor).toBeCloseTo(near, 7);
  });
});

describe('Earth camera ownership and render boundary', () => {
  it('bounds native off-axis/rotation movement before refinement without changing the lens or basis', () => {
    const { viewer, camera, scene, controller } = runtime();
    const dispose = installEarthCameraEnvelope(viewer, () => true);
    for (const [height, expected] of [[near - 100, near], [far + 100, far]]) {
      camera.setView({ destination: Cartesian3.fromDegrees(80, -50, height), orientation: { heading: .4, pitch: -.9, roll: .2 } });
      const direction = Cartesian3.clone(camera.directionWC), up = Cartesian3.clone(camera.upWC);
      const lens = camera.frustum as PerspectiveFrustum;
      const optics = [lens.fov, lens.aspectRatio, lens.near, lens.far, lens.xOffset, lens.yOffset];
      scene.preUpdate.raiseEvent(scene);
      expect(controller.minimumZoomDistance).toBeCloseTo(earthControllerMinimum(camera), 8);
      scene.preRender.raiseEvent(scene);
      expect(camera.positionCartographic.height).toBeCloseTo(expected, 5);
      expect(camera.directionWC).toEqual(direction); expect(camera.upWC).toEqual(up);
      expect([lens.fov, lens.aspectRatio, lens.near, lens.far, lens.xOffset, lens.yOffset]).toEqual(optics);
      const stable = Cartesian3.clone(camera.positionWC);
      scene.preRender.raiseEvent(scene);
      expect(camera.positionWC).toEqual(stable);
    }
    dispose();
    expect(scene.preUpdate.numberOfListeners).toBe(0); expect(scene.preRender.numberOfListeners).toBe(0);
  });

  it('preserves Inspection settings, responsive endpoint and both transitions, restoring Earth ownership only on completion', () => {
    const { viewer, camera, scene, controller } = runtime();
    let mode: ViewMode = 'EARTH_OVERVIEW';
    const dispose = installEarthCameraEnvelope(viewer, () => mode === 'EARTH_OVERVIEW');
    const profile = inspectionControlProfile(controller);
    scene.preUpdate.raiseEvent(scene);
    for (const next of ['ENTERING_INSPECTION', 'ISS_INSPECTION', 'EXITING_INSPECTION'] as const) {
      mode = next; profile(next);
      camera.setView({ destination: Cartesian3.fromDegrees(0,0,420_090) });
      const before = Cartesian3.clone(camera.positionWC), min = controller.minimumZoomDistance, max = controller.maximumZoomDistance;
      scene.preUpdate.raiseEvent(scene); scene.preRender.raiseEvent(scene);
      expect(camera.positionWC).toEqual(before); expect(controller.minimumZoomDistance).toBe(min); expect(controller.maximumZoomDistance).toBe(max);
      if (next === 'ISS_INSPECTION') { expect(min).toBe(35); expect(max).toBe(2000); expect(controller.enableZoom).toBe(false); }
    }
    expect(Cartesian3.magnitude(rearInspectionOffset(1.6, new Cartesian3()))).toBeCloseTo(90, 12);
    mode = 'EARTH_OVERVIEW'; profile(mode);
    expect(controller.maximumZoomDistance).toBe(far);
    scene.preUpdate.raiseEvent(scene); scene.preRender.raiseEvent(scene);
    expect(camera.positionCartographic.height).toBeCloseTo(near, 5);
    dispose();
  });

  it('leaves locked startup Sun/Moon preparation and Reset ownership alone', () => {
    const { viewer, camera, scene, controller } = runtime();
    const dispose = installEarthCameraEnvelope(viewer, () => true);
    controller.enableInputs = false;
    camera.setView({ destination: new Cartesian3(100_000_000_000,0,0) });
    const farPlane = camera.frustum.far;
    const before = Cartesian3.clone(camera.positionWC);
    scene.preUpdate.raiseEvent(scene); scene.preRender.raiseEvent(scene);
    expect(camera.positionWC).toEqual(before);
    expect(camera.frustum.far).toBe(farPlane);
    dispose();
  });

  it.each([near, far])('retains the existing Reset journey and exact endpoint from %s', height => {
    const { camera } = runtime();
    camera.setView({ destination: Cartesian3.fromDegrees(-100,-25,height) });
    const start = { position: Cartesian3.clone(camera.positionWC), direction: Cartesian3.clone(camera.directionWC),
      up: Cartesian3.clone(camera.upWC), fov: (camera.frustum as PerspectiveFrustum).fov! };
    const target = earthResetTarget(Cartesian3.fromDegrees(35,40,420_000), start.fov);
    const reset = new EarthResetTransition(start, target, 0);
    expect(reset.evaluate(0)).toEqual(start);
    for (let i = 0; i <= 100; i++) {
      const current = reset.evaluate(i / 100), altitude = Ellipsoid.WGS84.cartesianToCartographic(current.position)!.height;
      expect(altitude).toBeGreaterThanOrEqual(near - 1e-6); expect(altitude).toBeLessThanOrEqual(far + 1e-6);
    }
    expect(Cartesian3.distance(reset.evaluate(1).position, target.position)).toBeLessThan(1e-6);
    expect(reset.duration).toBe(2.5);
  });
});
