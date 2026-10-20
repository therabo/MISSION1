import { useState } from 'react';
import { portraitCandidates, type PortraitPerson } from './portrait';

export type CrewPortraitVariant = 'roster' | 'detail';

/** One bounded resolution cycle shared by image, credit and loading state. */
export function useCrewPortrait(person: PortraitPerson, variant: CrewPortraitVariant = 'roster') {
  const attached = portraitCandidates(person);
  const original = variant === 'detail'
    ? attached.find(candidate => candidate.origin === 'PROVIDER_PROFILE' && candidate.variant === 'original') : undefined;
  // Presentation preference only: same eligible, deduplicated person resources.
  const candidates = original ? [original, ...attached.filter(candidate => candidate !== original)] : attached;
  const key = JSON.stringify([variant, person.id, person.externalIds, person.image, candidates]);
  const [attempt, setAttempt] = useState({ key, cycle: 0, index: 0, loaded: false });
  let current = attempt;
  if (attempt.key !== key) {
    // Reset during this component's render: no old-person image is committed.
    current = { key, cycle: attempt.cycle + 1, index: 0, loaded: false };
    setAttempt(current);
  }
  const { cycle, index } = current;
  const candidate = candidates[index];
  const update = (failed: boolean) => setAttempt(previous =>
    previous.key !== key || previous.cycle !== cycle || previous.index !== index || !candidate
      ? previous
      : { ...previous, index: failed ? index + 1 : index, loaded: !failed });
  return {
    candidate,
    state: !candidate ? 'unavailable' as const : current.loaded ? 'ready' as const : 'loading' as const,
    imageKey: `${cycle}:${index}:${key}`,
    onLoad: () => update(false),
    onError: () => update(true),
  };
}

export type CrewPortraitResolution = ReturnType<typeof useCrewPortrait>;
