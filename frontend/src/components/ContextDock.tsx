import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { useOverlayPresence } from '../layout/useOverlayPresence';
import { ContextButton } from './ContextButton';

interface Props {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
  context?: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
  onRestoreFocus?: () => void;
  sceneEscape?: boolean;
  entityId?: string;
}

/** Non-modal foundation only. Live module/Crew surfaces adopt it in later phases. */
export function ContextDock({ open, title, children, onClose, className = '', context, footer, closeLabel, onRestoreFocus, sceneEscape = false, entityId }: Props) {
  const dock = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const origin = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const restoreFocus = useRef(onRestoreFocus);
  restoreFocus.current = onRestoreFocus;
  const presence = useOverlayPresence(open, dock);
  useLayoutEffect(() => {
    if (open) {
      origin.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      heading.current?.focus({ preventScroll: true });
    } else if (origin.current?.isConnected &&
      (dock.current?.contains(document.activeElement) || document.activeElement === document.body)) {
      if (origin.current !== document.body && origin.current.tabIndex >= 0 && !origin.current.matches(':disabled')) origin.current.focus({ preventScroll: true });
      else restoreFocus.current?.();
    }
  }, [open]);
  useEffect(() => {
    if (!open || !sceneEscape) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('[role="dialog"],dialog')) return;
      const credits = document.querySelector<HTMLElement>('.cesium-credit-lightbox-overlay');
      if (credits && getComputedStyle(credits).display !== 'none') return;
      event.preventDefault(); event.stopPropagation(); onClose();
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [open, sceneEscape, onClose]);
  if (!presence.present) return null;
  return <aside ref={dock} role="region" aria-labelledby={titleId}
    aria-hidden={!presence.interactive || undefined} inert={!presence.interactive}
    className={`context-dock ${className}`} data-state={presence.state} data-entity-id={entityId}
    onKeyDown={event => {
      if (!sceneEscape && presence.interactive && event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault(); event.stopPropagation(); onClose();
      }
    }}>
    <header className="context-dock-header">
      <div className="context-dock-identity"><h2 id={titleId} ref={heading} tabIndex={-1}>{title}</h2>{context && <p>{context}</p>}</div>
      <ContextButton aria-label={closeLabel ?? `Close ${title}`} onClick={onClose}>×</ContextButton>
    </header>
    <div className="context-dock-content">{children}</div>
    {footer && <footer className="context-dock-footer">{footer}</footer>}
  </aside>;
}
