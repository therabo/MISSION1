import type { BufferStatus } from '../orbital/bufferState';

interface Props { buffer: BufferStatus; message: string | null; sceneError: string | null; sourceNotice: string | null }

/** Operational failures remain visible independently of the removed quality disclosure. */
export function OrbitalNotice({ buffer, message, sceneError, sourceNotice }: Props) {
  const warning = [sourceNotice ? `NASA OEM fallback · Returned to GP/TLE · ${sourceNotice}` : null,
    sceneError ?? message ?? (buffer === 'expired' ? 'Orbital buffer expired · Position unavailable' :
      buffer === 'waiting' ? 'Waiting for orbital samples · Position unavailable' : null)].filter(Boolean).join(' · ');
  return warning ? <p className="earth-current-notice" role={sceneError ? 'alert' : 'status'}>{warning}</p> : null;
}
