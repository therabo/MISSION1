import { useMissionReplay } from "./replay/useMissionReplay";
import { useCallback, useRef, useState } from "react";
import { useOrbitalDelivery } from "./api/useOrbitalDelivery";
import { useComparisonDelivery } from "./api/useComparisonDelivery";
import { EarthView } from "./cesium/EarthView";
import { OrbitalStatus } from "./components/OrbitalStatus";
import { TrajectorySelector } from "./components/TrajectorySelector";
import { ModuleInfo } from "./components/ModuleInfo";
import { CurrentCrewWorkspace } from "./crew/CurrentCrewWorkspace";
import { bufferStatus } from "./orbital/bufferState";
import type {
  ModelLoadStatus,
  SemanticMapping,
} from "./cesium/modelPresentation";
import {
  DEFAULT_TRAJECTORY_SOURCE,
  oemUnavailableReason,
  requestedSource,
} from "./cesium/trajectorySelection";
import type {
  PositionSnapshot,
  TrajectorySource,
} from "./cesium/trajectorySelection";
import type { ViewMode } from "./cesium/inspectionMode";
import { useEarthWorkspace } from "./layout/useEarthWorkspace";
import { TopContextBar } from "./components/TopContextBar";
import { TrajectoryLegend } from "./components/TrajectoryLegend";
import { SceneControls, type EarthSceneControls } from "./components/SceneControls";
import { HistoricalTimeBar } from "./replay/HistoricalTimeBar";
import { HistoricalOrbitalSummary } from "./replay/HistoricalOrbitalSummary";
import { coherentHistoricalState, historicalSource, stepHistoricalUtc } from "./replay/historicalPresentation";
import { useTemporalPresentation } from "./replay/useTemporalPresentation";
import { InspectionStrip } from "./components/InspectionStrip";
import { useWorkspaceDissolve } from "./layout/useWorkspaceDissolve";

const mission1Wordmark = `${import.meta.env.BASE_URL}branding/MISSION1-logo.png`;

