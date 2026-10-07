import type { SemanticMapping } from '../cesium/modelPresentation';
import { ISS_MODEL } from '../cesium/modelPresentation';
import type { ViewMode } from '../cesium/inspectionMode';
import { ContextButton } from './ContextButton';
import './InspectionStrip.css';

interface Props { module: SemanticMapping | null; viewMode: ViewMode; onModules: () => void }

/** S5 presentation only. Native picking and camera navigation remain in EarthView. */
export function InspectionStrip({ module, viewMode, onModules }: Props) {
  const established = viewMode === 'ISS_INSPECTION';
  return <section className="inspection-strip" aria-label="ISS Inspection context">
    <div className="inspection-identity"><strong>ISS / Inspection</strong><span>Spatial investigation</span></div>
    <div className="inspection-selection"><span>Selected module</span><strong>{module?.displayName ?? 'None'}</strong></div>
    <div className="inspection-model" title={`${ISS_MODEL.credit} · Attitude unavailable · Reference geometry, not onboard telemetry`}>
      <strong>{ISS_MODEL.credit.replace(/^ISS 3D model:\s*/, '')}</strong><span>Reference geometry</span>
    </div>
    <div className="inspection-modules-cell"><ContextButton className="inspection-modules" disabled={!established}
      aria-describedby="inspection-interaction-guidance" onClick={onModules}>Modules</ContextButton></div>
    <div className="inspection-orbital-cell"><details className="inspection-orbital-toggle">
      <summary className="context-button" aria-controls="orbital-status-evidence">Orbital detail</summary>
    </details></div>
    <p className="sr-only" id="inspection-interaction-guidance">Drag to orbit the ISS. Scroll or pinch to zoom. Select a verified module in the model. Attitude unavailable.</p>
    {viewMode !== 'ISS_INSPECTION' && <p className="sr-only" role="status">{viewMode === 'ENTERING_INSPECTION' ? 'Approaching moving ISS target' : 'Returning to Earth View'}</p>}
  </section>;
}
