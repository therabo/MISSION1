import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { WebMercatorTilingScheme } from 'cesium';
import { DAY_IMAGERY, NIGHT_IMAGERY, gibsAvailable, gibsProbeUrl, gibsProvider, gibsTileUrl } from './earthImagery';
import { GRAPHICS_QUALITY, resolutionScaleForDpr } from './graphicsQuality';
import skyboxManifest from './skyboxManifest.json';

describe('tiled NASA Earth imagery', () => {
  it('pins compatible WMTS matrix sets, exact historical layers and a night-only composite', () => {
    expect(DAY_IMAGERY.strategy).toBe('NASA_GIBS_TILED');
    expect(DAY_IMAGERY.layer).toBe('BlueMarble_NextGeneration');
    expect(NIGHT_IMAGERY.layer).toBe('VIIRS_Black_Marble');
    expect(NIGHT_IMAGERY.date).toBe('2016-01-01');
    expect(NIGHT_IMAGERY.dayAlpha).toBe(0);
    expect(NIGHT_IMAGERY.nightAlpha).toBe(1);
    for (const layer of [DAY_IMAGERY, NIGHT_IMAGERY]) {
      expect(layer.maximumLevel).toBe(8);
      expect(gibsTileUrl(layer)).toContain('GoogleMapsCompatible_Level8/{TileMatrix}/{TileRow}/{TileCol}');
      expect(gibsProbeUrl(layer)).toContain('GoogleMapsCompatible_Level8/2/1/2');
      const provider = gibsProvider(layer);
      expect(provider.maximumLevel).toBe(8);
      expect(provider.tilingScheme).toBeInstanceOf(WebMercatorTilingScheme);
    }
  });

  it('rejects a failed probe before revealing a network layer', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response(new Blob(['tile']), { status: 200, headers: { 'content-type': 'image/png' } }));
    try {
      expect(await gibsAvailable(DAY_IMAGERY)).toBe(false);
      expect(await gibsAvailable(NIGHT_IMAGERY)).toBe(true);
    } finally {
      fetchMock.mockRestore();
    }
  });
});

describe('desktop renderer policy and local star asset', () => {
  it('uses native device pixels and MSAA without stacking FXAA on supported hardware', () => {
    expect(GRAPHICS_QUALITY.useBrowserRecommendedResolution).toBe(false);
    expect(GRAPHICS_QUALITY.msaaSamples).toBe(4);
    expect(resolutionScaleForDpr(1)).toBe(1.25);
    expect(resolutionScaleForDpr(2)).toBe(1);
    expect(resolutionScaleForDpr(Number.NaN)).toBe(1);
  });

  it('pins six lossless, same-size Tycho cube faces for the production build', () => {
    expect(skyboxManifest.source).toContain('svs.gsfc.nasa.gov');
    expect(skyboxManifest.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
    expect([skyboxManifest.sourceWidth, skyboxManifest.sourceHeight]).toEqual([16384, 8192]);
    expect(skyboxManifest.faceSize).toBe(2048);
    const faces = Object.values(skyboxManifest.faces);
    expect(faces).toHaveLength(6);
    expect(new Set(faces.map((face) => face.url)).size).toBe(6);
    for (const face of faces) {
      const png = readFileSync(new URL(`../../public${face.url}`, import.meta.url));
      expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([2048, 2048]);
      expect(png.byteLength).toBe(face.bytes);
      expect(createHash('sha256').update(png).digest('hex')).toBe(face.sha256);
    }
  });
});
