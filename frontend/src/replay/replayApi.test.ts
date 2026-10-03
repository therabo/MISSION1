import { describe, expect, it } from "vitest";
import { decodeReplay, utcInput } from "./replayApi";
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
  it("validates real UTC calendar times and rejects future values", () => {
    const now = Date.parse(at);
    expect(utcInput("2026-10-03T11:00", now)).toBe("2026-10-03T11:00:00.000Z");
    expect(utcInput("2026-10-03T11:00:00", now)).toBe(
      "2026-10-03T11:00:00.000Z",
    );
    expect(utcInput("2026-02-30T11:00:00", now)).toBeNull();
    expect(utcInput("2027-01-01T00:00:00", now)).toBeNull();
    expect(utcInput("bad", now)).toBeNull();
  });
});
