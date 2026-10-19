import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import descriptor from './countryAsset.json';
import { COUNTRY_POLICY, decodeCountryCatalog, lookupCountry } from './countryLookup';

const raw = readFileSync(new URL(`../../public/geo/${descriptor.file}`, import.meta.url));
const catalog = decodeCountryCatalog(JSON.parse(raw.toString()));
const country = (lon: number, lat: number) => {
  const result = lookupCountry(catalog, lon, lat);
  return result.kind === 'country' ? result.country : result.kind;
};

it('pins inventory/integrity and keeps global typed coordinate storage outside JavaScript source', () => {
  expect(raw.length).toBe(descriptor.bytes);
  expect(createHash('sha256').update(raw).digest('hex')).toBe(descriptor.sha256);
  expect(catalog.identities).toHaveLength(266); expect(catalog.polygons).toHaveLength(4292);
  expect(catalog.coordinateBufferBytes).toBe(4_422_632);
  expect(catalog.polygons.every(p => p.rings.every(r => r instanceof Int32Array))).toBe(true);
  expect(catalog.identities.every(c => c.iso2 !== '-99' && c.iso3 !== '-99')).toBe(true);
});

it.each([
  [12.4964, 41.9028, 'Italy'], [-100, 40, 'United States of America'], [-47.882, -15.794, 'Brazil'],
  [139.692, 35.69, 'Japan'], [28.188, -25.747, 'South Africa'], [149.13, -35.28, 'Australia'],
  [77.209, 28.614, 'India'], [2.35, 48.856, 'France'], [13.405, 52.52, 'Germany'],
  [7.447, 46.948, 'Switzerland'], [85.324, 27.717, 'Nepal'], [-70.669, -33.449, 'Chile'],
  [14.443, 35.89, 'Malta'], [103.8198, 1.3521, 'Singapore'], [7.4246, 43.7384, 'Monaco'],
  [12.4534, 41.9029, 'Vatican City'], [-52.35, 4.85, 'French Guiana'], [-40, 70, 'Greenland'],
  [-66.5, 18.2, 'Puerto Rico'], [144.7937, 13.4443, 'Guam'], [114.1694, 22.3193, 'Hong Kong'],
  [55.5, -21.13, 'Réunion'], [45.16, -12.82, 'Mayotte'], [-57.8517, -51.6977, 'Falkland Islands'],
  [-0.1278, 51.5074, 'United Kingdom'], [-3.188, 55.953, 'United Kingdom'], [4.35, 50.85, 'Belgium'],
  [71.4, 51.16, 'Kazakhstan'], [0, -80, 'Antarctica'],
])('classifies source-pinned geographic TEST anchor (%s,%s) as %s', (lon, lat, name) => {
  expect(country(lon, lat)).toMatchObject({ displayName: name });
});

it('keeps source limitations explicit instead of snapping coast/atoll/gazetteer misses', () => {
  for (const [lon, lat] of [[-140, 0], [-30, 0], [80, -20], [179.194, -8.521], [172.979, 1.451], [-51.7216, 64.1835]])
    expect(lookupCountry(catalog, lon, lat).kind).toBe('no-country');
  expect(country(12.45414, 41.90268)).toMatchObject({ displayName: 'Italy' }); // independent Vatican gazetteer divergence
  expect(country(-5.35257, 36.14474)).toMatchObject({ displayName: 'Spain' }); // independent Gibraltar gazetteer divergence
  expect(country(9.03, 45.825)).toMatchObject({ displayName: 'Italy' });
  expect(country(9.03, 45.845)).toMatchObject({ displayName: 'Switzerland' });
  expect(country(33, -1)).toMatchObject({ displayName: 'Uganda' }); // source polygon includes inland water
  expect(country(0, -80)).toMatchObject({ flagKey: null });
});

it('retains source non-ISO identities and corrected field semantics', () => {
  expect(catalog.identities.find(c => c.key === 'ne:gu:KOS')).toMatchObject({ iso2: null, iso3: null, flagKey: 'xk' });
  expect(catalog.identities.find(c => c.displayName === 'UNDOF')).toMatchObject({ iso2: null, iso3: null, flagKey: null });
  expect(catalog.identities.find(c => c.key === 'ne:gu:PGA')).toMatchObject({ displayName: 'Spratly Islands' });
  expect(catalog.identities.find(c => c.iso2 === 'FR')?.displayName).toBe('France');
});

