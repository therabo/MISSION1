import { ISS_MODEL } from '../cesium/modelPresentation';
import type { ViewMode } from '../cesium/inspectionMode';
import './InspectionStrip.css';
import './InspectionOrbitalDetails.css';

interface Props { viewMode: ViewMode }

/** S5 presentation only. Native picking and camera navigation remain in EarthView. */
export function InspectionStrip({ viewMode }: Props) {
  return <section className="inspection-strip" aria-label="ISS Inspection context" aria-describedby="inspection-interaction-guidance">
    <div className="inspection-identity"><strong>ISS / Inspection</strong><span>Spatial investigation</span></div>
    <div className="inspection-over"><span>Over</span><strong>—</strong></div>
    <div className="inspection-model" title={`${ISS_MODEL.credit} · Attitude unavailable · Reference geometry, not onboard telemetry`}>
      <strong>{ISS_MODEL.credit.replace(/^ISS 3D model:\s*/, '')}</strong><span>Reference geometry</span>
    </div>
    <div className="inspection-orbital-cell"><details className="inspection-orbital-toggle">
      <summary className="context-button" aria-controls="orbital-status-evidence">Orbital detail</summary>
    </details></div>
    <p className="sr-only" id="inspection-interaction-guidance">Drag to orbit the ISS. Scroll or pinch to zoom. Select a verified module in the model. Attitude unavailable.</p>
    {viewMode !== 'ISS_INSPECTION' && <p className="sr-only" role="status">{viewMode === 'ENTERING_INSPECTION' ? 'Approaching moving ISS target' : 'Returning to Earth View'}</p>}
  </section>;
}
