import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import asset from './marineAsset.json';
import approved from './marineRegions.json';
import { decodeMarineCatalog, lookupMarineRegion, MARINE_POLICY, type MarineCatalog, type MarineRegionId } from './marineLookup';

const raw = JSON.parse(readFileSync(new URL(`../../public/geo/${asset.file}`, import.meta.url), 'utf8'));
const catalog = decodeMarineCatalog(raw);
// Synthetic geographic TEST points, never recorded or live ISS observations.
const interiors: [MarineRegionId, number, number][] = [
  ['arctic',0,85],['southern',0,-65],['atlantic',-40,30],['pacific',-140,-20],['indian',80,-20],
  ['mediterranean',18,34],['caribbean',-75,15],['gulf-of-mexico',-90,25],['arabian',64,15],
  ['red-sea',38,20],['black-sea',35,43],['bay-of-bengal',88,15],['south-china-sea',115,15],
  ['sea-of-japan',135,40],['persian-gulf',52,26],['caspian-sea',50,42],
];
it.each(interiors)('classifies the approved %s interior', (id, lon, lat) => {
  expect(lookupMarineRegion(catalog,lon,lat)).toMatchObject({kind:'marine-region',region:approved[id],policy:MARINE_POLICY});
});
it.each<[MarineRegionId,number,number]>([
  ['mediterranean',4,42.4],['mediterranean',12,40],['mediterranean',16,43],['atlantic',-52,51],
  ['pacific',155,-20],['pacific',160,-40],['atlantic',2.5,51.5],['pacific',125,29],['indian',94,12],['indian',122,-9],
])('uses the reviewed source-ID rollup to %s', (id,lon,lat) => {
  expect(lookupMarineRegion(catalog,lon,lat)).toMatchObject({kind:'marine-region',region:{id}});
});
it('keeps Atlantic and Pacific stable across source hemispheres and equivalent dateline endpoints', () => {
  for (const [lon,id] of [[-30,'atlantic'],[-140,'pacific']] as const)
    for (const lat of [-.1,.1]) expect(lookupMarineRegion(catalog,lon,lat)).toMatchObject({kind:'marine-region',region:{id}});
  expect(lookupMarineRegion(catalog,180,0)).toEqual(lookupMarineRegion(catalog,-180,0));
  expect(catalog.coordinateBufferBytes).toBe(465624);
});
it.each([
  [-69.90364656959812,47.68167643898889],[-71.59955863767937,9.923774420608673],[-90.05871415970402,30.188480638137733],
  [-51.21955214273694,-31.0670697974915],[-50.74705521694112,-1.122050062671164],[-60.79554960084633,45.962685757015876],
  [145.23778568400564,72.28607900663289],[121.4843331738538,31.50927857108566],[-123.74177591766713,46.22197225604039],
])('does not invent a label inside an excluded river/lake/lagoon at %s,%s', (lon,lat) => {
  expect(lookupMarineRegion(catalog,lon,lat)).toEqual({kind:'no-region'});
});
it('preserves the approved recorded coastal gaps instead of snapping or retaining a prior region', () => {
  for (const [lon,lat] of [[-127.6965649809078,51.50988224307444],[69.73782737156847,-49.57340345380605]])
    expect(lookupMarineRegion(catalog,lon,lat)).toEqual({kind:'no-region'});
  expect(lookupMarineRegion(catalog,-140,0).kind).toBe('marine-region');
  expect(lookupMarineRegion(catalog,12.5,41.9)).toEqual({kind:'no-region'});
});
it.each([[NaN,0],[0,Infinity],[181,0],[0,-91]])('rejects invalid longitude/latitude %s,%s', (lon,lat) => {
  expect(lookupMarineRegion(catalog,lon,lat)).toEqual({kind:'invalid-position'});
});

