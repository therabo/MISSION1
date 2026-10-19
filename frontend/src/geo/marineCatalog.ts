import asset from './marineAsset.json';
import { decodeMarineCatalog, type MarineCatalog } from './marineLookup';

let catalogPromise: Promise<MarineCatalog> | undefined;

/** Independent companion asset, one verified load/decode per app lifecycle, including cached rejection. */
export function loadMarineCatalog(): Promise<MarineCatalog> {
  catalogPromise ??= (async () => {
    const response = await fetch(`${import.meta.env.BASE_URL}geo/${asset.file}`);
    if (!response.ok) throw new Error('Marine catalog unavailable');
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength !== asset.bytes) throw new Error('Marine catalog size mismatch');
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
      .map(b => b.toString(16).padStart(2, '0')).join('');
    if (hash !== asset.sha256) throw new Error('Marine catalog integrity mismatch');
    const catalog = decodeMarineCatalog(JSON.parse(new TextDecoder().decode(bytes)));
    if (catalog.identities.length !== asset.identityCount || catalog.polygons.length !== asset.polygonCount ||
        catalog.coordinateBufferBytes !== asset.coordinateBufferBytes) throw new Error('Marine catalog inventory mismatch');
    return catalog;
  })().catch(error => {
    console.warn('[over-marine] Local catalog unavailable', error instanceof Error ? error.message : 'Invalid asset');
    throw error;
  });
  return catalogPromise;
}
