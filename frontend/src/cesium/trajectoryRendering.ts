import { ArcType, Cartesian3, Color, GeometryInstance, PolylineColorAppearance, PolylineGeometry, Primitive } from 'cesium';
import type { ComparisonResponse } from '../orbital/comparison';

/** Orbital-path phase distance: 0 at the moving ISS, 1 half a revolution away. */
export function oppositeSideDistance(sampleMs: number, sceneMs: number, periodSeconds: number): number {
  const cycles = Math.abs(sampleMs - sceneMs) / (periodSeconds * 1000);
  const phase = cycles - Math.floor(cycles);
  return 2 * Math.min(phase, 1 - phase);
}

export function primaryOpacity(sampleMs: number, sceneMs: number, periodSeconds: number): number {
  const distance = oppositeSideDistance(sampleMs, sceneMs, periodSeconds);
  return 0.08 + 0.86 * (1 - distance);
}

export function primaryPrimitive(response: ComparisonResponse, sceneMs: number): Primitive {
  const positions = response.primary.samples.map((point) => new Cartesian3(point.xMeters, point.yMeters, point.zMeters));
  const base = Color.fromCssColorString('#58d9d4');
  const colors = response.primary.samples.map((point) =>
    base.withAlpha(primaryOpacity(Date.parse(point.time), sceneMs, response.primary.orbitalPeriodSeconds)));
  return new Primitive({
    geometryInstances: new GeometryInstance({ geometry: new PolylineGeometry({
      positions, width: 4, colors, colorsPerVertex: true, arcType: ArcType.NONE,
      vertexFormat: PolylineColorAppearance.VERTEX_FORMAT,
    }) }),
    appearance: new PolylineColorAppearance({ translucent: true }),
    asynchronous: true,
  });
}