const square = (identity: number, x = 0, hole = false) => ({ identity, bbox:[x,0,x+200000,200000],
  rings:[new Int32Array([x,0,x+200000,0,x+200000,200000,x,200000,x,0]),
    ...(hole ? [new Int32Array([50000,50000,150000,50000,150000,150000,50000,150000,50000,50000])] : [])] });
function synthetic(ids: MarineRegionId[], parts = ids.map((_,i) => square(i))): MarineCatalog {
  return {policy:MARINE_POLICY,identities:ids.map(id => ({...approved[id],id,priority:approved[id].priority as 100|200})),polygons:parts,coordinateBufferBytes:0};
}
describe('synthetic geographic TEST geometry and deterministic priority', () => {
  it.each<[MarineRegionId,MarineRegionId]>([['caribbean','atlantic'],['arabian','indian'],['mediterranean','atlantic']])(
    'prefers approved %s over %s regardless of polygon order', (regional,basin) => {
      const c=synthetic([basin,regional]);
      expect(lookupMarineRegion(c,1,1)).toMatchObject({kind:'marine-region',region:{id:regional}});
      expect(lookupMarineRegion({...c,polygons:[...c.polygons].reverse()},1,1)).toEqual(lookupMarineRegion(c,1,1));
    });
  it('collapses same-macro duplicates and reports unresolved equal-priority identities', () => {
    const c=synthetic(['caribbean','arabian']);
    expect(lookupMarineRegion({...c,polygons:[square(0),square(0)]},1,1)).toMatchObject({kind:'marine-region',region:{id:'caribbean'}});
    const result=lookupMarineRegion(c,1,1);
    expect(result).toMatchObject({kind:'ambiguous-marine',candidates:[{id:'arabian'},{id:'caribbean'}]});
    expect(lookupMarineRegion({...c,polygons:[...c.polygons].reverse()},1,1)).toEqual(result);
  });
  it('preserves holes, numerical boundaries and disconnected parts', () => {
    const c=synthetic(['pacific'],[square(0,0,true),square(0,300000)]);
    expect(lookupMarineRegion(c,1,1)).toEqual({kind:'no-region'});
    expect(lookupMarineRegion(c,.5,1)).toMatchObject({kind:'marine-region',boundary:true});
    expect(lookupMarineRegion(c,.25,.25).kind).toBe('marine-region');
    expect(lookupMarineRegion(c,4,1).kind).toBe('marine-region');
    expect(lookupMarineRegion(c,2.5,1)).toEqual({kind:'no-region'});
    const edge=synthetic(['atlantic','pacific'],[square(0),square(1,200000)]);
    expect(lookupMarineRegion(edge,2,1).kind).toBe('ambiguous-marine');
  });
});
it('does not allow record order to change actual-asset results', () => {
  const reversed={...catalog,polygons:[...catalog.polygons].reverse()};
  for(const [,lon,lat] of interiors) expect(lookupMarineRegion(reversed,lon,lat)).toEqual(lookupMarineRegion(catalog,lon,lat));
});
it.each([
  (v:any)=>{v.schema=99;},(v:any)=>{v.policy='TEST';},(v:any)=>{v.quantization=1000;},
  (v:any)=>{v.identities[0].id='unapproved';},(v:any)=>{v.identities[0].displayName='North Atlantic Ocean';},
  (v:any)=>{v.identities[0].priority=200;},(v:any)=>{v.identities[1]=v.identities[0];},
  (v:any)=>{v.polygons[0][0]=999;},(v:any)=>{v.polygons[0][1][0]=-99999999;},
  (v:any)=>{v.polygons[0][2][0][0]=1.5;},(v:any)=>{v.polygons[0][2][0].pop();},
  (v:any)=>{v.polygons[0][2][0][2]=999999999;},(v:any)=>{v.polygons[0][2][0][0]+=1;},
])('rejects malformed/unapproved asset contents', mutate => {
  const value=structuredClone(raw); mutate(value); expect(()=>decodeMarineCatalog(value)).toThrow('Invalid marine catalog');
});
