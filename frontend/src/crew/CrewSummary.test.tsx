import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CrewSummary, PresenceLabel } from './CrewSummary';
import { CrewProfile } from './CrewMemberDetail';
import { CrewPortrait } from './CrewPortrait';
import { crewFixture, personFixture } from '../test/crewFixture';
import { PRESENCE, QUALITY } from './presentation';
import type { PresenceState, ReconciliationStatus } from './types';

describe('Crew summary semantics', () => {
  it.each(Object.keys(QUALITY) as ReconciliationStatus[])('shows data and quality text for %s', (status) => {
    const crew = crewFixture();
    crew.reconciliation.status = status;
    const html = renderToStaticMarkup(<CrewSummary crew={crew} onMember={() => {}} />);
    expect(html).toContain(QUALITY[status].label);
    expect(html).toContain('11');
    expect(html).toContain('confirmed identities');
    expect(html).toContain('Data sources');
  });
  it('distinguishes official11, resolved8, unresolved3, assignments7 and cards9', () => {
    const html = renderToStaticMarkup(<CrewSummary crew={crewFixture()} onMember={() => {}} />);
    expect(html).toContain('<strong>11</strong>');
    expect(html).toContain('8 confirmed identities');
    expect(html).toContain('3 aboard');
    expect(html).toContain('3 unresolved report entries');
    expect(html).toContain('7 structured assignments');
    expect(html).toContain('9 resolved profiles');
    expect((html.match(/data-member-id=/g) ?? []).length).toBe(9);
  });
  it('never uses card length or retained count as current official count', () => {
    const crew = crewFixture();
    crew.counts.officialAboard = null;
    const html = renderToStaticMarkup(<CrewSummary crew={crew} onMember={() => {}} />);
    expect(html).toContain('Crew aboard: unavailable');
    expect(html).toContain('Last reported aboard count: 11');
    expect(html).not.toContain('<strong>9</strong>');
    expect(html).not.toContain('<strong>11</strong>');
  });
  it('renders zero count honestly and missing expedition/no resolved members', () => {
    const crew = crewFixture();
    crew.counts.officialAboard = 0;
    crew.expedition = null;
    crew.members = [];
    const html = renderToStaticMarkup(<CrewSummary crew={crew} onMember={() => {}} />);
    expect(html).toContain('<strong>0</strong>');
    expect(html).toContain('Expedition unavailable');
    expect(html).toContain('No resolved crew members');
  });
  it('renders unresolved reports without person IDs, profile buttons or invented roles', () => {
    const crew = crewFixture();
    const subject = crew.unresolvedSubjects[0];
    subject.applicable = false;
    subject.evidence.type = 'PERSON_DEPARTED_STATION';
    subject.resolution = 'AMBIGUOUS';
    const html = renderToStaticMarkup(<CrewSummary crew={crew} onMember={() => {}} />);
    const unresolved = html.slice(
      html.indexOf('aria-label="Unresolved source reports"'),
      html.indexOf('<details class="crew-sources"'),
    );
    expect(unresolved).toContain('Reported departure');
    expect(unresolved).toContain('Identity ambiguous');
    expect(unresolved).toContain('not currently applicable');
    expect(unresolved).not.toContain('<button');
    expect(unresolved).not.toContain('data-member-id');
    expect(unresolved).not.toContain('Flight Engineer');
  });
  it.each(Object.keys(PRESENCE) as PresenceState[])(
    'exposes exact presence label for %s without false confirmation',
    (state) => {
      const presence = { ...crewFixture().members[0].presence, state };
      expect(renderToStaticMarkup(<PresenceLabel presence={presence} />)).toContain(PRESENCE[state]);
    },
  );
  it('keeps source failure, stale flag, original observation and latest fetch distinct', () => {
    const crew = crewFixture();
    crew.freshness.stale = true;
    crew.freshness.verification.lastRefreshFailed = true;
    const html = renderToStaticMarkup(<CrewSummary crew={crew} onMember={() => {}} />);
    expect(html).toContain('Crew data may be outdated');
    expect(html).toContain('source refresh failed');
    expect(html).toContain('Original observation');
    expect(html).toContain('Last successful fetch');
  });
});
describe('partial/safe astronaut profiles', () => {
  it('escapes HTML-like biography and keeps cumulative durations distinct', () => {
    const person = personFixture();
    person.biography = '<script>alert(1)</script>\nBiography';
    const html = renderToStaticMarkup(<CrewProfile person={person} />);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('Career totals');
    expect(html).toContain('not elapsed time');
  });
  it('supports NASA-only/null profile fields without invented zeros or agency', () => {
    const person = personFixture();
    Object.assign(person, {
      career: null,
      biography: null,
      agency: null,
      image: null,
      nationalities: [],
      currentAssignment: null,
      profileAvailability: 'UNAVAILABLE',
    });
    const html = renderToStaticMarkup(<CrewProfile person={person} />);
    expect(html).toContain('Structured profile unavailable');
    expect(html).toContain('No structured assignment');
    expect(html).toContain('Career statistics unavailable');
    expect(html).not.toContain('0 s');
  });
  it('collapses a long biography and displays multiple nationalities', () => {
    const person = personFixture();
    person.biography = 'Long biography. '.repeat(200);
    person.nationalities.push({ displayName: 'Test nationality', alpha2: null, alpha3: null });
    const html = renderToStaticMarkup(<CrewProfile person={person} />);
    expect(html).toContain('Read biography');
    expect(html).toContain('Test nationality');
  });
  it('keeps portrait credit/license metadata and rejects restricted images', () => {
    const person = personFixture();
    person.image = crewFixture().members.find((m) => m.image?.singleUse)!.image;
    const html = renderToStaticMarkup(<CrewProfile person={person} />);
    expect(html).toContain('Portrait withheld');
    expect(html).toContain('Single-use restriction');
    const avatar = renderToStaticMarkup(<CrewPortrait media={person.image} name={person.name} />);
    expect(avatar).not.toContain('<img');
    expect(avatar).toContain('aria-hidden');
  });
});
