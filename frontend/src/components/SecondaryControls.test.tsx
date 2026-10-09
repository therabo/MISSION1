// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CloseButton } from './CloseButton';
import { SceneControls } from './SceneControls';

let root: Root, host: HTMLDivElement;
beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it('keeps a single named close target and decorative compact/desktop representations', async () => {
  await act(async () => root.render(<CloseButton aria-label="Close astronaut detail" />));
  const button = host.querySelector('button')!;
  expect(button.getAttribute('aria-label')).toBe('Close astronaut detail');
  expect(button.type).toBe('button');
  expect(host.querySelectorAll('button')).toHaveLength(1);
  expect(host.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  expect(host.querySelector('svg')?.getAttribute('focusable')).toBe('false');
  expect(host.querySelector('.secondary-desktop-glyph')?.getAttribute('aria-hidden')).toBe('true');
});
it('forwards activation once to the existing close owner', async () => {
  const close = vi.fn(); await act(async () => root.render(<CloseButton aria-label="Close panel" onClick={close} />));
  await act(async () => host.querySelector<HTMLButtonElement>('button')!.click());
  expect(close).toHaveBeenCalledOnce();
});
it('preserves disabled close semantics', async () => {
  const close = vi.fn(); await act(async () => root.render(<CloseButton aria-label="Close panel" disabled onClick={close} />));
  host.querySelector<HTMLButtonElement>('button')!.click(); expect(close).not.toHaveBeenCalled();
});
it('preserves caller classes, references and keyboard focus on the outer target', async () => {
  await act(async () => root.render(<CloseButton aria-label="Close calendar" className="calendar-close" aria-controls="calendar" />));
  const button = host.querySelector('button')!; button.focus();
  expect(document.activeElement).toBe(button);
  expect(button.classList.contains('calendar-close')).toBe(true);
  expect(button.getAttribute('aria-controls')).toBe('calendar');
});
it('keeps zoom and Reset callbacks separate and unchanged', async () => {
  const onZoomIn = vi.fn(), onZoomOut = vi.fn(), onReset = vi.fn();
  await act(async () => root.render(<SceneControls {...{ onZoomIn, onZoomOut, onReset }} />));
  for (const b of host.querySelectorAll<HTMLButtonElement>('button')) await act(async () => b.click());
  for (const callback of [onZoomIn, onZoomOut, onReset]) expect(callback).toHaveBeenCalledOnce();
  expect(host.querySelectorAll('button')).toHaveLength(3);
  expect(host.querySelector('button:last-child')?.textContent).toBe('Reset view');
});
it('keeps zoom names independent of the responsive visual representation', async () => {
  await act(async () => root.render(<SceneControls onZoomIn={() => {}} onZoomOut={() => {}} onReset={() => {}} />));
  expect([...host.querySelectorAll('button[aria-label]')].map(b => b.getAttribute('aria-label'))).toEqual(['Zoom out', 'Zoom in']);
  for (const svg of host.querySelectorAll('svg')) { expect(svg.getAttribute('aria-hidden')).toBe('true'); expect(svg.getAttribute('focusable')).toBe('false'); }
});
it('uses matching zoom boxes, stroke weight and horizontal center line', async () => {
  await act(async () => root.render(<SceneControls onZoomIn={() => {}} onZoomOut={() => {}} onReset={() => {}} />));
  const icons = [...host.querySelectorAll('svg')];
  expect(icons.map(e => e.getAttribute('viewBox'))).toEqual(['0 0 24 24', '0 0 24 24']);
  expect(icons.map(e => e.getAttribute('stroke-width'))).toEqual(['1.5', '1.5']);
  for (const icon of icons) expect(icon.querySelector('path')?.getAttribute('d')).toMatch(/^M4 12h16/);
});
