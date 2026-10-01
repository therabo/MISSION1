import { Cartesian3, type Viewer } from 'cesium';

/** Compile the close-view atmosphere variant while the locator still represents the
 * loading model. Camera, textures and final lighting settings are unchanged.
 * Only public properties are used; cleanup restores them if loading is cancelled.
 */
export function warmInspectionRendering(viewer: Viewer, ready: () => void): () => void {
  const scene = viewer.scene, globe = scene.globe;
  const fadeOut = globe.nightFadeOutDistance, fadeIn = globe.nightFadeInDistance;
  const radius = Cartesian3.magnitude(viewer.camera.positionWC);
  // The lower-altitude atmosphere variant is selected below this threshold.
  // Keep a finite, ordered fade interval during the temporary startup render.
  globe.nightFadeOutDistance = Math.max(fadeOut, radius * 2);
  globe.nightFadeInDistance = Math.max(fadeIn, radius * 3);
  let frames = 0, finished = false;
  const restore = (): void => {
    globe.nightFadeOutDistance = fadeOut;
    globe.nightFadeInDistance = fadeIn;
  };
  const remove = scene.postRender.addEventListener(() => {
    if (++frames < 2) return;
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
