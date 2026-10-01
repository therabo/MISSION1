import { Cartesian3, Matrix3, Matrix4, Quaternion } from 'cesium';
import { interpolateUnitDirection } from './inspectionMode';
import { poseQuaternion, type CameraPose } from './cameraPose';

/** Aim at one continuous displayed target. Retained residual rotations connect
 * actual user framing to that aim, rather than SLERPing unrelated view vectors. */
export class TransitionComposition {
  private readonly startResidual = new Quaternion();
  private readonly endResidual = new Quaternion();
  private readonly aimQuaternion = new Quaternion();
  private readonly residual = new Quaternion();
  private readonly quaternion = new Quaternion();
  private readonly matrix = new Matrix3();
  private readonly direction = new Cartesian3();
  private readonly up = new Cartesian3();
  private readonly endUp = new Cartesian3();
  private readonly cross = new Cartesian3();

  constructor(private readonly start: CameraPose, initialTarget: Cartesian3,
    private readonly overview: CameraPose | null) {
    this.aim(start.position, initialTarget, start.up);
    Quaternion.inverse(this.aimQuaternion, this.residual);
    Quaternion.multiply(this.residual, poseQuaternion(start.direction, start.up, this.quaternion), this.startResidual);
  }

  private aim(position: Cartesian3, target: Cartesian3, preferredUp: Cartesian3): void {
    Cartesian3.subtract(target, position, this.direction);
    if (Cartesian3.magnitudeSquared(this.direction) < 1e-12) throw new Error('Camera target coincides with camera');
    Cartesian3.normalize(this.direction, this.direction);
    Cartesian3.clone(preferredUp, this.up);
    if (Cartesian3.magnitudeSquared(Cartesian3.cross(this.direction, this.up, this.cross)) < 1e-10)
      Cartesian3.mostOrthogonalAxis(this.direction, this.up);
    poseQuaternion(this.direction, this.up, this.aimQuaternion);
  }

  evaluate(pose: CameraPose, target: Cartesian3, frame: Matrix4, progress: number): void {
    const p = Math.max(0, Math.min(1, progress));
    if (this.overview) Cartesian3.clone(this.overview.up, this.endUp);
    else Matrix4.multiplyByPointAsVector(frame, Cartesian3.UNIT_Z, this.endUp);
    if (this.overview) {
      this.aim(this.overview.position, target, this.overview.up);
      Quaternion.inverse(this.aimQuaternion, this.residual);
      Quaternion.multiply(this.residual, poseQuaternion(this.overview.direction, this.overview.up, this.quaternion), this.endResidual);
    } else Quaternion.clone(Quaternion.IDENTITY, this.endResidual);
    interpolateUnitDirection(this.start.up, this.endUp, p, this.up);
    this.aim(pose.position, target, this.up);
    Quaternion.slerp(this.startResidual, this.endResidual, p, this.residual);
    Quaternion.multiply(this.aimQuaternion, this.residual, this.quaternion);
    Matrix3.fromQuaternion(this.quaternion, this.matrix);
    Cartesian3.negate(Matrix3.getColumn(this.matrix, 2, pose.direction), pose.direction);
    Matrix3.getColumn(this.matrix, 1, pose.up);
    if (p === 0) {
      Cartesian3.clone(this.start.direction, pose.direction);
      Cartesian3.clone(this.start.up, pose.up);
    } else if (p === 1 && this.overview) {
      Cartesian3.clone(this.overview.direction, pose.direction);
      Cartesian3.clone(this.overview.up, pose.up);
    }
  }
}
