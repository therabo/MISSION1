export type OrbitalQuality = 'GOOD' | 'STALE' | 'UNKNOWN';
export type AcquisitionStatus = 'UNKNOWN' | 'HEALTHY' | 'DEGRADED';

export interface OrbitalSamplesResponse {
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  stepSeconds: number;
  frame: 'ITRF_2020_IERS_2010';
  positionUnit: 'm';
  classification: 'COMPUTED_FROM_ORBITAL_ELEMENTS';
  timeSemantics: {
    past: 'RECONSTRUCTED_FROM_SELECTED_ORBITAL_ELEMENTS';
    atGeneratedAt: 'COMPUTED_CURRENT_FROM_ORBITAL_ELEMENTS';
    future: 'COMPUTED_PREDICTION_FROM_ORBITAL_ELEMENTS';
  };
  source: {
    noradCatalogNumber: number;
    provider: string;
    upstreamOrigin: string;
    sourceFormat: string;
    elementEpoch: string;
    retrievedAt: string;
    publishedAt: string | null;
    elementSha256: string;
    classification: 'SOURCE_PROVIDED_ORBITAL_ELEMENTS';
    propagationMethod: string;
  };
  qualityAtGeneratedAt: {
    status: OrbitalQuality;
    reason: string;
    policy: string;
    elementAgeSeconds: number;
    retrievalAgeSeconds: number;
  };
  sourceHealth: {
    status: AcquisitionStatus;
    lastAttemptAt: string | null;
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
    consecutiveFailures: number;
    lastFailureCategory: string | null;
    lastSuccessfulResult: string | null;
  };
  currentGeodetic: {
    datum: 'WGS84';
    latitudeDegrees: number;
    longitudeDegrees: number;
    altitudeMeters: number;
  };
  samples: Array<{
    time: string;
    xMeters: number;
    yMeters: number;
    zMeters: number;
  }>;
}

export interface OrbitalWindow {
  response: OrbitalSamplesResponse;
  generatedMs: number;
  startMs: number;
  endMs: number;
  /** Request duration used only for initial scene-clock alignment. */
  requestDurationMs: number;
}
