// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ModuleInfo } from './ModuleInfo';
import { ISS_MODEL, type SemanticMapping } from '../cesium/modelPresentation';
import { TELEMETRY_REFRESH_MS } from '../telemetry/useModuleTelemetry';
import { telemetryFixture } from '../test/telemetryFixture';

let root: Root, host: HTMLDivElement, fetchMock: ReturnType<typeof vi.fn>;
const close = vi.fn();
const at = '2026-10-22T12:00:00Z';
const modules = ISS_MODEL.semanticMappings.filter(module => module.status === 'VERIFIED');
const tranquility = modules.find(module => module.componentId === 'TRANQUILITY')!;
const dock = () => host.querySelector<HTMLElement>('.module-dock');
const body = () => host.querySelector<HTMLElement>('.context-dock-content')!;
function pending() {
  let resolve!: (response: Response) => void;
  fetchMock.mockImplementationOnce(() => new Promise<Response>(r => { resolve = r; }));
  return (data = telemetryFixture()) => act(async () => resolve(Response.json(data)));
}
async function show(module: SemanticMapping | null = tranquility, acceptedAt: string | null = null) {
  await act(async () => root.render(<ModuleInfo module={module} onClose={close} historical={acceptedAt !== null} acceptedAt={acceptedAt ?? undefined} />));
}
beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  vi.useFakeTimers(); close.mockReset();
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals();
});

it.each(modules.flatMap(module => [null, at].map(acceptedAt => ({ module, acceptedAt }))))(
  'first presents complete $module.componentId content at $acceptedAt', async ({ module, acceptedAt }) => {
    await show(null, acceptedAt);
    const resolve = pending(); await show(module, acceptedAt);
    expect(dock()).toBeNull();
    await act(async () => vi.advanceTimersByTime(1000));
    expect(dock()).toBeNull(); // readiness, not elapsed animation time, controls reveal
    const data = telemetryFixture(module.componentId, acceptedAt);
    await resolve(data);
    expect(dock()?.dataset.state).toBe('open');
    expect(dock()?.dataset.entityId).toBe(module.componentId);
    expect(body().querySelectorAll('.module-telemetry-reading')).toHaveLength(data.parameters.length);
    expect(body().querySelector('time')?.dateTime).toBe(data.parameters[0].record!.recordTime);
    expect(body().querySelector('.module-telemetry-source a')?.getAttribute('href')).toBe('https://demos.lightstreamer.com/ISSLive/');
    expect(dock()?.textContent).not.toContain('Loading telemetry');
    expect(document.activeElement).toBe(dock()?.querySelector('h2'));
  },
);

it.each([null, at])('retains a complete inert close snapshot at %s', async acceptedAt => {
  fetchMock.mockResolvedValueOnce(Response.json(telemetryFixture('TRANQUILITY', acceptedAt)));
  await show(tranquility, acceptedAt); const surface = dock(), scroll = body(), content = surface!.textContent;
  scroll.scrollTop = 80;
  await show(null, acceptedAt);
  expect(dock()).toBe(surface); expect(body()).toBe(scroll); expect(scroll.scrollTop).toBe(80);
  expect(dock()?.hasAttribute('inert')).toBe(true); expect(dock()?.textContent).toBe(content);
  await act(async () => vi.advanceTimersByTime(200)); expect(dock()).toBeNull();
});

it.each([null, at].flatMap(acceptedAt => [50, 250].map(delay => ({ acceptedAt, delay }))))(
  'waits for fresh complete content on reopening after $delay ms at $acceptedAt', async ({ acceptedAt, delay }) => {
    fetchMock.mockResolvedValueOnce(Response.json(telemetryFixture('TRANQUILITY', acceptedAt)));
    await show(tranquility, acceptedAt); const previous = dock();
    await show(null, acceptedAt); await act(async () => vi.advanceTimersByTime(delay));
    const resolve = pending(); await show(tranquility, acceptedAt);
    expect(dock()).toBeNull();
    const changed = telemetryFixture('TRANQUILITY', acceptedAt); changed.parameters = [];
    await resolve(changed);
    expect(dock()).not.toBe(previous); expect(dock()?.dataset.state).toBe('open');
    expect(body().querySelector('.module-telemetry-reading,.module-telemetry-source')).toBeNull();
    expect(dock()?.textContent).not.toContain('Loading telemetry');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  },
);

it('keeps the scroll container, content and focus during Current polling', async () => {
  fetchMock.mockResolvedValueOnce(Response.json(telemetryFixture())); await show();
  const surface = dock(), scroll = body(), content = surface!.textContent; scroll.scrollTop = 120;
  const closeButton = surface!.querySelector('button')!; closeButton.focus();
  const resolve = pending(); await act(async () => vi.advanceTimersByTime(TELEMETRY_REFRESH_MS));
  expect(dock()).toBe(surface); expect(body()).toBe(scroll); expect(dock()?.textContent).toBe(content);
  const changed = telemetryFixture(); changed.parameters[0].record!.numericValue = 53; await resolve(changed);
  expect(dock()).toBe(surface); expect(body()).toBe(scroll); expect(scroll.scrollTop).toBe(120);
  expect(document.activeElement).toBe(closeButton); expect(scroll.textContent).toContain('53 %');
});

it('withholds the previous card while switching module or accepted UTC and rejects late responses', async () => {
  fetchMock.mockResolvedValueOnce(Response.json(telemetryFixture())); await show();
  const obsolete = pending(); const destiny = modules.find(module => module.componentId === 'DESTINY')!;
  await show(destiny); expect(dock()).toBeNull();
  const signal = fetchMock.mock.calls[1][1].signal as AbortSignal;
  const resolve = pending(); await show(destiny, at); expect(dock()).toBeNull(); expect(signal.aborted).toBe(true);
  await obsolete(telemetryFixture('DESTINY')); expect(dock()).toBeNull();
  await resolve(telemetryFixture('DESTINY', at)); expect(dock()?.dataset.entityId).toBe('DESTINY');
  const nextAt = '2026-10-21T12:00:00Z'; const next = pending(); await show(destiny, nextAt);
  expect(dock()).toBeNull(); await next(telemetryFixture('DESTINY', nextAt)); expect(dock()).not.toBeNull();
});

it('cancels a pending selection with Escape and cannot reveal an aborted response', async () => {
  const resolve = pending(); await show(); const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
  const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  await act(async () => document.dispatchEvent(escape)); expect(close).toHaveBeenCalledOnce(); expect(escape.defaultPrevented).toBe(true);
  await show(null); expect(signal.aborted).toBe(true); await resolve(); expect(dock()).toBeNull();
});

it.each(['empty', 'unmapped', 'error'])('reveals a settled %s result without a loading card', async state => {
  if (state === 'error') fetchMock.mockResolvedValueOnce(new Response('', { status: 503 }));
  else {
    const data = telemetryFixture(); data.parameters = [];
    if (state === 'unmapped') data.mappingStatus = 'NO_VERIFIED_MAPPING';
    fetchMock.mockResolvedValueOnce(Response.json(data));
  }
  await show(); expect(dock()).not.toBeNull(); expect(dock()?.textContent).not.toContain('Loading telemetry');
  expect(dock()?.textContent).toContain('Supporting technical detail');
  expect(dock()?.textContent).toContain(state === 'error' ? 'Telemetry could not be loaded.' : state === 'unmapped' ? 'No verified telemetry mapping' : 'Function');
});
