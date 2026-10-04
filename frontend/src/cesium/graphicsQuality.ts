/** Desktop quality policy; Cesium may cap MSAA to the active WebGL2 hardware. */
export const GRAPHICS_QUALITY = {
  useBrowserRecommendedResolution: false,
  // Cesium already resolves its MSAA 4 target before the retained FXAA/copy
  // stage. A multisampled browser drawing buffer only resamples that quad.
  browserAntialias: false,
  msaaSamples: 4,
  inspectionFxaa: true,
  groundFogMaximumHeightMeters: 100_000,
  modelEnvironmentPositionEpsilon: Number.POSITIVE_INFINITY,
  modelEnvironmentTimeEpsilon: Number.POSITIVE_INFINITY,
  lowDprResolutionScale: 1.25,
  dprThreshold: 1.5,
  sunGlowFactor: 0.6,
  sunBloom: true,
  highDynamicRange: false,
} as const;

/** Native device pixels are the floor; low-DPI desktops get modest supersampling. */
export function resolutionScaleForDpr(dpr: number): number {
  return Number.isFinite(dpr) && dpr > 0 && dpr < GRAPHICS_QUALITY.dprThreshold
    ? GRAPHICS_QUALITY.lowDprResolutionScale : 1;
}
