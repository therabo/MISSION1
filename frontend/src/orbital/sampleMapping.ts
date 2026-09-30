import type { OrbitalSamplesResponse, OrbitalWindow } from './types';

type RecordValue = Record<string, unknown>;

function object(value: unknown, name: string): RecordValue {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value as RecordValue;
}

function text(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${name} is missing`);
  return value;
}

function number(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${name} must be finite`);
  return value;
}

function instant(value: unknown, name: string): number {
  const input = text(value, name);
  // Every contract instant must explicitly state UTC or an offset.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(input)) {
    throw new Error(`${name} must include an ISO UTC offset`);
  }
  const parsed = Date.parse(input);
  if (!Number.isFinite(parsed)) throw new Error(`${name} is invalid`);
  return parsed;
}

function nullableInstant(value: unknown, name: string): void {
  if (value !== null) instant(value, name);
}

function expect(value: unknown, wanted: string, name: string): void {
  if (value !== wanted) throw new Error(`${name} is unsupported`);
}

export function parseOrbitalWindow(payload: unknown, requestDurationMs = 0): OrbitalWindow {
  const root = object(payload, 'response');
  const generatedMs = instant(root.generatedAt, 'generatedAt');
  const startMs = instant(root.windowStart, 'windowStart');
  const endMs = instant(root.windowEnd, 'windowEnd');
  const stepSeconds = number(root.stepSeconds, 'stepSeconds');
  if (!Number.isInteger(stepSeconds) || stepSeconds < 5 || stepSeconds > 30 || startMs > generatedMs || generatedMs >= endMs) {
    throw new Error('Sample window bounds are invalid');
  }
  expect(root.frame, 'ITRF_2020_IERS_2010', 'frame');
  expect(root.positionUnit, 'm', 'positionUnit');
  expect(root.velocityUnit, 'm/s', 'velocityUnit');
  expect(root.classification, 'COMPUTED_FROM_ORBITAL_ELEMENTS', 'classification');

  const semantics = object(root.timeSemantics, 'timeSemantics');
  expect(semantics.past, 'RECONSTRUCTED_FROM_SELECTED_ORBITAL_ELEMENTS', 'past semantics');
  expect(semantics.atGeneratedAt, 'COMPUTED_CURRENT_FROM_ORBITAL_ELEMENTS', 'current semantics');
  expect(semantics.future, 'COMPUTED_PREDICTION_FROM_ORBITAL_ELEMENTS', 'future semantics');

  const source = object(root.source, 'source');
  if (number(source.noradCatalogNumber, 'source.noradCatalogNumber') !== 25544) throw new Error('Unexpected catalog identity');
  text(source.provider, 'source.provider');
  text(source.upstreamOrigin, 'source.upstreamOrigin');
  text(source.sourceFormat, 'source.sourceFormat');
  text(source.propagationMethod, 'source.propagationMethod');
  instant(source.elementEpoch, 'source.elementEpoch');
  instant(source.retrievedAt, 'source.retrievedAt');
  nullableInstant(source.publishedAt, 'source.publishedAt');
  expect(source.classification, 'SOURCE_PROVIDED_ORBITAL_ELEMENTS', 'source.classification');
  if (!/^[a-f0-9]{64}$/i.test(text(source.elementSha256, 'source.elementSha256'))) {
    throw new Error('Source element hash is invalid');
  }

  const quality = object(root.qualityAtGeneratedAt, 'qualityAtGeneratedAt');
  if (!['GOOD', 'STALE', 'UNKNOWN'].includes(text(quality.status, 'quality.status'))) throw new Error('Quality status is invalid');
  text(quality.reason, 'quality.reason');
  text(quality.policy, 'quality.policy');
  number(quality.elementAgeSeconds, 'quality.elementAgeSeconds');
  number(quality.retrievalAgeSeconds, 'quality.retrievalAgeSeconds');

  const health = object(root.sourceHealth, 'sourceHealth');
  if (!['UNKNOWN', 'HEALTHY', 'DEGRADED'].includes(text(health.status, 'sourceHealth.status'))) {
    throw new Error('Source-health status is invalid');
  }
  for (const name of ['lastAttemptAt', 'lastSuccessAt', 'lastFailureAt']) nullableInstant(health[name], `sourceHealth.${name}`);
  if (!Number.isInteger(number(health.consecutiveFailures, 'sourceHealth.consecutiveFailures')) || (health.consecutiveFailures as number) < 0) {
    throw new Error('Source-health failure count is invalid');
  }
  for (const name of ['lastFailureCategory', 'lastSuccessfulResult']) {
    if (health[name] !== null) text(health[name], `sourceHealth.${name}`);
  }

  const location = object(root.currentGeodetic, 'currentGeodetic');
  expect(location.datum, 'WGS84', 'currentGeodetic.datum');
  const latitude = number(location.latitudeDegrees, 'currentGeodetic.latitudeDegrees');
  const longitude = number(location.longitudeDegrees, 'currentGeodetic.longitudeDegrees');
  number(location.altitudeMeters, 'currentGeodetic.altitudeMeters');
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error('Geodetic angles are invalid');

  if (!Array.isArray(root.samples) || root.samples.length < 2 || root.samples.length > 181) {
    throw new Error('Sample array size is invalid');
  }
  let hasGeneratedSample = false;
  root.samples.forEach((entry, index) => {
    const sample = object(entry, `samples[${index}]`);
    const time = instant(sample.time, `samples[${index}].time`);
    if (time !== startMs + index * stepSeconds * 1000) throw new Error('Sample time grid is invalid');
    if (time === generatedMs) hasGeneratedSample = true;
    const x = number(sample.xMeters, `samples[${index}].xMeters`);
    const y = number(sample.yMeters, `samples[${index}].yMeters`);
    const z = number(sample.zMeters, `samples[${index}].zMeters`);
    const speed = Math.hypot(...['vxMetersPerSecond', 'vyMetersPerSecond', 'vzMetersPerSecond'].map(k => number(sample[k], k)));
    if (speed < 1) throw new Error('Sample velocity is invalid');
    const radius = Math.hypot(x, y, z);
    if (radius < 6_000_000 || radius > 10_000_000) throw new Error('Sample radius is implausible for ISS');
  });
  if (!hasGeneratedSample || startMs + (root.samples.length - 1) * stepSeconds * 1000 !== endMs) {
    throw new Error('Sample window endpoints are invalid');
  }
  return {
    response: root as unknown as OrbitalSamplesResponse,
    generatedMs, startMs, endMs,
    requestDurationMs: Math.max(0, requestDurationMs),
  };
}
