import { useState } from 'react';
import type { CountryIdentity } from '../geo/countryLookup';
import './CountryMark.css';

/** Decorative source artwork inside a neutral superellipse shell; not a national emblem. */
export function CountryMark({ flagKey }: { flagKey: CountryIdentity['flagKey'] }) {
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [naturalFitKey, setNaturalFitKey] = useState<string | null>(null);
  if (!flagKey || !/^[a-z]{2}$/.test(flagKey) || flagKey === failedKey) return null;
  return <span className="country-mark" aria-hidden="true">
    <span className="country-mark-artwork">
      <img src={`${import.meta.env.BASE_URL}flags/${flagKey}.svg`} alt="" draggable={false}
        data-natural-fit={naturalFitKey === flagKey || undefined}
        onLoad={event => {
          const image = event.currentTarget;
          setNaturalFitKey(image.naturalWidth < image.naturalHeight ? flagKey : null);
        }}
        onError={() => {
          setFailedKey(flagKey);
          console.warn('[over-country] Local flag unavailable', flagKey);
        }} />
    </span>
  </span>;
}
