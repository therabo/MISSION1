import { PostProcessStage } from 'cesium';

export const INSPECTION_AA_STAGE = 'mission1_inspection_antialiasing';

/** Retain the full-resolution FXAA target/program across mode changes. Read the
 * built-in stage's public shader and add a uniform bypass instead of disabling
 * the stage (which releases its GPU resources). Cesium 1.145 is pinned; fail
 * explicitly if an upgrade changes its GLSL entry point.
 */
export function inspectionAntialiasing(native: PostProcessStage, apply: () => boolean): PostProcessStage {
  const entryPoint = /\bvoid\s+main\s*\(\s*\)\s*\{/g;
  if ([...native.fragmentShader.matchAll(entryPoint)].length !== 1)
    throw new Error('Unsupported Cesium FXAA shader entry point');
  return new PostProcessStage({
    name: INSPECTION_AA_STAGE,
    sampleMode: native.sampleMode,
    fragmentShader: native.fragmentShader.replace(entryPoint, `
      uniform bool u_inspectionFxaa;
      void main() {
        if (!u_inspectionFxaa) {
          out_FragColor = texture(colorTexture, v_textureCoordinates);
          return;
        }
    `),
    uniforms: { u_inspectionFxaa: apply },
  });
}
