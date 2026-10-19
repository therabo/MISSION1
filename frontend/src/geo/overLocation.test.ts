import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { deriveOverLocation } from './overLocation';
import { decodeCountryCatalog, lookupCountry, type CountryLookupResult } from './countryLookup';
import { decodeMarineCatalog, lookupMarineRegion, type MarineCatalog } from './marineLookup';
import countryAsset from './countryAsset.json';
import marineAsset from './marineAsset.json';
const country=decodeCountryCatalog(JSON.parse(readFileSync(new URL(`../../public/geo/${countryAsset.file}`,import.meta.url),'utf8')));
const marine=decodeMarineCatalog(JSON.parse(readFileSync(new URL(`../../public/geo/${marineAsset.file}`,import.meta.url),'utf8')));
const physical=(longitudeDegrees:number,latitudeDegrees:number)=>({source:'PRIMARY_GP_TLE' as const,timeMs:0,altitudeMeters:420000,longitudeDegrees,latitudeDegrees});
it.each([
  [-5.616582223527928,36.02059975442019,'Spain'],[120.86438520719881,22.03242808683551,'Taiwan'],
  [108.27187218631511,-2.867524916193773,'Indonesia'],[119.50131595263602,11.34643952071201,'Philippines'],
  [17.958470086344448,80.1497333849196,'Svalbard'],
] as const)('preserves country authority at the approved %s,%s fixture (%s)', (lon,lat,name)=>{
  const c=lookupCountry(country,lon,lat);expect(c).toMatchObject({kind:'country',country:{displayName:name}});
  const neverRead={kind:'ready' as const,get catalog(): MarineCatalog {throw Error('Country result must prevent marine access');}};
  expect(deriveOverLocation(c,neverRead,physical(lon,lat))).toBe(c);
  if(name!=='Taiwan')expect(lookupMarineRegion(marine,lon,lat).kind).toBe('marine-region');
});
it.each<CountryLookupResult>([
  {kind:'ambiguous-boundary',candidates:[],policy:country.policy},{kind:'invalid-position'},
  {kind:'dataset-loading'},{kind:'dataset-unavailable'},
])('never falls through after country $kind', c=>{
  expect(deriveOverLocation(c,{kind:'ready',get catalog(): MarineCatalog {throw Error('No marine lookup');}},physical(-40,30))).toBe(c);
});
it('distinguishes marine loading/unavailable, no-region and valid marine without blocking countries',()=>{
  const p=physical(-40,30);
  for(const kind of ['dataset-loading','dataset-unavailable'] as const)
    expect(deriveOverLocation({kind:'no-country'},{kind},p)).toEqual({kind,dataset:'marine'});
  expect(deriveOverLocation({kind:'no-country'},{kind:'ready',catalog:marine},p)).toMatchObject({kind:'marine-region',region:{id:'atlantic'}});
  expect(deriveOverLocation({kind:'no-country'},{kind:'ready',catalog:marine},physical(-127.6965649809078,51.50988224307444))).toEqual({kind:'no-region'});
  expect(deriveOverLocation({kind:'no-country'},{kind:'ready',catalog:marine},null)).toEqual({kind:'invalid-position'});
});
