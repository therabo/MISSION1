import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CurrentCrewRoster } from './CurrentCrewRoster';
import { crewFixture, historicalCrewFixture } from '../test/crewFixture';
import { PRESENCE, QUALITY, utc, operationalAnnotation } from './presentation';
import type { PresenceState, ReconciliationStatus } from './types';

const render = (crew = crewFixture()) => renderToStaticMarkup(<CurrentCrewRoster crew={crew} onMember={() => {}} />);
describe('S7 assessment and roster presentation', () => {
  it('shows membership cardinality separately from presence and assignments', () => {
    const html = render();
    expect(html).toContain('Current members</dt><dd>9');
    expect(html).not.toContain('<dt>Reported aboard'); expect(html).not.toContain('Without confirmed identity');
    expect(html).not.toContain('structured assignments'); expect((html.match(/data-member-id=/g) ?? [])).toHaveLength(9);
  });
  it('does not use confirmed presence as Current membership cardinality', () => {
    const crew = crewFixture(); crew.counts.resolvedAboard = 0;
    expect(render(crew)).toContain('Current members</dt><dd>9');
  });
  it('supports missing structured counts without inventing zero', () => {
    const crew = crewFixture(); crew.counts.structuredAssignments = null;
    expect(render(crew)).not.toContain('structured assignments'); expect(crew.counts.structuredAssignments).toBeNull();
  });
  it('reports empty resolved membership while preserving source context', () => {
    const crew = crewFixture(); crew.members = []; crew.expedition = null;
    const html = render(crew); expect(html).toContain('Current members</dt><dd>0');
    expect(html).toContain('No resolved crew members are available'); expect(html).not.toContain('data-member-id=');
    expect(html).toContain('Data source');
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
    const html = render(crew); expect(html).toContain('Current member'); expect(html).toContain(operationalAnnotation(crew.members[0].presence, crew.freshness.evaluatedAt).label); expect(html).toContain(crew.members[0].assignment!.role);
  });
  it.each(Object.keys(QUALITY) as ReconciliationStatus[])('keeps %s evidence and warnings available', status => {
    const crew = crewFixture(); crew.reconciliation.status = status;
    const html = render(crew); expect(html).toContain('<summary>Data source</summary>'); expect(crew.reconciliation.status).toBe(status);
  });
  it('keeps unresolved reports read-only, without inventing selectable person identities', () => {
    const crew = crewFixture(); crew.members = []; const html = render(crew);
    expect(html).not.toContain('Additional NASA-reported crew'); expect(html).not.toContain('data-member-id');
    expect(html).not.toContain('open profile');
  });
  it('preserves assessment UTC, source observation UTC, refresh failures and stale warnings', () => {
    const crew = crewFixture(); crew.freshness.stale = true; crew.freshness.verification.lastRefreshFailed = true;
    const html = render(crew); expect(html).not.toContain('ASSESSMENT UTC'); expect(html).not.toContain(`Evaluated ${utc(crew.freshness.evaluatedAt)}`);
    expect(html).toContain('Original observation'); expect(html).toContain('Last successful fetch');
    expect(crew.freshness.verification.lastRefreshFailed).toBe(true); expect(crew.freshness.stale).toBe(true);
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
describe('compact Current metadata and successful source update time', () => {
  it.each(['structuredSource', 'verification'] as const)('uses the newest successful %s fetch, independent of assertion, observation or evaluation times', source => {
    const crew = crewFixture();
    crew.freshness.structuredSource.lastSuccessfulFetchAt = '2026-10-02T08:00:00Z';
    crew.freshness.verification.lastSuccessfulFetchAt = '2026-10-02T08:00:00Z';
    crew.freshness[source].lastSuccessfulFetchAt = '2026-10-04T11:22:33.123456Z';
    crew.freshness.evaluatedAt = '2026-10-09T12:00:00Z';
    crew.reconciliation.reconciledAt = '2026-10-08T12:00:00Z';
    const html = render(crew), update = html.slice(html.indexOf('class="crew-last-update"'), html.indexOf('</dd>', html.indexOf('class="crew-last-update"')));
    expect(update).toContain('Last update'); expect(update).toContain('2026-10-04T11:22:33.123456Z');
    expect(update).not.toContain('2026-10-09'); expect(update).not.toContain('2026-10-08');
    expect(html).not.toContain('Latest retained assertion'); expect(html).not.toContain('ASSESSMENT UTC');
  });
  it('a newer failed attempt leaves the last successful update intact and keeps the source warning', () => {
    const crew = crewFixture();
    crew.freshness.structuredSource.lastSuccessfulFetchAt = '2026-10-04T11:22:33Z';
    crew.freshness.verification.lastSuccessfulFetchAt = null;
    crew.freshness.structuredSource.lastAttemptAt = '2026-10-09T12:00:00Z';
    crew.freshness.structuredSource.lastAttemptResult = 'SOURCE_RESULT';
    crew.freshness.structuredSource.lastRefreshFailed = true;
    const html = render(crew);
    expect(html).toContain('<time dateTime="2026-10-04T11:22:33Z">');
    expect(crew.freshness.structuredSource.lastRefreshFailed).toBe(true);
  });
  it('shows unavailable without a successful fetch rather than borrowing a valid assertion or assessment time', () => {
    const crew = crewFixture();
    crew.freshness.structuredSource.lastSuccessfulFetchAt = null; crew.freshness.verification.lastSuccessfulFetchAt = null;
    const html = render(crew);
    expect(html).toContain('<dt>Last update</dt><dd>Unavailable</dd>');
    expect(html).not.toContain('Supporting source assertions'); expect(html).toContain('Original observation');
  });
  it('ignores malformed update times without inventing a replacement date', () => {
    const crew = crewFixture();
    crew.freshness.structuredSource.lastSuccessfulFetchAt = 'TEST invalid'; crew.freshness.verification.lastSuccessfulFetchAt = null;
    expect(render(crew)).toContain('<dt>Last update</dt><dd>Unavailable</dd>');
  });
  it('keeps Historical assessment, retained count and assertion dates explicit without a Current update label', () => {
    const crew = historicalCrewFixture(); crew.counts.officialAboard = null;
    const at = '2026-10-02T12:00:00Z';
    const html = renderToStaticMarkup(<CurrentCrewRoster crew={crew} onMember={() => {}} historical={{at,availability:'PARTIAL',coverage:{status:'PARTIAL',start:null,end:null,intervals:[],limitations:[]}}} />);
    expect(html).toContain('ASSESSMENT UTC'); expect(html).toContain(`dateTime="${at}"`);
    expect(html).toContain('count unverified at Historical UTC'); expect(html).toContain('Latest retained assertion');
    expect(html).not.toContain('crew-last-update');
  });
});
