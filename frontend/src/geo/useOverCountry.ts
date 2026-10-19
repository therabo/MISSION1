import { useEffect, useMemo, useState } from 'react';
import { acceptedPhysicalPosition, type PositionReadoutProps } from '../orbital/positionAvailability';
import { loadCountryCatalog } from './countryCatalog';
import { lookupCountry, type CountryCatalog, type CountryLookupResult } from './countryLookup';

type CatalogState = { kind: 'ready'; catalog: CountryCatalog } | { kind: 'dataset-loading' | 'dataset-unavailable' };

/** Consume the accepted readout context. No source selection, async per-point work, or separate clock. */
export function useOverCountry(context: PositionReadoutProps): CountryLookupResult {
  const [state, setState] = useState<CatalogState>({ kind: 'dataset-loading' });
  useEffect(() => {
    let active = true;
    void loadCountryCatalog().then(catalog => { if (active) setState({ kind: 'ready', catalog }); })
      .catch(() => { if (active) setState({ kind: 'dataset-unavailable' }); });
    return () => { active = false; };
  }, []);
  const physical = acceptedPhysicalPosition(context);
  const latitude = physical?.latitudeDegrees, longitude = physical?.longitudeDegrees;
  // Include the accepted source/time/availability context; camera/view mode is deliberately absent.
  return useMemo(() => {
    if (!physical || latitude === undefined || longitude === undefined || Math.abs(latitude) > 90 || Math.abs(longitude) > 180)
      return { kind: 'invalid-position' };
    if (state.kind !== 'ready') return { kind: state.kind };
    return lookupCountry(state.catalog, longitude, latitude);
  }, [state, latitude, longitude, physical?.source, physical?.timeMs, !!physical]);
}
