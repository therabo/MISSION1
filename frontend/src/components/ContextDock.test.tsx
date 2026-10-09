// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContextDock } from './ContextDock';

let root: Root, container: HTMLDivElement, trigger: HTMLButtonElement;
let reduced = false;
let listeners: Set<() => void>;
const close = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  reduced = false;
  listeners = new Set();
  const media = { get matches() { return reduced; }, addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener) };
  vi.stubGlobal('matchMedia', () => media);
  trigger = document.createElement('button'); trigger.textContent = 'Open detail';
  container = document.createElement('div');
  document.body.append(trigger, container); trigger.focus();
  root = createRoot(container); close.mockClear();
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove(); trigger.remove();
  expect(listeners.size).toBe(0);
  vi.unstubAllGlobals(); vi.useRealTimers();
});
async function render(open: boolean) {
  await act(async () => root.render(<ContextDock open={open} title="Module" onClose={close}><button>Evidence</button></ContextDock>));
}

describe('overlay presence, keyboard and system motion preference', () => {
  it('does not mount a closed overlay, focuses its heading on open and restores the trigger on close', async () => {
    await render(false); expect(container.querySelector('aside')).toBeNull();
    await render(true); expect(document.activeElement?.tagName).toBe('H2');
    await render(false); expect(document.activeElement).toBe(trigger);
    await act(async () => vi.advanceTimersByTime(200));
    expect(container.querySelector('aside')).toBeNull();
  });
  it('makes the exiting overlay inert and inaccessible immediately, then removes it', async () => {
    await render(true); await render(false);
    const overlay = container.querySelector('aside')!;
    expect(overlay.hasAttribute('inert')).toBe(true);
    expect(overlay.getAttribute('aria-hidden')).toBe('true');
    expect(overlay.dataset.state).toBe('exiting');
    await act(async () => vi.advanceTimersByTime(200));
    expect(container.querySelector('button')).toBeNull();
  });
  it('cancels an interrupted exit so its timer cannot remove a reopened overlay or steal focus', async () => {
    await render(true); await render(false);
    await act(async () => vi.advanceTimersByTime(100));
    await render(true);
    await act(async () => vi.advanceTimersByTime(400));
    expect(container.querySelector('aside')?.dataset.state).toBe('open');
    expect(container.querySelector('aside')?.hasAttribute('inert')).toBe(false);
    expect(document.activeElement?.tagName).toBe('H2');
  });
  it('dispatches Escape once from an interactive dock and honors an already handled event', async () => {
    await render(true);
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    await act(async () => container.querySelector('h2')!.dispatchEvent(event));
    expect(close).toHaveBeenCalledTimes(1); expect(event.defaultPrevented).toBe(true);
    const handled = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); handled.preventDefault();
    await act(async () => container.querySelector('h2')!.dispatchEvent(handled));
    expect(close).toHaveBeenCalledTimes(1);
  });
  it('does not steal focus from another control when the overlay is closed externally', async () => {
    await render(true);
    const outside = document.createElement('button'); document.body.append(outside); outside.focus();
    await render(false); expect(document.activeElement).toBe(outside); outside.remove();
  });
  it('reads the initial reduced preference and limits the exit to 120ms', async () => {
    reduced = true; await render(true); await render(false);
    await act(async () => vi.advanceTimersByTime(119)); expect(container.querySelector('aside')).not.toBeNull();
    await act(async () => vi.advanceTimersByTime(1)); expect(container.querySelector('aside')).toBeNull();
  });
  it('responds to a changed reduced preference during exit and cleans up subscriptions', async () => {
    await render(true); await render(false);
    reduced = true;
    await act(async () => listeners.forEach(listener => listener()));
    await act(async () => vi.advanceTimersByTime(120)); expect(container.querySelector('aside')).toBeNull();
  });
});
