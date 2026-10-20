// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useModuleTelemetry, TELEMETRY_REFRESH_MS } from './useModuleTelemetry';
import { telemetryFixture } from '../test/telemetryFixture';
import { ModuleInfo } from '../components/ModuleInfo';
import { ISS_MODEL } from '../cesium/modelPresentation';

let root: Root, host: HTMLDivElement, fetchMock: ReturnType<typeof vi.fn>, visibility = 'visible';
beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  vi.useFakeTimers(); visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
function Harness({ component = 'TRANQUILITY', at = null, active = true }: { component?: string; at?: string | null; active?: boolean }) {
  const result = useModuleTelemetry(component, at, active);
  return <div>{result.data?.componentId}|{result.data?.mode}|{result.data?.parameters[0]?.record?.numericValue}|{result.loading ? 'loading' : ''}|{result.error ? 'error' : ''}</div>;
}
async function render(component = 'TRANQUILITY', at: string | null = null, active = true) { await act(async () => root.render(<Harness component={component} at={at} active={active} />)); }
it('loads only selected module and aborts old module on switching', async () => {
  let old: (value: Response) => void = () => {};
  fetchMock.mockImplementationOnce(() => new Promise(resolve => { old = resolve; })).mockResolvedValueOnce(Response.json(telemetryFixture('DESTINY')));
  await render(); const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
  await render('DESTINY'); expect(signal.aborted).toBe(true);
  await act(async () => old(Response.json(telemetryFixture())));
  expect(host.textContent).toContain('DESTINY'); expect(host.textContent).not.toContain('TRANQUILITY');
});
it('rejects late Current response after accepting Historical UTC', async () => {
  let old: (value: Response) => void = () => {}; const at = '2026-09-15T00:00:00Z';
  fetchMock.mockImplementationOnce(() => new Promise(resolve => { old = resolve; })).mockResolvedValueOnce(Response.json(telemetryFixture('TRANQUILITY', at)));
  await render(); await render('TRANQUILITY', at);
  await act(async () => old(Response.json(telemetryFixture())));
  expect(host.textContent).toContain('HISTORICAL'); expect(host.textContent).not.toContain('CURRENT');
  await act(async () => vi.advanceTimersByTime(TELEMETRY_REFRESH_MS * 3)); expect(fetchMock).toHaveBeenCalledTimes(2);
});
it('polls visible Current serially and stops while closed or hidden', async () => {
  fetchMock.mockImplementation(() => Promise.resolve(Response.json(telemetryFixture())));
  await render(); await act(async () => vi.advanceTimersByTime(TELEMETRY_REFRESH_MS)); expect(fetchMock).toHaveBeenCalledTimes(2);
  visibility = 'hidden'; await act(async () => document.dispatchEvent(new Event('visibilitychange')));
  await act(async () => vi.advanceTimersByTime(TELEMETRY_REFRESH_MS * 3)); expect(fetchMock).toHaveBeenCalledTimes(2);
  visibility = 'visible'; await act(async () => document.dispatchEvent(new Event('visibilitychange'))); expect(fetchMock).toHaveBeenCalledTimes(3);
  await render('TRANQUILITY', null, false); await act(async () => vi.advanceTimersByTime(TELEMETRY_REFRESH_MS * 3)); expect(fetchMock).toHaveBeenCalledTimes(3);
});
it('loads initially hidden Historical when visible without continuous polling', async () => {
  visibility = 'hidden'; const at = '2026-09-15T00:00:00Z';
  fetchMock.mockResolvedValue(Response.json(telemetryFixture('TRANQUILITY', at)));
  await render('TRANQUILITY', at); expect(fetchMock).not.toHaveBeenCalled();
  visibility = 'visible'; await act(async () => document.dispatchEvent(new Event('visibilitychange'))); expect(host.textContent).toContain('HISTORICAL');
  await act(async () => document.dispatchEvent(new Event('visibilitychange'))); expect(fetchMock).toHaveBeenCalledTimes(1);
});
it('clears obsolete context and keeps failures local to module telemetry', async () => {
  fetchMock.mockResolvedValue(new Response('', { status: 503 }));
  const module = ISS_MODEL.semanticMappings.find(entry => entry.componentId === 'TRANQUILITY')!;
  await act(async () => root.render(<ModuleInfo module={module} onClose={() => {}} />));
  expect(host.textContent).toContain('Telemetry could not be loaded'); expect(host.querySelector('h3')?.textContent).toBe('Function');
  expect(host.textContent).toContain('Supporting technical detail'); expect(host.querySelector('aside')?.dataset.entityId).toBe('TRANQUILITY');
});

