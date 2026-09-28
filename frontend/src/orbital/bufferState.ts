import type { OrbitalWindow } from './types';

export type DeliveryStatus = 'loading' | 'ready' | 'degraded' | 'unavailable';
export type BufferStatus = 'waiting' | 'active' | 'expired';

export interface OrbitalDelivery {
  window: OrbitalWindow | null;
  status: DeliveryStatus;
  message: string | null;
}

export const initialDelivery: OrbitalDelivery = { window: null, status: 'loading', message: null };

export function adoptWindow(previous: OrbitalDelivery, window: OrbitalWindow): OrbitalDelivery {
  // Replacement is atomic even when the element hash changes; no sample arrays are merged.
  void previous;
  return { window, status: 'ready', message: null };
}

export function deliveryFailure(previous: OrbitalDelivery, message: string): OrbitalDelivery {
  return { window: previous.window, status: previous.window ? 'degraded' : 'unavailable', message };
}

export function bufferStatus(window: OrbitalWindow | null, sceneTimeMs: number | null): BufferStatus {
  if (!window || sceneTimeMs === null || sceneTimeMs < window.startMs) return 'waiting';
  if (sceneTimeMs > window.endMs) return 'expired';
  return 'active';
}
