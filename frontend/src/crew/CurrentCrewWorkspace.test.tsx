// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CurrentCrewWorkspace } from './CurrentCrewWorkspace';
import { crewFixture, personFixture } from '../test/crewFixture';
import { CURRENT_CREW_REFRESH_MS } from '../api/useCrewResource';

let root: Root, node: HTMLDivElement, fetchMock: ReturnType<typeof vi.fn>;
const close = vi.fn(), motions: { keys: any; options: any; cancel: ReturnType<typeof vi.fn> }[] = [];
beforeEach(() => {
  Object.defineProperty(globalThis,'IS_REACT_ACT_ENVIRONMENT',{value:true,configurable:true});
  vi.useFakeTimers(); vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener(){},removeEventListener(){}}));
  node=document.createElement('div');document.body.append(node);root=createRoot(node);close.mockClear();motions.length=0;
  fetchMock=vi.fn().mockResolvedValue(Response.json(crewFixture()));vi.stubGlobal('fetch',fetchMock);
  Object.defineProperty(HTMLElement.prototype,'animate',{configurable:true,value:(keys:any,options:any)=>{const cancel=vi.fn();motions.push({keys,options,cancel});return {cancel};}});
});
afterEach(async()=>{await act(async()=>root.unmount());node.remove();vi.useRealTimers();vi.unstubAllGlobals();delete (HTMLElement.prototype as any).animate;});
const show = async (open=true) => act(async()=>root.render(<CurrentCrewWorkspace open={open} onClose={close} />));
const button = (name:string) => [...node.querySelectorAll('button')].find(b=>b.textContent===name || b.getAttribute('aria-label')===name)!;
const click = async (name:string) => act(async()=>button(name).click());
it('does not request Crew until opened and uses the real cancellable Crew resource',async()=>{
  await show(false);expect(fetchMock).not.toHaveBeenCalled();await show();expect(fetchMock.mock.calls[0][0]).toBe('/api/iss/crew');
  expect(node.querySelectorAll('.crew-workspace')).toHaveLength(1);expect(document.activeElement?.id).toBe('crew-title');
  expect(node.querySelectorAll('[data-member-id]')).toHaveLength(9);
});
it('keeps the final shell present during loading without fake astronaut rows',async()=>{
  fetchMock.mockImplementation(()=>new Promise(()=>{}));await show();expect(node.querySelector('.crew-workspace')).not.toBeNull();
  expect(node.textContent).toContain('Loading crew information');expect(node.querySelectorAll('[data-member-id]')).toHaveLength(0);
});
it('reports real HTTP error and retry immediately without remounting the workspace',async()=>{
  fetchMock.mockResolvedValueOnce(new Response('',{status:503})).mockResolvedValueOnce(Response.json(crewFixture()));await show();const surface=node.querySelector('.crew-workspace');
  expect(node.querySelector('[role="alert"]')).not.toBeNull();await click('Retry crew');expect(node.querySelector('.crew-workspace')).toBe(surface);
  expect(node.querySelectorAll('[data-member-id]')).toHaveLength(9);expect(fetchMock).toHaveBeenCalledTimes(2);
});
it('offers only Close in the Crew header and no routine Refresh action',async()=>{
  await show();expect([...node.querySelectorAll('.crew-header-actions button')].map(b=>b.getAttribute('aria-label'))).toEqual(['Close crew panel']);
  expect([...node.querySelectorAll('button')].some(b=>/^(Refresh|Refreshing…)$/.test(b.textContent ?? ''))).toBe(false);
});
it('polls Current every two minutes while open',async()=>{
  await show();await act(async()=>vi.advanceTimersByTimeAsync(300000));expect(fetchMock).toHaveBeenCalledTimes(3);
});
it.each([1440,390])('automatically displays 7→11→7 and clears a departing selection at width%s',async width=>{
  vi.stubGlobal('innerWidth',width);
  const initial=crewFixture(); initial.members=initial.members.slice(0,7);
  const expanded=crewFixture();expanded.members=Array.from({length:11},(_,i)=>i<7?initial.members[i]:({...initial.members[0],id:`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`,name:`TEST ONLY arrival ${i}`}));
  const reduced={...expanded,members:expanded.members.slice(4)};let current=initial;
  fetchMock.mockImplementation((url:string)=>Promise.resolve(Response.json(url==='/api/iss/crew'?current:personFixture())));
  await show();const canvasContext=node.querySelector('.crew-workspace-host');const selected=initial.members[0].id;
  await act(async()=>node.querySelector<HTMLButtonElement>(`[data-member-id="${selected}"]`)!.click());
  current=expanded;await act(async()=>vi.advanceTimersByTimeAsync(CURRENT_CREW_REFRESH_MS));
  expect(node.querySelectorAll('[data-member-id]')).toHaveLength(11);expect(node.querySelector('.has-astronaut')).not.toBeNull();
  expect(node.querySelector('[data-selected-member-id]')?.getAttribute('data-selected-member-id')).toBe(selected);
  current=reduced;await act(async()=>vi.advanceTimersByTimeAsync(CURRENT_CREW_REFRESH_MS));
  await act(async()=>vi.advanceTimersByTimeAsync(240));
  expect(node.querySelectorAll('[data-member-id]')).toHaveLength(7);expect(node.querySelector('.has-astronaut')).toBeNull();
  expect(node.querySelector('.crew-workspace-host')).toBe(canvasContext);expect(document.activeElement?.id).toBe('crew-title');
  expect(new Set([...node.querySelectorAll<HTMLElement>('[data-member-id]')].map(e=>e.dataset.memberId)).size).toBe(7);
});
it('aborts pending requests after bounded inert exit and cannot resurrect a dismissed panel',async()=>{
  let complete:(r:Response)=>void=()=>{};fetchMock.mockImplementation(()=>new Promise<Response>(r=>{complete=r;}));await show();
  const signal=fetchMock.mock.calls[0][1].signal;await show(false);expect(node.querySelector('.crew-workspace-host')?.hasAttribute('inert')).toBe(true);
  await act(async()=>vi.advanceTimersByTimeAsync(200));expect(signal.aborted).toBe(true);expect(node.querySelector('.crew-panel')).toBeNull();
  await act(async()=>complete(Response.json(crewFixture())));expect(node.querySelector('.crew-panel')).toBeNull();
});
it('preserves one workspace and its real resource across close/reopen before exit completes',async()=>{
  await show();const surface=node.querySelector('.crew-panel');await show(false);await act(async()=>vi.advanceTimersByTimeAsync(80));await show();
  await act(async()=>vi.advanceTimersByTimeAsync(400));expect(node.querySelector('.crew-panel')).toBe(surface);expect(node.querySelectorAll('.crew-panel')).toHaveLength(1);
  expect(fetchMock).toHaveBeenCalledTimes(1);expect(document.activeElement?.id).toBe('crew-title');
});
it('uses 240/200ms opacity-only, once-per-trigger motion and cancels replaced animations',async()=>{
  await show();expect(motions[0].keys).toEqual({opacity:[0,1]});expect(motions[0].options.duration).toBe(240);
  await show(false);expect(motions[0].cancel).toHaveBeenCalledOnce();expect(motions.at(-1)!.keys).toEqual({opacity:[1,0]});expect(motions.at(-1)!.options.duration).toBe(200);
  expect(motions.every(m=>Object.keys(m.keys).join()==='opacity')).toBe(true);
});
it('uses <=120ms opacity-only under reduced motion with identical data behavior',async()=>{
  vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener(){},removeEventListener(){}}));await show();expect(motions[0].options).toEqual({duration:120,easing:'linear'});
  await show(false);await act(async()=>vi.advanceTimersByTimeAsync(120));expect(node.querySelector('.crew-panel')).toBeNull();expect(fetchMock).toHaveBeenCalledTimes(1);
});
it('keeps the roster mounted with real lazy dock, close focus and roster scroll',async()=>{
  const crew=crewFixture(),member=crew.members.find(m=>m.assignment?.roleCode==='COMMANDER')!, person=personFixture();person.id=member.id;person.name=member.name;
  fetchMock.mockResolvedValueOnce(Response.json(crew)).mockResolvedValueOnce(Response.json(person));await show();
  node.querySelector('.crew-panel-content')!.scrollTop=345;
  const row=node.querySelector<HTMLButtonElement>(`[data-member-id="${member.id}"]`)!;await act(async()=>row.click());
  expect(node.querySelector('.crew-workspace')).not.toBeNull();expect(node.querySelectorAll('.crew-panel')).toHaveLength(1);
  expect(node.querySelector('.astronaut-profile-body')).not.toBeNull();expect(node.querySelectorAll('.context-dock')).toHaveLength(1);
  expect(fetchMock.mock.calls[1][0]).toBe(`/api/iss/crew/${member.id}`);await click('Close astronaut detail');
  expect(document.activeElement?.getAttribute('data-member-id')).toBe(member.id);expect(node.querySelector('.crew-panel-content')!.scrollTop).toBe(345);
});
it('Escape dismisses Current detail first, then base Crew even from outside the panel',async()=>{
  fetchMock.mockResolvedValueOnce(Response.json(crewFixture())).mockResolvedValueOnce(Response.json(personFixture()));await show();
  await act(async()=>node.querySelector<HTMLButtonElement>('[data-member-id]')!.click());
  const escape=()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  await act(async()=>{escape();});expect(close).not.toHaveBeenCalled();expect(node.querySelector('.crew-workspace')).not.toBeNull();
  await act(async()=>{escape();});expect(close).toHaveBeenCalledOnce();
});
it('leaves higher-priority dialogs and handled Escape events alone',async()=>{
  await show();const dialog=document.createElement('div');dialog.setAttribute('role','dialog');node.querySelector('.crew-panel')!.append(dialog);
  await act(async()=>dialog.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));expect(close).not.toHaveBeenCalled();dialog.remove();
  const event=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});event.preventDefault();await act(async()=>document.dispatchEvent(event));expect(close).not.toHaveBeenCalled();
});
it('exhausts attached and reviewed portrait candidates before initials',async()=>{
  await show();const image=node.querySelector<HTMLImageElement>('.crew-portrait img')!;expect(image).not.toBeNull();const parent=image.parentElement!;
  for(let i=0;i<4&&parent.querySelector('img');i++) await act(async()=>parent.querySelector('img')!.dispatchEvent(new Event('error')));expect(parent.querySelector('img')).toBeNull();expect(parent.textContent).not.toBe('');
});
