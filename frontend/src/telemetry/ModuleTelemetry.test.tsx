import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { telemetryFixture } from '../test/telemetryFixture';
import { ModuleTelemetryReadings, ModuleTelemetrySource, recordDate, engineeringValue } from './ModuleTelemetry';

it.each(['ISS.live', 'SenseData', null])('shows one source and link while preserving internal %s provenance and readings', provider => {
  const data = telemetryFixture(); data.parameters[0].record!.source.retainingProvider = provider;
  const original = structuredClone(data);
  const html = renderToStaticMarkup(<ModuleTelemetryReadings data={data} loading={false} error={false} />);
  const source = renderToStaticMarkup(<ModuleTelemetrySource data={data} />);
  expect(html).toContain('52'); expect(html).toContain('%'); expect(html).toContain('Last telemetry record');
  expect(html).toContain('Urine tank'); expect(html).toContain('14 Sep 2026'); expect(html).toContain('14:10:29 UTC');
  expect(html).not.toContain('Public ISS telemetry'); expect(html).not.toContain('Retained by');
  expect(source).toContain('<h4>Telemetry source</h4>');
  expect(source).toContain('ISS Live · Lightstreamer');
  expect(source.match(/<a /g)).toHaveLength(1);
  expect(source).toContain('href="https://demos.lightstreamer.com/ISSLive/" target="_blank" rel="noreferrer"');
  for (const removed of ['<details', '<summary', 'aria-expanded', 'aria-controls', 'tabindex', 'Retained by', 'Received by MISSION1', 'Definition evidence', data.parameters[0].record!.source.catalogVersion]) expect(source).not.toContain(removed);
  expect(data).toEqual(original);
  for (const forbidden of ['STALE', 'FRESH', 'LAST KNOWN', 'days old', 'NASA sample time']) expect(html).not.toContain(forbidden);
  expect(recordDate('2026-09-14T14:10:29Z')).toContain('14:10:29 UTC');
});
it('collapses mixed native and retained provenance into one source entry without changing the input', () => {
  const data = telemetryFixture();
  data.parameters.push({ ...data.parameters[0], parameterId: 'test.native', record: {
    ...data.parameters[0].record!, source: { ...data.parameters[0].record!.source,
      retainingProvider: null, acquisitionMethod: 'NATIVE_CALLBACK', timeRole: 'MISSION1_RECONSTRUCTED_ISSLIVE_RECORD_TIME' },
  } });
  const original = structuredClone(data);
  const html = renderToStaticMarkup(<ModuleTelemetrySource data={data} />);
  expect(html.match(/<h4>Telemetry source<\/h4>/g)).toHaveLength(1);
  expect(html.match(/<a /g)).toHaveLength(1);
  expect(html).not.toContain('<details');
  expect(data).toEqual(original);
});
it('preserves unknown state labels and never creates a missing-value state', () => {
  const data = telemetryFixture(); data.parameters[0].unit = null; data.parameters[0].valueType = 'ENUM_CODE';
  Object.assign(data.parameters[0].record!, { numericValue: 2, enumCode: 2, enumLabel: 'Unknown code 2' });
  expect(renderToStaticMarkup(<ModuleTelemetryReadings data={data} loading={false} error={false} />)).toContain('Unknown code 2');
  data.parameters[0].record = null;
  const html = renderToStaticMarkup(<ModuleTelemetryReadings data={data} loading={false} error={false} />);
  expect(html).toBe('');
  expect(renderToStaticMarkup(<ModuleTelemetrySource data={data} />)).toBe('');
});
it('omits raw channels from readings and source display without changing the response', () => {
  const data = telemetryFixture(); data.parameters[0].rawOnly = true; data.parameters[0].unit = null;
  const normal = renderToStaticMarkup(<ModuleTelemetryReadings data={data} loading={false} error={false} />);
  const detail = renderToStaticMarkup(<ModuleTelemetrySource data={data} />);
  expect(normal).toBe(''); expect(detail).toBe('');
  expect(data.parameters[0].record!.numericValue).toBe(52);
});
it('omits missing definitions and empty categories while preserving recorded values and their evidence', () => {
  const data = telemetryFixture();
  data.parameters.push(
    { ...data.parameters[0], parameterId: 'test.missing.same', label: 'Missing same category', record: null },
    { ...data.parameters[0], parameterId: 'test.missing.other', label: 'Missing other category', category: 'empty_category', record: null },
    { ...data.parameters[0], parameterId: 'test.raw', label: 'Raw-only value', category: 'raw_category', rawOnly: true, unit: null },
  );
  const html = renderToStaticMarkup(<ModuleTelemetryReadings data={data} loading={false} error={false} />);
  const detail = renderToStaticMarkup(<ModuleTelemetrySource data={data} />);
  for (const removed of ['Missing same category', 'Missing other category', 'Empty category', 'Raw-only value', 'Raw category', 'Raw telemetry channels', 'No recorded value', 'parameters without recorded values']) {
    expect(html + detail).not.toContain(removed);
  }
  expect(html).not.toContain('<details');
  expect(html).toContain('Urine tank'); expect(html).toContain('52');
  expect(html).toContain('Last telemetry record'); expect(html).not.toContain('Retained by');
  expect(detail).toContain('ISS Live · Lightstreamer');
  expect(detail).not.toContain('Retained by');
  expect(data.parameters[0].evidence).not.toHaveLength(0);
  expect(data.parameters[0].record!.source.retainingProvider).toBe('SenseData');
  expect(data.parameters).toHaveLength(4);
});
it('distinguishes no mapping, loading and isolated API failure', () => {
  const data = telemetryFixture('CUPOLA'); data.parameters = []; data.mappingStatus = 'NO_VERIFIED_MAPPING';
  expect(renderToStaticMarkup(<ModuleTelemetryReadings data={data} loading={false} error={false} />)).toContain('No verified telemetry mapping');
  expect(renderToStaticMarkup(<ModuleTelemetrySource data={data} />)).toBe('');
  expect(renderToStaticMarkup(<ModuleTelemetrySource data={null} />)).toBe('');
  expect(renderToStaticMarkup(<ModuleTelemetryReadings data={null} loading error={false} />)).toContain('Loading telemetry');
  expect(renderToStaticMarkup(<ModuleTelemetryReadings data={null} loading={false} error />)).toContain('Telemetry could not be loaded');
});
it('formats engineering readings without turning small real values into zero and preserves full input precision', () => {
  expect(engineeringValue(39.619998931884766)).toBe('39.62');
  expect(engineeringValue(1e-10)).not.toBe('0');
  const data = telemetryFixture(); data.parameters[0].record!.numericValue = 39.619998931884766;
  expect(renderToStaticMarkup(<ModuleTelemetryReadings data={data} loading={false} error={false} />)).toContain('39.62');
  renderToStaticMarkup(<ModuleTelemetrySource data={data} />);
  expect(data.parameters[0].record!.numericValue).toBe(39.619998931884766);
});
