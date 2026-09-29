import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Cartesian3, JulianDate } from 'cesium';
import { orbitalPayload } from '../test/orbitalFixture';
import { parseOrbitalWindow } from '../orbital/sampleMapping';
import { createVisualWindow, modelPositionAt } from './visualWindow';
import { ISS_MODEL, MAX_MODULE_PICK_DISTANCE_METERS, labelVisible, markerVisible, modelLoadTransition, modelVisible, modulePickingAvailable, parseModelManifest, representationForDistance, resolveVerifiedModulePick, semanticMapping } from './modelPresentation';

const glb = readFileSync(new URL('../../public/models/iss-vtad-webp.glb', import.meta.url));
const inventory = JSON.parse(readFileSync(new URL('../../../docs/frontend/iss-model-inventory.json', import.meta.url), 'utf8')) as {
  nodes: Array<{ index: number; name: string; parent: number | null; mesh: string | null }>;
};

interface AssetJson {
  nodes: Array<{ name: string; mesh?: number; children?: number[] }>;
  meshes: Array<{ name?: string; primitives: Array<{ attributes: Record<string, number>; extensions?: { EXT_mesh_features?: { featureIds: Array<{ featureCount: number; attribute: number; propertyTable: number; label: string }> } } }> }>;
  accessors: Array<{ bufferView?: number; count: number }>;
  bufferViews: Array<{ byteOffset: number; byteStride?: number }>;
  extensionsUsed: string[];
  extensions: { EXT_structural_metadata: { propertyTables: Array<{ count: number; properties: { moduleCode: { values: number } } }> } };
}

function glbJson(): AssetJson {
  const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  expect(glb.toString('ascii', 0, 4)).toBe('glTF');
  expect(view.getUint32(8, true)).toBe(glb.byteLength);
  const jsonLength = view.getUint32(12, true);
  expect(view.getUint32(16, true)).toBe(0x4e4f534a);
  return JSON.parse(glb.toString('utf8', 20, 20 + jsonLength)) as AssetJson;
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

  it('tags only the direct primitives of the three verified nodes with feature metadata', () => {
    const asset = glbJson();
    expect(asset.extensionsUsed).toContain('EXT_mesh_features');
    expect(asset.extensionsUsed).toContain('EXT_structural_metadata');
    expect(ISS_MODEL.semanticFeatureSet).toBe('missionModule');
    expect(ISS_MODEL.baseRuntimeSha256).toBe('e5ad5beb2f1ea4364c964f316a072775d8f9d4c4bfed126932aa07a85f438360');
    const jsonLength = glb.readUInt32LE(12);
    const binaryStart = 20 + jsonLength + 8;
    const tagged = new Set<number>();
    for (const [nodeIndex, node] of asset.nodes.entries()) {
      if (node.mesh === undefined) continue;
      for (const primitive of asset.meshes[node.mesh].primitives) {
        const metadata = primitive.extensions?.EXT_mesh_features;
        if (!metadata) {
          expect(primitive.attributes._FEATURE_ID_0).toBeUndefined();
          continue;
        }
        tagged.add(nodeIndex);
        const mapping = ISS_MODEL.semanticMappings.find((entry) => entry.nodeIndex === nodeIndex);
        expect(mapping).toBeDefined();
        expect(metadata.featureIds).toEqual([{
          featureCount: 3, attribute: 0, propertyTable: 0, label: ISS_MODEL.semanticFeatureSet,
        }]);
        const featureAccessor = asset.accessors[primitive.attributes._FEATURE_ID_0];
        expect(featureAccessor.count).toBe(asset.accessors[primitive.attributes.POSITION].count);
        const view = asset.bufferViews[featureAccessor.bufferView!];
        expect(view.byteStride).toBe(4);
        for (let i = 0; i < featureAccessor.count; i++) {
          expect(glb[binaryStart + view.byteOffset + 4 * i]).toBe(mapping?.featureId);
        }
      }
    }
    expect([...tagged].sort((a, b) => a - b)).toEqual([84, 95, 97]);
    const table = asset.extensions.EXT_structural_metadata.propertyTables[0];
    expect(table.count).toBe(3);
    const codesOffset = asset.bufferViews[table.properties.moduleCode.values].byteOffset;
    expect([...glb.subarray(binaryStart + codesOffset, binaryStart + codesOffset + 3)]).toEqual([1, 2, 3]);
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
  it('resolves only matching verified feature IDs and metadata at inspectable distance', () => {
    expect(ISS_MODEL.semanticMappings.map((entry) => entry.componentId)).toEqual(['DESTINY', 'COLUMBUS', 'HARMONY']);
    for (const mapping of ISS_MODEL.semanticMappings) {
      expect(resolveVerifiedModulePick(mapping.featureId, mapping.moduleCode)).toEqual(mapping);
    }
    expect(resolveVerifiedModulePick(0, 2)).toBeNull();
    expect(resolveVerifiedModulePick(3, 4)).toBeNull();
    expect(resolveVerifiedModulePick(undefined, undefined)).toBeNull();
    expect(modulePickingAvailable('ready', 600)).toBe(true);
    expect(modulePickingAvailable('ready', MAX_MODULE_PICK_DISTANCE_METERS)).toBe(true);
    expect(modulePickingAvailable('ready', MAX_MODULE_PICK_DISTANCE_METERS + 1)).toBe(false);
    expect(modulePickingAvailable('loading', 600)).toBe(false);
    expect(modulePickingAvailable('failed', 600)).toBe(false);
  });
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
    expect(markerVisible('model-with-label')).toBe(true);
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
