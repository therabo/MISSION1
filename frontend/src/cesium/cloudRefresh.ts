import { acquireCloudImage, CLOUD_SOURCE, type CloudImage } from './cloudSource';

export interface CloudRenderer {
  replace(image: HTMLImageElement): void;
  show(visible: boolean): void;
  destroy(): void;
}

/** A Current-only serial refresh owner. Historical UTC is intentionally no input. */
export class CloudRefresh {
  private current = false;
  private disposed = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private request: AbortController | undefined;
  private dueAt = 0;
  private failures = 0;
  lastGood: CloudImage | null = null;
  checkedAt: number | null = null;

  constructor(private renderer: CloudRenderer, private acquire = acquireCloudImage) {}

  setCurrent(current: boolean): void {
    if (this.disposed || this.current === current) return;
    this.current = current;
    this.renderer.show(current && this.lastGood !== null);
    if (!current) {
      clearTimeout(this.timer); this.timer = undefined;
      this.request?.abort();
    } else this.schedule();
  }

  private schedule(): void {
    if (this.disposed || !this.current || this.request || this.timer !== undefined) return;
    this.timer = setTimeout(() => { this.timer = undefined; void this.check(); }, Math.max(0, this.dueAt - Date.now()));
  }

  private async check(): Promise<void> {
    const request = new AbortController();
    this.request = request;
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; request.abort(new Error('Cloud source timeout')); }, CLOUD_SOURCE.timeoutMs);
    try {
      const next = await this.acquire(request.signal, this.lastGood?.identity);
      request.signal.throwIfAborted();
      if (this.disposed || !this.current) return;
      if (next) {
        this.renderer.replace(next.image);
        this.lastGood = next;
        this.renderer.show(true);
      }
      this.checkedAt = Date.now();
      this.failures = 0;
      this.dueAt = Date.now() + CLOUD_SOURCE.checkMs;
    } catch {
      // Mode switches/unmount cancel work without counting a provider failure.
      if (!this.disposed && this.current && (!request.signal.aborted || timedOut)) {
        this.failures += 1;
        this.dueAt = Date.now() + Math.min(CLOUD_SOURCE.maximumRetryMs,
          CLOUD_SOURCE.retryMs * 2 ** Math.min(this.failures - 1, 4));
      }
    } finally {
      clearTimeout(timeout);
      this.request = undefined;
      this.schedule();
    }
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    clearTimeout(this.timer); this.timer = undefined;
    this.request?.abort();
    this.lastGood = null;
    this.renderer.destroy();
  }
}
