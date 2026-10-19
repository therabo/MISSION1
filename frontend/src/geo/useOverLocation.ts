import { useEffect, useMemo, useState } from 'react';
import { acceptedPhysicalPosition, type PositionReadoutProps } from '../orbital/positionAvailability';
import { useOverCountry } from './useOverCountry';
import { loadMarineCatalog } from './marineCatalog';
import { deriveOverLocation, type MarineCatalogState, type OverLookupResult } from './overLocation';

/** One accepted physical context. Both independent catalogs start after initial render, never after first water. */
export function useOverLocation(context: PositionReadoutProps): OverLookupResult {
  const country = useOverCountry(context);
  const [marine, setMarine] = useState<MarineCatalogState>({ kind: 'dataset-loading' });
  useEffect(() => {
    let active = true;
    void loadMarineCatalog().then(catalog => { if (active) setMarine({ kind: 'ready', catalog }); })
      .catch(() => { if (active) setMarine({ kind: 'dataset-unavailable' }); });
    return () => { active = false; };
  }, []);
  const physical = acceptedPhysicalPosition(context);
  return useMemo(() => deriveOverLocation(country, marine, physical),
    [country, marine, physical?.latitudeDegrees, physical?.longitudeDegrees, physical?.source, physical?.timeMs, !!physical]);
}
