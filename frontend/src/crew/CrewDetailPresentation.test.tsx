// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CrewAstronautDock } from './CrewAstronautDock';
import { CurrentCrewRoster } from './CurrentCrewRoster';
import { crewFixture, personFixture } from '../test/crewFixture';
import type { CrewPerson } from './types';

const resource = vi.hoisted(() => ({ data: null as CrewPerson | null }));
vi.mock('../api/useCrewResource', () => ({ useCrewMember: () => ({ ...resource, loading: false, error: null, refresh: vi.fn() }) }));
let node: HTMLDivElement, root: Root;
// TEST ONLY: canonical fixture using the reviewed Watkins resource selector.
const crew = () => {
  const data = crewFixture();
  data.members = [{ ...data.members[0], id: '00000000-0000-4000-8000-000000000582', name: 'TEST Watkins',
    externalIds: [{ source: 'LAUNCH_LIBRARY_2', value: '582' }] }];
  return data;
};
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  node = document.createElement('div'); document.body.append(node); root = createRoot(node);
  const member = crew().members[0];
  resource.data = { ...personFixture(), id: member.id, name: member.name, externalIds: member.externalIds,
    image: { url: 'https://provider.example/582/original.jpg', thumbnailUrl: 'https://provider.example/582/thumb.jpg',
      credit: 'TEST provider credit', licenseName: 'Unknown', licenseUrl: null, singleUse: true } };
});
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.unstubAllGlobals(); });
const show = async () => act(async () => root.render(<><CurrentCrewRoster crew={crew()} onMember={() => {}} />
  <CrewAstronautDock crew={crew()} member={crew().members[0]} onClose={() => {}} /></>));
const figure = () => node.querySelector('figure.astronaut-portrait-identity')!;
const fail = async () => act(async () => figure().querySelector('img')!.dispatchEvent(new Event('error')));

it('shows one active credit directly below the shared detail viewport, with none in Mission', async () => {
  await show(); const image = figure().querySelector('img')!, caption = figure().querySelector('figcaption')!;
  expect(image.src).toBe(resource.data!.image!.url);
  expect(caption.textContent).toBe('Photo: TEST provider credit');
  expect(caption.previousElementSibling).toBe(image.parentElement);
  expect(node.textContent!.match(/Photo:/g)).toHaveLength(1);
  expect(node.querySelector('.crew-roster-mission')!.textContent).not.toContain('Photo:');
  expect([...node.querySelectorAll('.astronaut-dock section')].find(e => e.querySelector('h3')?.textContent === 'Mission context')!.textContent).not.toContain('Photo:');
  expect(node.querySelector('.crew-roster-row .crew-portrait-roster')).not.toBeNull();
  expect(figure().querySelector('.crew-portrait-detail')).not.toBeNull();
});
it('changes credit with the actual fallback and removes it after exhaustion, preserving source metadata', async () => {
  const before = structuredClone(resource.data); await show();
  await fail(); expect(figure().querySelector('img')!.src).toBe(resource.data!.image!.thumbnailUrl);
  expect(figure().querySelector('figcaption')!.textContent).toBe('Photo: TEST provider credit');
  await fail(); expect(figure().querySelector('figcaption')!.textContent).toBe('Photo: NASA/Bill Stafford');
  expect(figure().textContent).not.toContain('TEST provider credit'); expect(node.textContent!.match(/Photo:/g)).toHaveLength(1);
  await fail(); expect(figure().querySelector('img')).toBeNull(); expect(figure().querySelector('figcaption')).toBeNull();
  expect(figure().textContent).toContain('Portrait unavailable'); expect(resource.data).toEqual(before);
});
it.each([null, '', '   ', 'Unknown', ' unknown '])('omits unhelpful credit %j without changing metadata', async credit => {
  resource.data!.image!.credit = credit; const before = structuredClone(resource.data); await show();
  expect(figure().querySelector('figcaption')).toBeNull(); expect(figure().querySelector('img')).not.toBeNull();
  expect(resource.data).toEqual(before);
});
it('retains a long source credit once as plain caption text', async () => {
  const credit = 'TEST ONLY long credit '.repeat(30); resource.data!.image!.credit = credit; await show();
  expect(figure().querySelector('figcaption')!.textContent).toBe('Photo: ' + credit);
  expect(figure().querySelectorAll('figcaption')).toHaveLength(1); expect(figure().querySelector('button,details,a')).toBeNull();
});

it.each(['TEST ONLY short biography.', 'TEST ONLY long biography. '.repeat(100), 'TEST_ONLY_UNBROKEN_TEXT_'.repeat(120), null])('shows the complete biography directly without a disclosure (case %#)', async biography => {
  resource.data!.biography = biography;
  const before = structuredClone(resource.data);
  await show();
  const section = node.querySelector('.astronaut-dock .crew-biography')!;
  expect(section.querySelector('h3')!.textContent).toBe('Biography');
  expect(section.querySelector('h3')!.nextElementSibling?.textContent).toBe(biography ?? 'Biography unavailable.');
  expect(section.querySelector('details, summary, button, [aria-expanded], [hidden]')).toBeNull();
  expect(node.textContent).not.toContain('Biography / retained profile');
  expect(node.textContent).not.toContain('Read biography');
  expect(resource.data).toEqual(before);
});
