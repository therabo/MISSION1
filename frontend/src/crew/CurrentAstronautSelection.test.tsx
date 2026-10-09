// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CurrentCrewWorkspace } from './CurrentCrewWorkspace';
import { CurrentCrewPanelView } from './CurrentCrewPanel';
import { crewFixture, personFixture } from '../test/crewFixture';
import type { CrewMember, CrewPerson, CurrentCrew } from './types';

let root: Root, node: HTMLDivElement, fetchMock: ReturnType<typeof vi.fn>;
const close = vi.fn();
const motions: { element: HTMLElement; keys: any; options: any; cancel: ReturnType<typeof vi.fn> }[] = [];
const crew = () => crewFixture();
function profile(member: CrewMember): CrewPerson {
  return { ...personFixture(), id: member.id, name: member.name, currentAssignment: member.assignment, currentPresence: member.presence };
}
beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  vi.useFakeTimers(); vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  node = document.createElement('div'); document.body.append(node); root = createRoot(node); close.mockClear(); motions.length = 0;
  fetchMock = vi.fn().mockImplementation((url: string) => Promise.resolve(Response.json(url === '/api/iss/crew' ? crew() : profile(crew().members.find(m => url.endsWith(m.id))!))));
  vi.stubGlobal('fetch', fetchMock);
  Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: function(this: HTMLElement, keys: any, options: any) { const cancel = vi.fn(); motions.push({ element: this, keys, options, cancel }); return { cancel }; } });
});
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); delete (HTMLElement.prototype as any).animate; });
const show = async (open = true) => act(async () => root.render(<CurrentCrewWorkspace open={open} onClose={close} />));
const showPanel = async (data: CurrentCrew = crew()) => act(async () => root.render(<CurrentCrewPanelView
  resource={{ data, loading: false, error: null, refresh: vi.fn() }} onClose={close} interactive />));
const rows = () => [...node.querySelectorAll<HTMLButtonElement>('.crew-roster-row')];
const dock = () => node.querySelector<HTMLElement>('.astronaut-dock')!;
const press = async (name: string) => act(async () => [...node.querySelectorAll<HTMLButtonElement>('button')].find(b => b.getAttribute('aria-label') === name || b.textContent === name)!.click());
const select = async (index = 0) => act(async () => rows()[index].click());
const settleExit = async () => act(async () => vi.advanceTimersByTimeAsync(240));
const selected = () => rows().filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.memberId);

