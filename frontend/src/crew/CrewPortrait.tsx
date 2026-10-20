import type { CrewPortraitResolution } from './useCrewPortrait';

export function CrewPortrait({ name, portrait }: { name: string | null; portrait: CrewPortraitResolution }) {
  const initials =
    name
      ?.trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => [...part][0])
      .join('') || '?';
  return (
    <span className="crew-portrait">
      {portrait.candidate ? (
        <img
          key={portrait.imageKey}
          src={portrait.candidate.url}
          alt={`Portrait of ${name ?? 'crew member'}`}
          width="48"
          height="48"
          loading="lazy"
          referrerPolicy="no-referrer"
          onLoad={portrait.onLoad}
          onError={portrait.onError}
        />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </span>
  );
}
