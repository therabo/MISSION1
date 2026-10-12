import { Cartesian3, Ellipsoid, Matrix3, Quaternion, Transforms } from 'cesium';
import { poseQuaternion, type CameraPose } from './cameraPose';
import { interpolateUnitDirection } from './inspectionMode';
import { smootherstep } from './inspectionTransition';

export const EARTH_RESET_SECONDS = 2.5;
export const EARTH_RESET_HEIGHT_METERS = 17_000_000;

/** The existing Earth setView endpoint: 17,000 km geodetic height above the
 * selected scene's ISS longitude/latitude, default nadir/north-up and held FOV.
 * The caller supplies the already accepted physical position at scene UTC.
 */
export function earthResetTarget(position: Cartesian3, fov: number): CameraPose {
  const geo = Ellipsoid.WGS84.cartesianToCartographic(position)!;
  geo.height = EARTH_RESET_HEIGHT_METERS;
  const destination = Ellipsoid.WGS84.cartographicToCartesian(geo);
  const frame = Transforms.eastNorthUpToFixedFrame(destination);
  return { position: destination, direction: new Cartesian3(-frame[8], -frame[9], -frame[10]),
    up: new Cartesian3(frame[4], frame[5], frame[6]), fov };
}

/** Radius of the WGS84 surface along a geocentric ray. Interpolating positive
 * clearance above that surface avoids a chord through Earth, including poles.
 * This is camera geometry; it neither changes nor propagates an orbital state.
 */
function surfaceRadius(direction: Cartesian3): number {
  const inv = Ellipsoid.WGS84.oneOverRadiiSquared;
  return 1 / Math.sqrt(direction.x ** 2 * inv.x + direction.y ** 2 * inv.y + direction.z ** 2 * inv.z);
}

/** One Viewer-owned C2 timeline, evaluated against the current scene endpoint.
 * Transport the actual basis along the radial arc, then converge its residual
 * aim/roll. Full orientation slerp alone can steer away from Earth mid-flight.
 */
export class EarthResetTransition {
  readonly start: CameraPose;
  readonly pose: CameraPose = { position: new Cartesian3(), direction: new Cartesian3(), up: new Cartesian3(), fov: 0 };
  readonly end: CameraPose;
  private readonly startRadial = new Cartesian3();
  private readonly endRadial = new Cartesian3();
  private readonly radial = new Cartesian3();
  private readonly middle = new Cartesian3();
  private readonly axis = new Cartesian3();
  private readonly nominalEndRadial = new Cartesian3();
  private readonly deltaAxis = new Cartesian3();
  private readonly deltaTurn = new Quaternion();
  private readonly angle: number;
  private readonly startOrientation = new Quaternion();
  private readonly endOrientation = new Quaternion();
  private readonly transportedEnd = new Quaternion();
  private readonly residual = new Quaternion();
  private readonly correction = new Quaternion();
  private readonly turn = new Quaternion();
  private readonly orientation = new Quaternion();
  private readonly rotation = new Matrix3();
  private readonly startClearance: number;

  constructor(start: CameraPose, end: CameraPose, readonly startMs: number,
    readonly duration = EARTH_RESET_SECONDS) {
    this.start = { position: Cartesian3.clone(start.position), direction: Cartesian3.clone(start.direction),
      up: Cartesian3.clone(start.up), fov: start.fov };
    this.end = { position: Cartesian3.clone(end.position), direction: Cartesian3.clone(end.direction),
      up: Cartesian3.clone(end.up), fov: end.fov };
    Cartesian3.normalize(start.position, this.startRadial);
    Cartesian3.normalize(end.position, this.nominalEndRadial);
    this.angle = Cartesian3.angleBetween(this.startRadial, this.nominalEndRadial);
    if (this.angle < 1e-12) Cartesian3.clone(Cartesian3.UNIT_Z, this.axis);
    else {
      interpolateUnitDirection(this.startRadial, this.nominalEndRadial, 0.5, this.middle);
      Cartesian3.normalize(Cartesian3.cross(this.startRadial, this.middle, this.axis), this.axis);
    }
    this.startClearance = Math.max(1e-3, Cartesian3.magnitude(start.position) - surfaceRadius(this.startRadial));
    poseQuaternion(start.direction, start.up, this.startOrientation);
  }

