/** Shared fragment-space WGS84 visibility. Depth is positive camera -Z metres;
 * the ray uses the current drawing-buffer pixel and public automatic uniforms.
 * A nearer globe limits model protection and ranks adjacent overlap ownership.
 */
export const EARTH_OCCLUSION_GLSL = `
  bool mission1EarthOccludesDepth(float depth) {
    vec2 ndc = (gl_FragCoord.xy - czm_viewport.xy) / czm_viewport.zw * 2.0 - 1.0;
    vec4 rayEC = czm_inverseProjection * vec4(ndc, -1.0, 1.0);
    vec3 q = czm_viewerPositionWC * czm_ellipsoidInverseRadii;
    vec3 ray = (czm_inverseViewRotation * (rayEC.xyz / -rayEC.z)) * czm_ellipsoidInverseRadii;
    float a = dot(ray, ray), b = dot(q, ray), c = dot(q, q) - 1.0, discriminant = b*b - a*c;
    return c < 0.0 || (b < 0.0 && discriminant >= 0.0 &&
      (-b - sqrt(max(discriminant, 0.0))) / a < depth - 1.0);
  }
`;
