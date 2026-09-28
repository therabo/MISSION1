import { describe, expect, it } from 'vitest';
import { adoptWindow, bufferStatus, deliveryFailure, initialDelivery } from './bufferState';
import { parseOrbitalWindow } from './sampleMapping';
import { orbitalPayload } from '../test/orbitalFixture';

describe('orbital window lifecycle', () => {
  const first = parseOrbitalWindow(orbitalPayload());

  it('starts without a fabricated position, then has inclusive active bounds', () => {
    expect(initialDelivery.window).toBeNull();
    expect(bufferStatus(null, first.generatedMs)).toBe('waiting');
    expect(bufferStatus(first, first.startMs)).toBe('active');
    expect(bufferStatus(first, first.endMs)).toBe('active');
    expect(bufferStatus(first, first.startMs - 1)).toBe('waiting');
  });

  it('expires immediately after the last known backend sample', () => {
    expect(bufferStatus(first, first.endMs + 1)).toBe('expired');
  });

  it('retains a valid buffer after refresh failure, then allows expiration', () => {
    const ready = adoptWindow(initialDelivery, first);
    const failed = deliveryFailure(ready, 'network error');
    expect(failed.status).toBe('degraded');
    expect(failed.window).toBe(first);
    expect(bufferStatus(failed.window, first.generatedMs)).toBe('active');
    expect(bufferStatus(failed.window, first.endMs + 1)).toBe('expired');
  });

  it('replaces a changed element hash as one window, never merging samples', () => {
    const payload = orbitalPayload();
    (payload.source as Record<string, unknown>).elementSha256 = 'a'.repeat(64);
    const next = parseOrbitalWindow(payload);
    const adopted = adoptWindow(adoptWindow(initialDelivery, first), next);
    expect(adopted.window).toBe(next);
    expect(adopted.window?.response.source.elementSha256).toBe('a'.repeat(64));
    expect(adopted.window?.response.samples).toHaveLength(3);
  });
});
