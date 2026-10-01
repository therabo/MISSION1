import { Cartesian3, Matrix3, Quaternion } from 'cesium';

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
