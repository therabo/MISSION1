import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OperationalSummary } from './OperationalSummary';
import { OrbitalStatus } from './OrbitalStatus';
import { parseOrbitalWindow } from '../orbital/sampleMapping';
import { orbitalPayload } from '../test/orbitalFixture';
import type { OrbitalWindow } from '../orbital/types';
import { parseComparison } from '../orbital/comparison';
import { fixture } from '../test/comparisonFixture';

const window = parseOrbitalWindow(orbitalPayload(), 0);
// Recorded backend fixture is used only in tests, never in the live application.
const position = { source: 'PRIMARY_GP_TLE' as const, timeMs: window.generatedMs, ...window.response.currentGeodetic };
const props = { position, selectedSource: position.source, sceneTimeMs: position.timeMs, buffer: 'active' as const, sourceStatus: <span>Unknown</span> };

describe('physical operational summary', () => {
  it('uses the supplied real physical coordinates, units and source classification', () => {
    const html = renderToStaticMarkup(<OperationalSummary {...props} />);
    expect(html).toContain('4.691° N'); expect(html).toContain('92.065° E'); expect(html).toContain('416.4 km');
    expect(html).toContain('ISS / WGS84'); expect(html).toContain('Computed position'); expect(html).not.toContain('434.6');
  });
  it.each(['waiting', 'expired'] as const)('does not show a retained physical sample when the buffer is %s', buffer => {
    const html = renderToStaticMarkup(<OperationalSummary {...props} buffer={buffer} />);
    expect(html.match(/Unavailable/g)).toHaveLength(3); expect(html).not.toContain('416.4');
  });
  it('rejects missing, mismatched-source, old-instant or non-finite samples without zero fallback', () => {
    for (const sample of [null, { ...position, source: 'NASA_OEM' as const }, { ...position, timeMs: position.timeMs - 1000 }, { ...position, altitudeMeters: NaN }]) {
      const html = renderToStaticMarkup(<OperationalSummary {...props} position={sample} />);
      expect(html.match(/Unavailable/g)).toHaveLength(3); expect(html).not.toContain('0.000°');
    }
  });
  it('shows OEM physical values with predicted classification and retains the source-specific fifth slot', () => {
    const html = renderToStaticMarkup(<OperationalSummary {...props} selectedSource="NASA_OEM"
      position={{ ...position, source: 'NASA_OEM' }} sourceStatus={<details className="source-state-slot"><summary>NASA OEM status · Available</summary></details>} />);
    expect(html).toContain('Predicted ephemeris'); expect(html).toContain('4.691° N'); expect(html).toContain('416.4 km');
    expect(html).not.toContain('General Perturbations quality'); expect(html).not.toContain('Good');
    expect(html).toContain('NASA OEM status · Available');
    expect(html).toContain('source-state-slot'); expect(html).not.toContain('is-oem');
    expect(html).not.toContain('Attitude');
  });
});

function status(orbital: OrbitalWindow | null = window, buffer: 'active' | 'expired' = 'active', overrides: Partial<ComponentProps<typeof OrbitalStatus>> = {}) {
  return renderToStaticMarkup(<OrbitalStatus compact crewOpen={false} onCrewOpen={() => {}}
    delivery={{ window: orbital, status: orbital ? 'ready' : 'unavailable', message: null }}
    comparison={{ response: null, status: 'loading' }} buffer={buffer} sceneTimeMs={position.timeMs}
    sceneError={null} modelState={{ status: 'ready', loadMs: 1000 }} inspecting={false} approaching={false} returning={false}
    selectedSource="PRIMARY_GP_TLE" position={position} {...overrides} />);
}

