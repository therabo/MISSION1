import type { ButtonHTMLAttributes } from 'react';
import { ContextButton } from './ContextButton';
import closeIcon from '../assets/interface/close.svg?raw';

/** Desktop glyph stays intact; compact faces share the native credit X asset. */
export function CloseButton({ className = '', ...props }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return <ContextButton {...props} className={`secondary-face secondary-close ${className}`}>
    <span className="secondary-desktop-glyph" aria-hidden="true">×</span>
    <span className="secondary-icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: closeIcon }} />
  </ContextButton>;
}