it.each(crewFixture().members.map(member => member.id))('selects real recorded UUID %s generically without a fixed example', async id => {
  await show(); const row = rows().find(b => b.dataset.memberId === id)!; await act(async () => row.click());
  expect(dock().dataset.entityId).toBe(id); expect(selected()).toEqual([id]); expect(dock().querySelector('h2')?.textContent).toBe(row.querySelector('strong')?.textContent);
  expect(fetchMock.mock.calls.map(call => call[0])).toEqual(['/api/iss/crew', `/api/iss/crew/${id}`]);
});
it('has no dock or reserved selected state in base Crew', async () => { await show(); expect(dock()).toBeNull(); expect(node.querySelector('.has-astronaut')).toBeNull(); expect(selected()).toEqual([]); });
it('keeps the exact roster, rows, resource and scroll container mounted through selection and close', async () => {
  await show(); const list = node.querySelector('.crew-roster-rows'), content = node.querySelector('.crew-panel-content')!, first = rows()[0]; content.scrollTop = 318;
  await select(); expect(node.querySelector('.crew-roster-rows')).toBe(list); expect(rows()[0]).toBe(first); expect(content.scrollTop).toBe(318);
  await press('Close astronaut detail'); await settleExit(); expect(node.querySelector('.crew-roster-rows')).toBe(list); expect(node.querySelector('.crew-panel-content')).toBe(content); expect(content.scrollTop).toBe(318);
  expect(fetchMock.mock.calls.filter(c => c[0] === '/api/iss/crew')).toHaveLength(1); expect(selected()).toEqual([]); expect(dock()).toBeNull(); expect(close).not.toHaveBeenCalled();
});
it('focuses a meaningful nonmodal heading without trapping focus and restores its initiating row', async () => {
  await show(); const row = rows()[1]; row.focus(); await select(1); expect(document.activeElement).toBe(dock().querySelector('h2'));
  expect(dock().getAttribute('role')).toBe('region'); expect(dock().hasAttribute('aria-modal')).toBe(false);
  rows()[2].focus(); expect(document.activeElement).toBe(rows()[2]); await press('Close astronaut detail'); expect(document.activeElement).toBe(row);
});
it('marks selection separately from focus using aria-pressed and stable UUIDs', async () => { await show(); await select(2); rows()[0].focus(); expect(selected()).toEqual([rows()[2].dataset.memberId]); expect(document.activeElement).toBe(rows()[0]); });
it('loads profiles locally while all roster rows remain usable', async () => {
  fetchMock.mockImplementationOnce(() => Promise.resolve(Response.json(crew()))).mockImplementation(() => new Promise(() => {})); await show(); await select();
  expect(dock().textContent).toContain('Loading astronaut profile'); expect(rows()).toHaveLength(9); expect(rows().every(b => !b.disabled)).toBe(true); expect(dock().querySelectorAll('[role="status"]')).toHaveLength(1);
});
it('updates the same dock after the real profile resolves', async () => {
  let resolve!: (r: Response) => void; fetchMock.mockResolvedValueOnce(Response.json(crew())).mockImplementationOnce(() => new Promise<Response>(r => { resolve = r; })); await show(); await select(); const same = dock();
  const member = crew().members.find(m => m.id === same.dataset.entityId)!; await act(async () => resolve(Response.json(profile(member)))); expect(dock()).toBe(same); expect(dock().textContent).toContain('Career totals / cumulative'); expect(dock().textContent).not.toContain('Loading astronaut profile');
});
it.each([404,500,503])('isolates HTTP%s in the selected dock and retries only the profile', async status => {
  fetchMock.mockResolvedValueOnce(Response.json(crew())).mockResolvedValueOnce(new Response('', { status })); await show(); await select(); const same = dock(), id = same.dataset.entityId;
  expect(same.querySelector('[role="alert"]')).not.toBeNull(); expect(rows()).toHaveLength(9); expect(selected()).toEqual([id]); await press('Retry profile');
  expect(dock()).toBe(same); expect(dock().textContent).toContain('Career totals / cumulative'); expect(fetchMock.mock.calls.filter(c => c[0] === '/api/iss/crew')).toHaveLength(1);
});
it('does not fabricate a missing profile, biography, career or portrait', async () => {
  const m = crew().members[0], person = { ...profile(m), profileAvailability: 'UNAVAILABLE', biography: null, career: null, image: null, profileProvenance: null };
  fetchMock.mockResolvedValueOnce(Response.json(crew())).mockResolvedValueOnce(Response.json(person)); await show(); await act(async () => rows().find(b => b.dataset.memberId === m.id)!.click());
  expect(dock().textContent).toContain('Structured profile unavailable'); expect(dock().textContent).toContain('Biography unavailable'); expect(dock().textContent).toContain('Career statistics unavailable'); expect(dock().querySelector('img')).toBeNull(); expect(selected()).toEqual([m.id]);
});
it('withholds portraits under the original rights rules', async () => {
  const m = crew().members[0], person = profile(m); person.image = { url:'https://example.com/portrait.jpg', thumbnailUrl:null, credit:'NASA', licenseName:'NASA Image and Media Guidelines', licenseUrl:'https://www.nasa.gov/nasa-brand-center/images-and-media/', singleUse:true };
  fetchMock.mockResolvedValueOnce(Response.json(crew())).mockResolvedValueOnce(Response.json(person)); await show(); await act(async () => rows().find(b => b.dataset.memberId === m.id)!.click()); expect(dock().querySelector('img')).toBeNull(); expect(dock().textContent).toContain('Reuse permission unavailable'); expect(dock().textContent).toContain('Single-use restriction: Yes');
});
it('keeps identity and credit when a permitted portrait fails', async () => {
  const m = crew().members.find(m => m.image?.singleUse === false)!, person = profile(m); person.image = m.image;
  fetchMock.mockResolvedValueOnce(Response.json(crew())).mockResolvedValueOnce(Response.json(person)); await show(); await act(async () => rows().find(b => b.dataset.memberId === m.id)!.click()); const image = dock().querySelector('img')!;
  expect(image.alt).toBe(`Portrait of ${m.name}`); await act(async () => image.dispatchEvent(new Event('error', { bubbles:true }))); expect(dock().querySelector('img')).toBeNull(); expect(dock().textContent).toContain('image failed to load'); expect(selected()).toEqual([m.id]);
});
it('treats a different permitted profile portrait as loading after the roster portrait loaded', async () => {
  const m = crew().members.find(m => m.image?.singleUse === false)!, person = profile(m);
  person.image = { ...m.image!, url:'https://example.com/updated-portrait.jpg', thumbnailUrl:null };
  let resolve!:(r:Response)=>void;
  fetchMock.mockResolvedValueOnce(Response.json(crew())).mockImplementationOnce(() => new Promise<Response>(r => { resolve=r; }));
  await show(); await act(async () => rows().find(b => b.dataset.memberId === m.id)!.click());
  await act(async () => dock().querySelector('img')!.dispatchEvent(new Event('load', { bubbles:true })));
  await act(async () => resolve(Response.json(person)));
  expect(dock().textContent).toContain('Loading portrait'); expect(dock().querySelector('img')!.src).toBe(person.image.url);
  await act(async () => dock().querySelector('img')!.dispatchEvent(new Event('load', { bubbles:true })));
  expect(dock().textContent).not.toContain('Loading portrait'); expect(selected()).toEqual([m.id]);
});
it.each([
  ['CONFIRMED_NOT_ABOARD', 'Confirmed absence in Crew assessment'],
  ['AMBIGUOUS', 'Conflicting or unresolved evidence'],
] as const)('preserves the roster %s meaning in profile presence', async (state, label) => {
  const updated = crew(); updated.members[0].presence.state = state;
  fetchMock.mockResolvedValueOnce(Response.json(updated)); await show();
  await act(async () => rows().find(b => b.dataset.memberId === updated.members[0].id)!.click());
  expect(dock().querySelector('.astronaut-presence')!.textContent).toContain(label);
});
it('preserves assignment vs presence, source observation vs fetch, and cumulative duration semantics', async () => {
  await show(); await select(); const text = dock().textContent!; expect(text).toContain('Structured assignment does not confirm presence'); expect(text).toContain('not elapsed time on this expedition'); expect(text).toContain('Profile last successful fetch'); expect(text).toContain('Original profile observation'); expect(text).toContain('Profile assessment');
});
it('keeps the bottom evidence disclosure usable without a redundant shortcut or reserved footer button', async () => {
  await show(); await select(); const evidence = [...dock().querySelectorAll('details')].find(d => d.querySelector('summary')?.textContent === 'Profile source & presence evidence')!;
  expect([...dock().querySelectorAll('button,a')].some(e => e.textContent === 'Profile source & presence evidence')).toBe(false);
  expect(evidence.parentElement?.lastElementChild).toBe(evidence);
  await act(async () => evidence.querySelector('summary')!.click()); expect(evidence.open).toBe(true);
  expect(evidence.textContent).toContain('Profile last successful fetch');
  expect(evidence.textContent).toContain('Original profile observation');
  expect(evidence.querySelector('a')?.textContent).toContain('Profile source');
  expect(dock().querySelector('footer button')).toBeNull();
  expect(dock().querySelector('footer')?.textContent).toContain('Profile observation');
  expect([...dock().querySelectorAll('button,a,summary')].some(e => e.textContent === 'Career history & evidence')).toBe(false);
});
it('switches A→B without recreating dock or roster, and moves one selected row', async () => {
  await show(); await select(); const same = dock(), roster = node.querySelector('.crew-roster-rows'); await select(1); expect(dock()).toBe(same); expect(node.querySelector('.crew-roster-rows')).toBe(roster); expect(selected()).toEqual([rows()[1].dataset.memberId]); expect(dock().dataset.entityId).toBe(rows()[1].dataset.memberId);
});
it('aborts A→B→C and ignores every late A/B response and error', async () => {
  const requests: {resolve:(r:Response)=>void; reject:(e:Error)=>void; signal:AbortSignal; member:CrewMember}[] = [];
  fetchMock.mockImplementation((url:string, options:any) => url === '/api/iss/crew' ? Promise.resolve(Response.json(crew())) : new Promise<Response>((resolve,reject) => requests.push({resolve,reject,signal:options.signal,member:crew().members.find(m => url.endsWith(m.id))!})));
  await show(); await select(); await select(1); await select(2); const same = dock(); expect(requests[0].signal.aborted).toBe(true); expect(requests[1].signal.aborted).toBe(true); expect(requests[2].signal.aborted).toBe(false);
  const c = { ...profile(requests[2].member), biography:'TEST ONLY — latest C profile' }; await act(async () => requests[2].resolve(Response.json(c)));
  await act(async () => requests[0].resolve(Response.json({ ...profile(requests[0].member), biography:'TEST ONLY — obsolete A' }))); await act(async () => requests[1].reject(new Error('TEST ONLY — obsolete error')));
  expect(dock()).toBe(same); expect(dock().textContent).toContain(c.biography); expect(dock().textContent).not.toContain('obsolete'); expect(dock().textContent).not.toContain('Loading astronaut profile'); expect(selected()).toEqual([requests[2].member.id]);
});
it('retains a valid UUID when the supplied roster updates without a new profile request', async () => {
  await showPanel(); await select(); const id = dock().dataset.entityId, same = dock(); const changed = crew(); changed.members.pop();
  await showPanel(changed); expect(rows()).toHaveLength(changed.members.length); expect(selected()).toEqual([id]); expect(dock()).toBe(same); expect(fetchMock.mock.calls.filter(c => c[0] === `/api/iss/crew/${id}`)).toHaveLength(1);
});
it('clears a disappeared UUID when the supplied roster updates and restores stable Crew focus', async () => {
  await showPanel(); await select(); const id = dock().dataset.entityId; const changed = crew(); changed.members = changed.members.filter(m => m.id !== id); await showPanel(changed);
  expect(selected()).toEqual([]); expect(dock().hasAttribute('inert')).toBe(true); expect(document.activeElement?.id).toBe('crew-title'); await settleExit(); expect(dock()).toBeNull();
});
it('Escape consumes one level per event, from detail or exposed scene', async () => {
  await show(); await select(); const event = () => new KeyboardEvent('keydown', { key:'Escape',bubbles:true,cancelable:true }); await act(async () => dock().querySelector('h2')!.dispatchEvent(event())); expect(close).not.toHaveBeenCalled(); expect(selected()).toEqual([]);
  await act(async () => document.dispatchEvent(event())); expect(close).toHaveBeenCalledOnce();
});
it('close aborts the pending profile after its inert bounded exit and cannot resurrect it', async () => {
  let resolve!:(r:Response)=>void; fetchMock.mockResolvedValueOnce(Response.json(crew())).mockImplementationOnce(() => new Promise<Response>(r => {resolve=r;})); await show(); await select(); const signal = fetchMock.mock.calls[1][1].signal;
  await press('Close astronaut detail'); expect(dock().hasAttribute('inert')).toBe(true); await settleExit(); expect(signal.aborted).toBe(true); await act(async () => resolve(Response.json(personFixture()))); expect(dock()).toBeNull(); expect(node.querySelector('.crew-workspace')).not.toBeNull();
});
it('close during entry / reopen B during exit cannot remove the active B dock', async () => {
  await show(); await select(); const same = dock(); await press('Close astronaut detail'); await act(async () => vi.advanceTimersByTimeAsync(50)); await select(1); await settleExit(); expect(dock()).toBe(same); expect(dock().dataset.state).toBe('open'); expect(dock().hasAttribute('inert')).toBe(false); expect(selected()).toEqual([rows()[1].dataset.memberId]);
});
it('A→B during entry does not replay the dock animation or rebuild the active surface', async () => {
  await show(); await select(); const count = motions.filter(m => m.element.classList.contains('astronaut-dock')).length; await select(1); expect(motions.filter(m => m.element.classList.contains('astronaut-dock'))).toHaveLength(count); expect(dock().dataset.entityId).toBe(rows()[1].dataset.memberId);
});
it('uses the approved 240ms enter and 200ms exit with only opacity/x', async () => {
  await show(); await select(); let motion = motions.filter(m => m.element.classList.contains('astronaut-dock')).at(-1)!; expect(motion.keys).toEqual({opacity:[0,1],transform:['translateX(16px)','translateX(0px)']}); expect(motion.options).toEqual({duration:240,easing:'cubic-bezier(0,0,.58,1)'});
  await press('Close astronaut detail'); motion = motions.filter(m => m.element.classList.contains('astronaut-dock')).at(-1)!; expect(motion.options.duration).toBe(200); expect(motion.options.easing).toBe('cubic-bezier(.42,0,1,1)'); expect(motion.keys.transform.at(-1)).toBe('translateX(16px)');
});
it('uses <=120ms opacity only under reduced motion with the same selection lifecycle', async () => {
  vi.stubGlobal('matchMedia', () => ({ matches:true,addEventListener(){},removeEventListener(){} })); await show(); await select(); const motion = motions.filter(m => m.element.classList.contains('astronaut-dock')).at(-1)!; expect(motion.keys).toEqual({opacity:[0,1]}); expect(motion.options).toEqual({duration:120,easing:'linear'}); expect(dock().style.transform).toBe('none'); await press('Close astronaut detail'); await act(async () => vi.advanceTimersByTimeAsync(120)); expect(dock()).toBeNull();
});
it('unmounting Current cancels its profile and a later Current workspace starts with no selection', async () => {
  fetchMock.mockResolvedValueOnce(Response.json(crew())).mockImplementationOnce(() => new Promise(() => {})); await show(); await select(); const signal = fetchMock.mock.calls[1][1].signal; await act(async () => root.render(<div>Historical legacy</div>)); expect(signal.aborted).toBe(true); await show(); expect(dock()).toBeNull(); expect(selected()).toEqual([]);
});
it('removes the astronaut selector entirely, including its focusable control', async () => {
  await show(); await select();
  expect(dock().querySelector('select')).toBeNull();
  expect(node.querySelector('[aria-label="Select crew member"]')).toBeNull();
});
it('uses an accessible icon-only Back in the same action row as Close, before the title visually', async () => {
  await show(); await select();
  const actions = dock().querySelector('.crew-detail-actions')!;
  const back = actions.querySelector<HTMLButtonElement>('[aria-label="Back to Crew"]')!;
  expect(back.textContent).toBe('');
  expect(back.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  expect(back.querySelector('svg')?.getAttribute('focusable')).toBe('false');
  expect(actions.querySelector('[aria-label="Close astronaut detail"]')).not.toBeNull();
  expect(actions.parentElement).toBe(dock().querySelector('header'));
});
it('Back clears detail and restores the selected roster row without closing Crew', async () => {
  await show(); await select(1); const row = rows()[1], roster = node.querySelector('.crew-roster-rows');
  await press('Back to Crew'); await settleExit();
  expect(dock()).toBeNull(); expect(document.activeElement).toBe(row);
  expect(node.querySelector('.crew-roster-rows')).toBe(roster); expect(close).not.toHaveBeenCalled();
});
it('keeps roster, selected UUID, profile DOM, scroll and lazy request across resize events', async () => {
  await show(); await select(1);
  const same = dock(), body = same.querySelector('.astronaut-profile-body')!, roster = node.querySelector('.crew-roster-rows'), id = same.dataset.entityId;
  body.scrollTop = 160; const requests = fetchMock.mock.calls.length;
  for (const width of [390, 768, 820, 1024, 740, 320, 1440]) {
    await act(async () => { Object.defineProperty(window, 'innerWidth', { value: width, configurable: true }); window.dispatchEvent(new Event('resize')); });
    expect(dock()).toBe(same); expect(dock().querySelector('.astronaut-profile-body')).toBe(body);
    expect(node.querySelector('.crew-roster-rows')).toBe(roster); expect(selected()).toEqual([id]); expect(body.scrollTop).toBe(160);
  }
  expect(fetchMock).toHaveBeenCalledTimes(requests);
});
