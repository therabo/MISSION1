// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CLOUD_SOURCE, decodeCloudImage } from './cloudSource';

function setup(width = CLOUD_SOURCE.width, height = CLOUD_SOURCE.height) {
  let image!: HTMLImageElement;
  vi.stubGlobal('Image', class {
    onload: (() => void) | null = null; onerror: (() => void) | null = null;
    src = ''; naturalWidth = width; naturalHeight = height;
    decode = vi.fn().mockResolvedValue(undefined);
    constructor() { image = this as unknown as HTMLImageElement; }
  });
  const create = vi.fn().mockReturnValue('blob:TEST_ONLY'), revoke = vi.fn();
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke });
  const abort = new AbortController();
  const promise = decodeCloudImage(new Blob(['TEST_ONLY']), abort.signal);
  return { image, abort, promise, revoke };
}
afterEach(() => vi.unstubAllGlobals());
describe('cloud decode ownership', () => {
  it('waits for full decode and checks the exact bounded image dimensions', async () => {
    const { image, promise, revoke } = setup(); image.onload!(new Event('load'));
    expect(await promise).toBe(image); expect(image.decode).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:TEST_ONLY'); expect(image.onload).toBeNull();
  });
  it('rejects a corrupt image and revokes its object URL', async () => {
    const { image, promise, revoke } = setup(); image.onerror!(new Event('error'));
    await expect(promise).rejects.toThrow('decoded'); expect(revoke).toHaveBeenCalledOnce();
  });
  it.each([[2048, 1024], [8192, 4096], [4096, 1024], [16384, 8192]])('rejects unexpected dimensions %ix%i', async (width, height) => {
    const { image, promise, revoke } = setup(width as any, height as any); image.onload!(new Event('load'));
    await expect(promise).rejects.toThrow('dimensions'); expect(revoke).toHaveBeenCalledOnce();
  });
  it('aborts decode and releases the pending URL exactly once', async () => {
    const { image, promise, abort, revoke } = setup();
    let finish!: () => void;
    (image.decode as ReturnType<typeof vi.fn>).mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
    image.onload!(new Event('load')); abort.abort(); finish();
    await expect(promise).rejects.toThrow(); expect(revoke).toHaveBeenCalledOnce(); expect(image.src).toBe('');
  });
});
