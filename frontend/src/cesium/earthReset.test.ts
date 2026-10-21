import { readFileSync } from 'node:fs';
import { Camera, Cartesian3, Ellipsoid, GeographicProjection, JulianDate, PerspectiveFrustum, SceneMode, type Scene } from 'cesium';
import { describe, expect, it } from 'vitest';
import { EarthResetTransition, EARTH_RESET_SECONDS, EARTH_RESET_HEIGHT_METERS, earthResetTarget } from './earthReset';
import { parseComparison } from '../orbital/comparison';
import { makeSampledPosition } from './sampleProperty';

const scene = { canvas: { clientWidth: 1440, clientHeight: 900 }, drawingBufferWidth: 1440,
  drawingBufferHeight: 900, mapProjection: new GeographicProjection(), mode: SceneMode.SCENE3D } as Scene;
const pose = (longitude: number, latitude: number, height: number, cameraScene: Scene = scene) => {
  const camera = new Camera(cameraScene);
  camera.setView({ destination: Cartesian3.fromDegrees(longitude, latitude, height) });
  return { position: Cartesian3.clone(camera.positionWC), direction: Cartesian3.clone(camera.directionWC),
    up: Cartesian3.clone(camera.upWC), fov: (camera.frustum as PerspectiveFrustum).fov! };
};
const physical = Cartesian3.fromDegrees(35, 40, 420_000);
const endpoint = earthResetTarget(physical, Math.PI / 3);
const close = (a: Cartesian3, b: Cartesian3, tolerance = 1e-6) => expect(Cartesian3.distance(a, b)).toBeLessThan(tolerance);
const snapshot = (p: ReturnType<typeof pose>) => ({ ...p, position: Cartesian3.clone(p.position),
  direction: Cartesian3.clone(p.direction), up: Cartesian3.clone(p.up) });

describe('Earth Reset canonical target and rendered capture', () => {
  it.each([[35, 40], [-140, -30], [0, 90], [0, -90], [179, 0]])('matches the pre-9134 Earth setView endpoint at %s/%s', (longitude, latitude) => {
    const end = earthResetTarget(Cartesian3.fromDegrees(longitude, latitude, 420_000), Math.PI / 3);
    const native = pose(longitude, latitude, EARTH_RESET_HEIGHT_METERS);
    close(end.position, native.position); close(end.direction, native.direction, 1e-10); close(end.up, native.up, 1e-10);
    expect(end.fov).toBe(native.fov);
  });
  it('captures the exact actual pose at t=0 without mutating any input', () => {
    const actual = pose(-80, 20, 80_000_000), before = snapshot(actual), end = snapshot(endpoint);
    const flight = new EarthResetTransition(actual, endpoint, 120);
    expect(actual).toEqual(before); expect(endpoint).toEqual(end);
    expect(flight.evaluate(0)).toEqual(before);
    actual.position.x += 1000; actual.up.z += 0.1;
    expect(flight.evaluate(0)).toEqual(before);
    expect(flight.startMs).toBe(120); expect(flight.duration).toBe(2.5); expect(EARTH_RESET_SECONDS).toBe(2.5);
  });
  it('keeps an already canonical static Earth pose stable through the whole timeline', () => {
    const flight = new EarthResetTransition(endpoint, endpoint, 0);
    for (const p of [0, .1, .25, .5, .75, .9, 1]) {
      const next = flight.evaluate(p); close(next.position, endpoint.position); close(next.direction, endpoint.direction); close(next.up, endpoint.up);
    }
  });
});

