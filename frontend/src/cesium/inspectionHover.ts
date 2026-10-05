import { Cartesian2, Color, ColorBlendMode, ModelFeature, type Model } from 'cesium';
import type { ViewMode } from './inspectionMode';
import { resolveVerifiedModulePick, type SemanticMapping } from './modelPresentation';

export const HOVER_SETTLE_MS = 200;
export const MODULE_HOVER_COLOR = Color.fromCssColorString('#53d9cd');
export const MODULE_HOVER_BLEND = 0.45;

export interface HoverTarget {
  feature: Pick<ModelFeature, 'color'>;
  module: SemanticMapping;
}

/** Click and hover share the pinned feature ID + moduleCode resolver. */
export function resolveInspectionHoverPick(hit: unknown): HoverTarget | null {
  if (!(hit instanceof ModelFeature)) return null;
  const module = resolveVerifiedModulePick(hit.featureId, hit.getProperty('moduleCode'));
  return module ? { feature: hit, module } : null;
}

/** Imperative affordance only: no selection, telemetry, or React updates. */
export class InspectionHover {
  private mode: ViewMode = 'EARTH_OVERVIEW';
  private pointer: Cartesian2 | null = null;
  private held = false;
  private moving = true;
  private disposed = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private target: HoverTarget | null = null;
  private restore: (() => void) | null = null;

  constructor(private readonly pick: (point: Cartesian2) => HoverTarget | null,
    private readonly paint: (target: HoverTarget) => () => void,
    private readonly cursor: (interactive: boolean) => void) {}

  setMode(mode: ViewMode): void {
    this.mode = mode;
    this.motion();
  }

  pointerMove(point: Cartesian2): void {
    if (this.disposed || (this.pointer && Cartesian2.equals(this.pointer, point))) return;
    this.pointer = Cartesian2.clone(point, this.pointer ?? new Cartesian2());
    this.evaluate();
  }

  pointerLeave(): void { this.pointer = null; this.clear(); }
  pointerDown(): void { this.held = true; this.motion(); }
  pointerUp(): void { this.held = false; this.motion(); }

  /** Also used by wheel and camera events, including movement without a drag. */
  motion(): void {
    if (this.disposed) return;
    this.moving = true;
    this.clear();
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    if (this.mode !== 'ISS_INSPECTION' || this.held) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.moving = false;
      this.evaluate(); // Re-pick current projection; never reuse the old target.
    }, HOVER_SETTLE_MS);
  }

  private evaluate(): void {
    if (this.disposed || this.mode !== 'ISS_INSPECTION' || this.moving || this.held || !this.pointer) return;
    const next = this.pick(this.pointer);
    if (next?.module.componentId === this.target?.module.componentId) return;
    this.clear();
    if (next) {
      this.target = next;
      this.restore = this.paint(next);
      this.cursor(true);
    }
  }

  private clear(): void {
    this.restore?.();
    this.restore = null;
    this.target = null;
    this.cursor(false);
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.clear();
  }
}

/** White features bypass MIX in Cesium 1.145; only this feature is tinted.
 * Preserve the exact previous color and model blend policy, even on teardown.
 */
export function paintInspectionHover(model: Pick<Model, 'colorBlendMode' | 'colorBlendAmount'>,
  target: HoverTarget): () => void {
  const color = Color.clone(target.feature.color);
  const mode = model.colorBlendMode, amount = model.colorBlendAmount;
  model.colorBlendMode = ColorBlendMode.MIX;
  model.colorBlendAmount = MODULE_HOVER_BLEND;
  target.feature.color = MODULE_HOVER_COLOR;
  return () => {
    target.feature.color = color;
    model.colorBlendMode = mode;
    model.colorBlendAmount = amount;
  };
}

/** Reused public local-pose/lens snapshot. Tracking-frame translation is not
 * manipulation: it moves camera and station together without changing the view.
 * Callers may sample per render, but must never pick from that render callback.
 */
export class InspectionCameraMotion {
  private previous = new Float64Array(17);
  private initialized = false;

  changed(values: Float64Array): boolean {
    let changed = !this.initialized;
    for (let i = 0; i < values.length; i++) {
      const tolerance = i < 3 ? 1e-7 : 1e-10;
      if (Math.abs(values[i] - this.previous[i]) > tolerance) changed = true;
      this.previous[i] = values[i];
    }
    this.initialized = true;
    return changed;
  }
}
