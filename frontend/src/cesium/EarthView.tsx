import { memo, useEffect, useRef } from 'react';
import {
  buildModuleUrl,
  Cartesian2,
  Cartesian3,
  ClockRange,
  ClockStep,
  Color,
  EllipsoidTerrainProvider,
  ImageryLayer,
  JulianDate,
  LabelStyle,
  NearFarScalar,
  TileMapServiceImageryProvider,
  TimeInterval,
  TimeIntervalCollection,
  Viewer,
  type Entity,
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import type { OrbitalWindow } from '../orbital/types';
import { makePositionProperty } from './sampleProperty';

interface EarthViewProps {
  window: OrbitalWindow | null;
  focusRequest: number;
  onSceneTime: (timeMs: number) => void;
  onSceneError: (message: string) => void;
}

export const EarthView = memo(function EarthView({ window, focusRequest, onSceneTime, onSceneError }: EarthViewProps) {
  const container = useRef<HTMLDivElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const iss = useRef<Entity | null>(null);
  const active = useRef<OrbitalWindow | null>(null);
  const initializedClock = useRef(false);
  const initializedCamera = useRef(false);
  const lastReportedSecond = useRef<number | null>(null);
  const timeCallback = useRef(onSceneTime);
  const errorCallback = useRef(onSceneError);
  timeCallback.current = onSceneTime;
  errorCallback.current = onSceneError;

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

    iss.current = instance.entities.add({
      name: 'ISS',
      show: false,
      point: {
        pixelSize: 13,
        color: Color.fromCssColorString('#e9faf9'),
        outlineColor: Color.fromCssColorString('#1ce0d1'),
        outlineWidth: 3,
        scaleByDistance: new NearFarScalar(1_000_000, 1.5, 35_000_000, 0.8),
      },
      label: {
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

    const tick = (): void => {
      const sceneMs = JulianDate.toDate(instance.clock.currentTime).getTime();
      const current = active.current;
      if (iss.current) iss.current.show = current !== null && sceneMs >= current.startMs && sceneMs <= current.endMs;
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
      active.current = null;
      iss.current = null;
      viewer.current = null;
      instance.destroy();
    };
  }, []);

  useEffect(() => {
    if (!window || !viewer.current || !iss.current) return;
    const instance = viewer.current;
    // Construct off scene and adopt one coherent source snapshot in one turn.
    const property = makePositionProperty(window);
    const start = JulianDate.fromIso8601(window.response.windowStart);
    const end = JulianDate.fromIso8601(window.response.windowEnd);
    iss.current.position = property;
    iss.current.availability = new TimeIntervalCollection([new TimeInterval({ start, stop: end })]);
    active.current = window;

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
    if (focusRequest === 0 || !window || !viewer.current) return;
    const geo = window.response.currentGeodetic;
    viewer.current.camera.flyTo({ destination: Cartesian3.fromDegrees(geo.longitudeDegrees, geo.latitudeDegrees, 7_500_000), duration: 1.2 });
  }, [focusRequest, window]);

  return <div className="earth-view" ref={container} aria-label="Interactive 3D Earth and computed ISS trajectory" />;
});
