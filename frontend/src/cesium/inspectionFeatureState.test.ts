import { Color, ColorBlendMode } from 'cesium';
import { describe, expect, it } from 'vitest';
import { ISS_MODEL } from './modelPresentation';
import { MODULE_HOVER_COLOR, type HoverTarget } from './inspectionHover';
import { InspectionFeatureState, MODULE_HOVER_EMPHASIS, moduleStateEase } from './inspectionFeatureState';

function setup() {
  let now = 0, next = 0, reduced = false, destroyed = false;
  const callbacks = new Map<number, FrameRequestCallback>();
  const model = { colorBlendMode: ColorBlendMode.REPLACE, colorBlendAmount: .123, isDestroyed: () => destroyed };
  const targets: HoverTarget[] = ISS_MODEL.semanticMappings.map(module => ({ module, feature: { color: Color.WHITE.clone() } }));
  const state = new InspectionFeatureState(() => model, () => reduced, {
    request: callback => { callbacks.set(++next, callback); return next; }, cancel: id => { callbacks.delete(id); }, now: () => now,
  });
  const advance = (ms: number) => { now += ms; const pending = [...callbacks.values()]; callbacks.clear(); pending.forEach(callback => callback(now)); };
  const select = (index: number) => { state.remember(targets[index]); state.select(targets[index].module); };
  return { state, targets, model, callbacks, advance, select, reduce: () => { reduced = true; }, destroy: () => { destroyed = true; } };
}

