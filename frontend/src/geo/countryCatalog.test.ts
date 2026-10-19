import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import asset from './countryAsset.json';
const bytes = readFileSync(new URL(`../../public/geo/${asset.file}`, import.meta.url));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.resetModules(); });
it('shares one verified fetch/decode promise, including concurrent consumers', async () => {
  vi.resetModules(); const fetch = vi.fn(async () => new Response(bytes)); vi.stubGlobal('fetch', fetch);
  const { loadCountryCatalog } = await import('./countryCatalog');
  const a = loadCountryCatalog(), b = loadCountryCatalog();
  expect(a).toBe(b); const catalog = await a; expect(catalog.coordinateBufferBytes).toBe(asset.coordinateBufferBytes);
  expect(await loadCountryCatalog()).toBe(catalog); expect(fetch).toHaveBeenCalledExactlyOnceWith(`/geo/${asset.file}`);
});
it.each(['http', 'length', 'digest'])('isolates %s failure, caches rejection, and never falls back to a network provider', async failure => {
  vi.resetModules(); vi.spyOn(console, 'warn').mockImplementation(() => {});
  const corrupted = new Uint8Array(bytes); corrupted[20] ^= 1;
  const fetch = vi.fn(async () => failure === 'http' ? new Response('', { status: 503 }) :
    new Response(failure === 'length' ? bytes.subarray(1) : corrupted));
  vi.stubGlobal('fetch', fetch); const { loadCountryCatalog } = await import('./countryCatalog');
  const promise = loadCountryCatalog(); await expect(promise).rejects.toThrow();
  expect(loadCountryCatalog()).toBe(promise); await expect(loadCountryCatalog()).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(1); expect(console.warn).toHaveBeenCalledTimes(1);
});