export default function App() {
  const [replaying, setReplaying] = useState(false);
  const [replayAt, setReplayAt] = useState(
    new Date(Date.now() - 60000).toISOString(),
  );
  const [replayRetry, setReplayRetry] = useState(0);
  const retryReplay = useCallback(() => setReplayRetry(value => value + 1), []);
  const replay = useMissionReplay(replaying, replayAt, replayRetry);
  const delivery = useOrbitalDelivery(!replaying);
  const [sceneTimeMs, setSceneTimeMs] = useState<number | null>(null);
  const comparison = useComparisonDelivery(sceneTimeMs, !replaying);
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [inspectionRequest, setInspectionRequest] = useState(0);
  const [overviewRequest, setOverviewRequest] = useState(0);
  const [modelState, setModelState] = useState<{
    status: ModelLoadStatus;
    loadMs: number | null;
  }>({ status: "loading", loadMs: null });
  const [viewMode, setViewMode] = useState<ViewMode>("EARTH_OVERVIEW");
  const viewModeRef = useRef<ViewMode>("EARTH_OVERVIEW");
  const [crewOpen, setCrewOpen] = useState(false);
  const crewOpenRef = useRef(false);
  const closeCrew = useCallback(() => {
    crewOpenRef.current = false;
    setCrewOpen(false);
    requestAnimationFrame(() => {
      if (!crewOpenRef.current)
        document.getElementById("crew-launcher")?.focus({ preventScroll: true });
    });
  }, []);
  const openCrew = useCallback(() => {
    if (crewOpenRef.current) { closeCrew(); return; }
    setSelectedModule(null);
    // Surface visibility and the renderer's return flight can coexist.
    crewOpenRef.current = true; setCrewOpen(true);
    if (viewModeRef.current !== 'EARTH_OVERVIEW' && viewModeRef.current !== 'EXITING_INSPECTION')
      setOverviewRequest(value => value + 1);
  }, [closeCrew]);
  const onViewModeChange = useCallback((next: ViewMode) => {
    viewModeRef.current = next; setViewMode(next);
    // Native scene picking can enter Inspection without using the top button.
    if ((next === 'ENTERING_INSPECTION' || next === 'ISS_INSPECTION') && crewOpenRef.current) {
      crewOpenRef.current = false; setCrewOpen(false);
    }
  }, []);
  const [selectedModule, setSelectedModule] = useState<SemanticMapping | null>(
    null,
  );
  const [selectedSource, setSelectedSource] = useState<TrajectorySource>(
    DEFAULT_TRAJECTORY_SOURCE,
  );
  const [sourceNotice, setSourceNotice] = useState<string | null>(null);
  const [position, setPosition] = useState<PositionSnapshot | null>(null);
  const onSourceUnavailable = useCallback((reason: string) => {
    setSelectedSource("PRIMARY_GP_TLE");
    setSourceNotice(reason);
  }, []);
  const temporal = useTemporalPresentation({ historical: replaying, at: replayAt, data: replay.data,
    delivery, comparison, source: selectedSource });
  const presentationHistorical = temporal.presented.kind === 'historical';
  const presentedData = temporal.presented.kind === 'historical' ? temporal.presented.data : null;
  const presentedAt = temporal.presented.kind === 'historical' ? temporal.presented.at : replayAt;
  const currentDelivery = temporal.presented.kind === 'current' ? temporal.presented.delivery : delivery;
  const currentComparison = temporal.presented.kind === 'current' ? temporal.presented.comparison : comparison;
  const currentSource = temporal.presented.kind === 'current' ? temporal.presented.source : selectedSource;
  // These are Current presentation samples. Historical has its own authoritative
  // replayAt/primary state; its renderer callbacks must not replace this context.
  const onSceneTime = useCallback((time: number) => {
    if (!presentationHistorical) setSceneTimeMs(time);
  }, [presentationHistorical]);
  const onPosition = useCallback((next: PositionSnapshot | null) => {
    if (!presentationHistorical) setPosition(next);
  }, [presentationHistorical]);
  const onSceneError = useCallback(
    (message: string) => setSceneError(message),
    [],
  );
  const onModelStatus = useCallback(
    (status: ModelLoadStatus, loadMs?: number) =>
      setModelState({ status, loadMs: loadMs ?? null }),
    [],
  );
  const onModuleSelection = useCallback((module: SemanticMapping | null) => {
    setSelectedModule(module);
    if (module) { crewOpenRef.current = false; setCrewOpen(false); }
  }, []);
  const buffer = bufferStatus(currentDelivery.window, sceneTimeMs);

  const inspecting =
    viewMode === "ENTERING_INSPECTION" || viewMode === "ISS_INSPECTION";
  const returning = viewMode === "EXITING_INSPECTION";
  const stationFocused = inspecting || returning;
  // Earth and Inspection share anchored chrome; camera state remains authoritative.
  const earthWorkspace = !stationFocused && !crewOpen;
  const replayState = coherentHistoricalState(presentedData, presentedAt);
  const effectiveHistoricalSource = historicalSource(replayState);
  const earthSource = presentationHistorical ? effectiveHistoricalSource : currentSource;
  const historicalWaiting = !replayState && !replay.error && !presentedData;
  const changeTemporalMode = (enabled: boolean) => { setSelectedModule(null); setReplaying(enabled); };
  const stepHistorical = (seconds: -600 | 600) => setReplayAt(at => stepHistoricalUtc(at, seconds));
  const earthControls = useRef<EarthSceneControls | null>(null);
  const onControlsReady = useCallback((controls: EarthSceneControls | null) => { earthControls.current = controls; }, []);
  const shell = useRef<HTMLElement>(null);
  useWorkspaceDissolve(shell, stationFocused);
  const workspace = useEarthWorkspace(shell, `${replaying}:${crewOpen}:${stationFocused}:${earthWorkspace}`);
  const oemReason = oemUnavailableReason(currentComparison.response, sceneTimeMs);
  const chooseSource = (next: TrajectorySource) => {
    setSelectedSource((current) =>
      requestedSource(
        current,
        next,
        viewMode,
        comparison.response,
        sceneTimeMs,
      ),
    );
    setSourceNotice(null);
  };

  const orbitalStatus = <OrbitalStatus
    delivery={currentDelivery}
    comparison={currentComparison}
    buffer={buffer}
    sceneTimeMs={sceneTimeMs}
    sceneError={sceneError}
    modelState={modelState}
    inspecting={stationFocused}
    selectedSource={currentSource}
    position={position}
    sourceNotice={sourceNotice ? (oemReason ?? sourceNotice) : null}
  />;

  return (
    <main
      ref={shell}
      aria-busy={temporal.holding}
      data-view-mode={viewMode}
      className={`app-shell earth-current ${replaying && earthWorkspace ? "is-historical" : ""} ${stationFocused ? "is-inspecting" : ""} ${crewOpen ? "has-crew-panel" : ""}`}
    >
      <EarthView
        currentClouds={!replaying}
        workspace={workspace}
        replay={
          presentationHistorical
            ? {
                atMs: Date.parse(presentedAt),
                state: replayState,
              }
            : null
        }
        holding={temporal.holding}
        currentAtMs={temporal.currentAtMs}
        window={currentDelivery.window}
        comparison={currentComparison.response}
        selectedSource={earthSource ?? currentSource}
        onSourceUnavailable={onSourceUnavailable}
        onPosition={onPosition}
        inspectionRequest={inspectionRequest}
        overviewRequest={overviewRequest}
        moduleSelection={selectedModule}
        onSceneTime={onSceneTime}
        onSceneError={onSceneError}
        onModelStatus={onModelStatus}
        onModuleSelection={onModuleSelection}
        onViewModeChange={onViewModeChange}
        onControlsReady={onControlsReady}
      />
      <div className={`earth-current-ui${stationFocused ? ' inspection-ui' : ''}`}>
        <TopContextBar brand={<img className="brand-wordmark" src={mission1Wordmark} alt="MISSION1"
          width={2172} height={724} draggable={false} />}
          sceneTimeMs={presentationHistorical ? Date.parse(presentedAt) : sceneTimeMs} historical={replaying}
          presentedHistorical={presentationHistorical}
          onCurrent={() => changeTemporalMode(false)}
          viewMode={viewMode} onEarth={() => {
            if (crewOpenRef.current) closeCrew();
            else if (stationFocused) setOverviewRequest(value => value + 1);
          }}
          inspectionDisabled={temporal.holding || (presentationHistorical ? !replayState : !currentDelivery.window || buffer !== "active") || modelState.status !== "ready"}
          onInspect={() => {
            crewOpenRef.current = false; setCrewOpen(false);
            setInspectionRequest(value => value + 1);
          }}
          onHistorical={() => changeTemporalMode(true)}
          onCrew={openCrew} crewOpen={crewOpen}
          source={<TrajectorySelector selectedSource={earthSource} viewMode={viewMode}
            automatic={replaying || presentationHistorical} emptyLabel={historicalWaiting ? 'Waiting' : 'Unavailable'}
            oemReason={presentationHistorical ? null : oemReason} sourceNotice={presentationHistorical ? null : sourceNotice} onSelect={chooseSource} />} />
        <div className="earth-scene-ui">
          {!stationFocused && <>
          <TrajectoryLegend selectedSource={earthSource} oemReason={presentationHistorical ? null : oemReason} pending={presentationHistorical && historicalWaiting} />
          <SceneControls onZoomIn={() => earthControls.current?.zoomIn()}
            onZoomOut={() => earthControls.current?.zoomOut()} onReset={() => earthControls.current?.resetView()} />
          </>}
        </div>
        <HistoricalTimeBar open={replaying && !stationFocused && !crewOpen} at={replayAt} onStep={stepHistorical} pending={temporal.holding}
          coverage={replay.coverage?.orbit ?? null} onApply={setReplayAt}
          presentedAt={presentationHistorical ? presentedAt : sceneTimeMs === null ? undefined : new Date(sceneTimeMs).toISOString()} />
        {stationFocused && <InspectionStrip viewMode={viewMode}
          position={presentationHistorical ? replayState && effectiveHistoricalSource ? {
            source: effectiveHistoricalSource, timeMs: Date.parse(replayState.effectiveAt),
            latitudeDegrees: replayState.latitudeDegrees, longitudeDegrees: replayState.longitudeDegrees,
            altitudeMeters: replayState.altitudeMeters,
          } : null : position}
          selectedSource={earthSource}
          sceneTimeMs={presentationHistorical ? Date.parse(presentedAt) : sceneTimeMs}
          buffer={presentationHistorical ? replayState ? 'active' : 'waiting' : buffer} />}
        {presentationHistorical ? <HistoricalOrbitalSummary data={presentedData} at={presentedAt} loading={false} error={replay.error} sceneError={sceneError} inspecting={stationFocused} /> : orbitalStatus}
        <ModuleInfo module={selectedModule} onClose={() => setSelectedModule(null)} historical={presentationHistorical} acceptedAt={presentedAt} />
        {temporal.holding && <p className="sr-only" role="status">{replaying ? 'Resolving Historical target' : 'Preparing Current context'} · Showing the previous coherent scene.</p>}
        {replay.error && !presentationHistorical && replaying && <p className="sr-only" role="alert">{replay.error}</p>}
        <CurrentCrewWorkspace open={crewOpen} onClose={closeCrew}
          historical={presentationHistorical ? { at: presentedAt, data: presentedData! } : null}
          request={{ historical: replaying, at: replayAt, pending: temporal.holding, error: replaying ? replay.error : null, onRetry: retryReplay }} />
      </div>
    </main>
  );
}
