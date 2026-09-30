export interface TrajectorySample {
  time: string;
  xMeters: number;
  yMeters: number;
  zMeters: number;
  vxMetersPerSecond?: number;
  vyMetersPerSecond?: number;
  vzMetersPerSecond?: number;
}

export interface ComparisonResponse {
  generatedAt: string;
  primary: {
    classification: 'COMPUTED_FROM_ORBITAL_ELEMENTS';
    frame: 'ITRF_2020_IERS_2010';
    positionUnit: 'm';
    velocityUnit: 'm/s';
    orbitalPeriodSeconds: number;
    currentSampleIndex: number;
    source: { provider: string; elementEpoch: string; elementSha256: string };
    samples: TrajectorySample[];
  };
  oem: {
    classification: 'SOURCE_PROVIDED_PREDICTED_EPHEMERIS';
    sampleMethod: 'CUBIC_HERMITE_FROM_SOURCE_POSITION_VELOCITY';
    sourceFrame: 'EME2000';
    frame: 'ITRF_2020_IERS_2010';
    positionUnit: 'm';
    velocityUnit: 'm/s';
    availability: 'AVAILABLE' | 'DEGRADED' | 'UNAVAILABLE';
    reason: string;
    source: null | {
      creationDate: string;
      startTime: string;
      stopTime: string;
      retrievedAt: string;
      httpLastModified: string | null;
      sha256: string;
      sourceUrl: string;
    };
    samples: TrajectorySample[];
  };
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid comparison response');
  return value as Record<string, unknown>;
}
function instant(value: unknown): number {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d\d:\d\d)$/.test(value)) throw new Error('Invalid comparison time');
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error('Invalid comparison time');
  return parsed;
}
function samples(value: unknown, max: number): TrajectorySample[] {
  if (!Array.isArray(value) || value.length > max) throw new Error('Invalid comparison samples');
  let previous = -Infinity;
  for (const raw of value) {
    const point = object(raw);
    const time = instant(point.time);
    if (time <= previous) throw new Error('Comparison samples out of order');
    previous = time;
    if (![point.vxMetersPerSecond, point.vyMetersPerSecond, point.vzMetersPerSecond].every(v => typeof v === 'number' && Number.isFinite(v)) ||
        Math.hypot(point.vxMetersPerSecond as number, point.vyMetersPerSecond as number, point.vzMetersPerSecond as number) < 1) throw new Error('Invalid comparison velocity');
    const coordinates = [point.xMeters, point.yMeters, point.zMeters];
    if (!coordinates.every((number) => typeof number === 'number' && Number.isFinite(number)) ||
        Math.hypot(...coordinates as number[]) < 6_000_000 || Math.hypot(...coordinates as number[]) > 10_000_000) {
      throw new Error('Invalid comparison position');
    }
  }
  return value as TrajectorySample[];
}

export function parseComparison(payload: unknown): ComparisonResponse {
  const root = object(payload);
  const generated = instant(root.generatedAt);
  const primary = object(root.primary);
  if (primary.classification !== 'COMPUTED_FROM_ORBITAL_ELEMENTS' ||
      primary.frame !== 'ITRF_2020_IERS_2010' || primary.positionUnit !== 'm' || primary.velocityUnit !== 'm/s' ||
      primary.currentSampleIndex !== 0 || typeof primary.orbitalPeriodSeconds !== 'number' ||
      primary.orbitalPeriodSeconds < 5_000 || primary.orbitalPeriodSeconds > 7_000) {
    throw new Error('Unsupported primary comparison product');
  }
  const primarySamples = samples(primary.samples, 181);
  if (primarySamples.length !== 181 || instant(primarySamples[0].time) !== generated ||
      Math.abs((instant(primarySamples[180].time) - generated) / 1000 - primary.orbitalPeriodSeconds) > 0.002) {
    throw new Error('Incomplete forward-orbit trajectory');
  }
  if (primarySamples.some((sample, index) => Math.abs(instant(sample.time) -
      (generated + index * (primary.orbitalPeriodSeconds as number) / 180 * 1000)) > 2)) {
    throw new Error('Irregular forward-orbit sampling');
  }
  const source = object(primary.source);
  if (typeof source.elementSha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(source.elementSha256) ||
      typeof source.provider !== 'string') throw new Error('Invalid primary lineage');
  instant(source.elementEpoch);
  const oem = object(root.oem);
  if (oem.classification !== 'SOURCE_PROVIDED_PREDICTED_EPHEMERIS' ||
      oem.sampleMethod !== 'CUBIC_HERMITE_FROM_SOURCE_POSITION_VELOCITY' ||
      oem.sourceFrame !== 'EME2000' || oem.frame !== 'ITRF_2020_IERS_2010' || oem.positionUnit !== 'm' || oem.velocityUnit !== 'm/s' ||
      !['AVAILABLE', 'DEGRADED', 'UNAVAILABLE'].includes(String(oem.availability)) ||
      typeof oem.reason !== 'string') throw new Error('Unsupported NASA comparison product');
  const oemSamples = samples(oem.samples, 181);
  if (oem.availability === 'UNAVAILABLE' && oemSamples.length !== 0) throw new Error('Unavailable OEM has samples');
  if (oem.availability !== 'UNAVAILABLE' && oemSamples.length < 2) throw new Error('Available OEM lacks samples');
  if (oemSamples.length > 1) {
    const first = instant(oemSamples[0].time);
    const last = instant(oemSamples[oemSamples.length - 1].time);
    if (first < generated || last > instant(primarySamples[180].time) ||
        oemSamples.some((sample, index) => Math.abs(instant(sample.time) -
          (first + index * (last - first) / (oemSamples.length - 1))) > 2)) {
      throw new Error('Invalid OEM forward sampling');
    }
  }
  if (oem.source !== null) {
    const nasa = object(oem.source);
    for (const field of ['creationDate', 'startTime', 'stopTime', 'retrievedAt']) instant(nasa[field]);
    if (instant(nasa.stopTime) <= instant(nasa.startTime) || oemSamples.some((sample) =>
        instant(sample.time) < instant(nasa.startTime) || instant(sample.time) > instant(nasa.stopTime))) {
      throw new Error('OEM samples outside source coverage');
    }
    if (nasa.httpLastModified !== null) instant(nasa.httpLastModified);
    if (typeof nasa.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(nasa.sha256)) throw new Error('Invalid OEM lineage');
    if (nasa.sourceUrl !== 'https://nasa-public-data.s3.amazonaws.com/iss-coords/current/ISS_OEM/ISS.OEM_J2K_EPH.xml') throw new Error('Unexpected OEM source');
  } else if (oem.availability !== 'UNAVAILABLE') throw new Error('Available OEM has no lineage');
  return root as unknown as ComparisonResponse;
}
