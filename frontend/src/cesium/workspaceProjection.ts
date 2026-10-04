import { Cartesian2, Material, PerspectiveFrustum, type Model, type Scene } from 'cesium';

/** Cesium 1.145 GlobeFS reconstructs the far ground-atmosphere ray from a
 * symmetric window and twice right/top pixel dimensions. A neutral public
 * Fabric material corrects that ray to the actual projection. Alpha zero
 * preserves imagery colour; existing scattering/lighting is untouched.
 * Scoped to the far atmosphere branch of this 3D, unclipped, unsplit globe.
 * Revalidate shader composition when upgrading Cesium or adding those modes.
 */
export function createWorkspaceGlobeProjection(): Material {
  return new Material({ translucent: false, fabric: {
    type: 'Mission1WorkspaceProjection',
    source: `
czm_material czm_getMaterial(czm_materialInput inputValue) {
    czm_material result = czm_getDefaultMaterial(inputValue);
    result.alpha = 0.0;
    return result;
}
#ifdef PER_FRAGMENT_GROUND_ATMOSPHERE
float mission1WorkspaceMetersPerPixel(vec4 positionEC, float pixelRatio) {
    vec2 span = vec2(czm_frustumPlanes.w - czm_frustumPlanes.z,
                     czm_frustumPlanes.x - czm_frustumPlanes.y);
    return max(span.x / czm_viewport.z, span.y / czm_viewport.w)
        * (-positionEC.z / czm_currentFrustum.x) * pixelRatio;
}
#define czm_metersPerPixel mission1WorkspaceMetersPerPixel
#define gl_FragCoord (gl_FragCoord + vec4(czm_projection[2].xy * czm_viewport.zw * 0.5, 0.0, 0.0))
#endif
`,
  } });
}

const scaleAwareFrustums = new WeakSet<PerspectiveFrustum>();
/** Cesium partitions scene depth by changing a working clone's public near
 * plane. Near-plane offsets must scale with it to retain one projected center
 * across globe/model/atmosphere passes. Preserve clone result identity. */
function scaleOffsetsWithNear(frustum: PerspectiveFrustum): void {
  if (scaleAwareFrustums.has(frustum)) return;
  let near = frustum.near;
  Object.defineProperty(frustum, 'near', { enumerable: true, configurable: true,
    get: () => near,
    set: (next: number) => {
      if (near > 0 && next > 0) {
        frustum.xOffset *= next / near;
        frustum.yOffset *= next / near;
      }
      near = next;
    } });
  scaleAwareFrustums.add(frustum);
}

/** Cesium 1.145's off-center pixel-size helper uses twice right/top instead of
 * right-left/top-bottom. Delegate pixel scale to an equivalent symmetric lens
 * so minimumPixelSize, picking and model scale cannot depend on composition. */
export class WorkspacePerspectiveFrustum extends PerspectiveFrustum {
  private readonly pixelLens = new PerspectiveFrustum();
  override clone(result?: PerspectiveFrustum): PerspectiveFrustum {
    const copy = super.clone(result);
    // Cesium 1.145's native clone omits the two public offsets.
    copy.xOffset = this.xOffset;
    copy.yOffset = this.yOffset;
    scaleOffsetsWithNear(copy);
    return copy;
  }
  override getPixelDimensions(width: number, height: number, distance: number, pixelRatio: number, result: Cartesian2): Cartesian2 {
    this.clone(this.pixelLens);
    this.pixelLens.xOffset = 0; this.pixelLens.yOffset = 0;
    return this.pixelLens.getPixelDimensions(width, height, distance, pixelRatio, result);
  }
}

/** Public near-plane offsets. Preserve the symmetric lens's FOV/pixel scale. */
export function applyWorkspaceProjection(frustum: PerspectiveFrustum, offsetX: number, offsetY: number): void {
  const halfHeight = frustum.near * Math.tan(frustum.fovy! / 2);
  frustum.xOffset = -2 * offsetX * halfHeight * frustum.aspectRatio!;
  frustum.yOffset = 2 * offsetY * halfHeight;
}

/** Cesium 1.145 projects offsets correctly, but its perspective input ray and
 * pick culling volume assume a symmetric lens. Adapt only this scene instance's
 * public methods, retaining Cesium's native ray and GPU feature-ID picking.
 * No engine/prototype/private-field patch, DOM translation or physical pose edit.
 */
export function installWorkspacePicking(scene: Scene, dimensions: () => { width: number; height: number },
  currentModel: () => Model | null): () => void {
  const camera = scene.camera;
  const nativeRay = camera.getPickRay;
  const nativePick = scene.pick;
  const rayPixel = new Cartesian2();
  const pickPixel = new Cartesian2();
  // Pick rendering also clones the lens into Cesium's reused working frustum.
  // Explicitly carry zero offsets through that clone, clearing the render shift.
  const pickFrustum = new WorkspacePerspectiveFrustum();
  const symmetricPixel = (position: Cartesian2, result: Cartesian2): Cartesian2 => {
    const frustum = camera.frustum;
    const { width, height } = dimensions();
    if (!(frustum instanceof PerspectiveFrustum) || width <= 0 || height <= 0) return Cartesian2.clone(position, result);
    const halfHeight = frustum.near * Math.tan(frustum.fovy! / 2);
    result.x = position.x + frustum.xOffset * width / (2 * halfHeight * frustum.aspectRatio!);
    result.y = position.y - frustum.yOffset * height / (2 * halfHeight);
    return result;
  };
  camera.getPickRay = function(position, result) {
    return nativeRay.call(this, symmetricPixel(position, rayPixel), result);
  };
  scene.pick = function(position, width, height) {
    const renderFrustum = camera.frustum;
    if (!(renderFrustum instanceof PerspectiveFrustum) || (!renderFrustum.xOffset && !renderFrustum.yOffset))
      return nativePick.call(this, position, width, height);
    const size = dimensions();
    symmetricPixel(position, pickPixel);
    // A shifted visible edge may lie outside the equivalent symmetric lens.
    // Expand only the synchronous pick lens so every visible pixel stays valid.
    const margin = Math.min(0.5, 6 / Math.min(size.width, size.height));
    const expansion = Math.max(1, Math.abs(2 * pickPixel.x / size.width - 1) / (1 - margin),
      Math.abs(2 * pickPixel.y / size.height - 1) / (1 - margin));
    renderFrustum.clone(pickFrustum);
    pickFrustum.xOffset = 0; pickFrustum.yOffset = 0;
    pickFrustum.fov = 2 * Math.atan(Math.tan(renderFrustum.fov! / 2) * expansion);
    pickPixel.x = size.width / 2 + (pickPixel.x - size.width / 2) / expansion;
    pickPixel.y = size.height / 2 + (pickPixel.y - size.height / 2) / expansion;
    const model = currentModel();
    const minimum = model?.minimumPixelSize;
    try {
      camera.frustum = pickFrustum;
      // Keep the model's physical display scale identical in the expanded lens.
      if (model && minimum !== undefined && expansion > 1) model.minimumPixelSize = minimum / expansion;
      return nativePick.call(this, pickPixel, expansion > 1 ? 1 : width, expansion > 1 ? 1 : height);
    } finally {
      camera.frustum = renderFrustum;
      if (model && minimum !== undefined) model.minimumPixelSize = minimum;
    }
  };
  return () => { camera.getPickRay = nativeRay; scene.pick = nativePick; };
}
