import { BoundingSphere, Cartesian2, Cartesian3, JulianDate, Matrix4, SceneTransforms,
  type Model, type Scene } from 'cesium';
import { smoothstep } from './inspectionMode';

export const TRAIL_CLEARANCE = {
  minimumCssPixels: 0.75, maximumCssPixels: 4,
  closeRangeMeters: 2_000_000, farRangeMeters: 17_000_000,
  minimumRampCssPixels: 1, maximumRampCssPixels: 4,
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

/** No tiny-tangent normalization: future ordering is temporal. */
export function segmentDistance(p: Pixel, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const u = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.y - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - ax - u * dx, p.y - ay - u * dy);
}
export interface ProtectedCircle { x: number; y: number; radius: number }
/** Curved compact envelope enclosing the displayed bounds. Caller reuses output. */
export function protectedCircle(hull: readonly Pixel[], out: ProtectedCircle): ProtectedCircle {
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
  for (const p of hull) { left = Math.min(left, p.x); right = Math.max(right, p.x); top = Math.min(top, p.y); bottom = Math.max(bottom, p.y); }
  out.x = hull.length ? (left + right) / 2 : 0; out.y = hull.length ? (top + bottom) / 2 : 0; out.radius = 0;
  for (const p of hull) out.radius = Math.max(out.radius, Math.hypot(p.x - out.x, p.y - out.y));
  return out;
}
export interface InitialRegion extends ProtectedCircle {
  ax: number; ay: number; tx: number; ty: number; ux: number; uy: number; external: boolean;
}
export function initialRegion(hull: readonly Pixel[], origin: Pixel, clearance: number, out: InitialRegion): InitialRegion {
  protectedCircle(hull, out); out.radius += clearance;
  out.ax = origin.x; out.ay = origin.y;
  const dx = out.ax - out.x, dy = out.ay - out.y, squared = dx * dx + dy * dy;
  out.external = squared > out.radius * out.radius;
  const base = out.external ? out.radius * out.radius / squared : 0;
  const tangent = out.external ? out.radius * Math.sqrt(squared - out.radius * out.radius) / squared : 0;
  out.tx = out.x + base * dx - tangent * dy; out.ty = out.y + base * dy + tangent * dx;
  out.ux = out.x + base * dx + tangent * dy; out.uy = out.y + base * dy - tangent * dx;
  return out;
}
/** Signed distance to circle union tangent triangle; no projected direction. */
export function initialRegionDistance(p: Pixel, r: InitialRegion): number {
  const circle = Math.hypot(p.x - r.x, p.y - r.y) - r.radius;
  if (!r.external) return circle;
  const side = (ax: number, ay: number, bx: number, by: number) => (bx - ax) * (p.y - ay) - (by - ay) * (p.x - ax);
  const a = side(r.ax, r.ay, r.tx, r.ty), b = side(r.tx, r.ty, r.ux, r.uy), c = side(r.ux, r.uy, r.ax, r.ay);
  const inside = (a >= 0 && b >= 0 && c >= 0) || (a <= 0 && b <= 0 && c <= 0);
  const distance = Math.min(segmentDistance(p, r.ax, r.ay, r.tx, r.ty),
    segmentDistance(p, r.tx, r.ty, r.ux, r.uy), segmentDistance(p, r.ux, r.uy, r.ax, r.ay));
  return Math.min(circle, inside ? -distance : distance);
}

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
// maps source (X,Y,Z) to render-local (Z,X,Y). No spacecraft attitude is inferred.
export const MODEL_DISPLAY_BOUNDS = {
  minimum: [-33.2, -56, -29.1], maximum: [25.5, 56, 39.8],
} as const;

/** Public boundingSphere excludes minimumPixelSize. Reproduce the pinned public
 * size policy using Camera.getPixelSize, including maximumScale and off-origin
 * asset translation; never read private Model or renderer fields.
 */
const footprintOrigin = new Cartesian3();
const footprintSphere = new BoundingSphere();
const footprintLocal = new Cartesian3();
const footprintWorld = new Cartesian3();
const footprintPoints = Array.from({ length: 8 }, () => new Cartesian2());
const footprintHull: Pixel[] = [];

/** Nearest possible displayed model depth, including minimum-pixel scaling.
 * Mask visibility uses this conservative depth rather than masking an occulted
 * station's projection over unrelated foreground trajectory fragments.
 */
export function displayedModelNearDepth(scene: Scene, model: Model): number {
  const center = model.boundingSphere.center, radius = model.boundingSphere.radius;
  Matrix4.getTranslation(model.modelMatrix, footprintOrigin);
  Cartesian3.clone(footprintOrigin, footprintSphere.center); footprintSphere.radius = radius;
  const metersPerPixel = scene.camera.getPixelSize(footprintSphere, scene.drawingBufferWidth, scene.drawingBufferHeight);
  const scale = Math.min(model.maximumScale ?? Infinity,
    Math.max(model.scale, model.minimumPixelSize * metersPerPixel / (2 * radius / model.scale)));
  // Minimum-pixel scaling also scales the asset's off-origin center about the
  // modelMatrix translation. Its public physical sphere alone omits that shift.
  Cartesian3.subtract(center, footprintOrigin, footprintWorld);
  Cartesian3.multiplyByScalar(footprintWorld, scale / model.scale, footprintWorld);
  Cartesian3.add(footprintOrigin, footprintWorld, footprintWorld);
  return Cartesian3.dot(Cartesian3.subtract(footprintWorld, scene.camera.positionWC, footprintWorld), scene.camera.directionWC)
    - radius * scale / model.scale;
}

