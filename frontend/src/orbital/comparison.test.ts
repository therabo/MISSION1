import { describe, expect, it } from 'vitest';
import { parseComparison } from './comparison';
import { fixture } from '../test/comparisonFixture';

describe('comparison product contract', () => {
  it('requires a complete forward propagated revolution and distinct OEM lineage', () => {
    const result = parseComparison(fixture(true));
    expect(result.primary.samples).toHaveLength(181);
    expect(result.primary.samples[0].time).toBe(result.generatedAt);
    expect(Date.parse(result.primary.samples[180].time)).toBe(Date.parse(result.generatedAt) + result.primary.orbitalPeriodSeconds * 1000);
    expect(new Set(result.primary.samples.map((point) => point.time)).size).toBe(181);

    expect(result.oem.samples).toHaveLength(181);
    expect(result.oem.classification).not.toBe(result.primary.classification);
  });
  it('rejects duplicate epochs and an irregular interior time grid', () => {
    const duplicate = fixture(true);
    duplicate.primary.samples[50].time = duplicate.primary.samples[49].time;
    expect(() => parseComparison(duplicate)).toThrow('out of order');
    const irregular = fixture(true);
    irregular.primary.samples[50].time = new Date(Date.parse(irregular.primary.samples[50].time) + 10).toISOString();
    expect(() => parseComparison(irregular)).toThrow('Irregular forward-orbit sampling');
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
    const asymmetric = fixture(true);
    asymmetric.primary.samples[0].time = new Date(Date.parse(asymmetric.generatedAt) - asymmetric.primary.orbitalPeriodSeconds * 400).toISOString();
    expect(() => parseComparison(asymmetric)).toThrow();
  });
});
