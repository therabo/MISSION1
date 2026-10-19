import { PositionReadouts, type PositionReadoutProps } from './PositionReadouts';
import { CountryMark } from './CountryMark';
import type { CountryLookupResult } from '../geo/countryLookup';
import './PositionStatusBar.css';

interface Props extends PositionReadoutProps { describedBy?: string; over?: CountryLookupResult }

/** One informational contract for Earth and Inspection; state ownership stays in App. */
export function PositionStatusBar({ describedBy, over, ...positionProps }: Props) {
  return <section className="position-status-bar" aria-label="ISS position" aria-describedby={describedBy}>
    <PositionReadouts {...positionProps} />
    <dl className="position-over"><div data-country-state={over?.kind ?? 'dataset-loading'}><dt>Over</dt>
      <dd className={over?.kind === 'country' ? 'position-country' : undefined}>
        {over?.kind === 'country' ? <>
          <CountryMark flagKey={over.country.flagKey} />
          <span className="country-name" title={over.country.displayName}>{over.country.displayName}</span>
        </> : '—'}
      </dd>
    </div></dl>
  </section>;
}
