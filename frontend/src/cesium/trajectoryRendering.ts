import {
  Cartesian2, Cartesian3, Color, GeometryInstance, Material,
  JulianDate, Primitive, type PrimitiveCollection, type SampledPositionProperty, type Scene,
} from 'cesium';
import type { ComparisonResponse, TrajectorySample } from '../orbital/comparison';
import type { TrajectorySource } from './trajectorySelection';
import { makeSampledPosition } from './sampleProperty';
import { earliestClearTime, initialRegion, projectedSourceEvaluator, protectedCircle, startRampCssPixels, type InitialRegion, type Pixel } from './trajectoryClearance';
import { EARTH_OCCLUSION_GLSL } from './trajectoryCoverage';
import { trajectoryGeometry } from './trajectoryGeometry';
import { trajectoryAppearance } from './trajectoryAppearance';

// Distinct selected accents make a switch visible even for subpixel-coincident paths.
export const TRAJECTORY_ACCENTS = { PRIMARY_GP_TLE: '#53d9cd', NASA_OEM: '#edb86a' } as const;

export const FORWARD_TRAIL = {
  direction: 'FUTURE_DIRECTION_ONLY', horizonRevolutions: 0.85,
  inactiveColor: '#71939c', activeAlpha: 0.85, inactiveAlpha: 0.08,
  layers: [
    { name: 'halo', width: 20, alphaScale: 0.26, glowPower: 0.35 },
    { name: 'body', width: 8, alphaScale: 1, glowPower: 0.22 },
  ],
} as const;

export function forwardBounds(sceneMs: number, periodSeconds: number, coverageEndMs: number, gapSeconds: number) {
  return { startMs: sceneMs + gapSeconds * 1000,
    endMs: Math.min(sceneMs + FORWARD_TRAIL.horizonRevolutions * periodSeconds * 1000, coverageEndMs) };
}

/** Inverse smoothstep, monotonic and exactly zero at the real visible endpoint. */
export function forwardOpacity(sampleMs: number, startMs: number, endMs: number, rampMs = 0): number {
  if (sampleMs < startMs || sampleMs >= endMs || endMs <= startMs) return 0;
  const u = (sampleMs - startMs) / (endMs - startMs);
  const ramp = rampMs > 0 ? Math.min(1, (sampleMs - startMs) / rampMs) : 1;
  return ramp * ramp * (3 - 2 * ramp) * (1 - u * u * (3 - 2 * u));
}

/** Public Fabric composition retains the soft glow envelope. st.s is the uniform
 * sample-time fraction. Clip the past/start gap and all times beyond the horizon.
 * Temporal, projection and selection uniforms change per tick; geometry is exact.
 */
export function trailMaterial(alphaScale: number, glowPower: number): Material {
  // Temporal clipping belongs only to the physical future window. First-exit
  // branches may merge at a tangent; they must never clip a safe body fragment.
  const start = 'smoothstep(futureStart, futureStart + startRamp, materialInput.st.s)';
  const width = `(${start} * clearanceMask.alpha)`;
  return new Material({ strict: true, translucent: true, fabric: {
    type: 'Mission1ForwardTrail',
    uniforms: { trailColor: Color.fromCssColorString(TRAJECTORY_ACCENTS.PRIMARY_GP_TLE),
      maximumAlpha: FORWARD_TRAIL.activeAlpha * alphaScale, futureStart: 0, forwardStart: 0, forwardEnd: 0.85, startRamp: 0.001 },
    materials: { edgeGlow: { type: 'PolylineGlow', uniforms: { color: Color.WHITE, glowPower, taperPower: 1 } },
      clearanceMask: clearanceMaterial() },
    components: {
      emission: 'trailColor.rgb',
      alpha: `clearanceMask.alpha * edgeGlow.alpha * maximumAlpha * ${start} * (1.0 - smoothstep(0.5 * ${width}, 0.5 * ${width} + 0.025, abs(materialInput.st.t - 0.5))) * (1.0 - smoothstep(forwardStart, forwardEnd, materialInput.st.s))`,
    },
  } });
}

