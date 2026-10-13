// @vitest-environment jsdom
import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useEarthWorkspace } from './useEarthWorkspace';
let node: HTMLDivElement, root: Root, notify: () => void, width = 1440, height = 900, top = 0;
const disconnect = vi.fn();
function Harness({ mode = 'live' }: { mode?: string }) {
  const shell = useRef<HTMLElement>(null);
  const value = useEarthWorkspace(shell, mode);
  return <main ref={shell}><output>{JSON.stringify(value)}</output></main>;
}
beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  width = 1440; height = 900; top = 0; disconnect.mockClear();
  vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { notify = callback; } observe() {} disconnect = disconnect; });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function() {
    return { left: 0, right: width, width, height, top, bottom: top + height, x: 0, y: top, toJSON() { return { left: 0, right: width, top, bottom: top + height }; } };
  });
  node = document.createElement('div'); document.body.append(node); root = createRoot(node);
});
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const geometry = () => JSON.parse(node.querySelector('output')!.textContent!);
it('updates full-viewport composition after width changes without reserving overlay space', async () => {
  await act(async () => root.render(<Harness/>));
  expect(geometry().focalPoint).toEqual({ x: 720, y: 450 });
  width += 80;
  await act(async () => notify());
  expect(geometry().focalPoint).toEqual({ x: 760, y: 450 });
  expect(geometry().occlusion).toBeNull();
});
it('retains full-viewport composition and cleans observers during temporal handoffs', async () => {
  await act(async () => root.render(<Harness/>));
  await act(async () => root.render(<Harness mode="historical"/>));
  expect(geometry().focalPoint).toEqual({ x: 720, y: 450 });
  expect(geometry().occlusion).toBeNull();
  expect(disconnect).toHaveBeenCalledTimes(1);
});
it('updates camera composition after height-only and combined viewport changes', async () => {
  await act(async () => root.render(<Harness/>));
  height -= 150;
  await act(async () => notify());
  expect(geometry().focalPoint).toEqual({ x: 720, y: 375 });
  width += 80; height -= 50;
  await act(async () => notify());
  expect(geometry().focalPoint).toEqual({ x: 760, y: 350 });
});
it('responds to position-only viewport mutations without introducing occlusion', async () => {
  await act(async () => root.render(<Harness/>));
  top += 40;
  await act(async () => { node.querySelector('main')!.style.top = '40px'; });
  expect(geometry().viewport.top).toBe(40);
  expect(geometry().focalPoint).toEqual({ x: 720, y: 450 });
  expect(geometry().occlusion).toBeNull();
});
