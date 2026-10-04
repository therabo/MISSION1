import { useLayoutEffect, useState, type RefObject } from 'react';
import { sameWorkspace, workspaceGeometry, type WorkspaceGeometry } from '../cesium/workspaceGeometry';

/** LIVE and REPLAY replace one another's persistent dashboard. Crew/detail are
 * separate overlays; CSS decides when the persistent owner is hidden/bottom. */
export function useEarthWorkspace(shell: RefObject<HTMLElement | null>, layoutKey: string): WorkspaceGeometry | null {
  const [geometry, setGeometry] = useState<WorkspaceGeometry | null>(null);
  useLayoutEffect(() => {
    const root = shell.current;
    if (!root) return;
    const panels = [...root.querySelectorAll<HTMLElement>('.status-panel, .replay-orbit')];
    const measure = () => {
      const viewport = root.getBoundingClientRect();
      const owner = panels.find(panel => {
        const style = getComputedStyle(panel);
        return style.getPropertyValue('--earth-workspace-side').trim() === '1' &&
          style.visibility !== 'hidden' && style.display !== 'none';
      });
      const next = workspaceGeometry(viewport, owner?.getBoundingClientRect() ?? null);
      setGeometry(current => sameWorkspace(current, next) ? current : next);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    panels.forEach(panel => observer.observe(panel));
    // Position/visibility-only inline or class changes need not resize a panel.
    const attributes = new MutationObserver(measure);
    [root, ...panels].forEach(element => attributes.observe(element,
      { attributes: true, attributeFilter: ['class', 'style', 'hidden'] }));
    window.addEventListener('resize', measure);
    measure();
    return () => { observer.disconnect(); attributes.disconnect(); window.removeEventListener('resize', measure); };
  }, [shell, layoutKey]);
  return geometry;
}