describe('Earth Reset has one perceptible C2 camera journey', () => {
  const starts = {
    'far range': pose(35, 40, 200_000_000),
    'off axis': pose(-100, -25, EARTH_RESET_HEIGHT_METERS),
    'far and off axis': pose(-100, -25, 200_000_000),
    'close valid Earth pose': pose(-80, 20, 10_000),
    'antipodal Earth pose': pose(-145, -40, 1_000),
  };
  it.each(Object.entries(starts))('%s remains intermediate at 10/25/50/75/90%, reaches exact endpoint and clears Earth', (_name, start) => {
    const flight = new EarthResetTransition(start, endpoint, 0);
    let distance = Cartesian3.distance(start.position, endpoint.position);
    for (const p of [.1, .25, .5, .75, .9]) {
      const current = flight.evaluate(p), nextDistance = Cartesian3.distance(current.position, endpoint.position);
      expect(Cartesian3.distance(current.position, start.position)).toBeGreaterThan(1);
      expect(nextDistance).toBeGreaterThan(1); expect(nextDistance).toBeLessThan(distance); distance = nextDistance;
      expect(Ellipsoid.WGS84.cartesianToCartographic(current.position)!.height).toBeGreaterThan(0);
      expect(Cartesian3.magnitude(current.direction)).toBeCloseTo(1, 12);
      expect(Cartesian3.magnitude(current.up)).toBeCloseTo(1, 12);
      expect(Cartesian3.dot(current.direction, current.up)).toBeCloseTo(0, 12);
      expect(current.fov).toBe(start.fov);
    }
    const end = flight.evaluate(1); close(end.position, endpoint.position); close(end.direction, endpoint.direction); close(end.up, endpoint.up);
  });
  it.each([0, .1, .25, .5, .75, .9, 1])('uses the same eased progress for radial position, zoom and orientation at %s', p => {
    // Equatorial TEST camera geometry keeps the WGS84 surface radius constant,
    // exposing exact angular/log-clearance progress without approximating ISS data.
    const start = pose(-90, 0, 200_000_000), end = pose(0, 0, EARTH_RESET_HEIGHT_METERS);
    const current = new EarthResetTransition(start, end, 0).evaluate(p);
    const u = 6 * p ** 5 - 15 * p ** 4 + 10 * p ** 3;
    const height = Cartesian3.magnitude(current.position) - Ellipsoid.WGS84.maximumRadius;
    expect(height).toBeCloseTo(Math.exp(Math.log(200_000_000) * (1-u) + Math.log(EARTH_RESET_HEIGHT_METERS) * u), 5);
    expect(Cartesian3.angleBetween(current.position, start.position)).toBeCloseTo(Math.PI/2*u, 7);
    expect(Cartesian3.angleBetween(current.direction, start.direction)).toBeCloseTo(Math.PI/2*u, 7);
    if (p === .1) expect(height).toBeGreaterThan(190_000_000);
    if (p === .25) expect(height).toBeGreaterThan(150_000_000);
    if (p === .5) expect(height).toBeCloseTo(Math.sqrt(200_000_000*EARTH_RESET_HEIGHT_METERS), 5);
    if (p === .75) expect(height).toBeGreaterThan(21_000_000);
    if (p === .9) expect(height).toBeGreaterThan(17_300_000);
  });
  it('has soft start/stop and sub-visible numerical endpoint stabilization', () => {
    const start=starts['far and off axis'],flight=new EarthResetTransition(start,endpoint,0);
    close(flight.evaluate(.00001).position,start.position,1e-4);
    const almost=snapshot(flight.evaluate(1-1e-6)),end=flight.evaluate(1);
    close(almost.position,end.position,1e-5);close(almost.direction,end.direction,1e-8);close(almost.up,end.up,1e-8);
  });
  it('keeps Earth in the camera aim while a long angled rail unwinds a different north-up roll', () => {
    const start=pose(-100,-25,200_000_000),flight=new EarthResetTransition(start,endpoint,0);
    for(const p of [.1,.25,.5,.75,.9]){
      const current=flight.evaluate(p);
      const towardEarth=Cartesian3.negate(current.position,new Cartesian3());
      // Allow the native WGS84 geodetic-normal/radial tilt (below 0.3°),
      // while rejecting the tens-of-degrees world-residual aim excursion.
      expect(Cartesian3.angleBetween(current.direction,towardEarth)).toBeLessThan(.005);
    }
  });
  it('replaces a repeated/interrupted reset from its actual intermediate pose', () => {
    const first=new EarthResetTransition(starts['far and off axis'],endpoint,0);
    const actual=snapshot(first.evaluate(.4));const replacement=new EarthResetTransition(actual,endpoint,1000);
    expect(replacement.evaluate(0)).toEqual(actual);first.evaluate(.8);expect(replacement.evaluate(0)).toEqual(actual);
    close(replacement.evaluate(1).position,endpoint.position);
  });
  it('keeps the captured rail continuous as a moving target crosses an antipode', () => {
    const start=pose(0,0,10_000),target=pose(180,0,EARTH_RESET_HEIGHT_METERS),flight=new EarthResetTransition(start,target,0);
    const a=snapshot(flight.evaluate(.5,pose(179.99,0,EARTH_RESET_HEIGHT_METERS)));
    const b=flight.evaluate(.50001,pose(-179.99,0,EARTH_RESET_HEIGHT_METERS));
    expect(Cartesian3.distance(a.position,b.position)).toBeLessThan(10000);
    expect(Cartesian3.angleBetween(a.direction,b.direction)).toBeLessThan(.01);
  });
  it('keeps a near-canonical small-angle return orthonormal before native Camera stabilization', () => {
    const start=pose(35.02,40.01,EARTH_RESET_HEIGHT_METERS),flight=new EarthResetTransition(start,endpoint,0);
    for(const p of [.1,.25,.5,.75,.9]){
      const current=flight.evaluate(p);
      expect(Cartesian3.magnitude(current.direction)).toBeCloseTo(1,13);
      expect(Cartesian3.magnitude(current.up)).toBeCloseTo(1,13);
      expect(Cartesian3.dot(current.direction,current.up)).toBeCloseTo(0,13);
    }
  });
});

