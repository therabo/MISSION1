import type { CrewPortraitResolution, CrewPortraitVariant } from './useCrewPortrait';

export function CrewPortrait({ name, portrait, variant = 'roster' }: { name: string | null; portrait: CrewPortraitResolution; variant?: CrewPortraitVariant }) {
  const initials =
    name
      ?.trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => [...part][0])
      .join('') || '?';
  return (
    <span className={`crew-portrait crew-portrait-${variant}`}>
      {portrait.candidate ? (
        <img
          key={portrait.imageKey}
          src={portrait.candidate.url}
          alt={`Portrait of ${name ?? 'crew member'}`}
          width={variant === 'roster' ? 48 : undefined}
          height={variant === 'roster' ? 48 : undefined}
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
