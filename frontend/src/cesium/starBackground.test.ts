import { describe, expect, it } from 'vitest';
import { CubeMapPanorama, JulianDate, Matrix3, Transforms } from 'cesium';
import { starBackgroundFactory, updateStarBackground } from './starBackground';

const faces = (prefix: string) => Object.fromEntries(
  ['positiveX', 'negativeX', 'positiveY', 'negativeY', 'positiveZ', 'negativeZ'].map(key => [key, `${prefix}/${key}.png`]),
);
const epoch = () => JulianDate.fromIso8601('2026-10-07T08:00:00Z');
const orientation = (box: ReturnType<ReturnType<typeof starBackgroundFactory>>) => (box as CubeMapPanorama).transform;
const nativeAt = (time: JulianDate) => Transforms.computeTemeToPseudoFixedMatrix(time, new Matrix3());

describe('stars follow coherent scene UTC, independently of UI mode', () => {
  it('preserves native TEME orientation without mutating the supplied epoch', () => {
    const at = epoch(), before = JulianDate.clone(at), box = starBackgroundFactory(() => at)(faces('bundled'));
    updateStarBackground(box, at);
    expect(orientation(box)).toEqual(nativeAt(at)); expect(at).toEqual(before); box.destroy();
  });
  it('has the same orientation for the same Current/Historical UTC and changes for another UTC', () => {
    const at = epoch(), box = starBackgroundFactory(() => at)(faces('bundled')), initial = Matrix3.clone(orientation(box));
    updateStarBackground(box, JulianDate.clone(at)); expect(orientation(box)).toEqual(initial);
    const historical = JulianDate.addSeconds(at, -86400 * 36 - 600, new JulianDate());
    updateStarBackground(box, historical); expect(orientation(box)).toEqual(nativeAt(historical));
    expect(orientation(box)).not.toEqual(initial);
    updateStarBackground(box, at); expect(orientation(box)).toEqual(initial); box.destroy();
  });
  it('uses the same time and unchanged source objects for bundled and NASA textures', () => {
    const at = epoch(), make = starBackgroundFactory(() => at), bundled = faces('bundled'), nasa = faces('NASA-test-only');
    const a = make(bundled), b = make(nasa), time = JulianDate.addSeconds(at, -600, new JulianDate());
    updateStarBackground(a, time); updateStarBackground(b, time);
    expect(a.sources).toBe(bundled); expect(b.sources).toBe(nasa);
    expect(orientation(a)).toEqual(orientation(b)); expect(orientation(a)).not.toBe(orientation(b)); a.destroy(); b.destroy();
  });
  it('does not accumulate drift over repeated backward/forward seeks', () => {
    const at = epoch(), box = starBackgroundFactory(() => at)(faces('bundled')), matrix = orientation(box);
    for (let i = 0; i < 100; i++) {
      const time = JulianDate.addSeconds(at, i % 2 ? 1800 : -600, new JulianDate());
      updateStarBackground(box, time); expect(orientation(box)).toBe(matrix); expect(matrix).toEqual(nativeAt(time));
    }
    updateStarBackground(box, at); expect(matrix).toEqual(nativeAt(at)); box.destroy();
  });
  it('keeps independent Viewers tied to their own scene time', () => {
    const a = starBackgroundFactory(epoch)(faces('bundled')), b = starBackgroundFactory(epoch)(faces('bundled'));
    updateStarBackground(b, JulianDate.addSeconds(epoch(), 1800, new JulianDate()));
    expect(orientation(a)).not.toEqual(orientation(b)); a.destroy(); b.destroy();
  });
  it('loads a later NASA cubemap at the current coherent UTC rather than its Viewer creation UTC', () => {
    let at = epoch(); const make = starBackgroundFactory(() => at), bundled = make(faces('bundled'));
    at = JulianDate.addSeconds(at, -600, new JulianDate()); updateStarBackground(bundled, at);
    const nasa = make(faces('NASA-test-only')); expect(orientation(nasa)).toEqual(orientation(bundled));
    expect(orientation(nasa)).toEqual(nativeAt(at)); bundled.destroy(); nasa.destroy();
  });
  it('retains native visibility and deterministic disposal', () => {
    const box = starBackgroundFactory(epoch)(faces('bundled'));
    expect(box.show).toBe(true); box.show = false; expect(box.show).toBe(false);
    expect(box.isDestroyed()).toBe(false); box.destroy(); expect(box.isDestroyed()).toBe(true);
  });
  it.each([1, 2, 10])('Current sky evolves after %s seconds of actual scene time', seconds => {
    const at = epoch(), box = starBackgroundFactory(() => at)(faces('bundled')), initial = Matrix3.clone(orientation(box));
    const next = JulianDate.addSeconds(at, seconds, new JulianDate()); updateStarBackground(box, next);
    expect(orientation(box)).toEqual(nativeAt(next)); expect(orientation(box)).not.toEqual(initial); box.destroy();
  });
  it.each([-600, 600])('Historical step %s s matches native rotation and its temporal direction', seconds => {
    const at = epoch(), box = starBackgroundFactory(() => at)(faces('bundled')), initial = Matrix3.clone(orientation(box));
    const next = JulianDate.addSeconds(at, seconds, new JulianDate()); updateStarBackground(box, next);
    const relative = Matrix3.multiply(Matrix3.transpose(initial, new Matrix3()), orientation(box), new Matrix3());
    const angle = Math.atan2(relative[1], relative[0]);
    // TEME -> Earth fixed rotates oppositely to increasing UTC.
    expect(Math.sign(angle)).toBe(-Math.sign(seconds)); expect(Math.abs(angle)).toBeCloseTo(0.0437527, 5);
    expect(orientation(box)).toEqual(nativeAt(next)); box.destroy();
  });
  it('ignores UI-only updates at an unchanged scene instant', () => {
    const at = epoch(), box = starBackgroundFactory(() => at)(faces('bundled')), initial = Matrix3.clone(orientation(box));
    for (let i = 0; i < 40; i++) { updateStarBackground(box, at); expect(orientation(box)).toEqual(initial); }
    box.destroy();
  });
});
