import { Cartesian3, Matrix3, Matrix4, Quaternion } from 'cesium';
import { poseQuaternion, type CameraPose } from './cameraPose';
import { perceptualClock } from './perceptualPath';

function c2Envelope(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t*t*t*(10+t*(-15+6*t));
}

/** Explicit presentation focus on a positive camera ray. The spherical rail
 * connects the captured Earth composition and selected-source close composition;
 * its radius connects their focal distances. It cannot cross the camera, unlike
 * a Cartesian Earth-centre/station blend. No orbital state is interpolated. */
export class TransitionComposition {
  readonly focusPoint = new Cartesian3();
  readonly earthFocus = new Cartesian3();
  focusBlend = 0;
  focusDistance = 1;
  readonly focusBudget: number;
  private readonly startQuaternion = new Quaternion();
  private readonly endQuaternion = new Quaternion();
  private readonly startBranch = new Quaternion();
  private readonly endBranch = new Quaternion();
  private readonly quaternion = new Quaternion();
  private readonly matrix = new Matrix3();
  private readonly inverse = new Matrix4();
  private readonly localDirection = new Cartesian3();
  private readonly localUp = new Cartesian3();
  private readonly direction = new Cartesian3();
  private readonly up = new Cartesian3();
  private readonly aim = new Cartesian3();
  private readonly axis = new Cartesian3();
  private readonly correction = new Quaternion();
  private readonly angularLimit: number;
  private readonly ray = new Cartesian3();
  private readonly earthDistance: number;
  private readonly initialDistance: number;
  private readonly initialStationDistance: number;

  constructor(private readonly start: CameraPose, initialTarget: Cartesian3,
    private readonly overview: CameraPose | null, frame: Matrix4, closeOffset: Cartesian3,
    initialFocus?: Cartesian3) {
    const earth = overview ?? start;
    this.angularLimit = 0.25 * Math.min(start.fov, overview?.fov ?? 100 * Math.PI / 180);
    this.earthDistance = Math.max(1, -Cartesian3.dot(earth.position, earth.direction));
    Cartesian3.multiplyByScalar(earth.direction, this.earthDistance, this.earthFocus);
    Cartesian3.add(earth.position, this.earthFocus, this.earthFocus);
    this.initialStationDistance = Cartesian3.distance(start.position, initialTarget);
    this.initialDistance = initialFocus ? Cartesian3.distance(start.position, initialFocus) :
      overview ? this.initialStationDistance : this.earthDistance;
    poseQuaternion(start.direction, start.up, this.startQuaternion);
    Matrix4.inverseTransformation(frame, this.inverse);
    if (overview) {
      Matrix4.multiplyByPointAsVector(this.inverse, start.direction, this.localDirection);
      Matrix4.multiplyByPointAsVector(this.inverse, start.up, this.localUp);
      poseQuaternion(overview.direction, overview.up, this.endQuaternion);
    } else {
      Cartesian3.negate(Cartesian3.normalize(closeOffset, this.localDirection), this.localDirection);
      Cartesian3.clone(Cartesian3.UNIT_Z, this.localUp);
      Matrix4.multiplyByPointAsVector(frame, this.localDirection, this.direction);
      Matrix4.multiplyByPointAsVector(frame, this.localUp, this.up);
      poseQuaternion(this.direction, this.up, this.endQuaternion);
    }
    if (Quaternion.dot(this.startQuaternion, this.endQuaternion) < 0) Quaternion.negate(this.endQuaternion, this.endQuaternion);
    Quaternion.clone(this.startQuaternion, this.startBranch);
    Quaternion.clone(this.endQuaternion, this.endBranch);
    // Larger composition changes receive more of the existing hybrid budget.
    // This is precomputed, distance/composition aware and has no mode threshold.
    const angle = 2 * Math.acos(Math.min(1, Math.abs(Quaternion.dot(this.startQuaternion, this.endQuaternion))));
    this.focusBudget = Math.max(0.3, Math.min(0.5, 0.25 + 0.3 * angle / Math.PI));
    this.focusDistance = this.initialDistance;
    this.updateFocus(start);
  }

