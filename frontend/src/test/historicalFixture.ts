import { replayFixture } from './replayFixture';
import { orbitalPayload } from './orbitalFixture';
import { parseOrbitalWindow } from '../orbital/sampleMapping';

/** Synthetic TEST replay envelope; recorded vectors are retimed for UI tests only. */
export function historicalPayload(at: string, kind: 'GP_TLE' | 'NASA_OEM' = 'GP_TLE') {
  const current = parseOrbitalWindow(orbitalPayload(), 0).response;
  const sample = current.samples[0];
  const baseline = replayFixture(at);
  return { ...baseline, orbit: { ...baseline.orbit, availability: 'AVAILABLE', primary: {
    effectiveAt: at, quality: 'UNKNOWN', frame: 'ITRF_2020_IERS_2010', positionUnit: 'm', velocityUnit: 'm/s',
    position: { x: sample.xMeters, y: sample.yMeters, z: sample.zMeters },
    velocity: { x: sample.vxMetersPerSecond, y: sample.vyMetersPerSecond, z: sample.vzMetersPerSecond },
    ...current.currentGeodetic,
    source: { kind, classification: kind === 'GP_TLE' ? 'COMPUTED_FROM_ORBITAL_ELEMENTS' : 'SOURCE_PROVIDED_PREDICTED_EPHEMERIS',
      contentHash: 'TEST-retimed-source', epoch: kind === 'GP_TLE' ? at : null, creationAt: kind === 'NASA_OEM' ? at : null,
      retrievedAt: at, signedPropagationOffsetSeconds: kind === 'GP_TLE' ? 0 : null },
  } } };
}
