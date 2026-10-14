import { afterEach, describe, expect, it, vi } from 'vitest';
import { telemetryFixture } from '../test/telemetryFixture';
import { decodeModuleTelemetry, getModuleTelemetry } from './telemetryApi';

afterEach(() => vi.unstubAllGlobals());
describe('local telemetry API contract', () => {
  it('preserves dated engineering value and provider provenance', () => {
    expect(decodeModuleTelemetry(telemetryFixture())).toEqual(telemetryFixture());
  });
  it('accepts no mapping, missing records, raw channels and exact unknown enums', () => {
    const data = telemetryFixture();
    data.parameters[0].record = null;
    expect(decodeModuleTelemetry(data).parameters[0].record).toBeNull();
    data.parameters[0].rawOnly = true; data.parameters[0].unit = null;
    expect(decodeModuleTelemetry(data).parameters[0].rawOnly).toBe(true);
    data.parameters = []; data.mappingStatus = 'NO_VERIFIED_MAPPING';
    expect(decodeModuleTelemetry(data).parameters).toEqual([]);
    const state = telemetryFixture(); state.parameters[0].valueType = 'ENUM_CODE'; state.parameters[0].unit = null;
    Object.assign(state.parameters[0].record!, { numericValue: 2, enumCode: 2, enumLabel: 'Unknown code 2' });
    expect(decodeModuleTelemetry(state).parameters[0].record!.enumLabel).toBe('Unknown code 2');
  });
  it.each([null, {}, { parameters: [] }, { ...telemetryFixture(), mode: 'LIVE' }, { ...telemetryFixture(), requestedAt: 'now' }])('rejects malformed contract %j', value => {
    expect(() => decodeModuleTelemetry(value)).toThrow();
  });
  it.each([NaN, Infinity, '52', undefined])('rejects unusable value %s without zero defaults', value => {
    const data = telemetryFixture() as unknown as { parameters: { record: { numericValue: unknown } }[] };
    data.parameters[0].record.numericValue = value;
    expect(() => decodeModuleTelemetry(data)).toThrow();
  });
  it('rejects raw physical units, duplicate definitions and future Historical records', () => {
    const raw = telemetryFixture(); raw.parameters[0].rawOnly = true;
    expect(() => decodeModuleTelemetry(raw)).toThrow();
    const duplicate = telemetryFixture(); duplicate.parameters.push(duplicate.parameters[0]);
    expect(() => decodeModuleTelemetry(duplicate)).toThrow();
    expect(() => decodeModuleTelemetry(telemetryFixture('TRANQUILITY', '2026-09-13T00:00:00Z'))).toThrow();
  });
  it('reads only MISSION1 and validates component/time response identity', async () => {
    const at = '2026-09-15T00:00:00Z', fetch = vi.fn().mockResolvedValue(Response.json(telemetryFixture('TRANQUILITY', at)));
    vi.stubGlobal('fetch', fetch); const controller = new AbortController();
    await getModuleTelemetry('TRANQUILITY', at, controller.signal);
    expect(fetch.mock.calls[0][0]).toBe(`/api/iss/components/TRANQUILITY/telemetry?at=${encodeURIComponent(at)}`);
    expect(fetch.mock.calls[0][1].signal).toBe(controller.signal);
    fetch.mockResolvedValue(Response.json(telemetryFixture('DESTINY')));
    await expect(getModuleTelemetry('TRANQUILITY', null, controller.signal)).rejects.toThrow('context mismatch');
  });
});
