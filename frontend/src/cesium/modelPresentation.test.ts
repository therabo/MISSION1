import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Cartesian3, JulianDate } from 'cesium';
import { orbitalPayload } from '../test/orbitalFixture';
import { parseOrbitalWindow } from '../orbital/sampleMapping';
import { createVisualWindow, modelPositionAt } from './visualWindow';
import { ISS_MODEL, MAX_MODULE_PICK_DISTANCE_METERS, labelVisible, markerVisible, modelLoadTransition, modelVisible, modulePickingAvailable, parseModelManifest, representationForState, resolveVerifiedModulePick, semanticMapping } from './modelPresentation';

const glb = readFileSync(new URL('../../public/models/iss-vtad-source-png.glb', import.meta.url));
const inventory = JSON.parse(readFileSync(new URL('../../../docs/frontend/iss-model-inventory.json', import.meta.url), 'utf8')) as {
  nodes: Array<{ index: number; name: string; parent: number | null; mesh: string | null }>;
};
const review = JSON.parse(readFileSync(new URL('../../../docs/frontend/iss-semantic-review.json', import.meta.url), 'utf8')) as {
  nodes: Array<{ nodeIndex: number; assetNodeName: string; meshIndices: number[]; reviewClass: string; mappingStatus: string; proposedSemanticId: string | null; configurationStatus: string }>;
};

interface AssetJson {
  nodes: Array<{ name: string; mesh?: number; children?: number[] }>;
  meshes: Array<{ name?: string; primitives: Array<{ attributes: Record<string, number>; extensions?: { EXT_mesh_features?: { featureIds: Array<{ featureCount: number; attribute: number; propertyTable: number; label: string }> } } }> }>;
  accessors: Array<{ bufferView?: number; count: number }>;
  bufferViews: Array<{ byteOffset: number; byteStride?: number }>;
  images: Array<{ mimeType: string; bufferView: number }>;
  textures: Array<{ sampler: number }>;
  samplers: Array<{ magFilter: number; minFilter: number; wrapS: number; wrapT: number }>;
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
    expect(ISS_MODEL.uri).toBe('/models/iss-vtad-source-png.glb');
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
    expect(semanticMapping(2)).toEqual({ status: 'UNMAPPED' });
    expect(review.nodes).toHaveLength(asset.nodes.length);
    for (const item of review.nodes) {
      expect(item.assetNodeName).toBe(asset.nodes[item.nodeIndex].name);
      expect(item.meshIndices).toEqual(asset.nodes[item.nodeIndex].mesh === undefined ? [] : [asset.nodes[item.nodeIndex].mesh]);
      expect(['CLEAR_CANDIDATE', 'AMBIGUOUS_NAME', 'TECHNICAL_NODE', 'GENERIC_GEOMETRY', 'UNKNOWN']).toContain(item.reviewClass);
      const mapping = ISS_MODEL.semanticMappings.find((entry) => entry.nodeIndex === item.nodeIndex);
      expect(item.mappingStatus).toBe(mapping?.status ?? 'UNMAPPED');
      expect(item.proposedSemanticId).toBe(mapping?.componentId ?? null);
      expect(item.configurationStatus).toBe(mapping?.configurationStatus ?? 'CURRENT_STATUS_UNVERIFIED');
    }
  });

  it('tags only the direct primitives of verified nodes with feature metadata', () => {
    const asset = glbJson();
    expect(asset.extensionsUsed).toContain('EXT_mesh_features');
    expect(asset.extensionsUsed).toContain('EXT_structural_metadata');
    expect(ISS_MODEL.semanticFeatureSet).toBe('missionModule');
    expect(ISS_MODEL.baseRuntimeSha256).toBe('ce2548b56741ee764de7e1d593f1c50785a54150ebc500ed5424a4f5bdf8f657');
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
          featureCount: ISS_MODEL.semanticMappings.length, attribute: 0, propertyTable: 0, label: ISS_MODEL.semanticFeatureSet,
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
    expect([...tagged].sort((a, b) => a - b)).toEqual(ISS_MODEL.semanticMappings.map((mapping) => mapping.nodeIndex).sort((a, b) => a - b));
    const table = asset.extensions.EXT_structural_metadata.propertyTables[0];
    expect(table.count).toBe(ISS_MODEL.semanticMappings.length);
    const codesOffset = asset.bufferViews[table.properties.moduleCode.values].byteOffset;
    expect([...glb.subarray(binaryStart + codesOffset, binaryStart + codesOffset + table.count)]).toEqual(ISS_MODEL.semanticMappings.map((mapping) => mapping.moduleCode));
  });

  it('keeps every lossless NASA texture at its source dimensions with trilinear mip filtering', () => {
    const asset = glbJson();
    expect(asset.images).toHaveLength(19);
    expect(asset.images.every((image) => image.mimeType === 'image/png')).toBe(true);
    const binaryStart = 20 + glb.readUInt32LE(12) + 8;
    const dimensions = asset.images.map((image) => {
      const offset = binaryStart + asset.bufferViews[image.bufferView].byteOffset;
      expect(glb.subarray(offset, offset + 8).toString('hex')).toBe('89504e470d0a1a0a');
      return [glb.readUInt32BE(offset + 16), glb.readUInt32BE(offset + 20)];
    });
    expect(dimensions.every(([width, height]) => width === height && [512, 1024].includes(width))).toBe(true);
    expect(new Set(dimensions.map(([width]) => width))).toEqual(new Set([512, 1024]));
    expect(asset.textures).toHaveLength(19);
    expect(asset.textures.every((texture) => texture.sampler === 0)).toBe(true);
    expect(asset.samplers).toEqual([{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }]);
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
    expect(ISS_MODEL.displayOrientation).toBe('TRAJECTORY_ALIGNED_VISUAL_ORIENTATION');
    expect(ISS_MODEL.attitude).toBe('UNAVAILABLE');
  });
});

