import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CloudRefresh } from './cloudRefresh';
import { CLOUD_SOURCE, type CloudImage } from './cloudSource';

const cloud = (identity: string): CloudImage => ({ identity, image: { src: `TEST_ONLY_${identity}` } as HTMLImageElement,
  acquiredAt: Date.now(), observationTime: null, etag: null, lastModified: null });
function setup() {
  const renderer = { replace: vi.fn(), show: vi.fn(), destroy: vi.fn() };
  const acquire = vi.fn<(signal: AbortSignal, previous?: string) => Promise<CloudImage | null>>().mockResolvedValue(cloud('A'));
  const owner = new CloudRefresh(renderer, acquire);
  return { renderer, acquire, owner };
}

describe('Current-only cloud refresh lifecycle', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime('2026-10-16T00:00:00Z'); });
  afterEach(() => { vi.useRealTimers(); });

  it('loads initially, revalidates identical bodies without replacement, then replaces a decoded new image', async () => {
    const { owner, renderer, acquire } = setup();
    owner.setCurrent(true); await vi.advanceTimersByTimeAsync(0);
    expect(owner.lastGood?.identity).toBe('A'); expect(renderer.replace).toHaveBeenCalledTimes(1);
    const downloaded = owner.lastGood?.acquiredAt;
    acquire.mockResolvedValueOnce(null).mockResolvedValueOnce(cloud('B'));
    await vi.advanceTimersByTimeAsync(CLOUD_SOURCE.checkMs);
    expect(acquire.mock.calls[1][1]).toBe('A'); expect(renderer.replace).toHaveBeenCalledTimes(1);
    expect(owner.lastGood?.acquiredAt).toBe(downloaded);
    await vi.advanceTimersByTimeAsync(CLOUD_SOURCE.checkMs);
    expect(owner.lastGood?.identity).toBe('B'); expect(renderer.replace).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(1); owner.destroy(); expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['request failure', 'decode failure'])('keeps last-good on %s, with bounded retry and recovery', async () => {
    const { owner, renderer, acquire } = setup();
    owner.setCurrent(true); await vi.advanceTimersByTimeAsync(0);
    acquire.mockRejectedValueOnce(new Error('TEST_ONLY failure'));
    await vi.advanceTimersByTimeAsync(CLOUD_SOURCE.checkMs);
    expect(owner.lastGood?.identity).toBe('A'); expect(renderer.show).toHaveBeenLastCalledWith(true);
    expect(renderer.replace).toHaveBeenCalledTimes(1);
    acquire.mockResolvedValueOnce(cloud('B'));
    await vi.advanceTimersByTimeAsync(CLOUD_SOURCE.retryMs - 1); expect(acquire).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1); expect(owner.lastGood?.identity).toBe('B'); owner.destroy();
  });

  it('leaves Earth cloud-free if nothing has loaded and caps repeated failure backoff', async () => {
    const { owner, renderer, acquire } = setup(); acquire.mockRejectedValue(new Error('TEST_ONLY outage'));
    owner.setCurrent(true); await vi.advanceTimersByTimeAsync(0);
    expect(owner.lastGood).toBeNull(); expect(renderer.show).toHaveBeenLastCalledWith(false);
    await vi.advanceTimersByTimeAsync(6 * CLOUD_SOURCE.maximumRetryMs);
    expect(acquire.mock.calls.length).toBeLessThan(12); expect(vi.getTimerCount()).toBe(1); owner.destroy();
  });

  it('hides immediately in Historical, ignores repeated Historical UTC renders and restores without a duplicate scheduler', async () => {
    const { owner, renderer, acquire } = setup();
    owner.setCurrent(true); await vi.advanceTimersByTimeAsync(0);
    owner.setCurrent(false); expect(renderer.show).toHaveBeenLastCalledWith(false);
    for (let seek = 0; seek < 20; seek++) owner.setCurrent(false);
    await vi.advanceTimersByTimeAsync(CLOUD_SOURCE.checkMs / 2); expect(acquire).toHaveBeenCalledTimes(1);
    owner.setCurrent(true); expect(renderer.show).toHaveBeenLastCalledWith(true);
    for (let rerender = 0; rerender < 20; rerender++) owner.setCurrent(true);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(CLOUD_SOURCE.checkMs / 2); expect(acquire).toHaveBeenCalledTimes(2);
    owner.setCurrent(false); await vi.advanceTimersByTimeAsync(CLOUD_SOURCE.checkMs * 2);
    owner.setCurrent(true); expect(renderer.show).toHaveBeenLastCalledWith(true);
    await vi.advanceTimersByTimeAsync(0); expect(acquire).toHaveBeenCalledTimes(3); owner.destroy();
  });

  it('aborts an acquisition on Historical and serializes quick return against an ignored cancellation', async () => {
    const { owner, renderer, acquire } = setup(); let finish!: (image: CloudImage) => void;
    acquire.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    owner.setCurrent(true); await vi.advanceTimersByTimeAsync(0);
    const signal = acquire.mock.calls[0][0]; owner.setCurrent(false); owner.setCurrent(true);
    expect(signal.aborted).toBe(true); expect(acquire).toHaveBeenCalledTimes(1);
    finish(cloud('CANCELLED')); await vi.advanceTimersByTimeAsync(0); await vi.advanceTimersByTimeAsync(1);
    expect(renderer.replace).toHaveBeenCalledTimes(1); expect(owner.lastGood?.identity).toBe('A');
    expect(acquire).toHaveBeenCalledTimes(2); owner.destroy();
  });

  it('times out once, retains one retry timer and prevents overlapping requests', async () => {
    const { owner, acquire } = setup();
    acquire.mockImplementationOnce(signal => new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason))));
    owner.setCurrent(true); await vi.advanceTimersByTimeAsync(CLOUD_SOURCE.timeoutMs);
    expect(acquire).toHaveBeenCalledTimes(1); expect(acquire.mock.calls[0][0].aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(CLOUD_SOURCE.retryMs); expect(acquire).toHaveBeenCalledTimes(2); owner.destroy();
  });

  it('ignores a late completion after teardown and destroys only once', async () => {
    const { owner, renderer, acquire } = setup(); let finish!: (image: CloudImage) => void;
    acquire.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    owner.setCurrent(true); await vi.advanceTimersByTimeAsync(0); owner.destroy(); owner.destroy();
    finish(cloud('LATE')); await vi.advanceTimersByTimeAsync(0); owner.setCurrent(true);
    expect(renderer.replace).not.toHaveBeenCalled(); expect(renderer.destroy).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not multiply schedules over 100 revalidation/replacement cycles and repeated mode switches', async () => {
    const { owner, acquire, renderer } = setup(); owner.setCurrent(true); await vi.advanceTimersByTimeAsync(0);
    for (let i = 0; i < 100; i++) {
      acquire.mockResolvedValueOnce(i % 2 ? null : cloud(`TEST_ONLY_${i}`));
      owner.setCurrent(false); owner.setCurrent(true); owner.setCurrent(true);
      await vi.advanceTimersByTimeAsync(CLOUD_SOURCE.checkMs);
      expect(vi.getTimerCount()).toBe(1);
    }
    expect(acquire).toHaveBeenCalledTimes(101); expect(renderer.replace).toHaveBeenCalledTimes(51);
    owner.destroy(); expect(vi.getTimerCount()).toBe(0);
  });
});
