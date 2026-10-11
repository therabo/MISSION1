// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CURRENT_CREW_REFRESH_MS, useIssCrew } from './useCrewResource';
import { crewFixture } from '../test/crewFixture';

let root:Root,node:HTMLDivElement,fetchMock:ReturnType<typeof vi.fn>;
function Probe({active=true}:{active?:boolean}) {
  const r=useIssCrew(active);
  return <><output>{r.data?.members.length ?? 'loading'} · {r.error}</output><button onClick={r.refresh}>Refresh</button></>;
}
function response(count=7) { const c=crewFixture();c.members=Array.from({length:count},(_,i)=>({...c.members[i%c.members.length],id:`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`}));return Response.json(c); }
beforeEach(()=>{
  Object.defineProperty(globalThis,'IS_REACT_ACT_ENVIRONMENT',{value:true,configurable:true});
  Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});
  vi.useFakeTimers();node=document.createElement('div');document.body.append(node);root=createRoot(node);
  fetchMock=vi.fn().mockResolvedValue(response());vi.stubGlobal('fetch',fetchMock);
});
afterEach(async()=>{await act(async()=>root.unmount());node.remove();vi.useRealTimers();vi.unstubAllGlobals();delete (document as any).visibilityState;});
const show=(active=true)=>act(async()=>root.render(<Probe active={active}/>));
const tick=()=>act(async()=>vi.advanceTimersByTimeAsync(CURRENT_CREW_REFRESH_MS));
it('automatically receives 7→11→7 through same-origin GET without reload',async()=>{
  fetchMock.mockResolvedValueOnce(response(7)).mockResolvedValueOnce(response(11)).mockResolvedValueOnce(response(7));
  await show();expect(node.textContent).toContain('7');await tick();expect(node.textContent).toContain('11');await tick();expect(node.textContent).toContain('7');
  expect(fetchMock.mock.calls.map(c=>c[0])).toEqual(['/api/iss/crew','/api/iss/crew','/api/iss/crew']);
});
it('schedules the next read after completion, preventing overlap even for a slow request',async()=>{
  let resolve!:(r:Response)=>void;fetchMock.mockImplementation(()=>new Promise<Response>(r=>{resolve=r;}));await show();
  await act(async()=>vi.advanceTimersByTimeAsync(CURRENT_CREW_REFRESH_MS*5));expect(fetchMock).toHaveBeenCalledOnce();
  await act(async()=>resolve(response()));await tick();expect(fetchMock).toHaveBeenCalledTimes(2);
});
it('pauses while hidden and resumes with one immediate read',async()=>{
  await show();Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true});await act(async()=>document.dispatchEvent(new Event('visibilitychange')));
  await tick();expect(fetchMock).toHaveBeenCalledOnce();Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});
  await act(async()=>document.dispatchEvent(new Event('visibilitychange')));expect(fetchMock).toHaveBeenCalledTimes(2);
});
it('pauses inactive Current sessions and aborts stale responses on handoff/unmount',async()=>{
  let resolve!:(r:Response)=>void;fetchMock.mockImplementation(()=>new Promise<Response>(r=>{resolve=r;}));await show();const signal=fetchMock.mock.calls[0][1].signal;
  await show(false);expect(signal.aborted).toBe(true);await act(async()=>resolve(response(11)));expect(node.textContent).not.toContain('11');
  await tick();expect(fetchMock).toHaveBeenCalledOnce();fetchMock.mockResolvedValue(response(7));await show();expect(node.textContent).toContain('7');
});
it('retains last-good data on a background error and recovers next interval',async()=>{
  fetchMock.mockResolvedValueOnce(response(7)).mockResolvedValueOnce(new Response('',{status:503})).mockResolvedValueOnce(response(11));
  await show();await tick();expect(node.textContent).toContain('7');expect(node.textContent).toMatch(/unavailable|temporarily/i);await tick();expect(node.textContent).toContain('11');
});
it('manual refresh cancels the old read and ignores its late response',async()=>{
  let resolve!:(r:Response)=>void;fetchMock.mockImplementationOnce(()=>new Promise<Response>(r=>{resolve=r;})).mockResolvedValueOnce(response(7));
  await show();const signal=fetchMock.mock.calls[0][1].signal;await act(async()=>node.querySelector('button')!.click());
  expect(signal.aborted).toBe(true);await act(async()=>resolve(response(11)));expect(node.textContent).not.toContain('11');expect(node.textContent).toContain('7');
});
