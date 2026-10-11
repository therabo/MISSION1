import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { crewFixture, historicalCrewFixture } from '../test/crewFixture';
import { decodeCrew, decodeHistoricalCrew } from './decode';
import { CurrentCrewRoster } from './CurrentCrewRoster';
import { CrewSources, CrewSummary, PresenceLabel } from './CrewSummary';
import { CrewAstronautDock } from './CrewAstronautDock';
import { CURRENT_PRESENCE_NOTICE } from './presentation';

// TEST ONLY: equivalent to the recorded production cut, not a runtime data source.
function wire(gap = 11) {
  const legacy = historicalCrewFixture();
  const current = crewFixture();
  current.members = current.members.slice(0, 7).map(m => ({ ...m, presence: {
    ...m.presence, state: 'STALE' as const, lastKnownState: 'CONFIRMED_ABOARD' as const,
    asOf: '2026-10-02T02:01:55Z',
  } }));
  return { ...current, counts: { ...legacy.counts, resolvedAboard: 0, unidentifiedAboard: gap },
    unresolvedSubjects: legacy.unresolvedSubjects,
    membership: { mode: 'ACTIVE_PROJECTION', revision: 3, evaluatedAt: '2026-10-11T00:17:26Z',
      policyVersion: 'TEST_ONLY', health: 'DEGRADED', ageSeconds: 32000, resolvedCurrentMembers: 7,
      nonPublishableActive: 0, canonicalCollisions: 0, unresolvedActiveSourceSlots: 8,
      unresolvedRetainedSourceSlots: 15 } };
}

describe('Current semantics against the observed operational gap', () => {
  it.each([11, 7])('never turns legacy gap %s or retained reports into unidentified Current people', gap => {
    const crew = decodeCrew(wire(gap));
    expect(crew.counts).toEqual({ resolvedAboard: 0, structuredAssignments: 7 });
    expect(crew).not.toHaveProperty('unresolvedSubjects');
    const html = renderToStaticMarkup(<CurrentCrewRoster crew={crew} onMember={() => {}} />);
    expect(html).toContain('<dt>Current members</dt><dd>7</dd>');
    expect((html.slice(0, html.indexOf('</dl>')).match(/<dt>/g) ?? [])).toHaveLength(1);
    expect((html.match(/data-member-id=/g) ?? [])).toHaveLength(7);
    expect(html).not.toContain('<dt>Reported aboard');
    expect(html).not.toContain('Without confirmed identity');
    expect(html).not.toContain('Additional NASA-reported crew');
    expect(html).toContain(CURRENT_PRESENCE_NOTICE);
    const summary = renderToStaticMarkup(<CrewSummary crew={crew} onMember={() => {}} />);
    expect(summary).toContain('Current members <strong>7</strong>');
    expect(summary).not.toContain('without confirmed identities');
  });
  it('keeps only eight ACTIVE slots in source details, never summing fifteen retained slots', () => {
    const crew = decodeCrew(wire());
    const html = renderToStaticMarkup(<CrewSources crew={crew} />);
    expect(html).toContain('8 unresolved active source slots');
    expect(html).toContain('sources may repeat a person');
    expect(html).not.toContain('15 unresolved'); expect(html).not.toContain('23 unresolved');
    expect(crew.membership).not.toHaveProperty('unresolvedRetainedSourceSlots');
  });
  it('shows stale operational confirmation and its timestamp in row, label and detail', () => {
    const crew = decodeCrew(wire()), member = crew.members[0];
    for (const node of [<CurrentCrewRoster crew={crew} onMember={() => {}} />,
      <PresenceLabel presence={member.presence} />,
      <CrewAstronautDock crew={crew} member={member} onClose={() => {}} />]) {
      const html = renderToStaticMarkup(node);
      expect(html).toContain('Presence not currently confirmed');
      expect(html).toContain('Last operational confirmation: aboard');
      expect(html).toContain('2026-10-02 02:01:55 UTC');
      expect(html).not.toContain('Presence outdated'); expect(html).not.toContain('Last known:');
    }
    expect(renderToStaticMarkup(<CrewAstronautDock crew={crew} member={member} onClose={() => {}} />))
      .toContain('Structured assignment does not confirm presence aboard.');
  });
  it('preserves Historical count/report decoding and stale presentation', () => {
    const historical = historicalCrewFixture();
    historical.members[0].presence.state = 'STALE';
    historical.members[0].presence.lastKnownState = 'CONFIRMED_ABOARD';
    expect(decodeHistoricalCrew(historical)).toEqual(historical);
    const html = renderToStaticMarkup(<CurrentCrewRoster crew={historical} onMember={() => {}}
      historical={{ at: '2026-10-02T02:01:55Z', availability: 'AVAILABLE', coverage: { status: 'AVAILABLE', limitations: [] } as never }} />);
    expect(html).toContain('Reported aboard</dt><dd>11');
    expect(html).toContain('Without confirmed identity</dt><dd>3');
    expect(html).toContain('Presence outdated'); expect(html).toContain('Last known: confirmed aboard');
    expect(html).not.toContain(CURRENT_PRESENCE_NOTICE);
  });
  it('retains negative operational confirmation without implying aboard', () => {
    const presence = { ...decodeCrew(wire()).members[0].presence, lastKnownState: 'CONFIRMED_NOT_ABOARD' as const };
    const html = renderToStaticMarkup(<PresenceLabel presence={presence} />);
    expect(html).toContain('Last operational confirmation: not aboard');
    expect(html).not.toContain('Last operational confirmation: aboard');
    expect(html).toContain('state-stale');
  });
});
