import type { ModuleTelemetry, TelemetryParameter } from './telemetryApi';

export function recordDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(value)).replace('Sept', 'Sep').replace(',', ' ·') + ' UTC';
}
function categoryLabel(value: string) { return value.replaceAll('_', ' ').replace(/^./, first => first.toUpperCase()); }
export function engineeringValue(value: number): string {
  return new Intl.NumberFormat('en-GB', { maximumSignificantDigits: 6, useGrouping: false }).format(value);
}
function Reading({ parameter }: { parameter: TelemetryParameter }) {
  const value = parameter.record;
  if (!value) return null;
  return <div className="module-telemetry-reading" data-parameter-id={parameter.parameterId}>
    <p className="module-telemetry-label">{parameter.label}</p>
    <p className="module-telemetry-value">{value.enumLabel ?? engineeringValue(value.numericValue)}{parameter.unit && <> {parameter.unit}</>}</p>
    <p className="module-secondary">Last telemetry record<time dateTime={value.recordTime}>{recordDate(value.recordTime)}</time></p>
  </div>;
}
function Groups({ parameters }: { parameters: TelemetryParameter[] }) {
  const categories = [...new Set(parameters.map(parameter => parameter.category))];
  return <>{categories.map(category => {
    const rows = parameters.filter(parameter => parameter.category === category);
    return <div className="module-telemetry-group" key={category}>
      <h4>{categoryLabel(category)}</h4>
      {rows.map(parameter => <Reading key={parameter.parameterId} parameter={parameter} />)}
    </div>;
  })}</>;
}
export function ModuleTelemetryReadings({ data, loading, error }: { data: ModuleTelemetry | null; loading: boolean; error: boolean }) {
  const recorded = data?.parameters.filter(parameter => !parameter.rawOnly && parameter.record) ?? [];
  if (data?.mappingStatus === 'VERIFIED_MAPPING' && recorded.length === 0 && !error) return null;
  return <section className="module-telemetry"><h3>Telemetry</h3>
    {data?.mappingStatus === 'NO_VERIFIED_MAPPING' ? <p className="module-secondary">No verified telemetry mapping</p>
      : data ? <Groups parameters={recorded} />
        : <p className="module-secondary" role={error ? 'status' : undefined}>{error ? 'Telemetry could not be loaded.' : loading ? 'Loading telemetry…' : 'No recorded value'}</p>}
    {error && data && <p className="module-secondary" role="status">Telemetry could not be reloaded.</p>}
  </section>;
}
export function ModuleTelemetrySource({ data }: { data: ModuleTelemetry | null }) {
  if (!data || data.mappingStatus === 'NO_VERIFIED_MAPPING'
      || !data.parameters.some(parameter => !parameter.rawOnly && parameter.record)) return null;
  return <section className="module-telemetry-source">
    <h4>Telemetry source</h4>
    <p>ISS Live · Lightstreamer</p>
    {/* Verified lightstreamer_live_demo in docs/telemetry/source-registry.yaml. */}
    <p className="module-secondary"><a href="https://demos.lightstreamer.com/ISSLive/" target="_blank" rel="noreferrer">Source <span aria-hidden="true">↗</span></a></p>
  </section>;
}
