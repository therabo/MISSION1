import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { telemetryFixture } from '../test/telemetryFixture';
import { decodeModuleTelemetry, type TelemetryParameter } from './telemetryApi';
import { ModuleTelemetryReadings, ModuleTelemetryTechnical } from './ModuleTelemetry';

interface Definition {
  parameterId: string; rawItemId: string; componentId: string; label: string; category: string;
  valueType: TelemetryParameter['valueType']; unit: string | null; unitQualification: string;
  enumMapping: Record<string, string>;
}
// TEST_ONLY values; independent backend research projection carries definitions only.
const reference = JSON.parse(readFileSync(new URL('../../../backend/src/test/resources/telemetry/TEST-qualified-component-reference.json', import.meta.url), 'utf8')) as { definitions: Definition[] };
it.each([...new Set(reference.definitions.map(d => d.componentId))])('decodes and renders every recorded definition/category for %s without row loss', component => {
  const data = telemetryFixture(component);
  const base = data.parameters[0].record!;
  data.parameters = reference.definitions.filter(d => d.componentId === component).map(d => ({
    parameterId: d.parameterId, label: d.label, category: d.category, valueType: d.valueType,
    unit: d.unit, rawOnly: d.unitQualification === 'DISPLAY_RAW_WITH_SOURCE_UNIT', evidence: [], limitations: [],
    record: { ...base, numericValue: 0, enumCode: d.valueType === 'ENUM_CODE' ? 0 : null,
      enumLabel: d.valueType === 'ENUM_CODE' ? d.enumMapping['0'] ?? 'Unknown code 0' : null,
      source: { ...base.source, rawItemId: d.rawItemId, providerItemId: d.rawItemId } },
  }));
  const decoded = decodeModuleTelemetry(data);
  expect(decoded.parameters).toHaveLength(data.parameters.length);
  const normal = renderToStaticMarkup(<ModuleTelemetryReadings data={decoded} loading={false} error={false} />);
  const technical = renderToStaticMarkup(<ModuleTelemetryTechnical data={decoded} />);
  for (const parameter of decoded.parameters) {
    const attribute = `data-parameter-id="${parameter.parameterId}"`;
    expect(parameter.rawOnly ? technical : normal).toContain(attribute);
    expect(parameter.rawOnly ? normal : technical).not.toContain(attribute);
  }
  expect((normal + technical).match(/data-parameter-id=/g)).toHaveLength(decoded.parameters.length);
});
