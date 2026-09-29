import type { Globe } from 'cesium';

/** Historical visualization imagery, not a live measure of city activity. */
export const NIGHT_LIGHTS = {
  url: '/imagery/black-marble-2016-color.jpg',
  width: 3600,
  height: 1800,
  sha256: 'd87de751a264e4f8ff69c68de5dab9606daee87a6f15ae743c93200743bd7ec1',
  sourceYear: 2016,
  dayAlpha: 0,
  nightAlpha: 1,
} as const;

export function enableEarthLighting(globe: Globe): void {
  globe.enableLighting = true;
  globe.dynamicAtmosphereLighting = true;
  globe.dynamicAtmosphereLightingFromSun = true;
  // Cesium's default camera-distance fade switches lighting off near Earth.
  // Inspection remains ~400 km above the surface, so keep solar shading there.
  globe.lightingFadeOutDistance = 6_370_000;
  globe.lightingFadeInDistance = 6_600_000;
}
