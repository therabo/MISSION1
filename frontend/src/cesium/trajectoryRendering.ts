import {
  ArcType, Cartesian2, Cartesian3, Color, GeometryInstance, Material,
  PolylineGeometry, PolylineMaterialAppearance, Primitive, type PrimitiveCollection, type SampledPositionProperty, type Scene,
} from 'cesium';
import type { ComparisonResponse, TrajectorySample } from '../orbital/comparison';
import type { TrajectorySource } from './trajectorySelection';
import { makeSampledPosition } from './sampleProperty';
import { earliestClearTime, projectedSourceEvaluator, startRampCssPixels, type Pixel } from './trajectoryClearance';

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
  const start = 'smoothstep(forwardStart, forwardStart + startRamp, materialInput.st.s)';
  return new Material({ strict: true, translucent: true, fabric: {
    type: 'Mission1ForwardTrail',
    uniforms: { trailColor: Color.fromCssColorString(TRAJECTORY_ACCENTS.PRIMARY_GP_TLE),
      maximumAlpha: FORWARD_TRAIL.activeAlpha * alphaScale, forwardStart: 0, forwardEnd: 0.85, startRamp: 0.001 },
    materials: { edgeGlow: { type: 'PolylineGlow', uniforms: { color: Color.WHITE, glowPower, taperPower: 1 } },
      clearanceMask: clearanceMaterial() },
    components: {
      emission: 'trailColor.rgb',
      alpha: `clearanceMask.alpha * edgeGlow.alpha * maximumAlpha * ${start} * (1.0 - smoothstep(0.5 * ${start}, 0.5 * ${start} + 0.025, abs(materialInput.st.t - 0.5))) * (1.0 - smoothstep(forwardStart, forwardEnd, materialInput.st.s))`,
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
  gapSeconds: number | null;
  rampSeconds: number;
}
export interface TrajectoryTrails { generatedMs: number; trails: ForwardTrail[] }

export function adaptTrailClearance(trail: ForwardTrail, sceneMs: number, scene: Scene,
  hull: Pixel[] | null, desiredGap: number, silhouetteSize: number): void {
  trail.gapSeconds = null;
  if (!hull) return;
  const endMs = Math.min(sceneMs + FORWARD_TRAIL.horizonRevolutions * trail.periodSeconds * 1000, trail.endMs);
  const pixelAt = projectedSourceEvaluator(scene, (time, result) => trail.position.getValue(time, result));
  const rampPixels = startRampCssPixels(desiredGap);
  const startMs = earliestClearTime(Math.max(sceneMs + 1, trail.startMs), endMs, trail.sampleTimes,
    pixelAt, hull, desiredGap + silhouetteSize);
  if (startMs === null) return;
  trail.gapSeconds = (startMs - sceneMs) / 1000;
  const first = pixelAt(startMs), firstX = first?.x, firstY = first?.y;
  const next = pixelAt(Math.min(startMs + 1000, endMs));
  const pixelsPerSecond = firstX !== undefined && firstY !== undefined && next
    ? Math.hypot(next.x - firstX, next.y - firstY) : 0;
  trail.rampSeconds = Math.min((endMs - startMs) / 1000,
    rampPixels / Math.max(0.01, pixelsPerSecond));
  updateClearanceMask(trail, scene, hull, desiredGap, silhouetteSize);
}

/** Follow camera/model motion every frame; the more expensive source search is
 * throttled separately. Reuse public uniform objects, with no primitive churn.
 */
export function updateClearanceMask(trail: ForwardTrail, scene: Scene, hull: Pixel[] | null,
  desiredGap: number, silhouetteSize: number): void {
  for (const layer of trail.layers) {
    const mask = layer.material.materials.clearanceMask;
    mask.uniforms.footprintCount = hull?.length ?? 0;
    mask.uniforms.clearance = desiredGap + silhouetteSize;
    mask.uniforms.cssHeight = scene.canvas.clientHeight;
    Cartesian2.fromElements(scene.canvas.clientWidth / scene.drawingBufferWidth,
      scene.canvas.clientHeight / scene.drawingBufferHeight, mask.uniforms.bufferToCss);
    if (hull) for (let i = 0; i < 8; i++) {
      const p = hull[i % hull.length];
      Cartesian2.fromElements(p.x, p.y, mask.uniforms[`footprint${i}`]);
    }
  }
}

/** Public Fabric submaterial clips every halo/body fragment in CSS space. */
function clearanceMaterial() {
  const uniforms: Record<string, number | Cartesian2> = {
    footprintCount: 0, clearance: 0, cssHeight: 1, bufferToCss: new Cartesian2(1, 1),
  };
  for (let i = 0; i < 8; i++) uniforms[`footprint${i}`] = new Cartesian2();
  return { type: 'Mission1ScreenClearance', uniforms, source: `
    uniform float footprintCount;
    uniform float clearance;
    uniform float cssHeight;
    uniform vec2 bufferToCss;
    ${Array.from({ length: 8 }, (_, i) => `uniform vec2 footprint${i};`).join('\n')}
    czm_material czm_getMaterial(czm_materialInput materialInput) {
      czm_material material = czm_getDefaultMaterial(materialInput);
      vec2 points[8];
      ${Array.from({ length: 8 }, (_, i) => `points[${i}] = footprint${i};`).join('\n')}
      vec2 pixel = vec2(gl_FragCoord.x * bufferToCss.x, cssHeight - gl_FragCoord.y * bufferToCss.y);
      float distanceToModel = 1.0e10;
      bool inside = true;
      for (int i = 0; i < 8; i++) {
        if (float(i) >= footprintCount) break;
        int next = i + 1;
        if (float(next) >= footprintCount) next = 0;
        vec2 a = points[i];
        vec2 edge = points[next] - a;
        vec2 relative = pixel - a;
        if (edge.x * relative.y - edge.y * relative.x < 0.0) inside = false;
        float phase = clamp(dot(relative, edge) / max(dot(edge, edge), 0.000001), 0.0, 1.0);
        distanceToModel = min(distanceToModel, length(relative - phase * edge));
      }
      if (inside) distanceToModel = 0.0;
      material.alpha = footprintCount < 3.0 ? 0.0 : smoothstep(clearance, clearance + 0.75, distanceToModel);
      return material;
    }` };
}

function createTrail(source: TrajectorySource, samples: TrajectorySample[], periodSeconds: number): ForwardTrail {
  const positions = samples.map((point) => new Cartesian3(point.xMeters, point.yMeters, point.zMeters));
  const layers = FORWARD_TRAIL.layers.map((layer) => {
    const material = trailMaterial(layer.alphaScale, layer.glowPower);
    const primitive = new Primitive({
      geometryInstances: new GeometryInstance({ geometry: new PolylineGeometry({
        positions, width: layer.width, arcType: ArcType.NONE, vertexFormat: PolylineMaterialAppearance.VERTEX_FORMAT,
      }) }),
      appearance: new PolylineMaterialAppearance({ material, translucent: true }),
      show: false, asynchronous: true, allowPicking: false,
    });
    return { primitive, material };
  });
  return { source, positions, layers, startMs: Date.parse(samples[0].time),
    endMs: Date.parse(samples[samples.length - 1].time), periodSeconds,
    position: makeSampledPosition(samples), sampleTimes: samples.map((sample) => Date.parse(sample.time)),
    gapSeconds: null, rampSeconds: 0 };
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
  const selected = trail.source === active;
  for (const [index, layer] of trail.layers.entries()) {
    layer.material.uniforms.forwardStart = (startMs - trail.startMs) / span;
    layer.material.uniforms.forwardEnd = Math.max(layer.material.uniforms.forwardStart + 1e-6, (endMs - trail.startMs) / span);
    layer.material.uniforms.startRamp = Math.max(1e-6, trail.rampSeconds * 1000 / span);
    layer.material.uniforms.trailColor = selected ? activeColors[trail.source] : inactiveColor;
    layer.material.uniforms.maximumAlpha = trail.gapSeconds === null || startMs >= endMs ? 0 :
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
