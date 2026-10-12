// @vitest-environment jsdom
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { crewFixture, personFixture } from '../test/crewFixture';
import { CurrentCrewRoster } from './CurrentCrewRoster';
import { CrewSources } from './CrewSummary';
import { CrewAstronautDock } from './CrewAstronautDock';
import { CrewProfile } from './CrewMemberDetail';
import { utc } from './presentation';
import type { CrewPerson } from './types';

const resource = vi.hoisted(() => ({ data: null as CrewPerson | null }));
vi.mock('../api/useCrewResource', () => ({ useCrewMember: () => ({ ...resource, loading: false, error: null, refresh: vi.fn() }) }));
const dom = (html: string) => { const root = document.createElement('div'); root.innerHTML = html; return root; };
const removed = ['Membership and physical presence are separate', 'Current membership is source-supported', 'Available last-known information is retained', 'Data source & freshness', 'Source-supported membership; operational evidence is separate.', 'Operational presence evidence', 'Structured assignment does not confirm presence aboard.', 'Cumulative source totals; not elapsed time on this expedition.', 'Career totals / cumulative', 'Portrait credit & rights', 'Profile context', 'Profile observation', 'Original profile observation', 'Reuse permission unavailable'];
beforeEach(() => { resource.data = null; Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); });

describe('branding and compact Crew presentation', () => {
  it('uses one full-resolution transparent canonical PNG in README and application', () => {
    const asset = readFileSync('public/branding/MISSION1-logo.png');
    expect(asset.subarray(1, 4).toString()).toBe('PNG');
    expect(asset.readUInt32BE(16)).toBe(2172); expect(asset.readUInt32BE(20)).toBe(724);
    expect(createHash('sha256').update(asset).digest('hex')).toBe('1e24b1ad4e9f0a79eb1f8a85e2ce7d0d3aeb8ee1935e62f305542350d5e3339f');
    expect(asset[25]).toBe(6); // RGBA PNG, no downscale.
    const readme = readFileSync('../README.md', 'utf8');
    expect(readme).toContain('src="frontend/public/branding/MISSION1-logo.png"');
    expect(readme).not.toContain('src="MISSION1-logo.png"');
    const app = readFileSync('src/App.tsx', 'utf8');
    expect(app).toContain('import.meta.env.BASE_URL}branding/MISSION1-logo.png');
  });
  it('places both summary values above the divider and all members before Data source', () => {
    const root = dom(renderToStaticMarkup(<CurrentCrewRoster crew={crewFixture()} onMember={() => {}} />));
    const summary = root.querySelector('.crew-roster-summary')!;
    expect([...summary.querySelectorAll('dt')].map(n => n.textContent)).toEqual(['Current members', 'Last update']);
    expect(summary.querySelector('.crew-last-update')).not.toBeNull();
    const sources = root.querySelector('.crew-data-source')!;
    for (const row of root.querySelectorAll('[data-member-id]')) expect(row.compareDocumentPosition(sources) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(root.querySelector('.crew-roster-evidence')).toBeNull();
    for (const text of removed) expect(root.textContent).not.toContain(text);
  });
  it.each(['structuredSource', 'verification'] as const)('renders changing %s source facts independently and without diagnostic suffixes', source => {
    // TEST ONLY values deliberately differ from the user's examples.
    const crew = crewFixture();
    const snapshot = structuredClone(crew);
    crew.freshness[source].lastSuccessfulFetchAt = '2031-02-03T04:05:06Z';
    crew.freshness[source].sourceState = 'TEST_CHANGED_STATE';
    crew.freshness[source].stale = true; crew.freshness[source].lastRefreshFailed = true;
    crew.provenance[source] = { ...crew.provenance[source]!, observedAt: '2030-01-02T03:04:05Z', sourcePublishedAt: '2029-02-03T04:05:06Z' };
    const root = dom(renderToStaticMarkup(<CrewSources crew={crew} />));
    const group = root.querySelectorAll('.crew-source-group')[source === 'structuredSource' ? 0 : 1];
    expect([...group.querySelectorAll('dt')].map(n => n.textContent)).toEqual(['Last successful fetch', 'Source state', 'Original observation', 'Published']);
    expect([...group.querySelectorAll('dd')].map(n => n.textContent)).toEqual(['2031-02-03 04:05:06 UTC', 'test changed state', '2030-01-02 03:04:05 UTC', '2029-02-03 04:05:06 UTC']);
    expect(group.textContent).not.toContain('outdated'); expect(group.textContent).not.toContain('refresh failed');
    expect(crew.freshness[source].lastRefreshFailed).toBe(true);
    expect(crew.provenance.contributingAssertions).toEqual(snapshot.provenance.contributingAssertions);
    expect(crew.members).toEqual(snapshot.members);
  });
  it('uses truthful unavailable values for absent observation, publication and fetch', () => {
    const crew = crewFixture(); crew.provenance.structuredSource = null;
    crew.freshness.structuredSource.sourceState = null; crew.freshness.structuredSource.lastSuccessfulFetchAt = null;
    const group = dom(renderToStaticMarkup(<CrewSources crew={crew} />)).querySelector('.crew-source-group')!;
    expect([...group.querySelectorAll('dd')].map(n => n.textContent)).toEqual(Array(4).fill('Unavailable'));
    expect(group.querySelector('a')).toBeNull();
  });
  it('keeps two primary source groups and dynamically renders reconciliation and source references', () => {
    const crew = crewFixture(); crew.reconciliation.reconciledAt = '2031-02-03T04:05:06Z';
    const root = dom(renderToStaticMarkup(<CrewSources crew={crew} />));
    expect(root.querySelector('summary')?.textContent).toBe('Data source');
    expect([...root.querySelectorAll('.crew-source-group h3')].map(n => n.textContent)).toEqual(['Structured roster · Launch Library 2', 'NASA verification']);
    expect(root.querySelectorAll('.crew-source-group')).toHaveLength(2);
    expect(root.querySelector('.crew-source-reconciled')?.textContent).toBe(`Reconciled ${utc(crew.reconciliation.reconciledAt)}`);
    for (const [index, source] of (['structuredSource', 'verification'] as const).entries()) {
      const a = root.querySelectorAll<HTMLAnchorElement>('.crew-source-group a')[index];
      expect(a.href).toBe(crew.provenance[source]?.sourceUrl);
      expect(a.getAttribute('aria-label')).toContain('source reference'); expect(a.tabIndex).toBe(0);
      expect(a.rel).toBe('noopener noreferrer');
    }
    expect(root.querySelector('details')?.open).toBe(false); expect(root.querySelector('details > summary')?.textContent).toBe('Data source');
  });
  it('restores the native, initially collapsed source disclosure and supports opening and closing', async () => {
    const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
    try {
      await act(async () => root.render(<CrewSources crew={crewFixture()} />));
      const disclosure = host.querySelector('details')!, summary = disclosure.querySelector('summary')!;
      expect(disclosure.open).toBe(false); expect(summary.textContent).toBe('Data source');
      expect(summary.parentElement).toBe(disclosure); expect(summary.querySelector('button,a')).toBeNull();
      await act(async () => summary.click()); expect(disclosure.open).toBe(true);
      expect(disclosure.querySelectorAll('.crew-source-group')).toHaveLength(2);
      await act(async () => summary.click()); expect(disclosure.open).toBe(false);
    } finally { await act(async () => root.unmount()); host.remove(); }
  });
  it('preserves an open source disclosure when real source values refresh', async () => {
    const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
    try {
      const crew = crewFixture(); await act(async () => root.render(<CrewSources crew={crew} />));
      const disclosure = host.querySelector('details')!; await act(async () => disclosure.querySelector('summary')!.click());
      const refreshed = structuredClone(crew); refreshed.freshness.verification.lastSuccessfulFetchAt = '2031-04-05T06:07:08Z';
      await act(async () => root.render(<CrewSources crew={refreshed} />));
      expect(host.querySelector('details')).toBe(disclosure); expect(disclosure.open).toBe(true);
      expect(disclosure.textContent).toContain('2031-04-05 06:07:08 UTC'); expect(crew.freshness.verification).not.toEqual(refreshed.freshness.verification);
    } finally { await act(async () => root.unmount()); host.remove(); }
  });
  it('keeps essential provenance after an empty roster' , () => {
    const crew = crewFixture(); crew.members = [];
    const root = dom(renderToStaticMarkup(<CurrentCrewRoster crew={crew} onMember={() => {}} />));
    expect(root.querySelector('.crew-roster-empty')?.compareDocumentPosition(root.querySelector('.crew-data-source')!)! & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it('keeps Role then one Nationality in Structured assignment and career values unchanged', () => {
    const crew = crewFixture(), member = crew.members[0]; resource.data = { ...personFixture(), id: member.id };
    const before = structuredClone(resource.data);
    const root = dom(renderToStaticMarkup(<CrewAstronautDock crew={crew} member={member} onClose={() => {}} />));
    const section = [...root.querySelectorAll('section')].find(s => s.querySelector('h3')?.textContent === 'Structured assignment')!;
    expect([...section.querySelectorAll('dt')].map(n => n.textContent)).toEqual(['Role', 'Nationality']);
    expect(root.querySelectorAll('dt').length).toBeGreaterThan(2);
    expect([...root.querySelectorAll('dt')].filter(n => n.textContent === 'Nationality')).toHaveLength(1);
    expect(root.textContent).toContain('Career'); expect(root.textContent).toContain('Time in space');
    for (const text of [...removed, 'Current membership']) expect(root.textContent).not.toContain(text);
    expect(resource.data).toEqual(before);
    expect(resource.data.image).toEqual(before.image); expect(resource.data.currentPresence).toEqual(before.currentPresence);
  });
  it('uses roster nationality before the lazy profile arrives', () => {
    const crew = crewFixture(), member = crew.members[0];
    member.nationalities = [{ displayName: 'TEST nationality', alpha2: null, alpha3: null }];
    const root = dom(renderToStaticMarkup(<CrewAstronautDock crew={crew} member={member} onClose={() => {}} />));
    expect(root.textContent).toContain('TEST nationality');
  });
  it.each([null, true])('hides the dedicated reuse-permission caption while retaining singleUse=%s portrait metadata', singleUse => {
    const crew = crewFixture(), member = crew.members[0];
    resource.data = { ...personFixture(), id: member.id };
    resource.data.image = { ...resource.data.image!, credit: 'TEST rights credit', singleUse };
    const before = structuredClone(resource.data);
    const current = dom(renderToStaticMarkup(<CrewAstronautDock crew={crew} member={member} onClose={() => {}} />));
    expect(current.querySelector('.astronaut-portrait-identity small')).toBeNull();
    expect(current.querySelector('.astronaut-portrait-identity img')).toBeNull();
    expect(current.textContent).toContain('Portrait unavailable');
    const historical = dom(renderToStaticMarkup(<CrewProfile person={resource.data} replayAt="2026-10-03T12:00:00Z" historicalMember={member} />));
    for (const text of removed) { expect(current.textContent).not.toContain(text); expect(historical.textContent).not.toContain(text); }
    expect(resource.data).toEqual(before);
  });
  it('keeps Historical canonical profile metadata and Career without returning removed disclosures', () => {
    const person = personFixture();
    const root = dom(renderToStaticMarkup(<CrewProfile person={person} replayAt="2026-10-03T12:00:00Z" historicalMember={crewFixture().members[0]} />));
    expect(root.textContent).toContain('latest retained canonical metadata');
    expect(root.querySelector('.crew-career h3')?.textContent).toBe('Career');
    expect([...root.querySelectorAll('dt')].some(n => n.textContent === 'Nationality')).toBe(false);
    for (const text of removed) expect(root.textContent).not.toContain(text);
  });
});
