import { useMissionReplay } from "./replay/useMissionReplay";
import { ReplayControls } from "./replay/ReplayControls";
import { ReplayCrewPanel } from "./replay/ReplayCrewPanel";
import { useCallback, useRef, useState } from "react";
import { useOrbitalDelivery } from "./api/useOrbitalDelivery";
import { useComparisonDelivery } from "./api/useComparisonDelivery";
import { EarthView } from "./cesium/EarthView";
import { OrbitalStatus } from "./components/OrbitalStatus";
import { TrajectorySelector } from "./components/TrajectorySelector";
import { ModuleInfo } from "./components/ModuleInfo";
import { CrewPanel } from "./crew/CrewPanel";
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
import mission1Wordmark from "./assets/branding/MISSION1-logo.png";
import { TopContextBar } from "./components/TopContextBar";
import { TrajectoryLegend } from "./components/TrajectoryLegend";
import { SceneControls, type EarthSceneControls } from "./components/SceneControls";
import { HistoricalTimeBar } from "./replay/HistoricalTimeBar";
import { HistoricalOrbitalSummary } from "./replay/HistoricalOrbitalSummary";
import { coherentHistoricalState, historicalSource, stepHistoricalUtc } from "./replay/historicalPresentation";
import { useTemporalPresentation } from "./replay/useTemporalPresentation";
import { InspectionStrip } from "./components/InspectionStrip";
import { useWorkspaceDissolve } from "./layout/useWorkspaceDissolve";

