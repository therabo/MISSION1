import { Cartesian3, ExtrapolationType, JulianDate, LinearApproximation, SampledProperty } from 'cesium';
import type { TrajectorySample } from '../orbital/comparison';

/** Backend ITRF velocity samples, bounded independently of display position/lift. */
export function makeVelocityProperty(samples: TrajectorySample[]): SampledProperty {
  if (samples.some(s => ![s.vxMetersPerSecond, s.vyMetersPerSecond, s.vzMetersPerSecond].every(v => typeof v === 'number' && Number.isFinite(v)))) throw new Error('Missing physical velocity');
  const property = new SampledProperty(Cartesian3);
  property.setInterpolationOptions({ interpolationAlgorithm: LinearApproximation, interpolationDegree: 1 });
  property.forwardExtrapolationType = ExtrapolationType.NONE;
  property.backwardExtrapolationType = ExtrapolationType.NONE;
  property.addSamples(samples.map(s => JulianDate.fromIso8601(s.time)), samples.map(s =>
    new Cartesian3(s.vxMetersPerSecond, s.vyMetersPerSecond, s.vzMetersPerSecond)));
  return property;
}
