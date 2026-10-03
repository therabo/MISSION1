import { useCallback, useState } from 'react';
import { useOrbitalDelivery } from './api/useOrbitalDelivery';
import { useComparisonDelivery } from './api/useComparisonDelivery';
import { EarthView } from './cesium/EarthView';
import { OrbitalStatus } from './components/OrbitalStatus';
import { TrajectorySelector } from './components/TrajectorySelector';
import { ModuleInfo } from './components/ModuleInfo';
import { CrewPanel } from './crew/CrewPanel';
import { bufferStatus } from './orbital/bufferState';
import type { ModelLoadStatus, SemanticMapping } from './cesium/modelPresentation';
import { DEFAULT_TRAJECTORY_SOURCE, oemUnavailableReason, requestedSource } from './cesium/trajectorySelection';
import type { PositionSnapshot, TrajectorySource } from './cesium/trajectorySelection';
import type { ViewMode } from './cesium/inspectionMode';

export default function App() {
  const delivery = useOrbitalDelivery();
  const [sceneTimeMs, setSceneTimeMs] = useState<number | null>(null);
  const comparison = useComparisonDelivery(sceneTimeMs);
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [inspectionRequest, setInspectionRequest] = useState(0);
  const [overviewRequest, setOverviewRequest] = useState(0);
  const [modelState, setModelState] = useState<{ status: ModelLoadStatus; loadMs: number | null }>({ status: 'loading', loadMs: null });
  const [crewOpen, setCrewOpen] = useState(false);
  const openCrew = useCallback(() => { setSelectedModule(null); setCrewOpen(true); }, []);
  const closeCrew = useCallback(() => { setCrewOpen(false); requestAnimationFrame(() => document.getElementById('crew-launcher')?.focus()); }, []);
  const [selectedModule, setSelectedModule] = useState<SemanticMapping | null>(null);
  const [selectedSource, setSelectedSource] = useState<TrajectorySource>(DEFAULT_TRAJECTORY_SOURCE);
  const [sourceNotice, setSourceNotice] = useState<string | null>(null);
  const [position, setPosition] = useState<PositionSnapshot | null>(null);
  const onSourceUnavailable = useCallback((reason: string) => { setSelectedSource('PRIMARY_GP_TLE'); setSourceNotice(reason); }, []);
  const [viewMode, setViewMode] = useState<ViewMode>('EARTH_OVERVIEW');
  const onSceneTime = useCallback((time: number) => setSceneTimeMs(time), []);
  const onSceneError = useCallback((message: string) => setSceneError(message), []);
  const onModelStatus = useCallback((status: ModelLoadStatus, loadMs?: number) => setModelState({ status, loadMs: loadMs ?? null }), []);
  const onModuleSelection = useCallback((module: SemanticMapping | null) => { setSelectedModule(module); if (module) setCrewOpen(false); }, []);
  const buffer = bufferStatus(delivery.window, sceneTimeMs);

  const inspecting = viewMode === 'ENTERING_INSPECTION' || viewMode === 'ISS_INSPECTION';
  const approaching = viewMode === 'ENTERING_INSPECTION';
  const returning = viewMode === 'EXITING_INSPECTION';
  const stationFocused = inspecting || returning;
  const oemReason = oemUnavailableReason(comparison.response, sceneTimeMs);
  const chooseSource = (next: TrajectorySource) => {
    setSelectedSource((current) => requestedSource(current, next, viewMode, comparison.response, sceneTimeMs));
    setSourceNotice(null);
  };

  return <main className={`app-shell ${stationFocused ? 'is-inspecting' : ''} ${crewOpen ? 'has-crew-panel' : ''}`}>
    <EarthView window={delivery.window} comparison={comparison.response} selectedSource={selectedSource} onSourceUnavailable={onSourceUnavailable} onPosition={setPosition} inspectionRequest={inspectionRequest} overviewRequest={overviewRequest} onSceneTime={onSceneTime} onSceneError={onSceneError} onModelStatus={onModelStatus} onModuleSelection={onModuleSelection} onViewModeChange={setViewMode} />
    <div className="top-brand" aria-hidden="true"><span className="brand-mark">M<span>1</span></span><span>MISSION1 <em>/ {approaching ? 'APPROACHING ISS' : returning ? 'RETURNING TO EARTH' : inspecting ? 'ISS INSPECTION' : 'EARTH VIEW'}</em></span></div>
    <div className="top-actions">
      <span className="scene-chip"><span className={`dot ${buffer === 'active' ? 'is-on' : ''}`} />{buffer === 'active' ? 'ORBITAL BUFFER ACTIVE' : buffer === 'expired' ? 'BUFFER EXPIRED' : 'AWAITING DATA'}</span>
      {returning ? <button type="button" disabled>Returning to Earth View</button> : inspecting
        ? <button type="button" className="back-button" onClick={() => setOverviewRequest((value) => value + 1)}>Back to Earth View</button>
        : <button type="button" onClick={() => setInspectionRequest((value) => value + 1)} disabled={viewMode !== 'EARTH_OVERVIEW' || !delivery.window || buffer !== 'active' || modelState.status !== 'ready'}>Inspect ISS</button>}
    </div>
    <OrbitalStatus delivery={delivery} comparison={comparison} buffer={buffer} sceneTimeMs={sceneTimeMs} sceneError={sceneError} modelState={modelState} inspecting={stationFocused} approaching={approaching} returning={returning} selectedSource={selectedSource} position={position} crewOpen={crewOpen} onCrewOpen={openCrew} />
    {crewOpen && <CrewPanel onClose={closeCrew} />}
    {selectedModule && <ModuleInfo module={selectedModule} onClose={() => setSelectedModule(null)} />}
    {stationFocused && <div className="inspection-hint"><strong>{approaching ? 'Approaching moving ISS target' : returning ? 'Returning to Earth View' : 'Drag to orbit the ISS · Scroll to zoom'}</strong><span>Model not to scale · Attitude unavailable</span></div>}
    <TrajectorySelector selectedSource={selectedSource} viewMode={viewMode} oemReason={oemReason} sourceNotice={sourceNotice} onSelect={chooseSource} />
  </main>;
}
