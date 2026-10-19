import { PositionReadouts, type PositionReadoutProps } from './PositionReadouts';
import { CountryMark } from './CountryMark';
import { overCountryState, type OverLookupResult } from '../geo/overLocation';
import './PositionStatusBar.css';

interface Props extends PositionReadoutProps { describedBy?: string; over?: OverLookupResult }

/** One informational contract for Earth and Inspection; state ownership stays in App. */
export function PositionStatusBar({ describedBy, over, ...positionProps }: Props) {
  return <section className="position-status-bar" aria-label="ISS position" aria-describedby={describedBy}>
    <PositionReadouts {...positionProps} />
    <dl className="position-over"><div data-country-state={overCountryState(over)} data-over-state={over?.kind ?? 'dataset-loading'}
      data-geography-dataset={over && 'dataset' in over ? over.dataset : undefined}><dt>Over</dt>
      <dd className={over?.kind === 'country' ? 'position-country' : over?.kind === 'marine-region' ? 'position-marine' : undefined}>
        {over?.kind === 'country' ? <>
          <CountryMark flagKey={over.country.flagKey} />
          <span className="country-name" title={over.country.displayName}>{over.country.displayName}</span>
        </> : over?.kind === 'marine-region' ?
          <span className="marine-name" title={over.region.displayName}>{over.region.displayName}</span> : '—'}
      </dd>
    </div></dl>
  </section>;
}