it.each([null, '2026-09-15T00:00:00Z'])('renders recorded module telemetry and no administrative controls at %s', async at => {
  const data = telemetryFixture('TRANQUILITY', at);
  data.parameters.push({ ...data.parameters[0], parameterId: 'test.missing', label: 'Missing definition', category: 'empty_category', record: null });
  fetchMock.mockImplementation(() => Promise.resolve(Response.json(data)));
  const module = ISS_MODEL.semanticMappings.find(entry => entry.componentId === 'TRANQUILITY')!;
  await act(async () => root.render(<ModuleInfo module={module} historical={!!at} acceptedAt={at ?? undefined} onClose={() => {}} />));
  expect(host.querySelector('h3')?.textContent).toBe('Function');
  expect(host.textContent).toContain(module.role);
  expect(host.querySelector('.module-telemetry-value')?.textContent).toBe('52 %');
  expect(host.querySelector('time')?.dateTime).toBe(data.parameters[0].record!.recordTime);
  const reading = host.querySelector('.module-telemetry-reading')!;
  expect(reading.textContent).toContain('Last telemetry record');
  expect(reading.textContent).not.toContain('Public ISS telemetry'); expect(reading.textContent).not.toContain('Retained by');
  const technical = [...host.querySelectorAll('section')].find(section => section.querySelector('h3')?.textContent === 'Supporting technical detail')!;
  expect(technical.textContent).toContain('Module ID'); expect(technical.textContent).toContain('Asset node');
  expect(technical.textContent).not.toContain('Identity mapping');
  const source = technical.querySelector('.module-telemetry-source')!;
  expect(source.querySelector('h4')?.textContent).toBe('Telemetry source');
  expect(source.textContent).toContain('ISS Live · Lightstreamer');
  expect(host.querySelectorAll('a')).toHaveLength(1);
  const link = source.querySelector('a')!;
  expect(link.href).toBe('https://demos.lightstreamer.com/ISSLive/');
  expect(link.textContent).toBe('Source ↗'); expect(link.target).toBe('_blank'); expect(link.rel).toBe('noreferrer');
  expect(host.querySelector('details, summary, [aria-expanded], [aria-controls]')).toBeNull();
  expect(source.querySelectorAll('button, [tabindex]')).toHaveLength(0);
  expect(source.textContent).not.toContain('Retained by'); expect(source.textContent).not.toContain('Received by MISSION1');
  expect(data.parameters[0].record!.source.retainingProvider).toBe('SenseData');
  for (const removed of ['Evidence and provenance', 'Evidence & provenance', 'Function / role', 'Configuration context', 'Component reference', 'Configuration evidence', 'Raw telemetry channels', 'No recorded value', 'Missing definition', 'Empty category', 'Limitations / availability', 'Identity verified:', 'Earth View display:', 'NOT TO SCALE', module.nodeName]) {
    expect(host.textContent).not.toContain(removed);
  }
  expect(host.querySelector('footer')).toBeNull();
  expect(fetchMock.mock.calls[0][0]).toBe('/api/iss/components/TRANQUILITY/telemetry' + (at ? `?at=${encodeURIComponent(at)}` : ''));
  await act(async () => vi.advanceTimersByTime(TELEMETRY_REFRESH_MS));
  expect(fetchMock).toHaveBeenCalledTimes(at ? 1 : 2);
});

it.each([null, '2026-09-15T00:00:00Z'])('preserves the deliberate no-mapping message at %s', async at => {
  const data = telemetryFixture('CUPOLA', at); data.mappingStatus = 'NO_VERIFIED_MAPPING'; data.parameters = [];
  fetchMock.mockResolvedValue(Response.json(data));
  const module = ISS_MODEL.semanticMappings.find(entry => entry.componentId === 'CUPOLA')!;
  await act(async () => root.render(<ModuleInfo module={module} historical={!!at} acceptedAt={at ?? undefined} onClose={() => {}} />));
  expect(host.textContent).toContain('No verified telemetry mapping');
  expect(host.textContent).not.toContain('No recorded value'); expect(host.querySelector('.module-telemetry-reading')).toBeNull();
  expect(host.querySelector('h2')?.textContent).toBe('Cupola'); expect(host.textContent).toContain(module.role);
  expect(host.textContent).toContain('Supporting technical detail');
  for (const removed of ['Limitations / availability', 'Identity verified:', 'NOT TO SCALE', module.nodeName]) expect(host.textContent).not.toContain(removed);
});
