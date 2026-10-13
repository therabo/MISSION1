/** Public MISSION1 REST contract; docs/api/crew-api.md is authoritative. */
export type ReconciliationStatus =
  | 'MATCH'
  | 'NASA_AHEAD'
  | 'LL2_AHEAD'
  | 'PARTIAL_MATCH'
  | 'PRIMARY_UNAVAILABLE'
  | 'VERIFICATION_UNAVAILABLE'
  | 'STALE'
  | 'AMBIGUOUS';
export type PresenceState =
  | 'CONFIRMED_ABOARD'
  | 'CONFIRMED_NOT_ABOARD'
  | 'UNVERIFIED'
  | 'UNKNOWN'
  | 'STALE'
  | 'AMBIGUOUS';
export type RoleCode = 'COMMANDER' | 'FLIGHT_ENGINEER' | 'OTHER' | 'UNKNOWN';
export interface ExternalId {
  source: string;
  value: string;
}
export interface Station {
  id: string;
  name: string;
}
export interface Expedition {
  id: string;
  name: string;
  start: string | null;
  end: string | null;
  externalIds: ExternalId[];
}
export interface Agency {
  name: string | null;
  abbreviation: string | null;
  type: string | null;
  externalIds: ExternalId[];
}
export interface Nationality {
  alpha2: string | null;
  alpha3: string | null;
  displayName: string | null;
}
export interface CrewMedia {
  url: string | null;
  thumbnailUrl: string | null;
  credit: string | null;
  licenseName: string | null;
  licenseUrl: string | null;
  singleUse: boolean | null;
}
export interface Assignment {
  expeditionId: string;
  role: string | null;
  roleCode: RoleCode;
  validFrom: string | null;
  validUntil: string | null;
}
export interface Observation {
  source: string;
  sourceType: string | null;
  sourceUrl: string;
  observedAt: string;
  sourcePublishedAt: string | null;
  sourceEventAt: string | null;
  contentHash: string;
  sourceVersion: string | null;
  methodVersion: string | null;
}
export interface Assertion {
  source: string;
  sourceType: string;
  type: string;
  assertion: string;
  completeness: string;
  asOf: string | null;
  provenance: Observation;
}
export interface Presence {
  state: PresenceState;
  lastKnownState: PresenceState | null;
  asOf: string | null;
  authority: string | null;
  evidence: Assertion[];
}
export interface CrewMember {
  id: string;
  name: string | null;
  agency: Agency | null;
  nationalities: Nationality[];
  image: CrewMedia | null;
  assignment: Assignment | null;
  presence: Presence;
  externalIds: ExternalId[];
}
export interface UnresolvedSubject {
  displayName: string;
  resolution: 'UNRESOLVED' | 'AMBIGUOUS';
  evidence: Assertion;
  applicable: boolean;
}
export interface HistoricalCrewCounts {
  officialAboard: number | null;
  lastKnownOfficialAboard: number | null;
  resolvedAboard: number;
  unresolvedSubjects: number;
  unidentifiedAboard: number;
  structuredAssignments: number | null;
}
export interface Reconciliation {
  status: ReconciliationStatus;
  evaluatedAt: string;
  reconciledAt: string | null;
  algorithmVersion: string;
  lastAttemptAt: string | null;
  lastAttemptCompletedAt: string | null;
  lastAttemptResult: string | null;
}
export interface SourceHealth {
  source: string;
  sourceState: string | null;
  lastAttemptAt: string | null;
  lastAttemptResult: string | null;
  lastSuccessfulFetchAt: string | null;
  lastFailureAt: string | null;
  lastRefreshFailed: boolean;
  rateLimited: boolean;
  retryAfterAt: string | null;
  stale: boolean;
}
export interface CrewFreshness {
  evaluatedAt: string;
  structuredSource: SourceHealth;
  verification: SourceHealth;
  stale: boolean;
}
export interface CrewProvenance {
  structuredSource: Observation | null;
  verification: Observation | null;
  contributingAssertions: Assertion[];
}
interface CrewState {
  station: Station;
  expedition: Expedition | null;
  members: CrewMember[];
  reconciliation: Reconciliation;
  freshness: CrewFreshness;
  provenance: CrewProvenance;
}
export interface HistoricalCrew extends CrewState {
  counts: HistoricalCrewCounts;
  unresolvedSubjects: UnresolvedSubject[];
  membership?: MembershipProjection & { mode: 'HISTORICAL_V10_S10' };
}
export interface MembershipProjection {
  mode: 'ACTIVE_PROJECTION' | 'HISTORICAL_V10_S10';
  /** Historical evaluation is read-only: revision=0, ageSeconds=0. */
  revision: number;
  evaluatedAt: string;
  policyVersion: string;
  health: 'HEALTHY' | 'DEGRADED';
  ageSeconds: number;
  resolvedCurrentMembers: number;
  nonPublishableActive: number;
  canonicalCollisions: number;
  unresolvedActiveSourceSlots: number;
}
export interface CurrentCrew extends CrewState {
  counts: { resolvedAboard: number; structuredAssignments: number | null };
  membership?: MembershipProjection & { mode: 'ACTIVE_PROJECTION' };
}
export type CrewAssessment = CurrentCrew | HistoricalCrew;
export interface Career {
  timeInSpace: string | null;
  evaTime: string | null;
  flightsCount: number | null;
  spacewalksCount: number | null;
  firstFlight: string | null;
  lastFlight: string | null;
}
export interface CrewPerson {
  id: string;
  name: string | null;
  officialProfileUrl: string | null;
  externalIds: ExternalId[];
  agency: Agency | null;
  nationalities: Nationality[];
  biography: string | null;
  image: CrewMedia | null;
  career: Career | null;
  profileAvailability: 'AVAILABLE' | 'UNAVAILABLE';
  currentAssignment: Assignment | null;
  currentPresence: Presence;
  reconciliation: Reconciliation;
  profileProvenance: Observation | null;
  profileLastSuccessfulFetchAt: string | null;
}
