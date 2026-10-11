import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { crewFixture, historicalCrewFixture } from '../test/crewFixture';
import { decodeCrew } from './decode';
import { CurrentCrewRoster } from './CurrentCrewRoster';
import { CrewSources } from './CrewSummary';

function active() {
  const crew = crewFixture();
  crew.members = crew.members.slice(0, 7);
  crew.counts.resolvedAboard = 0;
  crew.membership = { mode: 'ACTIVE_PROJECTION', revision: 3, evaluatedAt: '2026-10-11T00:17:26Z', policyVersion: 'TEST_ONLY', health: 'DEGRADED', ageSeconds: 32000, resolvedCurrentMembers: 7, nonPublishableActive: 0, canonicalCollisions: 0, unresolvedActiveSourceSlots: 8 };
  return crew;
}
describe('Current active membership contract', () => {
  it('decodes optional committed membership and preserves independent counts', () => {
    const c = decodeCrew(active());
    expect(c.membership?.revision).toBe(3);
    expect(c.members).toHaveLength(7);
    expect(c.counts).not.toHaveProperty('officialAboard');
    expect(c.counts).not.toHaveProperty('unidentifiedAboard');
    expect(c.counts.resolvedAboard).toBe(0);
    expect(decodeCrew(crewFixture()).membership).toBeUndefined();
  });
  it.each(['UNAVAILABLE', 'LEGACY_RETAINED_UNION'])('rejects unsupported successful metadata %s', (value) => {
    const c = active();
    expect(() => decodeCrew({ ...c, membership: { ...c.membership, health: value } })).toThrow();
  });
  it('shows seven Current members with source-slot diagnostics', () => {
    const html = renderToStaticMarkup(<CurrentCrewRoster crew={active()} onMember={() => {}} />);
    expect(html).toContain('<dt>Current members</dt><dd>7</dd>');
    expect(html).toContain('Membership and physical presence are separate');
    expect(html).not.toContain('<dt>Reported aboard');
    expect(html).toContain('Unavailable');
    expect((html.match(/data-member-id=/g) ?? [])).toHaveLength(7);
    const source = renderToStaticMarkup(<CrewSources crew={active()} />);
    expect(source).toContain('degraded');
    expect(source).toContain('8 unresolved active source slots');
    expect(source).toContain('0 identities have current confirmation');
  });
  it('keeps Historical labels and counts independent of optional Current metadata', () => {
    const html = renderToStaticMarkup(<CurrentCrewRoster crew={{...historicalCrewFixture(), counts: {...historicalCrewFixture().counts, resolvedAboard:0}}} onMember={() => {}} historical={{ at: '2026-10-02T02:01:55Z', availability: 'AVAILABLE', coverage: { status: 'AVAILABLE', limitations: [] } as never }} />);
    expect(html).toContain('<dt>Confirmed identities</dt><dd>0</dd>');
    expect(html).not.toContain('<dt>Current members</dt>');
    expect(html).not.toContain('Current membership evaluated');
  });
});
