export interface WorkspaceRectangle { left: number; top: number; right: number; bottom: number }
export interface WorkspaceGeometry {
  viewport: WorkspaceRectangle;
  occlusion: WorkspaceRectangle | null;
  width: number;
  height: number;
  viewportArea: number;
  occlusionArea: number;
  freeArea: number;
  /** CSS pixels relative to the full scene viewport. */
  focalPoint: { x: number; y: number };
}

/** Subtract only the clipped persistent dashboard, including neither margins
 * nor the region below it. CSS/DOM own its side-layout role and real bounds. */
export function workspaceGeometry(viewport: WorkspaceRectangle,
  dashboard: WorkspaceRectangle | null): WorkspaceGeometry {
  if (![viewport.left, viewport.top, viewport.right, viewport.bottom].every(Number.isFinite))
    return workspaceGeometry({ left: 0, top: 0, right: 0, bottom: 0 }, null);
  const width = Math.max(0, viewport.right - viewport.left);
  const height = Math.max(0, viewport.bottom - viewport.top);
  const viewportArea = width * height;
  const center = { x: width / 2, y: height / 2 };
  const base = { viewport, width, height, viewportArea };
  if (dashboard && [dashboard.left, dashboard.top, dashboard.right, dashboard.bottom].every(Number.isFinite)) {
    const clipped = { left: Math.max(viewport.left, dashboard.left), top: Math.max(viewport.top, dashboard.top),
      right: Math.min(viewport.right, dashboard.right), bottom: Math.min(viewport.bottom, dashboard.bottom) };
    const occlusionArea = Math.max(0, clipped.right - clipped.left) * Math.max(0, clipped.bottom - clipped.top);
    const freeArea = viewportArea - occlusionArea;
    if (occlusionArea > 0) {
      const x = (clipped.left + clipped.right) / 2 - viewport.left;
      const y = (clipped.top + clipped.bottom) / 2 - viewport.top;
      return { ...base, occlusion: clipped, occlusionArea, freeArea,
        focalPoint: freeArea > viewportArea * 1e-9 ? { x: (viewportArea * center.x - occlusionArea * x) / freeArea,
          y: (viewportArea * center.y - occlusionArea * y) / freeArea } : center };
    }
  }
  return { ...base, occlusion: null, occlusionArea: 0, freeArea: viewportArea, focalPoint: center };
}

/** Geometry equality suppresses repeated observer/state notifications. */
export function sameWorkspace(a: WorkspaceGeometry | null, b: WorkspaceGeometry): boolean {
  if (!a || a.width !== b.width || a.height !== b.height || !!a.occlusion !== !!b.occlusion) return false;
  const close = (x: number, y: number) => Math.abs(x - y) < 0.25;
  return close(a.viewport.left, b.viewport.left) && close(a.viewport.top, b.viewport.top) &&
    (!a.occlusion || !b.occlusion || (Object.keys(a.occlusion) as (keyof WorkspaceRectangle)[])
      .every(key => close(a.occlusion![key], b.occlusion![key])));
}
