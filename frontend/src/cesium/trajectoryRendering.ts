import {
  ArcType, Cartesian2, Cartesian3, Color, GeometryInstance, Material,
  PolylineDashMaterialProperty, PolylineGeometry, PolylineMaterialAppearance, Primitive,
} from 'cesium';
import type { ComparisonResponse } from '../orbital/comparison';

/** Pixel widths affect only the envelope; both layers share the exact ITRF centerline. */
export const PRIMARY_TRAIL = {
  minimumAlpha: 0.025,
  maximumAlpha: 0.85,
  layers: [
    { name: 'halo', width: 20, alphaScale: 0.26, glowPower: 0.35 },
    { name: 'body', width: 8, alphaScale: 1, glowPower: 0.22 },
  ],
} as const;

export const OEM_DASH = { width: 5.5, alpha: 0.92, dashLength: 64, dashPattern: 0x000f } as const;

/** 0 at the moving ISS; 1 half a revolution away. Periodic and symmetric. */
export function oppositeSideDistance(sampleMs: number, sceneMs: number, periodSeconds: number): number {
  const cycles = Math.abs(sampleMs - sceneMs) / (periodSeconds * 1000);
  const phase = cycles - Math.floor(cycles);
  return 2 * Math.min(phase, 1 - phase);
}

export function primaryOpacity(sampleMs: number, sceneMs: number, periodSeconds: number): number {
  const d = oppositeSideDistance(sampleMs, sceneMs, periodSeconds);
  return PRIMARY_TRAIL.minimumAlpha + (PRIMARY_TRAIL.maximumAlpha - PRIMARY_TRAIL.minimumAlpha) * (1 - d * d * (3 - 2 * d));
}

export function primaryPositions(response: ComparisonResponse): Cartesian3[] {
  return response.primary.samples.map((point) => new Cartesian3(point.xMeters, point.yMeters, point.zMeters));
}

/** Public Fabric composition of built-in Glow and Fade. No noise or engine overrides.
 * Fade supplies phase distance; inverse smoothstep preserves the symmetric envelope.
 * Keeping the emission cyan avoids the white core of unmodified PolylineGlow.
 */
export function trailMaterial(alphaScale: number, glowPower: number, phase: number): Material {
  return new Material({
    strict: true,
    translucent: true,
    fabric: {
      type: 'Mission1OrbitalTrail',
      uniforms: {
        trailColor: Color.fromCssColorString('#53d9cd'),
        minimumAlpha: PRIMARY_TRAIL.minimumAlpha * alphaScale,
        maximumAlpha: PRIMARY_TRAIL.maximumAlpha * alphaScale,
      },
      materials: {
        edgeGlow: { type: 'PolylineGlow', uniforms: { color: Color.WHITE, glowPower, taperPower: 1 } },
        phaseFade: {
          type: 'Fade',
          uniforms: {
            fadeInColor: new Color(1, 1, 1, 0), fadeOutColor: new Color(1, 1, 1, 1),
            maximumDistance: 0.5, repeat: true, fadeDirection: new Cartesian2(1, 0), time: new Cartesian2(phase, 0),
          },
        },
      },
      components: {
        emission: 'trailColor.rgb',
        alpha: 'edgeGlow.alpha * mix(maximumAlpha, minimumAlpha, smoothstep(0.0, 1.0, phaseFade.alpha))',
      },
    },
  });
}

export function oemMaterial(): PolylineDashMaterialProperty {
  return new PolylineDashMaterialProperty({
    color: Color.fromCssColorString('#ff984f').withAlpha(OEM_DASH.alpha), gapColor: Color.TRANSPARENT,
    dashLength: OEM_DASH.dashLength, dashPattern: OEM_DASH.dashPattern,
  });
}

export interface PrimaryTrail {
  readonly positions: Cartesian3[];
  readonly layers: { primitive: Primitive; material: Material }[];
  readonly generatedMs: number;
  readonly periodSeconds: number;
}

export function createPrimaryTrail(response: ComparisonResponse, sceneMs: number): PrimaryTrail {
  const positions = primaryPositions(response);
  const generatedMs = Date.parse(response.generatedAt);
  const periodSeconds = response.primary.orbitalPeriodSeconds;
  const phase = 0.5 + (sceneMs - generatedMs) / (periodSeconds * 1000);
  const layers = PRIMARY_TRAIL.layers.map((layer) => {
    const material = trailMaterial(layer.alphaScale, layer.glowPower, phase);
    const primitive = new Primitive({
      geometryInstances: new GeometryInstance({ geometry: new PolylineGeometry({
        positions, width: layer.width, arcType: ArcType.NONE,
        vertexFormat: PolylineMaterialAppearance.VERTEX_FORMAT,
      }) }),
      appearance: new PolylineMaterialAppearance({ material, translucent: true }),
      // Hidden primitives prepare geometry before the complete group is revealed.
      show: false, asynchronous: true, allowPicking: false,
    });
    return { primitive, material };
  });
  return { positions, layers, generatedMs, periodSeconds };
}

/** Uniform-only fade update: no segment rebuilding or 15-second opacity steps. */
export function updateTrailFade(trail: PrimaryTrail, sceneMs: number): void {
  const phase = 0.5 + (sceneMs - trail.generatedMs) / (trail.periodSeconds * 1000);
  for (const layer of trail.layers) layer.material.materials.phaseFade.uniforms.time.x = phase;
}

export function showTrail(trail: PrimaryTrail, visible: boolean): void {
  for (const layer of trail.layers) layer.primitive.show = visible;
}
