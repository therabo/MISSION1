import {
  Cartesian3,
  ExtrapolationType,
  JulianDate,
  LinearApproximation,
  ReferenceFrame,
  SampledPositionProperty,
} from 'cesium';
import type { OrbitalWindow } from '../orbital/types';

export function makePositionProperty(window: OrbitalWindow): SampledPositionProperty {
  const property = new SampledPositionProperty(ReferenceFrame.FIXED);
  property.setInterpolationOptions({ interpolationAlgorithm: LinearApproximation, interpolationDegree: 1 });
  property.forwardExtrapolationType = ExtrapolationType.NONE;
  property.backwardExtrapolationType = ExtrapolationType.NONE;
  const times = window.response.samples.map((sample) => JulianDate.fromIso8601(sample.time));
  const positions = window.response.samples.map((sample) =>
    new Cartesian3(sample.xMeters, sample.yMeters, sample.zMeters));
  property.addSamples(times, positions);
  return property;
}
