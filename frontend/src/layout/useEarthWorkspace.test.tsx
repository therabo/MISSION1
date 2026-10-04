// @vitest-environment jsdom
import { act, useRef, type CSSProperties } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useEarthWorkspace } from './useEarthWorkspace';
let node: HTMLDivElement, root: Root, notify: () => void, width = 356;
const disconnect = vi.fn();
function Harness({ mode = 'live' }: { mode?: string }) {
  const shell = useRef<HTMLElement>(null);
  const value = useEarthWorkspace(shell, mode);
  return <main ref={shell}><aside className={mode === 'replay' ? 'replay-orbit' : 'status-panel'} style={{ '--earth-workspace-side': mode === 'bottom' ? '0' : '1' } as CSSProperties}/><output>{JSON.stringify(value)}</output></main>;
}
beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  width = 356; disconnect.mockClear();
  vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { notify = callback; } observe() {} disconnect = disconnect; });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function(this: HTMLElement) {
    return { left: this.tagName === 'MAIN' ? 0 : 24, right: this.tagName === 'MAIN' ? 1440 : 24 + width,
      width: this.tagName === 'MAIN' ? 1440 : width, height: 900, top: 0, bottom: 900, x: 0, y: 0, toJSON() {} };
  });
  node = document.createElement('div'); document.body.append(node); root = createRoot(node);
});
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const geometry = () => JSON.parse(node.querySelector('output')!.textContent!);
it('automatically updates after changing only the rendered dashboard width', async () => {
  await act(async () => root.render(<Harness/>));
  expect(geometry().left).toBe(380);
  width += 80;
  await act(async () => notify());
  expect(geometry().left).toBe(460);
  await act(async () => notify());
  expect(geometry().left).toBe(460);
});
it('clears side allocation for bottom layouts and observes the replacement replay panel', async () => {
  await act(async () => root.render(<Harness/>));
  await act(async () => root.render(<Harness mode="bottom"/>));
  expect(geometry().left).toBe(0);
  await act(async () => root.render(<Harness mode="replay"/>));
  expect(geometry().left).toBe(380);
  expect(disconnect).toHaveBeenCalledTimes(2);
});