describe('Earth Reset keeps scene/source/viewport semantics', () => {
  it.each([[1440,900],[1024,768],[768,1024],[390,844],[320,568]])('preserves the existing Earth endpoint and FOV at %sx%s', (width,height) => {
    const viewportScene={ ...scene, canvas:{clientWidth:width,clientHeight:height},
      drawingBufferWidth:width,drawingBufferHeight:height } as Scene;
    const start=pose(-80,20,80_000_000,viewportScene),flight=new EarthResetTransition(start,endpoint,0);
    const native=pose(35,40,EARTH_RESET_HEIGHT_METERS,viewportScene);
    for(const p of [.1,.25,.5,.75,.9,1])expect(flight.evaluate(p).fov).toBe(start.fov);
    close(flight.evaluate(1).position,native.position);close(flight.evaluate(1).direction,native.direction);
    close(flight.evaluate(1).up,native.up);expect(flight.evaluate(1).fov).toBe(native.fov);
    expect(Ellipsoid.WGS84.cartesianToCartographic(flight.evaluate(1).position)!.height).toBeCloseTo(EARTH_RESET_HEIGHT_METERS,5);
  });
  it.each(['primary','oem'] as const)('%s targets accepted Current/Historical physical positions without changing UTC or samples', source => {
    // Real retained backend samples, deterministic TEST input only.
    const real=parseComparison(JSON.parse(readFileSync(new URL('../test/fixtures/orbital/real-comparison.json',import.meta.url),'utf8')));
    const samples=real[source].samples,original=JSON.stringify(samples),positions=makeSampledPosition(samples);
    for(const historical of [false,true]){
      const selected=JulianDate.fromIso8601(samples[1].time),utc=JulianDate.toIso8601(selected),start=pose(-80,20,80_000_000);
      const flight=new EarthResetTransition(start,earthResetTarget(positions.getValue(selected)!,start.fov),0);
      let priorTarget=Cartesian3.clone(flight.end.position);
      for(const p of [0,.1,.25,.5,.75,.9,1]){
        const time=historical?selected:JulianDate.addSeconds(selected,p*2.5,new JulianDate());
        const state=positions.getValue(time)!,target=earthResetTarget(state,start.fov),actual=flight.evaluate(p,target);
        if(historical)close(target.position,priorTarget);
        else if(p>0)expect(Cartesian3.distance(target.position,priorTarget)).toBeGreaterThan(1);
        if(p===1)close(actual.position,target.position);
        priorTarget=Cartesian3.clone(target.position);
      }
      expect(JulianDate.toIso8601(selected)).toBe(utc);
    }
    expect(JSON.stringify(samples)).toBe(original);
  });
});
