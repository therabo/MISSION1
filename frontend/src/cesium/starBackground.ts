import { CubeMapPanorama, Matrix3, Transforms, type JulianDate, type SkyBox } from 'cesium';

/** Native environment cubemap. Its matrix is refreshed from the same coherent
 * render time as Cesium's Sun/Moon/lighting; it owns no clock or temporal mode. */
export function starBackgroundFactory(sceneTime: () => JulianDate): (sources: SkyBox['sources']) => SkyBox {
  return sources => new CubeMapPanorama({
    sources,
    transform: Transforms.computeTemeToPseudoFixedMatrix(sceneTime(), new Matrix3()),
    // Cesium 1.145 SkyBox uses this same delegation option. Return the native
    // environment command to Scene.skyBox, preserving its draw order before
    // atmosphere/Sun/Moon rather than adding a later panorama primitive.
    returnCommand: true,
  });
}

export function updateStarBackground(background: SkyBox, sceneTime: JulianDate): void {
  Transforms.computeTemeToPseudoFixedMatrix(sceneTime, (background as CubeMapPanorama).transform);
}
