// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TopContextBar } from './TopContextBar';

let node: HTMLDivElement, root: Root;
const onEarth = vi.fn(), onInspect = vi.fn(), onCurrent = vi.fn(), onHistorical = vi.fn(), onCrew = vi.fn();
beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  vi.clearAllMocks();
  node = document.createElement('div'); document.body.append(node); root = createRoot(node);
});
afterEach(async () => { await act(async () => root.unmount()); node.remove(); });
async function render(extra: Partial<Parameters<typeof TopContextBar>[0]> = {}) {
  await act(async () => root.render(<TopContextBar source={<select aria-label="Orbital source"><option>NASA OEM</option></select>}
    sceneTimeMs={Date.parse('2026-10-03T12:04:00Z')} inspectionDisabled={false}
    onEarth={onEarth} onInspect={onInspect} onCurrent={onCurrent} onHistorical={onHistorical} onCrew={onCrew} {...extra} />));
}
const button = (name: string) => node.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!;

it('retains desktop action text and gives every compact glyph a stable accessible name', async () => {
  await render();
  for (const name of ['Earth', 'ISS Inspection', 'Current', 'Historical', 'Crew']) {
    const control = button(name);
    expect(control.querySelector('.context-action-label')?.textContent).toBe(name);
    expect(control.title).toBe(name);
    expect(control.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(control.querySelector('svg')?.getAttribute('focusable')).toBe('false');
  }
  expect(node.querySelector('.context-date time')?.textContent).toBe('2026-10-03 12:04:00 UTC');
});
it('preserves independent spatial, temporal and Crew selection and inspection guards', async () => {
  await render({ historical: true, viewMode: 'ISS_INSPECTION' });
  expect(button('ISS Inspection').getAttribute('aria-pressed')).toBe('true');
  expect(button('Earth').getAttribute('aria-pressed')).toBe('false');
  expect(button('Historical').getAttribute('aria-pressed')).toBe('true');
  expect(button('Current').disabled).toBe(true);
  expect(button('Historical').getAttribute('aria-describedby')).toBe('inspection-navigation-guard');
  expect(button('Historical').title).toBe('Return to Earth View to change temporal context.');
  await render({ crewOpen: true, crewPending: true });
  expect(button('Crew').getAttribute('aria-pressed')).toBe('true');
  expect(button('Crew').getAttribute('aria-expanded')).toBe('true');
  expect(button('Crew').getAttribute('aria-busy')).toBe('true');
  expect(button('Earth').getAttribute('aria-pressed')).toBe('false');
});
it('keeps native focus order and dispatches each original action exactly once', async () => {
  await render();
  expect([...node.querySelectorAll('button, select')].map(e => e.getAttribute('aria-label')))
    .toEqual(['Earth', 'ISS Inspection', 'Orbital source', 'Current', 'Historical', 'Crew']);
  for (const name of ['Earth', 'ISS Inspection', 'Current', 'Historical', 'Crew']) await act(async () => button(name).click());
  for (const action of [onEarth, onInspect, onCurrent, onHistorical, onCrew]) expect(action).toHaveBeenCalledTimes(1);
});
