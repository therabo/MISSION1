/** Camera presentation metric, never an orbital quantity. Lens distance combines
 * range and perspective FOV; inverse lens distance approximates projected size.
 * Log travel gets 25% of the perceptual budget, apparent scale gets 75%.
 */
export function lensDistance(range: number, fov: number): number {
  if (!(range > 0) || !Number.isFinite(range) || !(fov > 0 && fov < Math.PI))
    throw new Error('Invalid camera range or FOV');
  return range * Math.tan(fov / 2);
}

export function perceptualMetric(distance: number, start: number, end: number): number {
  if (!(distance > 0 && start > 0 && end > 0)) throw new Error('Invalid lens distance');
  if (Math.abs(Math.log(end / start)) < 1e-12) return 0;
  const logPart = Math.log(distance / start) / Math.log(end / start);
  const scalePart = (1 / distance - 1 / start) / (1 / end - 1 / start);
  return 0.25 * logPart + 0.75 * scalePart;
}

/** C2 start/stop ramps, constant progression across the central 80%.
 * Integrates a cubic smoothstep velocity rather than globally easing travel.
 */
export function perceptualClock(progress: number): number {
  const p = Math.max(0, Math.min(1, progress)), ramp = 0.1;
  const integral = (u: number) => u ** 3 - u ** 4 / 2;
  if (p < ramp) return ramp * integral(p / ramp) / (1 - ramp);
  if (p > 1 - ramp) return 1 - ramp * integral((1 - p) / ramp) / (1 - ramp);
  return (p - ramp / 2) / (1 - ramp);
}

/** Monotone C1 inverse lookup. Uniform perceptual samples, including close range,
 * are found once by bisection; uniform geometric sampling misses the final metres.
 * No scene projections or lookup construction occur in the render loop.
 */
export class PerceptualPath {
  readonly parameters: Float64Array;
  private readonly slopes: Float64Array;
  constructor(metricAt: (parameter: number) => number, readonly resolution = 1024) {
    if (!Number.isInteger(resolution) || resolution < 2) throw new Error('Invalid perceptual resolution');
    this.parameters = new Float64Array(resolution + 1);
    this.slopes = new Float64Array(resolution + 1);
    this.parameters[resolution] = 1;
    for (let i = 1; i < resolution; i++) {
      const target = i / resolution;
      let lo = this.parameters[i - 1]!, hi = 1;
      for (let step = 0; step < 48; step++) {
        const mid = (lo + hi) / 2, value = metricAt(mid);
        if (!Number.isFinite(value)) throw new Error('Nonfinite perceptual camera metric');
        if (value < target) lo = mid; else hi = mid;
      }
      this.parameters[i] = (lo + hi) / 2;
    }
    for (let i = 0; i <= resolution; i++) {
      const before = (this.parameters[i]! - this.parameters[Math.max(0, i - 1)]!) * resolution;
      const after = (this.parameters[Math.min(resolution, i + 1)]! - this.parameters[i]!) * resolution;
      this.slopes[i] = i === 0 ? after : i === resolution ? before :
        before > 0 && after > 0 ? 2 * before * after / (before + after) : 0;
    }
  }
  parameterAt(progress: number): number {
    const p = Math.max(0, Math.min(1, progress));
    if (p === 0 || p === 1) return p;
    const index = Math.min(this.resolution - 1, Math.floor(p * this.resolution));
    const t = p * this.resolution - index, s = 1 - t;
    return this.parameters[index]! * (1 + 2 * t) * s * s +
      this.parameters[index + 1]! * t * t * (3 - 2 * t) +
      this.slopes[index]! / this.resolution * t * s * s -
      this.slopes[index + 1]! / this.resolution * t * t * s;
  }
}
