import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Cartesian2, Color, ColorBlendMode, ModelFeature } from 'cesium';
import { ISS_MODEL } from './modelPresentation';
import { HOVER_SETTLE_MS, InspectionCameraMotion, InspectionHover, MODULE_HOVER_COLOR, paintInspectionHover, resolveInspectionHoverPick, type HoverTarget } from './inspectionHover';

const target = (index: number): HoverTarget => ({ feature: { color: Color.WHITE.clone() }, module: ISS_MODEL.semanticMappings[index] });
function setup() {
  const a = target(0), b = target(1);
  const model = { colorBlendMode: ColorBlendMode.HIGHLIGHT, colorBlendAmount: 0.5 };
  const pick = vi.fn<(point: Cartesian2) => HoverTarget | null>().mockReturnValue(a);
  const cursor = vi.fn();
  const hover = new InspectionHover(pick, hit => paintInspectionHover(model, hit), cursor);
  const stable = () => { hover.setMode('ISS_INSPECTION'); vi.advanceTimersByTime(HOVER_SETTLE_MS); };
  return { hover, a, b, model, pick, cursor, stable };
}

describe('Inspection hover lifecycle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('allows hover only after stable Inspection, never during either transition', () => {
    const s = setup(); s.hover.pointerMove(new Cartesian2(10, 20));
    for (const mode of ['EARTH_OVERVIEW', 'ENTERING_INSPECTION', 'EXITING_INSPECTION'] as const) {
      s.hover.setMode(mode); vi.advanceTimersByTime(1000); expect(s.pick).not.toHaveBeenCalled();
    }
    s.hover.setMode('ISS_INSPECTION'); vi.advanceTimersByTime(HOVER_SETTLE_MS - 1); expect(s.pick).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); expect(s.pick).toHaveBeenCalledOnce(); expect(s.a.feature.color).toEqual(MODULE_HOVER_COLOR);
  });

  it('restores A before painting B and restores B on empty or unmapped geometry', () => {
    const s = setup(); s.stable(); s.hover.pointerMove(new Cartesian2(10, 20));
    s.pick.mockReturnValue(s.b); s.hover.pointerMove(new Cartesian2(11, 20));
    expect(s.a.feature.color).toEqual(Color.WHITE); expect(s.b.feature.color).toEqual(MODULE_HOVER_COLOR);
    s.pick.mockReturnValue(null); s.hover.pointerMove(new Cartesian2(12, 20));
    expect(s.b.feature.color).toEqual(Color.WHITE); expect(s.cursor).toHaveBeenLastCalledWith(false);
    expect(s.model.colorBlendMode).toBe(ColorBlendMode.HIGHLIGHT);
  });

  it('clears immediately on motion and re-picks instead of restoring the old feature', () => {
    const s = setup(); s.stable(); s.hover.pointerMove(new Cartesian2(10, 20));
    s.hover.motion(); expect(s.a.feature.color).toEqual(Color.WHITE);
    s.pick.mockReturnValue(s.b); s.hover.pointerMove(new Cartesian2(11, 20));
    expect(s.pick).toHaveBeenCalledOnce(); vi.advanceTimersByTime(HOVER_SETTLE_MS);
    expect(s.pick).toHaveBeenCalledTimes(2); expect(s.pick).toHaveBeenLastCalledWith(new Cartesian2(11, 20));
    expect(s.a.feature.color).toEqual(Color.WHITE); expect(s.b.feature.color).toEqual(MODULE_HOVER_COLOR);
  });

  it('suppresses pointer-down, held drag and inertia until motion stops', () => {
    const s = setup(); s.stable(); s.hover.pointerMove(new Cartesian2(10, 20));
    s.hover.pointerDown(); vi.advanceTimersByTime(1000); expect(s.a.feature.color).toEqual(Color.WHITE);
    expect(s.pick).toHaveBeenCalledOnce(); s.hover.pointerUp();
    for (let i = 0; i < 10; i++) { vi.advanceTimersByTime(100); s.hover.motion(); }
    expect(s.pick).toHaveBeenCalledOnce(); vi.advanceTimersByTime(HOVER_SETTLE_MS);
    expect(s.pick).toHaveBeenCalledTimes(2);
  });

  it('suppresses wheel bursts and resumes with one stationary-pointer re-pick', () => {
    const s = setup(); s.stable(); s.hover.pointerMove(new Cartesian2(10, 20));
    for (let i = 0; i < 5; i++) { s.hover.motion(); vi.advanceTimersByTime(50); }
    expect(s.a.feature.color).toEqual(Color.WHITE); expect(s.pick).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(HOVER_SETTLE_MS); expect(s.pick).toHaveBeenCalledTimes(2);
  });

  it('does zero stationary work and skips duplicate coordinates', () => {
    const s = setup(); s.stable(); s.hover.pointerMove(new Cartesian2(10, 20));
    for (let i = 0; i < 100; i++) s.hover.pointerMove(new Cartesian2(10, 20));
    vi.advanceTimersByTime(10_000); expect(s.pick).toHaveBeenCalledOnce();
  });

  it('clears on leave, exit, and disposal, cancelling pending re-picks', () => {
    const s = setup(); s.stable(); s.hover.pointerMove(new Cartesian2(10, 20));
    s.hover.pointerLeave(); expect(s.a.feature.color).toEqual(Color.WHITE);
    s.hover.pointerMove(new Cartesian2(10, 20)); s.hover.setMode('EXITING_INSPECTION');
    expect(s.a.feature.color).toEqual(Color.WHITE); vi.advanceTimersByTime(1000);
    expect(s.pick).toHaveBeenCalledTimes(2);
    s.stable(); s.hover.dispose(); vi.advanceTimersByTime(1000);
    expect(s.a.feature.color).toEqual(Color.WHITE); expect(s.cursor).toHaveBeenLastCalledWith(false);
  });

  it('restores exact pre-existing feature color and blend settings', () => {
    const a = target(0); a.feature.color = Color.BLUE.clone();
    const model = { colorBlendMode: ColorBlendMode.REPLACE, colorBlendAmount: 0.123 };
    const restore = paintInspectionHover(model, a); restore();
    expect(a.feature.color).toEqual(Color.BLUE); expect(model).toEqual({ colorBlendMode: ColorBlendMode.REPLACE, colorBlendAmount: 0.123 });
  });
});

