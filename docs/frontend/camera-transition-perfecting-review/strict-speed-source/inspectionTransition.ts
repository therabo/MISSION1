import { Cartesian3, Ellipsoid, Matrix4 } from 'cesium';
import { earthOccludes, interpolateUnitDirection } from './inspectionMode';
import { ArcLengthPath, cubicBezier } from './arcLengthPath';
import { TransitionComposition } from './transitionComposition';
import type { CameraPose } from './cameraPose';
export { poseQuaternion } from './cameraPose';
export type { CameraPose } from './cameraPose';

/** Presentation easing only. Camera translational distance never uses easing. */
export function smootherstep(progress: number): number {
  const p = Math.max(0, Math.min(1, progress));
  return p * p * p * (10 + p * (-15 + 6 * p));
}

/** Initial velocity basis with zero initial acceleration and zero final value/derivatives. */
export function initialTangent(progress: number): number {
  const p = Math.max(0, Math.min(1, progress));
  return p - 6 * p ** 3 + 8 * p ** 4 - 3 * p ** 5;
}

/** Retain partial-entry lift/silhouette derivatives over the first 0.6s of return. */
export function interruptionTangent(progress: number): number { return 0.12 * initialTangent(progress / 0.12); }

/** Retained camera pose pipeline. All coordinates are presentation; frame is physical selected-source F/L/U. */
export class InspectionTransition {
  readonly pose: CameraPose = { position: new Cartesian3(), direction: new Cartesian3(), up: new Cartesian3(), fov: 0 };
  readonly start: CameraPose;
  readonly startOffset = new Cartesian3();
  readonly endOffset = new Cartesian3();
  readonly pathLength: number;
  private readonly path: ArcLengthPath;
  private readonly control1 = new Cartesian3();
  private readonly control2 = new Cartesian3();
  private readonly initialFrame = new Matrix4();
  private readonly arcEndCorrection = new Cartesian3();
  private readonly arcStartCorrection = new Cartesian3();
  private readonly composition: TransitionComposition;
  private readonly target = new Cartesian3();
  private readonly inverse = new Matrix4();
  private readonly offset = new Cartesian3();
  private readonly endpoint = new Cartesian3();
  private readonly movingStart = new Cartesian3();
  private readonly correction = new Cartesian3();
  private usesEarthArc = false;
  private readonly arcHeight: number;

  constructor(readonly kind: 'entry' | 'exit', start: CameraPose, frame: Matrix4,
    endpoint: Cartesian3, readonly endFov: number, readonly duration: number,
    readonly startMs: number, readonly overview: CameraPose | null = null, initialTarget?: Cartesian3) {
    this.start = { position: Cartesian3.clone(start.position), direction: Cartesian3.clone(start.direction),
      up: Cartesian3.clone(start.up), fov: start.fov };
    Matrix4.inverseTransformation(frame, this.inverse);
    Matrix4.multiplyByPoint(this.inverse, start.position, this.startOffset);
    Cartesian3.clone(endpoint, this.endOffset);
    Matrix4.clone(frame, this.initialFrame);
    if (kind === 'exit') Matrix4.multiplyByPoint(this.inverse, overview!.position, this.endOffset);
    const length = Cartesian3.distance(this.startOffset, this.endOffset);
    const sign = kind === 'entry' ? -1 : 1;
    Cartesian3.multiplyByScalar(Cartesian3.normalize(this.startOffset, this.control1), sign * length / 3, this.control1);
    Cartesian3.add(this.startOffset, this.control1, this.control1);
    Cartesian3.multiplyByScalar(Cartesian3.normalize(this.endOffset, this.control2), -sign * length / 3, this.control2);
    Cartesian3.add(this.endOffset, this.control2, this.control2);
    // Preflight the whole route once. An occulted route uses one Earth-centred
    // great-circle arc, never an acquisition stage or a mid-flight restart.
    let clear = true;
    for (let i = 0; i <= 64; i++) {
      this.curvePosition(i / 64, this.offset);
      Matrix4.multiplyByPoint(frame, this.offset, this.pose.position);
      if ((Ellipsoid.WGS84.cartesianToCartographic(this.pose.position)?.height ?? -1) < 1000 ||
          (kind === 'entry' && earthOccludes(this.pose.position, Matrix4.getTranslation(frame, this.endpoint)))) clear = false;
    }
    this.usesEarthArc = !clear;
    this.arcHeight = 1_000_000;
    if (!clear) {
      // Endpoint derivative corrections align the close end with the station
      // offset. Without this, an Earth arc turns the view in its final metres.
      const epsilon = 1e-6;
      this.earthPosition(frame, epsilon, this.arcHeight);
      Cartesian3.clone(this.pose.position, this.offset);
      this.earthPosition(frame, 0, this.arcHeight);
      Cartesian3.subtract(this.offset, this.pose.position, this.arcStartCorrection);
      Cartesian3.divideByScalar(this.arcStartCorrection, epsilon, this.arcStartCorrection);
      this.earthPosition(frame, 1 - epsilon, this.arcHeight);
      Cartesian3.clone(this.pose.position, this.offset);
      this.earthPosition(frame, 1, this.arcHeight);
      Cartesian3.subtract(this.pose.position, this.offset, this.arcEndCorrection);
      Cartesian3.divideByScalar(this.arcEndCorrection, epsilon, this.arcEndCorrection);
      const closeOffset = kind === 'entry' ? this.endOffset : this.startOffset;
      Matrix4.multiplyByPointAsVector(frame, closeOffset, this.correction);
      Cartesian3.normalize(this.correction, this.correction);
      Cartesian3.multiplyByScalar(this.correction, (kind === 'entry' ? -1 : 1) * length, this.correction);
      if (kind === 'entry') {
        Cartesian3.subtract(this.correction, this.arcEndCorrection, this.arcEndCorrection);
        Cartesian3.clone(Cartesian3.ZERO, this.arcStartCorrection);
      } else {
        Cartesian3.subtract(this.correction, this.arcStartCorrection, this.arcStartCorrection);
        Cartesian3.clone(Cartesian3.ZERO, this.arcEndCorrection);
      }
    }
    if (!clear) {
      // Handles a low polar Overview as well as a far-side station. Increase the
      // smooth radial bulge until every preflight point clears WGS84.
      let height = this.arcHeight;
      for (let attempt = 0; attempt < 6; attempt++) {
        let safe = true;
        for (let i = 0; i <= 128; i++) {
          this.earthPosition(frame, i / 128, height);
          this.correctEarthTangents(i / 128);
          if ((Ellipsoid.WGS84.cartesianToCartographic(this.pose.position)?.height ?? -1) < 999) safe = false;
        }
        if (safe) break;
        height *= 2;
      }
      this.arcHeight = height;
    }
    this.path = new ArcLengthPath((t, result) => this.curvePosition(t, result));
    this.pathLength = this.path.length;
    if (initialTarget) Cartesian3.clone(initialTarget, this.target);
    else Matrix4.getTranslation(frame, this.target);
    this.composition = new TransitionComposition(this.start, this.target, overview);
  }

