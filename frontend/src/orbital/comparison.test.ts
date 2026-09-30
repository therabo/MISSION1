import { describe, expect, it } from 'vitest';
import { parseComparison } from './comparison';
import { oppositeSideDistance, primaryOpacity } from '../cesium/trajectoryRendering';

/** Synthetic test-only positions; no values in this test represent ISS observations. */
function fixture(available: boolean) {
  const center = Date.parse('2026-09-30T10:30:00Z');
  const period = 5580;
  const samples = Array.from({ length: 181 }, (_, index) => {
    const phase = (index - 90) / 180 * 2 * Math.PI;
    return {
      time: new Date(center + Math.round((index - 90) * period / 180 * 1000)).toISOString(),
      xMeters: 6_800_000 * Math.cos(phase),
      yMeters: 6_800_000 * Math.sin(phase),
      zMeters: 100_000,
    };
  });
  return {
    generatedAt: new Date(center).toISOString(),
    primary: {
      classification: 'COMPUTED_FROM_ORBITAL_ELEMENTS', frame: 'ITRF_2020_IERS_2010', positionUnit: 'm',
      orbitalPeriodSeconds: period, currentSampleIndex: 90,
      source: { provider: 'CELESTRAK_GP', elementEpoch: new Date(center - 3600_000).toISOString(), elementSha256: 'a'.repeat(64) },
      samples,
    },
    oem: {
      classification: 'SOURCE_PROVIDED_PREDICTED_EPHEMERIS',
      sampleMethod: 'CUBIC_HERMITE_FROM_SOURCE_POSITION_VELOCITY', sourceFrame: 'EME2000',
      frame: 'ITRF_2020_IERS_2010', positionUnit: 'm',
      availability: available ? 'AVAILABLE' : 'UNAVAILABLE', reason: available ? 'NONE' : 'NO_VALID_OEM_FILE',
      source: available ? {
        creationDate: new Date(center - 86400_000).toISOString(),
        startTime: new Date(center - 86400_000).toISOString(), stopTime: new Date(center + 86400_000).toISOString(),
        retrievedAt: new Date(center).toISOString(), httpLastModified: null, sha256: 'b'.repeat(64),
        sourceUrl: 'https://nasa-public-data.s3.amazonaws.com/iss-coords/current/ISS_OEM/ISS.OEM_J2K_EPH.xml',
      } : null,
      samples: available ? samples.slice(5, 176) : [],
    },
  };
}

describe('comparison product contract', () => {
  it('requires a complete centered propagated revolution and distinct OEM lineage', () => {
    const result = parseComparison(fixture(true));
    expect(result.primary.samples).toHaveLength(181);
    expect(result.primary.samples[90].time).toBe(result.generatedAt);
    expect(result.oem.samples).toHaveLength(171);
    expect(result.oem.classification).not.toBe(result.primary.classification);
  });
  it('preserves primary path when OEM is unavailable', () => {
    const result = parseComparison(fixture(false));
    expect(result.primary.samples).toHaveLength(181);
    expect(result.oem.availability).toBe('UNAVAILABLE');
    expect(result.oem.samples).toHaveLength(0);
  });
  it('rejects mixed or misframed predictions', () => {
    const wrong = fixture(true);
    wrong.oem.sourceFrame = 'TEME';
    expect(() => parseComparison(wrong)).toThrow();
    const missing = fixture(true);
    missing.primary.samples.pop();
    expect(() => parseComparison(missing)).toThrow();
  });
});

describe('moving full-orbit fade', () => {
  const period = 5580;
  const now = Date.parse('2026-09-30T10:30:00Z');
  it('is symmetric about the ISS and reaches minimum on the opposite side', () => {
    expect(primaryOpacity(now, now, period)).toBeCloseTo(0.94);
    expect(primaryOpacity(now - period * 250, now, period)).toBeCloseTo(primaryOpacity(now + period * 250, now, period));
    expect(primaryOpacity(now + period * 500, now, period)).toBeCloseTo(0.08);
    expect(primaryOpacity(now + period * 125, now, period)).toBeGreaterThan(primaryOpacity(now + period * 250, now, period));
  });
  it('tracks scene time using orbital phase rather than a fixed sample index', () => {
    expect(oppositeSideDistance(now + 30_000, now + 30_000, period)).toBe(0);
    expect(primaryOpacity(now + 30_000, now + 30_000, period)).toBeGreaterThan(primaryOpacity(now, now + 30_000, period));
  });
});
