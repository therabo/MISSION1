import { useLayoutEffect, useState, type RefObject } from 'react';
import { workspaceGeometry, type WorkspaceGeometry } from '../cesium/workspaceGeometry';

/** CSS owns whether a panel reserves a side strip; rendered bounds own its size.
 * Crew and module detail are right-side/bottom overlays, not workspace owners. */
export function useEarthWorkspace(shell: RefObject<HTMLElement | null>, layoutKey: string): WorkspaceGeometry | null {
  const [geometry, setGeometry] = useState<WorkspaceGeometry | null>(null);
  useLayoutEffect(() => {
    const root = shell.current;
    if (!root) return;
    const panels = [...root.querySelectorAll<HTMLElement>('.status-panel, .replay-orbit')];
    const measure = () => {
      const viewport = root.getBoundingClientRect();
      const sidePanels = panels.filter(panel => {
        const style = getComputedStyle(panel);
        return style.getPropertyValue('--earth-workspace-side').trim() === '1' &&
          style.visibility !== 'hidden' && style.display !== 'none';
      }).map(panel => panel.getBoundingClientRect()).filter(panel => panel.width > 0 && panel.height > 0);
      const next = workspaceGeometry(viewport, sidePanels);
      setGeometry(current => current && Math.abs(current.left - next.left) < 0.25 &&
        current.width === next.width && current.height === next.height ? current : next);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    panels.forEach(panel => observer.observe(panel));
    window.addEventListener('resize', measure);
    measure();
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [shell, layoutKey]);
  return geometry;
}
