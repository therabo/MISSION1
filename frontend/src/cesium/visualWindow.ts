import { Cartesian3, JulianDate, ReferenceFrame, type SampledPositionProperty } from 'cesium';
import type { OrbitalWindow } from '../orbital/types';
import { makePositionProperty } from './sampleProperty';

export interface VisualWindow {
  orbital: OrbitalWindow;
  position: SampledPositionProperty;
}

export function createVisualWindow(orbital: OrbitalWindow): VisualWindow {
  return { orbital, position: makePositionProperty(orbital) };
}

/** Marker/path and model consume this one fixed-frame sampled property. */
export function modelPositionAt(window: VisualWindow, time: JulianDate, result: Cartesian3): Cartesian3 | undefined {
  return window.position.getValueInReferenceFrame(time, ReferenceFrame.FIXED, result);
}
