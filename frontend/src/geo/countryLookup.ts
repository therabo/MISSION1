/** Computed geographic classification, independent of orbital/camera/source selection. See ADR-0027. */
export const COUNTRY_POLICY = 'ne10m-5.1.1-iso-rollup-v1';
export const COUNTRY_QUANTIZATION = 100_000;
export interface CountryIdentity {
  readonly key: string;
  readonly iso2: string | null;
  readonly iso3: string | null;
  readonly displayName: string;
  readonly flagKey: string | null;
}
interface PolygonPart {
  readonly identity: number;
  readonly bbox: readonly number[];
  readonly rings: readonly Int32Array[];
}
export interface CountryCatalog {
  readonly policy: typeof COUNTRY_POLICY;
  readonly identities: readonly CountryIdentity[];
  readonly polygons: readonly PolygonPart[];
  readonly coordinateBufferBytes: number;
}
export type CountryLookupResult =
  | { kind: 'country'; country: CountryIdentity; policy: typeof COUNTRY_POLICY; boundary: boolean }
  | { kind: 'ambiguous-boundary'; candidates: readonly CountryIdentity[]; policy: typeof COUNTRY_POLICY }
  | { kind: 'no-country' }
  | { kind: 'invalid-position' }
  | { kind: 'dataset-loading' }
  | { kind: 'dataset-unavailable' };

function requireData(condition: unknown): asserts condition {
  if (!condition) throw new Error('Invalid country catalog');
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Validate before typed decode. All coordinates/rings are retained; no generic GIS object graph. */
export function decodeCountryCatalog(value: unknown): CountryCatalog {
  requireData(record(value) && value.schema === 1 && value.policy === COUNTRY_POLICY && value.quantization === COUNTRY_QUANTIZATION);
  requireData(Array.isArray(value.identities) && value.identities.length > 0 && value.identities.length < 1000);
  const keys = new Set<string>();
  const identities = value.identities.map((c: unknown): CountryIdentity => {
    requireData(record(c) && typeof c.key === 'string' && /^ne:(iso2:[A-Z]{2}|gu:[A-Z0-9]{3})$/.test(c.key) && !keys.has(c.key));
    requireData(typeof c.displayName === 'string' && c.displayName.trim().length > 0 && c.displayName.length < 200);
    requireData((c.iso2 === null && c.iso3 === null) ||
      (typeof c.iso2 === 'string' && /^[A-Z]{2}$/.test(c.iso2) && typeof c.iso3 === 'string' && /^[A-Z]{3}$/.test(c.iso3) && c.key === `ne:iso2:${c.iso2}`));
    requireData(c.flagKey === null || (typeof c.flagKey === 'string' && /^[a-z]{2}$/.test(c.flagKey)));
    keys.add(c.key);
    return Object.freeze({ key: c.key, iso2: c.iso2, iso3: c.iso3, displayName: c.displayName, flagKey: c.flagKey }) as CountryIdentity;
  });
  requireData(Array.isArray(value.polygons) && value.polygons.length > 0 && value.polygons.length < 20_000);
  let coordinateBufferBytes = 0;
  const polygons = value.polygons.map((p: unknown): PolygonPart => {
    requireData(Array.isArray(p) && p.length === 3);
    const [identity, bbox, encodedRings] = p;
    requireData(Number.isInteger(identity) && identity >= 0 && identity < identities.length);
    requireData(Array.isArray(bbox) && bbox.length === 4 && bbox.every(Number.isSafeInteger));
    requireData(bbox[0] >= -180*COUNTRY_QUANTIZATION && bbox[2] <= 180*COUNTRY_QUANTIZATION && bbox[0] < bbox[2] &&
      bbox[1] >= -90*COUNTRY_QUANTIZATION && bbox[3] <= 90*COUNTRY_QUANTIZATION && bbox[1] < bbox[3]);
    requireData(Array.isArray(encodedRings) && encodedRings.length > 0);
    const rings = encodedRings.map((encoded: unknown, index: number): Int32Array => {
      requireData(Array.isArray(encoded) && encoded.length >= 8 && encoded.length % 2 === 0 && encoded.length <= 2_000_000);
      const ring = new Int32Array(encoded.length);
      let x = 0, y = 0, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < encoded.length; i += 2) {
        requireData(Number.isSafeInteger(encoded[i]) && Number.isSafeInteger(encoded[i+1]));
        x += encoded[i]; y += encoded[i+1];
        requireData(Number.isSafeInteger(x) && Number.isSafeInteger(y) && x >= bbox[0] && x <= bbox[2] && y >= bbox[1] && y <= bbox[3]);
        ring[i] = x; ring[i+1] = y;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
      requireData(ring[0] === x && ring[1] === y && minX < maxX && minY < maxY);
      if (index === 0) requireData(minX === bbox[0] && minY === bbox[1] && maxX === bbox[2] && maxY === bbox[3]);
      coordinateBufferBytes += ring.byteLength;
      return ring;
    });
    return { identity, bbox, rings };
  });
  return { policy: COUNTRY_POLICY, identities, polygons, coordinateBufferBytes };
}

/** -1 outside, 0 on a segment, 1 inside. Epsilon is numerical only (~0.1 mm), never geometric hysteresis. */
function ringRelation(x: number, y: number, ring: Int32Array): -1 | 0 | 1 {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const ax = ring[j], ay = ring[j+1], bx = ring[i], by = ring[i+1];
    const dx = bx - ax, dy = by - ay;
    if (dx || dy) {
      const cross = (x - ax)*dy - (y - ay)*dx;
      if (Math.abs(cross) <= 1e-4*Math.hypot(dx, dy) && x >= Math.min(ax, bx)-1e-4 && x <= Math.max(ax, bx)+1e-4 &&
          y >= Math.min(ay, by)-1e-4 && y <= Math.max(ay, by)+1e-4) return 0;
    }
    if ((ay > y) !== (by > y) && x < dx*(y-ay)/dy + ax) inside = !inside;
  }
  return inside ? 1 : -1;
}

/** Full-precision WGS84 degrees. Dateline endpoints inspect both equivalent split-geometry meridians. */
export function lookupCountry(catalog: CountryCatalog, longitude: number, latitude: number): CountryLookupResult {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(longitude) > 180 || Math.abs(latitude) > 90)
    return { kind: 'invalid-position' };
  const xs = Math.abs(longitude) === 180 ? [-180*COUNTRY_QUANTIZATION, 180*COUNTRY_QUANTIZATION] : [longitude*COUNTRY_QUANTIZATION];
  const y = latitude*COUNTRY_QUANTIZATION, matches = new Set<number>();
  let boundary = false;
  for (const x of xs) for (const { identity, bbox: b, rings } of catalog.polygons) {
    if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
    let relation = ringRelation(x, y, rings[0]);
    if (relation < 0) continue;
    for (let i = 1; i < rings.length && relation >= 0; i++) {
      const hole = ringRelation(x, y, rings[i]);
      if (hole > 0) relation = -1;
      else if (hole === 0) relation = 0;
    }
    if (relation >= 0) { matches.add(identity); boundary ||= relation === 0; }
  }
  if (matches.size === 0) return { kind: 'no-country' };
  if (matches.size > 1) return { kind: 'ambiguous-boundary', policy: catalog.policy,
    candidates: [...matches].map(id => catalog.identities[id]).sort((a, b) => a.key.localeCompare(b.key)) };
  return { kind: 'country', country: catalog.identities[[...matches][0]], policy: catalog.policy, boundary };
}
