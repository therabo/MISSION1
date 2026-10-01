import { memo, useEffect, useRef } from 'react';
import {
  buildModuleUrl,
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
  ImageryLayer,
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
  SingleTileImageryProvider,
  SkyBox,
  TileMapServiceImageryProvider,
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
import { InspectionTransition, poseQuaternion, initialTangent } from './inspectionTransition';
import type { CameraPose } from './inspectionTransition';
import type { IssPick, ViewEvent, ViewMode } from './inspectionMode';
import { enableEarthLighting, NIGHT_LIGHTS } from './earthLighting';
import { DAY_IMAGERY, NIGHT_IMAGERY, gibsAvailable, gibsProvider } from './earthImagery';
import { GRAPHICS_QUALITY, resolutionScaleForDpr } from './graphicsQuality';
import { createIssMaterialShader } from './issMaterialQuality';
import { warmInspectionRendering } from './inspectionRenderingWarmup';
import { inspectionAntialiasing } from './inspectionAntialiasing';
import skyboxManifest from './skyboxManifest.json';
import { adaptTrailClearance, createTrajectoryTrails, orderTrails, showTrails, updateClearanceMask, updateTrail } from './trajectoryRendering';
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
import { desiredGapCssPixels, projectedModelFootprint, TRAIL_CLEARANCE } from './trajectoryClearance';

interface EarthViewProps {
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
  onViewModeChange: (mode: ViewMode) => void;
}

export const APPROACH_DURATION_SECONDS = 6;
export const EXIT_DURATION_SECONDS = 5;
interface CameraSnapshot extends CameraPose { near: number; far: number; transform: Matrix4 }

export const EarthView = memo(function EarthView({ window, comparison, selectedSource, onSourceUnavailable, onPosition, inspectionRequest, overviewRequest, onSceneTime, onSceneError, onModelStatus, onModuleSelection, onViewModeChange }: EarthViewProps) {
  const container = useRef<HTMLDivElement>(null);
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
  selectedSourceRef.current = selectedSource;
  sourceUnavailableCallback.current = onSourceUnavailable;
  positionCallback.current = onPosition;
  const positionAt = (time: JulianDate, result: Cartesian3): Cartesian3 | undefined =>
    selectedPositionAt(selectedSourceRef.current, active.current, oemPosition.current, time, result);
  const velocityAt = (time: JulianDate, result: Cartesian3): Cartesian3 | undefined =>
    (selectedSourceRef.current === 'NASA_OEM' ? oemVelocity.current : active.current?.velocity)?.getValue(time, result);
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
  timeCallback.current = onSceneTime;
  errorCallback.current = onSceneError;
  modelCallback.current = onModelStatus;
  moduleCallback.current = onModuleSelection;
  modeCallback.current = onViewModeChange;

  useEffect(() => {
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
      });
    } catch {
      errorCallback.current('3D Earth could not start. Check browser WebGL support.');
      return;
    }
    viewer.current = instance;
    const applyControls = inspectionControlProfile(instance.scene.screenSpaceCameraController);
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
    instance.scene.backgroundColor = Color.fromCssColorString('#040b14');
    if (instance.scene.sun) {
      instance.scene.sun.show = true;
      instance.scene.sun.glowFactor = GRAPHICS_QUALITY.sunGlowFactor;
    }
    if (instance.scene.skyBox) instance.scene.skyBox.show = true;
    instance.camera.setView({ destination: Cartesian3.fromDegrees(20, 12, 22_000_000) });
    instance.clock.clockRange = ClockRange.UNBOUNDED;
    instance.clock.clockStep = ClockStep.SYSTEM_CLOCK_MULTIPLIER;
    instance.clock.multiplier = 1;
    instance.clock.shouldAnimate = true;

    // Keep Natural Earth II beneath NASA tiles, so a failed or slow request
    // cannot leave a blank globe. The local night image is the outage fallback.
    const loadLocalNightLights = (): void => {
      void SingleTileImageryProvider.fromUrl(NIGHT_LIGHTS.url, {
        credit: 'Earth night-lights fallback: NASA Black Marble, 2016',
      }).then((provider) => {
        if (destroyed) return;
        const layer = new ImageryLayer(provider, {
          dayAlpha: NIGHT_LIGHTS.dayAlpha,
          nightAlpha: NIGHT_LIGHTS.nightAlpha,
          brightness: 1.8,
        });
        instance.imageryLayers.add(layer);
      }).catch(() => {
        if (!destroyed) errorCallback.current('Earth night-lights imagery is unavailable.');
      });
    };
    void (async () => {
      try {
        const provider = await TileMapServiceImageryProvider.fromUrl(buildModuleUrl('Assets/Textures/NaturalEarthII'));
        if (destroyed) return;
        instance.imageryLayers.add(new ImageryLayer(provider));
      } catch {
        if (!destroyed) errorCallback.current('Local Earth imagery is unavailable.');
      }
      const probeStarted = performance.now();
      const [dayAvailable, nightAvailable] = await Promise.all([
        gibsAvailable(DAY_IMAGERY), gibsAvailable(NIGHT_IMAGERY),
      ]);
      if (destroyed) return;
      if (diagnostics) console.info('[graphics] GIBS probes', JSON.stringify({dayAvailable, nightAvailable,
        elapsedMs: Math.round(performance.now() - probeStarted)}));
      if (dayAvailable) {
        const provider = gibsProvider(DAY_IMAGERY);
        const layer = new ImageryLayer(provider);
        // The omitted maximumAnisotropy uses Cesium's highest supported value.
        instance.imageryLayers.add(layer);
        provider.errorEvent.addEventListener(() => {
          if (!destroyed && instance.imageryLayers.contains(layer)) instance.imageryLayers.remove(layer);
        });
      }
      if (nightAvailable) {
        const provider = gibsProvider(NIGHT_IMAGERY);
        const layer = new ImageryLayer(provider, {
          dayAlpha: NIGHT_IMAGERY.dayAlpha,
          nightAlpha: NIGHT_IMAGERY.nightAlpha,
          brightness: 1.8,
        });
        instance.imageryLayers.add(layer);
        provider.errorEvent.addEventListener(() => {
          if (destroyed || !instance.imageryLayers.contains(layer)) return;
          instance.imageryLayers.remove(layer);
          loadLocalNightLights();
        });
      } else {
        loadLocalNightLights();
      }
    })();

    // Decode every face before replacing the bundled skybox. Cesium uses
    // TEME axes; the NASA map is a historical celestial visualization.
    if (instance.scene.maximumCubeMapSize >= skyboxManifest.faceSize) {
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
        instance.scene.skyBox = new SkyBox({ sources: Object.fromEntries(keys.map((key, index) => [key, images[index]])) as {
          positiveX: HTMLImageElement; negativeX: HTMLImageElement; positiveY: HTMLImageElement;
          negativeY: HTMLImageElement; positiveZ: HTMLImageElement; negativeZ: HTMLImageElement;
        } });
        instance.creditDisplay.addStaticCredit(new Credit('<a href="https://svs.gsfc.nasa.gov/3572" target="_blank" rel="noopener noreferrer">Star map: NASA GSFC SVS Tycho II</a>'));
        if (diagnostics) console.info('[graphics] skybox decoded', Math.round(performance.now() - skyboxStarted), 'ms');
        if (oldSkyBox) instance.scene.postRender.addEventListener(function releaseOldSkyBox() {
          instance.scene.postRender.removeEventListener(releaseOldSkyBox);
          if (!oldSkyBox.isDestroyed()) oldSkyBox.destroy();
        });
      }).catch(() => { /* Bundled Cesium stars remain visible. */ });
    }

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
    const styleTrails = (group: TrajectoryTrails, sceneMs: number): void => {
      // Native globe depth remains; no world-space offsets or depth overrides.
      for (const trail of group.trails) updateTrail(trail, sceneMs, selectedSourceRef.current);
    };
    let orderedSource: TrajectorySource | null = null;
    let lastClearanceUpdate = -Infinity;
    let clearanceSource: TrajectorySource | null = null;
    let clearanceGeneration: number | null = null;
    const removeReadyListener = instance.scene.preRender.addEventListener(() => {
      const pending = pendingPrimaryLine.current;
      if (!pending || !pending.trails.every((trail) => trail.layers.every((layer) => layer.primitive.ready))) return;
      removeTrail(primaryLine.current);
      primaryLine.current = pending;
      pendingPrimaryLine.current = null;
      orderTrails(pending, selectedSourceRef.current, instance.scene.primitives);
      orderedSource = selectedSourceRef.current;
      showTrails(pending, viewMode.current === 'EARTH_OVERVIEW');
    });
    updateTrajectory.current = (sceneMs: number) => {
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
      // A lightweight projected mask follows every frame so halo fragments stay
      // clear during camera movement. Search the bounded source paths at 10 Hz.
      const wall = performance.now();
      if (viewMode.current === 'EARTH_OVERVIEW' && model.current?.ready) {
        const hull = projectedModelFootprint(instance.scene, model.current);
        const physical = positionAt(instance.clock.currentTime, new Cartesian3());
        const displayed = physical && modelDisplayPosition(physical, displayLiftMeters, new Cartesian3());
        const gap = displayed ? desiredGapCssPixels(Cartesian3.distance(instance.camera.positionWC, displayed)) : TRAIL_CLEARANCE.maximumCssPixels;
        const searchDue = wall - lastClearanceUpdate >= TRAIL_CLEARANCE.updateIntervalMs ||
          clearanceSource !== selectedSourceRef.current || clearanceGeneration !== generatedMs;
        for (const group of [primaryLine.current, pendingPrimaryLine.current]) {
          if (group) for (const trail of group.trails) {
            if (searchDue) adaptTrailClearance(trail, sceneMs, instance.scene, hull, gap, model.current.silhouetteSize);
            else updateClearanceMask(trail, instance.scene, hull, gap, model.current.silhouetteSize);
          }
        }
        if (searchDue) {
          lastClearanceUpdate = wall;
          clearanceSource = selectedSourceRef.current;
          clearanceGeneration = generatedMs;
        }
      }
      if (primaryLine.current) {
        styleTrails(primaryLine.current, sceneMs);
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
      applyControls(next);
      modeCallback.current(next);
      const presentation = inspectionPresentation(next);
      if (primaryLine.current) showTrails(primaryLine.current, presentation.pathVisible);
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
    const quaternionRate = new Quaternion(0, 0, 0, 0);
    let fovRate = 0, previousFov = 0;
    let previousWall = 0, previousLift = displayLiftMeters, previousVisibility = silhouetteVisibility;
    let liftRate = 0, visibilityRate = 0;
    const capturePose = (): CameraPose => ({ position: Cartesian3.clone(instance.camera.positionWC),
      direction: Cartesian3.clone(instance.camera.directionWC), up: Cartesian3.clone(instance.camera.upWC),
      fov: instance.camera.frustum instanceof PerspectiveFrustum ? (instance.camera.frustum.fov ?? Math.PI / 3) : Math.PI / 3 });
    const cameraView = { destination: new Cartesian3(), orientation: { direction: new Cartesian3(), up: new Cartesian3() } };

    const leaveInspection = (retarget = false): void => {
      if (viewMode.current === 'EARTH_OVERVIEW' || (viewMode.current === 'EXITING_INSPECTION' && !retarget)) return;
      const saved = cameraSnapshot.current;
      if (!saved) return;
      const pose = capturePose();
      instance.camera.cancelFlight();
      const flight = new InspectionTransition('exit', pose, cameraTrackingFrame, saved.position, saved.fov,
        EXIT_DURATION_SECONDS, performance.now(), saved,
        displayedPosition(scenePosition, displayLiftMeters, new Cartesian3()));
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
            displayedPosition(scenePosition, displayLiftMeters, new Cartesian3()), previousQuaternion);
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
      if (viewMode.current !== 'EARTH_OVERVIEW' || !iss.current || !canInspect(modelStatus.current, !!active.current)) return;
      const current = active.current!;
      const sceneMs = JulianDate.toDate(instance.clock.currentTime).getTime();
      if (sceneMs < current.orbital.startMs || sceneMs > current.orbital.endMs) return;
      const position = positionAt(instance.clock.currentTime, new Cartesian3());
      if (!position || !frameAt(position, trackingFrame)) return;
      if ((Ellipsoid.WGS84.cartesianToCartographic(instance.camera.positionWC)?.height ?? -1) < 1_000) return;
      sourceRetarget = null;
      Cartesian3.clone(Cartesian3.ZERO, sourceDisplayOffset);
      Matrix4.clone(trackingFrame, cameraTrackingFrame);
      const pose = capturePose();
      cameraSnapshot.current = { ...pose, near: instance.camera.frustum.near, far: instance.camera.frustum.far,
        transform: Matrix4.clone(instance.camera.transform) };
      instance.camera.cancelFlight();
      instance.camera.lookAtTransform(Matrix4.IDENTITY);
      entry.current = new InspectionTransition('entry', pose, trackingFrame,
        rearInspectionOffset(instance.scene.canvas.clientWidth / instance.scene.canvas.clientHeight, new Cartesian3()),
        CesiumMath.toRadians(100), APPROACH_DURATION_SECONDS, performance.now(), null,
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
      showCreditsOnScreen: true,
      incrementallyLoadTextures: false,
      customShader: materialShader,
    }).then((loaded) => {
      if (destroyed) {
        loaded.destroy();
        return;
      }
      loaded.errorEvent.addEventListener(() => {
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
        cancelGraphicsWarmup = warmInspectionRendering(instance, () => {
          cancelGraphicsWarmup = null;
          if (destroyed || modelStatus.current === 'failed') return;
          modelStatus.current = modelLoadTransition(modelStatus.current, 'loaded');
          if (modelStatus.current === 'ready') {
            const loadMs = performance.now() - loadStarted;
            modelCallback.current('ready', loadMs);
            if (diagnostics) console.info('[graphics] ISS textures, features and rendering ready', Math.round(loadMs), 'ms');
          }
        });
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
        modelStatus.current = modelLoadTransition(modelStatus.current, 'failed');
        modelCallback.current(modelStatus.current);
        leaveInspection();
      }
    });

    instance.screenSpaceEventHandler.setInputAction((event: { position: Cartesian2 }) => {
      const current = active.current;
      const sceneTime = instance.clock.currentTime;
      const sceneMs = JulianDate.toDate(sceneTime).getTime();
      const valid = current && sceneMs >= current.orbital.startMs && sceneMs <= current.orbital.endMs;
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
      else if (action === 'select-module') selectModule(distance !== null && modulePickingAvailable(modelStatus.current, distance) && pick.kind === 'iss-feature' ? pick.module : null);
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
      if (effectiveSource(selectedSourceRef.current, comparisonRef.current, sceneMs) !== selectedSourceRef.current) {
        sourceChanged = true;
        selectedSourceRef.current = 'PRIMARY_GP_TLE';
        sourceUnavailableCallback.current('NASA OEM became unavailable at scene time; returned to MISSION1 GP/TLE.');
      }
      const current = active.current;
      const valid = current !== null && sceneMs >= current.orbital.startMs && sceneMs <= current.orbital.endMs;
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
        Cartesian3.clone(pose.position, cameraView.destination);
        Cartesian3.clone(pose.direction, cameraView.orientation.direction);
        Cartesian3.clone(pose.up, cameraView.orientation.up);
        instance.camera.setView(cameraView);
        if (instance.camera.frustum instanceof PerspectiveFrustum) instance.camera.frustum.fov = pose.fov;
        if (progress === 1) {
          if (flight.kind === 'entry' && position) {
            instance.camera.lookAtTransform(trackingFrame, flight.endOffset);
            setMode('ENTRY_COMPLETE');
          } else {
            const saved = cameraSnapshot.current;
            if (saved) {
              instance.camera.frustum.near = saved.near; instance.camera.frustum.far = saved.far;
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
        model.current.show = modelVisible(representation.current) && !!position;
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
      const fov = instance.camera.frustum instanceof PerspectiveFrustum ? (instance.camera.frustum.fov ?? Math.PI / 3) : Math.PI / 3;
      if (previousWall && elapsed > 0) {
        Cartesian3.divideByScalar(Cartesian3.subtract(instance.camera.positionWC, previousPosition, cameraVelocity), elapsed, cameraVelocity);
        if (Quaternion.dot(currentQuaternion, previousQuaternion) < 0) Quaternion.negate(currentQuaternion, currentQuaternion);
        Quaternion.multiplyByScalar(Quaternion.subtract(currentQuaternion, previousQuaternion, quaternionRate), 1 / elapsed, quaternionRate);
        fovRate = (fov - previousFov) / elapsed;
        liftRate = (displayLiftMeters - previousLift) / elapsed;
        visibilityRate = (silhouetteVisibility - previousVisibility) / elapsed;
      }
      Cartesian3.clone(instance.camera.positionWC, previousPosition);
      Quaternion.clone(currentQuaternion, previousQuaternion);
      previousFov = fov;
      previousWall = wall;
      previousLift = displayLiftMeters; previousVisibility = silhouetteVisibility;
      updateTrajectory.current?.(sceneMs);
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
    return () => {
      destroyed = true;
      cancelGraphicsWarmup?.();
      removeDiagnostics?.();
      removeApproachDiagnostics?.();
      removeReadyListener();
      instance.clock.onTick.removeEventListener(tick);
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
    };
  }, []);

  useEffect(() => {
    if (!window || !viewer.current || !iss.current) return;
    const instance = viewer.current;
    // Construct off scene and adopt one coherent source snapshot in one turn.
    const visualWindow = createVisualWindow(window);

    active.current = visualWindow;

    const estimatedNow = JulianDate.addSeconds(
      JulianDate.fromIso8601(window.response.generatedAt), window.requestDurationMs / 2000, new JulianDate());
    if (!initializedClock.current || Math.abs(JulianDate.secondsDifference(estimatedNow, instance.clock.currentTime)) > 3) {
      // A refreshed backend window may realign scene time. Preserve the elapsed
      // camera animation while both camera and model use the new scene instant.
      instance.clock.currentTime = estimatedNow;
      initializedClock.current = true;
    }
    const sceneMs = JulianDate.toDate(instance.clock.currentTime).getTime();
    iss.current.show = sceneMs >= window.startMs && sceneMs <= window.endMs;
    if (!initializedCamera.current) {
      initializedCamera.current = true;
      const geo = window.response.currentGeodetic;
      instance.camera.setView({ destination: Cartesian3.fromDegrees(geo.longitudeDegrees, geo.latitudeDegrees, 17_000_000) });
    }
  }, [window]);

  useEffect(() => {
    comparisonRef.current = comparison;
    oemPosition.current = comparison && comparison.oem.samples.length >= 2 ? oemPositionProperty(comparison) : null;
    oemVelocity.current = comparison && comparison.oem.samples.length >= 2 ? makeVelocityProperty(comparison.oem.samples) : null;
    if (viewer.current) updateTrajectory.current?.(JulianDate.toDate(viewer.current.clock.currentTime).getTime());
  }, [comparison]);

  useEffect(() => {
    // Emit new physical coordinates on the next frame after an immediate source change.
    lastReportedSecond.current = null;
  }, [selectedSource]);

  useEffect(() => {
    if (inspectionRequest > 0) enterInspection.current?.();
  }, [inspectionRequest]);

  useEffect(() => {
    if (overviewRequest > 0) exitInspection.current?.();
  }, [overviewRequest]);

  return <div className="earth-view" ref={container} aria-label="Interactive 3D Earth and selected ISS trajectory" />;
});
