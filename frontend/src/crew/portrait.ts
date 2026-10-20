import type { CrewMedia, CrewMember } from './types';
import { reviewedPortraits } from './reviewedPortraits';

/** Input is an already-canonical API person. This module never resolves people. */
export type PortraitPerson = Pick<CrewMember, 'id' | 'externalIds' | 'image'>;
export interface ReviewedPortrait {
  provider: { source: 'LAUNCH_LIBRARY_2'; entityKind: 'PERSON'; externalKey: string };
  authority: 'NASA' | 'CSA';
  sourceResource: string;
  sourcePage: string;
  sourceAssetSha256: string;
  reviewedAt: string;
  rightsNote: string;
  media: CrewMedia;
}
export interface PortraitCandidate {
  url: string;
  variant: 'thumbnail' | 'original';
  origin: 'PROVIDER_PROFILE' | 'REVIEWED_OFFICIAL';
  canonicalPersonId: string;
  attachment: PortraitPerson['externalIds'];
  media: CrewMedia;
  review?: ReviewedPortrait;
}

/** URL safety only. Browser image decoding determines runtime usability.
 * Rights metadata stays source provenance, never a universal display gate. */
export function portraitUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^https:\/\//i.test(value) || /\s/.test(value)) return undefined;
  try {
    const url = new URL(value);
    if (!url.hostname || url.username || url.password) return undefined;
    url.hash = ''; // Fragments do not make another network candidate.
    return url.href;
  } catch {
    return undefined;
  }
}

export function portraitCandidates(person: PortraitPerson): PortraitCandidate[] {
  if (!person.id) return [];
  const candidates: PortraitCandidate[] = [];
  const seen = new Set<string>();
  const append = (media: CrewMedia | null, review?: ReviewedPortrait) => {
    if (!media) return;
    for (const [variant, value] of [['thumbnail', media.thumbnailUrl], ['original', media.url]] as const) {
      const url = portraitUrl(value);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      candidates.push({ url, variant, origin: review ? 'REVIEWED_OFFICIAL' : 'PROVIDER_PROFILE',
        canonicalPersonId: person.id, attachment: person.externalIds, media, ...(review ? { review } : {}) });
    }
  };
  append(person.image);
  // A conflicting/ambiguous provider selector cannot select a reviewed fallback.
  // Names and installation-specific UUID lists never participate in selection.
  const keys = [...new Set(person.externalIds.filter(id => id.source === 'LAUNCH_LIBRARY_2').map(id => id.value))];
  if (keys.length === 1) {
    const reviews = reviewedPortraits.filter(review => review.provider.externalKey === keys[0]);
    if (reviews.length === 1) append(reviews[0].media, reviews[0]);
  }
  return candidates;
}
