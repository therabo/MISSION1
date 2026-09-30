import {
  ArcType, Cartesian3, Color, GeometryInstance, Material,
  PolylineGeometry, PolylineMaterialAppearance, Primitive, type PrimitiveCollection,
} from 'cesium';
import type { ComparisonResponse, TrajectorySample } from '../orbital/comparison';
import type { TrajectorySource } from './trajectorySelection';

// Distinct selected accents make a switch visible even for subpixel-coincident paths.
export const TRAJECTORY_ACCENTS = { PRIMARY_GP_TLE: '#53d9cd', NASA_OEM: '#edb86a' } as const;

export const FORWARD_TRAIL = {
  direction: 'FUTURE_DIRECTION_ONLY', horizonRevolutions: 0.85, gapSeconds: 75,
  inactiveColor: '#71939c', activeAlpha: 0.85, inactiveAlpha: 0.08,
  layers: [
    { name: 'halo', width: 20, alphaScale: 0.26, glowPower: 0.35 },
    { name: 'body', width: 8, alphaScale: 1, glowPower: 0.22 },
  ],
} as const;

export function forwardBounds(sceneMs: number, periodSeconds: number, coverageEndMs: number) {
  return { startMs: sceneMs + FORWARD_TRAIL.gapSeconds * 1000,
    endMs: Math.min(sceneMs + FORWARD_TRAIL.horizonRevolutions * periodSeconds * 1000, coverageEndMs) };
}

/** Inverse smoothstep, monotonic and exactly zero at the real visible endpoint. */
export function forwardOpacity(sampleMs: number, startMs: number, endMs: number): number {
  if (sampleMs < startMs || sampleMs >= endMs || endMs <= startMs) return 0;
  const u = (sampleMs - startMs) / (endMs - startMs);
  return 1 - u * u * (3 - 2 * u);
}

/** Public Fabric composition retains the soft glow envelope. st.s is the uniform
 * sample-time fraction. Clip the past/start gap and all times beyond the horizon.
 * Only temporal uniforms and selection colors change per tick; geometry is exact.
 */
export function trailMaterial(alphaScale: number, glowPower: number): Material {
  return new Material({ strict: true, translucent: true, fabric: {
    type: 'Mission1ForwardTrail',
    uniforms: { trailColor: Color.fromCssColorString(TRAJECTORY_ACCENTS.PRIMARY_GP_TLE),
      maximumAlpha: FORWARD_TRAIL.activeAlpha * alphaScale, forwardStart: 0, forwardEnd: 0.85 },
    materials: { edgeGlow: { type: 'PolylineGlow', uniforms: { color: Color.WHITE, glowPower, taperPower: 1 } } },
    components: {
      emission: 'trailColor.rgb',
      alpha: 'edgeGlow.alpha * maximumAlpha * step(forwardStart, materialInput.st.s) * (1.0 - smoothstep(forwardStart, forwardEnd, materialInput.st.s))',
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
}
export interface TrajectoryTrails { generatedMs: number; trails: ForwardTrail[] }

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
    endMs: Date.parse(samples[samples.length - 1].time), periodSeconds };
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

export function updateTrail(trail: ForwardTrail, sceneMs: number, active: TrajectorySource): void {
  const { startMs, endMs } = forwardBounds(sceneMs, trail.periodSeconds, trail.endMs);
  const span = trail.endMs - trail.startMs;
  const selected = trail.source === active;
  for (const [index, layer] of trail.layers.entries()) {
    layer.material.uniforms.forwardStart = (startMs - trail.startMs) / span;
    layer.material.uniforms.forwardEnd = Math.max(layer.material.uniforms.forwardStart + 1e-6, (endMs - trail.startMs) / span);
    layer.material.uniforms.trailColor = selected ? activeColors[trail.source] : inactiveColor;
    layer.material.uniforms.maximumAlpha = (selected ? FORWARD_TRAIL.activeAlpha : FORWARD_TRAIL.inactiveAlpha) * FORWARD_TRAIL.layers[index].alphaScale;
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
