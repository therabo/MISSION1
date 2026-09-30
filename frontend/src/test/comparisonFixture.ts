/** Synthetic test-only positions; no values in this test represent ISS observations. */
export function fixture(available: boolean) {
  const start = Date.parse('2026-09-30T10:30:00Z');
  const period = 5580;
  const samples = Array.from({ length: 181 }, (_, index) => {
    const phase = index / 180 * 2 * Math.PI;
    return {
      time: new Date(start + Math.round(index * period / 180 * 1000)).toISOString(),
      xMeters: 6_800_000 * Math.cos(phase),
      yMeters: 6_800_000 * Math.sin(phase),
      zMeters: 100_000,
      vxMetersPerSecond: -6_800_000 * 2 * Math.PI / period * Math.sin(phase),
      vyMetersPerSecond: 6_800_000 * 2 * Math.PI / period * Math.cos(phase),
      vzMetersPerSecond: 0,
    };
  });
  return {
    generatedAt: new Date(start).toISOString(),
    primary: {
      classification: 'COMPUTED_FROM_ORBITAL_ELEMENTS', frame: 'ITRF_2020_IERS_2010', positionUnit: 'm', velocityUnit: 'm/s',
      orbitalPeriodSeconds: period, currentSampleIndex: 0,
      source: { provider: 'CELESTRAK_GP', elementEpoch: new Date(start - 3600_000).toISOString(), elementSha256: 'a'.repeat(64) },
      samples,
    },
    oem: {
      classification: 'SOURCE_PROVIDED_PREDICTED_EPHEMERIS',
      sampleMethod: 'CUBIC_HERMITE_FROM_SOURCE_POSITION_VELOCITY', sourceFrame: 'EME2000',
      frame: 'ITRF_2020_IERS_2010', positionUnit: 'm', velocityUnit: 'm/s',
      availability: available ? 'AVAILABLE' : 'UNAVAILABLE', reason: available ? 'NONE' : 'NO_VALID_OEM_FILE',
      source: available ? {
        creationDate: new Date(start - 86400_000).toISOString(),
        startTime: new Date(start - 86400_000).toISOString(), stopTime: new Date(start + 86400_000).toISOString(),
        retrievedAt: new Date(start).toISOString(), httpLastModified: null, sha256: 'b'.repeat(64),
        sourceUrl: 'https://nasa-public-data.s3.amazonaws.com/iss-coords/current/ISS_OEM/ISS.OEM_J2K_EPH.xml',
      } : null,
      samples: available ? samples.slice() : [],
    },
  };
}
