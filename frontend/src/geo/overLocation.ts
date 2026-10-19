import type { PositionSnapshot } from '../cesium/trajectorySelection';
import type { CountryLookupResult } from './countryLookup';
import { lookupMarineRegion, type MarineCatalog, type MarineLookupResult } from './marineLookup';

export type MarineCatalogState = { kind: 'ready'; catalog: MarineCatalog } | { kind: 'dataset-loading' | 'dataset-unavailable' };
export type OverLookupResult = CountryLookupResult | MarineLookupResult |
  { kind: 'dataset-loading' | 'dataset-unavailable'; dataset: 'marine' };

/** Country diagnostics are authoritative. Only a successful country no-match can inspect marine state. */
export function deriveOverLocation(country: CountryLookupResult, marine: MarineCatalogState,
  physical: PositionSnapshot | null): OverLookupResult {
  if (country.kind !== 'no-country') return country;
  if (!physical) return { kind: 'invalid-position' };
  if (marine.kind !== 'ready') return { kind: marine.kind, dataset: 'marine' };
  return lookupMarineRegion(marine.catalog, physical.longitudeDegrees, physical.latitudeDegrees);
}

/** Keep the existing country-stage diagnostic independently observable in the shared bar. */
export function overCountryState(result: OverLookupResult | undefined): CountryLookupResult['kind'] {
  if (!result) return 'dataset-loading';
  if (result.kind === 'marine-region' || result.kind === 'ambiguous-marine' || result.kind === 'no-region' ||
      ('dataset' in result && result.dataset === 'marine')) return 'no-country';
  return result.kind;
}