export interface ForwardTrail {
  readonly source: TrajectorySource;
  readonly positions: Cartesian3[];
  readonly layers: { primitive: Primitive; material: Material }[];
  readonly startMs: number;
  readonly endMs: number;
  readonly periodSeconds: number;
  readonly position: SampledPositionProperty;
  readonly sampleTimes: number[];
  /** First exit if found within the model/halo-derived local search. */
  firstExitMs: number | null;
  /** Initial protection end; includes bounded fallback, never a body cutoff. */
  gapSeconds: number | null;
}
export interface TrajectoryTrails { generatedMs: number; trails: ForwardTrail[] }

const maskCircle = { x: 0, y: 0, radius: 0 };
const maskRegion: InitialRegion = { x: 0, y: 0, radius: 0, ax: 0, ay: 0, tx: 0, ty: 0, ux: 0, uy: 0, external: false };
const localDate = new Date();
const localTime = new JulianDate();
const localPosition = new Cartesian3();
const nextPosition = new Cartesian3();

export function adaptTrailClearance(trail: ForwardTrail, sceneMs: number, scene: Scene,
  hull: Pixel[] | null, desiredGap: number, silhouetteSize: number, stationNearDepth = 1e20): void {
  const begin = Math.max(sceneMs + 1, trail.startMs);
  const endMs = Math.min(sceneMs + FORWARD_TRAIL.horizonRevolutions * trail.periodSeconds * 1000, trail.endMs);
  // A local projection failure must not blank the safe far trail. Protection
  // remains in the current-frame fragment mask, with no source extrapolation.
  trail.gapSeconds = Math.max(0.001, (begin - sceneMs) / 1000);
  trail.firstExitMs = null;
  updateClearanceMask(trail, scene, hull, desiredGap, silhouetteSize, stationNearDepth);
  if (!hull || endMs <= begin) return;
  const circle = protectedCircle(hull, maskCircle);
  localDate.setTime(begin); JulianDate.fromDate(localDate, localTime);
  const physical = trail.position.getValue(localTime, localPosition);
  localDate.setTime(Math.min(begin + 1000, endMs)); JulianDate.fromDate(localDate, localTime);
  const future = trail.position.getValue(localTime, nextPosition);
  if (!physical || !future) return;
  const speed = Cartesian3.distance(physical, future) / Math.max(0.001, (Math.min(begin + 1000, endMs) - begin) / 1000);
  // Orbital sagitta s²/(2r) bounds the local search in tangent views, using
  // actual display/halo size and current lens rather than an arbitrary horizon.
  const range = Cartesian3.distance(scene.camera.positionWC, physical);
  const metresPerCssPixel = 2 * range / Math.max(1, scene.canvas.clientHeight * scene.camera.frustum.projectionMatrix[5]);
  const protectedMetres = (circle.radius + desiredGap + silhouetteSize + FORWARD_TRAIL.layers[0].width / 2) * metresPerCssPixel;
  const localSeconds = (protectedMetres + Math.sqrt(2 * Cartesian3.magnitude(physical) * protectedMetres)) / Math.max(1, speed);
  const pixelAt = projectedSourceEvaluator(scene, (time, result) => trail.position.getValue(time, result));
  const origin = pixelAt(begin);
  if (!origin) return;
  const region = initialRegion(hull, origin, desiredGap + silhouetteSize, maskRegion);
  const requiredMs = earliestClearTime(begin, Math.min(endMs, begin + localSeconds * 1000), trail.sampleTimes,
    pixelAt, hull, desiredGap + silhouetteSize);
  const startMs = requiredMs ?? Math.min(endMs, begin + localSeconds * 1000);
  trail.firstExitMs = requiredMs;
  trail.gapSeconds = (startMs - sceneMs) / 1000;
  // The bounded convex source-to-station region masks local fragments at any
  // epoch. Its coverage must not switch when first-exit branches merge. Origin
  // selection and later reentry masking are independent; safe fragments outside
  // this current-camera region remain available for the entire future window.
  for (const layer of trail.layers) {
    const u = layer.material.materials.clearanceMask.uniforms;
    u.initialExternal = region.external;
    Cartesian2.fromElements(region.ax, region.ay, u.origin);
    Cartesian2.fromElements(region.tx, region.ty, u.tangentA);
    Cartesian2.fromElements(region.ux, region.uy, u.tangentB);
  }
}

