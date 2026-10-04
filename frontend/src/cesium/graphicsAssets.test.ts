import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { TileProviderError, WebMercatorTilingScheme } from 'cesium';
import { DAY_IMAGERY, NIGHT_IMAGERY, gibsAvailable, gibsProbeUrl, gibsProvider, gibsTileUrl, installGibsRetries } from './earthImagery';
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

  it('bounds retries per tile even when another tile succeeds and Cesium resets its shared error count', async () => {
    const provider = gibsProvider(NIGHT_IMAGERY);
    const native = vi.spyOn(provider, 'requestImage').mockResolvedValue({} as HTMLImageElement);
    const dispose = installGibsRetries(provider);
    try {
      for (const expected of [true, true, false, false]) {
        await provider.requestImage(11, 20, 8); // Another tile succeeded.
        const error = new TileProviderError(provider, 'temporarily unavailable', 10, 20, 8, 0);
        provider.errorEvent.raiseEvent(error);
        expect(error.retry).toBe(expected);
      }
      await provider.requestImage(10, 20, 8); // The failed tile finally succeeded.
      const recovered = new TileProviderError(provider, 'new outage', 10, 20, 8, 8);
      provider.errorEvent.raiseEvent(recovered);
      expect(recovered.retry).toBe(true);
      const general = new TileProviderError(provider, 'provider failure');
      provider.errorEvent.raiseEvent(general);
      expect(general.retry).toBe(false);
    } finally { dispose(); native.mockRestore(); }
    expect(provider.errorEvent.numberOfListeners).toBe(0);
  });
});

describe('desktop renderer policy and local star asset', () => {
  it('retains native texture resolution and stable model lighting with complementary AA', () => {
    expect(GRAPHICS_QUALITY.useBrowserRecommendedResolution).toBe(false);
    expect(GRAPHICS_QUALITY.msaaSamples).toBe(4);
    expect(GRAPHICS_QUALITY.browserAntialias).toBe(false);
    expect(GRAPHICS_QUALITY.inspectionFxaa).toBe(true);
    expect(GRAPHICS_QUALITY.modelEnvironmentPositionEpsilon).toBe(Infinity);
    expect(GRAPHICS_QUALITY.modelEnvironmentTimeEpsilon).toBe(Infinity);
    expect(resolutionScaleForDpr(1)).toBe(1.25);
    expect(resolutionScaleForDpr(2)).toBe(1);
    expect(resolutionScaleForDpr(Number.NaN)).toBe(1);
  });

  it('pins six lossless, same-size Tycho cube faces for the production build', () => {
    expect(skyboxManifest.source).toContain('svs.gsfc.nasa.gov');
    expect(skyboxManifest.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
    expect([skyboxManifest.sourceWidth, skyboxManifest.sourceHeight]).toEqual([16384, 8192]);
    expect(skyboxManifest.source).toMatch(/\.tif$/);
    expect(skyboxManifest.faceSize).toBe(4096);
    const faces = Object.values(skyboxManifest.faces);
    expect(faces).toHaveLength(6);
    expect(new Set(faces.map((face) => face.url)).size).toBe(6);
    for (const face of faces) {
      const webp = readFileSync(new URL(`../../public${face.url}`, import.meta.url));
      expect(webp.subarray(0, 4).toString()).toBe('RIFF');
      expect(webp.subarray(8, 12).toString()).toBe('WEBP');
      expect(webp.subarray(12, 16).toString()).toBe('VP8L');
      expect(webp[20]).toBe(0x2f);
      const dimensions = webp.readUInt32LE(21);
      expect([(dimensions & 0x3fff) + 1, ((dimensions >>> 14) & 0x3fff) + 1]).toEqual([4096, 4096]);
      expect(webp.byteLength).toBe(face.bytes);
      expect(createHash('sha256').update(webp).digest('hex')).toBe(face.sha256);
    }
  });
});
