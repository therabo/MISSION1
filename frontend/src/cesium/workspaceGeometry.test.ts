import { Cartesian2, Cartesian4, Matrix4, PerspectiveFrustum } from 'cesium';
import { describe, expect, it } from 'vitest';
import { workspaceGeometry, workspaceProjectionFov } from './workspaceGeometry';

describe('free Earth workspace', () => {
  const viewport = { left: 0, right: 1440, height: 900 };
  it('updates its center from the actual dashboard right edge alone', () => {
    const a = workspaceGeometry(viewport, [{ left: 24, right: 380 }]);
    const b = workspaceGeometry(viewport, [{ left: 24, right: 460 }]);
    expect(a.left + (a.width - a.left) / 2).toBe(910);
    expect(b.left + (b.width - b.left) / 2).toBe(950);
  });
  it('uses full width without a side owner and clears allocation on responsive transitions', () => {
    expect(workspaceGeometry({ left: 0, right: 390, height: 844 }, []).left).toBe(0);
    expect(workspaceGeometry(viewport, []).left).toBe(0);
    expect(workspaceGeometry(viewport, [{ left: 24, right: 380 }]).left).toBe(380);
  });
  it('uses viewport-relative bounds and the furthest persistent side edge', () => {
    expect(workspaceGeometry({ left: 100, right: 1540, height: 900 },
      [{ left: 124, right: 480 }, { left: 130, right: 490 }])).toEqual({ left: 390, width: 1440, height: 900 });
  });
  it('bounds workspace allocation to the viewport', () => {
    expect(workspaceGeometry(viewport, [{ left: -20, right: -10 }]).left).toBe(0);
    expect(workspaceGeometry(viewport, [{ left: 24, right: 1600 }]).left).toBe(1440);
  });
});

describe('symmetric viewport lens crop', () => {
  for (const [width, height] of [[1440,900], [900,700], [768,1024], [390,844]]) {
    for (const canonicalDegrees of [60, 100]) {
      it(`retains pixel scale and centered principal ray at ${width}x${height}/${canonicalDegrees}°`, () => {
        const full = new PerspectiveFrustum({ fov: canonicalDegrees * Math.PI / 180, aspectRatio: width / height });
        const croppedWidth = width - (width > 720 ? 380 : 0);
        const cropped = new PerspectiveFrustum({ fov: workspaceProjectionFov(full.fov!, width, height, croppedWidth, height), aspectRatio: croppedWidth / height });
        const fullPixels = full.getPixelDimensions(width, height, 1000, 1, new Cartesian2());
        const croppedPixels = cropped.getPixelDimensions(croppedWidth, height, 1000, 1, new Cartesian2());
        expect(croppedPixels.x).toBeCloseTo(fullPixels.x, 10);
        expect(croppedPixels.y).toBeCloseTo(fullPixels.y, 10);
        expect(cropped.xOffset).toBe(0);
        expect(cropped.yOffset).toBe(0);
        const principal = Matrix4.multiplyByVector(cropped.projectionMatrix, new Cartesian4(0, 0, -1000, 1), new Cartesian4());
        expect(principal.x).toBe(0);
      });
    }
  }
});