/** Current-frame circular SDF protects both layers without a rectangular cut. */
export function updateClearanceMask(trail: ForwardTrail, scene: Scene, hull: Pixel[] | null,
  desiredGap: number, silhouetteSize: number, stationNearDepth = 1e20): void {
  const circle = hull ? protectedCircle(hull, maskCircle) : null;
  for (const layer of trail.layers) {
    const u = layer.material.materials.clearanceMask.uniforms;
    u.stationNearDepth = stationNearDepth;
    u.radius = circle ? circle.radius + desiredGap + silhouetteSize : 0;
    u.initialExternal = false;
    u.softness = startRampCssPixels(desiredGap);
    u.cssHeight = scene.canvas.clientHeight;
    if (circle) Cartesian2.fromElements(circle.x, circle.y, u.center);
    Cartesian2.fromElements(scene.canvas.clientWidth / scene.drawingBufferWidth,
      scene.canvas.clientHeight / scene.drawingBufferHeight, u.bufferToCss);
  }
}
function clearanceMaterial() {
  return { type: 'Mission1ScreenClearance', uniforms: {
    center: new Cartesian2(), radius: 0, stationNearDepth: 1e20, softness: 1, cssHeight: 1, bufferToCss: new Cartesian2(1, 1),
    origin: new Cartesian2(), tangentA: new Cartesian2(), tangentB: new Cartesian2(), initialExternal: false,
  }, source: `
    ${EARTH_OCCLUSION_GLSL}
    uniform float stationNearDepth;
    uniform vec2 center;
    uniform float radius;
    uniform float softness;
    uniform float cssHeight;
    uniform vec2 bufferToCss;
    uniform vec2 origin;
    uniform vec2 tangentA;
    uniform vec2 tangentB;
    uniform bool initialExternal;
    float segmentDistance(vec2 p, vec2 a, vec2 b) {
      vec2 edge = b - a;
      return length(p - mix(a, b, clamp(dot(p - a, edge) / max(dot(edge, edge), 0.000001), 0.0, 1.0)));
    }
    float side(vec2 a, vec2 b, vec2 p) { vec2 edge = b - a, offset = p - a; return edge.x * offset.y - edge.y * offset.x; }
    czm_material czm_getMaterial(czm_materialInput materialInput) {
      czm_material material = czm_getDefaultMaterial(materialInput);
      vec2 pixel = vec2(gl_FragCoord.x * bufferToCss.x, cssHeight - gl_FragCoord.y * bufferToCss.y);
      float distance = length(pixel - center) - radius;
      if (initialExternal) {
        float a = side(origin, tangentA, pixel), b = side(tangentA, tangentB, pixel), c = side(tangentB, origin, pixel);
        bool inside = (a >= 0.0 && b >= 0.0 && c >= 0.0) || (a <= 0.0 && b <= 0.0 && c <= 0.0);
        float triangle = min(segmentDistance(pixel, origin, tangentA), min(segmentDistance(pixel, tangentA, tangentB), segmentDistance(pixel, tangentB, origin)));
        distance = min(distance, inside ? -triangle : triangle);
      }
      material.alpha = radius <= 0.0 || stationNearDepth <= 0.0 || mission1EarthOccludesDepth(stationNearDepth)
        ? 1.0 : smoothstep(0.0, softness, distance);
      return material;
    }` };
}

