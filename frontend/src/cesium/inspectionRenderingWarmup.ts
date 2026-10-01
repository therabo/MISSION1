import { Cartesian3, type ImageryLayer, type Viewer } from 'cesium';

/** Compile close-view atmosphere variants while the locator still represents the
 * loading model. Camera, textures and final lighting settings are unchanged.
 * Only public properties are used; cleanup restores them if loading is cancelled.
 */
export function warmInspectionRendering(viewer: Viewer, ready: () => void, sceneReady: () => boolean = () => true): () => void {
  const scene = viewer.scene, globe = scene.globe;
  const fadeOut = globe.nightFadeOutDistance, fadeIn = globe.nightFadeInDistance;
  const radius = Cartesian3.magnitude(viewer.camera.positionWC);
  // The lower-altitude atmosphere variant is selected below this threshold.
  // Keep a finite, ordered fade interval during the temporary startup render.
  globe.nightFadeOutDistance = Math.max(fadeOut, radius * 2);
  globe.nightFadeInDistance = Math.max(fadeIn, radius * 3);
  // New surface tiles can render before imagery is ready. Compile that zero-texture
  // variant too, without removing layers, providers or their cached textures.
  const layers = viewer.imageryLayers;
  const alphas = new Map<ImageryLayer, number>();
  const hideImagery = (layer: ImageryLayer): void => {
    if (!alphas.has(layer)) alphas.set(layer, layer.alpha);
    layer.alpha = 0;
  };
  for (let i = 0; i < layers.length; i++) hideImagery(layers.get(i));
  const removeLayerListener = layers.layerAdded.addEventListener(hideImagery);
  const restoreImagery = (): void => {
    removeLayerListener();
    for (const [layer, alpha] of alphas) {
      if (layers.contains(layer)) layer.alpha = alpha;
    }
    alphas.clear();
  };
  let frames = 0, finished = false;
  const restore = (): void => {
    restoreImagery();
    globe.nightFadeOutDistance = fadeOut;
    globe.nightFadeInDistance = fadeIn;
  };
  const remove = scene.postRender.addEventListener(() => {
    // Temporary celestial preparation renders must not count as normal model
    // readiness frames if a cached GLB becomes ready during that idle task.
    if (!sceneReady()) return;
    if (++frames === 2) restoreImagery();
    if (frames === 4) {
      // Normal globe state plus the now texture/feature-ready visible model.
      // Four additional renders submit PBR/silhouette/FXAA/environment work
      // before the control can launch its first transition.
      restore();
    }
    if (frames < 8) return;
    finished = true;
    remove();
    restore();
    ready();
  });
  return () => {
    if (finished) return;
    finished = true;
    remove();
    restore();
  };
}
