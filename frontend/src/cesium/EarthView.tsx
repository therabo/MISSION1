import { memo, useEffect, useRef } from 'react';
import {
  buildModuleUrl,
  Cartesian2,
  Cartesian3,
  ClockRange,
  ClockStep,
  Color,
  ConstantProperty,
  EllipsoidTerrainProvider,
  ImageryLayer,
  HeadingPitchRange,
  JulianDate,
  LabelStyle,
  Matrix4,
  Model,
  ModelFeature,
  NearFarScalar,
  Math as CesiumMath,
  ScreenSpaceEventType,
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
import { canInspect, cameraTrackingFrame, INITIAL_VIEW_MODE, inspectionPresentation, nextViewMode, pickAction } from './inspectionMode';
import type { IssPick, ViewEvent, ViewMode } from './inspectionMode';

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

const ENTRY_DURATION_MS = 1600;
const EXIT_DURATION_SECONDS = 1.2;
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
  const entry = useRef<{ startMs: number; heading: number; pitch: number; range: number } | null>(null);
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
      });
    } catch {
      errorCallback.current('3D Earth could not start. Check browser WebGL support.');
      return;
    }
    viewer.current = instance;
    instance.scene.globe.baseColor = Color.fromCssColorString('#18394a');
    instance.scene.backgroundColor = Color.fromCssColorString('#040b14');
    if (instance.scene.sun) instance.scene.sun.show = true;
    if (instance.scene.skyBox) instance.scene.skyBox.show = true;
    instance.camera.setView({ destination: Cartesian3.fromDegrees(20, 12, 22_000_000) });
    instance.clock.clockRange = ClockRange.UNBOUNDED;
    instance.clock.clockStep = ClockStep.SYSTEM_CLOCK_MULTIPLIER;
    instance.clock.multiplier = 1;
    instance.clock.shouldAnimate = true;

    // The bundled Natural Earth II tiles are local, token-free, and usable offline.
    void TileMapServiceImageryProvider.fromUrl(buildModuleUrl('Assets/Textures/NaturalEarthII'))
      .then((provider) => {
        if (!destroyed) instance.imageryLayers.add(new ImageryLayer(provider));
      })
      .catch(() => {
        if (!destroyed) errorCallback.current('Earth imagery is unavailable; the ellipsoid remains usable.');
      });

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

    const leaveInspection = (): void => {
      if (viewMode.current === 'EARTH_OVERVIEW' || viewMode.current === 'EXITING_INSPECTION') return;
      entry.current = null;
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
        complete: () => { if (!destroyed) setMode('EXIT_COMPLETE'); },
        cancel: () => { if (!destroyed) setMode('EXIT_COMPLETE'); },
      });
    };
    exitInspection.current = leaveInspection;

    const startInspection = (): void => {
      if (viewMode.current !== 'EARTH_OVERVIEW' || !iss.current ||
          !canInspect(modelStatus.current, !!active.current)) return;
      const current = active.current!;
      const sceneMs = JulianDate.toDate(instance.clock.currentTime).getTime();
      if (sceneMs < current.orbital.startMs || sceneMs > current.orbital.endMs) return;
      const position = modelPositionAt(current, instance.clock.currentTime, new Cartesian3());
      if (!position) return;
      cameraSnapshot.current = {
        position: Cartesian3.clone(instance.camera.positionWC),
        direction: Cartesian3.clone(instance.camera.directionWC),
        up: Cartesian3.clone(instance.camera.upWC),
      };
      const inverse = Matrix4.inverseTransformation(cameraTrackingFrame(position), new Matrix4());
      const local = Matrix4.multiplyByPoint(inverse, instance.camera.positionWC, new Cartesian3());
      entry.current = {
        startMs: performance.now(),
        heading: Math.atan2(local.x, local.y),
        pitch: Math.atan2(local.z, Math.hypot(local.x, local.y)),
        range: Cartesian3.magnitude(local),
      };
      instance.camera.cancelFlight();
      instance.scene.screenSpaceCameraController.enableInputs = false;
      instance.scene.screenSpaceCameraController.zoomFactor = 0.01;
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
        modelStatus.current = modelLoadTransition(modelStatus.current, 'loaded');
        if (modelStatus.current === 'ready') modelCallback.current('ready', performance.now() - loadStarted);
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
        // The camera's local offset changes with user orbit/zoom input. Move only
        // its ENU origin to the new sample position; never restore entry HPR.
        Cartesian3.clone(instance.camera.position, cameraOffset);
        instance.camera.lookAtTransform(cameraTrackingFrame(position), cameraOffset);
      }
      if (position && entry.current && iss.current) {
        const flight = entry.current;
        const progress = Math.min(1, (performance.now() - flight.startMs) / ENTRY_DURATION_MS);
        const eased = progress * progress * (3 - 2 * progress);
        const headingDifference = Math.atan2(Math.sin(INSPECTION_OFFSET.heading - flight.heading), Math.cos(INSPECTION_OFFSET.heading - flight.heading));
        const heading = flight.heading + headingDifference * eased;
        const pitch = flight.pitch + (INSPECTION_OFFSET.pitch - flight.pitch) * eased;
        const range = Math.exp(Math.log(flight.range) * (1 - eased) + Math.log(INSPECTION_OFFSET.range) * eased);
        instance.camera.lookAt(position, new HeadingPitchRange(heading, pitch, range));
        if (progress === 1) {
          entry.current = null;
          instance.scene.screenSpaceCameraController.enableInputs = true;
          setMode('ENTRY_COMPLETE');
        }
      }
      const distance = position ? Cartesian3.distance(instance.camera.positionWC, position) : null;
      if (selectedModule.current && !modulePickingAvailable(modelStatus.current, distance)) selectModule(null);
      representation.current = representationForDistance(valid && !!position, modelStatus.current, distance, representation.current);
      if (iss.current) {
        iss.current.show = valid && !!position;
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
