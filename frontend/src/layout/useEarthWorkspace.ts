import { useLayoutEffect, useState, type RefObject } from 'react';
import { sameWorkspace, workspaceGeometry, type WorkspaceGeometry } from '../cesium/workspaceGeometry';

/** Current and Historical share the full Earth viewport. DOM overlays do not
 * reserve a side dashboard; resize still updates camera composition. */
export function useEarthWorkspace(shell: RefObject<HTMLElement | null>, layoutKey: string): WorkspaceGeometry | null {
  const [geometry, setGeometry] = useState<WorkspaceGeometry | null>(null);
  useLayoutEffect(() => {
    const root = shell.current;
    if (!root) return;
    const measure = () => {
      const viewport = root.getBoundingClientRect();
      const next = workspaceGeometry(viewport, null);
      setGeometry(current => sameWorkspace(current, next) ? current : next);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    // Position/visibility-only inline or class changes need not resize a panel.
    const attributes = new MutationObserver(measure);
    attributes.observe(root, { attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    window.addEventListener('resize', measure);
    measure();
    return () => { observer.disconnect(); attributes.disconnect(); window.removeEventListener('resize', measure); };
  }, [shell, layoutKey]);
  return geometry;
}
