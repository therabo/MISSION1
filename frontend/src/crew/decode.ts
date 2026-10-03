import type * as C from './types';

type Decode<T> = (value: unknown) => T;
const invalid = (): never => {
  throw new Error('Crew API returned an unsupported response.');
};
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>; // Object guard; each consumed field is decoded below.
}
const text: Decode<string> = (value) => (typeof value === 'string' ? value : invalid());
const bool: Decode<boolean> = (value) => (typeof value === 'boolean' ? value : invalid());
const count: Decode<number> = (value) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : invalid();
const nullable =
  <T>(decode: Decode<T>): Decode<T | null> =>
  (value) =>
    value === null ? null : decode(value);
const array =
  <T>(decode: Decode<T>): Decode<T[]> =>
  (value) =>
    Array.isArray(value) ? value.map(decode) : invalid();
function choice<T extends string>(values: readonly T[]): Decode<T> {
  return (value) => {
    for (const allowed of values) if (value === allowed) return allowed;
    return invalid();
  };
}
const instant: Decode<string> = (value) => {
  const v = text(value);
  return /Z$/.test(v) && Number.isFinite(Date.parse(v)) ? v : invalid();
};
const uuid: Decode<string> = (value) => {
  const v = text(value);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : invalid();
};
const nt = nullable(text),
  ni = nullable(instant),
  nc = nullable(count);
