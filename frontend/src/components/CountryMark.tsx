import { useState } from 'react';
import type { CountryIdentity } from '../geo/countryLookup';
import './CountryMark.css';

/** Decorative local source artwork at its intrinsic aspect ratio, without a frame. */
export function CountryMark({ flagKey }: { flagKey: CountryIdentity['flagKey'] }) {
  const [failedKey, setFailedKey] = useState<string | null>(null);
  if (!flagKey || !/^[a-z]{2}$/.test(flagKey) || flagKey === failedKey) return null;
  return <img className="country-mark" aria-hidden="true"
    src={`${import.meta.env.BASE_URL}flags/${flagKey}.svg`} alt="" draggable={false}
    onError={() => {
      setFailedKey(flagKey);
      console.warn('[over-country] Local flag unavailable', flagKey);
    }} />;
}
