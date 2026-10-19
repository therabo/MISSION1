import asset from './countryAsset.json';
import { decodeCountryCatalog, type CountryCatalog } from './countryLookup';

let catalogPromise: Promise<CountryCatalog> | undefined;

/** A single immutable local asset per app lifecycle, including a cached failure. No timers/retries. */
export function loadCountryCatalog(): Promise<CountryCatalog> {
  catalogPromise ??= (async () => {
    const response = await fetch(`${import.meta.env.BASE_URL}geo/${asset.file}`);
    if (!response.ok) throw new Error('Country catalog unavailable');
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength !== asset.bytes) throw new Error('Country catalog size mismatch');
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
      .map(b => b.toString(16).padStart(2, '0')).join('');
    if (hash !== asset.sha256) throw new Error('Country catalog integrity mismatch');
    const catalog = decodeCountryCatalog(JSON.parse(new TextDecoder().decode(bytes)));
    if (catalog.identities.length !== asset.identityCount || catalog.polygons.length !== asset.polygonCount ||
        catalog.coordinateBufferBytes !== asset.coordinateBufferBytes) throw new Error('Country catalog inventory mismatch');
    return catalog;
  })().catch(error => {
    console.warn('[over-country] Local catalog unavailable', error instanceof Error ? error.message : 'Invalid asset');
    throw error;
  });
  return catalogPromise;
}