  evaluate(progress: number, endpoint = this.end): CameraPose {
    const u = smootherstep(progress);
    Cartesian3.clone(endpoint.position, this.end.position);
    Cartesian3.clone(endpoint.direction, this.end.direction);
    Cartesian3.clone(endpoint.up, this.end.up); this.end.fov = endpoint.fov;
    if (u === 0 || u === 1) {
      const exact = u === 0 ? this.start : this.end;
      Cartesian3.clone(exact.position, this.pose.position);
      Cartesian3.clone(exact.direction, this.pose.direction);
      Cartesian3.clone(exact.up, this.pose.up); this.pose.fov = exact.fov;
      return this.pose;
    }
    Cartesian3.normalize(this.end.position, this.endRadial);
    // Capture the long rail once. A moving endpoint near the antipode must
    // never choose the opposite hemisphere halfway through the reset.
    const delta = Cartesian3.angleBetween(this.nominalEndRadial, this.endRadial);
    if (delta < 1e-12) Cartesian3.clone(Cartesian3.UNIT_Z, this.deltaAxis);
    else {
      interpolateUnitDirection(this.nominalEndRadial, this.endRadial, 0.5, this.middle);
      Cartesian3.normalize(Cartesian3.cross(this.nominalEndRadial, this.middle, this.deltaAxis), this.deltaAxis);
    }
    Quaternion.fromAxisAngle(this.axis, this.angle * u, this.turn);
    Quaternion.fromAxisAngle(this.deltaAxis, delta * u, this.deltaTurn);
    Quaternion.multiply(this.deltaTurn, this.turn, this.turn);
    Matrix3.multiplyByVector(Matrix3.fromQuaternion(this.turn, this.rotation), this.startRadial, this.radial);
    const endClearance = Math.max(1e-3, Cartesian3.magnitude(this.end.position) - surfaceRadius(this.endRadial));
    const clearance = Math.exp(Math.log(this.startClearance) * (1 - u) + Math.log(endClearance) * u);
    Cartesian3.multiplyByScalar(this.radial, surfaceRadius(this.radial) + clearance, this.pose.position);

    Quaternion.fromAxisAngle(this.axis, this.angle, this.transportedEnd);
    Quaternion.fromAxisAngle(this.deltaAxis, delta, this.deltaTurn);
    Quaternion.multiply(this.deltaTurn, this.transportedEnd, this.transportedEnd);
    Quaternion.multiply(this.transportedEnd, this.startOrientation, this.transportedEnd);
    poseQuaternion(this.end.direction, this.end.up, this.endOrientation);
    // Correct in the transported camera's own basis. A world-space residual
    // roll around the final radial axis would tilt the intermediate aim away
    // from Earth as the radial rail turns beneath it.
    Quaternion.multiply(Quaternion.inverse(this.transportedEnd, this.residual), this.endOrientation, this.residual);
    Quaternion.slerp(Quaternion.IDENTITY, this.residual, u, this.correction);
    Quaternion.multiply(this.turn, this.startOrientation, this.orientation);
    Quaternion.multiply(this.orientation, this.correction, this.orientation);
    // Cesium's near-parallel slerp uses a linear approximation. Normalize its
    // result so the intended basis already matches Camera's orthonormal basis.
    Quaternion.normalize(this.orientation, this.orientation);
    Matrix3.fromQuaternion(this.orientation, this.rotation);
    Cartesian3.negate(Matrix3.getColumn(this.rotation, 2, this.pose.direction), this.pose.direction);
    Matrix3.getColumn(this.rotation, 1, this.pose.up);
    this.pose.fov = this.start.fov + (this.end.fov - this.start.fov) * u;
    return this.pose;
  }
}
