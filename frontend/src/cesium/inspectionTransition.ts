import { Cartesian3, Ellipsoid, Matrix4, Quaternion, Matrix3 } from 'cesium';
import { earthOccludes, interpolateUnitDirection } from './inspectionMode';
import { ArcLengthPath, cubicBezier } from './arcLengthPath';
import { TransitionComposition } from './transitionComposition';
import { poseQuaternion, type CameraPose } from './cameraPose';
import { PerceptualPath, lensDistance, perceptualMetric, perceptualClock } from './perceptualPath';
export { poseQuaternion } from './cameraPose';
export type { CameraPose } from './cameraPose';

/** C2 easing for composition and range-coordinated presentation. */
export function smootherstep(progress: number): number {
  const p = Math.max(0, Math.min(1, progress));
  return p * p * p * (10 + p * (-15 + 6 * p));
}

/** Initial velocity basis with zero initial acceleration and zero final value/derivatives. */
export function initialTangent(progress: number): number {
  const p = Math.max(0, Math.min(1, progress));
  return p - 6 * p ** 3 + 8 * p ** 4 - 3 * p ** 5;
}

function rangePhase(range: number, low: number, high: number): number {
  return smootherstep(Math.log(Math.max(range, low) / low) / Math.max(1e-9, Math.log(high / low)));
}

