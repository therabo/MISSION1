import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import asset from './marineAsset.json';
const bytes = readFileSync(new URL(`../../public/geo/${asset.file}`, import.meta.url));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.resetModules(); });
it('shares one independently verified local promise across consumers and rerenders', async () => {
  vi.resetModules(); const fetch=vi.fn(async()=>new Response(bytes)); vi.stubGlobal('fetch',fetch);
  const {loadMarineCatalog}=await import('./marineCatalog'); const a=loadMarineCatalog(),b=loadMarineCatalog();
  expect(a).toBe(b); const catalog=await a; expect(catalog.coordinateBufferBytes).toBe(465624);
  expect(await loadMarineCatalog()).toBe(catalog); expect(fetch).toHaveBeenCalledExactlyOnceWith(`/geo/${asset.file}`);
});
it.each(['http','length','digest'])('caches %s failure without retry or external fallback', async failure => {
  vi.resetModules(); vi.spyOn(console,'warn').mockImplementation(()=>{}); const corrupted=new Uint8Array(bytes);corrupted[20]^=1;
  const fetch=vi.fn(async()=>failure==='http'?new Response('',{status:503}):new Response(failure==='length'?bytes.subarray(1):corrupted));
  vi.stubGlobal('fetch',fetch); const{loadMarineCatalog}=await import('./marineCatalog'); const promise=loadMarineCatalog();
  await expect(promise).rejects.toThrow(); expect(loadMarineCatalog()).toBe(promise); await expect(loadMarineCatalog()).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(1);expect(console.warn).toHaveBeenCalledTimes(1);
});
