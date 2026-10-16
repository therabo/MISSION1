import { CloseButton } from './CloseButton';

/** The native Inspection disclosure remains the sole visibility owner. */
export function OrbitalDetailsCloseButton() {
  return <CloseButton className="orbital-details-close" aria-label="Close Orbital Details"
    aria-controls="orbital-status-evidence" onClick={event => {
      const disclosure = event.currentTarget.closest('.inspection-ui')
        ?.querySelector<HTMLDetailsElement>('.inspection-orbital-toggle');
      if (!disclosure) return;
      disclosure.open = false;
      const trigger = disclosure.querySelector('summary');
      if (trigger?.isConnected && !trigger.closest('[inert]')) trigger.focus({ preventScroll: true });
    }} />;
}
