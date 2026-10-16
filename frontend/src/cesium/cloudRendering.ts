import { Cartesian3, Credit, CullFace, Ellipsoid, EllipsoidGeometry, GeometryInstance,
  Material, MaterialAppearance, Primitive, TextureMagnificationFilter, TextureMinificationFilter, type Viewer } from 'cesium';
import { CloudRefresh, type CloudRenderer } from './cloudRefresh';
import { acquireCloudImage, CLOUD_SOURCE } from './cloudSource';

/** DISPLAY CLOUD SHELL ALTITUDE; not a meteorological cloud-height assertion. */
export const CLOUD_DISPLAY_ALTITUDE_METERS = 15_000;

export const CLOUD_MATERIAL = `
czm_material czm_getMaterial(czm_materialInput materialInput) {
  czm_material result = czm_getDefaultMaterial(materialInput);
  // EllipsoidGeometry starts s at Greenwich; source starts at -180 longitude.
  vec2 uv = vec2(fract(materialInput.st.s + 0.5), materialInput.st.t);
  float coverage = texture(image, uv).r;
  float alpha = 0.82 * pow(smoothstep(0.08, 0.95, coverage), 1.15);
  vec3 normal = normalize(materialInput.normalEC);
  float sunlight = dot(normal, czm_sunDirectionEC);
  float day = smoothstep(-0.10, 0.22, sunlight);
  // A subdued visual ambient floor keeps structure perceptible in full shadow.
  // Solar illumination changes RGB only; coverage and the readiness gate stay independent.
  vec3 dayColor = dayTint * (0.70 + 0.30 * max(sunlight, 0.0));
  result.diffuse = mix(nightTint, dayColor, day);
  result.alpha = alpha * ready;
  return result;
}`;

/** One geometry and one public Fabric sampler. Cesium 1.145 Material prepares
 * the new decoded image texture before destroying its old sampler texture.
 * No Texture/Context internals are used by application code. */
export function createCloudRenderer(viewer: Viewer): CloudRenderer {
  const radii = Cartesian3.add(Ellipsoid.WGS84.radii,
    new Cartesian3(CLOUD_DISPLAY_ALTITUDE_METERS, CLOUD_DISPLAY_ALTITUDE_METERS, CLOUD_DISPLAY_ALTITUDE_METERS), new Cartesian3());
  const material = new Material({ fabric: {
    type: 'Mission1CloudCoverage', uniforms: { image: Material.DefaultImageId, ready: 0,
      nightTint: new Cartesian3(0.16, 0.18, 0.22), dayTint: new Cartesian3(0.76, 0.81, 0.86) }, source: CLOUD_MATERIAL,
  }, translucent: true, minificationFilter: TextureMinificationFilter.LINEAR,
    magnificationFilter: TextureMagnificationFilter.LINEAR });
  const primitive = viewer.scene.primitives.add(new Primitive({
    geometryInstances: new GeometryInstance({ geometry: new EllipsoidGeometry({ radii,
      stackPartitions: 128, slicePartitions: 256, vertexFormat: MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat }) }),
    appearance: new MaterialAppearance({ material, flat: true, faceForward: false,
      translucent: true, closed: false, renderState: { depthTest: { enabled: true }, depthMask: false,
        cull: { enabled: true, face: CullFace.BACK } } }),
    allowPicking: false,
    show: false,
  }));
  let imageReady = false;
  let visible = false;
  let initialFrames = 0;
  const removeRender = viewer.scene.postRender.addEventListener(() => {
    if (!visible || !imageReady || !primitive.ready || initialFrames >= 2) return;
    initialFrames += 1;
    if (initialFrames === 2) { material.uniforms.ready = 1; viewer.scene.requestRender(); }
  });
  return {
    replace(image) { material.uniforms.image = image; imageReady = true; viewer.scene.requestRender(); },
    show(show) {
      visible = show;
      // A hidden primitive cannot upload. The initial alpha gate is safe;
      // subsequent replacements retain old GPU coverage until upload completes.
      primitive.show = show && imageReady;
      viewer.scene.requestRender();
    },
    destroy() {
      removeRender();
      viewer.scene.primitives.remove(primitive);
      if (!material.isDestroyed()) material.destroy();
    },
  };
}

export function installClouds(viewer: Viewer): CloudRefresh {
  viewer.creditDisplay.addStaticCredit(new Credit(
    '<a href="https://github.com/matteason/live-cloud-maps" target="_blank" rel="noopener noreferrer">Cloud imagery: live-cloud-maps</a> · ' +
    '<a href="https://www.eumetsat.int/legal-framework/data-policy" target="_blank" rel="noopener noreferrer">Contains modified EUMETSAT data</a> · observation time unknown',
  ));
  // Read the already-created canvas context through standard WebGL, without
  // changing its attributes or reaching into Cesium's private texture owner.
  const gl = viewer.canvas.getContext('webgl2') ?? viewer.canvas.getContext('webgl');
  const supported = gl !== null && gl.getParameter(gl.MAX_TEXTURE_SIZE) >= CLOUD_SOURCE.width;
  return new CloudRefresh(createCloudRenderer(viewer), supported ? acquireCloudImage : async () => {
    // Optional clouds stay absent on limited devices; never attempt an invalid
    // GPU upload, download an unusable image, or interrupt the Earth/ISS scene.
    throw new Error('Cloud texture exceeds device capability');
  });
}
