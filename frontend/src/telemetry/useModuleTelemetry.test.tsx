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
  expect(host.textContent).toContain('Telemetry could not be loaded'); expect(host.textContent).toContain('Function / role');
  expect(host.textContent).toContain('Configuration context'); expect(host.querySelector('aside')?.dataset.entityId).toBe('TRANQUILITY');
});
