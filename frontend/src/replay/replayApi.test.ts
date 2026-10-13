import { describe, expect, it } from "vitest";
import { decodeReplay } from "./replayApi";
const at = "2026-10-03T12:00:00Z";
import { replayFixture } from "../test/replayFixture";
describe("Replay response epoch boundary", () => {
  it("decodes historical Crew and unavailable orbit independently", () => {
    const x = decodeReplay(replayFixture(), at);
    expect(x.crew.state?.counts.officialAboard).toBe(11);
    expect(x.orbit.primary).toBeNull();
  });
  it("rejects mismatched requested or subsystem epochs", () => {
    expect(() =>
      decodeReplay(replayFixture(), "2026-10-02T12:00:00Z"),
    ).toThrow();
    const x = replayFixture();
    x.orbit.effectiveAt = "2026-10-02T12:00:00Z";
    expect(() => decodeReplay(x, at)).toThrow();
  });
  it("rejects unsupported semantics and malformed coverage", () => {
    const x = replayFixture();
    x.semantics = "KNOWLEDGE_TIME";
    expect(() => decodeReplay(x, at)).toThrow();
  });
});
