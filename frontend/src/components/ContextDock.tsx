import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { useOverlayPresence } from '../layout/useOverlayPresence';
import { CloseButton } from './CloseButton';

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
  motion?: 'css' | 'interruptible';
  headerActions?: ReactNode;
}

/** Non-modal foundation only. Live module/Crew surfaces adopt it in later phases. */
export function ContextDock({ open, title, children, onClose, className = '', context, footer, closeLabel, onRestoreFocus, sceneEscape = false, entityId, motion = 'css', headerActions }: Props) {
  const dock = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const origin = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const restoreFocus = useRef(onRestoreFocus);
  restoreFocus.current = onRestoreFocus;
  const presence = useOverlayPresence(open, dock);
  const animation = useRef<Animation | null>(null);
  useLayoutEffect(() => {
    if (motion !== 'interruptible') return;
    const node = dock.current;
    if (!node) { animation.current?.cancel(); animation.current = null; return; }
    const style = getComputedStyle(node);
    const opacity = animation.current ? Number(style.opacity) : open ? 0 : 1;
    const transform = animation.current ? style.transform : open ? 'translateX(16px)' : 'translateX(0px)';
    animation.current?.cancel();
    const raw = style.getPropertyValue(presence.reducedMotion ? '--motion-fast' : open ? '--motion-dock' : '--motion-ui').trim();
    const duration = parseFloat(raw) * (raw.endsWith('ms') ? 1 : 1000);
    const target = open ? 'translateX(0px)' : 'translateX(16px)';
    node.style.opacity = open ? '1' : '0'; node.style.transform = presence.reducedMotion ? 'none' : target;
    animation.current = node.animate?.(presence.reducedMotion ? { opacity: [opacity, open ? 1 : 0] } : { opacity: [opacity, open ? 1 : 0], transform: [transform, target] }, {
      duration: presence.reducedMotion ? Math.min(120, Number.isFinite(duration) ? duration : 120) : Number.isFinite(duration) ? duration : open ? 240 : 200,
      easing: presence.reducedMotion ? 'linear' : style.getPropertyValue(open ? '--ease-enter' : '--ease-exit').trim() || (open ? 'cubic-bezier(0,0,.58,1)' : 'cubic-bezier(.42,0,1,1)'),
    }) ?? null;
  }, [motion, open, presence.present, presence.reducedMotion]);
  useLayoutEffect(() => () => animation.current?.cancel(), []);
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
    className={`context-dock ${className}${motion === 'interruptible' ? ' interruptible-motion' : ''}`} data-state={presence.state} data-entity-id={entityId}
    onKeyDown={event => {
      if (!sceneEscape && presence.interactive && event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault(); event.stopPropagation(); onClose();
      }
    }}>
    <header className="context-dock-header">
      <div className="context-dock-identity"><h2 id={titleId} ref={heading} tabIndex={-1}>{title}</h2>{context && <p>{context}</p>}</div>
      {headerActions ?? <CloseButton aria-label={closeLabel ?? `Close ${title}`} onClick={onClose} />}
    </header>
    <div className="context-dock-content">{children}</div>
    {footer && <footer className="context-dock-footer">{footer}</footer>}
  </aside>;
}
