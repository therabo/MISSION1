import { useState } from 'react';
import type { CrewMedia } from './types';
import { permittedPortrait } from './presentation';

export function CrewPortrait({ name, media }: { name: string | null; media: CrewMedia | null }) {
  const url = permittedPortrait(media);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
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
      {url && failedUrl !== url ? (
        <img
          src={url}
          alt={`Portrait of ${name ?? 'crew member'}`}
          width="48"
          height="48"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(url)}
        />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </span>
  );
}