export function projectedModelFootprint(scene: Scene, model: Model): Pixel[] | null {
  if (!model.ready) return null;
  const radius = model.boundingSphere.radius;
  Matrix4.getTranslation(model.modelMatrix, footprintOrigin);
  Cartesian3.clone(footprintOrigin, footprintSphere.center); footprintSphere.radius = radius;
  const metersPerPixel = scene.camera.getPixelSize(footprintSphere, scene.drawingBufferWidth, scene.drawingBufferHeight);
  const scale = Math.min(model.maximumScale ?? Infinity,
    Math.max(model.scale, model.minimumPixelSize * metersPerPixel / (2 * radius / model.scale)));
  for (let i = 0; i < 8; i++) {
    footprintLocal.x = (i & 1 ? MODEL_DISPLAY_BOUNDS.maximum[0] : MODEL_DISPLAY_BOUNDS.minimum[0]) * scale;
    footprintLocal.y = (i & 2 ? MODEL_DISPLAY_BOUNDS.maximum[1] : MODEL_DISPLAY_BOUNDS.minimum[1]) * scale;
    footprintLocal.z = (i & 4 ? MODEL_DISPLAY_BOUNDS.maximum[2] : MODEL_DISPLAY_BOUNDS.minimum[2]) * scale;
    Matrix4.multiplyByPoint(model.modelMatrix, footprintLocal, footprintWorld);
    const p = SceneTransforms.worldToWindowCoordinates(scene, footprintWorld, footprintPoints[i]);
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
  }
  footprintPoints.sort((a, b) => a.x - b.x || a.y - b.y);
  footprintHull.length = 0;
  for (const p of footprintPoints) {
    while (footprintHull.length >= 2 && cross(footprintHull.at(-2)!, footprintHull.at(-1)!, p) <= 0) footprintHull.pop();
    footprintHull.push(p);
  }
  const lowerLength = footprintHull.length;
  for (let i = footprintPoints.length - 2; i >= 0; i--) {
    const p = footprintPoints[i];
    while (footprintHull.length > lowerLength && cross(footprintHull.at(-2)!, footprintHull.at(-1)!, p) <= 0) footprintHull.pop();
    footprintHull.push(p);
  }
  footprintHull.pop();
  return footprintHull.length >= 3 ? footprintHull : null;
}

const originRegion: InitialRegion = { x: 0, y: 0, radius: 0, ax: 0, ay: 0, tx: 0, ty: 0, ux: 0, uy: 0, external: false };
/** First temporal exit from the INITIAL convex region joining the real source origin
 * to the displayed station envelope. This protection region draws no connector
 * and moves no vertex. Later reentries do not affect origin. Caller bounds time.
 */
export function earliestClearTime(startMs: number, endMs: number, sampleTimes: readonly number[],
  pixelAt: (ms: number) => Pixel | null, hull: Pixel[], clearance: number): number | null {
  if (endMs <= startMs || hull.length < 3) return null;
  const origin = pixelAt(startMs);
  if (!origin || !Number.isFinite(origin.x) || !Number.isFinite(origin.y)) return null;
  const region = initialRegion(hull, origin, clearance, originRegion);
  // Convex hull of the source origin POINT and the displayed protected circle.
  // Inflating the source endpoint into another full circle would create a moving
  // extra gap far away from the model, especially with the accepted display lift.
  const distanceAt = (ms: number): number | null => {
    const p = pixelAt(ms);
    return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? initialRegionDistance(p, region) : null;
  };
  let previous = startMs;
  let previousDistance: number | null = initialRegionDistance(origin, region);
  for (let i = 0; i <= sampleTimes.length; i++) {
    const next = i < sampleTimes.length ? Math.min(sampleTimes[i], endMs) : endMs;
    if (next <= previous) continue;
    let high = next;
    const nextDistance = distanceAt(next);
    let highDistance = nextDistance;
    // A segment may exit protection before crossing the camera plane. Its next
    // delivered projection is then invalid. Search only this temporal interval
    // for the last finite projection, rather than missing the genuine first exit.
    if (highDistance === null && previousDistance !== null) {
      let valid = previous, invalid = next;
      for (let j = 0; j < 20 && invalid - valid > 1; j++) {
        const middle = (valid + invalid) / 2;
        const d = distanceAt(middle);
        if (d === null) invalid = middle;
        else { valid = middle; highDistance = d; }
      }
      high = valid;
    }
    if (highDistance !== null && highDistance > 0) {
      let low = previous;
      for (let j = 0; j < 20 && high - low > 1; j++) {
        const middle = (low + high) / 2;
        const d = distanceAt(middle);
        if (d !== null && d > 0) high = middle; else low = middle;
      }
      return high;
    }
    previous = next; previousDistance = nextDistance;
    if (next === endMs) break;
  }
  return null;
}

const sampleTime = new JulianDate();
const sampleDate = new Date();
const samplePosition = new Cartesian3();
const samplePixel = new Cartesian2();

/** Returned coordinates reuse scratch storage until the next evaluation. */
export function projectedSourceEvaluator(scene: Scene,
  positionAt: (time: JulianDate, result: Cartesian3) => Cartesian3 | undefined): (ms: number) => Pixel | null {
  return (ms) => {
    sampleDate.setTime(ms);
    JulianDate.fromDate(sampleDate, sampleTime);
    const physical = positionAt(sampleTime, samplePosition);
    if (!physical) return null;
    const p = SceneTransforms.worldToWindowCoordinates(scene, physical, samplePixel);
    return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? p : null;
  };
}
