import type { ViewMode } from '../cesium/inspectionMode';
import { PositionReadouts, type PositionReadoutProps } from './PositionReadouts';
import './InspectionStrip.css';

interface Props extends PositionReadoutProps { viewMode: ViewMode }

/** S5 presentation only. Native picking and camera navigation remain in EarthView. */
export function InspectionStrip({ viewMode, ...positionProps }: Props) {
  return <section className="inspection-strip" aria-label="ISS Inspection context" aria-describedby="inspection-interaction-guidance">
    <div className="inspection-identity"><strong>ISS / Inspection</strong><span>Spatial investigation</span></div>
    <div className="inspection-over"><span>Over</span><strong>—</strong></div>
    <PositionReadouts {...positionProps} />
    <p className="sr-only" id="inspection-interaction-guidance">Drag to orbit the ISS. Scroll or pinch to zoom. Select a verified module in the model. Attitude unavailable.</p>
    {viewMode !== 'ISS_INSPECTION' && <p className="sr-only" role="status">{viewMode === 'ENTERING_INSPECTION' ? 'Approaching moving ISS target' : 'Returning to Earth View'}</p>}
  </section>;
}
