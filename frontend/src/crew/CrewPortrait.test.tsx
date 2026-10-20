// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CrewPortrait } from './CrewPortrait';
import { portraitCandidates, portraitUrl, type PortraitPerson } from './portrait';
import { useCrewPortrait, type CrewPortraitResolution } from './useCrewPortrait';
import { reviewedPortraits } from './reviewedPortraits';
import { crewFixture, personFixture } from '../test/crewFixture';
import { decodePerson } from './decode';

// TEST ONLY: an unregistered future identity, never a production roster/resource.
const future = (id = '00000000-0000-4000-8000-000000999999', provider = '999999'): PortraitPerson => ({
  id, externalIds: [{ source: 'LAUNCH_LIBRARY_2', value: provider }],
  image: { thumbnailUrl: `https://provider.example/${provider}/thumb.jpg`, url: `https://provider.example/${provider}/original.jpg`,
    credit: null, licenseName: 'Unknown', licenseUrl: 'https://provider.example/terms', singleUse: true },
});

describe('exact canonical profile portrait candidates', () => {
  it('automatically accepts a new future provider person without a registry entry or local asset', () => {
    const person = decodePerson({ ...personFixture(), ...future(), name: 'TEST ONLY future person' }), before = structuredClone(person);
    expect(reviewedPortraits.some(r => r.provider.externalKey === '999999')).toBe(false);
    const result = portraitCandidates(person);
    expect(result.map(c => [c.url, c.variant, c.origin])).toEqual([
      [person.image!.thumbnailUrl, 'thumbnail', 'PROVIDER_PROFILE'],
      [person.image!.url, 'original', 'PROVIDER_PROFILE'],
    ]);
    expect(result.every(c => c.canonicalPersonId === person.id && c.attachment === person.externalIds)).toBe(true);
    expect(person).toEqual(before);
  });
  it.each([
    { singleUse: true }, { singleUse: null }, { credit: null }, { credit: 'Roscosmos' },
    { licenseName: 'Unknown' }, { licenseName: null }, { licenseUrl: null }, { licenseUrl: 'https://another.example/policy' },
  ])('keeps metadata %j without suppressing attached HTTPS media', override => {
    const person = future(); Object.assign(person.image!, override); const before = structuredClone(person);
    expect(portraitCandidates(person)[0].media).toBe(person.image);
    expect(portraitCandidates(person)).toHaveLength(2); expect(person).toEqual(before);
  });
  it.each([null, undefined, '', 'broken', 'https://', 'https:example.org/image.jpg', 'https://exa mple.org/image.jpg',
    'http://example.org/image.jpg', 'javascript:alert(1)', 'data:image/png;base64,a', 'https://user:secret@example.org/image.jpg',
    42, {}, [], true])('rejects unsafe or malformed image reference %j', value => expect(portraitUrl(value)).toBeUndefined());
  it('deduplicates normalized requests, skips unsafe thumbnails and accepts extensionless HTTPS image endpoints', () => {
    const person = future(); person.image!.thumbnailUrl = 'https://PROVIDER.example/image#thumb'; person.image!.url = 'https://provider.example/image#original';
    expect(portraitCandidates(person).map(c => c.url)).toEqual(['https://provider.example/image']);
    person.image!.thumbnailUrl = 'http://provider.example/unsafe.jpg';
    expect(portraitCandidates(person)[0].variant).toBe('original');
  });
  it('leaves invalid API media shapes rejected by the existing decoder', () => {
    for (const image of [42, [], { ...personFixture().image, thumbnailUrl: 42 }]) {
      expect(() => decodePerson({ ...personFixture(), image })).toThrow('unsupported response');
    }
  });
  it.each(['649', '713', '650', '582', '710', '642', '915'])('uses provider media before any reviewed resource for current LL2 PERSON %s', provider => {
    const person = future(`canonical-${provider}`, provider), before = structuredClone(person);
    const candidates = portraitCandidates(person);
    expect(candidates.slice(0, 2).map(c => c.origin)).toEqual(['PROVIDER_PROFILE', 'PROVIDER_PROFILE']);
    expect(candidates.every(c => c.canonicalPersonId === person.id)).toBe(true); expect(person).toEqual(before);
  });
  it.each([
    ['650', ['Pyotr Dubrov', 'Petr Dubrov', 'Пётр Дубров']],
    ['915', ['Sergey Teteryatnikov', 'Sergei Teteryatnikov', 'Сергей Тетерятников']],
    ['642', ['Joshua Kutryk', 'Josh Kutryk', 'Joshua K. Kutryk']],
    ['999999', ['TEST Élodie García', 'TEST E. Garcia', 'TEST unrelated spelling']],
  ])('keeps LL2 %s media invariant across display spellings', (provider, names) => {
    const person = future('same-canonical-person', provider);
    for (const name of names) expect(portraitCandidates({ ...person, ...{ name } })).toEqual(portraitCandidates(person));
  });
  it('never gives Jessica Meir the reviewed Jessica Watkins photo, including misleading names and wrong namespaces', () => {
    const watkins = { ...future('canonical-Watkins', '582'), image: null };
    const meir = { ...future('canonical-Meir', '573'), image: null, name: 'Jessica Watkins' };
    expect(portraitCandidates(watkins)[0].review?.sourceResource).toBe('NASA_CMS:people:88101;media:107678');
    expect(portraitCandidates(meir)).toEqual([]);
    expect(portraitCandidates({ ...meir, externalIds: [{ source: 'NASA_OFFICIAL', value: '582' }] })).toEqual([]);
    expect(portraitCandidates({ ...watkins, externalIds: [...watkins.externalIds, ...meir.externalIds] })).toEqual([]);
    expect(portraitCandidates({ ...watkins, id: '' })).toEqual([]);
  });
  it('retains individual official review proof and never uses the group or dedicated-crop resources directly', () => {
    expect(reviewedPortraits).toHaveLength(5);
    for (const review of reviewedPortraits) {
      expect(review.provider.entityKind).toBe('PERSON'); expect(review.sourceAssetSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(review.sourcePage).toMatch(/^https:/); expect(review.reviewedAt).toBe('2026-10-20');
    }
    for (const provider of ['650', '915']) expect(portraitCandidates({ ...future('canonical', provider), image: null })).toEqual([]);
  });
});

let root: Root, node: HTMLDivElement, latest: CrewPortraitResolution;
function Portrait({ person, name = 'TEST Future Astronaut' }: { person: PortraitPerson; name?: string | null }) {
  latest = useCrewPortrait(person);
  return <><CrewPortrait name={name} portrait={latest} /><output>{latest.state}:{latest.candidate?.media.credit}</output></>;
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  node = document.createElement('div'); document.body.append(node); root = createRoot(node);
});
afterEach(async () => { await act(async () => root.unmount()); node.remove(); });
const show = async (person: PortraitPerson, name?: string | null) => act(async () => root.render(<Portrait person={person} name={name} />));
const image = () => node.querySelector('img')!;
const event = async (type: 'error' | 'load', img = image()) => act(async () => img.dispatchEvent(new Event(type)));

