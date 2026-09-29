import { useCallback, useState } from 'react';
import { useOrbitalDelivery } from './api/useOrbitalDelivery';
import { EarthView } from './cesium/EarthView';
import { OrbitalStatus } from './components/OrbitalStatus';
import { ModuleInfo } from './components/ModuleInfo';
import { bufferStatus } from './orbital/bufferState';
import type { ModelLoadStatus, SemanticMapping } from './cesium/modelPresentation';
import type { ViewMode } from './cesium/inspectionMode';

export default function App() {
  const delivery = useOrbitalDelivery();
  const [sceneTimeMs, setSceneTimeMs] = useState<number | null>(null);
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [inspectionRequest, setInspectionRequest] = useState(0);
  const [overviewRequest, setOverviewRequest] = useState(0);
  const [modelState, setModelState] = useState<{ status: ModelLoadStatus; loadMs: number | null }>({ status: 'loading', loadMs: null });
  const [selectedModule, setSelectedModule] = useState<SemanticMapping | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('EARTH_OVERVIEW');
  const onSceneTime = useCallback((time: number) => setSceneTimeMs(time), []);
  const onSceneError = useCallback((message: string) => setSceneError(message), []);
  const onModelStatus = useCallback((status: ModelLoadStatus, loadMs?: number) => setModelState({ status, loadMs: loadMs ?? null }), []);
  const onModuleSelection = useCallback((module: SemanticMapping | null) => setSelectedModule(module), []);
  const buffer = bufferStatus(delivery.window, sceneTimeMs);

  const inspecting = viewMode === 'ENTERING_INSPECTION' || viewMode === 'ISS_INSPECTION';

  return <main className={`app-shell ${inspecting ? 'is-inspecting' : ''}`}>
    <EarthView window={delivery.window} inspectionRequest={inspectionRequest} overviewRequest={overviewRequest} onSceneTime={onSceneTime} onSceneError={onSceneError} onModelStatus={onModelStatus} onModuleSelection={onModuleSelection} onViewModeChange={setViewMode} />
    <div className="top-brand" aria-hidden="true"><span className="brand-mark">M<span>1</span></span><span>MISSION1 <em>/ {inspecting ? 'ISS INSPECTION' : 'EARTH VIEW'}</em></span></div>
    <div className="top-actions">
      <span className="scene-chip"><span className={`dot ${buffer === 'active' ? 'is-on' : ''}`} />{buffer === 'active' ? 'ORBITAL BUFFER ACTIVE' : buffer === 'expired' ? 'BUFFER EXPIRED' : 'AWAITING DATA'}</span>
      {inspecting
        ? <button type="button" className="back-button" onClick={() => setOverviewRequest((value) => value + 1)}>Back to Earth View</button>
        : <button type="button" onClick={() => setInspectionRequest((value) => value + 1)} disabled={!delivery.window || buffer !== 'active' || modelState.status !== 'ready'}>Inspect ISS</button>}
    </div>
    <OrbitalStatus delivery={delivery} buffer={buffer} sceneTimeMs={sceneTimeMs} sceneError={sceneError} modelState={modelState} inspecting={inspecting} />
    {selectedModule && <ModuleInfo module={selectedModule} onClose={() => setSelectedModule(null)} />}
    {inspecting && <div className="inspection-hint"><strong>Drag to orbit the ISS · Scroll to zoom</strong><span>Model not to scale · Attitude unavailable</span></div>}
    {!inspecting && <div className="scene-legend" aria-label="Trajectory legend">
      <span className="legend-dot" /> ISS computed position
      <span className="legend-rule" /> Recent / future GP propagation
    </div>}
  </main>;
}
