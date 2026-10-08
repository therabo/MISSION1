// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { useMissionReplay } from "./useMissionReplay";
import { replayFixture } from "../test/replayFixture";
let root: Root, node: HTMLDivElement, fetchMock: ReturnType<typeof vi.fn>;
const at = "2026-10-03T12:00:00Z";
function Harness({ enabled, time, retry = 0 }: { enabled: boolean; time: string; retry?: number }) {
  const r = useMissionReplay(enabled, time, retry);
  return (
    <div>
      {r.loading ? "loading" : (r.error ?? r.data?.requestedAt ?? "empty")}
    </div>
  );
}
beforeEach(() => {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    value: true,
    configurable: true,
  });
  vi.useFakeTimers();
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
  fetchMock = vi.fn((url: string) =>
    url.endsWith("/coverage")
      ? Promise.resolve(
          Response.json({
            crew: replayFixture().crew.coverage,
            orbit: replayFixture().orbit.coverage,
            joint: replayFixture().crew.coverage,
            orbitGate: "BOUNDED",
          }),
        )
      : Promise.resolve(
          Response.json(replayFixture(decodeURIComponent(url.split("at=")[1]))),
        ),
  );
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function render(enabled = true, time = at) {
  await act(async () => root.render(<Harness enabled={enabled} time={time} />));
}
async function tick(ms = 300) {
  await act(async () => vi.advanceTimersByTimeAsync(ms));
}
it("loads once after debounce and never polls history", async () => {
  await render();
  expect(node.textContent).toBe("loading");
  await tick();
  expect(node.textContent).toBe(at);
  await tick(600000);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
it("rapid changes cancel pending debounce and accept only final UTC instant", async () => {
  await render();
  await render(true, "2026-10-03T11:00:00Z");
  await render(true, "2026-10-03T10:00:00Z");
  await tick();
  expect(node.textContent).toBe("2026-10-03T10:00:00Z");
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
it("aborts in-flight requests and suppresses stale completion after seek", async () => {
  let resolve: (r: Response) => void = () => {};
  fetchMock.mockImplementation((url: string) =>
    url.endsWith("/coverage")
      ? Promise.resolve(
          Response.json({
            crew: replayFixture().crew.coverage,
            orbit: replayFixture().orbit.coverage,
            joint: replayFixture().crew.coverage,
            orbitGate: "BOUNDED",
          }),
        )
      : new Promise<Response>((r) => {
          resolve = r;
        }),
  );
  await render();
  await tick();
  const signal = fetchMock.mock.calls[1][1].signal;
  await render(true, "2026-10-03T10:00:00Z");
  expect(signal.aborted).toBe(true);
  await act(async () => resolve(Response.json(replayFixture())));
  expect(node.textContent).toBe("loading");
});
it("returning to LIVE cancels pending work and clears historical data", async () => {
  await render();
  await tick();
  await render(false);
  expect(node.textContent).toBe("empty");
  await tick(600000);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
it("exposes request failures without retaining a historical answer at a different time", async () => {
  await render();
  await tick();
  fetchMock.mockRejectedValue(new Error("Replay unavailable"));
  await render(true, "2026-10-03T10:00:00Z");
  await tick();
  expect(node.textContent).toBe("Replay unavailable");
});

it('explicit retry reads the same UTC through the existing abort/debounce path without polling', async () => {
  await render(); await tick();
  await act(async () => root.render(<Harness enabled time={at} retry={1} />));
  expect(node.textContent).toBe('loading'); await tick(); expect(node.textContent).toBe(at);
  expect(fetchMock.mock.calls.filter(([url]) => url.includes('?at='))).toHaveLength(2);
  await tick(600000); expect(fetchMock).toHaveBeenCalledTimes(4);
});

it('retry aborts an older in-flight read and prevents its late answer from winning', async () => {
  const pending: { resolve: (r: Response) => void; signal: AbortSignal }[] = [];
  fetchMock.mockImplementation((url: string, options: { signal: AbortSignal }) => url.endsWith('/coverage')
    ? Promise.resolve(Response.json({ crew: replayFixture().crew.coverage, orbit: replayFixture().orbit.coverage, joint: replayFixture().crew.coverage, orbitGate: 'BOUNDED' }))
    : new Promise<Response>(resolve => pending.push({ resolve, signal: options.signal })));
  await render(); await tick();
  await act(async () => root.render(<Harness enabled time={at} retry={1} />));
  expect(pending[0].signal.aborted).toBe(true); await tick();
  await act(async () => pending[0].resolve(Response.json(replayFixture()))); expect(node.textContent).toBe('loading');
  await act(async () => pending[1].resolve(Response.json(replayFixture()))); expect(node.textContent).toBe(at);
});
