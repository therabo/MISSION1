import { type SampledPositionProperty } from 'cesium';
import type { OrbitalWindow } from '../orbital/types';
import { makePositionProperty } from './sampleProperty';
import { makeVelocityProperty } from './velocityProperty';
import type { SampledProperty } from 'cesium';

export interface VisualWindow {
  orbital: OrbitalWindow;
  position: SampledPositionProperty;
  velocity: SampledProperty;
}

export function createVisualWindow(orbital: OrbitalWindow): VisualWindow {
  return { orbital, position: makePositionProperty(orbital), velocity: makeVelocityProperty(orbital.response.samples) };
}
