import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Cartesian3, JulianDate } from 'cesium';
import { orbitalPayload } from '../test/orbitalFixture';
import { parseOrbitalWindow } from '../orbital/sampleMapping';
import { createVisualWindow, modelPositionAt } from './visualWindow';
import { ISS_MODEL, labelVisible, markerVisible, modelLoadTransition, modelVisible, parseModelManifest, representationForDistance, semanticMapping } from './modelPresentation';

const glb = readFileSync(new URL('../../public/models/iss-vtad-webp.glb', import.meta.url));
const inventory = JSON.parse(readFileSync(new URL('../../../docs/frontend/iss-model-inventory.json', import.meta.url), 'utf8')) as {
  nodes: Array<{ index: number; name: string; parent: number | null; mesh: string | null }>;
};

function glbJson(): { nodes: Array<{ name: string; mesh?: number; children?: number[] }>; meshes: Array<{ name?: string }> } {
  const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  expect(glb.toString('ascii', 0, 4)).toBe('glTF');
  expect(view.getUint32(8, true)).toBe(glb.byteLength);
  const jsonLength = view.getUint32(12, true);
  expect(view.getUint32(16, true)).toBe(0x4e4f534a);
  return JSON.parse(glb.toString('utf8', 20, 20 + jsonLength));
}

describe('NASA ISS model asset', () => {
  it('uses the selected local GLB with verified source and factual credit', () => {
    expect(parseModelManifest(ISS_MODEL)).toEqual(ISS_MODEL);
    expect(ISS_MODEL.uri).toBe('/models/iss-vtad-webp.glb');
    expect(ISS_MODEL.credit).toBe('ISS 3D model: NASA VTAD');
    expect(createHash('sha256').update(glb).digest('hex')).toBe(ISS_MODEL.runtimeSha256);
    expect(() => parseModelManifest({ ...ISS_MODEL, uri: 'https://example.com/iss.glb' })).toThrow();
  });

  it('preserves the inventoried hierarchy and only maps exact NASA node identities', () => {
    const asset = glbJson();
    expect(asset.nodes).toHaveLength(132);
    expect(inventory.nodes).toHaveLength(asset.nodes.length);
    for (const item of inventory.nodes) {
      expect(item.name).toBe(asset.nodes[item.index].name);
      const meshIndex = asset.nodes[item.index].mesh;
      expect(item.mesh).toBe(meshIndex === undefined ? null : asset.meshes[meshIndex].name);
      if (item.parent !== null) expect(asset.nodes[item.parent].children).toContain(item.index);
    }
    for (const mapping of ISS_MODEL.semanticMappings) {
      expect(asset.nodes[mapping.nodeIndex].name).toBe(mapping.nodeName);
      expect(mapping.status).toBe('VERIFIED');
      expect(semanticMapping(mapping.nodeIndex)).toEqual(mapping);
    }
    expect(semanticMapping(0)).toEqual({ status: 'UNMAPPED' });
  });

  it('keeps asset alignment distinct from unavailable station attitude', () => {
    expect(ISS_MODEL.physicalScale).toBe(1);
    expect(ISS_MODEL.displayScaleMode).toBe('DISPLAY_ENHANCED_SCALE');
    expect(ISS_MODEL.displayMinimumPixelSize).toBeGreaterThan(0);
    expect(ISS_MODEL.displayMaximumScale).toBeGreaterThan(ISS_MODEL.physicalScale);
    expect(Number.isFinite(ISS_MODEL.displayMaximumScale)).toBe(true);
    expect(() => parseModelManifest({ ...ISS_MODEL, displayMinimumPixelSize: NaN })).toThrow();
    expect(() => parseModelManifest({ ...ISS_MODEL, displayMaximumScale: Infinity })).toThrow();
    expect(ISS_MODEL.assetAlignment).toBe('IDENTITY');
    expect(ISS_MODEL.displayOrientation).toBe('DISPLAY_ONLY_LOCAL_ENU');
    expect(ISS_MODEL.attitude).toBe('UNAVAILABLE');
  });
});

describe('model presentation', () => {
  it('keeps the marker during loading and on failure', () => {
    expect(representationForDistance(true, 'loading', 1_000, 'marker')).toBe('marker');
    expect(modelLoadTransition('loading', 'failed')).toBe('failed');
    expect(representationForDistance(true, 'failed', 1_000, 'model')).toBe('marker');
    expect(modelLoadTransition('failed', 'loaded')).toBe('failed');
  });

  it('shows the detailed model at all valid ranges, labels it at far range, and hides on expiry', () => {
    expect(modelLoadTransition('loading', 'loaded')).toBe('ready');
    expect(representationForDistance(true, 'ready', 600, 'marker')).toBe('model');
    expect(representationForDistance(true, 'ready', 500_000, 'marker')).toBe('model');
    expect(representationForDistance(true, 'ready', 3_000_000, 'model')).toBe('model-with-label');
    expect(representationForDistance(true, 'ready', 1_700_000, 'model-with-label')).toBe('model-with-label');
    expect(representationForDistance(true, 'ready', 1_400_000, 'model-with-label')).toBe('model');
    expect(modelVisible('model-with-label')).toBe(true);
    expect(markerVisible('model-with-label')).toBe(false);
    expect(labelVisible('model-with-label')).toBe(true);
    expect(markerVisible('model')).toBe(false);
    expect(labelVisible('model')).toBe(false);
    expect(modelVisible('marker')).toBe(false);
    expect(labelVisible('marker')).toBe(true);
    expect(representationForDistance(false, 'ready', 1_000, 'model')).toBe('none');
  });

  it('uses one sampled property for entity and detailed model through TLE replacement', () => {
    const first = createVisualWindow(parseOrbitalWindow(orbitalPayload()));
    const time = JulianDate.fromIso8601('2026-09-28T15:00:00Z');
    expect(modelPositionAt(first, time, new Cartesian3())).toEqual(first.position.getValue(time));
    const nextPayload = orbitalPayload();
    (nextPayload.source as Record<string, unknown>).elementSha256 = 'a'.repeat(64);
    const second = createVisualWindow(parseOrbitalWindow(nextPayload));
    expect(second.position).not.toBe(first.position);
    expect(second.orbital.response.source.elementSha256).toBe('a'.repeat(64));
    expect(modelPositionAt(second, time, new Cartesian3())).toEqual(second.position.getValue(time));
    expect(modelPositionAt(second, JulianDate.fromIso8601('2026-09-28T15:00:11Z'), new Cartesian3())).toBeUndefined();
  });
});
