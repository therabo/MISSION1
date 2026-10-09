import type { ReplayState } from '../replay/replayApi';
import { memo, useEffect, useLayoutEffect, useRef } from 'react';
import {
  Cartesian2,
  Cartesian3,
  ClockRange,
  ClockStep,
  Color,
  ConstantProperty,
  ConstantPositionProperty,
  Credit,
  Ellipsoid,
  EllipsoidTerrainProvider,
  JulianDate,
  LabelStyle,
  Matrix4,
  Quaternion,
  Model,
  ModelFeature,
  NearFarScalar,
  PerspectiveFrustum,
  Math as CesiumMath,
  ScreenSpaceEventType,
  SceneTransforms,
  Viewer,
  type Entity,
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import type { OrbitalWindow } from '../orbital/types';
import type { ComparisonResponse } from '../orbital/comparison';
import { ISS_MODEL, labelVisible, markerVisible, modelLoadTransition, modelVisible, modulePickingAvailable, representationForState, resolveVerifiedModulePick } from './modelPresentation';
import type { ModelLoadStatus, Representation, SemanticMapping } from './modelPresentation';
import { createVisualWindow } from './visualWindow';
import type { VisualWindow } from './visualWindow';
import { earthOccludes, canInspect, INITIAL_VIEW_MODE, inspectionPresentation, nextViewMode, pickAction } from './inspectionMode';
import { InspectionTransition, poseQuaternion, initialTangent, transitionDuration } from './inspectionTransition';
import { warmSkyRendering } from './skyRenderingWarmup';
import { starBackgroundFactory, updateStarBackground } from './starBackground';
import type { CameraPose } from './inspectionTransition';
import type { IssPick, ViewEvent, ViewMode } from './inspectionMode';
import { enableEarthLighting } from './earthLighting';
import { installEarthImagery } from './earthImagery';
import { GRAPHICS_QUALITY, resolutionScaleForDpr } from './graphicsQuality';
import { createIssMaterialShader } from './issMaterialQuality';
import { warmInspectionRendering } from './inspectionRenderingWarmup';
import { inspectionAntialiasing } from './inspectionAntialiasing';
import skyboxManifest from './skyboxManifest.json';
import { adaptTrailClearance, createTrajectoryTrails, orderTrails, showTrails, updateTrail } from './trajectoryRendering';
import type { TrajectoryTrails } from './trajectoryRendering';
import { effectiveSource, oemPositionProperty, selectedPositionAt } from './trajectorySelection';
import type { PositionSnapshot, TrajectorySource } from './trajectorySelection';
import type { SampledPositionProperty } from 'cesium';
import { EARTH_OVERVIEW_DISPLAY_LIFT_METERS, OVERVIEW_SILHOUETTE, applyModelSilhouette, displayLiftForMode, modelDisplayPosition } from './earthViewPresentation';
import { DisplayRetarget } from './displayRetarget';
import { TrajectoryVisualFrame } from './trajectoryOrientation';
import { makeVelocityProperty } from './velocityProperty';
import { clampInspectionOffset, inspectionControlProfile, inspectionZoomRange, inspectionPinchRange, rearInspectionOffset } from './inspectionControls';
import type { SampledProperty } from 'cesium';
import { desiredGapCssPixels, displayedModelNearDepth, projectedModelFootprint } from './trajectoryClearance';
import { TRAJECTORY_VISIBILITY, trajectoryVisibilityForView } from './trajectoryVisibility';
import { InspectionCameraMotion, InspectionHover, resolveInspectionHoverPick } from './inspectionHover';
import { InspectionFeatureState } from './inspectionFeatureState';

import type { WorkspaceGeometry } from './workspaceGeometry';
import type { EarthSceneControls } from '../components/SceneControls';
import { applyWorkspaceProjection, createWorkspaceGlobeProjection, installWorkspacePicking, WorkspacePerspectiveFrustum } from './workspaceProjection';

interface EarthViewProps {
  workspace?: WorkspaceGeometry | null;
  replay?: { atMs: number; state: ReplayState | null } | null;
  holding?: boolean;
  currentAtMs?: number;
  window: OrbitalWindow | null;
  comparison: ComparisonResponse | null;
  selectedSource: TrajectorySource;
  onSourceUnavailable: (reason: string) => void;
  onPosition: (position: PositionSnapshot | null) => void;
  inspectionRequest: number;
  overviewRequest: number;
  onSceneTime: (timeMs: number) => void;
  onSceneError: (message: string) => void;
  onModelStatus: (status: ModelLoadStatus, loadMs?: number) => void;
  onModuleSelection: (module: SemanticMapping | null) => void;
  moduleSelection?: SemanticMapping | null;
  onViewModeChange: (mode: ViewMode) => void;
  onControlsReady?: (controls: EarthSceneControls | null) => void;
}

export const APPROACH_DURATION_SECONDS = 6;
export const EXIT_DURATION_SECONDS = 5;
interface CameraSnapshot extends CameraPose { near: number; far: number; transform: Matrix4 }

export const EarthView = memo(function EarthView({ workspace = null, replay = null, holding = false, currentAtMs, window, comparison, selectedSource, onSourceUnavailable, onPosition, inspectionRequest, overviewRequest, onSceneTime, onSceneError, onModelStatus, onModuleSelection, moduleSelection = null, onViewModeChange, onControlsReady }: EarthViewProps) {
  const container = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;
  const resizeWorkspace = useRef<(() => void) | null>(null);
  const viewer = useRef<Viewer | null>(null);
  const iss = useRef<Entity | null>(null);
  const active = useRef<VisualWindow | null>(null);
  const comparisonRef = useRef<ComparisonResponse | null>(null);
  const primaryLine = useRef<TrajectoryTrails | null>(null);
  const pendingPrimaryLine = useRef<TrajectoryTrails | null>(null);
  const oemPosition = useRef<SampledPositionProperty | null>(null);
  const oemVelocity = useRef<SampledProperty | null>(null);
  const selectedSourceRef = useRef<TrajectorySource>(selectedSource);
  const sourceUnavailableCallback = useRef(onSourceUnavailable);
  const positionCallback = useRef(onPosition);
  sourceUnavailableCallback.current = onSourceUnavailable;
  positionCallback.current = onPosition;
  const replayRef = useRef(replay);
  const presentFrame = useRef<(() => void) | null>(null);
  const held = useRef(false);
  const positionAt = (time: JulianDate, result: Cartesian3): Cartesian3 | undefined =>
    replayRef.current ? (replayRef.current.state ? Cartesian3.fromElements(replayRef.current.state.position.x,replayRef.current.state.position.y,replayRef.current.state.position.z,result) : undefined) : selectedPositionAt(selectedSourceRef.current, active.current, oemPosition.current, time, result);
  const velocityAt = (time: JulianDate, result: Cartesian3): Cartesian3 | undefined =>
    replayRef.current ? (replayRef.current.state ? Cartesian3.fromElements(replayRef.current.state.velocity.x,replayRef.current.state.velocity.y,replayRef.current.state.velocity.z,result) : undefined) : (selectedSourceRef.current === 'NASA_OEM' ? oemVelocity.current : active.current?.velocity)?.getValue(time, result);
  const updateTrajectory = useRef<((sceneMs: number) => void) | null>(null);
  const model = useRef<Model | null>(null);
  const modelStatus = useRef<ModelLoadStatus>('loading');
  const representation = useRef<Representation>('none');
  const viewMode = useRef<ViewMode>(INITIAL_VIEW_MODE);
  const cameraSnapshot = useRef<CameraSnapshot | null>(null);
  const entry = useRef<InspectionTransition | null>(null);
  const enterInspection = useRef<(() => void) | null>(null);
  const exitInspection = useRef<(() => void) | null>(null);
  const initializedClock = useRef(false);
  const initializedCamera = useRef(false);
  const lastReportedSecond = useRef<number | null>(null);
  const timeCallback = useRef(onSceneTime);
  const errorCallback = useRef(onSceneError);
  const modelCallback = useRef(onModelStatus);
  const moduleCallback = useRef(onModuleSelection);
  const modeCallback = useRef(onViewModeChange);
  const selectedModule = useRef<SemanticMapping | null>(null);
  const selectionPresentation = useRef<((module: SemanticMapping | null) => void) | null>(null);
  const controlsCallback = useRef(onControlsReady);
  controlsCallback.current = onControlsReady;
  timeCallback.current = onSceneTime;
  errorCallback.current = onSceneError;
  modelCallback.current = onModelStatus;
  moduleCallback.current = onModuleSelection;
  modeCallback.current = onViewModeChange;

  useLayoutEffect(() => {
    if (!container.current) return;
    let destroyed = false;
    let instance: Viewer;
    try {
      instance = new Viewer(container.current, {
        baseLayerPicker: false,
        baseLayer: false,
        terrainProvider: new EllipsoidTerrainProvider(),
        geocoder: false,
        animation: false,
        timeline: false,
        homeButton: false,
        sceneModePicker: false,
        selectionIndicator: false,
        infoBox: false,
        navigationHelpButton: false,
        fullscreenButton: false,
        shouldAnimate: true,
        scene3DOnly: true,
        useBrowserRecommendedResolution: GRAPHICS_QUALITY.useBrowserRecommendedResolution,
        msaaSamples: GRAPHICS_QUALITY.msaaSamples,
        contextOptions: { webgl: { antialias: GRAPHICS_QUALITY.browserAntialias } },
      });
    } catch {
      errorCallback.current('3D Earth could not start. Check browser WebGL support.');
      return;
    }
    viewer.current = instance;
    if (instance.camera.frustum instanceof PerspectiveFrustum)
      instance.camera.frustum = instance.camera.frustum.clone(new WorkspacePerspectiveFrustum());
    // Full-screen native lens; only the projected principal point changes.
    let canonicalFov = instance.camera.frustum instanceof PerspectiveFrustum ? instance.camera.frustum.fov! : Math.PI / 3;
    let viewportWidth = 0, viewportHeight = 0;
    let offsetX = 0, offsetY = 0;
    let pendingViewportComposition = false;
    let adaptation: { x: number; y: number; targetX: number; targetY: number; start: number } | null = null;
    const reducedMotion = globalThis.window.matchMedia('(prefers-reduced-motion: reduce)');
    const applyFov = (fov: number): void => {
      canonicalFov = fov;
      if (instance.camera.frustum instanceof PerspectiveFrustum) {
        instance.camera.frustum.fov = fov;
        applyWorkspaceProjection(instance.camera.frustum, offsetX, offsetY);
      }
    };
    const compose = (immediate = false): void => {
      const full = workspaceRef.current;
      const matchesViewport = full?.width === viewportWidth && full?.height === viewportHeight;
      const x = matchesViewport && full.width > 0 ? full.focalPoint.x / full.width - 0.5 : 0;
      const y = matchesViewport && full.height > 0 ? full.focalPoint.y / full.height - 0.5 : 0;
      if (immediate || reducedMotion.matches) {
        offsetX = x; offsetY = y; adaptation = null;
        applyFov(canonicalFov);
      } else if (x !== (adaptation?.targetX ?? offsetX) || y !== (adaptation?.targetY ?? offsetY)) {
        adaptation = { x: offsetX, y: offsetY, targetX: x, targetY: y, start: performance.now() };
      }
      instance.scene.requestRender();
    };
    const removeComposition = instance.scene.preRender.addEventListener(() => {
      if (!adaptation) return;
      const t = Math.min(1, (performance.now() - adaptation.start) / 650);
      const ease = t * t * t * (10 + t * (-15 + 6 * t));
      offsetX = adaptation.x + (adaptation.targetX - adaptation.x) * ease;
      offsetY = adaptation.y + (adaptation.targetY - adaptation.y) * ease;
      if (t === 1) adaptation = null;
      applyFov(canonicalFov);
    });
    const resize = (width: number, height: number): void => {
      if (width <= 0 || height <= 0) return;
      const changed = width !== viewportWidth || height !== viewportHeight;
      viewportWidth = width; viewportHeight = height;
      if (changed) { instance.resize(); pendingViewportComposition = true; }
      compose(pendingViewportComposition);
      if (workspaceRef.current?.width === width && workspaceRef.current?.height === height) pendingViewportComposition = false;
    };
    const viewportObserver = new ResizeObserver(entries => {
      const bounds = entries[0].contentRect;
      if (bounds.width !== viewportWidth || bounds.height !== viewportHeight) resize(bounds.width, bounds.height);
    });
    viewportObserver.observe(container.current);
    resizeWorkspace.current = () => resize(container.current!.clientWidth, container.current!.clientHeight);
    resizeWorkspace.current();
    const motionChanged = () => { if (reducedMotion.matches) compose(true); };
    reducedMotion.addEventListener('change', motionChanged);
    const removePicking = installWorkspacePicking(instance.scene,
      () => ({ width: viewportWidth, height: viewportHeight }), () => model.current);
    const applyControls = inspectionControlProfile(instance.scene.screenSpaceCameraController);
    const features = new InspectionFeatureState(() => model.current, () => reducedMotion.matches);
    const featureMotionChanged = () => features.reducedMotionChanged();
    reducedMotion.addEventListener('change', featureMotionChanged);
    const visualFrame = new TrajectoryVisualFrame();
    const sceneVelocity = new Cartesian3();
    const modelDisplayFrame = new Matrix4();
    const renderedModelMatrix = new Matrix4();
    const centeringInverse = new Matrix4();
    const frameAt = (position: Cartesian3, result: Matrix4) => {
      const velocity = velocityAt(instance.clock.currentTime, sceneVelocity);
      return velocity && visualFrame.update(position, velocity, result);
    };
    instance.resolutionScale = resolutionScaleForDpr(globalThis.window.devicePixelRatio);
    const nativeFxaa = instance.scene.postProcessStages.fxaa;
    const inspectionAa = instance.scene.postProcessStages.add(inspectionAntialiasing(nativeFxaa, () => !instance.scene.msaaSupported ||
      (GRAPHICS_QUALITY.inspectionFxaa && (modelStatus.current === 'loading' || viewMode.current !== 'EARTH_OVERVIEW'))));
    nativeFxaa.enabled = false;
    // Confine ground fog below orbital viewpoints. Crossing Cesium's default
    // 800km ceiling otherwise rebuilds every model shader during entry/exit.
    // Preserve the ground-view density curve above the engine's height clamp.
    const fog = instance.scene.fog;
    fog.heightScalar *= (fog.maxHeight / GRAPHICS_QUALITY.groundFogMaximumHeightMeters) ** fog.heightFalloff;
    fog.maxHeight = GRAPHICS_QUALITY.groundFogMaximumHeightMeters;
    instance.scene.highDynamicRange = GRAPHICS_QUALITY.highDynamicRange && instance.scene.highDynamicRangeSupported;
    instance.scene.sunBloom = GRAPHICS_QUALITY.sunBloom;
    const diagnostics = import.meta.env.DEV && new URLSearchParams(globalThis.location.search).has('graphicsDiagnostics');
    const approachDiagnostics = import.meta.env.DEV && new URLSearchParams(globalThis.location.search).has('approachDiagnostics');
    let lastApproachLog = 0;
    const removeApproachDiagnostics = approachDiagnostics ? instance.scene.postRender.addEventListener((_scene, time) => {
      if (viewMode.current !== 'ENTERING_INSPECTION') return;
      const now = active.current;
      const target = now && positionAt(time, new Cartesian3());
      if (!target) return;
      const wall = performance.now();
      if (wall - lastApproachLog < 400) return;
      lastApproachLog = wall;
      const camera = instance.camera;
      const aim = Cartesian3.normalize(Cartesian3.subtract(target, camera.positionWC, new Cartesian3()), new Cartesian3());
      const pixel = SceneTransforms.worldToWindowCoordinates(instance.scene, target, new Cartesian2());
      console.info('[approach]', JSON.stringify({
        phase: entry.current?.kind,
        time: JulianDate.toIso8601(time),
        distance: Math.round(Cartesian3.distance(camera.positionWC, target)),
        angularErrorDeg: +(Math.acos(Math.max(-1, Math.min(1, Cartesian3.dot(camera.directionWC, aim)))) * 180 / Math.PI).toFixed(2),
        screen: pixel && [Math.round(pixel.x), Math.round(pixel.y)],
        viewport: [instance.scene.canvas.clientWidth, instance.scene.canvas.clientHeight],
        screenError: pixel && +Math.hypot(pixel.x / instance.scene.canvas.clientWidth - 0.5,
          pixel.y / instance.scene.canvas.clientHeight - 0.5).toFixed(3),
        earthOccluded: earthOccludes(camera.positionWC, target),
        modelCenterDelta: model.current?.ready ? Math.round(Cartesian3.distance(model.current.boundingSphere.center, target)) : null,
        minimumPixelSize: model.current?.minimumPixelSize,
      }));
    }) : null;
    let frames = 0;
    let frameWindowStart = performance.now();
    const removeDiagnostics = diagnostics ? instance.scene.postRender.addEventListener(() => {
      frames += 1;
      const elapsed = performance.now() - frameWindowStart;
      if (elapsed < 5000) return;
      const target = positionAt(instance.clock.currentTime, new Cartesian3());
      const pixel = target && SceneTransforms.worldToWindowCoordinates(instance.scene, target, new Cartesian2());
      console.info('[graphics] frames', JSON.stringify({ mode: viewMode.current, modelScreen: pixel && [pixel.x, pixel.y], fps: +(frames * 1000 / elapsed).toFixed(1),
        canvas: [instance.scene.canvas.width, instance.scene.canvas.height] }));
      frames = 0;
      frameWindowStart = performance.now();
    }) : null;
    if (diagnostics) console.info('[graphics] capabilities', JSON.stringify({
      dpr: globalThis.window.devicePixelRatio,
      resolutionScale: instance.resolutionScale,
      msaaSupported: instance.scene.msaaSupported,
      msaaSamples: instance.scene.msaaSamples,
      nativeFxaa: nativeFxaa.enabled,
      inspectionFxaaConfigured: GRAPHICS_QUALITY.inspectionFxaa,
      retainedAntialiasing: inspectionAa.enabled,
      maximumCubeMapSize: instance.scene.maximumCubeMapSize,
      hdrSupported: instance.scene.highDynamicRangeSupported,
      hdr: instance.scene.highDynamicRange,
    }));
    instance.scene.globe.baseColor = Color.fromCssColorString('#18394a');
    enableEarthLighting(instance.scene.globe);
    const globeProjection = createWorkspaceGlobeProjection();
    instance.scene.globe.material = globeProjection;
    instance.scene.backgroundColor = Color.fromCssColorString('#040b14');
    if (instance.scene.sun) {
      instance.scene.sun.show = true;
      instance.scene.sun.glowFactor = GRAPHICS_QUALITY.sunGlowFactor;
    }
    const makeStarBackground = starBackgroundFactory(() => instance.clock.currentTime);
    if (instance.scene.skyBox) {
      const bundledSkyBox = instance.scene.skyBox;
      instance.scene.skyBox = makeStarBackground(bundledSkyBox.sources);
      bundledSkyBox.destroy();
    }
    const removeStarTime = instance.scene.preRender.addEventListener((_scene, time) => {
      if (instance.scene.skyBox) updateStarBackground(instance.scene.skyBox, time);
    });
    instance.camera.setView({ destination: Cartesian3.fromDegrees(20, 12, 22_000_000) });
    instance.clock.clockRange = ClockRange.UNBOUNDED;
    instance.clock.clockStep = ClockStep.SYSTEM_CLOCK_MULTIPLIER;
    instance.clock.multiplier = 1;
    instance.clock.shouldAnimate = true;

    const disposeImagery = installEarthImagery(instance, message => errorCallback.current(message));

    // Give the non-streaming ISS textures, feature tables and first-use shaders
    // first use of the decoder/upload queue. Refine stars after Inspection is
    // available; the bundled skybox remains visible during this loading phase.
    // Both maps follow coherent scene time; the texture is a historical NASA
    // visualization, not a live observation of the stars.
    let highQualitySkyboxStarted = false;
    const loadHighQualitySkybox = (): void => {
      if (destroyed || highQualitySkyboxStarted || instance.scene.maximumCubeMapSize < skyboxManifest.faceSize) return;
      highQualitySkyboxStarted = true;
      const keys = ['positiveX', 'negativeX', 'positiveY', 'negativeY', 'positiveZ', 'negativeZ'] as const;
      const skyboxStarted = performance.now();
      void Promise.all(keys.map((key) => new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = skyboxManifest.faces[key].url;
      }))).then((images) => {
        if (destroyed) return;
        const oldSkyBox = instance.scene.skyBox;
        instance.scene.skyBox = makeStarBackground(Object.fromEntries(keys.map((key, index) => [key, images[index]])) as {
          positiveX: HTMLImageElement; negativeX: HTMLImageElement; positiveY: HTMLImageElement;
          negativeY: HTMLImageElement; positiveZ: HTMLImageElement; negativeZ: HTMLImageElement;
        });
        instance.creditDisplay.addStaticCredit(new Credit('<a href="https://svs.gsfc.nasa.gov/3572" target="_blank" rel="noopener noreferrer">Star map: NASA GSFC SVS Tycho II</a>'));
        if (diagnostics) console.info('[graphics] skybox decoded', Math.round(performance.now() - skyboxStarted), 'ms');
        if (oldSkyBox) instance.scene.postRender.addEventListener(function releaseOldSkyBox() {
          instance.scene.postRender.removeEventListener(releaseOldSkyBox);
          if (!oldSkyBox.isDestroyed()) oldSkyBox.destroy();
        });
      }).catch(() => { /* Bundled Cesium stars remain visible. */ });
    };

    const markerVisibility = new ConstantProperty(true);
    let displayCenteringOffset: Cartesian3 | null = null;
    const labelVisibility = new ConstantProperty(true);
    let markerShown = true;
    let labelShown = true;
    const markerPosition = new ConstantPositionProperty();
    iss.current = instance.entities.add({
      position: markerPosition,
      name: 'ISS',
      show: false,
      point: {
        show: markerVisibility,
        pixelSize: 13,
        color: Color.fromCssColorString('#e9faf9'),
        outlineColor: Color.fromCssColorString('#1ce0d1'),
        outlineWidth: 3,
        scaleByDistance: new NearFarScalar(1_000_000, 1.5, 35_000_000, 0.8),
      },
      label: {
        show: labelVisibility,
        text: 'ISS',
        font: '600 13px system-ui',
        fillColor: Color.WHITE,
        outlineColor: Color.fromCssColorString('#07111d'),
        outlineWidth: 3,
        style: LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cartesian2(0, -25),
        scaleByDistance: new NearFarScalar(1_000_000, 1.1, 35_000_000, 0.8),
      },
    });
    const removeTrail = (group: TrajectoryTrails | null): void => {
      if (!group) return;
      for (const trail of group.trails) for (const layer of trail.layers) {
        instance.scene.primitives.remove(layer.primitive);
        layer.material.destroy();
      }
    };
    let trajectoryTransitionVisibility = 1;
    let trajectoryOverviewRange: number = TRAJECTORY_VISIBILITY.visibleRangeMeters;
    const styleTrails = (group: TrajectoryTrails, sceneMs: number): void => {
      // Native globe depth remains; no world-space offsets or depth overrides.
      for (const trail of group.trails) updateTrail(trail, sceneMs, selectedSourceRef.current, trajectoryTransitionVisibility);
    };
    let orderedSource: TrajectorySource | null = null;
    const removeReadyListener = instance.scene.preRender.addEventListener(() => {
      const pending = pendingPrimaryLine.current;
      if (!pending || !pending.trails.every((trail) => trail.layers.every((layer) => layer.primitive.ready))) return;
      removeTrail(primaryLine.current);
      primaryLine.current = pending;
      pendingPrimaryLine.current = null;
      orderTrails(pending, selectedSourceRef.current, instance.scene.primitives);
      orderedSource = selectedSourceRef.current;
      showTrails(pending, trajectoryTransitionVisibility > 0);
    });
    const removeTrajectoryRender = instance.scene.preRender.addEventListener(() => {
      updateTrajectory.current?.(JulianDate.toDate(instance.clock.currentTime).getTime());
    });
    updateTrajectory.current = (sceneMs: number) => {
      if(replayRef.current) { if(primaryLine.current)showTrails(primaryLine.current,false); if(pendingPrimaryLine.current)showTrails(pendingPrimaryLine.current,false); return; }
      const product = comparisonRef.current;
      if (!product || Math.abs(sceneMs - Date.parse(product.generatedAt)) > 300_000) {
        removeTrail(pendingPrimaryLine.current);
        removeTrail(primaryLine.current);
        pendingPrimaryLine.current = null;
        primaryLine.current = null;
        return;
      }
      const generatedMs = Date.parse(product.generatedAt);
      if (primaryLine.current?.generatedMs !== generatedMs && pendingPrimaryLine.current?.generatedMs !== generatedMs) {
        removeTrail(pendingPrimaryLine.current);
        const next = createTrajectoryTrails(product);
        for (const trail of next.trails) for (const layer of trail.layers) instance.scene.primitives.add(layer.primitive);
        pendingPrimaryLine.current = next;
      }
      // Render preparation runs after native camera controls. One snapshot supplies
      // origin, mask and reveal; physical response geometry remains retained.
      const displayedRange = model.current?.ready ? Cartesian3.distance(instance.camera.positionWC, model.current.boundingSphere.center) : NaN;
      trajectoryTransitionVisibility = trajectoryVisibilityForView(viewMode.current, displayedRange, trajectoryOverviewRange);
      if (trajectoryTransitionVisibility > 0 && model.current?.ready) {
        const hull = projectedModelFootprint(instance.scene, model.current);
        const stationNearDepth = displayedModelNearDepth(instance.scene, model.current);
        const gap = desiredGapCssPixels(displayedRange);
        for (let i = 0; i < 2; i++) {
          const group = i === 0 ? primaryLine.current : pendingPrimaryLine.current;
          if (group) for (const trail of group.trails)
            adaptTrailClearance(trail, sceneMs, instance.scene, hull, gap, model.current.silhouetteSize, stationNearDepth);
        }
      }
      if (primaryLine.current) {
        styleTrails(primaryLine.current, sceneMs);
        showTrails(primaryLine.current, trajectoryTransitionVisibility > 0);
        if (orderedSource !== selectedSourceRef.current) {
          orderTrails(primaryLine.current, selectedSourceRef.current, instance.scene.primitives);
          orderedSource = selectedSourceRef.current;
        }
      }
      if (pendingPrimaryLine.current) styleTrails(pendingPrimaryLine.current, sceneMs);
    };

    const selectModule = (selection: SemanticMapping | null): void => {
      if (selection === null && selectedModule.current === null) return;
      selectedModule.current = selection;
      moduleCallback.current(selection);
    };

    const setMode = (event: ViewEvent): void => {
      const next = nextViewMode(viewMode.current, event);
      if (viewMode.current === next) return;
      viewMode.current = next;
      hover.setMode(next);
      features.clearHover();
      applyControls(next);
      modeCallback.current(next);
    };

    let sourceRetarget: DisplayRetarget | null = null;
    const sourceDisplayOffset = new Cartesian3();
    const cameraTrackingFrame = new Matrix4();
    const cameraAnchor = new Cartesian3();
    const displayedPosition = (physical: Cartesian3, lift: number, result: Cartesian3): Cartesian3 => {
      modelDisplayPosition(physical, lift, result);
      return Cartesian3.add(result, sourceDisplayOffset, result);
    };
    let displayLiftMeters = EARTH_OVERVIEW_DISPLAY_LIFT_METERS;
    let silhouetteVisibility = 1;
    let exitPresentation: { startLift: number; startVisibility: number; liftRate: number; visibilityRate: number; progress: number } | null = null;
    const silhouetteOutput = { sizePixels: 0, alpha: 0, visibility: 0 };
    const previousPosition = new Cartesian3();
    const previousQuaternion = new Quaternion();
    const currentQuaternion = new Quaternion();
    const cameraVelocity = new Cartesian3();
    const focusPoint = new Cartesian3();
    const previousFocus = new Cartesian3();
    const focusVelocity = new Cartesian3();
    const focusDirectionRate = new Cartesian3();
    const angularVelocity = new Cartesian3();
    const angularRateQuaternion = new Quaternion();
    const quaternionRate = new Quaternion(0, 0, 0, 0);
    let fovRate = 0, previousFov = 0;
    let previousWall = 0, previousLift = displayLiftMeters, previousVisibility = silhouetteVisibility;
    let liftRate = 0, visibilityRate = 0;
    const capturePose = (): CameraPose => ({ position: Cartesian3.clone(instance.camera.positionWC),
      direction: Cartesian3.clone(instance.camera.directionWC), up: Cartesian3.clone(instance.camera.upWC),
      fov: canonicalFov });

    const leaveInspection = (retarget = false): void => {
      if (viewMode.current === 'EARTH_OVERVIEW' || (viewMode.current === 'EXITING_INSPECTION' && !retarget)) return;
      const saved = cameraSnapshot.current;
      if (!saved) return;
      const pose = capturePose();
      instance.camera.cancelFlight();
      const displayedTarget = displayedPosition(scenePosition, displayLiftMeters, new Cartesian3());
      const initialFocus = Cartesian3.clone(entry.current?.focusPoint ?? displayedTarget);
      const duration = transitionDuration('exit', saved, scenePosition, Cartesian3.angleBetween(pose.direction, saved.direction));
      const flight = new InspectionTransition('exit', pose, cameraTrackingFrame, saved.position, saved.fov,
        duration, performance.now(), saved, displayedTarget, initialFocus);
      if (previousWall) {
        const futureTime = JulianDate.addSeconds(instance.clock.currentTime, 0.001, new JulianDate());
        const futurePosition = positionAt(futureTime, new Cartesian3());
        const futureVelocity = velocityAt(futureTime, new Cartesian3());
        const futureFrame = new Matrix4();
        const hasFutureFrame = futurePosition && futureVelocity && new TrajectoryVisualFrame().update(futurePosition, futureVelocity, futureFrame);
        if (sourceRetarget && futurePosition && hasFutureFrame) {
          sourceRetarget.evaluate(performance.now() + 1, cameraAnchor);
          Matrix4.setTranslation(futureFrame, Cartesian3.add(futurePosition, cameraAnchor, cameraAnchor), futureFrame);
        }
        if (hasFutureFrame)
          flight.retainIncomingDerivative(cameraTrackingFrame, futureFrame, 0.001, cameraVelocity, quaternionRate, fovRate,
            displayedPosition(scenePosition, displayLiftMeters, new Cartesian3()), previousQuaternion, focusVelocity);
      }
      flight.startMs = performance.now();
      entry.current = flight;
      exitPresentation = { startLift: displayLiftMeters, startVisibility: silhouetteVisibility, liftRate, visibilityRate, progress: 0 };
      selectModule(null);
      instance.trackedEntity = undefined;
      instance.camera.lookAtTransform(Matrix4.IDENTITY);
      setMode('EXIT');
    };
    exitInspection.current = leaveInspection;

    const startInspection = (): void => {
      if (viewMode.current !== 'EARTH_OVERVIEW' || !iss.current || !canInspect(modelStatus.current, replayRef.current ? !!replayRef.current.state : !!active.current)) return;
      const current = active.current;
      const sceneMs = JulianDate.toDate(instance.clock.currentTime).getTime();
      if (!replayRef.current && (!current || sceneMs < current.orbital.startMs || sceneMs > current.orbital.endMs)) return;
      const position = positionAt(instance.clock.currentTime, new Cartesian3());
      if (!position || !frameAt(position, trackingFrame)) return;
      if ((Ellipsoid.WGS84.cartesianToCartographic(instance.camera.positionWC)?.height ?? -1) < 1_000) return;
      sourceRetarget = null;
      Cartesian3.clone(Cartesian3.ZERO, sourceDisplayOffset);
      Matrix4.clone(trackingFrame, cameraTrackingFrame);
      const pose = capturePose();
      trajectoryOverviewRange = Cartesian3.distance(instance.camera.positionWC, model.current!.boundingSphere.center);
      cameraSnapshot.current = { ...pose, near: instance.camera.frustum.near, far: instance.camera.frustum.far,
        transform: Matrix4.clone(instance.camera.transform) };
      instance.camera.cancelFlight();
      instance.camera.lookAtTransform(Matrix4.IDENTITY);
      const endpoint = rearInspectionOffset((workspaceRef.current?.width ?? viewportWidth) / (workspaceRef.current?.height ?? viewportHeight), new Cartesian3());
      const endpointDirection = Cartesian3.negate(Matrix4.multiplyByPointAsVector(trackingFrame, endpoint, new Cartesian3()), new Cartesian3());
      const duration = transitionDuration('entry', pose, position, Cartesian3.angleBetween(pose.direction, endpointDirection));
      entry.current = new InspectionTransition('entry', pose, trackingFrame,
        endpoint,
        CesiumMath.toRadians(100), duration, performance.now(), null,
        modelDisplayPosition(position, displayLiftMeters, new Cartesian3()));
      entry.current.startMs = performance.now();
      exitPresentation = null;
      setMode('ENTER');
    };
    enterInspection.current = startInspection;

    // A primitive exposes load and runtime errors. It reads the same sampled
    // property assigned to the ISS entity; no second orbit is constructed.
    const loadStarted = performance.now();
    const materialShader = createIssMaterialShader();
    let cancelGraphicsWarmup: (() => void) | null = null;
    let environmentInitialized = false;
    let modelGraphicsWarming = false;
    let modelGraphicsReady = false, skyGraphicsReady = false;
    const finishGraphicsReadiness = (): void => {
      if (destroyed || modelStatus.current === 'failed' || !modelGraphicsReady || !skyGraphicsReady) return;
      modelGraphicsWarming = false;
      modelStatus.current = modelLoadTransition(modelStatus.current, 'loaded');
      if (modelStatus.current === 'ready') {
        const loadMs = performance.now() - loadStarted;
        modelCallback.current('ready', loadMs);
        if (diagnostics) console.info('[graphics] ISS textures, features and rendering ready', Math.round(loadMs), 'ms');
        loadHighQualitySkybox();
      }
    };
    const cancelSkyWarmup = warmSkyRendering(instance, () => {
      skyGraphicsReady = true;
      finishGraphicsReadiness();
    }, () => {
      modelGraphicsWarming = false;
      cancelGraphicsWarmup?.();
      cancelGraphicsWarmup = null;
      modelStatus.current = modelLoadTransition(modelStatus.current, 'failed');
      modelCallback.current(modelStatus.current);
    });
    void Model.fromGltfAsync({
      url: `${ISS_MODEL.uri}?v=${ISS_MODEL.runtimeSha256.slice(0, 12)}`,
      show: false,
      scale: ISS_MODEL.physicalScale,
      minimumPixelSize: ISS_MODEL.displayMinimumPixelSize,
      maximumScale: ISS_MODEL.displayMaximumScale,
      silhouetteColor: Color.WHITE.withAlpha(OVERVIEW_SILHOUETTE.alpha),
      silhouetteSize: OVERVIEW_SILHOUETTE.sizePixels,
      enablePick: true,
      backFaceCulling: false,
      featureIdLabel: ISS_MODEL.semanticFeatureSet,
      id: ISS_MODEL.id,
      credit: ISS_MODEL.credit,
      showCreditsOnScreen: false,
      incrementallyLoadTextures: false,
      customShader: materialShader,
    }).then((loaded) => {
      if (destroyed) {
        loaded.destroy();
        return;
      }
      loaded.errorEvent.addEventListener(() => {
        loadHighQualitySkybox();
        modelGraphicsWarming = false;
        cancelGraphicsWarmup?.();
        cancelGraphicsWarmup = null;
        modelStatus.current = modelLoadTransition(modelStatus.current, 'failed');
        loaded.show = false;
        selectModule(null);
        leaveInspection();
        modelCallback.current(modelStatus.current);
      });
      loaded.readyEvent.addEventListener(() => {
        // readyEvent occurs after non-streaming textures, draw commands, and
        // feature tables are created. A missing semantic node blocks reveal.
        if (!ISS_MODEL.semanticMappings.every((mapping) => loaded.getNode(mapping.nodeName))) {
          modelStatus.current = modelLoadTransition(modelStatus.current, 'failed');
          modelCallback.current(modelStatus.current);
          return;
        }
        modelGraphicsWarming = true;
        cancelGraphicsWarmup = warmInspectionRendering(instance, () => {
          cancelGraphicsWarmup = null;
          modelGraphicsReady = true;
          finishGraphicsReadiness();
        }, () => skyGraphicsReady);
      });
      // Generate ambient reflections once; Sun lighting still follows scene UTC.
      // Camera lift and orbital translation must not invalidate the environment every kilometre.
      const initialPosition = positionAt(instance.clock.currentTime, new Cartesian3());
      if (initialPosition) {
        loaded.environmentMapManager.position = modelDisplayPosition(initialPosition, displayLiftMeters, new Cartesian3());
        environmentInitialized = true;
      }
      loaded.environmentMapManager.maximumPositionEpsilon = GRAPHICS_QUALITY.modelEnvironmentPositionEpsilon;
      loaded.environmentMapManager.maximumSecondsDifference = GRAPHICS_QUALITY.modelEnvironmentTimeEpsilon;
      instance.scene.primitives.add(loaded);
      model.current = loaded;
    }).catch(() => {
      if (!destroyed) {
        loadHighQualitySkybox();
        modelStatus.current = modelLoadTransition(modelStatus.current, 'failed');
        modelCallback.current(modelStatus.current);
        leaveInspection();
      }
    });

    const hoverPosition = new Cartesian3();
    const canvas = instance.canvas;
    const normalCursor = canvas.style.cursor;
    const hover = new InspectionHover(point => {
      if (checkHoverMotion()) return null;
      const position = positionAt(instance.clock.currentTime, hoverPosition);
      const distance = position ? Cartesian3.distance(instance.camera.positionWC, position) : null;
      if (!model.current?.show || !modulePickingAvailable(modelStatus.current, distance)) return null;
      const rect = canvas.getBoundingClientRect();
      if (document.elementFromPoint(rect.left + point.x, rect.top + point.y) !== canvas) return null;
      return resolveInspectionHoverPick(instance.scene.pick(point));
    }, target => features.paintHover(target),
    interactive => { canvas.style.cursor = interactive ? 'pointer' : normalCursor; });
    // React owns selection. This ref only mirrors committed selection for native
    // eligibility checks; close/Escape reconcile the feature and ref together.
    selectionPresentation.current = selection => {
      selectedModule.current = selection;
      if (!selection) hover.pointerLeave();
      features.select(selection);
    };
    const hoverMotion = new InspectionCameraMotion();
    const hoverPose = new Float64Array(17);
    const checkHoverMotion = (): boolean => {
      if (viewMode.current !== 'ISS_INSPECTION') return false;
      const c = instance.camera, f = c.frustum as PerspectiveFrustum;
      hoverPose[0] = c.position.x; hoverPose[1] = c.position.y; hoverPose[2] = c.position.z;
      hoverPose[3] = c.direction.x; hoverPose[4] = c.direction.y; hoverPose[5] = c.direction.z;
      hoverPose[6] = c.up.x; hoverPose[7] = c.up.y; hoverPose[8] = c.up.z;
      hoverPose[9] = c.right.x; hoverPose[10] = c.right.y; hoverPose[11] = c.right.z;
      hoverPose[12] = f.fov ?? 0; hoverPose[13] = f.aspectRatio ?? 0;
      hoverPose[14] = f.xOffset ?? 0; hoverPose[15] = f.yOffset ?? 0; hoverPose[16] = f.near;
      const changed = hoverMotion.changed(hoverPose);
      if (changed) { hover.motion(); features.clearHover(); }
      return changed;
    };
    // Camera events include the continuously moving tracking transform. Local
    // pose/lens changes distinguish manipulation and inertia from normal follow.
    const removeHoverStart = instance.camera.moveStart.addEventListener(checkHoverMotion);
    const removeHoverEnd = instance.camera.moveEnd.addEventListener(checkHoverMotion);
    const removeHoverMotion = instance.scene.preRender.addEventListener(checkHoverMotion);
    let mousePointer = false;
    const pointerMove = (event: PointerEvent): void => {
      mousePointer = event.pointerType === 'mouse';
      if (!mousePointer) hover.pointerLeave();
    };
    const pointerDown = (event: PointerEvent): void => { pointerMove(event); hover.pointerDown(); features.clearHover(); };
    const pointerUp = (): void => { hover.pointerUp(); features.clearHover(); };
    const pointerLeave = (): void => hover.pointerLeave();
    const blur = (): void => { hover.pointerLeave(); hover.pointerUp(); };
    const wheelStart = (): void => { hover.motion(); features.clearHover(); };
    canvas.addEventListener('pointermove', pointerMove, true);
    canvas.addEventListener('pointerdown', pointerDown, true);
    canvas.addEventListener('pointerleave', pointerLeave);
    canvas.addEventListener('wheel', wheelStart, { capture: true, passive: true });
    globalThis.window.addEventListener('pointerup', pointerUp);
    globalThis.window.addEventListener('pointercancel', pointerUp);
    globalThis.window.addEventListener('blur', blur);
    instance.screenSpaceEventHandler.setInputAction((event: { endPosition: Cartesian2 }) => {
      if (!mousePointer) return;
      checkHoverMotion();
      hover.pointerMove(event.endPosition);
    }, ScreenSpaceEventType.MOUSE_MOVE);

    instance.screenSpaceEventHandler.setInputAction((event: { position: Cartesian2 }) => {
      const current = active.current;
      const sceneTime = instance.clock.currentTime;
      const sceneMs = JulianDate.toDate(sceneTime).getTime();
      const valid = replayRef.current ? !!replayRef.current.state : current && sceneMs >= current.orbital.startMs && sceneMs <= current.orbital.endMs;
      const position = valid ? positionAt(sceneTime, new Cartesian3()) : undefined;
      const distance = position ? Cartesian3.distance(instance.camera.positionWC, position) : null;
      const hit = instance.scene.pick(event.position);
      if (diagnostics) console.info('[graphics] pick', JSON.stringify({
        position: [event.position.x, event.position.y],
        mode: viewMode.current,
        distance: distance === null ? null : Math.round(distance),
        featureId: hit instanceof ModelFeature ? hit.featureId : null,
        moduleCode: hit instanceof ModelFeature ? hit.getProperty('moduleCode') : null,
        hit: hit instanceof ModelFeature ? 'feature' : hit ? 'other' : 'empty',
      }));
      let pick: IssPick = { kind: hit ? 'other' : 'empty' };
      if (hit instanceof ModelFeature) {
        pick = { kind: 'iss-feature', module: resolveVerifiedModulePick(hit.featureId, hit.getProperty('moduleCode')) };
      } else if (hit && typeof hit === 'object' && 'id' in hit) {
        if (hit.id === iss.current) pick = { kind: 'iss-entity' };
        else if (hit.id === ISS_MODEL.id) pick = { kind: 'iss-model' };
      }
      const action = pickAction(viewMode.current, pick, modelStatus.current === 'ready');
      if (action === 'enter-inspection') startInspection();
      else if (action === 'select-module') {
        const selection = distance !== null && modulePickingAvailable(modelStatus.current, distance) && pick.kind === 'iss-feature' ? pick.module : null;
        if (selection && hit instanceof ModelFeature) features.remember({ feature: hit, module: selection });
        selectModule(selection);
      }
      else if (action === 'clear-module') selectModule(null);
    }, ScreenSpaceEventType.LEFT_CLICK);

    const scenePosition = new Cartesian3();
    const displayPosition = new Cartesian3();
    const cameraOffset = new Cartesian3();
    const trackingFrame = new Matrix4();
    const zoomToRange = (range: number) => {
      if (viewMode.current !== 'ISS_INSPECTION') return;
      Cartesian3.clone(instance.camera.position, cameraOffset);
      const oldRange = Cartesian3.magnitude(cameraOffset);
      if (oldRange < 1e-6) return;
      Cartesian3.multiplyByScalar(cameraOffset, range / oldRange, cameraOffset);
      clampInspectionOffset(cameraOffset);
      instance.camera.lookAtTransform(instance.camera.transform, cameraOffset);
    };
    instance.screenSpaceEventHandler.setInputAction((delta: number) => {
      if (viewMode.current === 'ISS_INSPECTION') zoomToRange(inspectionZoomRange(Cartesian3.magnitude(instance.camera.position), delta));
    }, ScreenSpaceEventType.WHEEL);
    instance.screenSpaceEventHandler.setInputAction((event: unknown) => {
      const pinch = event as { distance: { startPosition: Cartesian2; endPosition: Cartesian2 } };
      if (viewMode.current === 'ISS_INSPECTION') zoomToRange(inspectionPinchRange(Cartesian3.magnitude(instance.camera.position),
        pinch.distance.startPosition.y, pinch.distance.endPosition.y));
    }, ScreenSpaceEventType.PINCH_MOVE);
    let lastDiagnosticSource: TrajectorySource | null = null;
    const tick = (): void => {
      const sceneMs = JulianDate.toDate(instance.clock.currentTime).getTime();
      let sourceChanged = false;
      if (!replayRef.current && effectiveSource(selectedSourceRef.current, comparisonRef.current, sceneMs) !== selectedSourceRef.current) {
        sourceChanged = true;
        selectedSourceRef.current = 'PRIMARY_GP_TLE';
        sourceUnavailableCallback.current('NASA OEM became unavailable at scene time; returned to MISSION1 GP/TLE.');
      }
      const current = active.current;
      const valid = replayRef.current ? !!replayRef.current.state : current !== null && sceneMs >= current.orbital.startMs && sceneMs <= current.orbital.endMs;
      let position = valid ? positionAt(instance.clock.currentTime, scenePosition) : undefined;
      if (position && !frameAt(position, trackingFrame)) position = undefined;
      if (sourceChanged && position && model.current?.ready && viewMode.current !== 'EARTH_OVERVIEW') {
        const selectedDisplay = modelDisplayPosition(position, displayLiftMeters, new Cartesian3());
        sourceRetarget = new DisplayRetarget(model.current.boundingSphere.center, selectedDisplay, performance.now());
      }
      if (sourceRetarget && performance.now() - sourceRetarget.startMs >= sourceRetarget.durationSeconds * 1000) sourceRetarget = null;
      if (sourceRetarget) sourceRetarget.evaluate(performance.now(), sourceDisplayOffset);
      else Cartesian3.clone(Cartesian3.ZERO, sourceDisplayOffset);
      Matrix4.clone(trackingFrame, cameraTrackingFrame);
      Matrix4.setTranslation(cameraTrackingFrame, Cartesian3.add(scenePosition, sourceDisplayOffset, cameraAnchor), cameraTrackingFrame);
      if (sourceChanged) leaveInspection(true);
      if (diagnostics && position && selectedSourceRef.current !== lastDiagnosticSource) {
        lastDiagnosticSource = selectedSourceRef.current;
        console.info('[trajectory-source]', JSON.stringify({ source: lastDiagnosticSource, time: JulianDate.toIso8601(instance.clock.currentTime),
          physicalPositionMeters: [position.x, position.y, position.z] }));
      }
      if (!position) {
        leaveInspection();
        selectModule(null);
      }
      if (position && viewMode.current === 'ISS_INSPECTION') {
        // Keep native user orbit/zoom in the same moving visual frame as the model.
        const frame = trackingFrame;
        Cartesian3.clone(instance.camera.position, cameraOffset);
        clampInspectionOffset(cameraOffset);
        instance.camera.lookAtTransform(frame, cameraOffset);
      }
      const flight = entry.current;
      const progress = flight ? Math.max(0, Math.min(1, (performance.now() - flight.startMs) / (flight.duration * 1000))) : null;
      // Lens, lift and outline are functions of the same perceptual path.
      const presentation = flight && progress !== null ? flight.presentationAt(progress) : null;
      if (exitPresentation) exitPresentation.progress = presentation ?? 1;
      if (flight?.kind === 'entry' && presentation !== null) {
        displayLiftMeters = EARTH_OVERVIEW_DISPLAY_LIFT_METERS * presentation;
        silhouetteVisibility = presentation;
      } else if (exitPresentation) {
        displayLiftMeters = exitPresentation.startLift + (EARTH_OVERVIEW_DISPLAY_LIFT_METERS - exitPresentation.startLift) * (presentation ?? 1);
        silhouetteVisibility = exitPresentation.startVisibility + (1 - exitPresentation.startVisibility) * (presentation ?? 1);
      } else {
        displayLiftMeters = displayLiftForMode(viewMode.current, null, null);
        silhouetteVisibility = viewMode.current === 'EARTH_OVERVIEW' ? 1 : 0;
      }
      if (exitPresentation && progress !== null && flight) {
        const tangent = flight.tangentDuration * initialTangent(progress * flight.duration / Math.max(1e-9, flight.tangentDuration));
        displayLiftMeters = Math.max(0, Math.min(EARTH_OVERVIEW_DISPLAY_LIFT_METERS, displayLiftMeters + exitPresentation.liftRate * tangent));
        silhouetteVisibility = Math.max(0, Math.min(1, silhouetteVisibility + exitPresentation.visibilityRate * tangent));
      }
      const silhouette = silhouetteOutput;
      silhouette.visibility = silhouetteVisibility;
      silhouette.sizePixels = OVERVIEW_SILHOUETTE.sizePixels * silhouetteVisibility;
      silhouette.alpha = OVERVIEW_SILHOUETTE.alpha * silhouetteVisibility;
      if (flight && progress !== null) {
        const displayedTarget = displayedPosition(scenePosition, displayLiftMeters, displayPosition);
        const pose = flight.evaluate(cameraTrackingFrame, progress, displayedTarget);
        // Automatic flights use the identity transform. Copy the public world
        // basis directly: setView's ENU/HPR conversion collapses heading/roll
        // near nadir and would bend the computed focal ray.
        Cartesian3.clone(pose.position, instance.camera.position);
        Cartesian3.clone(pose.direction, instance.camera.direction);
        Cartesian3.clone(pose.up, instance.camera.up);
        Cartesian3.normalize(Cartesian3.cross(pose.direction, pose.up, instance.camera.right), instance.camera.right);
        applyFov(pose.fov);
        if (progress === 1) {
          if (flight.kind === 'entry' && position) {
            instance.camera.lookAtTransform(trackingFrame, flight.endOffset);
            setMode('ENTRY_COMPLETE');
          } else {
            const saved = cameraSnapshot.current;
            if (saved) {
              instance.camera.frustum.near = saved.near; instance.camera.frustum.far = saved.far;
              applyFov(canonicalFov);
              instance.camera.lookAtTransform(saved.transform);
            }
            setMode('EXIT_COMPLETE');
          }
          entry.current = null;
          exitPresentation = null;
        }
      }
      const distance = position ? Cartesian3.distance(instance.camera.positionWC, position) : null;
      if (selectedModule.current && !modulePickingAvailable(modelStatus.current, distance)) selectModule(null);
      representation.current = representationForState(valid && !!position, modelStatus.current);
      if (iss.current) {
        iss.current.show = valid && !!position;
        if (position) markerPosition.setValue(position);
        const presentation = inspectionPresentation(viewMode.current);
        const shouldShowMarker = presentation.locatorVisible && markerVisible(representation.current);
        if (shouldShowMarker !== markerShown) {
          markerVisibility.setValue(shouldShowMarker);
          markerShown = shouldShowMarker;
        }
        const shouldShowLabel = presentation.locatorVisible && labelVisible(representation.current);
        if (shouldShowLabel !== labelShown) {
          labelVisibility.setValue(shouldShowLabel);
          labelShown = shouldShowLabel;
        }
      }
      if (model.current) {
        applyModelSilhouette(model.current, silhouette);
        model.current.show = (modelVisible(representation.current) || modelGraphicsWarming) && !!position;
        if (model.current.ready && position) {
          // Center the asset's off-origin bounds on the separate model display point.
          // This is a display translation, not a change to orbital position or attitude.
          // The physical selected position remains untouched. Inspection has zero lift.
          const frame = Matrix4.clone(trackingFrame, modelDisplayFrame);
          Matrix4.setTranslation(frame, displayedPosition(position, displayLiftMeters, displayPosition), frame);
          if (!displayCenteringOffset) {
            model.current.modelMatrix = frame;
            Matrix4.inverseTransformation(frame, centeringInverse);
            displayCenteringOffset = Cartesian3.negate(
              Matrix4.multiplyByPoint(centeringInverse, model.current.boundingSphere.center, new Cartesian3()), new Cartesian3());
          }
          model.current.modelMatrix = Matrix4.multiplyByTranslation(frame, displayCenteringOffset, renderedModelMatrix);
          // Public getter updates bounds before Cesium evaluates environment position.
          const bounds = model.current.boundingSphere;
          if (!environmentInitialized) {
            const manager = model.current.environmentMapManager;
            manager.maximumPositionEpsilon = 0;
            manager.position = bounds.center;
            manager.maximumPositionEpsilon = GRAPHICS_QUALITY.modelEnvironmentPositionEpsilon;
            environmentInitialized = true;
          }
        }
      }
      // Retain actual camera/presentation derivatives for C1 Back, without frame allocations.
      const wall = performance.now(), elapsed = (wall - previousWall) / 1000;
      poseQuaternion(instance.camera.directionWC, instance.camera.upWC, currentQuaternion);
      const fov = canonicalFov;
      if (entry.current) Cartesian3.clone(entry.current.focusPoint, focusPoint);
      else if (viewMode.current === 'ISS_INSPECTION') displayedPosition(scenePosition, displayLiftMeters, focusPoint);
      else {
        Cartesian3.multiplyByScalar(instance.camera.directionWC,
          Math.max(1, -Cartesian3.dot(instance.camera.positionWC, instance.camera.directionWC)), focusPoint);
        Cartesian3.add(instance.camera.positionWC, focusPoint, focusPoint);
      }
      if (previousWall && elapsed > 0) {
        Cartesian3.divideByScalar(Cartesian3.subtract(instance.camera.positionWC, previousPosition, cameraVelocity), elapsed, cameraVelocity);
        if (Quaternion.dot(currentQuaternion, previousQuaternion) < 0) Quaternion.negate(currentQuaternion, currentQuaternion);
        Quaternion.multiplyByScalar(Quaternion.subtract(currentQuaternion, previousQuaternion, quaternionRate), 1 / elapsed, quaternionRate);
        // Retain one coherent derivative of focus = camera + radius*direction.
        // Independent finite chords of that product disagree on curved motion;
        // use the same measured pose rate that Back preserves, plus radius rate.
        const focusDistance = Cartesian3.distance(focusPoint, instance.camera.positionWC);
        const radiusRate = (focusDistance - Cartesian3.distance(previousFocus, previousPosition)) / elapsed;
        Quaternion.conjugate(currentQuaternion, angularRateQuaternion);
        Quaternion.multiply(quaternionRate, angularRateQuaternion, angularRateQuaternion);
        angularVelocity.x = 2 * angularRateQuaternion.x;
        angularVelocity.y = 2 * angularRateQuaternion.y;
        angularVelocity.z = 2 * angularRateQuaternion.z;
        Cartesian3.cross(angularVelocity, instance.camera.directionWC, focusDirectionRate);
        Cartesian3.multiplyByScalar(focusDirectionRate, focusDistance, focusVelocity);
        Cartesian3.multiplyByScalar(instance.camera.directionWC, radiusRate, focusDirectionRate);
        Cartesian3.add(focusVelocity, focusDirectionRate, focusVelocity);
        Cartesian3.add(focusVelocity, cameraVelocity, focusVelocity);
        fovRate = (fov - previousFov) / elapsed;
        liftRate = (displayLiftMeters - previousLift) / elapsed;
        visibilityRate = (silhouetteVisibility - previousVisibility) / elapsed;
      }
      Cartesian3.clone(focusPoint, previousFocus);
      Cartesian3.clone(instance.camera.positionWC, previousPosition);
      Quaternion.clone(currentQuaternion, previousQuaternion);
      previousFov = fov;
      previousWall = wall;
      previousLift = displayLiftMeters; previousVisibility = silhouetteVisibility;
      const second = Math.floor(sceneMs / 1000);
      if (second !== lastReportedSecond.current) {
        lastReportedSecond.current = second;
        timeCallback.current(sceneMs);
        const geo = position && Ellipsoid.WGS84.cartesianToCartographic(position);
        positionCallback.current(geo ? { source: selectedSourceRef.current, timeMs: sceneMs,
          latitudeDegrees: CesiumMath.toDegrees(geo.latitude), longitudeDegrees: CesiumMath.toDegrees(geo.longitude),
          altitudeMeters: geo.height } : null);
      }
    };
    instance.clock.onTick.addEventListener(tick);
    presentFrame.current = tick;
    // Presentation-only toolbar bridge. Reuse the native camera operations and
    // the accepted initial Earth pose; never enter the Inspection pipeline here.
    controlsCallback.current?.({
      zoomIn: () => {
        if (viewMode.current === 'EARTH_OVERVIEW') instance.camera.zoomIn(instance.camera.positionCartographic.height * 0.2);
      },
      zoomOut: () => {
        if (viewMode.current === 'EARTH_OVERVIEW') instance.camera.zoomOut(instance.camera.positionCartographic.height * 0.2);
      },
      resetView: () => {
        const geo = active.current?.orbital.response.currentGeodetic;
        if (viewMode.current === 'EARTH_OVERVIEW' && geo)
          instance.camera.setView({ destination: Cartesian3.fromDegrees(geo.longitudeDegrees, geo.latitudeDegrees, 17_000_000) });
      },
    });
    return () => {
      controlsCallback.current?.(null);
      destroyed = true;
      disposeImagery();
      viewportObserver.disconnect();
      removeComposition();
      removePicking();
      reducedMotion.removeEventListener('change', motionChanged);
      reducedMotion.removeEventListener('change', featureMotionChanged);
      resizeWorkspace.current = null;
      cancelSkyWarmup();
      cancelGraphicsWarmup?.();
      removeDiagnostics?.();
      removeApproachDiagnostics?.();
      removeReadyListener();
      removeTrajectoryRender();
      removeStarTime();
      presentFrame.current = null;
      instance.clock.onTick.removeEventListener(tick);
      removeHoverStart(); removeHoverEnd(); removeHoverMotion();
      canvas.removeEventListener('pointermove', pointerMove, true);
      canvas.removeEventListener('pointerdown', pointerDown, true);
      canvas.removeEventListener('pointerleave', pointerLeave);
      canvas.removeEventListener('wheel', wheelStart, true);
      globalThis.window.removeEventListener('pointerup', pointerUp);
      globalThis.window.removeEventListener('pointercancel', pointerUp);
      globalThis.window.removeEventListener('blur', blur);
      hover.dispose();
      features.dispose(); selectionPresentation.current = null;
      if (model.current) instance.scene.primitives.remove(model.current);
      model.current = null;
      materialShader.destroy();
      active.current = null;
      removeTrail(pendingPrimaryLine.current);
      removeTrail(primaryLine.current);
      pendingPrimaryLine.current = null;
      primaryLine.current = null;
      oemPosition.current = null;
      oemVelocity.current = null;
      updateTrajectory.current = null;
      enterInspection.current = null;
      exitInspection.current = null;
      entry.current = null;
      selectedModule.current = null;
      iss.current = null;
      viewer.current = null;
      instance.destroy();
      globeProjection.destroy();
    };
  }, []);

  useLayoutEffect(() => { selectionPresentation.current?.(moduleSelection); }, [moduleSelection]);

  useEffect(() => { resizeWorkspace.current?.(); }, [workspace]);

  useLayoutEffect(() => {
    if (!viewer.current || !iss.current) return;
    const instance = viewer.current;
    const returning = (!!replayRef.current || held.current) && !replay && !holding;
    const enteringHold = holding && !held.current;
    held.current = holding;
    // Never install a requested time independently of its accepted data. The
    // App latch keeps the outgoing references during pending handoffs/seeks.
    if (enteringHold) instance.clock.currentTime = JulianDate.clone(instance.scene.lastRenderTime ?? instance.clock.currentTime);
    if (!holding) {
      replayRef.current = replay;
      selectedSourceRef.current = selectedSource;
      if (active.current?.orbital !== window) active.current = window ? createVisualWindow(window) : null;
      if (comparisonRef.current !== comparison) {
        comparisonRef.current = comparison;
        oemPosition.current = comparison && comparison.oem.samples.length >= 2 ? oemPositionProperty(comparison) : null;
        oemVelocity.current = comparison && comparison.oem.samples.length >= 2 ? makeVelocityProperty(comparison.oem.samples) : null;
      }
      if (replay) instance.clock.currentTime = JulianDate.fromDate(new Date(replay.atMs));
      else if (returning) instance.clock.currentTime = JulianDate.fromDate(new Date(currentAtMs ?? Date.now()));
      else if (window) {
        const estimatedNow = JulianDate.fromDate(new Date(currentAtMs ?? window.generatedMs + window.requestDurationMs / 2));
        if (!initializedClock.current || Math.abs(JulianDate.secondsDifference(estimatedNow, instance.clock.currentTime)) > 3) {
          instance.clock.currentTime = estimatedNow;
          initializedClock.current = true;
        }
      }
    }
    instance.clock.clockStep = ClockStep.SYSTEM_CLOCK_MULTIPLIER;
    instance.clock.multiplier = 1;
    instance.clock.shouldAnimate = !holding && !replay;
    // If Historical is the first usable context, its existing Earth pose is
    // already the user's view. A later Current response must not reinitialize it.
    if (replay && !holding) initializedCamera.current = true;
    if (!replay && !holding && window && !initializedCamera.current) {
      initializedCamera.current = true;
      const geo = window.response.currentGeodetic;
      instance.camera.setView({ destination: Cartesian3.fromDegrees(geo.longitudeDegrees, geo.latitudeDegrees, 17_000_000) });
    }
    lastReportedSecond.current = null;
    // Update marker/model and report the physical sample before the next paint.
    // Astronomy then uses that exact clock time in the native render pipeline.
    presentFrame.current?.();
    updateTrajectory.current?.(JulianDate.toDate(instance.clock.currentTime).getTime());
    // Complete the astronomical draw in this same layout commit; a browser
    // paint must not expose new UTC labels over the previous WebGL frame.
    instance.render();
  }, [window, comparison, selectedSource, replay?.atMs, replay?.state, !!replay, holding]);

  useEffect(() => {
    if (inspectionRequest > 0) enterInspection.current?.();
  }, [inspectionRequest]);

  useEffect(() => {
    if (overviewRequest > 0) exitInspection.current?.();
  }, [overviewRequest]);

  return <div className="earth-view" ref={container} aria-label="Interactive 3D Earth and selected ISS trajectory" />;
});