describe('shared feature identity', () => {
  it.each(ISS_MODEL.semanticMappings)('recognizes and restores $displayName without changing its ID', module => {
    const feature = Object.create(ModelFeature.prototype);
    Object.defineProperties(feature, { featureId: { value: module.featureId }, color: { value: Color.WHITE.clone(), writable: true },
      getProperty: { value: (name: string) => name === 'moduleCode' ? module.moduleCode : undefined } });
    const hit = resolveInspectionHoverPick(feature); expect(hit?.module).toBe(module);
    const restore = paintInspectionHover({ colorBlendMode: ColorBlendMode.HIGHLIGHT, colorBlendAmount: 0.5 }, hit!);
    expect(feature.color).toEqual(MODULE_HOVER_COLOR); restore(); expect(feature.color).toEqual(Color.WHITE);
  });

  it('rejects plain model hits, mismatched metadata and unknown features', () => {
    expect(resolveInspectionHoverPick({ featureId: 0, getProperty: () => 1 })).toBeNull();
    for (const [featureId, moduleCode] of [[0, 2], [99, 100]]) {
      const feature = Object.create(ModelFeature.prototype);
      Object.defineProperties(feature, { featureId: { value: featureId }, getProperty: { value: () => moduleCode } });
      expect(resolveInspectionHoverPick(feature)).toBeNull();
    }
    expect(resolveInspectionHoverPick(undefined)).toBeNull();
  });
});

it('detects local translation, orbit, zoom and lens changes without tracking-world coordinates', () => {
  const motion = new InspectionCameraMotion(), pose = new Float64Array(17);
  pose[0] = -90; pose[3] = 1; pose[12] = 1.745;
  expect(motion.changed(pose)).toBe(true); expect(motion.changed(pose)).toBe(false);
  pose[0] += 1e-9; expect(motion.changed(pose)).toBe(false);
  for (const index of [0, 4, 8, 12, 14, 15]) { pose[index] += 0.1; expect(motion.changed(pose)).toBe(true); }
});
