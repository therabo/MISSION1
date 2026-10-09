import { Color, type Model } from 'cesium';
import type { SemanticMapping } from './modelPresentation';
import { MODULE_HOVER_COLOR, paintInspectionHover, type HoverTarget } from './inspectionHover';

type HighlightModel = Pick<Model, 'colorBlendMode' | 'colorBlendAmount'> & { isDestroyed?: () => boolean };
interface Frames { request: (callback: FrameRequestCallback) => number; cancel: (id: number) => void; now: () => number }
interface HoverPaint { target: HoverTarget; original: Color; desired: Color; restore: () => void; frame: number | null; restoring: boolean }

export const MODULE_HOVER_MOTION_MS = 120;
export const MODULE_HOVER_EMPHASIS = 0.35;

/** Exact M07 state easing, cubic-bezier(.42, 0, .58, 1), for material color only. */
export function moduleStateEase(progress: number): number {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++) {
    const t = (lo + hi) / 2, x = 3 * (1 - t) ** 2 * t * .42 + 3 * (1 - t) * t * t * .58 + t ** 3;
    if (x < progress) lo = t; else hi = t;
  }
  const t = (lo + hi) / 2;
  return 3 * (1 - t) * t * t + t ** 3;
}

/** Presentation adapter to App's selection. The existing resolver supplies every
 * target. Selected color is the approved MIX tint; hover is a weaker transient
 * use of the same feature-color mechanism. Restorers unwind hover before selection.
 */
export class InspectionFeatureState {
  private targets = new Map<string, HoverTarget>();
  private selected: HoverTarget | null = null;
  private selectedRestore: (() => void) | null = null;
  private hover: HoverPaint | null = null;
  private disposed = false;

  constructor(private readonly model: () => HighlightModel | null, private readonly reduced: () => boolean,
    private readonly frames: Frames = { request: callback => requestAnimationFrame(callback), cancel: id => cancelAnimationFrame(id), now: () => performance.now() }) {}

  remember(target: HoverTarget): void {
    if (!this.disposed && target.module.status === 'VERIFIED') this.targets.set(target.module.componentId, target);
  }

  select(module: SemanticMapping | null): void {
    if (this.disposed) return;
    const next = module ? this.targets.get(module.componentId) ?? null : null;
    if (next === this.selected && module !== null) return;
    this.clearHover();
    this.selectedRestore?.(); this.selectedRestore = null; this.selected = null;
    const model = this.model();
    if (!next || !model || model.isDestroyed?.()) return;
    const restore = paintInspectionHover(model, next);
    this.selected = next;
    this.selectedRestore = () => { if (!model.isDestroyed?.()) restore(); };
  }

  paintHover(target: HoverTarget): () => void {
    if (this.disposed) return () => {};
    this.remember(target); this.clearHover();
    if (target.module.componentId === this.selected?.module.componentId) return () => {};
    const model = this.model();
    if (!model || model.isDestroyed?.() || target.module.status !== 'VERIFIED') return () => {};
    const original = Color.clone(target.feature.color);
    const desired = Color.lerp(original, MODULE_HOVER_COLOR, MODULE_HOVER_EMPHASIS, new Color());
    const restore = paintInspectionHover(model, target);
    const paint: HoverPaint = { target, original, desired, frame: null, restoring: false, restore: () => { if (!model.isDestroyed?.()) restore(); } };
    this.hover = paint;
    target.feature.color = original;
    this.animate(paint, desired);
    return () => { if (this.hover === paint) this.animate(paint, original, true); };
  }

  /** Camera manipulation, replacement and close cancel transient color at once. */
  clearHover(): void {
    const paint = this.hover;
    if (!paint) return;
    this.hover = null;
    if (paint.frame !== null) this.frames.cancel(paint.frame);
    paint.restore();
  }

  reducedMotionChanged(): void {
    if (this.reduced() && this.hover) this.animate(this.hover, this.hover.restoring ? this.hover.original : this.hover.desired, this.hover.restoring);
  }

  private animate(paint: HoverPaint, destination: Color, restoring = false): void {
    if (paint.frame !== null) this.frames.cancel(paint.frame);
    paint.frame = null;
    paint.restoring = restoring;
    if (this.reduced()) {
      if (restoring) this.clearHover(); else paint.target.feature.color = destination;
      return;
    }
    const from = Color.clone(paint.target.feature.color), start = this.frames.now();
    const frame = (at: number) => {
      if (this.disposed || this.hover !== paint) return;
      const model = this.model();
      if (!model || model.isDestroyed?.()) { this.clearHover(); return; }
      const progress = Math.min(1, Math.max(0, (at - start) / MODULE_HOVER_MOTION_MS));
      paint.target.feature.color = Color.lerp(from, destination, moduleStateEase(progress), new Color());
      if (progress < 1) paint.frame = this.frames.request(frame);
      else { paint.frame = null; if (restoring) this.clearHover(); }
    };
    paint.frame = this.frames.request(frame);
  }

  dispose(): void {
    this.clearHover(); this.selectedRestore?.(); this.selectedRestore = null;
    this.selected = null; this.targets.clear(); this.disposed = true;
  }
}
