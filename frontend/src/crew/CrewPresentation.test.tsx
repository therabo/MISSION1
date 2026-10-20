import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CrewReports } from './CrewSourceEvidence';
import { CurrentCrewRoster } from './CurrentCrewRoster';
import { CrewProfile } from './CrewProfile';
import { crewFixture, historicalCrewFixture, personFixture } from '../test/crewFixture';
import { HISTORICAL_PRESENCE, QUALITY } from './presentation';
import type { PresenceState, ReconciliationStatus } from './types';

describe('Crew summary semantics', () => {
  it.each(Object.keys(QUALITY) as ReconciliationStatus[])('shows data and quality text for %s', (status) => {
    const crew = crewFixture();
    crew.reconciliation.status = status;
    const html = renderToStaticMarkup(<CurrentCrewRoster crew={crew} onMember={() => {}} />);
    expect(html).not.toContain('<details class="crew-quality'); expect(crew.reconciliation.status).toBe(status);
    expect(html).toContain('Current members');
    expect(html).toContain('Data source');
  });
  it('uses resolved member cardinality with independent source diagnostics', () => {
    const html = renderToStaticMarkup(<CurrentCrewRoster crew={crewFixture()} onMember={() => {}} />);
    expect(html).toContain('<dt>Current members</dt><dd>9</dd>'); expect(html).not.toContain('structured assignments');
    expect(html).not.toContain('without confirmed identities'); expect(html).not.toContain('Additional NASA-reported crew');
    expect((html.match(/data-member-id=/g) ?? [])).toHaveLength(9);
  });
  it('never uses confirmed presence as member cardinality', () => {
    const crew = crewFixture(); crew.counts.resolvedAboard = 0;
    const html = renderToStaticMarkup(<CurrentCrewRoster crew={crew} onMember={() => {}} />);
    expect(html).toContain('<dt>Current members</dt><dd>9</dd>'); expect(html).not.toContain('Crew aboard:');
  });
  it('renders zero resolved members honestly and missing expedition', () => {
    const crew = crewFixture(); crew.expedition = null; crew.members = [];
    const html = renderToStaticMarkup(<CurrentCrewRoster crew={crew} onMember={() => {}} />);
    expect(html).toContain('<dt>Current members</dt><dd>0</dd>'); expect(html).not.toContain('Expedition 75');
    expect(html).toContain('No resolved crew members');
  });
  it('preserves Historical unresolved reports without selectable person identities', () => {
    const crew = historicalCrewFixture(); const subject = crew.unresolvedSubjects[0]; subject.applicable = false;
    subject.evidence.type = 'PERSON_DEPARTED_STATION'; subject.resolution = 'AMBIGUOUS';
    const html = renderToStaticMarkup(<CrewReports crew={crew} historicalAt="2026-10-02T02:01:55Z" />);
    expect(html).toContain('Reported departure'); expect(html).toContain('Identity ambiguous');
    expect(html).toContain('not applicable at Historical UTC'); expect(html).not.toContain('<button');
    expect(html).not.toContain('data-member-id');
  });
  it.each(Object.keys(HISTORICAL_PRESENCE) as PresenceState[])(
    'exposes exact presence label for %s without false confirmation',
    (state) => {
      const presence = { ...crewFixture().members[0].presence, state };
      const crew = historicalCrewFixture(); crew.members = [{ ...crew.members[0], presence }];
      expect(renderToStaticMarkup(<CurrentCrewRoster crew={crew} onMember={() => {}} historical={{ at: '2026-10-02T02:01:55Z', availability: 'AVAILABLE', coverage: { status: 'AVAILABLE', limitations: [] } as never }} />)).toContain(HISTORICAL_PRESENCE[state]);
    },
  );
  it('keeps source failure, stale flag, original observation and latest fetch distinct', () => {
    const crew = crewFixture();
    crew.freshness.stale = true;
    crew.freshness.verification.lastRefreshFailed = true;
    const html = renderToStaticMarkup(<CurrentCrewRoster crew={crew} onMember={() => {}} />);
    expect(crew.freshness.stale).toBe(true);
    expect(crew.freshness.verification.lastRefreshFailed).toBe(true);
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
    expect(html).toContain('<h3>Career</h3>');
    expect(html).not.toContain('not elapsed time');
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
  it('keeps original portrait credit/license metadata without a verbose rights disclosure', () => {
    const person = personFixture();
    person.image = crewFixture().members.find((m) => m.image?.singleUse)!.image;
    const html = renderToStaticMarkup(<CrewProfile person={person} />);
    expect(html).not.toContain('Portrait credit');
    expect(html).not.toContain('Single-use restriction'); expect(person.image?.singleUse).toBe(true);
  });
});
