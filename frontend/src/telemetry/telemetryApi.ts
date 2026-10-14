export interface TelemetrySource {
  upstreamOrigin: string; transport: string; retainingProvider: string | null;
  acquisitionMethod: string; rawItemId: string; providerItemId: string;
  timeRole: string; timePrecision: string; timestampPolicy: string;
  yearInferred: boolean; roundingDecimals: number | null; providerUnit: string | null;
  receivedAt: string; catalogVersion: string;
}
export interface TelemetryValue {
  numericValue: number; enumCode: number | null; enumLabel: string | null;
  recordTime: string; source: TelemetrySource;
}
export interface TelemetryParameter {
  parameterId: string; label: string; category: string; valueType: 'NUMERIC_SCALAR' | 'ENUM_CODE';
  unit: string | null; rawOnly: boolean; record: TelemetryValue | null;
  evidence: string[]; limitations: string[];
}
export interface ModuleTelemetry {
  componentId: string; mode: 'CURRENT' | 'HISTORICAL'; requestedAt: string | null;
  semantics: 'EFFECTIVE_TIME_BEST_CURRENT_RECONSTRUCTION';
  mappingStatus: 'VERIFIED_MAPPING' | 'NO_VERIFIED_MAPPING'; parameters: TelemetryParameter[];
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid telemetry response.');
  return value as Record<string, unknown>;
}
function text(value: unknown, max = 2048): string {
  if (typeof value !== 'string' || !value || value.length > max) throw new Error('Invalid telemetry text.');
  return value;
}
function nullableText(value: unknown): string | null { return value === null ? null : text(value); }
function utc(value: unknown): string {
  const result = text(value, 40);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(result) || !Number.isFinite(Date.parse(result))) throw new Error('Invalid telemetry record date.');
  return result;
}
function boolean(value: unknown): boolean { if (typeof value !== 'boolean') throw new Error('Invalid telemetry flag.'); return value; }
function strings(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 40) throw new Error('Invalid telemetry evidence.');
  return value.map(item => text(item));
}
export function decodeModuleTelemetry(payload: unknown): ModuleTelemetry {
  const root = object(payload);
  if (!['CURRENT', 'HISTORICAL'].includes(String(root.mode)) || !['VERIFIED_MAPPING', 'NO_VERIFIED_MAPPING'].includes(String(root.mappingStatus))
      || root.semantics !== 'EFFECTIVE_TIME_BEST_CURRENT_RECONSTRUCTION' || !Array.isArray(root.parameters) || root.parameters.length > 131) throw new Error('Invalid module telemetry contract.');
  const seen = new Set<string>();
  const parameters = root.parameters.map((entry): TelemetryParameter => {
    const row = object(entry), id = text(row.parameterId, 160), unit = nullableText(row.unit), rawOnly = boolean(row.rawOnly);
    if (seen.has(id) || !['NUMERIC_SCALAR', 'ENUM_CODE'].includes(String(row.valueType)) || rawOnly && unit !== null) throw new Error('Invalid telemetry definition.');
    seen.add(id);
    let record: TelemetryValue | null = null;
    if (row.record !== null) {
      const value = object(row.record), source = object(value.source);
      if (typeof value.numericValue !== 'number' || !Number.isFinite(value.numericValue)
          || value.enumCode !== null && !Number.isSafeInteger(value.enumCode)
          || source.roundingDecimals !== null && (!Number.isInteger(source.roundingDecimals) || Number(source.roundingDecimals) < 0 || Number(source.roundingDecimals) > 12)) throw new Error('Invalid telemetry value.');
      const enumLabel = nullableText(value.enumLabel);
      if (row.valueType === 'ENUM_CODE' && (value.enumCode === null || enumLabel === null)
          || row.valueType === 'NUMERIC_SCALAR' && (value.enumCode !== null || enumLabel !== null)) throw new Error('Invalid telemetry enum.');
      record = { numericValue: value.numericValue, enumCode: value.enumCode as number | null, enumLabel, recordTime: utc(value.recordTime), source: {
        upstreamOrigin: text(source.upstreamOrigin), transport: text(source.transport), retainingProvider: nullableText(source.retainingProvider),
        acquisitionMethod: text(source.acquisitionMethod), rawItemId: text(source.rawItemId), providerItemId: text(source.providerItemId),
        timeRole: text(source.timeRole), timePrecision: text(source.timePrecision), timestampPolicy: text(source.timestampPolicy),
        yearInferred: boolean(source.yearInferred), roundingDecimals: source.roundingDecimals as number | null,
        providerUnit: nullableText(source.providerUnit), receivedAt: utc(source.receivedAt), catalogVersion: text(source.catalogVersion),
      } };
    }
    return { parameterId: id, label: text(row.label, 1024), category: text(row.category, 60), valueType: row.valueType as TelemetryParameter['valueType'],
      unit, rawOnly, record, evidence: strings(row.evidence), limitations: strings(row.limitations) };
  });
  const requestedAt = root.requestedAt === null ? null : utc(root.requestedAt);
  if (root.mode === 'HISTORICAL' && requestedAt === null || root.mode === 'CURRENT' && requestedAt !== null
      || root.mappingStatus === 'NO_VERIFIED_MAPPING' && parameters.length !== 0) throw new Error('Incoherent telemetry context.');
  if (requestedAt && parameters.some(row => row.record && Date.parse(row.record.recordTime) > Date.parse(requestedAt))) throw new Error('Telemetry exceeds Historical UTC.');
  return { componentId: text(root.componentId, 40), mode: root.mode as ModuleTelemetry['mode'], requestedAt,
    semantics: root.semantics, mappingStatus: root.mappingStatus as ModuleTelemetry['mappingStatus'], parameters };
}
export async function getModuleTelemetry(componentId: string, at: string | null, signal: AbortSignal): Promise<ModuleTelemetry> {
  const query = at === null ? '' : `?at=${encodeURIComponent(at)}`;
  const response = await fetch(`/api/iss/components/${encodeURIComponent(componentId)}/telemetry${query}`, { signal, cache: 'no-store', headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Telemetry could not be loaded.');
  const result = decodeModuleTelemetry(await response.json());
  if (result.componentId !== componentId || result.mode !== (at === null ? 'CURRENT' : 'HISTORICAL')
      || at !== null && Date.parse(result.requestedAt!) !== Date.parse(at)) throw new Error('Telemetry response context mismatch.');
  return result;
}
