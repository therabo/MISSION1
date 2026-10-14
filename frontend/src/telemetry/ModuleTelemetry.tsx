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
  return <div className="module-telemetry-reading" data-parameter-id={parameter.parameterId}>
    <p className="module-telemetry-label">{parameter.label}</p>
    {value ? <>
      <p className="module-telemetry-value">{value.enumLabel ?? (parameter.rawOnly ? String(value.numericValue) : engineeringValue(value.numericValue))}{parameter.unit && <> {parameter.unit}</>}</p>
      {parameter.rawOnly && <p className="module-secondary">Channel value (raw)</p>}
      <p className="module-secondary">Last telemetry record<time dateTime={value.recordTime}>{recordDate(value.recordTime)}</time></p>
      <p className="module-secondary">Public ISS telemetry{value.source.retainingProvider && <> · Retained by {value.source.retainingProvider}</>}</p>
    </> : <p className="module-secondary">No recorded value</p>}
  </div>;
}
function Groups({ parameters }: { parameters: TelemetryParameter[] }) {
  const categories = [...new Set(parameters.map(parameter => parameter.category))];
  return <>{categories.map(category => {
    const rows = parameters.filter(parameter => parameter.category === category);
    const recorded = rows.filter(parameter => parameter.record);
    const missing = rows.filter(parameter => !parameter.record);
    return <div className="module-telemetry-group" key={category}>
      <h4>{categoryLabel(category)}</h4>
      {recorded.map(parameter => <Reading key={parameter.parameterId} parameter={parameter} />)}
      {missing.length > 0 && <details className="module-telemetry-missing"><summary>{recorded.length ? `${missing.length} parameters without recorded values` : 'No recorded value'}</summary>
        {missing.map(parameter => <p className="module-secondary" key={parameter.parameterId}>{parameter.label}</p>)}
      </details>}
    </div>;
  })}</>;
}
export function ModuleTelemetryReadings({ data, loading, error }: { data: ModuleTelemetry | null; loading: boolean; error: boolean }) {
  return <section className="module-telemetry"><h3>Telemetry</h3>
    {data?.mappingStatus === 'NO_VERIFIED_MAPPING' ? <p className="module-secondary">No verified telemetry mapping</p>
      : data ? <Groups parameters={data.parameters.filter(parameter => !parameter.rawOnly)} />
        : <p className="module-secondary" role={error ? 'status' : undefined}>{error ? 'Telemetry could not be loaded.' : loading ? 'Loading telemetry…' : 'No recorded value'}</p>}
    {error && data && <p className="module-secondary" role="status">Telemetry could not be reloaded.</p>}
  </section>;
}
export function ModuleTelemetryTechnical({ data }: { data: ModuleTelemetry | null }) {
  if (!data || data.mappingStatus === 'NO_VERIFIED_MAPPING') return null;
  const raw = data.parameters.filter(parameter => parameter.rawOnly);
  const sources = new Map(data.parameters.filter(parameter => parameter.record).map(parameter => {
    const source = parameter.record!.source;
    return [`${source.retainingProvider}|${source.timeRole}|${source.timestampPolicy}`, source] as const;
  }));
  return <>
    {raw.length > 0 && <details className="module-telemetry-technical"><summary>Raw telemetry channels</summary><Groups parameters={raw} /></details>}
    {sources.size > 0 && <details className="module-telemetry-technical"><summary>Telemetry evidence &amp; provenance</summary>
      {[...sources].map(([key, source]) => <div key={key} className="module-telemetry-group">
        <p className="module-secondary">Public ISS telemetry · {source.transport}{source.retainingProvider && <> · Retained by {source.retainingProvider}</>}</p>
        <p className="module-secondary">{source.retainingProvider === 'SenseData' ? 'Provider reconstructed record time; inferred year and second precision.'
          : source.retainingProvider === 'ISS.live' ? 'Provider record time; measurement/generator role unspecified.' : 'MISSION1 reconstructed record time; inferred year.'}</p>
        <p className="module-secondary">{source.catalogVersion}</p>
      </div>)}
      {data.parameters.filter(parameter => parameter.record).map(parameter => <details key={parameter.parameterId} className="module-telemetry-evidence"><summary>{parameter.label}</summary>
        <p className="module-secondary">Source channel value: {String(parameter.record!.numericValue)}{parameter.record!.enumCode !== null && <> · State code {parameter.record!.enumCode}</>}</p>
        <p className="module-secondary">Received by MISSION1<time dateTime={parameter.record!.source.receivedAt}>{recordDate(parameter.record!.source.receivedAt)}</time></p>
        {parameter.record!.source.roundingDecimals !== null && <p className="module-secondary">Provider rounding: {parameter.record!.source.roundingDecimals} decimal places</p>}
        {parameter.rawOnly && <p className="module-secondary">Engineering scale unqualified; source unit declaration: {parameter.record!.source.providerUnit ?? 'Unspecified'}. No physical unit is assigned.</p>}
        {parameter.evidence.filter(url => url.startsWith('https://')).map((url, index) => <p className="module-secondary" key={url}><a href={url} target="_blank" rel="noreferrer">Definition evidence {index + 1}</a></p>)}
      </details>)}
    </details>}
  </>;
}