// Synthetic geometry TEST cases: exact edges/holes/overlaps cannot be proven by city examples.
const ring = (points: number[][]) => {
  let x = 0, y = 0;
  return points.flatMap(([lon, lat]) => { const nx = lon*100000, ny = lat*100000, d = [nx-x, ny-y]; x=nx; y=ny; return d; });
};
const square = (x: number, y: number, size: number) => ring([[x,y],[x+size,y],[x+size,y+size],[x,y+size],[x,y]]);
const synthetic = () => ({ schema: 1, policy: COUNTRY_POLICY, quantization: 100000,
  identities: ['AA','BB'].map(iso => ({ key: `ne:iso2:${iso}`, iso2: iso, iso3: iso+'A', displayName: iso, flagKey: null })),
  polygons: [[0,[0,0,400000,400000],[square(0,0,4),square(1,1,1)]],
    [1,[400000,0,500000,100000],[square(4,0,1)]],
    [0,[1000000,0,1100000,100000],[square(10,0,1)]]],
});

it('handles holes, hole edges, exact shared boundaries/vertices and epsilon neighbors', () => {
  const d = decodeCountryCatalog(synthetic());
  expect(lookupCountry(d, 1.5, 1.5).kind).toBe('no-country');
  expect(lookupCountry(d, 1, 1.5)).toMatchObject({ kind: 'country', boundary: true });
  for (const p of [[4, .5],[4,0]]) expect(lookupCountry(d,...p as [number,number]).kind).toBe('ambiguous-boundary');
  expect(lookupCountry(d, 4-1e-7, .5)).toMatchObject({ kind: 'country', country: { displayName: 'AA' } });
  expect(lookupCountry(d, 4+1e-7, .5)).toMatchObject({ kind: 'country', country: { displayName: 'BB' } });
  expect(lookupCountry(d, 10.5, .5)).toMatchObject({ kind: 'country', country: { displayName: 'AA' } });
});
it('collects all distinct identities independent of array order but collapses same-identity overlaps', () => {
  const raw = synthetic(); raw.polygons.push([0,[0,0,400000,400000],[square(0,0,4)]]);
  expect(lookupCountry(decodeCountryCatalog(raw), .5, .5).kind).toBe('country');
  raw.polygons.push([1,[0,0,400000,400000],[square(0,0,4)]]);
  const a = lookupCountry(decodeCountryCatalog(raw), .5, .5);
  raw.polygons.reverse(); expect(lookupCountry(decodeCountryCatalog(raw), .5, .5)).toEqual(a);
  expect(a.kind).toBe('ambiguous-boundary');
});
it('treats ±180 as the same meridian across split parts and rejects invalid coordinates', () => {
  const raw = synthetic(); raw.polygons = [[0,[17900000,0,18000000,100000],[square(179,0,1)]]];
  const d = decodeCountryCatalog(raw);
  expect(lookupCountry(d, 180, .5)).toEqual(lookupCountry(d, -180, .5));
  for (const p of [[181,0],[0,91],[NaN,0],[0,Infinity]]) expect(lookupCountry(d,...p as [number,number]).kind).toBe('invalid-position');
});
it('rejects corrupt schema, open rings, wrong boxes, overflow and unsafe identity/flag paths', () => {
  for (const mutate of [
    (d: any) => d.schema = 2, (d: any) => d.policy = 'latest', (d: any) => d.identities[0].flagKey = '../it',
    (d: any) => d.polygons[0][0] = 99, (d: any) => d.polygons[0][2][0][9] = 1,
    (d: any) => d.polygons[0][2][0][0] = 2**32, (d: any) => d.polygons[0][1][2] = 400001,
  ]) { const d = synthetic(); mutate(d); expect(() => decodeCountryCatalog(d)).toThrow('Invalid country catalog'); }
});
