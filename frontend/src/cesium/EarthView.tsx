import { memo, useEffect, useRef } from 'react';
import {
  buildModuleUrl,
  Cartesian2,
  Cartesian3,
  ClockRange,
  ClockStep,
  Color,
  ConstantProperty,
  Credit,
  Ellipsoid,
  EllipsoidTerrainProvider,
  ImageryLayer,
  JulianDate,
  LabelStyle,
  Matrix4,
  Model,
  ModelFeature,
  NearFarScalar,
  Math as CesiumMath,
  ScreenSpaceEventType,
  SceneTransforms,
  SingleTileImageryProvider,
  SkyBox,
  TileMapServiceImageryProvider,
  TimeInterval,
  TimeIntervalCollection,
  Transforms,
  Viewer,
  type Entity,
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import type { OrbitalWindow } from '../orbital/types';
import { ISS_MODEL, labelVisible, markerVisible, modelLoadTransition, modelVisible, modulePickingAvailable, representationForDistance, resolveVerifiedModulePick } from './modelPresentation';
import type { ModelLoadStatus, Representation, SemanticMapping } from './modelPresentation';
import { createVisualWindow, modelPositionAt } from './visualWindow';
import type { VisualWindow } from './visualWindow';
import { approachMinimumPixelSize, canInspect, cameraTrackingFrame, earthOccludes, exitMinimumPixelSize, inspectionCartesianOffset, INITIAL_VIEW_MODE, inspectionPresentation, interpolateUnitDirection, movingApproachOffset, movingApproachPathClear, nextViewMode, pickAction, radialAcquisitionPosition, rebaseApproachStartTime, smoothstep } from './inspectionMode';
import type { IssPick, ViewEvent, ViewMode } from './inspectionMode';
import { enableEarthLighting, NIGHT_LIGHTS } from './earthLighting';
import { DAY_IMAGERY, NIGHT_IMAGERY, gibsAvailable, gibsProvider } from './earthImagery';
import { GRAPHICS_QUALITY, resolutionScaleForDpr } from './graphicsQuality';
import skyboxManifest from './skyboxManifest.json';

interface EarthViewProps {
  window: OrbitalWindow | null;
  inspectionRequest: number;
  overviewRequest: number;
  onSceneTime: (timeMs: number) => void;
  onSceneError: (message: string) => void;
  onModelStatus: (status: ModelLoadStatus, loadMs?: number) => void;
  onModuleSelection: (module: SemanticMapping | null) => void;
  onViewModeChange: (mode: ViewMode) => void;
}

export const APPROACH_DURATION_SECONDS = 5;
const ACQUISITION_DURATION_SECONDS = 2.4;
const EXIT_DURATION_SECONDS = 1.2;
const MAX_INSPECTION_RANGE_METERS = 2_000;
// ENU offset: station-centered, with the camera just above its local horizon.
export const INSPECTION_OFFSET = { heading: CesiumMath.toRadians(35), pitch: CesiumMath.toRadians(-10), range: 340 };

interface CameraSnapshot { position: Cartesian3; direction: Cartesian3; up: Cartesian3 }

export const EarthView = memo(function EarthView({ window, inspectionRequest, overviewRequest, onSceneTime, onSceneError, onModelStatus, onModuleSelection, onViewModeChange }: EarthViewProps) {
  const container = useRef<HTMLDivElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const iss = useRef<Entity | null>(null);
  const active = useRef<VisualWindow | null>(null);
  const model = useRef<Model | null>(null);
  const modelStatus = useRef<ModelLoadStatus>('loading');
  const representation = useRef<Representation>('none');
  const viewMode = useRef<ViewMode>(INITIAL_VIEW_MODE);
  const cameraSnapshot = useRef<CameraSnapshot | null>(null);
  const entry = useRef<
    { stage: 'acquire'; startTime: JulianDate; startPosition: Cartesian3; startDirection: Cartesian3; startUp: Cartesian3 } |
    { stage: 'moving'; startTime: JulianDate; startOffset: Cartesian3; endOffset: Cartesian3;
      startDirection: Cartesian3; startUp: Cartesian3 } | null>(null);
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
    instance.resolutionScale = resolutionScaleForDpr(globalThis.window.devicePixelRatio);
    instance.scene.postProcessStages.fxaa.enabled = !instance.scene.msaaSupported;
    instance.scene.highDynamicRange = GRAPHICS_QUALITY.highDynamicRange && instance.scene.highDynamicRangeSupported;
    instance.scene.sunBloom = GRAPHICS_QUALITY.sunBloom;
    const diagnostics = import.meta.env.DEV && new URLSearchParams(globalThis.location.search).has('graphicsDiagnostics');
    const approachDiagnostics = import.meta.env.DEV && new URLSearchParams(globalThis.location.search).has('approachDiagnostics');
    let lastApproachLog = 0;
    const removeApproachDiagnostics = approachDiagnostics ? instance.scene.postRender.addEventListener((_scene, time) => {
      if (viewMode.current !== 'ENTERING_INSPECTION') return;
      const now = active.current;
      const target = now && modelPositionAt(now, time, new Cartesian3());
      if (!target) return;
      const wall = performance.now();
      if (wall - lastApproachLog < 400) return;
      lastApproachLog = wall;
      const camera = instance.camera;
      const aim = Cartesian3.normalize(Cartesian3.subtract(target, camera.positionWC, new Cartesian3()), new Cartesian3());
      const pixel = SceneTransforms.worldToWindowCoordinates(instance.scene, target, new Cartesian2());
      console.info('[approach]', JSON.stringify({
        phase: entry.current?.stage,
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
      console.info('[graphics] frames', JSON.stringify({ mode: viewMode.current, fps: +(frames * 1000 / elapsed).toFixed(1),
        canvas: [instance.scene.canvas.width, instance.scene.canvas.height] }));
      frames = 0;
      frameWindowStart = performance.now();
    }) : null;
    if (diagnostics) console.info('[graphics] capabilities', JSON.stringify({
      dpr: globalThis.window.devicePixelRatio,
      resolutionScale: instance.resolutionScale,
      msaaSupported: instance.scene.msaaSupported,
      msaaSamples: instance.scene.msaaSamples,
      fxaa: instance.scene.postProcessStages.fxaa.enabled,
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
    iss.current = instance.entities.add({
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
      path: {
        show: true,
        leadTime: 600,
        trailTime: 120,
        resolution: 10,
        width: 2,
        material: Color.fromCssColorString('#58d9d4').withAlpha(0.8),
      },
    });

    const selectModule = (selection: SemanticMapping | null): void => {
      if (selection === null && selectedModule.current === null) return;
      selectedModule.current = selection;
      moduleCallback.current(selection);
    };

    const setMode = (event: ViewEvent): void => {
      const next = nextViewMode(viewMode.current, event);
      if (viewMode.current === next) return;
      viewMode.current = next;
      modeCallback.current(next);
      const presentation = inspectionPresentation(next);
      if (iss.current?.path) iss.current.path.show = new ConstantProperty(presentation.pathVisible);
    };

    let exitPresentation: { startMs: number; size: number } | null = null;

    const leaveInspection = (): void => {
      if (viewMode.current === 'EARTH_OVERVIEW' || viewMode.current === 'EXITING_INSPECTION') return;
      entry.current = null;
      instance.camera.cancelFlight();
      exitPresentation = { startMs: performance.now(), size: model.current?.minimumPixelSize ?? ISS_MODEL.displayMinimumPixelSize };
      selectModule(null);
      instance.trackedEntity = undefined;
      instance.camera.lookAtTransform(Matrix4.IDENTITY);
      instance.scene.screenSpaceCameraController.enableInputs = true;
      instance.scene.screenSpaceCameraController.zoomFactor = 5;
      setMode('EXIT');
      const saved = cameraSnapshot.current;
      const destination = saved?.position ?? Cartesian3.fromDegrees(20, 12, 22_000_000);
      instance.camera.flyTo({
        destination,
        orientation: saved ? { direction: saved.direction, up: saved.up } : undefined,
        duration: EXIT_DURATION_SECONDS,
        complete: () => {
          if (destroyed) return;
          if (model.current) model.current.minimumPixelSize = ISS_MODEL.displayMinimumPixelSize;
          exitPresentation = null;
          setMode('EXIT_COMPLETE');
        },
        cancel: () => {
          if (destroyed) return;
          if (model.current) model.current.minimumPixelSize = ISS_MODEL.displayMinimumPixelSize;
          exitPresentation = null;
          setMode('EXIT_COMPLETE');
        },
      });
    };
    exitInspection.current = leaveInspection;

    const movingEntryAt = (position: Cartesian3) => {
      const inverse = Matrix4.inverseTransformation(cameraTrackingFrame(position), new Matrix4());
      return {
        stage: 'moving' as const,
        startTime: JulianDate.clone(instance.clock.currentTime),
        startOffset: Matrix4.multiplyByPoint(inverse, instance.camera.positionWC, new Cartesian3()),
        endOffset: inspectionCartesianOffset(INSPECTION_OFFSET.heading, INSPECTION_OFFSET.pitch, INSPECTION_OFFSET.range, new Cartesian3()),
        startDirection: Cartesian3.clone(instance.camera.directionWC),
        startUp: Cartesian3.clone(instance.camera.upWC),
      };
    };

    const startInspection = (): void => {
      if (viewMode.current !== 'EARTH_OVERVIEW' || !iss.current ||
          !canInspect(modelStatus.current, !!active.current)) return;
      const current = active.current!;
      const sceneMs = JulianDate.toDate(instance.clock.currentTime).getTime();
      if (sceneMs < current.orbital.startMs || sceneMs > current.orbital.endMs) return;
      const position = modelPositionAt(current, instance.clock.currentTime, new Cartesian3());
      if (!position) return;
      // No camera route can start safely from inside the globe.
      if ((Ellipsoid.WGS84.cartesianToCartographic(instance.camera.positionWC)?.height ?? -1) < 1_000) return;
      cameraSnapshot.current = {
        position: Cartesian3.clone(instance.camera.positionWC),
        direction: Cartesian3.clone(instance.camera.directionWC),
        up: Cartesian3.clone(instance.camera.upWC),
      };
      instance.camera.cancelFlight();
      instance.scene.screenSpaceCameraController.enableInputs = false;
      instance.scene.screenSpaceCameraController.zoomFactor = 0.01;
      const moving = movingEntryAt(position);
      entry.current = earthOccludes(instance.camera.positionWC, position) ||
        !movingApproachPathClear(position, moving.startOffset, moving.endOffset)
        ? {
          stage: 'acquire', startTime: JulianDate.clone(instance.clock.currentTime),
          startPosition: Cartesian3.clone(instance.camera.positionWC),
          startDirection: Cartesian3.clone(instance.camera.directionWC),
          startUp: Cartesian3.clone(instance.camera.upWC),
        }
        : moving;
      setMode('ENTER');
    };
    enterInspection.current = startInspection;

    // A primitive exposes load and runtime errors. It reads the same sampled
    // property assigned to the ISS entity; no second orbit is constructed.
    const loadStarted = performance.now();
    void Model.fromGltfAsync({
      url: `${ISS_MODEL.uri}?v=${ISS_MODEL.runtimeSha256.slice(0, 12)}`,
      show: false,
      scale: ISS_MODEL.physicalScale,
      minimumPixelSize: ISS_MODEL.displayMinimumPixelSize,
      maximumScale: ISS_MODEL.displayMaximumScale,
      enablePick: true,
      featureIdLabel: ISS_MODEL.semanticFeatureSet,
      id: ISS_MODEL.id,
      credit: ISS_MODEL.credit,
      showCreditsOnScreen: true,
      incrementallyLoadTextures: false,
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
        modelStatus.current = modelLoadTransition(modelStatus.current, 'loaded');
        if (modelStatus.current === 'ready') {
          const loadMs = performance.now() - loadStarted;
          modelCallback.current('ready', loadMs);
          if (diagnostics) console.info('[graphics] ISS textures and features ready', Math.round(loadMs), 'ms');
        }
      });
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
      const position = valid ? modelPositionAt(current, sceneTime, new Cartesian3()) : undefined;
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
    const cameraOffset = new Cartesian3();
    const trackingFrame = new Matrix4();
    const approachWorldPosition = new Cartesian3();
    const approachDirection = new Cartesian3();
    const approachUp = new Cartesian3();
    const targetDirection = new Cartesian3();
    const targetUp = new Cartesian3();
    const targetRight = new Cartesian3();
    const frameUp = new Cartesian3();
    const setCameraTowardTarget = (destination: Cartesian3, target: Cartesian3, frame: Matrix4,
      startDirection: Cartesian3, startUp: Cartesian3, aim: number): void => {
      Cartesian3.normalize(Cartesian3.subtract(target, destination, targetDirection), targetDirection);
      Matrix4.multiplyByPointAsVector(frame, Cartesian3.UNIT_Z, frameUp);
      Cartesian3.cross(targetDirection, frameUp, targetRight);
      if (Cartesian3.magnitudeSquared(targetRight) < 1e-12) {
        Matrix4.multiplyByPointAsVector(frame, Cartesian3.UNIT_Y, frameUp);
        Cartesian3.cross(targetDirection, frameUp, targetRight);
      }
      Cartesian3.normalize(targetRight, targetRight);
      Cartesian3.normalize(Cartesian3.cross(targetRight, targetDirection, targetUp), targetUp);
      interpolateUnitDirection(startDirection, targetDirection, aim, approachDirection);
      interpolateUnitDirection(startUp, targetUp, aim, approachUp);
      Cartesian3.cross(approachDirection, approachUp, targetRight);
      if (Cartesian3.magnitudeSquared(targetRight) < 1e-12) {
        Cartesian3.cross(approachDirection, frameUp, targetRight);
        if (Cartesian3.magnitudeSquared(targetRight) < 1e-12) {
          Cartesian3.cross(approachDirection, Cartesian3.mostOrthogonalAxis(approachDirection, frameUp), targetRight);
        }
      }
      Cartesian3.normalize(targetRight, targetRight);
      Cartesian3.normalize(Cartesian3.cross(targetRight, approachDirection, approachUp), approachUp);
      instance.camera.setView({ destination, orientation: { direction: approachDirection, up: approachUp } });
    };
    const tick = (): void => {
      const sceneMs = JulianDate.toDate(instance.clock.currentTime).getTime();
      const current = active.current;
      const valid = current !== null && sceneMs >= current.orbital.startMs && sceneMs <= current.orbital.endMs;
      const position = valid ? modelPositionAt(current, instance.clock.currentTime, scenePosition) : undefined;
      if (!position) {
        leaveInspection();
        selectModule(null);
      }
      if (position && viewMode.current === 'ISS_INSPECTION') {
        // Keep the camera's current local orbit while the ISS ENU frame moves.
        // A long drag can produce a globe-sized offset; keep inspection close.
        const frame = cameraTrackingFrame(position, trackingFrame);
        Cartesian3.clone(instance.camera.position, cameraOffset);
        const range = Cartesian3.magnitude(cameraOffset);
        if (range > MAX_INSPECTION_RANGE_METERS) {
          Cartesian3.multiplyByScalar(cameraOffset, MAX_INSPECTION_RANGE_METERS / range, cameraOffset);
        }
        instance.camera.lookAtTransform(frame, cameraOffset);
      }
      if (position && entry.current?.stage === 'acquire' && viewMode.current === 'ENTERING_INSPECTION') {
        const flight = entry.current;
        const progress = Math.max(0, Math.min(1, JulianDate.secondsDifference(instance.clock.currentTime, flight.startTime) / ACQUISITION_DURATION_SECONDS));
        const frame = cameraTrackingFrame(position, trackingFrame);
        radialAcquisitionPosition(flight.startPosition, position, progress, approachWorldPosition);
        setCameraTowardTarget(approachWorldPosition, position, frame, flight.startDirection, flight.startUp, smoothstep(progress));
        if (progress === 1) entry.current = movingEntryAt(position);
      }
      if (position && entry.current?.stage === 'moving' && viewMode.current === 'ENTERING_INSPECTION') {
        const flight = entry.current;
        const progress = Math.max(0, Math.min(1, JulianDate.secondsDifference(instance.clock.currentTime, flight.startTime) / APPROACH_DURATION_SECONDS));
        const frame = cameraTrackingFrame(position, trackingFrame);
        movingApproachOffset(flight.startOffset, flight.endOffset, progress, cameraOffset);
        Matrix4.multiplyByPoint(frame, cameraOffset, approachWorldPosition);
        // The target can move after entry preflight; never apply an unsafe pose.
        if ((Ellipsoid.WGS84.cartesianToCartographic(approachWorldPosition)?.height ?? -1) < 1_000 ||
            earthOccludes(approachWorldPosition, position)) {
          entry.current = {
            stage: 'acquire', startTime: JulianDate.clone(instance.clock.currentTime),
            startPosition: Cartesian3.clone(instance.camera.positionWC),
            startDirection: Cartesian3.clone(instance.camera.directionWC),
            startUp: Cartesian3.clone(instance.camera.upWC),
          };
        } else {
          // Keep the first frame's world pose, then acquire the moving target early.
          const aim = smoothstep(Math.min(1, progress / 0.18));
          setCameraTowardTarget(approachWorldPosition, position, frame, flight.startDirection, flight.startUp, aim);
          if (model.current) model.current.minimumPixelSize = approachMinimumPixelSize(ISS_MODEL.displayMinimumPixelSize, progress);
          if (progress === 1) {
            const beforePosition = Cartesian3.clone(instance.camera.positionWC);
            const beforeDirection = Cartesian3.clone(instance.camera.directionWC);
            const beforeUp = Cartesian3.clone(instance.camera.upWC);
            instance.camera.lookAtTransform(frame, flight.endOffset);
            if (approachDiagnostics) console.info('[approach-handoff]', JSON.stringify({
              positionMeters: Cartesian3.distance(beforePosition, instance.camera.positionWC),
              directionDegrees: CesiumMath.toDegrees(Cartesian3.angleBetween(beforeDirection, instance.camera.directionWC)),
              upDegrees: CesiumMath.toDegrees(Cartesian3.angleBetween(beforeUp, instance.camera.upWC)),
            }));
            entry.current = null;
            instance.scene.screenSpaceCameraController.enableInputs = true;
            setMode('ENTRY_COMPLETE');
          }
        }
      }
      if (exitPresentation && model.current) {
        model.current.minimumPixelSize = exitMinimumPixelSize(ISS_MODEL.displayMinimumPixelSize,
          exitPresentation.size, (performance.now() - exitPresentation.startMs) / (EXIT_DURATION_SECONDS * 1000));
      }
      const distance = position ? Cartesian3.distance(instance.camera.positionWC, position) : null;
      if (selectedModule.current && !modulePickingAvailable(modelStatus.current, distance)) selectModule(null);
      representation.current = representationForDistance(valid && !!position, modelStatus.current, distance, representation.current);
      if (iss.current) {
        iss.current.show = valid && !!position;
        const presentation = inspectionPresentation(viewMode.current);
        const shouldShowMarker = presentation.locatorVisible && markerVisible(representation.current) || approachDiagnostics && valid;
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
        model.current.show = modelVisible(representation.current) && !!position;
        if (model.current.show && model.current.ready && position) {
          // Center the asset's off-origin bounds on the sampled orbital point.
          // This is a display translation, not a change to orbital position or attitude.
          const frame = Transforms.eastNorthUpToFixedFrame(position);
          if (!displayCenteringOffset) {
            model.current.modelMatrix = frame;
            const inverse = Matrix4.inverseTransformation(frame, new Matrix4());
            displayCenteringOffset = Cartesian3.negate(
              Matrix4.multiplyByPoint(inverse, model.current.boundingSphere.center, new Cartesian3()),
              new Cartesian3(),
            );
          }
          model.current.modelMatrix = Matrix4.multiplyByTranslation(frame, displayCenteringOffset, new Matrix4());
        }
      }
      const second = Math.floor(sceneMs / 1000);
      if (second !== lastReportedSecond.current) {
        lastReportedSecond.current = second;
        timeCallback.current(sceneMs);
      }
    };
    instance.clock.onTick.addEventListener(tick);
    return () => {
      destroyed = true;
      removeDiagnostics?.();
      removeApproachDiagnostics?.();
      instance.clock.onTick.removeEventListener(tick);
      if (model.current) instance.scene.primitives.remove(model.current);
      model.current = null;
      active.current = null;
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
    const start = JulianDate.fromIso8601(window.response.windowStart);
    const end = JulianDate.fromIso8601(window.response.windowEnd);
    iss.current.position = visualWindow.position;
    iss.current.availability = new TimeIntervalCollection([new TimeInterval({ start, stop: end })]);
    active.current = visualWindow;

    const estimatedNow = JulianDate.addSeconds(
      JulianDate.fromIso8601(window.response.generatedAt), window.requestDurationMs / 2000, new JulianDate());
    if (!initializedClock.current || Math.abs(JulianDate.secondsDifference(estimatedNow, instance.clock.currentTime)) > 3) {
      // A refreshed backend window may realign scene time. Preserve the elapsed
      // camera animation while both camera and model use the new scene instant.
      if (entry.current) rebaseApproachStartTime(entry.current.startTime, instance.clock.currentTime, estimatedNow);
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
    if (inspectionRequest > 0) enterInspection.current?.();
  }, [inspectionRequest]);

  useEffect(() => {
    if (overviewRequest > 0) exitInspection.current?.();
  }, [overviewRequest]);

  return <div className="earth-view" ref={container} aria-label="Interactive 3D Earth and computed ISS trajectory" />;
});
