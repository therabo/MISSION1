import { historicalCrewFixture, personFixture } from "./crewFixture";
const at = "2026-10-03T12:00:00Z";
export function replayFixture(time = at) {
  return {
    semantics: "EFFECTIVE_TIME_BEST_CURRENT_RECONSTRUCTION",
    requestedAt: time,
    crew: {
      effectiveAt: time,
      availability: "PARTIAL",
      state: historicalCrewFixture(),
      profiles: [personFixture()],
      coverage: {
        status: "PARTIAL",
        start: time,
        end: time,
        intervals: [{ start: time, end: time }],
        limitations: [],
      },
    },
    orbit: {
      effectiveAt: time,
      availability: "UNAVAILABLE",
      primary: null,
      secondary: null,
      sourceSeparationMeters: null,
      coverage: {
        status: "UNAVAILABLE",
        start: null,
        end: null,
        intervals: [],
        limitations: [],
      },
    },
  };
}
