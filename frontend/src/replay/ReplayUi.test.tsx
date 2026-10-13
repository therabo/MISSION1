// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { ReplayCrewPanel } from "./ReplayCrewPanel";
import { decodeReplay } from "./replayApi";
import { replayFixture } from "../test/replayFixture";
let root: Root, node: HTMLDivElement;
const at = "2026-10-03T12:00:00Z";
beforeEach(() => {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    value: true,
    configurable: true,
  });
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
});
afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
});
it("shows historical Crew, unresolved subjects and partial evidence", async () => {
  await act(async () =>
    root.render(
      <ReplayCrewPanel
        data={decodeReplay(replayFixture(), at)}
        loading={false}
        error={null}
        at={at}
        onClose={() => {}}
      />,
    ),
  );
  expect(node.textContent).toContain(at);
  expect(node.textContent).toContain("partial");
  expect(node.textContent).toContain("unresolved");
  expect(node.textContent).toContain("11");
});
it("unavailable history displays no current roster substitute", async () => {
  const fixture = replayFixture();
  fixture.crew.state = null as never;
  fixture.crew.availability = "UNAVAILABLE";
  await act(async () =>
    root.render(
      <ReplayCrewPanel
        data={decodeReplay(fixture, at)}
        loading={false}
        error={null}
        at={at}
        onClose={() => {}}
      />,
    ),
  );
  expect(node.textContent).toContain("Crew history unavailable");
  expect(node.querySelector("[data-member-id]")).toBeNull();
});
it("historical panel announces loading and keyboard close", async () => {
  const close = vi.fn();
  await act(async () =>
    root.render(
      <ReplayCrewPanel
        data={null}
        loading
        error={null}
        at={at}
        onClose={close}
      />,
    ),
  );
  expect(node.textContent).toContain("Loading historical");
  await act(async () =>
    node
      .querySelector("aside")
      ?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      ),
  );
  expect(close).toHaveBeenCalledOnce();
});
