import { PositionReadouts, type PositionReadoutProps } from './PositionReadouts';
import './PositionStatusBar.css';

interface Props extends PositionReadoutProps { describedBy?: string }

/** One informational contract for Earth and Inspection; state ownership stays in App. */
export function PositionStatusBar({ describedBy, ...positionProps }: Props) {
  return <section className="position-status-bar" aria-label="ISS position" aria-describedby={describedBy}>
    <PositionReadouts {...positionProps} />
    <dl className="position-over"><div><dt>Over</dt><dd>—</dd></div></dl>
  </section>;
}
