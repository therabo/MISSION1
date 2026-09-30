/** Frozen backend Orekit output from the verified 2026-09-28 ISS TLE, for tests only. */
export function orbitalPayload(): Record<string, unknown> {
  return {
    generatedAt: '2026-09-28T15:00:00Z',
    windowStart: '2026-09-28T14:59:50Z',
    windowEnd: '2026-09-28T15:00:10Z',
    stepSeconds: 10,
    frame: 'ITRF_2020_IERS_2010',
    positionUnit: 'm',
    velocityUnit: 'm/s',
    classification: 'COMPUTED_FROM_ORBITAL_ELEMENTS',
    timeSemantics: {
      past: 'RECONSTRUCTED_FROM_SELECTED_ORBITAL_ELEMENTS',
      atGeneratedAt: 'COMPUTED_CURRENT_FROM_ORBITAL_ELEMENTS',
      future: 'COMPUTED_PREDICTION_FROM_ORBITAL_ELEMENTS',
    },
    source: {
      noradCatalogNumber: 25544,
      provider: 'CELESTRAK_GP',
      upstreamOrigin: 'USSF_GP_VIA_CELESTRAK',
      sourceFormat: 'TLE',
      elementEpoch: '2026-09-28T03:24:39.835008Z',
      retrievedAt: '2026-09-28T13:58:32Z',
      publishedAt: null,
      elementSha256: '151bdb4cf2b7128ac815aa975736ffec0c28211751963e8be7263aad7b7abc71',
      classification: 'SOURCE_PROVIDED_ORBITAL_ELEMENTS',
      propagationMethod: 'OREKIT_TLE_SGP4_SDP4',
    },
    qualityAtGeneratedAt: {
      status: 'GOOD', reason: 'NONE', policy: 'orbital-current-v1',
      elementAgeSeconds: 41720.164992, retrievalAgeSeconds: 3688,
    },
    sourceHealth: {
      status: 'HEALTHY', lastAttemptAt: '2026-09-28T13:58:32Z',
      lastSuccessAt: '2026-09-28T13:58:32Z', lastFailureAt: null,
      consecutiveFailures: 0, lastFailureCategory: null, lastSuccessfulResult: 'INSERTED',
    },
    currentGeodetic: {
      datum: 'WGS84', latitudeDegrees: 4.691110553879,
      longitudeDegrees: 92.064565848349, altitudeMeters: 416440.6167916849,
    },
    samples: [
      { time: '2026-09-28T14:59:50Z', xMeters: -201017.90290512424, yMeters: 6763786.6790144, zMeters: 611957.2480764382, vxMetersPerSecond: -4296.294269155388, vyMetersPerSecond: 417.3389906319478, vzMetersPerSecond: -5971.305011250112 },
      { time: '2026-09-28T15:00:00Z', xMeters: -243964.3795801904, yMeters: 6767562.779805377, zMeters: 552206.5345118039, vxMetersPerSecond: -4292.9239870055135, vyMetersPerSecond: 337.8637432130352, vzMetersPerSecond: -5978.733579946136 },
      { time: '2026-09-28T15:00:10Z', xMeters: -286875.012187182, yMeters: 6770543.884322944, zMeters: 492385.3499294569, vxMetersPerSecond: -4289.125671499871, vyMetersPerSecond: 258.34138587642013, vzMetersPerSecond: -5985.399079879417 },
    ],
  };
}
