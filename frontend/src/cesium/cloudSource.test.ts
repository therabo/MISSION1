import { afterEach, describe, expect, it, vi } from 'vitest';
import { acquireCloudImage, CLOUD_SOURCE } from './cloudSource';

const signal = () => new AbortController().signal;
const image = {} as HTMLImageElement;
const body = (data = 'TEST_ONLY_CLOUD_A', headers = {}) => new Response(data, {
  headers: { 'content-type': 'image/jpeg', ...headers },
});
afterEach(() => vi.restoreAllMocks());

describe('bounded processed cloud acquisition', () => {
  it('decodes a successful new body, preserves provenance and lets the browser revalidate', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(body());
    const decode = vi.fn().mockResolvedValue(image), abort = signal();
    const result = await acquireCloudImage(abort, undefined, decode);
    expect(result).toMatchObject({ image, observationTime: null, etag: null, lastModified: null });
    expect(result?.identity).toMatch(/^[0-9a-f]{64}$/);
    expect(fetch).toHaveBeenCalledWith(CLOUD_SOURCE.url, expect.objectContaining({ signal: abort,
      cache: 'no-cache', mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' }));
  });

  it('does not decode the same bytes even if ETag is hidden or changed', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(body()).mockResolvedValueOnce(body());
    const decode = vi.fn().mockResolvedValue(image);
    const first = await acquireCloudImage(signal(), undefined, decode);
    expect(await acquireCloudImage(signal(), first!.identity, decode)).toBeNull();
    expect(decode).toHaveBeenCalledTimes(1);
  });

  it('fully decodes a different body before returning a replacement', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(body()).mockResolvedValueOnce(body('TEST_ONLY_B'));
    const decode = vi.fn().mockResolvedValue(image);
    const first = await acquireCloudImage(signal(), undefined, decode);
    const next = await acquireCloudImage(signal(), first!.identity, decode);
    expect(next!.identity).not.toBe(first!.identity); expect(decode).toHaveBeenCalledTimes(2);
  });

  it.each([new Response('TEST_ONLY', { status: 503 }), body('', { 'content-type': 'text/html' }),
    body(''), body('TEST_ONLY', { 'content-length': String(CLOUD_SOURCE.maximumBytes + 1) }),
    body('X'.repeat(CLOUD_SOURCE.maximumBytes + 1))])('rejects unavailable, malformed, empty and oversized bodies', async response => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
    const decode = vi.fn(); await expect(acquireCloudImage(signal(), undefined, decode)).rejects.toThrow();
    expect(decode).not.toHaveBeenCalled();
  });

  it('rejects decode failures without accepting a new identity', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(body());
    await expect(acquireCloudImage(signal(), 'LAST_GOOD', vi.fn().mockRejectedValue(new Error('TEST_ONLY decode')))).rejects.toThrow('decode');
  });

  it('ignores late responses after cancellation', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(body());
    const abort = new AbortController(); abort.abort(); const decode = vi.fn();
    await expect(acquireCloudImage(abort.signal, undefined, decode)).rejects.toThrow();
    expect(decode).not.toHaveBeenCalled();
  });
});
