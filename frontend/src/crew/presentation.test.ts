import { describe, expect, it } from 'vitest';
import {
  assertionLabel,
  formatDuration,
  memberGroups,
  safeHttps,
  utc,
} from './presentation';
import { crewFixture, historicalCrewFixture } from '../test/crewFixture';

describe('elapsed career duration formatting', () => {
  it.each([
    ['P436DT6H28M', '436 d 6 h 28 min'],
    ['PT10470H28M11S', '436 d 6 h 28 min 11 s'],
    ['PT0.125S', '0.125 s'],
    ['PT1.000000001S', '1.000000001 s'],
    ['PT1,5S', '1.5 s'],
    ['PT0S', '0 s'],
    ['PT0H', '0 s'],
    ['P1D', '1 d'],
    ['PT25H', '1 d 1 h'],
    ['PT61M', '1 h 1 min'],
    ['PT61.50S', '1 min 1.5 s'],
    ['P1DT2H3M4.500S', '1 d 2 h 3 min 4.5 s'],
    ['PT999999999999999999999999H', '41666666666666666666666 d 15 h'],
    [null, 'Unavailable'],
    ['P', 'Unavailable'],
    ['PT', 'Unavailable'],
    ['P1DT', 'Unavailable'],
    ['P1M', 'Unavailable'],
    ['P1Y', 'Unavailable'],
    ['PT-5S', 'Unavailable'],
    ['garbage', 'Unavailable'],
  ])('formats %s as %s', (value, expected) => expect(formatDuration(value)).toBe(expected));
});
describe('safe source links', () => {
  it.each([
    null,
    'javascript:alert(1)',
    'data:image/svg+xml,hi',
    'http://example.org',
    'https://user:secret@example.org',
    'broken',
  ])('rejects unsafe/invalid link %s', (url) => expect(safeHttps(url)).toBeUndefined());
});
describe('assignment/presence presentation', () => {
  it('groups only backend structured Commander/Flight Engineer roles and keeps NASA-only people separate', () => {
    const crew = crewFixture(),
      groups = memberGroups(crew.members);
    expect(
      groups
        .find((g) => g.label === 'Flight engineers')
        ?.members.every((m) => m.assignment?.roleCode === 'FLIGHT_ENGINEER'),
    ).toBe(true);
    expect(
      groups
        .find((g) => g.label === 'Other confirmed crew')
        ?.members.every((m) => m.assignment === null && m.presence.state === 'CONFIRMED_ABOARD'),
    ).toBe(true);
    expect(groups.flatMap((g) => g.members)).toHaveLength(9);
    const assigned = crew.members.find((m) => m.assignment !== null)!;
    assigned.assignment!.roleCode = 'COMMANDER';
    expect(memberGroups(crew.members)[0].members[0].id).toBe(assigned.id);
  });
  it('retains unknown/other assignments and stale/departed unassigned context', () => {
    const crew = crewFixture();
    crew.members[0].assignment!.roleCode = 'OTHER';
    const nasa = crew.members.find((m) => !m.assignment)!;
    nasa.presence.state = 'STALE';
    expect(memberGroups(crew.members).map((g) => g.label)).toContain('Other assignments');
    expect(memberGroups(crew.members).find((g) => g.label === 'Other presence context')?.members).toContain(
      nasa,
    );
  });
  it('formats missing or invalid times explicitly', () => {
    expect(utc(null)).toBe('Unavailable');
    expect(utc('bad')).toBe('Unavailable');
    expect(utc('2026-10-03T12:00:00Z')).toBe('2026-10-03 12:00:00 UTC');
  });
  it('labels departure reports as departure, never as aboard', () =>
    expect(
      assertionLabel({ ...historicalCrewFixture().unresolvedSubjects[0].evidence, type: 'PERSON_DEPARTED_STATION' }),
    ).toBe('Reported departure'));
});