it('tries thumbnail → original → success with native lazy loading, alt and no referrer', async () => {
  const person = future(); await show(person);
  expect(image().src).toBe(person.image!.thumbnailUrl); expect(image().getAttribute('loading')).toBe('lazy');
  expect(image().getAttribute('referrerpolicy')).toBe('no-referrer'); expect(image().alt).toBe('Portrait of TEST Future Astronaut');
  const staleThumb = latest; await event('error'); expect(image().src).toBe(person.image!.url);
  await act(async () => { staleThumb.onError(); staleThumb.onLoad(); }); expect(image().src).toBe(person.image!.url);
  await event('load'); expect(latest.state).toBe('ready');
});
it('exhausts each distinct URL once and keeps neutral/current-name initials', async () => {
  await show(future()); await event('error'); const original = latest; await event('error');
  expect(node.querySelector('img')).toBeNull(); expect(node.querySelector('.crew-portrait')!.textContent).toBe('TF');
  await act(async () => { original.onError(); original.onLoad(); }); expect(latest.state).toBe('unavailable');
  await show(future(), null); expect(node.querySelector('.crew-portrait')!.textContent).toBe('?');
});
it('uses the same-person official resource only after provider exhaustion, with its own credit, then initials', async () => {
  const person = future('canonical-Watkins', '582'); await show(person);
  await event('error'); await event('error');
  expect(latest.candidate?.origin).toBe('REVIEWED_OFFICIAL'); expect(latest.candidate?.canonicalPersonId).toBe(person.id);
  expect(node.querySelector('output')!.textContent).toContain('NASA/Bill Stafford');
  await event('load'); expect(latest.state).toBe('ready'); await event('error'); expect(image()).toBeNull();
});
it('resets for A→B→C, media changes and A again; stale errors/loads cannot alter another cycle', async () => {
  const a = future('A', '10001'), b = future('B', '10002'), c = future('C', '10003');
  await show(a, 'TEST Alpha'); const staleA = latest, oldImage = image(); await event('error');
  await show(b, 'TEST Bravo'); const staleB = latest; expect(image().src).toBe(b.image!.thumbnailUrl);
  await show(c, 'TEST Charlie'); const current = image();
  await act(async () => { staleA.onError(); staleA.onLoad(); staleB.onError(); staleB.onLoad(); oldImage.dispatchEvent(new Event('error')); });
  expect(image()).toBe(current); expect(image().src).toBe(c.image!.thumbnailUrl); expect(image().alt).toContain('TEST Charlie');
  await event('error'); await event('error'); expect(node.querySelector('.crew-portrait')!.textContent).toBe('TC');
  await show(a, 'TEST Alpha'); await act(async () => staleA.onError()); expect(image().src).toBe(a.image!.thumbnailUrl);
  await event('error'); const changed = { ...a, image: { ...a.image!, thumbnailUrl: 'https://provider.example/new.jpg' } };
  await show(changed); expect(image().src).toBe(changed.image.thumbnailUrl); expect(latest.state).toBe('loading');
});
it('does not restart failed candidates on an ordinary rerender or display spelling change', async () => {
  const person = future(); await show(person); await event('error'); await show(structuredClone(person), 'TEST Élodie García');
  expect(image().src).toBe(person.image!.url); expect(image().alt).toContain('TEST Élodie García');
});
it('preserves recorded Current membership and media while resolving every available fixture portrait', () => {
  const crew = crewFixture(), before = structuredClone(crew);
  for (const member of crew.members) if (member.image) expect(portraitCandidates(member)[0].origin).toBe('PROVIDER_PROFILE');
  expect(crew).toEqual(before);
});
