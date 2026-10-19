import type { ReactNode } from 'react';
import { PositionReadouts, type PositionReadoutProps } from './PositionReadouts';

interface Props extends PositionReadoutProps {
  sourceStatus?: ReactNode;
}

export function OperationalSummary({ sourceStatus, ...positionProps }: Props) {
  return <section className="operational-summary" aria-label="ISS operational summary">
    <div className="summary-identity"><strong>ISS / WGS84</strong></div>
    <PositionReadouts {...positionProps} />
    {sourceStatus}
  </section>;
}
