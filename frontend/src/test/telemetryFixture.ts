import type { ModuleTelemetry } from '../telemetry/telemetryApi';

/** TEST-only controlled responses; never used as runtime telemetry seeds. */
export function telemetryFixture(componentId = 'TRANQUILITY', at: string | null = null): ModuleTelemetry {
  return { componentId, mode: at ? 'HISTORICAL' : 'CURRENT', requestedAt: at, semantics: 'EFFECTIVE_TIME_BEST_CURRENT_RECONSTRUCTION', mappingStatus: 'VERIFIED_MAPPING', parameters: [{
    parameterId: 'iss.tranquility.urine_tank_fill_percentage', label: 'Urine tank', category: 'thermal_cooling', valueType: 'NUMERIC_SCALAR', unit: '%', rawOnly: false, evidence: ['https://example.org/definition'], limitations: [], record: {
      numericValue: 52, enumCode: null, enumLabel: null, recordTime: '2026-09-14T14:10:29Z', source: { upstreamOrigin: 'PUBLIC_ISS_TELEMETRY_NASA_ORIGIN_ATTRIBUTED_BY_PROVIDER', transport: 'Lightstreamer ISSLIVE', retainingProvider: 'SenseData', acquisitionMethod: 'RETAINED_BOOTSTRAP', rawItemId: 'NODE3000005', providerItemId: 'NODE3000005', timeRole: 'PROVIDER_RECONSTRUCTED_ISSLIVE_RECORD_TIME', timePrecision: 'SECOND', timestampPolicy: 'sensedata-original-unix-v1', yearInferred: true, roundingDecimals: 0, providerUnit: null, receivedAt: '2026-10-14T18:00:00Z', catalogVersion: 'module-telemetry-2026-10-14-v1' },
    },
  }] };
}
