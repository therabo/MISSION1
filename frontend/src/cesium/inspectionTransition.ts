import { Cartesian3, Ellipsoid, Matrix3, Matrix4, Quaternion } from 'cesium';
import { earthOccludes, interpolateUnitDirection } from './inspectionMode';

/** Quintic easing: position, velocity and acceleration meet the endpoints. */
export function smootherstep(progress: number): number {
  const p = Math.max(0, Math.min(1, progress));
  return p * p * p * (10 + p * (-15 + 6 * p));
}

/** Initial velocity basis with zero initial acceleration and zero final value/derivatives. */
export function initialTangent(progress: number): number {
  const p = Math.max(0, Math.min(1, progress));
  return p - 6 * p ** 3 + 8 * p ** 4 - 3 * p ** 5;
}

/** Preserve partial-entry velocity, then settle the tangent within 0.6s of a 5s return. */
export function interruptionTangent(progress: number): number { return 0.12 * initialTangent(progress / 0.12); }

export interface CameraPose { position: Cartesian3; direction: Cartesian3; up: Cartesian3; fov: number }
const right = new Cartesian3();
const up = new Cartesian3();
const rotation = new Matrix3();
export function poseQuaternion(direction: Cartesian3, cameraUp: Cartesian3, result: Quaternion): Quaternion {
  Cartesian3.normalize(Cartesian3.cross(direction, cameraUp, right), right);
  Cartesian3.normalize(Cartesian3.cross(right, direction, up), up);
  Matrix3.setColumn(rotation, 0, right, rotation);
  Matrix3.setColumn(rotation, 1, up, rotation);
  Matrix3.setColumn(rotation, 2, Cartesian3.negate(direction, right), rotation);
  return Quaternion.fromRotationMatrix(rotation, result);
}

/** Retained camera pose pipeline. All coordinates are presentation; frame is physical selected-source F/L/U. */
export class InspectionTransition {
  readonly pose: CameraPose = { position: new Cartesian3(), direction: new Cartesian3(), up: new Cartesian3(), fov: 0 };
  readonly start: CameraPose;
  readonly startOffset = new Cartesian3();
  readonly endOffset = new Cartesian3();
  readonly velocityCorrection = new Cartesian3();
  readonly orientationTangent = new Quaternion(0, 0, 0, 0);
  fovTangent = 0;
  private readonly startQuaternion = new Quaternion();
  private readonly endQuaternion = new Quaternion();
  private readonly interpolatedQuaternion = new Quaternion();
  private readonly inverse = new Matrix4();
  private readonly offset = new Cartesian3();
  private readonly endpoint = new Cartesian3();
  private readonly movingStart = new Cartesian3();
  private readonly correction = new Cartesian3();
  private readonly aimDirection = new Cartesian3();
  private readonly aimUp = new Cartesian3();
  private readonly matrix = new Matrix3();
  private readonly column = new Cartesian3();
  private readonly usesEarthArc: boolean;
  private readonly arcHeight: number;

  constructor(readonly kind: 'entry' | 'exit', start: CameraPose, frame: Matrix4,
    endpoint: Cartesian3, readonly endFov: number, readonly duration: number,
    readonly startMs: number, readonly overview: CameraPose | null = null) {
    this.start = { position: Cartesian3.clone(start.position), direction: Cartesian3.clone(start.direction),
      up: Cartesian3.clone(start.up), fov: start.fov };
    poseQuaternion(start.direction, start.up, this.startQuaternion);
    Matrix4.inverseTransformation(frame, this.inverse);
    Matrix4.multiplyByPoint(this.inverse, start.position, this.startOffset);
    Cartesian3.clone(endpoint, this.endOffset);
    // Preflight the whole route once. An occulted route uses one Earth-centred
    // great-circle arc, never an acquisition stage or a mid-flight restart.
    let clear = true;
    for (let i = 0; i <= 64; i++) {
      this.localPosition(frame, i / 64);
      if ((Ellipsoid.WGS84.cartesianToCartographic(this.pose.position)?.height ?? -1) < 1000 ||
          (kind === 'entry' && earthOccludes(this.pose.position, Matrix4.getTranslation(frame, this.endpoint)))) clear = false;
    }
    this.usesEarthArc = !clear;
    this.arcHeight = 1_000_000;
    if (!clear) {
      // Handles a low polar Overview as well as a far-side station. Increase the
      // smooth radial bulge until every preflight point clears WGS84.
      let height = this.arcHeight;
      for (let attempt = 0; attempt < 6; attempt++) {
        let safe = true;
        for (let i = 0; i <= 128; i++) {
          this.earthPosition(frame, i / 128, height);
          if ((Ellipsoid.WGS84.cartesianToCartographic(this.pose.position)?.height ?? -1) < 999) safe = false;
        }
        if (safe) break;
        height *= 2;
      }
      this.arcHeight = height;
    }
  }

