import { Cartesian3, JulianDate, Matrix4, ReferenceFrame, Transforms } from 'cesium';
import type { VisualWindow } from '../cesium/visualWindow';

/** Test-only fixed-frame sample reader; never an application trajectory path. */
export function modelPositionAt(window: VisualWindow, time: JulianDate, result: Cartesian3): Cartesian3 | undefined {
  return window.position.getValueInReferenceFrame(time, ReferenceFrame.FIXED, result);
}

/** Test-only reference ENU frame for source/display isolation geometry. */
export function cameraTrackingFrame(position: Cartesian3, result?: Matrix4): Matrix4 {
  return Transforms.eastNorthUpToFixedFrame(position, undefined, result);
}
