import { decodeHistoricalCrew, decodePerson } from "../crew/decode";
import type { HistoricalCrew, CrewPerson } from "../crew/types";
export interface Coverage {
  status: string;
  start: string | null;
  end: string | null;
  intervals: { start: string; end: string }[];
  limitations: string[];
}
export interface ReplayState {
  effectiveAt: string;
  quality: string;
  frame: string;
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  latitudeDegrees: number;
  longitudeDegrees: number;
  altitudeMeters: number;
  source: {
    kind: string;
    classification: string;
    contentHash: string;
    epoch: string | null;
    creationAt: string | null;
    retrievedAt: string;
    signedPropagationOffsetSeconds: number | null;
  };
}
export interface ReplayResult {
  requestedAt: string;
  crew: {
    availability: string;
    state: HistoricalCrew | null;
    profiles: CrewPerson[];
    coverage: Coverage;
  };
  orbit: {
    availability: string;
    primary: ReplayState | null;
    secondary: ReplayState | null;
    sourceSeparationMeters: number | null;
    coverage: Coverage;
  };
}
export interface ReplayCoverage {
  crew: Coverage;
  orbit: Coverage;
  joint: Coverage;
  orbitGate: string;
}
const fail = (): never => {
  throw new Error("Replay API returned an unsupported response.");
};
const object = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : fail();
const text = (v: unknown): string => (typeof v === "string" ? v : fail());
const number = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fail();
const instant = (v: unknown): string => {
  const s = text(v);
  return s.endsWith("Z") && Number.isFinite(Date.parse(s)) ? s : fail();
};
function coverage(v: unknown): Coverage {
  const o = object(v);
  if (!Array.isArray(o.intervals) || !Array.isArray(o.limitations))
    return fail();
  return {
    status: text(o.status),
    start: o.start === null ? null : instant(o.start),
    end: o.end === null ? null : instant(o.end),
    intervals: o.intervals.map((i) => {
      const x = object(i);
      return { start: instant(x.start), end: instant(x.end) };
    }),
    limitations: o.limitations.map(text),
  };
}
function state(v: unknown): ReplayState | null {
  if (v === null) return null;
  const o = object(v),
    s = object(o.source);
  const vector = (v: unknown) => {
    const x = object(v);
    return { x: number(x.x), y: number(x.y), z: number(x.z) };
  };
  if (
    o.frame !== "ITRF_2020_IERS_2010" ||
    o.positionUnit !== "m" ||
    o.velocityUnit !== "m/s" ||
    ![
      "COMPUTED_FROM_ORBITAL_ELEMENTS",
      "SOURCE_PROVIDED_PREDICTED_EPHEMERIS",
    ].includes(text(s.classification))
  )
    return fail();
  return {
    effectiveAt: instant(o.effectiveAt),
    quality: text(o.quality),
    frame: text(o.frame),
    position: vector(o.position),
    velocity: vector(o.velocity),
    latitudeDegrees: number(o.latitudeDegrees),
    longitudeDegrees: number(o.longitudeDegrees),
    altitudeMeters: number(o.altitudeMeters),
    source: {
      kind: text(s.kind),
      classification: text(s.classification),
      contentHash: text(s.contentHash),
      epoch: s.epoch === null ? null : instant(s.epoch),
      creationAt: s.creationAt === null ? null : instant(s.creationAt),
      retrievedAt: instant(s.retrievedAt),
      signedPropagationOffsetSeconds:
        s.signedPropagationOffsetSeconds === null
          ? null
          : number(s.signedPropagationOffsetSeconds),
    },
  };
}
export function decodeReplay(v: unknown, requestedAt: string): ReplayResult {
  const o = object(v),
    c = object(o.crew),
    r = object(o.orbit);
  if (
    o.semantics !== "EFFECTIVE_TIME_BEST_CURRENT_RECONSTRUCTION" ||
    Date.parse(instant(o.requestedAt)) !== Date.parse(requestedAt) ||
    Date.parse(instant(c.effectiveAt)) !== Date.parse(requestedAt) ||
    Date.parse(instant(r.effectiveAt)) !== Date.parse(requestedAt) ||
    !Array.isArray(c.profiles)
  )
    return fail();
  const primary = state(r.primary),
    secondary = state(r.secondary);
  if (
    [primary, secondary].some(
      (s) => s && Date.parse(s.effectiveAt) !== Date.parse(requestedAt),
    )
  )
    return fail();
  return {
    requestedAt: instant(o.requestedAt),
    crew: {
      availability: text(c.availability),
      state: c.state === null ? null : decodeHistoricalCrew(c.state),
      profiles: c.profiles.map(decodePerson),
      coverage: coverage(c.coverage),
    },
    orbit: {
      availability: text(r.availability),
      primary,
      secondary,
      sourceSeparationMeters:
        r.sourceSeparationMeters === null
          ? null
          : number(r.sourceSeparationMeters),
      coverage: coverage(r.coverage),
    },
  };
}
export async function fetchReplay(
  at: string,
  signal: AbortSignal,
): Promise<ReplayResult> {
  const r = await fetch(`/api/iss/replay?at=${encodeURIComponent(at)}`, {
    signal,
  });
  if (!r.ok)
    throw new Error(
      r.status === 400
        ? "Choose a valid UTC time in the past."
        : "Replay could not be loaded.",
    );
  return decodeReplay(await r.json(), at);
}
export async function fetchReplayCoverage(
  signal: AbortSignal,
): Promise<ReplayCoverage> {
  const r = await fetch("/api/iss/replay/coverage", { signal });
  if (!r.ok) throw new Error("Replay coverage could not be loaded.");
  const o = object(await r.json());
  return {
    crew: coverage(o.crew),
    orbit: coverage(o.orbit),
    joint: coverage(o.joint),
    orbitGate: text(o.orbitGate),
  };
}
export function utcInput(value: string, now = Date.now()): string | null {
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? value + ":00" : value;
  const t = Date.parse(normalized + "Z");
  if (!Number.isFinite(t) || t > now) return null;
  const iso = new Date(t).toISOString();
  return iso.slice(0, 19) === normalized ? iso : null;
}
