// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CrewPanel } from './CrewPanel';
import { CrewPortrait } from './CrewPortrait';
import { crewFixture, personFixture } from '../test/crewFixture';

let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;
const close = vi.fn();
beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  close.mockClear();
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function mount() {
  await act(async () => root.render(<CrewPanel onClose={close} />));
}
async function click(label: string) {
  const button = [...container.querySelectorAll('button')].find((button) =>
    button.textContent?.includes(label),
  );
  expect(button, label).toBeDefined();
  await act(async () => button!.click());
}
function firstMember() {
  const button = container.querySelector<HTMLButtonElement>('[data-member-id]');
  expect(button).not.toBeNull();
  return button!;
}
function memberDetail() {
  const crew = crewFixture();
  const summary = crew.members[0];
  const person = personFixture();
  Object.assign(person, {
    id: summary.id,
    name: summary.name,
    currentPresence: summary.presence,
    currentAssignment: summary.assignment,
  });
  return person;
}

describe('Crew list/detail resource lifecycle and keyboard', () => {
  it('shows local loading, fetches only crew, and aborts on panel unmount', async () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    await mount();
    expect(container.textContent).toContain('Loading crew');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/iss/crew');
    const signal: AbortSignal = fetchMock.mock.calls[0][1].signal;
    await act(async () => root.unmount());
    expect(signal.aborted).toBe(true);
    root = createRoot(container);
  });
  it('fetches one lazy detail, restores card focus on Back, and does not request Expedition or other profiles', async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json(crewFixture()))
      .mockResolvedValueOnce(Response.json(memberDetail()));
    await mount();
    const button = firstMember(),
      id = button.dataset.memberId;
    await act(async () => button.click());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(`/api/iss/crew/${id}`);
    expect(document.activeElement?.tagName).toBe('H3');
    expect(container.textContent).toContain('Career totals');
    await click('Back to crew');
    expect(document.activeElement?.getAttribute('data-member-id')).toBe(id);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it.each([404, 500, 503])('isolates detail HTTP%i and supports detail retry', async (status) => {
    fetchMock
      .mockResolvedValueOnce(Response.json(crewFixture()))
      .mockResolvedValueOnce(new Response('', { status }))
      .mockResolvedValueOnce(Response.json(memberDetail()));
    await mount();
    await act(async () => firstMember().click());
    expect(container.textContent).toContain('Member summary remains available');
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    await click('Retry profile');
    expect(container.textContent).toContain('Career totals');
    expect(document.activeElement?.tagName).toBe('H3');
    expect(close).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it('isolates crew503 and retries against MISSION1 REST', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(Response.json(crewFixture()));
    await mount();
    expect(container.textContent).toContain('temporarily unavailable');
    await click('Retry crew');
    expect(container.textContent).toContain('8 confirmed identities');
    expect(document.activeElement?.id).toBe('crew-title');
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual(['/api/iss/crew', '/api/iss/crew']);
  });
  it('does not expose routine Refresh in the legacy Crew toolbar', async () => {
    fetchMock.mockResolvedValueOnce(Response.json(crewFixture()));
    await mount();
    expect(container.textContent).toContain('11 aboard');
    expect(container.querySelector('.crew-toolbar')?.textContent).toBe('Crew');
    expect([...container.querySelectorAll('button')].some(b => /^(Refresh|Refreshing…)$/.test(b.textContent ?? ''))).toBe(false);
  });
  it('does not poll during five minutes of panel lifetime', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(Response.json(crewFixture()));
    await mount();
    await act(async () => vi.advanceTimersByTime(300000));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('aborts abandoned detail and prevents its late response from reopening it', async () => {
    let resolveDetail: (response: Response) => void = () => {};
    fetchMock.mockResolvedValueOnce(Response.json(crewFixture())).mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveDetail = resolve;
        }),
    );
    await mount();
    await act(async () => firstMember().click());
    const signal: AbortSignal = fetchMock.mock.calls[1][1].signal;
    await click('Back to crew');
    expect(signal.aborted).toBe(true);
    await act(async () => resolveDetail(Response.json(memberDetail())));
    expect(container.textContent).toContain('Flight engineers');
    expect(container.textContent).not.toContain('Career totals');
  });
  it('Escape backs out of detail then closes without a focus trap', async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json(crewFixture()))
      .mockResolvedValueOnce(Response.json(memberDetail()));
    await mount();
    await act(async () => firstMember().click());
    await act(async () =>
      container
        .querySelector('aside')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
    );
    expect(container.textContent).toContain('Flight engineers');
    expect(close).not.toHaveBeenCalled();
    await act(async () =>
      container
        .querySelector('aside')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
    );
    expect(close).toHaveBeenCalledOnce();
  });
  it('uses an initials fallback after a permitted image fails', async () => {
    const media = crewFixture().members.find((member) => member.image?.singleUse === false)!.image;
    await act(async () => root.render(<CrewPortrait name="Test Astronaut" media={media} />));
    const img = container.querySelector('img');
    expect(img?.getAttribute('alt')).toBe('Portrait of Test Astronaut');
    await act(async () => img!.dispatchEvent(new Event('error')));
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('TA');
  });
});
