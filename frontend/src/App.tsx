import { useCallback, useState } from 'react';
import { useOrbitalDelivery } from './api/useOrbitalDelivery';
import { EarthView } from './cesium/EarthView';
import { OrbitalStatus } from './components/OrbitalStatus';
import { bufferStatus } from './orbital/bufferState';
import type { ModelLoadStatus } from './cesium/modelPresentation';

export default function App() {
  const delivery = useOrbitalDelivery();
  const [sceneTimeMs, setSceneTimeMs] = useState<number | null>(null);
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const [overviewRequest, setOverviewRequest] = useState(0);
  const [modelState, setModelState] = useState<{ status: ModelLoadStatus; loadMs: number | null }>({ status: 'loading', loadMs: null });
  const onSceneTime = useCallback((time: number) => setSceneTimeMs(time), []);
  const onSceneError = useCallback((message: string) => setSceneError(message), []);
  const onModelStatus = useCallback((status: ModelLoadStatus, loadMs?: number) => setModelState({ status, loadMs: loadMs ?? null }), []);
  const buffer = bufferStatus(delivery.window, sceneTimeMs);

  return <main className="app-shell">
    <EarthView window={delivery.window} focusRequest={focusRequest} overviewRequest={overviewRequest} onSceneTime={onSceneTime} onSceneError={onSceneError} onModelStatus={onModelStatus} />
    <div className="top-brand" aria-hidden="true"><span className="brand-mark">M<span>1</span></span><span>MISSION1 <em>/ EARTH VIEW</em></span></div>
    <div className="top-actions">
      <span className="scene-chip"><span className={`dot ${buffer === 'active' ? 'is-on' : ''}`} />{buffer === 'active' ? 'ORBITAL BUFFER ACTIVE' : buffer === 'expired' ? 'BUFFER EXPIRED' : 'AWAITING DATA'}</span>
      <button type="button" onClick={() => setFocusRequest((value) => value + 1)} disabled={!delivery.window || buffer !== 'active'}>Focus ISS</button>
      <button type="button" onClick={() => setOverviewRequest((value) => value + 1)}>Earth overview</button>
    </div>
    <OrbitalStatus delivery={delivery} buffer={buffer} sceneTimeMs={sceneTimeMs} sceneError={sceneError} modelState={modelState} />
    <div className="scene-legend" aria-label="Trajectory legend">
      <span className="legend-dot" /> ISS computed position
      <span className="legend-rule" /> Recent / future GP propagation
    </div>
  </main>;
}
