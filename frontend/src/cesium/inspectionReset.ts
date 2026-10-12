import { Cartesian3, Matrix3, Quaternion } from 'cesium';
import { poseQuaternion, type CameraPose } from './cameraPose';
import { clampInspectionOffset } from './inspectionControls';
import { smootherstep } from './inspectionTransition';
import { interpolateUnitDirection } from './inspectionMode';

/** Deliberate user camera return, distinct from the 0.8s source-display repair.
 * Keep meaningful orbit/zoom visible through the C2 acceleration/deceleration.
 * Entry/exit and DisplayRetarget retain their own accepted timing.
 */
export const INSPECTION_RESET_SECONDS = 2.5;

/** Local pose in the existing moving physical F/L/U frame. The Viewer tick
 * owns timing and cancellation, just as it does entry/exit. Quaternion orbit
 * and logarithmic range share one C2 progress; crossing a pole cannot flip up.
 * Native Inspection disables pan/look, so the captured forward ray aims at
 * the pivot. No world endpoint, scene clock, source or physical sample is held.
 */
export class InspectionResetTransition {
  readonly start: CameraPose;
  readonly pose: CameraPose = { position: new Cartesian3(), direction: new Cartesian3(), up: new Cartesian3(), fov: 0 };
  readonly endOffset: Cartesian3;
  private readonly startOrientation = new Quaternion();
  private readonly endOrientation = new Quaternion();
  private readonly orientation = new Quaternion();
  private readonly rotation = new Matrix3();
  private readonly axis = new Cartesian3();
  private readonly turn = new Quaternion();
  private readonly roll = new Quaternion();
  private readonly angle: number;
  private rollAngle = 0;
  private readonly rangeExponent: number;
  private readonly startRange: number;
  private readonly endRange: number;

  constructor(start: CameraPose, endpoint: Cartesian3, readonly startMs: number,
    readonly duration = INSPECTION_RESET_SECONDS, readonly endFov = 100 * Math.PI / 180) {
    this.start = { position: Cartesian3.clone(start.position), direction: Cartesian3.clone(start.direction),
      up: Cartesian3.clone(start.up), fov: start.fov };
    this.endOffset = Cartesian3.clone(endpoint);
    this.startRange = Cartesian3.magnitude(start.position);
    this.endRange = Cartesian3.magnitude(endpoint);
    poseQuaternion(start.direction, start.up, this.startOrientation);
    const direction = Cartesian3.normalize(Cartesian3.negate(endpoint, new Cartesian3()), new Cartesian3());
    poseQuaternion(direction, Cartesian3.UNIT_Z, this.endOrientation);
    this.angle = Cartesian3.angleBetween(start.position, endpoint);
    if (this.angle < 1e-12) Cartesian3.clone(Cartesian3.UNIT_Z, this.axis);
    else {
      // Reuse the accepted stable opposite-direction policy to choose the rail.
      const middle = interpolateUnitDirection(start.position, endpoint, 0.5, new Cartesian3());
      Cartesian3.normalize(Cartesian3.cross(start.position, middle, this.axis), this.axis);
    }
    Matrix3.fromQuaternion(this.endOrientation, this.rotation);
    const endUp = Matrix3.getColumn(this.rotation, 1, new Cartesian3());
    this.orient(1);
    this.rollAngle = Math.atan2(Cartesian3.dot(direction, Cartesian3.cross(this.pose.up, endUp, new Cartesian3())),
      Cartesian3.dot(this.pose.up, endUp));
    this.rangeExponent = this.clearanceExponent();
  }

  private orient(progress: number): void {
    // Transport the actual basis along the shortest radial turn, then unwind
    // its roll continuously. A full pose slerp can route a close camera around
    // the wide arrays instead of over the shorter physical radial arc.
    Quaternion.fromAxisAngle(this.axis, this.angle * progress, this.turn);
    Quaternion.multiply(this.turn, this.startOrientation, this.orientation);
    Matrix3.fromQuaternion(this.orientation, this.rotation);
    Matrix3.getColumn(this.rotation, 2, this.pose.direction);
    Cartesian3.negate(this.pose.direction, this.pose.direction);
    Quaternion.fromAxisAngle(this.pose.direction, this.rollAngle * progress, this.roll);
    Quaternion.multiply(this.roll, this.orientation, this.orientation);
    Matrix3.fromQuaternion(this.orientation, this.rotation);
    Matrix3.getColumn(this.rotation, 1, this.pose.up);
  }

  private clearanceExponent(): number {
    if (this.endRange <= this.startRange) return 1;
    const logarithmicSpan = Math.log(this.endRange / this.startRange);
    let required = 1;
    // Bounded capture-time preflight, using the existing clearance formula.
    // Only a close outward reset needs extra radial progress. Without it the
    // live clamp could push range out, then back in as an array edge clears.
    for (let i = 1; i < 512; i++) {
      const progress = i / 512;
      this.orient(progress);
      Cartesian3.negate(this.pose.direction, this.pose.position);
      const clearance = Cartesian3.magnitude(clampInspectionOffset(this.pose.position));
      if (clearance <= this.startRange) continue;
      const fraction = Math.log(clearance / this.startRange) / logarithmicSpan;
      required = Math.max(required, Math.log1p(-fraction) / Math.log1p(-progress));
    }
    // Ten percent preflight headroom changes the radial timing, never the
    // accepted geometry/clearance or endpoint. Every value still derives from
    // the one C2 clock; the per-frame safety clamp remains the final guard.
    return required > 1 + 1e-12 ? required * 1.1 : 1;
  }

  evaluate(progress: number): CameraPose {
    const ease = smootherstep(progress);
    if (ease === 0) {
      Cartesian3.clone(this.start.position, this.pose.position);
      Cartesian3.clone(this.start.direction, this.pose.direction);
      Cartesian3.clone(this.start.up, this.pose.up);
      this.pose.fov = this.start.fov;
      return this.pose;
    }
    this.orient(ease);
    const radial = this.rangeExponent === 1 ? ease : 1 - (1 - ease) ** this.rangeExponent;
    const range = Math.exp(Math.log(this.startRange) * (1 - radial) + Math.log(this.endRange) * radial);
    Cartesian3.multiplyByScalar(this.pose.direction, -range, this.pose.position);
    clampInspectionOffset(this.pose.position);
    if (ease === 1) Cartesian3.clone(this.endOffset, this.pose.position);
    this.pose.fov = this.start.fov + (this.endFov - this.start.fov) * ease;
    return this.pose;
  }
}
