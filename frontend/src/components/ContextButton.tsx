import type { ButtonHTMLAttributes } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

/** Shared control geometry; selection and focus update without a transition. */
export function ContextButton({ selected, className = '', ...props }: Props) {
  return <button type="button" {...props} aria-pressed={selected ?? props['aria-pressed']}
    className={`context-button ${className}`} />;
}