const role = choice<C.RoleCode>(['COMMANDER', 'FLIGHT_ENGINEER', 'OTHER', 'UNKNOWN']);
const state = choice<C.PresenceState>([
  'CONFIRMED_ABOARD',
  'CONFIRMED_NOT_ABOARD',
  'UNVERIFIED',
  'UNKNOWN',
  'STALE',
  'AMBIGUOUS',
]);
const external: Decode<C.ExternalId> = (value) => {
  const v = record(value);
  return { source: text(v.source), value: text(v.value) };
};
const station: Decode<C.Station> = (value) => {
  const v = record(value);
  return { id: text(v.id), name: text(v.name) };
};
const expedition: Decode<C.Expedition> = (value) => {
  const v = record(value);
  return {
    id: uuid(v.id),
    name: text(v.name),
    start: ni(v.start),
    end: ni(v.end),
    externalIds: array(external)(v.externalIds),
  };
};
const agency: Decode<C.Agency> = (value) => {
  const v = record(value);
  return {
    name: nt(v.name),
    abbreviation: nt(v.abbreviation),
    type: nt(v.type),
    externalIds: array(external)(v.externalIds),
  };
};
const nationality: Decode<C.Nationality> = (value) => {
  const v = record(value);
  return { alpha2: nt(v.alpha2), alpha3: nt(v.alpha3), displayName: nt(v.displayName) };
};
const media: Decode<C.CrewMedia> = (value) => {
  const v = record(value);
  return {
    url: nt(v.url),
    thumbnailUrl: nt(v.thumbnailUrl),
    credit: nt(v.credit),
    licenseName: nt(v.licenseName),
    licenseUrl: nt(v.licenseUrl),
    singleUse: nullable(bool)(v.singleUse),
  };
};
const assignment: Decode<C.Assignment> = (value) => {
  const v = record(value);
  return {
    expeditionId: uuid(v.expeditionId),
    role: nt(v.role),
    roleCode: role(v.roleCode),
    validFrom: ni(v.validFrom),
    validUntil: ni(v.validUntil),
  };
};
const observation: Decode<C.Observation> = (value) => {
  const v = record(value);
  return {
    source: text(v.source),
    sourceType: nt(v.sourceType),
    sourceUrl: text(v.sourceUrl),
    observedAt: instant(v.observedAt),
    sourcePublishedAt: ni(v.sourcePublishedAt),
    sourceEventAt: ni(v.sourceEventAt),
    contentHash: text(v.contentHash),
    sourceVersion: nt(v.sourceVersion),
    methodVersion: nt(v.methodVersion),
  };
};
const assertion: Decode<C.Assertion> = (value) => {
  const v = record(value);
  return {
    source: text(v.source),
    sourceType: text(v.sourceType),
    type: text(v.type),
    assertion: text(v.assertion),
    completeness: text(v.completeness),
    asOf: ni(v.asOf),
    provenance: observation(v.provenance),
  };
};
const presence: Decode<C.Presence> = (value) => {
  const v = record(value);
  return {
    state: state(v.state),
    lastKnownState: nullable(state)(v.lastKnownState),
    asOf: ni(v.asOf),
    authority: nt(v.authority),
    evidence: array(assertion)(v.evidence),
  };
};
const reconciliation: Decode<C.Reconciliation> = (value) => {
  const v = record(value);
  return {
    status: choice<C.ReconciliationStatus>([
      'MATCH',
      'NASA_AHEAD',
      'LL2_AHEAD',
      'PARTIAL_MATCH',
      'PRIMARY_UNAVAILABLE',
      'VERIFICATION_UNAVAILABLE',
      'STALE',
      'AMBIGUOUS',
    ])(v.status),
    evaluatedAt: instant(v.evaluatedAt),
    reconciledAt: ni(v.reconciledAt),
    algorithmVersion: text(v.algorithmVersion),
    lastAttemptAt: ni(v.lastAttemptAt),
    lastAttemptCompletedAt: ni(v.lastAttemptCompletedAt),
    lastAttemptResult: nt(v.lastAttemptResult),
  };
};
const health: Decode<C.SourceHealth> = (value) => {
  const v = record(value);
  return {
    source: text(v.source),
    sourceState: nt(v.sourceState),
    lastAttemptAt: ni(v.lastAttemptAt),
    lastAttemptResult: nt(v.lastAttemptResult),
    lastSuccessfulFetchAt: ni(v.lastSuccessfulFetchAt),
    lastFailureAt: ni(v.lastFailureAt),
    lastRefreshFailed: bool(v.lastRefreshFailed),
    rateLimited: bool(v.rateLimited),
    retryAfterAt: ni(v.retryAfterAt),
    stale: bool(v.stale),
  };
};
const member: Decode<C.CrewMember> = (value) => {
  const v = record(value);
  return {
    id: uuid(v.id),
    name: nt(v.name),
    agency: nullable(agency)(v.agency),
    nationalities: array(nationality)(v.nationalities),
    image: nullable(media)(v.image),
    assignment: nullable(assignment)(v.assignment),
    presence: presence(v.presence),
    externalIds: array(external)(v.externalIds),
  };
};
export const decodeCrew: Decode<C.CurrentCrew> = (value) => {
  const v = record(value),
    c = record(v.counts),
    f = record(v.freshness),
    p = record(v.provenance);
  return {
    station: station(v.station),
    expedition: nullable(expedition)(v.expedition),
    counts: {
      officialAboard: nc(c.officialAboard),
      lastKnownOfficialAboard: nc(c.lastKnownOfficialAboard),
      resolvedAboard: count(c.resolvedAboard),
      unresolvedSubjects: count(c.unresolvedSubjects),
      unidentifiedAboard: count(c.unidentifiedAboard),
      structuredAssignments: nc(c.structuredAssignments),
    },
    members: array(member)(v.members),
    unresolvedSubjects: array<C.UnresolvedSubject>((value) => {
      const s = record(value);
      return {
        displayName: text(s.displayName),
        resolution: choice(['UNRESOLVED', 'AMBIGUOUS'] as const)(s.resolution),
        evidence: assertion(s.evidence),
        applicable: bool(s.applicable),
      };
    })(v.unresolvedSubjects),
    reconciliation: reconciliation(v.reconciliation),
    freshness: {
      evaluatedAt: instant(f.evaluatedAt),
      structuredSource: health(f.structuredSource),
      verification: health(f.verification),
      stale: bool(f.stale),
    },
    provenance: {
      structuredSource: nullable(observation)(p.structuredSource),
      verification: nullable(observation)(p.verification),
      contributingAssertions: array(assertion)(p.contributingAssertions),
    },
  };
};
export const decodeExpedition: Decode<C.CurrentExpedition> = (value) => {
  const v = record(value);
  return {
    station: station(v.station),
    expedition: nullable(expedition)(v.expedition),
    assignmentCount: count(v.assignmentCount),
    assignments: array<C.ExpeditionAssignment>((value) => {
      const a = record(value);
      return {
        personId: uuid(a.personId),
        name: nt(a.name),
        role: nt(a.role),
        roleCode: role(a.roleCode),
        agency: nullable(agency)(a.agency),
        nationalities: array(nationality)(a.nationalities),
      };
    })(v.assignments),
    sourceState: text(v.sourceState),
    freshness: health(v.freshness),
    provenance: nullable(observation)(v.provenance),
  };
};
export const decodePerson: Decode<C.CrewPerson> = (value) => {
  const v = record(value);
  return {
    id: uuid(v.id),
    name: nt(v.name),
    officialProfileUrl: nt(v.officialProfileUrl),
    externalIds: array(external)(v.externalIds),
    agency: nullable(agency)(v.agency),
    nationalities: array(nationality)(v.nationalities),
    biography: nt(v.biography),
    image: nullable(media)(v.image),
    career: nullable<C.Career>((value) => {
      const c = record(value);
      return {
        timeInSpace: nt(c.timeInSpace),
        evaTime: nt(c.evaTime),
        flightsCount: nc(c.flightsCount),
        spacewalksCount: nc(c.spacewalksCount),
        firstFlight: ni(c.firstFlight),
        lastFlight: ni(c.lastFlight),
      };
    })(v.career),
    profileAvailability: choice(['AVAILABLE', 'UNAVAILABLE'] as const)(v.profileAvailability),
    currentAssignment: nullable(assignment)(v.currentAssignment),
    currentPresence: presence(v.currentPresence),
    reconciliation: reconciliation(v.reconciliation),
    profileProvenance: nullable(observation)(v.profileProvenance),
    profileLastSuccessfulFetchAt: ni(v.profileLastSuccessfulFetchAt),
  };
};
