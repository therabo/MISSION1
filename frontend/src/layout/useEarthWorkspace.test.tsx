// @vitest-environment jsdom
import { act, useRef, type CSSProperties } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useEarthWorkspace } from './useEarthWorkspace';
let node: HTMLDivElement, root: Root, notify: () => void, width = 356, height = 783, top = 82;
const disconnect = vi.fn();
function Harness({ mode = 'live' }: { mode?: string }) {
  const shell = useRef<HTMLElement>(null);
  const value = useEarthWorkspace(shell, mode);
  return <main ref={shell}><aside className={mode === 'replay' ? 'replay-orbit' : 'status-panel'} style={{ '--earth-workspace-side': mode === 'bottom' ? '0' : '1' } as CSSProperties}/><output>{JSON.stringify(value)}</output></main>;
}
beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  width = 356; height = 783; top = 82; disconnect.mockClear();
  vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { notify = callback; } observe() {} disconnect = disconnect; });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function(this: HTMLElement) {
    return { left: this.tagName === 'MAIN' ? 0 : 24, right: this.tagName === 'MAIN' ? 1440 : 24 + width,
      width: this.tagName === 'MAIN' ? 1440 : width, height: this.tagName === 'MAIN' ? 900 : height, top: this.tagName === 'MAIN' ? 0 : top, bottom: this.tagName === 'MAIN' ? 900 : top + height, x: 0, y: 0, toJSON() {} };
  });
  node = document.createElement('div'); document.body.append(node); root = createRoot(node);
});
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const geometry = () => JSON.parse(node.querySelector('output')!.textContent!);
it('automatically updates after changing only the rendered dashboard width', async () => {
  await act(async () => root.render(<Harness/>));
  expect(geometry().focalPoint.x).toBeCloseTo(861.94266907315, 10);
  width += 80;
  await act(async () => notify());
  expect(geometry().occlusion.right).toBe(460);
  await act(async () => notify());
  expect(geometry().occlusion.right).toBe(460);
});
it('clears side allocation for bottom layouts and observes the replacement replay panel', async () => {
  await act(async () => root.render(<Harness/>));
  await act(async () => root.render(<Harness mode="bottom"/>));
  expect(geometry().focalPoint).toEqual({ x: 720, y: 450 });
  await act(async () => root.render(<Harness mode="replay"/>));
  expect(geometry().focalPoint.x).toBeCloseTo(861.94266907315, 10);
  expect(disconnect).toHaveBeenCalledTimes(2);
});

it('automatically recomposes after height-only and combined size changes', async () => {
  await act(async () => root.render(<Harness/>));
  const initial = geometry();
  height -= 150;
  await act(async () => notify());
  expect(geometry().occlusion.right).toBe(initial.occlusion.right);
  expect(geometry().focalPoint).not.toEqual(initial.focalPoint);
  const shorter = geometry();
  width += 80; height -= 50;
  await act(async () => notify());
  expect(geometry().focalPoint).not.toEqual(shorter.focalPoint);
});
it('clears hidden dashboards and responds to position-only style mutations', async () => {
  await act(async () => root.render(<Harness/>));
  top += 40;
  await act(async () => { node.querySelector('aside')!.style.top = '122px'; });
  expect(geometry().occlusion.top).toBe(122);
  await act(async () => { node.querySelector('aside')!.style.display = 'none'; });
  expect(geometry().occlusion).toBeNull();
  await act(async () => { node.querySelector('aside')!.style.display = ''; });
  expect(geometry().occlusion).not.toBeNull();
});