/** Retained camera pose pipeline. All coordinates are presentation; frame is physical selected-source F/L/U. */
export class InspectionTransition {
  readonly pose: CameraPose = { position: new Cartesian3(), direction: new Cartesian3(), up: new Cartesian3(), fov: 0 };
  readonly start: CameraPose;
  readonly startOffset = new Cartesian3();
  readonly endOffset = new Cartesian3();
  readonly pathLength: number;
  private readonly path: ArcLengthPath;
  private readonly perceptualPath: PerceptualPath;
  private readonly startRange: number;
  private readonly endRange: number;
  private readonly startLens: number;
  private readonly endLens: number;
  readonly velocityCorrection = new Cartesian3();
  readonly orientationTangent = new Quaternion(0, 0, 0, 0);
  fovTangent = 0;
  tangentDuration = 0;
  pathParameter = 0;
  perceptualProgress = 0;
  private readonly rotation = new Matrix3();
  private readonly quaternion = new Quaternion();
  private readonly tangentOrientation = new Quaternion();
  private readonly displayNormal = new Cartesian3();
  private readonly initialLift: number;
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
    public startMs: number, readonly overview: CameraPose | null = null, initialTarget?: Cartesian3) {
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
    Matrix4.getTranslation(frame, this.endpoint);
    Ellipsoid.WGS84.geodeticSurfaceNormal(this.endpoint, this.displayNormal);
    Matrix4.multiplyByPointAsVector(this.inverse, this.displayNormal, this.displayNormal);
    this.initialLift = Cartesian3.distance(this.target, this.endpoint);
    this.startRange = Cartesian3.magnitude(this.startOffset);
    this.endRange = Cartesian3.magnitude(this.endOffset);
    this.startLens = this.lensAt(0);
    this.endLens = this.lensAt(1);
    const angle = Cartesian3.angleBetween(this.startOffset, this.endOffset);
    this.perceptualPath = new PerceptualPath(t => {
      const sizeMetric = Math.abs(Math.log(this.endLens / this.startLens)) < 1e-9 ? t :
        perceptualMetric(this.lensAt(t), this.startLens, this.endLens);
      this.curvePosition(t, this.offset);
      // Reserve 20% for the curve's viewing-direction change. Otherwise all
      // steering occurs during the short logarithmic far leg and feels like a whip.
      const directionMetric = angle > 1e-6 ? Cartesian3.angleBetween(this.startOffset, this.offset) / angle : sizeMetric;
      return 0.8 * sizeMetric + 0.2 * directionMetric;
    });
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

  private fovAtRange(range: number, parameter = this.pathParameter): number {
    // Complete lens adjustment during far travel; hold the accepted close lens.
    const near = Math.min(this.startRange, this.endRange);
    const far = Math.max(this.startRange, this.endRange);
    const closeLensRange = Math.min(far, Math.max(near * 4, 2000));
    if (far === closeLensRange) return this.start.fov + (this.endFov - this.start.fov) * smootherstep(parameter);
    const a = rangePhase(this.startRange, closeLensRange, far), b = rangePhase(this.endRange, closeLensRange, far);
    const weight = Math.abs(b - a) > 1e-12 ? (rangePhase(range, closeLensRange, far) - a) / (b - a) : smootherstep(parameter);
    return this.start.fov + (this.endFov - this.start.fov) * weight;
  }

  private visibilityAtRange(range: number): number {
    const far = Math.max(this.startRange, this.endRange);
    const high = Math.min(1_000_000, far), low = Math.min(100_000, high / 10);
    return smootherstep(Math.log(Math.max(range, low) / low) / Math.log(high / low));
  }

  /** Display lift is restored only after close departure, while aim follows it. */
  presentationAt(progress: number): number {
    const t = this.perceptualPath.parameterAt(perceptualClock(progress));
    this.curvePosition(t, this.offset);
    const visibility = this.visibilityAtRange(Cartesian3.magnitude(this.offset));
    if (this.kind === 'entry') return visibility;
    const initial = this.visibilityAtRange(this.startRange);
    return initial < 1 ? Math.max(0, (visibility - initial) / (1 - initial)) : smootherstep(progress);
  }

  private lensAt(parameter: number): number {
    this.curvePosition(parameter, this.offset);
    const range = Cartesian3.magnitude(this.offset);
    const visibility = this.visibilityAtRange(range);
    const lift = this.kind === 'entry' ? this.initialLift * visibility :
      this.initialLift + (75000 - this.initialLift) * Math.max(0,
        (visibility - this.visibilityAtRange(this.startRange)) / Math.max(1e-9, 1 - this.visibilityAtRange(this.startRange)));
    Cartesian3.multiplyByScalar(this.displayNormal, lift, this.correction);
    Cartesian3.subtract(this.offset, this.correction, this.correction);
    return lensDistance(Cartesian3.magnitude(this.correction), this.fovAtRange(range, parameter));
  }

  private localPosition(frame: Matrix4, progress: number): void {
    this.perceptualProgress = perceptualClock(progress);
    this.pathParameter = this.perceptualPath.parameterAt(this.perceptualProgress);
    this.curvePosition(this.pathParameter, this.offset);
    Matrix4.multiplyByPoint(frame, this.offset, this.pose.position);
    if (this.kind === 'entry') {
      Matrix4.multiplyByPoint(frame, this.startOffset, this.movingStart);
      Cartesian3.subtract(this.start.position, this.movingStart, this.correction);
      Cartesian3.multiplyByScalar(this.correction, 1 - this.pathParameter, this.correction);
    } else {
      Matrix4.multiplyByPoint(frame, this.endOffset, this.endpoint);
      Cartesian3.subtract(this.overview!.position, this.endpoint, this.correction);
      Cartesian3.multiplyByScalar(this.correction, this.pathParameter, this.correction);
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

  /** Derivatives are world camera derivatives. Probe the new selected-source frame
   * at a small future UTC so frame motion is subtracted, including OEM fallback. */
  retainIncomingDerivative(frame: Matrix4, futureFrame: Matrix4, probeSeconds: number,
    velocity: Cartesian3, quaternionRate: Quaternion, fovRate: number, displayedTarget: Cartesian3,
    incomingOrientation?: Quaternion): void {
    const initialQuaternion = poseQuaternion(this.start.direction, this.start.up, this.tangentOrientation);
    const futureTarget = Matrix4.multiplyByPoint(Matrix4.inverseTransformation(frame, new Matrix4()), displayedTarget, new Cartesian3());
    Matrix4.multiplyByPoint(futureFrame, futureTarget, futureTarget);
    this.evaluate(futureFrame, probeSeconds / this.duration, futureTarget);
    Cartesian3.subtract(this.pose.position, this.start.position, this.velocityCorrection);
    Cartesian3.divideByScalar(this.velocityCorrection, probeSeconds, this.velocityCorrection);
    Cartesian3.subtract(velocity, this.velocityCorrection, this.velocityCorrection);
    const nextQuaternion = poseQuaternion(this.pose.direction, this.pose.up, new Quaternion());
    if (Quaternion.dot(initialQuaternion, nextQuaternion) < 0) Quaternion.negate(nextQuaternion, nextQuaternion);
    Quaternion.subtract(nextQuaternion, initialQuaternion, this.orientationTangent);
    Quaternion.multiplyByScalar(this.orientationTangent, 1 / probeSeconds, this.orientationTangent);
    // A transported rate belongs to its transported quaternion sign. Align
    // that pair with the canonical pose quaternion before retaining its tangent.
    const rateSign = incomingOrientation && Quaternion.dot(initialQuaternion, incomingOrientation) < 0 ? -1 : 1;
    Quaternion.multiplyByScalar(quaternionRate, rateSign, nextQuaternion);
    Quaternion.subtract(nextQuaternion, this.orientationTangent, this.orientationTangent);
    this.fovTangent = fovRate - (this.pose.fov - this.start.fov) / probeSeconds;
    const speed = Cartesian3.magnitude(this.velocityCorrection);
    // The tangent polynomial's maximum displacement is below 0.2*v*h.
    // Limit it to 3% of current range, avoiding a fly-through on close reversals.
    this.tangentDuration = Math.min(0.4, 0.15 * this.startRange / Math.max(1, speed));
    this.evaluate(frame, 0, displayedTarget);
  }

  evaluate(frame: Matrix4, progress: number, displayedTarget?: Cartesian3): CameraPose {
    const p = Math.max(0, Math.min(1, progress));
    this.localPosition(frame, p);
    if (p === 0) Cartesian3.clone(this.start.position, this.pose.position);
    if (p === 1 && this.kind === 'exit') Cartesian3.clone(this.overview!.position, this.pose.position);
    if (displayedTarget) Cartesian3.clone(displayedTarget, this.target);
    else Matrix4.getTranslation(frame, this.target);
    this.composition.evaluate(this.pose, this.target, frame, smootherstep(p));
    this.pose.fov = this.fovAtRange(Cartesian3.magnitude(this.offset));
    // C1 retargeting: preserve the incoming derivative, then settle it over a
    // range-bounded interval. A short forward excursion replaces an instant flip.
    const tangent = this.tangentDuration * initialTangent(p * this.duration / Math.max(1e-9, this.tangentDuration));
    if (tangent) {
      Cartesian3.multiplyByScalar(this.velocityCorrection, tangent, this.correction);
      Cartesian3.add(this.pose.position, this.correction, this.pose.position);
      poseQuaternion(this.pose.direction, this.pose.up, this.quaternion);
      if (Quaternion.dot(this.quaternion, this.tangentOrientation) < 0) Quaternion.negate(this.quaternion, this.quaternion);
      this.quaternion.x += this.orientationTangent.x * tangent;
      this.quaternion.y += this.orientationTangent.y * tangent;
      this.quaternion.z += this.orientationTangent.z * tangent;
      this.quaternion.w += this.orientationTangent.w * tangent;
      Quaternion.normalize(this.quaternion, this.quaternion);
      Matrix3.fromQuaternion(this.quaternion, this.rotation);
      Cartesian3.negate(Matrix3.getColumn(this.rotation, 2, this.pose.direction), this.pose.direction);
      Matrix3.getColumn(this.rotation, 1, this.pose.up);
      this.pose.fov += this.fovTangent * tangent;
    }
    if (p === 0) this.pose.fov = this.start.fov;
    if (p === 1) this.pose.fov = this.endFov;
    return this.pose;
  }
}
