export interface WorkspaceGeometry {
  left: number;
  width: number;
  height: number;
}

export interface HorizontalBounds { left: number; right: number }

/** The panel's rendered right edge owns the strip, including its left margin. */
export function workspaceGeometry(viewport: HorizontalBounds & { height: number },
  panels: readonly HorizontalBounds[]): WorkspaceGeometry {
  const width = Math.max(0, viewport.right - viewport.left);
  const left = panels.reduce((edge, panel) =>
    Math.max(edge, Math.min(width, panel.right - viewport.left)), 0);
  return { left, width, height: viewport.height };
}

/** Cesium defines fov on the larger axis. Crop the viewport without changing
 * the full-window lens's pixel scale or the canonical camera FOV. */
export function workspaceProjectionFov(canonicalFov: number, fullWidth: number,
  fullHeight: number, viewportWidth: number, viewportHeight: number): number {
  return 2 * Math.atan(Math.tan(canonicalFov / 2) *
    Math.max(viewportWidth, viewportHeight) / Math.max(fullWidth, fullHeight));
}
