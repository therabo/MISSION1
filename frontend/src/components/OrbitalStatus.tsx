import type { OrbitalDelivery, BufferStatus } from '../orbital/bufferState';
import { ISS_MODEL } from '../cesium/modelPresentation';
import type { ModelLoadStatus } from '../cesium/modelPresentation';

interface OrbitalStatusProps {
  delivery: OrbitalDelivery;
  buffer: BufferStatus;
  sceneTimeMs: number | null;
  sceneError: string | null;
  modelState: { status: ModelLoadStatus; loadMs: number | null };
}

function utc(value: string | null | undefined): string {
  if (!value) return 'Unavailable';
  return new Date(value).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
}

function age(seconds: number): string {
  const sign = seconds < 0 ? '−' : '';
  const absolute = Math.abs(seconds);
  if (absolute >= 3600) return `${sign}${(absolute / 3600).toFixed(1)} h`;
  if (absolute >= 60) return `${sign}${Math.round(absolute / 60)} min`;
  return `${sign}${Math.round(absolute)} s`;
}

function coordinate(value: number, positive: string, negative: string): string {
  return `${Math.abs(value).toFixed(3)}° ${value < 0 ? negative : positive}`;
}

function line(label: string, value: string, valueClass?: string) {
  return <div className="data-line" key={label}><dt>{label}</dt><dd className={valueClass}>{value}</dd></div>;
}

export function OrbitalStatus({ delivery, buffer, sceneTimeMs, sceneError, modelState }: OrbitalStatusProps) {
  const snapshot = delivery.window?.response;
  const quality = snapshot?.qualityAtGeneratedAt;
  const health = snapshot?.sourceHealth;
  const dataTime = snapshot ? utc(snapshot.generatedAt) : 'Waiting for samples';
  const bufferText = buffer === 'active' ? 'ACTIVE' : buffer === 'expired' ? 'EXPIRED' : 'WAITING';

  return <aside className="status-panel" aria-label="ISS orbital status">
    <div className="panel-head">
      <span className="eyebrow">ORBITAL STATE / ISS</span>
      <h1>Earth View</h1>
      <p>Current propagated ISS position</p>
    </div>

    <div className="time-card">
      <span className="mini-label">SCENE TIME · UTC</span>
      <strong>{sceneTimeMs === null ? '—' : utc(new Date(sceneTimeMs).toISOString())}</strong>
      <span>Backend-aligned clock · 1×</span>
    </div>

    {(delivery.message || sceneError) && <div className="notice" role="status">
      <span className="notice-title">{sceneError ? 'Scene issue' : delivery.status === 'unavailable' ? 'Waiting for orbital data' : 'Delivery degraded'}</span>
      <span>{sceneError ?? delivery.message}</span>
    </div>}

    <section className="panel-section">
      <div className="section-title"><h2>Position</h2><span>WGS84</span></div>
      <p className="section-note">Backend coordinates at {dataTime}</p>
      <dl>
        {line('Latitude', snapshot ? coordinate(snapshot.currentGeodetic.latitudeDegrees, 'N', 'S') : '—')}
        {line('Longitude', snapshot ? coordinate(snapshot.currentGeodetic.longitudeDegrees, 'E', 'W') : '—')}
        {line('Altitude', snapshot ? `${(snapshot.currentGeodetic.altitudeMeters / 1000).toFixed(1)} km` : '—')}
      </dl>
    </section>

    <section className="panel-section">
      <div className="section-title"><h2>Data state</h2><span>INDEPENDENT</span></div>
      <dl>
        {line('Orbital quality', quality?.status ?? 'NO DATA', `status-value ${quality?.status === 'GOOD' ? 'good' : quality?.status === 'STALE' ? 'warning' : 'muted'}`)}
        {quality && quality.reason !== 'NONE' && line('Quality reason', quality.reason.replaceAll('_', ' '))}
        {line('Source acquisition', health?.status ?? 'UNKNOWN', `status-value ${health?.status === 'HEALTHY' ? 'good' : health?.status === 'DEGRADED' ? 'warning' : 'muted'}`)}
        {line('API delivery', delivery.status.toUpperCase(), `status-value ${delivery.status === 'ready' ? 'good' : 'warning'}`)}
        {line('Sample buffer', bufferText, `status-value ${buffer === 'active' ? 'good' : 'warning'}`)}
        {line('3D model', modelState.status === 'ready' && modelState.loadMs !== null
          ? `READY · ${(modelState.loadMs / 1000).toFixed(1)} s`
          : modelState.status.toUpperCase(),
        `status-value ${modelState.status === 'ready' ? 'good' : modelState.status === 'failed' ? 'warning' : 'muted'}`)}
        {line('Attitude', 'UNAVAILABLE', 'status-value muted')}
      </dl>
    </section>

    <section className="panel-section provenance">
      <div className="section-title"><h2>Lineage</h2><span>GP / TLE</span></div>
      <dl>
        {line('Elements', snapshot ? `${snapshot.source.provider} · ${snapshot.source.upstreamOrigin}` : '—')}
        {line('Element epoch', utc(snapshot?.source.elementEpoch))}
        {line('Element age', quality ? age(quality.elementAgeSeconds) : '—')}
        {line('Retrieved', utc(snapshot?.source.retrievedAt))}
        {line('Last successful fetch', utc(health?.lastSuccessAt))}
        {line('Element hash', snapshot ? snapshot.source.elementSha256.slice(0, 12) : '—')}
      </dl>
    </section>

    <p className="model-note">{ISS_MODEL.credit}. 3D model display: NOT TO SCALE, enlarged for map readability. Orbital position and altitude are unchanged. Display pose: local ENU only; it does not represent ISS attitude. <a href={ISS_MODEL.sourcePage} target="_blank" rel="noreferrer">NASA source</a>.</p>
    <p className="provenance-note">Computed from CelesTrak orbital elements with Orekit. Past arc is reconstructed; future arc is GP/TLE propagation. Neither is onboard position telemetry. Orbital quality is assessed at the displayed snapshot time; GOOD is not an accuracy guarantee. Earth imagery: <a href="https://www.naturalearthdata.com/">Natural Earth II</a>.</p>
  </aside>;
}