describe('verified module appearance adapter', () => {
  it.each(ISS_MODEL.semanticMappings)('selects and exactly restores $displayName through the same path', module => {
    const s = setup(), target = s.targets.find(t => t.module === module)!;
    target.feature.color = new Color(.2, .4, .6, .8); const original = target.feature.color.clone();
    s.state.remember(target); s.state.select(module);
    expect(target.feature.color).toEqual(MODULE_HOVER_COLOR);
    expect(s.model.colorBlendMode).toBe(ColorBlendMode.MIX); expect(s.model.colorBlendAmount).toBe(.45);
    s.state.select(null); expect(target.feature.color).toEqual(original);
    expect(s.model.colorBlendMode).toBe(ColorBlendMode.REPLACE); expect(s.model.colorBlendAmount).toBe(.123);
  });
  it('cannot paint an unverified or unbound selection', () => {
    const s = setup(); s.state.select(s.targets[0].module);
    const target = { ...s.targets[0], module: { ...s.targets[0].module, status: 'UNMAPPED' as const } };
    s.state.remember(target); s.state.select(target.module); s.state.paintHover(target);
    expect(target.feature.color).toEqual(Color.WHITE); expect(s.callbacks.size).toBe(0);
  });
  it('uses a weaker 120ms hover in/out with the exact state easing', () => {
    const s = setup(), a = s.targets[0], out = s.state.paintHover(a);
    expect(a.feature.color).toEqual(Color.WHITE); s.advance(60);
    const desired = Color.lerp(Color.WHITE, MODULE_HOVER_COLOR, MODULE_HOVER_EMPHASIS, new Color());
    expect(a.feature.color.red).toBeCloseTo((1 + desired.red) / 2, 6);
    s.advance(60); expect(a.feature.color).toEqual(desired); expect(a.feature.color).not.toEqual(MODULE_HOVER_COLOR);
    out(); s.advance(60); expect(a.feature.color).not.toEqual(Color.WHITE);
    s.advance(60); expect(a.feature.color).toEqual(Color.WHITE); expect(s.model.colorBlendMode).toBe(ColorBlendMode.REPLACE);
    expect(moduleStateEase(0)).toBe(0); expect(moduleStateEase(1)).toBe(1); expect(moduleStateEase(.5)).toBeCloseTo(.5, 6);
  });
  it('preserves selected A while B hovers, leaves and becomes selected', () => {
    const s = setup(); s.select(0); const leave = s.state.paintHover(s.targets[1]); s.advance(120);
    expect(s.targets[0].feature.color).toEqual(MODULE_HOVER_COLOR); expect(s.targets[1].feature.color).not.toEqual(MODULE_HOVER_COLOR);
    leave(); s.advance(120); expect(s.targets[1].feature.color).toEqual(Color.WHITE);
    expect(s.targets[0].feature.color).toEqual(MODULE_HOVER_COLOR);
    s.select(1); expect(s.targets[0].feature.color).toEqual(Color.WHITE); expect(s.targets[1].feature.color).toEqual(MODULE_HOVER_COLOR);
    s.state.select(null); expect(s.model.colorBlendMode).toBe(ColorBlendMode.REPLACE);
  });
  it('hovering the selected feature never overwrites persistent selection', () => {
    const s = setup(); s.select(0); const leave = s.state.paintHover(s.targets[0]); leave(); s.advance(1000);
    expect(s.targets[0].feature.color).toEqual(MODULE_HOVER_COLOR); expect(s.callbacks.size).toBe(0);
  });
  it('rapid A→B→C has only C selected and no leaked original colors', () => {
    const s = setup(); s.select(0); s.state.paintHover(s.targets[1]); s.advance(40); s.select(1); s.select(2); s.advance(1000);
    expect(s.targets.slice(0, 3).map(t => t.feature.color)).toEqual([Color.WHITE, Color.WHITE, MODULE_HOVER_COLOR]);
    s.state.select(null); expect(s.targets.every(t => t.feature.color.equals(Color.WHITE))).toBe(true);
    expect(s.model.colorBlendMode).toBe(ColorBlendMode.REPLACE); expect(s.model.colorBlendAmount).toBe(.123);
  });
  it('close cancels a pending hover fade and restores all original state', () => {
    const s = setup(); s.select(0); const out = s.state.paintHover(s.targets[1]); s.advance(120); out(); s.advance(30);
    s.state.select(null); s.advance(1000);
    expect(s.targets[0].feature.color).toEqual(Color.WHITE); expect(s.targets[1].feature.color).toEqual(Color.WHITE); expect(s.callbacks.size).toBe(0);
  });
  it('a stale hover restorer cannot overwrite a newly selected feature', () => {
    const s = setup(); const old = s.state.paintHover(s.targets[0]); s.advance(20); s.select(0); old(); s.advance(1000);
    expect(s.targets[0].feature.color).toEqual(MODULE_HOVER_COLOR); expect(s.callbacks.size).toBe(0);
  });
  it('camera manipulation clears temporary hover immediately and keeps selection', () => {
    const s = setup(); s.select(0); s.state.paintHover(s.targets[1]); s.advance(50); s.state.clearHover();
    expect(s.targets[1].feature.color).toEqual(Color.WHITE); expect(s.targets[0].feature.color).toEqual(MODULE_HOVER_COLOR);
  });
  it('reduced motion applies hover and restores it instantly', () => {
    const s = setup(); s.reduce(); s.select(0); const leave = s.state.paintHover(s.targets[1]);
    expect(s.targets[1].feature.color).not.toEqual(Color.WHITE); expect(s.callbacks.size).toBe(0); leave();
    expect(s.targets[1].feature.color).toEqual(Color.WHITE); expect(s.targets[0].feature.color).toEqual(MODULE_HOVER_COLOR);
  });
  it('a reduced preference change during fade-out does not resurrect hover', () => {
    const s = setup(); const leave = s.state.paintHover(s.targets[0]); s.advance(120); leave(); s.advance(30);
    s.reduce(); s.state.reducedMotionChanged(); s.advance(500);
    expect(s.targets[0].feature.color).toEqual(Color.WHITE); expect(s.callbacks.size).toBe(0);
  });
  it('disposal cancels callbacks and restores before the model is destroyed', () => {
    const s = setup(); s.select(0); s.state.paintHover(s.targets[1]); const pending = [...s.callbacks.values()];
    s.state.dispose(); s.destroy(); expect(() => pending.forEach(callback => callback(1000))).not.toThrow();
    expect(s.targets.every(t => t.feature.color.equals(Color.WHITE))).toBe(true); expect(s.callbacks.size).toBe(0);
  });
  it('destroyed model references are never recolored or passed to a stale restorer', () => {
    const s = setup(); s.state.paintHover(s.targets[0]); s.destroy();
    expect(() => { s.advance(120); s.state.select(null); s.state.dispose(); }).not.toThrow(); expect(s.callbacks.size).toBe(0);
  });
});