  private correctEarthTangents(t: number): void {
    Cartesian3.multiplyByScalar(this.arcStartCorrection, t * (1 - t) ** 2, this.correction);
    Cartesian3.add(this.pose.position, this.correction, this.pose.position);
    Cartesian3.multiplyByScalar(this.arcEndCorrection, t * t * (t - 1), this.correction);
    Cartesian3.add(this.pose.position, this.correction, this.pose.position);
  }

  private curvePosition(parameter: number, result: Cartesian3): Cartesian3 {
    if (!this.usesEarthArc) return cubicBezier(this.startOffset, this.control1, this.control2, this.endOffset, parameter, result);
    this.earthPosition(this.initialFrame, parameter, this.arcHeight);
    this.correctEarthTangents(parameter);
    return Matrix4.multiplyByPoint(Matrix4.inverseTransformation(this.initialFrame, this.inverse), this.pose.position, result);
  }

  private localPosition(frame: Matrix4, progress: number): void {
    this.path.at(progress, this.offset);
    Matrix4.multiplyByPoint(frame, this.offset, this.pose.position);
    if (this.kind === 'entry') {
      Matrix4.multiplyByPoint(frame, this.startOffset, this.movingStart);
      Cartesian3.subtract(this.start.position, this.movingStart, this.correction);
      Cartesian3.multiplyByScalar(this.correction, 1 - progress, this.correction);
    } else {
      Matrix4.multiplyByPoint(frame, this.endOffset, this.endpoint);
      Cartesian3.subtract(this.overview!.position, this.endpoint, this.correction);
      Cartesian3.multiplyByScalar(this.correction, progress, this.correction);
    }
    Cartesian3.add(this.pose.position, this.correction, this.pose.position);
  }

  private earthPosition(frame: Matrix4, weight: number, height: number): void {
    if (this.kind === 'entry') Matrix4.multiplyByPoint(frame, this.endOffset, this.endpoint);
    else Cartesian3.clone(this.overview!.position, this.endpoint);
    if (this.kind === 'exit') Matrix4.multiplyByPoint(frame, this.startOffset, this.movingStart);
    else Cartesian3.clone(this.start.position, this.movingStart);
    interpolateUnitDirection(this.movingStart, this.endpoint, weight, this.pose.position);
    const radius = Math.exp(Math.log(Cartesian3.magnitude(this.movingStart)) * (1 - weight) +
      Math.log(Cartesian3.magnitude(this.endpoint)) * weight) + height * Math.sin(Math.PI * weight) ** 2;
    Cartesian3.multiplyByScalar(this.pose.position, radius, this.pose.position);
  }

  evaluate(frame: Matrix4, progress: number, displayedTarget?: Cartesian3): CameraPose {
    const p = Math.max(0, Math.min(1, progress));
    this.localPosition(frame, p);
    if (p === 0) Cartesian3.clone(this.start.position, this.pose.position);
    if (p === 1 && this.kind === 'exit') Cartesian3.clone(this.overview!.position, this.pose.position);
    if (displayedTarget) Cartesian3.clone(displayedTarget, this.target);
    else Matrix4.getTranslation(frame, this.target);
    this.composition.evaluate(this.pose, this.target, frame, p);
    this.pose.fov = this.start.fov + (this.endFov - this.start.fov) * p;
    return this.pose;
  }
}
