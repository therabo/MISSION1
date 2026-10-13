import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { crewFixture, historicalCrewFixture } from '../test/crewFixture';
import { decodeCrew, decodeHistoricalCrew } from './decode';
import { CurrentCrewRoster } from './CurrentCrewRoster';
import { CrewSources } from './CrewSourceEvidence';
import { CrewAstronautDock } from './CrewAstronautDock';

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
    expect((html.slice(0, html.indexOf('</dl>')).match(/<dt>/g) ?? [])).toHaveLength(2);
    expect((html.match(/data-member-id=/g) ?? [])).toHaveLength(7);
    expect(html).not.toContain('<dt>Reported aboard');
    expect(html).not.toContain('Without confirmed identity');
    expect(html).not.toContain('Additional NASA-reported crew');
    expect(html).not.toContain('Current membership is source-supported');
  });
  it('keeps only eight ACTIVE slots in source details, never summing fifteen retained slots', () => {
    const crew = decodeCrew(wire());
    const html = renderToStaticMarkup(<CrewSources crew={crew} />);
    expect(html).not.toContain('unresolved active source slots'); expect(crew.membership?.unresolvedActiveSourceSlots).toBe(8);
    expect(html).not.toContain('sources may repeat a person');
    expect(html).not.toContain('15 unresolved'); expect(html).not.toContain('23 unresolved');
    expect(crew.membership).not.toHaveProperty('unresolvedRetainedSourceSlots');
  });
  it('shows uniform Current membership and dated evidence separately in roster and detail', () => {
    const crew=decodeCrew(wire()), member=crew.members[0];
    for(const node of [<CurrentCrewRoster crew={crew} onMember={()=>{}}/>]) {
      const html=renderToStaticMarkup(node); expect(html).toContain('Current member');
      expect(html).toContain('No recent operational confirmation'); expect(html).toContain('2026-10-02 02:01:55 UTC');
      expect(html).not.toContain('Identity confirmed');
    }
    const detail=renderToStaticMarkup(<CrewAstronautDock crew={crew} member={member} onClose={()=>{}}/>);
    expect(detail).not.toContain('Current membership'); expect(detail).not.toContain('Operational presence evidence');
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
    expect(html).not.toContain('Current membership is source-supported');
  });
  it('retains negative operational confirmation without implying aboard', () => {
    const presence = { ...decodeCrew(wire()).members[0].presence, lastKnownState: 'CONFIRMED_NOT_ABOARD' as const };
    const crew = historicalCrewFixture(); crew.members = [{ ...crew.members[0], presence }];
    const html = renderToStaticMarkup(<CurrentCrewRoster crew={crew} onMember={() => {}} historical={{ at: '2026-10-02T02:01:55Z', availability: 'AVAILABLE', coverage: { status: 'AVAILABLE', limitations: [] } as never }} />);
    expect(html).toContain('Last known: confirmed not aboard');
    expect(html).not.toContain('Last known: confirmed aboard');
    expect(html).toContain('state-stale');
  });
});
