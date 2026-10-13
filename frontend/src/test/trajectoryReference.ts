import type { Pixel } from '../cesium/trajectoryClearance';

/** Independent test geometry and CPU fade references; production uses its shader/projected region. */
function cross(a: Pixel, b: Pixel, c: Pixel): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

export function convexFootprint(points: Pixel[]): Pixel[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const half = (ps: Pixel[]) => {
    const hull: Pixel[] = [];
    for (const p of ps) {
      while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) hull.pop();
      hull.push(p);
    }
    return hull.slice(0, -1);
  };
  return [...half(sorted), ...half(sorted.reverse())];
}

export function footprintDistance(point: Pixel, hull: Pixel[]): number {
  if (hull.length < 3) return 0;
  let inside = true;
  let distance = Infinity;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length];
    if (cross(a, b, point) < 0) inside = false;
    const dx = b.x - a.x, dy = b.y - a.y;
    const u = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    distance = Math.min(distance, Math.hypot(point.x - a.x - u * dx, point.y - a.y - u * dy));
  }
  return inside ? 0 : distance;
}

export function forwardOpacity(sampleMs: number, startMs: number, endMs: number, rampMs = 0): number {
  if (sampleMs < startMs || sampleMs >= endMs || endMs <= startMs) return 0;
  const u = (sampleMs - startMs) / (endMs - startMs);
  const ramp = rampMs > 0 ? Math.min(1, (sampleMs - startMs) / rampMs) : 1;
  return ramp * ramp * (3 - 2 * ramp) * (1 - u * u * (3 - 2 * u));
}
