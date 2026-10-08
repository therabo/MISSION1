import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  icon?: ReactNode;
}

/** Shared control geometry; selection and focus update without a transition. */
export function ContextButton({ selected, className = '', icon, children, ...props }: Props) {
  return <button type="button" {...props} aria-pressed={selected ?? props['aria-pressed']}
    title={props.title ?? (icon ? props['aria-label'] : undefined)}
    className={`context-button ${icon ? 'context-action ' : ''}${className}`}>
    {icon && <span className="context-action-icon">{icon}</span>}
    {icon ? <span className="context-action-label">{children}</span> : children}
  </button>;
}