describe('model presentation', () => {
  it('resolves only matching verified feature IDs and metadata at inspectable distance', () => {
    expect(ISS_MODEL.semanticMappings.slice(0, 3).map((entry) => [entry.componentId, entry.featureId, entry.moduleCode])).toEqual([
      ['DESTINY', 0, 1], ['COLUMBUS', 1, 2], ['HARMONY', 2, 3],
    ]);
    expect(new Set(ISS_MODEL.semanticMappings.map((entry) => entry.componentId)).size).toBe(ISS_MODEL.semanticMappings.length);
    for (const mapping of ISS_MODEL.semanticMappings) {
      expect(resolveVerifiedModulePick(mapping.featureId, mapping.moduleCode)).toEqual(mapping);
      expect(mapping.identityEvidenceUrl).toMatch(/^https:\/\//);
      expect(mapping.configurationEvidenceUrl).toMatch(/^https:\/\//);
      expect(mapping.configurationStatus).not.toBe(mapping.status);
    }
    expect(ISS_MODEL.semanticMappings.find((entry) => entry.componentId === 'PIRS')?.configurationStatus).toBe('REMOVED_FROM_CURRENT_STATION');
    expect(resolveVerifiedModulePick(0, 2)).toBeNull();
    expect(resolveVerifiedModulePick(999, 1000)).toBeNull();
    expect(resolveVerifiedModulePick(undefined, undefined)).toBeNull();
    expect(modulePickingAvailable('ready', 600)).toBe(true);
    expect(modulePickingAvailable('ready', MAX_MODULE_PICK_DISTANCE_METERS)).toBe(true);
    expect(modulePickingAvailable('ready', MAX_MODULE_PICK_DISTANCE_METERS + 1)).toBe(false);
    expect(modulePickingAvailable('loading', 600)).toBe(false);
    expect(modulePickingAvailable('failed', 600)).toBe(false);
  });
  it('keeps the marker during loading and on failure', () => {
    expect(representationForState(true, 'loading')).toBe('marker');
    expect(modelLoadTransition('loading', 'failed')).toBe('failed');
    expect(representationForState(true, 'failed')).toBe('marker');
    expect(modelLoadTransition('failed', 'loaded')).toBe('failed');
  });

  it('shows only the detailed model at all ready ranges and hides it on expiry', () => {
    expect(modelLoadTransition('loading', 'loaded')).toBe('ready');
    expect(representationForState(true, 'ready')).toBe('model');
    expect(modelVisible('model')).toBe(true);
    expect(markerVisible('model')).toBe(false);
    expect(labelVisible('model')).toBe(false);
    expect(modelVisible('marker')).toBe(false);
    expect(labelVisible('marker')).toBe(true);
    expect(representationForState(false, 'ready')).toBe('none');
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
