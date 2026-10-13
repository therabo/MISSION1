import { Cartesian3, Cartesian4, Ellipsoid, Matrix4 } from 'cesium';

// Verified pinned VTAD geometry: source +Z points toward Harmony, +Y away
// from Cupola. Cesium's (X,Y,Z)->(Z,X,Y) conversion gives +X forward,
// +Y left, +Z up. The remaining asset correction is therefore identity.

/** Reused per Viewer; no quaternion sign ambiguity or per-frame matrix allocation. */
export class TrajectoryVisualFrame {
  private column = new Cartesian4();
  private forward = new Cartesian3();
  private left = new Cartesian3();
  private up = new Cartesian3();
  private previousLeft = new Cartesian3();
  private hasPrevious = false;

  /** X=forward, Y=left, Z=corrected ellipsoid-up, all in ITRF at one UTC. */
  update(position: Cartesian3, velocity: Cartesian3, result: Matrix4): Matrix4 | undefined {
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y) || !Number.isFinite(position.z) ||
        !Number.isFinite(velocity.x) || !Number.isFinite(velocity.y) || !Number.isFinite(velocity.z) ||
        Cartesian3.magnitudeSquared(position) < 1 || Cartesian3.magnitudeSquared(velocity) < 1e-12) return undefined;
    Cartesian3.normalize(velocity, this.forward);
    Ellipsoid.WGS84.geodeticSurfaceNormal(position, this.up);
    Cartesian3.cross(this.up, this.forward, this.left);
    if (Cartesian3.magnitudeSquared(this.left) < 1e-10) {
      // Parallel velocity/up: retain the preceding transverse axis if usable.
      if (this.hasPrevious) {
        const along = Cartesian3.dot(this.previousLeft, this.forward);
        Cartesian3.multiplyByScalar(this.forward, along, this.up);
        Cartesian3.subtract(this.previousLeft, this.up, this.left);
      }
      if (!this.hasPrevious || Cartesian3.magnitudeSquared(this.left) < 1e-10) {
        Cartesian3.mostOrthogonalAxis(this.forward, this.up);
        Cartesian3.cross(this.up, this.forward, this.left);
      }
    }
    Cartesian3.normalize(this.left, this.left);
    Cartesian3.normalize(Cartesian3.cross(this.forward, this.left, this.up), this.up);
    Cartesian3.clone(this.left, this.previousLeft);
    this.hasPrevious = true;
    Matrix4.setColumn(result, 0, Cartesian4.fromElements(this.forward.x, this.forward.y, this.forward.z, 0, this.column), result);
    Matrix4.setColumn(result, 1, Cartesian4.fromElements(this.left.x, this.left.y, this.left.z, 0, this.column), result);
    Matrix4.setColumn(result, 2, Cartesian4.fromElements(this.up.x, this.up.y, this.up.z, 0, this.column), result);
    Matrix4.setColumn(result, 3, Cartesian4.fromElements(position.x, position.y, position.z, 1, this.column), result);
    return result;
  }
}