  private localPosition(frame: Matrix4, weight: number): void {
    if (this.kind === 'exit') Matrix4.multiplyByPoint(Matrix4.inverseTransformation(frame, this.inverse), this.overview!.position, this.endOffset);
    const range = Math.exp(Math.log(Cartesian3.magnitude(this.startOffset)) * (1 - weight) +
      Math.log(Cartesian3.magnitude(this.endOffset)) * weight);
    interpolateUnitDirection(this.startOffset, this.endOffset, weight, this.offset);
    Cartesian3.multiplyByScalar(this.offset, range, this.offset);
    Matrix4.multiplyByPoint(frame, this.offset, this.pose.position);
    if (this.kind === 'entry') {
      // Fade in target motion. The first pose is exactly the captured world pose,
      // the last is exactly the current moving local pose.
      Matrix4.multiplyByPoint(frame, this.startOffset, this.movingStart);
      Cartesian3.subtract(this.start.position, this.movingStart, this.correction);
      Cartesian3.multiplyByScalar(this.correction, 1 - weight, this.correction);
      Cartesian3.add(this.pose.position, this.correction, this.pose.position);
    }
  }

  private earthPosition(frame: Matrix4, weight: number, height: number): void {
    if (this.kind === 'entry') Matrix4.multiplyByPoint(frame, this.endOffset, this.endpoint);
    else Cartesian3.clone(this.overview!.position, this.endpoint);
    if (this.kind === 'exit') Matrix4.multiplyByPoint(frame, this.startOffset, this.movingStart);
    else Cartesian3.clone(this.start.position, this.movingStart);
    interpolateUnitDirection(this.movingStart, this.endpoint, weight, this.pose.position);
    const radius = Math.exp(Math.log(Cartesian3.magnitude(this.movingStart)) * (1 - weight) +
      Math.log(Cartesian3.magnitude(this.endpoint)) * weight) + height * Math.sin(Math.PI * weight);
    Cartesian3.multiplyByScalar(this.pose.position, radius, this.pose.position);
  }

  evaluate(frame: Matrix4, progress: number): CameraPose {
    const p = Math.max(0, Math.min(1, progress));
    const weight = smootherstep(p);
    if (p === 0 && this.kind === 'entry') Cartesian3.clone(this.start.position, this.pose.position);
    else if (this.usesEarthArc) this.earthPosition(frame, weight, this.arcHeight);
    else this.localPosition(frame, weight);
    if (this.kind === 'exit') {
      Cartesian3.multiplyByScalar(this.velocityCorrection, this.duration * interruptionTangent(p), this.correction);
      Cartesian3.add(this.pose.position, this.correction, this.pose.position);
      poseQuaternion(this.overview!.direction, this.overview!.up, this.endQuaternion);
    } else {
      Matrix4.getTranslation(frame, this.endpoint);
      Cartesian3.normalize(Cartesian3.subtract(this.endpoint, this.pose.position, this.aimDirection), this.aimDirection);
      Matrix4.multiplyByPointAsVector(frame, Cartesian3.UNIT_Z, this.aimUp);
      if (Cartesian3.magnitudeSquared(Cartesian3.cross(this.aimDirection, this.aimUp, this.column)) < 1e-12)
        Matrix4.multiplyByPointAsVector(frame, Cartesian3.UNIT_Y, this.aimUp);
      poseQuaternion(this.aimDirection, this.aimUp, this.endQuaternion);
    }
    Quaternion.slerp(this.startQuaternion, this.endQuaternion, weight, this.interpolatedQuaternion);
    const tangent = this.duration * interruptionTangent(p);
    this.interpolatedQuaternion.x += this.orientationTangent.x * tangent;
    this.interpolatedQuaternion.y += this.orientationTangent.y * tangent;
    this.interpolatedQuaternion.z += this.orientationTangent.z * tangent;
    this.interpolatedQuaternion.w += this.orientationTangent.w * tangent;
    Quaternion.normalize(this.interpolatedQuaternion, this.interpolatedQuaternion);
    Matrix3.fromQuaternion(this.interpolatedQuaternion, this.matrix);
    Cartesian3.negate(Matrix3.getColumn(this.matrix, 2, this.pose.direction), this.pose.direction);
    Matrix3.getColumn(this.matrix, 1, this.pose.up);
    this.pose.fov = this.start.fov + (this.endFov - this.start.fov) * weight + this.fovTangent * tangent;
    // Exact endpoints avoid accumulated roundoff in captured Overview restoration.
    if (p === 1 && this.kind === 'exit') {
      Cartesian3.clone(this.overview!.position, this.pose.position);
      Cartesian3.clone(this.overview!.direction, this.pose.direction);
      Cartesian3.clone(this.overview!.up, this.pose.up);
      this.pose.fov = this.endFov;
    }
    return this.pose;
  }
}
