// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ReplayCrewPanel } from './ReplayCrewPanel';
import { CurrentCrewWorkspace } from '../crew/CurrentCrewWorkspace';
import { decodeReplay, type ReplayResult } from './replayApi';
import { replayFixture } from '../test/replayFixture';
import { crewFixture } from '../test/crewFixture';

// TEST-only retimed persisted fixtures, never application fallback data.
const t1 = '2026-10-03T12:00:00Z', t2 = '2026-10-02T12:00:00Z';
let node: HTMLDivElement, root: Root;
const close = vi.fn(), retry = vi.fn();
const motions: { element: HTMLElement; keys: any; options: any; cancel: ReturnType<typeof vi.fn> }[] = [];
function data(at = t1): ReplayResult {
  const input = replayFixture(at); input.crew.state.freshness.evaluatedAt = at;
  return decodeReplay(input, at);
}
beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  vi.useFakeTimers(); close.mockClear(); retry.mockClear(); motions.length = 0;
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(crewFixture())));
  Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: function(this: HTMLElement, keys: any, options: any) {
    const cancel = vi.fn(); motions.push({ element: this, keys, options, cancel }); return { cancel };
  } });
  node = document.createElement('div'); document.body.append(node); root = createRoot(node);
});
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); delete (HTMLElement.prototype as any).animate; });
async function show(result: ReplayResult | null = data(), at = result?.requestedAt ?? t1, request?: any) {
  await act(async () => root.render(<ReplayCrewPanel data={result} at={at} loading={false} error={null} onClose={close} request={request} />));
}
const rows = () => [...node.querySelectorAll<HTMLButtonElement>('[data-member-id]')];
const clickRow = async () => act(async () => rows()[0].click());
const clickProfile = async () => act(async () => rows().find(r => r.dataset.memberId === data().crew.profiles[0].id)!.click());
const escape = async () => act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));

