import { CustomShader } from 'cesium';

/** Screen-space specular antialiasing. Full NASA color/normal textures and
 * authored metallic/roughness factors remain inputs; only unresolved normal
 * variance widens the highlight. The cap avoids flattening resolved detail.
 * Method: https://google.github.io/filament/main/materials.html#specularantialiasing
 */
export function createIssMaterialShader(): CustomShader {
  return new CustomShader({ fragmentShaderText: `
    void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
      vec3 dx = dFdx(material.normalEC);
      vec3 dy = dFdy(material.normalEC);
      float variance = 0.15 * (dot(dx, dx) + dot(dy, dy));
      float kernel = min(2.0 * variance, 0.18);
      float r2 = material.roughness * material.roughness;
      material.roughness = sqrt(sqrt(min(1.0, r2 * r2 + kernel)));
    }
  ` });
}
