import { Material, PolylineMaterialAppearance } from 'cesium';

function shaderSources() {
  const stock = new PolylineMaterialAppearance();
  const vertex = stock.vertexShaderSource.replace('void main()', 'void mission1PolylineMain()');
  stock.material.destroy();
  return { vertex };
}
let sources: ReturnType<typeof shaderSources> | undefined;

/** Public Fabric names are read from the pinned generated material source. */
function uniformName(material: Material, name: string): string {
  const match = material.shaderSource.match(new RegExp(`uniform float (${name}(?:_\\d+)?);`));
  if (!match) throw new Error(`Missing trajectory material uniform: ${name}`);
  return match[1];
}

/** Non-folding capsule quads, with a single owner in adjacent capsule overlap.
 * All projection and near-plane clipping happen on the GPU. Retained physical
 * PolylineGeometry vertices and source interpolation are camera-independent.
 */
export function trajectoryAppearance(material: Material, sampleCount: number): PolylineMaterialAppearance {
  const { vertex } = sources ??= shaderSources(), dt = 1 / (sampleCount - 1);
  const start = uniformName(material, 'futureStart'), end = uniformName(material, 'forwardEnd');
  return new PolylineMaterialAppearance({ material, translucent: true,
    vertexShaderSource: `${vertex}
      in vec3 beforeHigh; in vec3 beforeLow;
      in vec3 afterHigh; in vec3 afterLow;
      flat out vec4 v_mission1Segment;
      flat out vec4 v_mission1Before;
      flat out vec4 v_mission1After;
      flat out vec4 v_mission1Time;
      flat out vec4 v_mission1BeforeTime;
      flat out vec4 v_mission1AfterTime;
      flat out float v_mission1HalfWidth;
      flat out vec2 v_mission1Neighbors;
      void projectSegment(vec4 p, vec4 q, vec2 times, out vec4 screen, out vec4 timeDepth, out bool culled) {
        float extent = length(q.xyz - p.xyz);
        if (extent < 0.000001) {
          culled = p.z > -czm_currentFrustum.x;
          vec4 window = czm_eyeToWindowCoordinates(p);
          screen = culled ? vec4(0.0) : vec4(window.xy, window.xy);
          timeDepth = vec4(times, max(-p.z, 0.000001), max(-p.z, 0.000001));
          return;
        }
        vec4 aWC, bWC, aEC, bEC; bool ac, bc, au, bu;
        clipLineSegmentToNearPlane(p.xyz, q.xyz, aWC, ac, au, aEC);
        clipLineSegmentToNearPlane(q.xyz, p.xyz, bWC, bc, bu, bEC);
        extent = max(extent, 0.000001);
        vec2 fraction = vec2(length(aEC.xyz - p.xyz), length(bEC.xyz - q.xyz)) / extent;
        screen = vec4(aWC.xy, bWC.xy);
        timeDepth = vec4(mix(times.x, times.y, fraction.x), mix(times.y, times.x, fraction.y), -aEC.z, -bEC.z);
        culled = au || bu;
        if (culled) { screen = vec4(0.0); timeDepth = vec4(times, 1.0, 1.0); }
      }
      void main() {

        bool usePrevious = expandAndWidth.y < 0.0;
        vec4 current = czm_modelViewRelativeToEye * czm_computePosition();
        vec4 other = czm_modelViewRelativeToEye * (usePrevious ? czm_computePrevPosition() : czm_computeNextPosition());
        vec4 a = usePrevious ? other : current, b = usePrevious ? current : other;
        float firstTime = st.s - (usePrevious ? ${dt} : 0.0);
        bool culled, beforeCulled, afterCulled;
        projectSegment(a, b, vec2(firstTime, firstTime + ${dt}), v_mission1Segment, v_mission1Time, culled);
        vec4 before = czm_modelViewRelativeToEye * czm_translateRelativeToEye(beforeHigh, beforeLow);
        vec4 after = czm_modelViewRelativeToEye * czm_translateRelativeToEye(afterHigh, afterLow);
        projectSegment(before, a, vec2(firstTime - ${dt}, firstTime), v_mission1Before, v_mission1BeforeTime, beforeCulled);
        projectSegment(b, after, vec2(firstTime + ${dt}, firstTime + ${2*dt}), v_mission1After, v_mission1AfterTime, afterCulled);
        v_mission1Neighbors = vec2(firstTime > ${dt / 2} && !beforeCulled ? 1.0 : 0.0,
          firstTime < 1.0 - ${1.5*dt} && !afterCulled ? 1.0 : 0.0);
        vec2 edge = v_mission1Segment.zw - v_mission1Segment.xy;
        float edgeLength = length(edge);
        vec2 forward = edgeLength > 0.000001 ? edge / edgeLength : vec2(1.0, 0.0);
        vec2 left = vec2(-forward.y, forward.x);
        float halfWidth = (abs(expandAndWidth.y) + 0.5) * 0.5 * czm_pixelRatio;
        vec2 offset = halfWidth * (left * expandAndWidth.x + forward * (usePrevious ? 1.0 : -1.0));
        vec4 aWC, aEC; bool clipped, unused;
        clipLineSegmentToNearPlane(current.xyz, other.xyz, aWC, clipped, unused, aEC);
        gl_Position = culled ? vec4(0.0, 0.0, 0.0, 1.0) : czm_viewportOrthographic *
          (vec4(aWC.xy + offset, -aWC.z, 1.0) * (czm_projection * aEC).w);
        v_mission1HalfWidth = halfWidth;
      }`,
    fragmentShaderSource: `
      flat in vec4 v_mission1Segment; flat in vec4 v_mission1Before; flat in vec4 v_mission1After;
      flat in vec4 v_mission1Time; flat in vec4 v_mission1BeforeTime; flat in vec4 v_mission1AfterTime;
      flat in float v_mission1HalfWidth; flat in vec2 v_mission1Neighbors;
      vec3 capsule(vec4 segment, vec4 timeDepth) {
        vec2 edge = segment.zw - segment.xy;
        float phase = clamp(dot(gl_FragCoord.xy - segment.xy, edge) / max(dot(edge, edge), 0.000001), 0.0, 1.0);
        float denominator = max(mix(1.0 / max(timeDepth.z, 0.000001), 1.0 / max(timeDepth.w, 0.000001), phase), 0.000000000001);
        float temporalPhase = (phase / max(timeDepth.w, 0.000001)) / denominator;
        return vec3(length(gl_FragCoord.xy - mix(segment.xy, segment.zw, phase)), mix(timeDepth.x, timeDepth.y, temporalPhase), 1.0 / denominator);
      }
      bool ownsOverlap(vec3 neighbor, vec3 own, bool ownHidden, bool previous) {
        // Rank only actual overlapping coverage: foreground first, then nearest.
        // This never clips the physical trail or a nonadjacent crossing.
        if (neighbor.x > v_mission1HalfWidth) return false;
        bool hidden = mission1EarthOccludesDepth(neighbor.z);
        if (hidden != ownHidden) return ownHidden;
        return previous ? neighbor.x <= own.x : neighbor.x < own.x;
      }
      void main() {
        vec3 own = capsule(v_mission1Segment, v_mission1Time);
        vec3 before = capsule(v_mission1Before, v_mission1BeforeTime), after = capsule(v_mission1After, v_mission1AfterTime);
        bool beforeVisible = v_mission1Neighbors.x > 0.0 && before.y > ${start} && before.y < ${end};
        bool afterVisible = v_mission1Neighbors.y > 0.0 && after.y > ${start} && after.y < ${end};
        bool ownHidden = mission1EarthOccludesDepth(own.z);
        if ((beforeVisible && ownsOverlap(before, own, ownHidden, true)) ||
            (afterVisible && ownsOverlap(after, own, ownHidden, false))) discard;
        czm_materialInput materialInput;
        vec2 st = vec2(own.y, 0.5 + own.x / max(2.0 * v_mission1HalfWidth, 0.000001));
        materialInput.s = st.s; materialInput.st = st; materialInput.str = vec3(st, 0.0);
        czm_material result = czm_getMaterial(materialInput);
        out_FragColor = vec4(result.diffuse + result.emission, result.alpha);
        czm_writeLogDepth();
      }`,
  });
}
