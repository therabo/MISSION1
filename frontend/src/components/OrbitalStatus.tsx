import type { OrbitalDelivery, BufferStatus } from '../orbital/bufferState';
import { ISS_MODEL } from '../cesium/modelPresentation';
import type { ModelLoadStatus } from '../cesium/modelPresentation';
import { SOURCE_LABELS, oemUnavailableReason } from '../cesium/trajectorySelection';
import type { PositionSnapshot, TrajectorySource } from '../cesium/trajectorySelection';
import type { ComparisonDelivery } from '../api/useComparisonDelivery';
import { OperationalSummary } from './OperationalSummary';

interface OrbitalStatusProps {
  delivery: OrbitalDelivery;
  comparison: ComparisonDelivery;
  buffer: BufferStatus;
  sceneTimeMs: number | null;
  sceneError: string | null;
  modelState: { status: ModelLoadStatus; loadMs: number | null };
  inspecting: boolean;
  selectedSource: TrajectorySource;
  position: PositionSnapshot | null;
  detailOnly?: boolean;
  sourceNotice?: string | null;
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

export function OrbitalStatus({ delivery, comparison, buffer, sceneTimeMs, sceneError, modelState, inspecting, selectedSource, position, detailOnly = false, sourceNotice = null }: OrbitalStatusProps) {
  const snapshot = delivery.window?.response;
  const quality = snapshot?.qualityAtGeneratedAt;
  const health = snapshot?.sourceHealth;
  const physical = position?.source === selectedSource ? position : null;
  const dataTime = physical ? utc(new Date(physical.timeMs).toISOString()) : 'Waiting for samples';
  const nasaSelected = selectedSource === 'NASA_OEM';
  const bufferText = buffer === 'active' ? 'ACTIVE' : buffer === 'expired' ? 'EXPIRED' : 'WAITING';

  const detailBody = <>
    <div className="panel-head">
      <span className="eyebrow">ORBITAL STATE / ISS</span>
      <h1>ISS orbital state</h1>
      <p>{SOURCE_LABELS[selectedSource]}</p>
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
      <p className="section-note">Physical sampled position at {dataTime}</p>
      <dl>
        {line('Latitude', physical ? coordinate(physical.latitudeDegrees, 'N', 'S') : '—')}
        {line('Longitude', physical ? coordinate(physical.longitudeDegrees, 'E', 'W') : '—')}
        {line('Altitude', physical ? `${(physical.altitudeMeters / 1000).toFixed(1)} km` : '—')}
      </dl>
    </section>

    {!inspecting && <section className="panel-section">
      <div className="section-title"><h2>Trajectory comparison</h2><span>TWO SOURCES</span></div>
      <dl>
        {line('ISS model', nasaSelected ? 'NASA predicted ephemeris' : 'GP/TLE propagated')}
        {line('Primary line', comparison.response ? 'FORWARD · 85%' : 'WAITING')}
        {line('NASA OEM', comparison.response?.oem.availability ?? (comparison.status === 'unavailable' ? 'UNAVAILABLE' : 'WAITING'),
          `status-value ${comparison.response?.oem.availability === 'AVAILABLE' ? 'good' : 'warning'}`)}
        {comparison.response?.oem.source && line('OEM created', utc(comparison.response.oem.source.creationDate))}
      </dl>
      <p className="section-note">The selected source drives the model and Inspection. OEM remains a source-provided prediction.</p>
    </section>}

    <section className="panel-section">
      <div className="section-title"><h2>Data state</h2><span>INDEPENDENT</span></div>
      <dl>
        {nasaSelected && line('Active OEM availability', comparison.response?.oem.availability ?? 'UNAVAILABLE', `status-value ${comparison.response?.oem.availability === 'AVAILABLE' ? 'good' : 'warning'}`)}
        {nasaSelected && comparison.response?.oem.reason !== 'NONE' && line('OEM reason', comparison.response?.oem.reason.replaceAll('_', ' ') ?? 'UNAVAILABLE')}
        {line('GP orbital quality', quality?.status ?? 'NO DATA', `status-value ${quality?.status === 'GOOD' ? 'good' : quality?.status === 'STALE' ? 'warning' : 'muted'}`)}
        {quality && quality.reason !== 'NONE' && line('GP quality reason', quality.reason.replaceAll('_', ' '))}
        {line('CelesTrak acquisition', health?.status ?? 'UNKNOWN', `status-value ${health?.status === 'HEALTHY' ? 'good' : health?.status === 'DEGRADED' ? 'warning' : 'muted'}`)}
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
      <div className="section-title"><h2>Active position lineage</h2><span>{nasaSelected ? 'NASA OEM' : 'GP / TLE'}</span></div>
      <dl>{nasaSelected ? <>
        {line('Product', 'NASA predicted ephemeris')}
        {line('Created', utc(comparison.response?.oem.source?.creationDate))}
        {line('Coverage starts', utc(comparison.response?.oem.source?.startTime))}
        {line('Coverage ends', utc(comparison.response?.oem.source?.stopTime))}
        {line('Retrieved', utc(comparison.response?.oem.source?.retrievedAt))}
        {line('OEM hash', comparison.response?.oem.source?.sha256.slice(0, 12) ?? '—')}
      </> : <>
        {line('Elements', snapshot ? `${snapshot.source.provider} · ${snapshot.source.upstreamOrigin}` : '—')}
        {line('Element epoch', utc(snapshot?.source.elementEpoch))}
        {line('Element age', quality ? age(quality.elementAgeSeconds) : '—')}
        {line('Retrieved', utc(snapshot?.source.retrievedAt))}
        {line('Last successful fetch', utc(health?.lastSuccessAt))}
        {line('Element hash', snapshot ? snapshot.source.elementSha256.slice(0, 12) : '—')}
      </>}</dl>
    </section>

    <p className="model-note">{ISS_MODEL.credit}. 3D model display: NOT TO SCALE, enlarged and visually lifted in Earth View for readability. Position and altitude readouts remain physical. Visual orientation: trajectory-aligned; verified ISS attitude unavailable. <a href={ISS_MODEL.sourcePage} target="_blank" rel="noreferrer">NASA source</a>.</p>
    <p className="provenance-note">The selected position source drives the model and Inspection camera. GP/TLE is computed with Orekit; NASA OEM is predicted ephemeris with bounded display interpolation. Both continuous trails start ahead of scene time and fade to zero over 85% of the primary mean-motion revolution, shortened honestly by OEM coverage. Neither product is onboard position telemetry or a ground truth claim. GP quality and CelesTrak acquisition remain independent of OEM availability. Earth imagery: <a href="https://nasa-gibs.github.io/gibs-api-docs/access-basics/">NASA GIBS</a> Blue Marble day imagery and historical Black Marble 2016 night lights.</p>
    </>;

  const qualityText = quality?.status === 'GOOD' ? 'Good' : quality?.status === 'STALE' ? 'Stale' : quality ? 'Unknown' : 'No data';
  const oemReason = oemUnavailableReason(comparison.response, sceneTimeMs);
  const availability = comparison.response?.oem.availability;
  const oemText = oemReason === 'OEM display buffer expired' ? 'Expired' : oemReason === 'OEM does not cover scene time' ? 'Uncovered' :
    availability === 'UNAVAILABLE' || comparison.status === 'unavailable' ? 'Unavailable' :
      !comparison.response || sceneTimeMs === null ? 'Waiting' : availability === 'DEGRADED' ? 'Degraded' : oemReason ? 'Unavailable' : 'Available';
  const statusText = nasaSelected ? oemText : qualityText;
  const tone = nasaSelected ? (oemText === 'Available' ? 'good' : oemText === 'Waiting' ? 'unknown' : 'warning') :
    quality?.status === 'GOOD' ? 'good' : quality?.status === 'STALE' ? 'warning' : 'unknown';
  const warning = [sourceNotice ? `NASA OEM fallback · Returned to GP/TLE · ${sourceNotice}` : null,
    sceneError ?? delivery.message ?? (buffer === 'expired' ? 'Orbital buffer expired · Position unavailable' :
      buffer === 'waiting' ? 'Waiting for orbital samples · Position unavailable' : null)].filter(Boolean).join(' · ');
  return <>
    {!detailOnly && <OperationalSummary position={position} selectedSource={selectedSource} sceneTimeMs={sceneTimeMs} buffer={buffer}
      sourceStatus={<details className="orbital-status-disclosure source-state-slot">
        <summary aria-controls="orbital-status-evidence" title={nasaSelected ? `OEM availability: ${availability ?? 'UNKNOWN'} · ${oemReason ?? 'Scene instant covered'} · Position buffer: ${buffer}` : quality ? `GP quality at ${utc(snapshot?.generatedAt)} · ${quality.reason}` : 'GP orbital quality unavailable'}>
          <span>{nasaSelected ? 'NASA OEM status' : 'General Perturbations quality'}</span>
          <strong className={`summary-quality ${tone}`}>{statusText}</strong>
        </summary>
      </details>} />}
    <div id="orbital-status-evidence" className="orbital-status-evidence" role="region" aria-label="ISS orbital status">{detailBody}</div>
    {warning && <p className="earth-current-notice" role={sceneError ? 'alert' : 'status'}>{warning}</p>}
  </>;
}
