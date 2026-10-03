import type { Assertion, CrewMedia, CrewMember, PresenceState, ReconciliationStatus } from './types';

export const QUALITY: Record<ReconciliationStatus, { label: string; note: string }> = {
  MATCH: { label: 'Sources aligned', note: 'The available sources agree on the current crew.' },
  NASA_AHEAD: {
    label: 'Recent NASA update',
    note: 'NASA reports a completed arrival newer than the structured roster.',
  },
  LL2_AHEAD: {
    label: 'Structured roster newer',
    note: 'Newer assignments have not yet been reflected in the verified roster.',
  },
  PARTIAL_MATCH: {
    label: 'Sources partially reconciled',
    note: 'Assignments and NASA presence reports provide an incomplete comparison.',
  },
  PRIMARY_UNAVAILABLE: {
    label: 'Structured roster unavailable',
    note: 'Available NASA presence reports remain visible; profile and assignment context may be limited.',
  },
  VERIFICATION_UNAVAILABLE: {
    label: 'NASA verification unavailable',
    note: 'Assignments remain visible. Current presence cannot be assumed from assignment alone.',
  },
  STALE: {
    label: 'Crew data may be outdated',
    note: 'Available last-known information is retained with its source times and presence states.',
  },
  AMBIGUOUS: {
    label: 'Crew state requires reconciliation',
    note: 'Conflicting or unresolved evidence remains visible without choosing an identity or presence.',
  },
};
export const PRESENCE: Record<PresenceState, string> = {
  CONFIRMED_ABOARD: 'Confirmed aboard',
  CONFIRMED_NOT_ABOARD: 'Confirmed not aboard',
  UNVERIFIED: 'Presence unverified',
  UNKNOWN: 'Presence unknown',
  STALE: 'Presence outdated',
  AMBIGUOUS: 'Presence ambiguous',
};
export function memberGroups(members: CrewMember[]): { label: string; members: CrewMember[] }[] {
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
      label: 'Other confirmed crew',
      members: members.filter((m) => !m.assignment && m.presence.state === 'CONFIRMED_ABOARD'),
    },
    {
      label: 'Other presence context',
      members: members.filter((m) => !m.assignment && m.presence.state !== 'CONFIRMED_ABOARD'),
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
