import rawManifest from './issModelManifest.json';

export type ModelLoadStatus = 'loading' | 'ready' | 'failed';
export type Representation = 'none' | 'marker' | 'model' | 'model-with-label';
export type MappingStatus = 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'UNMAPPED';

export interface SemanticMapping {
  nodeIndex: number;
  nodeName: string;
  componentId: string;
  displayName: string;
  featureId: number;
  moduleCode: number;
  status: MappingStatus;
}

export interface IssModelManifest {
  id: string;
  uri: string;
  sourcePage: string;
  sourceOrganization: string;
  credit: string;
  sourceSha256: string;
  baseRuntimeSha256: string;
  runtimeSha256: string;
  physicalScale: number;
  displayScaleMode: 'DISPLAY_ENHANCED_SCALE';
  displayMinimumPixelSize: number;
  displayMaximumScale: number;
  assetAlignment: 'IDENTITY';
  displayOrientation: 'DISPLAY_ONLY_LOCAL_ENU';
  attitude: 'UNAVAILABLE';
  semanticFeatureSet: 'missionModule';
  semanticMappings: SemanticMapping[];
}

export function parseModelManifest(input: unknown): IssModelManifest {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Model manifest must be an object');
  const manifest = input as Record<string, unknown>;
  for (const key of ['id', 'uri', 'sourcePage', 'sourceOrganization', 'credit']) {
    if (typeof manifest[key] !== 'string' || !(manifest[key] as string).trim()) throw new Error(`Missing model ${key}`);
  }
  if (!(manifest.uri as string).startsWith('/models/') || !(manifest.uri as string).endsWith('.glb')) throw new Error('Invalid model URI');
  if (!(manifest.sourcePage as string).startsWith('https://science.nasa.gov/')) throw new Error('Unverified model source');
  for (const key of ['sourceSha256', 'baseRuntimeSha256', 'runtimeSha256']) {
    if (typeof manifest[key] !== 'string' || !/^[a-f0-9]{64}$/.test(manifest[key] as string)) throw new Error(`Invalid ${key}`);
  }
  if (manifest.physicalScale !== 1 || manifest.displayScaleMode !== 'DISPLAY_ENHANCED_SCALE' ||
      typeof manifest.displayMinimumPixelSize !== 'number' || !Number.isFinite(manifest.displayMinimumPixelSize) || manifest.displayMinimumPixelSize <= 0 ||
      typeof manifest.displayMaximumScale !== 'number' || !Number.isFinite(manifest.displayMaximumScale) ||
      manifest.displayMaximumScale < manifest.physicalScale || manifest.assetAlignment !== 'IDENTITY' ||
      manifest.displayOrientation !== 'DISPLAY_ONLY_LOCAL_ENU' || manifest.attitude !== 'UNAVAILABLE' ||
      manifest.semanticFeatureSet !== 'missionModule') {
    throw new Error('Unsupported ISS model scale or orientation semantics');
  }
  if (!Array.isArray(manifest.semanticMappings)) throw new Error('Missing semantic mappings');
  const seen = new Set<number>();
  const featureIds = new Set<number>();
  const moduleCodes = new Set<number>();
  const componentIds = new Set<string>();
  for (const entry of manifest.semanticMappings) {
    if (!entry || typeof entry !== 'object') throw new Error('Invalid semantic mapping');
    const mapping = entry as Record<string, unknown>;
    if (!Number.isInteger(mapping.nodeIndex) || (mapping.nodeIndex as number) < 0 || seen.has(mapping.nodeIndex as number)) throw new Error('Invalid node index');
    seen.add(mapping.nodeIndex as number);
    if (typeof mapping.nodeName !== 'string' || !mapping.nodeName || typeof mapping.componentId !== 'string' || !mapping.componentId ||
        typeof mapping.displayName !== 'string' || !mapping.displayName) throw new Error('Invalid mapping identity');
    if (!Number.isInteger(mapping.featureId) || (mapping.featureId as number) < 0 || featureIds.has(mapping.featureId as number) ||
        !Number.isInteger(mapping.moduleCode) || (mapping.moduleCode as number) < 1 || moduleCodes.has(mapping.moduleCode as number) ||
        componentIds.has(mapping.componentId as string)) throw new Error('Invalid feature identity');
    featureIds.add(mapping.featureId as number);
    moduleCodes.add(mapping.moduleCode as number);
    componentIds.add(mapping.componentId as string);
    if (!['VERIFIED', 'PARTIALLY_VERIFIED', 'UNMAPPED'].includes(mapping.status as string)) throw new Error('Invalid mapping status');
  }
  return manifest as unknown as IssModelManifest;
}

export const ISS_MODEL = parseModelManifest(rawManifest);

export function semanticMapping(nodeIndex: number): SemanticMapping | { status: 'UNMAPPED' } {
  return ISS_MODEL.semanticMappings.find((mapping) => mapping.nodeIndex === nodeIndex) ?? { status: 'UNMAPPED' };
}

/** A pick must match both independent numeric fields in the pinned GLB metadata. */
export function resolveVerifiedModulePick(featureId: unknown, moduleCode: unknown): SemanticMapping | null {
  return ISS_MODEL.semanticMappings.find((mapping) =>
    mapping.status === 'VERIFIED' && mapping.featureId === featureId && mapping.moduleCode === moduleCode) ?? null;
}

export const MAX_MODULE_PICK_DISTANCE_METERS = 1_000;

export function modulePickingAvailable(load: ModelLoadStatus, distanceMeters: number | null): boolean {
  return load === 'ready' && distanceMeters !== null && Number.isFinite(distanceMeters) &&
    distanceMeters > 0 && distanceMeters <= MAX_MODULE_PICK_DISTANCE_METERS;
}

export function modelLoadTransition(current: ModelLoadStatus, event: 'loaded' | 'failed'): ModelLoadStatus {
  if (current === 'failed') return 'failed';
  return event === 'failed' ? 'failed' : 'ready';
}

/** The model stays visible when loaded; a far label and point keep it easy to find and click. */
export function representationForDistance(validBuffer: boolean, load: ModelLoadStatus, distanceMeters: number | null, previous: Representation): Representation {
  if (!validBuffer) return 'none';
  if (load !== 'ready' || distanceMeters === null || !Number.isFinite(distanceMeters)) return 'marker';
  if (previous === 'model-with-label' && distanceMeters > 1_500_000) return 'model-with-label';
  return distanceMeters >= 2_000_000 ? 'model-with-label' : 'model';
}

export function modelVisible(representation: Representation): boolean {
  return representation === 'model' || representation === 'model-with-label';
}

export function markerVisible(representation: Representation): boolean {
  return representation === 'marker' || representation === 'model-with-label';
}

export function labelVisible(representation: Representation): boolean {
  return representation === 'marker' || representation === 'model-with-label';
}
