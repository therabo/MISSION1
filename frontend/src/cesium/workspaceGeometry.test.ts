import { Cartesian2, Cartesian4, Matrix4 } from 'cesium';
import { describe, expect, it } from 'vitest';
import { sameWorkspace, workspaceGeometry } from './workspaceGeometry';
import { applyWorkspaceProjection, WorkspacePerspectiveFrustum } from './workspaceProjection';
const viewport = { left: 0, top: 0, right: 1440, bottom: 900 };
const panel = { left: 24, top: 82, right: 380, bottom: 865 };

describe('full scene minus actual rectangular occlusion', () => {
  it('uses the full viewport center without a dashboard', () => {
    expect(workspaceGeometry(viewport, null).focalPoint).toEqual({ x: 720, y: 450 });
  });
  it('matches an independently derived L-shaped area centroid to 1e-10 CSS px', () => {
    // Sum the four disjoint visible rectangles, not the subtraction formula.
    const rectangles = [[0,0,1440,82],[0,82,24,783],[380,82,1060,783],[0,865,1440,35]];
    let area = 0, x = 0, y = 0;
    for (const [left,top,width,height] of rectangles) {
      const a = width * height; area += a; x += a * (left + width / 2); y += a * (top + height / 2);
    }
    const result = workspaceGeometry(viewport, panel);
    expect(result.freeArea).toBe(area);
    expect(result.focalPoint.x).toBeCloseTo(x / area, 10);
    expect(result.focalPoint.y).toBeCloseTo(y / area, 10);
    expect(result.focalPoint.x).toBeCloseTo(861.94266907315, 10);
  });
  it('subtracts neither the left/top margins nor the space below the dashboard', () => {
    const a = workspaceGeometry(viewport, panel), b = workspaceGeometry(viewport, { ...panel, bottom: 500 });
    expect(a.occlusionArea).toBe(356 * 783);
    expect(b.occlusionArea).toBe(356 * 418);
    expect(a.focalPoint.x).not.toBe(b.focalPoint.x);
    expect(a.focalPoint.y).not.toBe(b.focalPoint.y);
    expect(a.focalPoint.x).not.toBe(910);
  });
  it.each([
    ['width', { ...panel, right: 460 }],
    ['height, same right edge', { ...panel, bottom: 715 }],
    ['both', { ...panel, right: 460, bottom: 715 }],
    ['top margin', { ...panel, top: 182 }],
    ['left margin', { ...panel, left: 54, right: 410 }],
  ])('responds to changed %s', (_name, changed) => {
    const a = workspaceGeometry(viewport, panel), b = workspaceGeometry(viewport, changed);
    expect(b.focalPoint).not.toEqual(a.focalPoint);
    expect(sameWorkspace(a, b)).toBe(false);
  });
  it('clips every dashboard edge to the viewport', () => {
    const result = workspaceGeometry(viewport, { left: -30, top: -40, right: 380, bottom: 1000 });
    expect(result.occlusion).toEqual({ left: 0, top: 0, right: 380, bottom: 900 });
    expect(result.focalPoint).toEqual({ x: 910, y: 450 });
  });
  it('expresses the focal point relative to a nonzero viewport origin', () => {
    const shifted = workspaceGeometry({ left: 100, top: 50, right: 1540, bottom: 950 },
      { left: 124, top: 132, right: 480, bottom: 915 });
    expect(shifted.focalPoint).toEqual(workspaceGeometry(viewport, panel).focalPoint);
  });
  it.each([
    ['off-screen', { left: -20, top: 0, right: -10, bottom: 800 }],
    ['zero area', { ...panel, bottom: panel.top }],
    ['invalid', { ...panel, bottom: NaN }],
  ])('ignores %s occlusion', (_name, bounds) => {
    expect(workspaceGeometry(viewport, bounds).focalPoint).toEqual({ x: 720, y: 450 });
  });
  it('safely centers when the dashboard covers the complete viewport', () => {
    expect(workspaceGeometry(viewport, { left: -20, top: -20, right: 2000, bottom: 1000 }).focalPoint)
      .toEqual({ x: 720, y: 450 });
  });
  it('handles empty and invalid viewport geometry without invalid projections', () => {
    expect(workspaceGeometry({ left: 0, top: 0, right: 0, bottom: 0 }, panel).focalPoint).toEqual({x:0,y:0});
    expect(workspaceGeometry({ ...viewport, right: NaN }, panel).focalPoint).toEqual({x:0,y:0});
  });
  it('clears and restores side occlusion across responsive transitions', () => {
    const mobile = { left: 0, top: 0, right: 390, bottom: 844 };
    expect(workspaceGeometry(viewport, panel).occlusion).not.toBeNull();
    expect(workspaceGeometry(mobile, null).focalPoint).toEqual({ x: 195, y: 422 });
    expect(workspaceGeometry(viewport, panel).focalPoint.x).toBeCloseTo(861.94266907315, 10);
    expect(sameWorkspace(workspaceGeometry(viewport, panel), workspaceGeometry(viewport, panel))).toBe(true);
  });
});

describe('full-size off-center lens', () => {
  for (const [width, height] of [[1440,900], [900,700], [768,1024], [390,844]]) {
    for (const degrees of [60, 100]) {
      it(`retains FOV/pixel scale and projects the principal ray at the centroid at ${width}x${height}/${degrees}°`, () => {
        const frustum = new WorkspacePerspectiveFrustum({ fov: degrees * Math.PI / 180, aspectRatio: width / height });
        const geometry = workspaceGeometry({ left: 0, top: 0, right: width, bottom: height }, width>720?panel:null);
        const pixels = frustum.getPixelDimensions(width, height, 1000, 1, new Cartesian2());
        applyWorkspaceProjection(frustum, geometry.focalPoint.x / width - 0.5, geometry.focalPoint.y / height - 0.5);
        const shiftedPixels = frustum.getPixelDimensions(width, height, 1000, 1, new Cartesian2());
        expect(shiftedPixels.x).toBeCloseTo(pixels.x, 10);
        expect(shiftedPixels.y).toBeCloseTo(pixels.y, 10);
        expect(frustum.fov).toBe(degrees * Math.PI / 180);
        const principal = Matrix4.multiplyByVector(frustum.projectionMatrix, new Cartesian4(0, 0, -1000, 1), new Cartesian4());
        expect((principal.x / principal.w + 1) * width / 2).toBeCloseTo(geometry.focalPoint.x, 10);
        expect((1 - principal.y / principal.w) * height / 2).toBeCloseTo(geometry.focalPoint.y, 10);
      });
    }
  }
});