it('uses only effective-time roster UUIDs, real counts and accepted assessment UTC', async () => {
  const result = data(); result.crew.state!.members = result.crew.state!.members.slice(0, 2);
  await show(result); expect(rows().map(b => b.dataset.memberId)).toEqual(result.crew.state!.members.map(m => m.id));
  expect(node.querySelector('.crew-assessment time')?.getAttribute('datetime')).toBe(t1);
  expect(node.querySelector('.crew-roster-summary')?.getAttribute('aria-label')).toBe('Historical Crew assessment');
  expect(node.querySelector('.crew-roster-summary dd')?.textContent).toBe(String(result.crew.state!.counts.officialAboard));
  expect(fetch).not.toHaveBeenCalled();
});
it('rejects an envelope for another UTC without borrowing a Current roster', async () => {
  await show(data(t1), t2); expect(rows()).toHaveLength(0); expect(node.textContent).toContain('No current roster is substituted');
});
it('never substitutes Current when historical coverage/state is unavailable', async () => {
  const result = data(); result.crew.state = null; result.crew.availability = 'UNAVAILABLE';
  result.crew.coverage.limitations = ['TEST ONLY coverage gap']; await show(result);
  expect(rows()).toHaveLength(0); expect(node.textContent).toContain('Crew history unavailable'); expect(node.textContent).toContain('TEST ONLY coverage gap'); expect(fetch).not.toHaveBeenCalled();
});
it('keeps a valid zero roster distinct from unavailable and transport error', async () => {
  const result = data(); result.crew.state!.members = [];
  Object.assign(result.crew.state!.counts, { officialAboard: 0, resolvedAboard: 0, unidentifiedAboard: 0 });
  await show(result); expect(rows()).toHaveLength(0); expect(node.querySelector('.crew-roster-empty')?.textContent).toContain('Historical UTC');
  expect(node.querySelector('.crew-roster-summary dd')?.textContent).toBe('0'); expect(node.querySelector('[role="alert"]')).toBeNull(); expect(node.querySelector('.crew-historical-unavailable')).toBeNull();
});
it('preserves the bottom profile evidence disclosure without an internal navigation shortcut', async () => {
  await show(); await clickProfile();
  const profile = node.querySelector('.crew-profile')!;
  const evidence = profile.lastElementChild as HTMLDetailsElement;
  expect(evidence.querySelector('summary')?.textContent).toBe('Profile source & presence evidence');
  expect([...profile.querySelectorAll('button,a')].some(e => e.textContent === 'Profile source & presence evidence')).toBe(false);
  await act(async () => evidence.querySelector('summary')!.click());
  expect(evidence.open).toBe(true); expect(evidence.textContent).not.toContain('Original profile observation');
});
it('retains partial/unresolved evidence separately from confirmed identities', async () => {
  const result = data(); result.crew.coverage.limitations = ['TEST ONLY assignment evidence incomplete']; await show(result);
  expect(node.textContent).toContain('Historical coverage partial'); expect(node.textContent).toContain('unresolved source reports');
  expect(node.textContent).toContain('Assignment alone does not confirm presence'); expect(node.textContent).toContain('TEST ONLY assignment evidence incomplete');
});
it('keeps latest-retained metadata explicit without pretending portraits/biographies were captured at T', async () => {
  await show(); expect(node.textContent).toContain('latest-retained metadata, not historical snapshots');
  await clickProfile(); expect(node.querySelector('.crew-profile')).not.toBeNull();
  expect(node.textContent).toContain('Career'); expect(node.textContent).toContain('latest retained metadata');
  expect(node.textContent).toContain('Assignment at replay time'); expect(fetch).not.toHaveBeenCalled();
});
it('keeps portrait failure presentation-only and resets to the next accepted Historical person without Current fallback', async () => {
  const first = data(t1), second = data(t2);
  first.crew.state!.members = [first.crew.state!.members[0]];
  second.crew.state!.members = [second.crew.state!.members[1]];
  const before = structuredClone(first), next = second.crew.state!.members[0];
  await show(first);
  for (let i = 0; i < 4 && node.querySelector('.crew-portrait img'); i++) {
    await act(async () => node.querySelector('.crew-portrait img')!.dispatchEvent(new Event('error')));
  }
  expect(node.querySelector('.crew-portrait img')).toBeNull(); expect(rows()).toHaveLength(1); expect(first).toEqual(before);
  await show(second);
  expect(rows()[0].dataset.memberId).toBe(next.id);
  expect(node.querySelector<HTMLImageElement>('.crew-portrait img')!.src).toBe(next.image!.thumbnailUrl ?? next.image!.url);
  expect(node.querySelector<HTMLImageElement>('.crew-portrait img')!.alt).toBe(`Portrait of ${next.name}`);
  expect(fetch).not.toHaveBeenCalled();
});
it('does not label historical presence/counts as Current confirmation', async () => {
  const result = data(); result.crew.state!.counts.officialAboard = null; await show(result);
  expect(node.querySelector('.crew-roster-summary')?.textContent).not.toContain('current count unverified');
  expect(rows().map(r => r.textContent).join()).not.toContain('Current confirmation unavailable');
  expect(node.textContent).toContain('at Historical UTC');
});
it('missing retained profile remains an explicit historical detail with no Current fetch fallback', async () => {
  const result = data(); result.crew.profiles = []; await show(result); await clickRow();
  expect(node.textContent).toContain('Historical profile unavailable'); expect(node.querySelector('.astronaut-dock')).toBeNull(); expect(fetch).not.toHaveBeenCalled();
});
it('Escape dismisses historical child first, restores row focus, then closes Crew', async () => {
  await show(); const id = rows()[0].dataset.memberId; await clickRow(); await escape();
  expect(close).not.toHaveBeenCalled(); expect(document.activeElement?.getAttribute('data-member-id')).toBe(id);
  await escape(); expect(close).toHaveBeenCalledOnce();
});
it('does not consume dialog or previously handled Escape', async () => {
  await show(); const dialog = document.createElement('div'); dialog.setAttribute('role', 'dialog'); node.querySelector('aside')!.append(dialog);
  await act(async () => dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))); expect(close).not.toHaveBeenCalled(); dialog.remove();
  const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); event.preventDefault();
  await act(async () => document.dispatchEvent(event)); expect(close).not.toHaveBeenCalled();
});
it('revalidates selected identity against the new accepted roster and focuses the Crew heading when absent', async () => {
  await show(); const selectedId = rows()[0].dataset.memberId; await clickRow();
  const next = data(t2); next.crew.state!.members = next.crew.state!.members.filter(m => m.id !== selectedId);
  await show(next); expect(node.querySelector('.crew-historical-detail')).toBeNull(); expect(rows()).toHaveLength(8);
  expect(document.activeElement?.id).toBe('replay-crew-title'); expect(node.querySelector('.crew-assessment time')?.getAttribute('datetime')).toBe(t2);
});
it('retains valid historical identity and uses its new effective-time detail after acceptance', async () => {
  await show(); await clickProfile(); const next = data(t2); await show(next);
  expect(node.querySelector('.crew-profile')).not.toBeNull(); expect(node.textContent).toContain('Effective at ' + t2);
});
it('keeps accepted roster/time while a different request is pending', async () => {
  await show(data(), t1, { historical: true, at: t2, pending: true, error: null, onRetry: retry });
  expect(rows()).toHaveLength(9); expect(node.querySelector('.crew-assessment time')?.getAttribute('datetime')).toBe(t1);
  expect(node.querySelector('[role="status"]')?.textContent).toContain('Resolving Historical target');
});
it('keeps accepted roster on seek error and invokes only the real retry callback', async () => {
  await show(data(), t1, { historical: true, at: t2, pending: true, error: 'HTTP 503', onRetry: retry });
  expect(rows()).toHaveLength(9); expect(node.querySelector('[role="alert"]')?.textContent).toContain('previous accepted context');
  await act(async () => [...node.querySelectorAll('button')].find(b => b.textContent === 'Retry historical crew')!.click()); expect(retry).toHaveBeenCalledOnce();
});
it.each([1, 3, 24])('supports %i historical members with long names/missions, nullable counts and missing portraits', async count => {
  const result = data(), original = result.crew.state!.members;
  result.crew.state!.members = Array.from({ length: count }, (_, i) => ({ ...original[i % original.length], id: 'TEST-only-' + i, externalIds: [], name: 'TEST ONLY long identity '.repeat(5), image: null }));
  result.crew.state!.expedition!.name = 'TEST ONLY historical mission '.repeat(5); result.crew.state!.counts.officialAboard = null;
  await show(result); expect(rows()).toHaveLength(count); expect(node.querySelectorAll('.crew-portrait img')).toHaveLength(0);
  expect(node.textContent).toContain('TEST ONLY historical mission'); expect(node.querySelector('.crew-count-unavailable')?.textContent).toBe('Unavailable');
});
it('does not add an internal Calendar/time bar or Earth controls to S9', async () => {
  await show(); expect(node.querySelector('.historical-time-bar,.historical-calendar,.earth-scene-controls')).toBeNull();
  expect(node.querySelectorAll('.crew-workspace.crew-historical')).toHaveLength(1);
  expect([...node.querySelectorAll('.crew-header-actions button')].map(b => b.getAttribute('aria-label'))).toEqual(['Close crew panel']);
  expect([...node.querySelectorAll('button')].some(b => /^(Refresh|Refreshing…)$/.test(b.textContent ?? ''))).toBe(false);
});
it('automatically refreshes on return to Current, retains a failed assessment and recovers through Retry', async () => {
  const fetchMock = vi.mocked(fetch); fetchMock.mockResolvedValueOnce(Response.json(crewFixture()))
    .mockResolvedValueOnce(new Response('', { status: 503 })).mockResolvedValueOnce(Response.json(crewFixture()));
  await act(async () => root.render(<CurrentCrewWorkspace open onClose={close} />));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await act(async () => root.render(<CurrentCrewWorkspace open onClose={close} historical={{ at: t1, data: data() }} />));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await act(async () => root.render(<CurrentCrewWorkspace open onClose={close} />));
  expect(fetchMock).toHaveBeenCalledTimes(2); expect(rows()).toHaveLength(crewFixture().members.length);
  expect(node.textContent).toContain('displayed assessment has not been updated');
  const retryCrew = [...node.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === 'Retry crew')!;
  await act(async () => retryCrew.click());
  expect(fetchMock).toHaveBeenCalledTimes(3); expect(node.querySelector('[role="alert"]')).toBeNull();
  expect(document.activeElement?.id).toBe('crew-title'); expect(rows()).toHaveLength(crewFixture().members.length);
});
it.each([false, true])('uses one coherent 200ms state-opacity group (reduced motion %s) and clears Current selection', async reduced => {
  vi.stubGlobal('matchMedia', () => ({ matches: reduced, addEventListener() {}, removeEventListener() {} }));
  await act(async () => root.render(<CurrentCrewWorkspace open onClose={close} />));
  const surface = node.querySelector('.crew-workspace-host'); await clickRow();
  await act(async () => root.render(<CurrentCrewWorkspace open onClose={close} historical={{ at: t1, data: data() }} />));
  expect(node.querySelector('.astronaut-dock')).toBeNull(); expect(node.querySelector('.crew-workspace-host')).toBe(surface);
  expect(node.querySelectorAll('.crew-panel')).toHaveLength(1); expect(document.activeElement?.id).toBe('replay-crew-title');
  const fade = motions.filter(m => m.element.classList.contains('crew-workspace-group')).at(-1)!;
  expect(fade.keys).toEqual({ opacity: [0, 1] }); expect(fade.options).toEqual({ duration: reduced ? 120 : 200, easing: reduced ? 'linear' : 'cubic-bezier(0.42,0,0.58,1)' });
  await act(async () => root.render(<CurrentCrewWorkspace open onClose={close} />));
  expect(node.querySelector('.crew-historical')).toBeNull(); expect(node.querySelector('.crew-roster-rows')).not.toBeNull();
  expect(document.activeElement?.id).toBe('crew-title');
});
it('cancels replaced accepted-time animations and keeps only the latest historical roster', async () => {
  await act(async () => root.render(<CurrentCrewWorkspace open onClose={close} />));
  for (const at of [t1, t2]) await act(async () => root.render(<CurrentCrewWorkspace open onClose={close} historical={{ at, data: data(at) }} />));
  const fades = motions.filter(m => m.element.classList.contains('crew-workspace-group'));
  expect(fades[0].cancel).toHaveBeenCalledOnce(); expect(node.querySelector('.crew-assessment time')?.getAttribute('datetime')).toBe(t2);
  expect(node.querySelectorAll('.crew-workspace')).toHaveLength(1);
});
it('retains the Historical roster alongside one detail surface and updates selection in place', async () => {
  await show(); const roster = node.querySelector('.crew-roster-rows'), first = rows()[0]; await clickRow();
  const detail = node.querySelector('.crew-historical-detail');
  expect(rows()).toHaveLength(data().crew.state!.members.length); expect(node.querySelector('.crew-roster-rows')).toBe(roster);
  expect(first.getAttribute('aria-pressed')).toBe('true');
  await act(async () => rows()[1].click());
  expect(node.querySelector('.crew-historical-detail')).toBe(detail);
  expect(detail?.getAttribute('data-entity-id')).toBe(rows()[1].dataset.memberId); expect(first.getAttribute('aria-pressed')).toBe('false');
  expect(fetch).not.toHaveBeenCalled();
});
it('shares icon-only Back and labeled Close in a structural header, with no astronaut select', async () => {
  await show(); await clickRow();
  const detail = node.querySelector('.crew-historical-detail')!, actions = detail.querySelector('.crew-detail-actions')!;
  const back = actions.querySelector<HTMLButtonElement>('[aria-label="Back to Crew"]')!;
  expect(back.textContent).toBe(''); expect(back.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  expect(actions.querySelector('[aria-label="Close astronaut detail"]')).not.toBeNull();
  expect(actions.parentElement).toBe(detail.querySelector('header')); expect(detail.querySelector('select')).toBeNull();
  expect(document.activeElement?.id).toBe('historical-astronaut-title');
});
it.each(['Back to Crew', 'Close astronaut detail'])('%s restores the Historical selected row without dismissing Crew', async label => {
  await show(); const first = rows()[0], roster = node.querySelector('.crew-roster-rows'); await clickRow();
  await act(async () => node.querySelector<HTMLButtonElement>(`.crew-historical-detail [aria-label="${label}"]`)!.click());
  expect(node.querySelector('.crew-historical-detail')).toBeNull(); expect(document.activeElement).toBe(first);
  expect(node.querySelector('.crew-roster-rows')).toBe(roster); expect(close).not.toHaveBeenCalled();
});
it('preserves Historical profile and selected identity across resize without fetching Current data', async () => {
  await show(); await clickProfile();
  const detail = node.querySelector('.crew-historical-detail'), profile = node.querySelector('.crew-profile'), id = detail?.getAttribute('data-entity-id');
  for (const width of [390, 768, 820, 1024, 740, 320, 1440]) {
    await act(async () => { Object.defineProperty(window, 'innerWidth', { value: width, configurable: true }); window.dispatchEvent(new Event('resize')); });
    expect(node.querySelector('.crew-historical-detail')).toBe(detail); expect(node.querySelector('.crew-profile')).toBe(profile);
    expect(node.querySelector('.crew-roster-row[aria-pressed="true"]')?.getAttribute('data-member-id')).toBe(id);
  }
  expect(fetch).not.toHaveBeenCalled();
});
