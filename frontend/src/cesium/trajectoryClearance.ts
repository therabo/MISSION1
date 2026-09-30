import { BoundingSphere, Cartesian2, Cartesian3, JulianDate, Matrix4, SceneTransforms,
  type Model, type Scene } from 'cesium';
import { smoothstep } from './inspectionMode';

export const TRAIL_CLEARANCE = {
  minimumCssPixels: 0.75, maximumCssPixels: 4,
  closeRangeMeters: 2_000_000, farRangeMeters: 17_000_000,
  minimumRampCssPixels: 1, maximumRampCssPixels: 4, updateIntervalMs: 100,
} as const;

/** Range to the selected displayed ISS, not to Earth's center. */
export function desiredGapCssPixels(rangeMeters: number): number {
  const phase = Math.log(Math.max(rangeMeters, TRAIL_CLEARANCE.closeRangeMeters) /
    TRAIL_CLEARANCE.closeRangeMeters) / Math.log(TRAIL_CLEARANCE.farRangeMeters / TRAIL_CLEARANCE.closeRangeMeters);
  return TRAIL_CLEARANCE.minimumCssPixels +
    (TRAIL_CLEARANCE.maximumCssPixels - TRAIL_CLEARANCE.minimumCssPixels) * smoothstep(phase);
}

export function startRampCssPixels(desiredGap: number): number {
  const phase = Math.max(0, Math.min(1, (desiredGap - TRAIL_CLEARANCE.minimumCssPixels) /
    (TRAIL_CLEARANCE.maximumCssPixels - TRAIL_CLEARANCE.minimumCssPixels)));
  return TRAIL_CLEARANCE.minimumRampCssPixels +
    (TRAIL_CLEARANCE.maximumRampCssPixels - TRAIL_CLEARANCE.minimumRampCssPixels) * phase;
}

export interface Pixel { x: number; y: number }

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

/** Distance to a conservative projected model envelope, zero inside it. */
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

// Conservative bounds of the pinned ce23515c6bf4 NASA GLB, measured from all
// POSITION vertices after node transforms. Cesium's default glTF axis conversion
// maps source (X,Y,Z) to ENU (Z,X,Y). No spacecraft attitude is inferred.
export const MODEL_DISPLAY_BOUNDS = {
  minimum: [-33.2, -56, -29.1], maximum: [25.5, 56, 39.8],
} as const;

/** Public boundingSphere excludes minimumPixelSize. Reproduce the pinned public
 * size policy using Camera.getPixelSize, including maximumScale and off-origin
 * asset translation; never read private Model or renderer fields.
 */
export function projectedModelFootprint(scene: Scene, model: Model): Pixel[] | null {
  if (!model.ready) return null;
  const radius = model.boundingSphere.radius;
  const origin = Matrix4.getTranslation(model.modelMatrix, new Cartesian3());
  const metersPerPixel = scene.camera.getPixelSize(new BoundingSphere(origin, radius),
    scene.drawingBufferWidth, scene.drawingBufferHeight);
  const scale = Math.min(model.maximumScale ?? Infinity,
    Math.max(model.scale, model.minimumPixelSize * metersPerPixel / (2 * radius / model.scale)));
  const corners: Pixel[] = [];
  const world = new Cartesian3();
  for (let i = 0; i < 8; i++) {
    const local = new Cartesian3(...MODEL_DISPLAY_BOUNDS.minimum.map((v, axis) =>
      (i & (1 << axis) ? MODEL_DISPLAY_BOUNDS.maximum[axis] : v) * scale));
    Matrix4.multiplyByPoint(model.modelMatrix, local, world);
    const pixel = SceneTransforms.worldToWindowCoordinates(scene, world, new Cartesian2());
    if (!pixel || !Number.isFinite(pixel.x) || !Number.isFinite(pixel.y)) return null;
    corners.push({ x: pixel.x, y: pixel.y });
  }
  return convexFootprint(corners);
}

/** Earliest exit on a bounded source's own piecewise-linear sampled path.
 * Search real sample intervals, then bisect to <=1ms. Nothing changes vertices.
 * Null means no valid visible start, not permission to extrapolate.
 */
export function earliestClearTime(startMs: number, endMs: number, sampleTimes: readonly number[],
  pixelAt: (timeMs: number) => Pixel | null, hull: Pixel[], clearance: number): number | null {
  if (endMs <= startMs) return null;
  return firstPassingTime(startMs, endMs, sampleTimes, (ms) => {
    const p = pixelAt(ms);
    return p !== null && footprintDistance(p, hull) >= clearance;
  });
}

function firstPassingTime(startMs: number, endMs: number, sampleTimes: readonly number[], clear: (ms: number) => boolean): number | null {
  if (clear(startMs)) return startMs;
  let previous = startMs;
  for (const next of [...sampleTimes.filter((ms) => ms > startMs && ms < endMs), endMs]) {
    if (clear(next)) {
      let low = previous, high = next;
      for (let i = 0; i < 20 && high - low > 1; i++) {
        const middle = (low + high) / 2;
        if (clear(middle)) high = middle; else low = middle;
      }
      return high;
    }
    previous = next;
  }
  return null;
}

const sampleTime = new JulianDate();
const samplePosition = new Cartesian3();
const samplePixel = new Cartesian2();

export function projectedSourceEvaluator(scene: Scene,
  positionAt: (time: JulianDate, result: Cartesian3) => Cartesian3 | undefined): (ms: number) => Pixel | null {
  return (ms) => {
    JulianDate.fromDate(new Date(ms), sampleTime);
    const physical = positionAt(sampleTime, samplePosition);
    if (!physical) return null;
    const p = SceneTransforms.worldToWindowCoordinates(scene, physical, samplePixel);
    return p ? { x: p.x, y: p.y } : null;
  };
}
