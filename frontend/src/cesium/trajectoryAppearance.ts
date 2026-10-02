import { Material, PolylineMaterialAppearance } from 'cesium';

// Extend the public appearance shader sources of pinned Cesium 1.145. The
// original extrusion/depth pipeline and physical PolylineGeometry stay intact.
function shaderSources() {
  const stock = new PolylineMaterialAppearance();
  const vertex = stock.vertexShaderSource.replace('void main()', 'void mission1PolylineMain()');
  const fragment = stock.fragmentShaderSource.replace(
  'st.t = czm_readNonPerspective(st.t, gl_FragCoord.w);',
  `vec4 segment = czm_readNonPerspective(v_mission1Segment, gl_FragCoord.w);
    vec2 edge = segment.zw - segment.xy;
    float phase = clamp(dot(gl_FragCoord.xy - segment.xy, edge) / max(dot(edge, edge), 0.000001), 0.0, 1.0);
    float distanceToSegment = length(gl_FragCoord.xy - mix(segment.xy, segment.zw, phase));
    float halfWidth = czm_readNonPerspective(v_mission1HalfWidth, gl_FragCoord.w);
    // A capsule in drawing-buffer pixels bounds a folded miter's contribution.
    // Preserve PolylineGlow's existing profile over the unchanged line width.
    st.t = 0.5 + distanceToSegment / max(2.0 * halfWidth, 0.000001);`,
);
  stock.material.destroy();
  return { vertex, fragment };
}
let sources: ReturnType<typeof shaderSources> | undefined;

/** Raster coverage of each genuine source segment, including near-plane clips.
 * Joined extrusion can otherwise stretch st.t into protruding triangles when a
 * projected curve folds back on itself. This adds no CPU projection or vertices.
 */
export function trajectoryAppearance(material: Material, sampleCount: number): PolylineMaterialAppearance {
  const { vertex, fragment } = sources ??= shaderSources();
  return new PolylineMaterialAppearance({ material, translucent: true,
    vertexShaderSource: `${vertex}
      out vec4 v_mission1Segment;
      out float v_mission1HalfWidth;
      void main() {
        mission1PolylineMain();
        bool usePrevious = expandAndWidth.y < 0.0;
        vec4 positionEC = czm_modelViewRelativeToEye * czm_computePosition();
        vec4 otherEC = czm_modelViewRelativeToEye * (usePrevious ? czm_computePrevPosition() : czm_computeNextPosition());
        vec4 aWC, bWC, aEC, bEC;
        bool aClipped, bClipped, aCulled, bCulled;
        clipLineSegmentToNearPlane(positionEC.xyz, otherEC.xyz, aWC, aClipped, aCulled, aEC);
        clipLineSegmentToNearPlane(otherEC.xyz, positionEC.xyz, bWC, bClipped, bCulled, bEC);
        vec4 segment = usePrevious ? vec4(bWC.xy, aWC.xy) : vec4(aWC.xy, bWC.xy);
        v_mission1Segment = czm_writeNonPerspective(segment, gl_Position.w);
        v_mission1HalfWidth = czm_writeNonPerspective((abs(expandAndWidth.y) + 0.5) * 0.5 * czm_pixelRatio, gl_Position.w);
        // A clipped endpoint still represents its real interpolated source time.
        float fraction = length(aEC.xyz - positionEC.xyz) / max(length(otherEC.xyz - positionEC.xyz), 0.000001);
        v_st.s = st.s + (usePrevious ? -1.0 : 1.0) * ${1 / (sampleCount - 1)} * fraction;
      }`,
    fragmentShaderSource: `in vec4 v_mission1Segment;\nin float v_mission1HalfWidth;\n${fragment}`,
  });
}
