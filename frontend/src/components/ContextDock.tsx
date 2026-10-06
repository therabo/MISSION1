import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { useOverlayPresence } from '../layout/useOverlayPresence';
import { ContextButton } from './ContextButton';

interface Props {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}

/** Non-modal foundation only. Live module/Crew surfaces adopt it in later phases. */
export function ContextDock({ open, title, children, onClose, className = '' }: Props) {
  const dock = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const origin = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const presence = useOverlayPresence(open, dock);
  useLayoutEffect(() => {
    if (open) {
      origin.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      heading.current?.focus();
    } else if (origin.current?.isConnected &&
      (dock.current?.contains(document.activeElement) || document.activeElement === document.body)) {
      origin.current.focus();
    }
  }, [open]);
  if (!presence.present) return null;
  return <aside ref={dock} role="region" aria-labelledby={titleId}
    aria-hidden={!presence.interactive || undefined} inert={!presence.interactive}
    className={`context-dock ${className}`} data-state={presence.state}
    onKeyDown={event => {
      if (presence.interactive && event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault(); onClose();
      }
    }}>
    <header className="context-dock-header">
      <h2 id={titleId} ref={heading} tabIndex={-1}>{title}</h2>
      <ContextButton aria-label={`Close ${title}`} onClick={onClose}>×</ContextButton>
    </header>
    <div className="context-dock-content">{children}</div>
  </aside>;
}