  evaluate(pose: CameraPose, target: Cartesian3, frame: Matrix4, metric: number): void {
    const q = Math.max(0, Math.min(1, metric));
    this.focusBlend = this.overview ? perceptualClock((q - (1 - this.focusBudget)) / this.focusBudget) :
      perceptualClock(q / this.focusBudget);
    Matrix4.multiplyByPointAsVector(frame, this.localDirection, this.direction);
    Matrix4.multiplyByPointAsVector(frame, this.localUp, this.up);
    if (this.overview) poseQuaternion(this.direction, this.up, this.startQuaternion);
    else poseQuaternion(this.direction, this.up, this.endQuaternion);
    // Preserve the branch selected at capture even if the moving frame crosses
    // an exact 180-degree composition. Rechoosing the shortest path each tick
    // can reverse the entire rail at that boundary.
    if (Quaternion.dot(this.startQuaternion, this.startBranch) < 0) Quaternion.negate(this.startQuaternion, this.startQuaternion);
    if (Quaternion.dot(this.endQuaternion, this.endBranch) < 0) Quaternion.negate(this.endQuaternion, this.endQuaternion);
    const dot = Math.max(-1, Math.min(1, Quaternion.dot(this.startQuaternion, this.endQuaternion)));
    const theta = Math.acos(dot), sine = Math.sin(theta), w = this.focusBlend;
    const startWeight = sine > 1e-6 ? Math.sin((1-w)*theta)/sine : 1-w;
    const endWeight = sine > 1e-6 ? Math.sin(w*theta)/sine : w;
    this.quaternion.x = startWeight*this.startQuaternion.x + endWeight*this.endQuaternion.x;
    this.quaternion.y = startWeight*this.startQuaternion.y + endWeight*this.endQuaternion.y;
    this.quaternion.z = startWeight*this.startQuaternion.z + endWeight*this.endQuaternion.z;
    this.quaternion.w = startWeight*this.startQuaternion.w + endWeight*this.endQuaternion.w;
    Quaternion.normalize(this.quaternion, this.quaternion);
    Matrix3.fromQuaternion(this.quaternion, this.matrix);
    Cartesian3.negate(Matrix3.getColumn(this.matrix, 2, pose.direction), pose.direction);
    Matrix3.getColumn(this.matrix, 1, pose.up);
    const stationDistance = Math.max(1, Cartesian3.distance(pose.position, target));
    Cartesian3.normalize(Cartesian3.subtract(target, pose.position, this.aim), this.aim);
    const angle = Cartesian3.angleBetween(pose.direction, this.aim);
    // Smooth angular containment around the displayed station, without a hard
    // clamp or target takeover. The eighth-power soft cap is flat at small
    // errors, bounded at large errors, and C-infinity away from the ray origin.
    // C2 endpoint envelopes preserve arbitrary captured Earth compositions.
    const strength = c2Envelope(q / 0.05) * c2Envelope((1 - q) / 0.05);
    const allowed = angle / (1 + (angle / this.angularLimit) ** 8) ** 0.125;
    const turn = (angle - allowed) * strength;
    if (turn > 1e-12) {
      Cartesian3.cross(pose.direction, this.aim, this.axis);
      if (Cartesian3.magnitudeSquared(this.axis) < 1e-16) Cartesian3.clone(pose.up, this.axis);
      Cartesian3.normalize(this.axis, this.axis);
      Quaternion.fromAxisAngle(this.axis, turn, this.correction);
      Quaternion.multiply(this.correction, this.quaternion, this.quaternion);
      Matrix3.fromQuaternion(this.quaternion, this.matrix);
      Cartesian3.negate(Matrix3.getColumn(this.matrix, 2, pose.direction), pose.direction);
      Matrix3.getColumn(this.matrix, 1, pose.up);
    }
    const a = this.overview ? stationDistance * this.initialDistance / Math.max(1, this.initialStationDistance) : this.initialDistance;
    const b = this.overview ? this.earthDistance : stationDistance;
    this.focusDistance = Math.exp(Math.log(Math.max(1, a)) * (1 - this.focusBlend) + Math.log(b) * this.focusBlend);
    if (q === 0) {
      Cartesian3.clone(this.start.direction, pose.direction);
      Cartesian3.clone(this.start.up, pose.up);
      this.focusDistance = this.initialDistance;
    } else if (q === 1 && this.overview) {
      Cartesian3.clone(this.overview.direction, pose.direction);
      Cartesian3.clone(this.overview.up, pose.up);
      this.focusDistance = this.earthDistance;
    }
    this.updateFocus(pose);
  }

  /** Reapply the positive focal radius after the retained C1 pose tangent. */
  updateFocus(pose: CameraPose, distanceCorrection = 0): void {
    Cartesian3.multiplyByScalar(pose.direction, Math.max(1, this.focusDistance + distanceCorrection), this.ray);
    Cartesian3.add(pose.position, this.ray, this.focusPoint);

  }
}