describe('GP quality and retained evidence in the compact presentation', () => {
  it.each(['GOOD', 'STALE', 'UNKNOWN'] as const)('retains backend %s independently of acquisition health and OEM availability', quality => {
    const orbital = structuredClone(window); orbital.response.qualityAtGeneratedAt.status = quality;
    orbital.response.sourceHealth.status = 'DEGRADED';
    const html = status(orbital);
    expect(html).toContain(`>${quality === 'GOOD' ? 'Good' : quality === 'STALE' ? 'Stale' : 'Unknown'}<`);
    expect(html).toContain('General Perturbations quality'); expect(html).toContain('DEGRADED');
    expect(html).toContain(orbital.response.source.elementSha256.slice(0, 12));
    expect(html).toContain('NASA source'); expect(html).toContain('Neither product is onboard position telemetry');
  });
  it('labels quality as unavailable without data; an expired buffer cannot retain a current position', () => {
    expect(status(null)).toContain('No data');
    const html = status(window, 'expired');
    expect(html).toContain('Orbital buffer expired'); expect(html).toContain('Position unavailable');
    expect(html).not.toContain('class="status-panel"');
  });
});


// Synthetic TEST comparison, aligned to the recorded physical-position instant.
function coveredComparison() {
  const response = parseComparison(fixture(true));
  const delta = position.timeMs - Date.parse(response.generatedAt);
  const shift = (date: string) => new Date(Date.parse(date) + delta).toISOString();
  response.generatedAt = shift(response.generatedAt);
  response.oem.source!.startTime = shift(response.oem.source!.startTime);
  response.oem.source!.stopTime = shift(response.oem.source!.stopTime);
  response.oem.samples.forEach(sample => { sample.time = shift(sample.time); });
  return response;
}

describe('source-specific status in the shared fifth slot', () => {
  it.each(['available', 'degraded', 'unavailable', 'uncovered', 'expired', 'waiting'] as const)('preserves real OEM %s semantics without presenting GP quality as OEM quality', state => {
    const response = coveredComparison();
    if (state === 'degraded') response.oem.availability = 'DEGRADED';
    if (state === 'unavailable') { response.oem.availability = 'UNAVAILABLE'; response.oem.reason = 'NO_VALID_OEM_FILE'; }
    if (state === 'uncovered') response.oem.source!.startTime = new Date(position.timeMs + 1000).toISOString();
    if (state === 'expired') response.generatedAt = new Date(position.timeMs - 301000).toISOString();
    const html = status(window, 'active', { selectedSource: 'NASA_OEM',
      position: { ...position, source: 'NASA_OEM' },
      comparison: { response: state === 'waiting' ? null : response, status: state === 'waiting' ? 'loading' : 'ready' } });
    const summary = html.match(/<summary[^>]*>(.*?)<\/summary>/)?.[1] ?? '';
    expect(summary).toContain('NASA OEM status');
    expect(summary).toContain(`>${state[0].toUpperCase() + state.slice(1)}<`);
    expect(summary).not.toContain('Good'); expect(summary).not.toContain('General Perturbations');
    expect(html).toContain('source-state-slot'); expect(html).not.toContain('is-oem');
    expect(html).toContain('GP orbital quality'); // Separate supporting pipeline evidence remains explicitly identified.
  });
  it('keeps OEM availability separate from the shared physical-position buffer', () => {
    const html = status(window, 'expired', { selectedSource: 'NASA_OEM', comparison: { response: coveredComparison(), status: 'ready' } });
    expect(html).toContain('>Available<'); expect(html).toContain('Position buffer: expired');
    expect(html).toContain('Position unavailable'); expect(html.match(/class="measurement-unavailable"/g)).toHaveLength(3);
  });
  it('restores GP quality in the same slot and keeps the explicit OEM fallback reason', () => {
    const html = status(window, 'active', { sourceNotice: 'OEM display buffer expired' });
    expect(html).toContain('source-state-slot'); expect(html).toContain('General Perturbations quality');
    expect(html).toContain('>Good<'); expect(html).toContain('NASA OEM fallback · Returned to GP/TLE · OEM display buffer expired');
    expect(html).not.toContain('NASA OEM status');
  });
});
