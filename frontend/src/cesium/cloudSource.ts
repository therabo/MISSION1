/** Processed visual imagery, not a time-resolved meteorological observation. */
export const CLOUD_SOURCE = {
  url: 'https://clouds.matteason.co.uk/images/2048x1024/clouds.jpg',
  width: 2048,
  height: 1024,
  maximumBytes: 2 * 1024 * 1024,
  timeoutMs: 15_000,
  checkMs: 30 * 60_000,
  retryMs: 5 * 60_000,
  maximumRetryMs: 60 * 60_000,
} as const;

export interface CloudImage {
  image: HTMLImageElement;
  identity: string;
  acquiredAt: number;
  observationTime: null;
  lastModified: string | null;
  etag: string | null;
}

/** Abort also covers decode. Object URLs never survive success, error or teardown. */
export function decodeCloudImage(blob: Blob, signal: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const image = new Image();
    const url = URL.createObjectURL(blob);
    let finished = false;
    const finish = (error?: unknown): void => {
      if (finished) return;
      finished = true;
      image.onload = null; image.onerror = null;
      signal.removeEventListener('abort', aborted);
      URL.revokeObjectURL(url);
      if (error) { image.src = ''; reject(error); }
      else resolve(image);
    };
    const aborted = () => finish(signal.reason ?? new Error('Cloud decode aborted'));
    signal.addEventListener('abort', aborted, { once: true });
    image.onerror = () => finish(new Error('Cloud image could not be decoded'));
    image.onload = () => {
      void image.decode().then(() => {
        if (image.naturalWidth !== CLOUD_SOURCE.width || image.naturalHeight !== CLOUD_SOURCE.height)
          finish(new Error('Unexpected cloud image dimensions'));
        else finish();
      }).catch(finish);
    };
    image.src = url;
  });
}

/** Browser cache owns conditional headers (ETag is not necessarily CORS-exposed).
 * Content hashing avoids decode/upload even if a revalidated body is unchanged. */
export async function acquireCloudImage(
  signal: AbortSignal,
  previousIdentity?: string,
  decode = decodeCloudImage,
): Promise<CloudImage | null> {
  const response = await fetch(CLOUD_SOURCE.url, {
    mode: 'cors', cache: 'no-cache', credentials: 'omit', referrerPolicy: 'no-referrer', signal,
  });
  if (!response.ok || !(response.headers.get('content-type') ?? '').startsWith('image/jpeg')) {
    await response.body?.cancel().catch(() => {});
    throw new Error('Cloud source unavailable');
  }
  const length = Number(response.headers.get('content-length'));
  if (length > CLOUD_SOURCE.maximumBytes) {
    await response.body?.cancel().catch(() => {});
    throw new Error('Cloud image exceeds size limit');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Cloud response has no image');
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > CLOUD_SOURCE.maximumBytes) throw new Error('Cloud image exceeds size limit');
      chunks.push(new Uint8Array(value));
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally { reader.releaseLock(); }
  signal.throwIfAborted();
  if (!bytes) throw new Error('Empty cloud image');
  const blob = new Blob(chunks, { type: 'image/jpeg' });
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  const identity = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  signal.throwIfAborted();
  if (identity === previousIdentity) return null;
  const image = await decode(blob, signal);
  signal.throwIfAborted();
  return { image, identity, acquiredAt: Date.now(), observationTime: null,
    lastModified: response.headers.get('last-modified'), etag: response.headers.get('etag') };
}
