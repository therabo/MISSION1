import type { Assertion, CrewMedia, CrewMember, CrewAssessment, Presence, PresenceState, ReconciliationStatus } from './types';

/** Latest successful source collection update, not assertion/event time or
 * read-time evaluation. Return an existing API value unchanged; failures and
 * unchanged fetches keep their distinct meaning in Data source. */
export function latestCrewSourceUpdate(crew: CrewAssessment): string | null {
  return [crew.freshness.structuredSource.lastSuccessfulFetchAt, crew.freshness.verification.lastSuccessfulFetchAt]
    .filter((at): at is string => at !== null && Number.isFinite(Date.parse(at)))
    .reduce<string | null>((latest, at) => latest === null || Date.parse(at) > Date.parse(latest) ? at : latest, null);
}

export const QUALITY: Record<ReconciliationStatus, { label: string }> = {
  MATCH: { label: 'Sources aligned' },
  NASA_AHEAD: {
    label: 'Recent NASA update',
  },
  LL2_AHEAD: {
    label: 'Structured roster newer',
  },
  PARTIAL_MATCH: {
    label: 'Sources partially reconciled',
  },
  PRIMARY_UNAVAILABLE: {
    label: 'Structured roster unavailable',
  },
  VERIFICATION_UNAVAILABLE: {
    label: 'NASA verification unavailable',
  },
  STALE: {
    label: 'Crew data may be outdated',
  },
  AMBIGUOUS: {
    label: 'Crew state requires reconciliation',
  },
};
export const PRESENCE: Record<PresenceState, string> = {
  CONFIRMED_ABOARD: 'Confirmed aboard',
  CONFIRMED_NOT_ABOARD: 'Confirmed not aboard',
  UNVERIFIED: 'Presence unverified',
  UNKNOWN: 'Presence unknown',
  STALE: 'Presence not currently confirmed',
  AMBIGUOUS: 'Presence ambiguous',
};
// Historical presence labels retain the supported contract wording.
export const HISTORICAL_PRESENCE = { ...PRESENCE, STALE: 'Presence outdated' };

/** Current annotations describe the selected source assertion, never infer membership or identity. */
export function operationalAnnotation(presence: Presence, evaluatedAt: string) {
  const evidence = presence.evidence.find(e => e.asOf === presence.asOf) ?? presence.evidence[0];
  const entry = evidence?.type === 'PERSON_ENTERED_STATION' && evidence.assertion === 'COMPLETED';
  const observation = evidence?.type === 'PERSON_CURRENTLY_ABOARD' && evidence.assertion === 'OBSERVED';
  const age = Date.parse(evaluatedAt) - Date.parse(presence.asOf ?? '');
  const applicable = Number.isFinite(age) && age >= 0 && age <= (entry ? 14 : 7) * 86400_000;
  const fresh = presence.state === 'CONFIRMED_ABOARD' && applicable;
  const label = presence.state === 'AMBIGUOUS' ? 'Conflicting operational evidence'
    : evidence?.type === 'PERSON_DEPARTED_STATION' ? 'Operational departure reported'
      : !entry && !observation ? 'No individual operational observation available'
        : presence.state === 'UNVERIFIED' ? 'Operational verification unavailable'
          : !fresh ? 'No recent operational confirmation'
            : entry ? 'Operational entry confirmed' : 'Operational presence recently observed';
  const description = entry ? 'Last operational entry' : observation ? 'Last operational observation: aboard' : 'Operational evidence';
  return { label, description, fresh, evidence, precision: evidence?.provenance.sourceEventAt ? 'Source event time' : 'Publication-time proxy' };
}
export function memberGroups(members: CrewMember[], current = false): { label: string; members: CrewMember[] }[] {
  const groups = [
    { label: 'Commander', members: members.filter((m) => m.assignment?.roleCode === 'COMMANDER') },
    {
      label: 'Flight engineers',
      members: members.filter((m) => m.assignment?.roleCode === 'FLIGHT_ENGINEER'),
    },
    {
      label: 'Other assignments',
      members: members.filter(
        (m) => m.assignment && !['COMMANDER', 'FLIGHT_ENGINEER'].includes(m.assignment.roleCode),
      ),
    },
    {
      label: current ? 'Other Current members' : 'Other confirmed crew',
      members: members.filter((m) => !m.assignment && (current || m.presence.state === 'CONFIRMED_ABOARD')),
    },
    {
      label: 'Other presence context',
      members: members.filter((m) => !current && !m.assignment && m.presence.state !== 'CONFIRMED_ABOARD'),
    },
  ];
  return groups.filter((group) => group.members.length > 0);
}
export function utc(value: string | null): string {
  return value && Number.isFinite(Date.parse(value))
    ? new Date(value)
        .toISOString()
        .replace('T', ' ')
        .replace(/\.\d+Z$/, ' UTC')
    : 'Unavailable';
}
export function safeHttps(value: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}
/** Conservative reviewed permission, not a generic license-name heuristic. Unknown/single-use media stays hidden. */
export function permittedPortrait(media: CrewMedia | null): string | undefined {
  if (
    !media ||
    media.singleUse !== false ||
    media.credit !== 'NASA' ||
    media.licenseName !== 'NASA Image and Media Guidelines' ||
    safeHttps(media.licenseUrl) !== 'https://www.nasa.gov/nasa-brand-center/images-and-media/'
  )
    return undefined;
  return safeHttps(media.thumbnailUrl) ?? safeHttps(media.url);
}
export function assertionLabel(evidence: Assertion): string {
  const labels: Record<string, string> = {
    PERSON_ENTERED_STATION: 'Reported entry',
    PERSON_DEPARTED_STATION: 'Reported departure',
    PERSON_CURRENTLY_ABOARD: 'Reported aboard',
    EXPEDITION_MEMBERSHIP: 'Reported membership',
    CREW_COUNT_ABOARD: 'Reported crew count',
    HATCH_OPENED: 'Reported hatch opening',
    DOCKED: 'Reported docking',
    UNDOCKED: 'Reported undocking',
  };
  return labels[evidence.type] ?? evidence.type.replaceAll('_', ' ').toLowerCase();
}
/** Elapsed durations, including Java's large hour totals; never calendar Dates or rounded floats. */
export function formatDuration(value: string | null): string {
  if (value === null) return 'Unavailable';
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)(?:[.,](\d+))?S)?)?$/.exec(value);
  if (!match || !match.slice(1).some((part) => part !== undefined) || value.endsWith('T'))
    return 'Unavailable';
  const whole =
    BigInt(match[1] ?? 0) * 86400n +
    BigInt(match[2] ?? 0) * 3600n +
    BigInt(match[3] ?? 0) * 60n +
    BigInt(match[4] ?? 0);
  const parts: string[] = [];
  const days = whole / 86400n,
    hours = (whole % 86400n) / 3600n,
    minutes = (whole % 3600n) / 60n,
    seconds = whole % 60n;
  if (days) parts.push(`${days} d`);
  if (hours) parts.push(`${hours} h`);
  if (minutes) parts.push(`${minutes} min`);
  const fraction = match[5]?.replace(/0+$/, '');
  if (seconds || fraction) parts.push(`${seconds}${fraction ? `.${fraction}` : ''} s`);
  return parts.join(' ') || '0 s';
}