function createTrail(source: TrajectorySource, samples: TrajectorySample[], periodSeconds: number): ForwardTrail {
  const positions = samples.map((point) => new Cartesian3(point.xMeters, point.yMeters, point.zMeters));
  const layers = FORWARD_TRAIL.layers.map((layer) => {
    const material = trailMaterial(layer.alphaScale, layer.glowPower);
    const primitive = new Primitive({
      geometryInstances: new GeometryInstance({ geometry: trajectoryGeometry(positions, layer.width) }),
      appearance: trajectoryAppearance(material, samples.length),
      show: false, asynchronous: false, allowPicking: false,
    });
    return { primitive, material };
  });
  return { source, positions, layers, startMs: Date.parse(samples[0].time),
    endMs: Date.parse(samples[samples.length - 1].time), periodSeconds,
    position: makeSampledPosition(samples), sampleTimes: samples.map((sample) => Date.parse(sample.time)),
    firstExitMs: null, gapSeconds: null };
}

export function createTrajectoryTrails(response: ComparisonResponse): TrajectoryTrails {
  const trails = [createTrail('PRIMARY_GP_TLE', response.primary.samples, response.primary.orbitalPeriodSeconds)];
  if (response.oem.availability !== 'UNAVAILABLE' && response.oem.samples.length >= 2) {
    trails.push(createTrail('NASA_OEM', response.oem.samples, response.primary.orbitalPeriodSeconds));
  }
  return { generatedMs: Date.parse(response.generatedAt), trails };
}

const activeColors = {
  PRIMARY_GP_TLE: Color.fromCssColorString(TRAJECTORY_ACCENTS.PRIMARY_GP_TLE),
  NASA_OEM: Color.fromCssColorString(TRAJECTORY_ACCENTS.NASA_OEM),
};
const inactiveColor = Color.fromCssColorString(FORWARD_TRAIL.inactiveColor);

export function updateTrail(trail: ForwardTrail, sceneMs: number, active: TrajectorySource, transitionVisibility = 1): void {
  const { startMs, endMs } = forwardBounds(sceneMs, trail.periodSeconds, trail.endMs, trail.gapSeconds ?? 0);
  const span = trail.endMs - trail.startMs;
  const physicalStartMs = Math.max(sceneMs + 1, trail.startMs);
  const selected = trail.source === active;
  for (let index = 0; index < trail.layers.length; index++) {
    const layer = trail.layers[index];
    layer.material.uniforms.forwardStart = (Math.min(startMs, endMs - Math.max(1, span * 1e-6)) - trail.startMs) / span;
    layer.material.uniforms.futureStart = (physicalStartMs - trail.startMs) / span;
    layer.material.uniforms.forwardEnd = (endMs - trail.startMs) / span;
    layer.material.uniforms.startRamp = Math.max(1e-6, 1 / span);
    layer.material.uniforms.trailColor = selected ? activeColors[trail.source] : inactiveColor;
    layer.material.uniforms.maximumAlpha = physicalStartMs >= endMs ? 0 :
      (selected ? FORWARD_TRAIL.activeAlpha : FORWARD_TRAIL.inactiveAlpha) * FORWARD_TRAIL.layers[index].alphaScale * transitionVisibility;
  }
}

/** Inactive halo/body, then selected halo/body. Reorders retained primitives only.
 * Native OIT can combine translucent fragments independent of this order; selected
 * opacity and source accent also establish dominance without disabling globe depth.
 */
export function orderTrails(group: TrajectoryTrails, active: TrajectorySource, collection: PrimitiveCollection): void {
  const ordered = [...group.trails.filter((trail) => trail.source !== active),
    ...group.trails.filter((trail) => trail.source === active)];
  for (const trail of ordered) for (const layer of trail.layers) collection.raiseToTop(layer.primitive);
}

export function showTrails(group: TrajectoryTrails, visible: boolean): void {
  for (const trail of group.trails) for (const layer of trail.layers) layer.primitive.show = visible;
}
