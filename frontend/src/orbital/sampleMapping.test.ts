import { describe, expect, it } from 'vitest';
import { parseOrbitalWindow } from './sampleMapping';
import { orbitalPayload } from '../test/orbitalFixture';

describe('orbital REST mapping', () => {
  it('keeps UTC roles, XYZ meters, WGS84, quality and source identity', () => {
    const window = parseOrbitalWindow(orbitalPayload(), 84);
    expect(window.generatedMs).toBe(Date.parse('2026-09-28T15:00:00Z'));
    expect(window.endMs - window.startMs).toBe(20_000);
    expect(window.requestDurationMs).toBe(84);
    expect(window.response.samples[1].xMeters).toBeCloseTo(-243964.3795801904, 5);
    expect(window.response.currentGeodetic.altitudeMeters).toBeCloseTo(416440.6167916849, 5);
    expect(window.response.source.publishedAt).toBeNull();
    expect(window.response.classification).toBe('COMPUTED_FROM_ORBITAL_ELEMENTS');
    expect(window.response.source.classification).toBe('SOURCE_PROVIDED_ORBITAL_ELEMENTS');
  });

  it('parses an explicit ISO offset as the same UTC instant', () => {
    const payload = orbitalPayload();
    payload.generatedAt = '2026-09-28T17:00:00+02:00';
    expect(parseOrbitalWindow(payload).generatedMs).toBe(Date.parse('2026-09-28T15:00:00Z'));
  });

  it.each([
    ['missing frame', (p: Record<string, unknown>) => { delete p.frame; }],
    ['wrong frame', (p: Record<string, unknown>) => { p.frame = 'TEME'; }],
    ['missing source identity', (p: Record<string, unknown>) => { p.source = {}; }],
    ['bad timestamp', (p: Record<string, unknown>) => { p.generatedAt = '2026-09-28T15:00:00'; }],
    ['nonfinite XYZ', (p: Record<string, unknown>) => { (p.samples as Record<string, unknown>[])[1].xMeters = Infinity; }],
    ['wrong time grid', (p: Record<string, unknown>) => { (p.samples as Record<string, unknown>[])[2].time = '2026-09-28T15:00:11Z'; }],
  ])('rejects %s', (_label, mutate) => {
    const payload = orbitalPayload();
    mutate(payload);
    expect(() => parseOrbitalWindow(payload)).toThrow();
  });

  it('keeps GOOD orbital quality independent of DEGRADED acquisition', () => {
    const payload = orbitalPayload();
    (payload.sourceHealth as Record<string, unknown>).status = 'DEGRADED';
    const window = parseOrbitalWindow(payload);
    expect(window.response.qualityAtGeneratedAt.status).toBe('GOOD');
    expect(window.response.sourceHealth.status).toBe('DEGRADED');
  });

  it('retains explicit STALE quality and the path', () => {
    const payload = orbitalPayload();
    (payload.qualityAtGeneratedAt as Record<string, unknown>).status = 'STALE';
    (payload.qualityAtGeneratedAt as Record<string, unknown>).reason = 'ELEMENT_TOO_OLD';
    const window = parseOrbitalWindow(payload);
    expect(window.response.qualityAtGeneratedAt.status).toBe('STALE');
    expect(window.response.samples).toHaveLength(3);
  });
});
