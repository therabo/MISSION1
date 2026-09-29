import type { ModelLoadStatus, SemanticMapping } from './modelPresentation';
import { Cartesian3, Matrix4, Transforms } from 'cesium';

export type ViewMode = 'EARTH_OVERVIEW' | 'ENTERING_INSPECTION' | 'ISS_INSPECTION' | 'EXITING_INSPECTION';
export type ViewEvent = 'ENTER' | 'ENTRY_COMPLETE' | 'EXIT' | 'EXIT_COMPLETE';

export const INITIAL_VIEW_MODE: ViewMode = 'EARTH_OVERVIEW';

export function nextViewMode(mode: ViewMode, event: ViewEvent): ViewMode {
  if (event === 'ENTER' && mode === 'EARTH_OVERVIEW') return 'ENTERING_INSPECTION';
  if (event === 'ENTRY_COMPLETE' && mode === 'ENTERING_INSPECTION') return 'ISS_INSPECTION';
  if (event === 'EXIT' && (mode === 'ENTERING_INSPECTION' || mode === 'ISS_INSPECTION')) return 'EXITING_INSPECTION';
  if (event === 'EXIT_COMPLETE' && mode === 'EXITING_INSPECTION') return 'EARTH_OVERVIEW';
  return mode;
}

/** A camera navigation frame at the existing sampled position, never ISS attitude. */
export function cameraTrackingFrame(position: Cartesian3, result?: Matrix4): Matrix4 {
  return Transforms.eastNorthUpToFixedFrame(position, undefined, result);
}
export type IssPick =
  | { kind: 'iss-entity' | 'iss-model' }
  | { kind: 'iss-feature'; module: SemanticMapping | null }
  | { kind: 'other' | 'empty' };

export type PickAction = 'enter-inspection' | 'select-module' | 'clear-module' | 'none';

/** Resolve identity before camera distance; far geometry enters inspection but never names a module. */
export function pickAction(mode: ViewMode, pick: IssPick, modelReady: boolean): PickAction {
  if (mode === 'EARTH_OVERVIEW') {
    return modelReady && ['iss-entity', 'iss-model', 'iss-feature'].includes(pick.kind)
      ? 'enter-inspection' : 'none';
  }
  if (mode !== 'ISS_INSPECTION') return 'none';
  return pick.kind === 'iss-feature' && pick.module ? 'select-module' : 'clear-module';
}

export function canInspect(model: ModelLoadStatus, validBuffer: boolean): boolean {
  return model === 'ready' && validBuffer;
}

export function inspectionPresentation(mode: ViewMode): {
  pathVisible: boolean; locatorVisible: boolean; backVisible: boolean;
} {
  const overview = mode === 'EARTH_OVERVIEW' || mode === 'EXITING_INSPECTION';
  return { pathVisible: overview, locatorVisible: overview, backVisible: !overview };
}
