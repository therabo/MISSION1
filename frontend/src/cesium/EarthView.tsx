import { memo, useEffect, useRef } from 'react';
import {
  buildModuleUrl,
  Cartesian2,
  Cartesian3,
  Cartesian4,
  ClockRange,
  ClockStep,
  Color,
  ConstantProperty,
  EllipsoidTerrainProvider,
  ImageryLayer,
  JulianDate,
  LabelStyle,
  Matrix4,
  Model,
  NearFarScalar,
  TileMapServiceImageryProvider,
  TimeInterval,
  TimeIntervalCollection,
  Transforms,
  Viewer,
  type Entity,
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import type { OrbitalWindow } from '../orbital/types';
import { ISS_MODEL, labelVisible, markerVisible, modelLoadTransition, modelVisible, representationForDistance } from './modelPresentation';
import type { ModelLoadStatus, Representation } from './modelPresentation';
import { createVisualWindow, modelPositionAt } from './visualWindow';
import type { VisualWindow } from './visualWindow';

interface EarthViewProps {
  window: OrbitalWindow | null;
  focusRequest: number;
  overviewRequest: number;
  onSceneTime: (timeMs: number) => void;
  onSceneError: (message: string) => void;
  onModelStatus: (status: ModelLoadStatus, loadMs?: number) => void;
}

export const EarthView = memo(function EarthView({ window, focusRequest, overviewRequest, onSceneTime, onSceneError, onModelStatus }: EarthViewProps) {
  const container = useRef<HTMLDivElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const iss = useRef<Entity | null>(null);
  const active = useRef<VisualWindow | null>(null);
  const model = useRef<Model | null>(null);
  const modelStatus = useRef<ModelLoadStatus>('loading');
  const representation = useRef<Representation>('none');
  const following = useRef(false);
  const lastFollowPosition = useRef<Cartesian3 | null>(null);
  const initializedClock = useRef(false);
  const initializedCamera = useRef(false);
  const lastReportedSecond = useRef<number | null>(null);
  const timeCallback = useRef(onSceneTime);
  const errorCallback = useRef(onSceneError);
  const modelCallback = useRef(onModelStatus);
  timeCallback.current = onSceneTime;
  errorCallback.current = onSceneError;
  modelCallback.current = onModelStatus;

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

    // A primitive exposes load and runtime errors. It reads the same sampled
    // property assigned to the ISS entity; no second orbit is constructed.
    const loadStarted = performance.now();
    void Model.fromGltfAsync({
      url: ISS_MODEL.uri,
      show: false,
      scale: ISS_MODEL.physicalScale,
      minimumPixelSize: ISS_MODEL.displayMinimumPixelSize,
      maximumScale: ISS_MODEL.displayMaximumScale,
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
      }
    });

    const scenePosition = new Cartesian3();
    const tick = (): void => {
      const sceneMs = JulianDate.toDate(instance.clock.currentTime).getTime();
      const current = active.current;
      const valid = current !== null && sceneMs >= current.orbital.startMs && sceneMs <= current.orbital.endMs;
      const position = valid ? modelPositionAt(current, instance.clock.currentTime, scenePosition) : undefined;
      if (position && following.current && lastFollowPosition.current) {
        const delta = Cartesian3.subtract(position, lastFollowPosition.current, new Cartesian3());
        Cartesian3.add(instance.camera.position, delta, instance.camera.position);
        Cartesian3.clone(position, lastFollowPosition.current);
      }
      if (!valid) {
        following.current = false;
        lastFollowPosition.current = null;
        instance.scene.screenSpaceCameraController.zoomFactor = 5;
      }
      const distance = position ? Cartesian3.distance(instance.camera.positionWC, position) : null;
      representation.current = representationForDistance(valid && !!position, modelStatus.current, distance, representation.current);
      if (iss.current) {
        iss.current.show = valid && !!position;
        const shouldShowMarker = markerVisible(representation.current);
        if (shouldShowMarker !== markerShown) {
          markerVisibility.setValue(shouldShowMarker);
          markerShown = shouldShowMarker;
        }
        const shouldShowLabel = labelVisible(representation.current);
        if (shouldShowLabel !== labelShown) {
          labelVisibility.setValue(shouldShowLabel);
          labelShown = shouldShowLabel;
        }
      }
      if (model.current) {
        model.current.show = modelVisible(representation.current) && !!position;
        if (model.current.show && position) {
          // glTF asset axes use the local ENU display frame. This is not ISS attitude.
          model.current.modelMatrix = Transforms.eastNorthUpToFixedFrame(position);
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
      following.current = false;
      lastFollowPosition.current = null;
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
    if (focusRequest === 0 || !active.current || !viewer.current || !iss.current) return;
    const instance = viewer.current;
    const position = modelPositionAt(active.current, instance.clock.currentTime, new Cartesian3());
    if (!position) return;
    const outward = Cartesian3.normalize(position, new Cartesian3());
    const destination = Cartesian3.add(position, Cartesian3.multiplyByScalar(outward, 600, new Cartesian3()), new Cartesian3());
    const northColumn = Matrix4.getColumn(Transforms.eastNorthUpToFixedFrame(position), 1, new Cartesian4());
    const north = new Cartesian3(northColumn.x, northColumn.y, northColumn.z);
    instance.camera.setView({ destination, orientation: { direction: Cartesian3.negate(outward, new Cartesian3()), up: north } });
    // Keep the station clear of the status panel at both desktop and mobile sizes.
    if (globalThis.innerWidth <= 720) instance.camera.moveDown(150);
    else instance.camera.moveLeft(150);
    following.current = true;
    // Cesium's default zoom rate follows distance from Earth, which is still
    // ~400 km at the ISS and can jump straight through a close model.
    instance.scene.screenSpaceCameraController.zoomFactor = 0.0005;
    lastFollowPosition.current = Cartesian3.clone(position);
  }, [focusRequest]);

  useEffect(() => {
    if (overviewRequest === 0 || !viewer.current) return;
    following.current = false;
    lastFollowPosition.current = null;
    viewer.current.scene.screenSpaceCameraController.zoomFactor = 5;
    viewer.current.camera.flyTo({ destination: Cartesian3.fromDegrees(20, 12, 22_000_000), duration: 1.2 });
  }, [overviewRequest]);

  return <div className="earth-view" ref={container} aria-label="Interactive 3D Earth and computed ISS trajectory" />;
});