export default function App() {
  const [replaying, setReplaying] = useState(false);
  const [replayAt, setReplayAt] = useState(
    new Date(Date.now() - 60000).toISOString(),
  );
  const replay = useMissionReplay(replaying, replayAt);
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
  const [crewOpen, setCrewOpen] = useState(false);
  const openCrew = useCallback(() => {
    setSelectedModule(null);
    setCrewOpen(true);
  }, []);
  const closeCrew = useCallback(() => {
    setCrewOpen(false);
    requestAnimationFrame(() =>
      document.getElementById("crew-launcher")?.focus(),
    );
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
  const [viewMode, setViewMode] = useState<ViewMode>("EARTH_OVERVIEW");
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
    if (module) setCrewOpen(false);
  }, []);
  const buffer = bufferStatus(currentDelivery.window, sceneTimeMs);

  const inspecting =
    viewMode === "ENTERING_INSPECTION" || viewMode === "ISS_INSPECTION";
  const approaching = viewMode === "ENTERING_INSPECTION";
  const returning = viewMode === "EXITING_INSPECTION";
  const stationFocused = inspecting || returning;
  // Earth and Inspection share anchored chrome; camera state remains authoritative.
  const earthWorkspace = !stationFocused && !crewOpen;
  const sceneWorkspace = !crewOpen;
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
    approaching={approaching}
    returning={returning}
    selectedSource={currentSource}
    position={position}
    crewOpen={crewOpen}
    onCrewOpen={openCrew}
    compact={sceneWorkspace && !presentationHistorical}
    detailOnly={stationFocused}
    sourceNotice={sourceNotice ? (oemReason ?? sourceNotice) : null}
  />;

  return (
    <main
      ref={shell}
      aria-busy={temporal.holding}
      data-view-mode={viewMode}
      className={`app-shell ${sceneWorkspace ? "earth-current" : ""} ${replaying && earthWorkspace ? "is-historical" : ""} ${stationFocused ? "is-inspecting" : ""} ${crewOpen ? "has-crew-panel" : ""}`}
    >
      <EarthView
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
        onSceneTime={onSceneTime}
        onSceneError={onSceneError}
        onModelStatus={onModelStatus}
        onModuleSelection={onModuleSelection}
        onViewModeChange={setViewMode}
        onControlsReady={onControlsReady}
      />
      <div className="top-brand">
        <img className="brand-wordmark" src={mission1Wordmark} alt="MISSION1"
          width={2172} height={724} draggable={false} />
      </div>
      {sceneWorkspace ? <div className={`earth-current-ui${stationFocused ? ' inspection-ui' : ''}`}>
        <TopContextBar sceneTimeMs={presentationHistorical ? Date.parse(presentedAt) : sceneTimeMs} historical={replaying}
          presentedHistorical={presentationHistorical}
          onCurrent={() => changeTemporalMode(false)}
          viewMode={viewMode} onEarth={stationFocused ? () => setOverviewRequest(value => value + 1) : undefined}
          inspectionDisabled={temporal.holding || (presentationHistorical ? !replayState : !currentDelivery.window || buffer !== "active") || modelState.status !== "ready"}
          onInspect={() => setInspectionRequest(value => value + 1)}
          onHistorical={() => changeTemporalMode(true)}
          onCrew={openCrew}
          source={<TrajectorySelector presentation="context" selectedSource={earthSource} viewMode={viewMode}
            automatic={replaying || presentationHistorical} emptyLabel={historicalWaiting ? 'Waiting' : 'Unavailable'}
            oemReason={presentationHistorical ? null : oemReason} sourceNotice={presentationHistorical ? null : sourceNotice} onSelect={chooseSource} />} />
        <div className="earth-scene-ui">
          {!stationFocused && <>
          <TrajectoryLegend selectedSource={earthSource} oemReason={presentationHistorical ? null : oemReason} pending={presentationHistorical && historicalWaiting} />
          <SceneControls onZoomIn={() => earthControls.current?.zoomIn()}
            onZoomOut={() => earthControls.current?.zoomOut()} onReset={() => earthControls.current?.resetView()} />
          </>}
        </div>
        <HistoricalTimeBar open={replaying && !stationFocused} at={replayAt} onStep={stepHistorical} pending={temporal.holding}
          coverage={replay.coverage?.orbit ?? null} onApply={setReplayAt}
          presentedAt={presentationHistorical ? presentedAt : sceneTimeMs === null ? undefined : new Date(sceneTimeMs).toISOString()} />
        {stationFocused && <InspectionStrip module={selectedModule} viewMode={viewMode}
          onModules={() => document.querySelector<HTMLCanvasElement>('.earth-view canvas')?.focus({ preventScroll: true })} />}
        {presentationHistorical ? <HistoricalOrbitalSummary data={presentedData} at={presentedAt} loading={false} error={replay.error} sceneError={sceneError} detailOnly={stationFocused} /> : orbitalStatus}
        {temporal.holding && <p className="sr-only" role="status">{replaying ? 'Resolving Historical target' : 'Preparing Current context'} · Showing the previous coherent scene.</p>}
        {replay.error && !presentationHistorical && replaying && <p className="sr-only" role="alert">{replay.error}</p>}
      </div> : <>
      <ReplayControls
        enabled={replaying}
        at={replayAt}
        onTime={setReplayAt}
        disabled={viewMode !== "EARTH_OVERVIEW"}
        coverage={replay.coverage}
        onMode={changeTemporalMode}
      />
      <div className="top-actions">
        <span className="scene-chip">
          <span className={`dot ${buffer === "active" ? "is-on" : ""}`} />
          {replaying
            ? "HISTORICAL EPOCH"
            : buffer === "active"
              ? "ORBITAL BUFFER ACTIVE"
              : buffer === "expired"
                ? "BUFFER EXPIRED"
                : "AWAITING DATA"}
        </span>
        {returning ? (
          <button type="button" disabled>
            Returning to Earth View
          </button>
        ) : inspecting ? (
          <button
            type="button"
            className="back-button"
            onClick={() => setOverviewRequest((value) => value + 1)}
          >
            Back to Earth View
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setInspectionRequest((value) => value + 1)}
            disabled={
              viewMode !== "EARTH_OVERVIEW" ||
              (replaying
                ? !replay.data?.orbit.primary
                : !delivery.window || buffer !== "active") ||
              modelState.status !== "ready"
            }
          >
            Inspect ISS
          </button>
        )}
      </div>
      </>}
      {!replaying && !sceneWorkspace && orbitalStatus}
      {replaying && !sceneWorkspace && (
        <aside
          className="orbital-panel replay-orbit"
          aria-label="Historical orbital state"
        >
          <span className="eyebrow">REPLAY / {replayAt}</span>
          <h2>ISS historical state</h2>
          {replay.loading && <p role="status">Loading historical state…</p>}
          {replay.error && <p role="alert">{replay.error}</p>}
          {replay.data &&
            (replay.data.orbit.primary ? (
              <>
                <p>
                  {replay.data.orbit.primary.source.kind} ·{" "}
                  {replay.data.orbit.primary.source.classification
                    .replaceAll("_", " ")
                    .toLowerCase()}
                </p>
                <p>
                  {replay.data.orbit.primary.latitudeDegrees.toFixed(3)}° /{" "}
                  {replay.data.orbit.primary.longitudeDegrees.toFixed(3)}° ·{" "}
                  {(replay.data.orbit.primary.altitudeMeters / 1000).toFixed(1)}{" "}
                  km WGS84
                </p>
                <small>
                  Source epoch:{" "}
                  {replay.data.orbit.primary.source.epoch ??
                    replay.data.orbit.primary.source.creationAt}{" "}
                  · accuracy unknown
                </small>
              </>
            ) : (
              <p role="status">Orbit history unavailable at this instant.</p>
            ))}
          <p className="crew-note">
            Scene paused at UTC epoch. Current orbit paths hidden.
          </p>
          <button
            id="crew-launcher"
            aria-expanded={crewOpen}
            onClick={openCrew}
          >
            Crew history
          </button>
        </aside>
      )}
      {crewOpen &&
        (replaying ? (
          <ReplayCrewPanel
            data={replay.data}
            loading={replay.loading}
            error={replay.error}
            at={replayAt}
            onClose={closeCrew}
          />
        ) : (
          <CrewPanel onClose={closeCrew} />
        ))}
      {selectedModule && (
        <ModuleInfo
          module={selectedModule}
          onClose={() => setSelectedModule(null)}
        />
      )}
      {stationFocused && !sceneWorkspace && (
        <div className="inspection-hint">
          <strong>
            {approaching
              ? "Approaching moving ISS target"
              : returning
                ? "Returning to Earth View"
                : "Drag to orbit the ISS · Scroll to zoom"}
          </strong>
          <span>Model not to scale · Attitude unavailable</span>
        </div>
      )}
      {!replaying && !sceneWorkspace && (
        <TrajectorySelector
          selectedSource={selectedSource}
          viewMode={viewMode}
          oemReason={oemReason}
          sourceNotice={sourceNotice}
          onSelect={chooseSource}
        />
      )}
    </main>
  );
}
