import { useState } from 'react';
import type { CountryIdentity } from '../geo/countryLookup';
import './CountryMark.css';

/** Decorative source artwork inside a neutral superellipse shell; not a national emblem. */
export function CountryMark({ flagKey }: { flagKey: CountryIdentity['flagKey'] }) {
  const [failedKey, setFailedKey] = useState<string | null>(null);
  if (!flagKey || !/^[a-z]{2}$/.test(flagKey) || flagKey === failedKey) return null;
  return <span className="country-mark" aria-hidden="true">
    <svg className="country-mark-shell" viewBox="0 0 28 24" focusable="false">
      <path d="M14 1C25 1 27 2.7 27 12S25 23 14 23 1 21.3 1 12 3 1 14 1Z" />
    </svg>
    <img src={`${import.meta.env.BASE_URL}flags/${flagKey}.svg`} alt="" draggable={false}
      onError={() => {
        setFailedKey(flagKey);
        console.warn('[over-country] Local flag unavailable', flagKey);
      }} />
  </span>;
}
