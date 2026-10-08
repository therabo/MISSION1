import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CurrentCrewRoster } from './CurrentCrewRoster';
import { crewFixture } from '../test/crewFixture';
import { PRESENCE, QUALITY } from './presentation';
import type { PresenceState, ReconciliationStatus } from './types';

const render = (crew = crewFixture()) => renderToStaticMarkup(<CurrentCrewRoster crew={crew} onMember={() => {}} />);
describe('S7 assessment and roster presentation', () => {
  it('keeps reported, confirmed, unidentified and assignment counts distinct', () => {
    const html = render();
    expect(html).toContain('Reported aboard</dt><dd>11'); expect(html).toContain('Confirmed identities</dt><dd>8');
    expect(html).toContain('Without confirmed identity</dt><dd>3'); expect(html).toContain('7 structured assignments');
    expect((html.match(/data-member-id=/g) ?? []).length).toBe(9);
  });
  it('does not present retained count or roster length as a current reported count', () => {
    const crew = crewFixture(); crew.counts.officialAboard = null;
    const html = render(crew); expect(html).toContain('Unavailable</dd>'); expect(html).toContain('Last reported: 11');
    expect(html).toContain('current count unverified'); expect(html).toContain('In the retained count');
    expect(html).not.toContain('Reported aboard</dt><dd>9'); expect(html).not.toContain('Reported aboard</dt><dd>11');
  });
  it('supports missing current and retained counts without inventing zero', () => {
    const crew = crewFixture(); crew.counts.officialAboard = null; crew.counts.lastKnownOfficialAboard = null;
    const html = render(crew); expect(html).toContain('Unavailable</dd>'); expect(html).not.toContain('Last reported:');
  });
  it('reports legitimate zero and empty roster while retaining evidence', () => {
    const crew = crewFixture(); crew.counts.officialAboard = 0; crew.members = []; crew.expedition = null;
    const html = render(crew); expect(html).toContain('Reported aboard</dt><dd>0');
    expect(html).toContain('No resolved crew members are available'); expect(html).not.toContain('data-member-id=');
    expect(html).toContain('unresolved source reports');
  });
  it('supports long names, missing identity text and more than the screenshot row count', () => {
    const crew = crewFixture(); crew.members = Array.from({length:31}, (_,i) => ({...crew.members[0], id:`TEST-only-${i}`, name: i ? 'Long TEST astronaut identity '.repeat(10) : null}));
    const html = render(crew); expect((html.match(/data-member-id=/g) ?? []).length).toBe(31);
    expect(html).toContain('Name unavailable'); expect(html).toContain('TEST-only-30');
  });
  it('keeps agency and mission unavailable when no structured assignment exists', () => {
    const crew = crewFixture(); crew.members = [{...crew.members[0], assignment:null, agency:null, image:null}];
    const html = render(crew); expect(html).toContain('No structured assignment'); expect(html).toContain('Unavailable'); expect(html).not.toContain('Photo:');
  });
  it('does not assign the current expedition name to a different assignment id', () => {
    const crew = crewFixture(); crew.members = [{...crew.members[0], assignment:{...crew.members[0].assignment!,expeditionId:'TEST-other-expedition'}}];
    const html = render(crew); expect(html).not.toContain('Expedition 75'); expect(html).toContain('Unavailable');
  });
  it.each(Object.keys(PRESENCE) as PresenceState[])('retains exact %s meaning independently from role', state => {
    const crew = crewFixture(); crew.members = [{...crew.members[0],presence:{...crew.members[0].presence,state,lastKnownState:'CONFIRMED_NOT_ABOARD'}}];
    const html = render(crew); expect(html).toContain(PRESENCE[state]); expect(html).toContain(crew.members[0].assignment!.role);
    if (state === 'STALE') expect(html).toContain('Last known: confirmed not aboard');
  });
  it.each(Object.keys(QUALITY) as ReconciliationStatus[])('keeps %s evidence and warnings available', status => {
    const crew = crewFixture(); crew.reconciliation.status = status;
    const html = render(crew); expect(html).toContain(QUALITY[status].note); expect(html).toContain('Data sources &amp; freshness');
  });
  it('keeps unresolved reports read-only, without inventing selectable person identities', () => {
    const crew = crewFixture(); crew.members = []; const html = render(crew);
    expect(html).toContain('Identity unresolved'); expect(html).not.toContain('data-member-id');
    expect(html).not.toContain('open profile');
  });
  it('preserves assessment UTC, source observation UTC, refresh failures and stale warnings', () => {
    const crew = crewFixture(); crew.freshness.stale = true; crew.freshness.verification.lastRefreshFailed = true;
    const html = render(crew); expect(html).toMatch(new RegExp(`date[Tt]ime="${crew.freshness.evaluatedAt.replaceAll('.','\\.')}"`));
    expect(html).toContain('Original observation'); expect(html).toContain('Last successful fetch');
    expect(html).toContain('source refresh failed'); expect(html).toContain('Crew data may be outdated');
  });
  it('uses the existing portrait permissions and exposes credit only for permitted media', () => {
    const crew = crewFixture(); const denied = crew.members.find(m=>m.image?.singleUse)!, allowed=crew.members.find(m=>m.image?.singleUse===false)!;
    crew.members=[denied]; expect(render(crew)).not.toContain('<img src="'+denied.image!.url); expect(render(crew)).not.toContain('Photo:');
    crew.members=[allowed]; expect(render(crew)).toContain('Portrait of'); expect(render(crew)).toContain('Photo:');
  });
  it('exposes profile button identity, keyboard semantics and separately described role/presence', () => {
    const crew = crewFixture(); const html=render(crew);
    expect(html).toContain('type="button"'); expect(html).toContain(`data-member-id="${crew.members[0].id}"`);
    expect(html).toContain(`aria-describedby="crew-context-${crew.members[0].id} crew-presence-${crew.members[0].id}"`);
    expect(html).not.toContain('tabindex="-1"');
  });
});
