import { Cartesian3, Cartographic, Ellipsoid, Matrix4, type Camera, type Viewer } from 'cesium';

/** Measured Earth limb diameters in the two 2880px-wide user references.
 * The existing Cesium lens is 60° along the longer canvas dimension.
 * These measurements define visual framing, not a physical accuracy claim.
 */
export const EARTH_VIEW_REFERENCE = { longSidePixels: 2880, farDiameterPixels: 375,
  nearDiameterPixels: 2680, fovRadians: Math.PI / 3 } as const;

/** Perspective tangent-sphere inversion, using WGS84's equatorial radius.
 * A physical geodetic-height envelope retains the existing responsive lens,
 * projection and Reset pose. It is never an object-visibility or far-plane cap.
 */
export function earthHeightForFraming(diameterFraction: number, fov: number): number {
  return Ellipsoid.WGS84.maximumRadius * (Math.hypot(1, 1 / (diameterFraction * Math.tan(fov / 2))) - 1);
}

export const EARTH_VIEW_MIN_HEIGHT_METERS = earthHeightForFraming(
  EARTH_VIEW_REFERENCE.nearDiameterPixels / EARTH_VIEW_REFERENCE.longSidePixels, EARTH_VIEW_REFERENCE.fovRadians);
export const EARTH_VIEW_MAX_HEIGHT_METERS = earthHeightForFraming(
  EARTH_VIEW_REFERENCE.farDiameterPixels / EARTH_VIEW_REFERENCE.longSidePixels, EARTH_VIEW_REFERENCE.fovRadians);

/** Cesium 1.145 handleZoom multiplies its minimum by this viewing-angle
 * factor even above the terrain-picking altitude. Cancel that factor so its
 * native wheel/right-drag/pinch limit is our geodetic height, also off nadir.
 */
export function earthControllerMinimum(camera: Camera): number {
  const position = camera.positionWC;
  const cosine = Math.abs(Cartesian3.dot(position, camera.directionWC) / Cartesian3.magnitude(position));
  return EARTH_VIEW_MIN_HEIGHT_METERS / Math.max(0.25, Math.min(1, cosine));
}

/** Bound the existing toolbar's straight-line native zoom before it moves.
 * Preserve its amount inside the envelope; bisect only a boundary crossing.
 * This also handles a tilted or outward-facing camera, without a fly/snap-back.
 */
export function earthZoomAmount(camera: Camera, amount: number): number {
  const position = camera.positionWC, direction = camera.directionWC;
  const point = new Cartesian3(), geo = new Cartographic();
  const heightAt = (fraction: number): number => {
    Cartesian3.multiplyByScalar(direction, amount * fraction, point);
    Cartesian3.add(position, point, point);
    return Ellipsoid.WGS84.cartesianToCartographic(point, geo)?.height ?? -Infinity;
  };
  const inside = (height: number): boolean => height >= EARTH_VIEW_MIN_HEIGHT_METERS && height <= EARTH_VIEW_MAX_HEIGHT_METERS;
  if (inside(heightAt(1))) return amount;
  const height = camera.positionCartographic.height;
  const inward = Cartesian3.dot(Ellipsoid.WGS84.geodeticSurfaceNormal(position, point), direction) * amount < 0;
  if ((inward && height <= EARTH_VIEW_MIN_HEIGHT_METERS + 1e-6) ||
      (!inward && height >= EARTH_VIEW_MAX_HEIGHT_METERS - 1e-6)) return 0;
  let low = 0, high = 1;
  for (let i = 0; i < 48; i++) {
    const middle = (low + high) / 2;
    if (inside(heightAt(middle))) low = middle;
    else high = middle;
  }
  return amount * low;
}

/** The existing Earth owner uses public controller settings and scene events.
 * Native zoom's directional distance and ellipsoid rotation are not strict
 * geodetic-height constraints. Close that gap before Globe refinement/render,
 * without an animation, timer, event queue or a second gesture controller.
 * Temporary startup celestial draws lock inputs and must remain unrestricted.
 */
export function installEarthCameraEnvelope(viewer: Viewer, ownsCamera: () => boolean): () => void {
  const scene = viewer.scene, camera = viewer.camera, controller = scene.screenSpaceCameraController;
  controller.minimumZoomDistance = EARTH_VIEW_MIN_HEIGHT_METERS;
  controller.maximumZoomDistance = EARTH_VIEW_MAX_HEIGHT_METERS;
  const geo = new Cartographic(), world = new Cartesian3(), inverse = new Matrix4();
  const removeUpdate = scene.preUpdate.addEventListener(() => {
    if (ownsCamera() && controller.enableInputs) controller.minimumZoomDistance = earthControllerMinimum(camera);
  });
  const removeRender = scene.preRender.addEventListener(() => {
    if (!ownsCamera() || !controller.enableInputs) return;
    const height = camera.positionCartographic.height;
    const bounded = Math.max(EARTH_VIEW_MIN_HEIGHT_METERS, Math.min(EARTH_VIEW_MAX_HEIGHT_METERS, height));
    if (Math.abs(bounded - height) < 1e-6) return;
    Cartographic.clone(camera.positionCartographic, geo);
    geo.height = bounded;
    Ellipsoid.WGS84.cartographicToCartesian(geo, world);
    Matrix4.inverseTransformation(camera.transform, inverse);
    Matrix4.multiplyByPoint(inverse, world, camera.position);
  });
  return () => { removeUpdate(); removeRender(); };
}
