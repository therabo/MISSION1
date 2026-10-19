import approvedRegions from './marineRegions.json';

/** Pinned local macro geography. Country math and identity remain unchanged. See ADR-0027. */
export const MARINE_POLICY = 'ne10m-5.1.0-macro-v1';
export const MARINE_QUANTIZATION = 100_000;
export type MarineRegionId = keyof typeof approvedRegions;
export interface MarineRegionIdentity {
  readonly id: MarineRegionId;
  readonly displayName: string;
  readonly priority: 100 | 200;
}
interface MarinePolygonPart {
  readonly identity: number;
  readonly bbox: readonly number[];
  readonly rings: readonly Int32Array[];
}
export interface MarineCatalog {
  readonly policy: typeof MARINE_POLICY;
  readonly identities: readonly MarineRegionIdentity[];
  readonly polygons: readonly MarinePolygonPart[];
  readonly coordinateBufferBytes: number;
}
export type MarineLookupResult =
  | { kind: 'marine-region'; region: MarineRegionIdentity; policy: typeof MARINE_POLICY; boundary: boolean }
  | { kind: 'ambiguous-marine'; candidates: readonly MarineRegionIdentity[]; policy: typeof MARINE_POLICY }
  | { kind: 'no-region' }
  | { kind: 'invalid-position' };

function requireData(condition: unknown): asserts condition {
  if (!condition) throw new Error('Invalid marine catalog');
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Validate the approved identities and every ring before typed decode. Source names never enter lookup. */
export function decodeMarineCatalog(value: unknown): MarineCatalog {
  requireData(record(value) && value.schema === 1 && value.policy === MARINE_POLICY && value.quantization === MARINE_QUANTIZATION);
  requireData(Array.isArray(value.identities) && value.identities.length === Object.keys(approvedRegions).length);
  const ids = new Set<string>();
  const identities = value.identities.map((r: unknown): MarineRegionIdentity => {
    requireData(record(r) && typeof r.id === 'string' && Object.hasOwn(approvedRegions, r.id) && !ids.has(r.id));
    const id = r.id as MarineRegionId, approved = approvedRegions[id];
    requireData(r.displayName === approved.displayName && r.priority === approved.priority);
    ids.add(id);
    return Object.freeze({ id, displayName: approved.displayName, priority: approved.priority as 100 | 200 });
  });
  requireData(Array.isArray(value.polygons) && value.polygons.length > 0 && value.polygons.length < 2_000);
  let coordinateBufferBytes = 0;
  const polygons = value.polygons.map((p: unknown): MarinePolygonPart => {
    requireData(Array.isArray(p) && p.length === 3);
    const [identity, bbox, encodedRings] = p;
    requireData(Number.isInteger(identity) && identity >= 0 && identity < identities.length);
    requireData(Array.isArray(bbox) && bbox.length === 4 && bbox.every(Number.isSafeInteger));
    requireData(bbox[0] >= -180*MARINE_QUANTIZATION && bbox[2] <= 180*MARINE_QUANTIZATION && bbox[0] < bbox[2] &&
      bbox[1] >= -90*MARINE_QUANTIZATION && bbox[3] <= 90*MARINE_QUANTIZATION && bbox[1] < bbox[3]);
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
  return { policy: MARINE_POLICY, identities, polygons, coordinateBufferBytes };
}

/** Same numerical bbox/PIP contract as country lookup, without modifying the accepted country implementation. */
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

/** All matches, then explicit product priority. No first-match, nearest-region or sticky result. */
export function lookupMarineRegion(catalog: MarineCatalog, longitude: number, latitude: number): MarineLookupResult {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(longitude) > 180 || Math.abs(latitude) > 90)
    return { kind: 'invalid-position' };
  const xs = Math.abs(longitude) === 180 ? [-180*MARINE_QUANTIZATION, 180*MARINE_QUANTIZATION] : [longitude*MARINE_QUANTIZATION];
  const y = latitude*MARINE_QUANTIZATION, matches = new Set<number>();
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
  if (matches.size === 0) return { kind: 'no-region' };
  const candidates = [...matches].map(id => catalog.identities[id]);
  const priority = Math.max(...candidates.map(r => r.priority));
  const winners = candidates.filter(r => r.priority === priority).sort((a, b) => a.id.localeCompare(b.id));
  if (winners.length > 1) return { kind: 'ambiguous-marine', candidates: winners, policy: catalog.policy };
  return { kind: 'marine-region', region: winners[0], policy: catalog.policy, boundary };
}
