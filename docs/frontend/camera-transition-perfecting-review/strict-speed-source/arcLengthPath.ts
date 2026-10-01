import { Cartesian3 } from 'cesium';

export type SpatialCurve = (parameter: number, result: Cartesian3) => Cartesian3;

/** Built once per path. Distance advances linearly; curve parameter need not. */
export class ArcLengthPath {
  readonly cumulative: Float64Array;
  readonly length: number;
  private readonly previous = new Cartesian3();
  private readonly point = new Cartesian3();

  constructor(readonly curve: SpatialCurve, readonly resolution = 8192) {
    if (!Number.isInteger(resolution) || resolution < 2) throw new Error('Invalid arc-length resolution');
    this.cumulative = new Float64Array(resolution + 1);
    curve(0, this.previous);
    for (let i = 1; i <= resolution; i++) {
      curve(i / resolution, this.point);
      const distance = Cartesian3.distance(this.previous, this.point);
      if (!Number.isFinite(distance)) throw new Error('Nonfinite camera path');
      this.cumulative[i] = this.cumulative[i - 1]! + distance;
      Cartesian3.clone(this.point, this.previous);
    }
    this.length = this.cumulative[resolution]!;
  }

  parameterAt(progress: number): number {
    const u = Math.max(0, Math.min(1, progress));
    if (u === 0 || u === 1 || this.length === 0) return u;
    const distance = u * this.length;
    let lo = 0, hi = this.resolution;
    while (hi - lo > 1) {
      const mid = (lo + hi) >>> 1;
      if (this.cumulative[mid]! < distance) lo = mid;
      else hi = mid;
    }
    const span = this.cumulative[hi]! - this.cumulative[lo]!;
    return (lo + (span > 0 ? (distance - this.cumulative[lo]!) / span : 0)) / this.resolution;
  }

  at(progress: number, result: Cartesian3): Cartesian3 {
    return this.curve(this.parameterAt(progress), result);
  }
}

/** Cubic Bernstein form; stable exact endpoints and no evaluation allocations. */
export function cubicBezier(a: Cartesian3, b: Cartesian3, c: Cartesian3, d: Cartesian3,
  parameter: number, result: Cartesian3): Cartesian3 {
  const t = Math.max(0, Math.min(1, parameter)), s = 1 - t;
  if (t === 0) return Cartesian3.clone(a, result);
  if (t === 1) return Cartesian3.clone(d, result);
  const aw = s * s * s, bw = 3 * s * s * t, cw = 3 * s * t * t, dw = t * t * t;
  return Cartesian3.fromElements(aw * a.x + bw * b.x + cw * c.x + dw * d.x,
    aw * a.y + bw * b.y + cw * c.y + dw * d.y,
    aw * a.z + bw * b.z + cw * c.z + dw * d.z, result);
}
