import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { stepHistoricalUtc, coherentHistoricalState, historicalSource } from './historicalPresentation';
import { HistoricalOrbitalSummary } from './HistoricalOrbitalSummary';
import { TrajectoryLegend } from '../components/TrajectoryLegend';
import { decodeReplay } from './replayApi';
import { historicalPayload } from '../test/historicalFixture';
import { replayFixture } from '../test/replayFixture';

const at = '2026-10-03T12:00:00Z';
describe('committed Historical UTC presentation', () => {
  it.each([
    ['2026-10-03T12:00:00Z', -600, '2026-10-03T11:50:00.000Z'],
    ['2026-10-03T12:55:00Z', 600, '2026-10-03T13:05:00.000Z'],
    ['2026-10-03T00:05:00Z', -600, '2026-10-02T23:55:00.000Z'],
    ['2026-10-01T00:05:00Z', -600, '2026-09-30T23:55:00.000Z'],
    ['2026-01-01T00:05:00Z', -600, '2025-12-31T23:55:00.000Z'],
    ['2024-02-29T23:55:00Z', 600, '2024-03-01T00:05:00.000Z'],
  ] as const)('steps %s by exactly %s seconds including UTC rollovers', (time, seconds, expected) => {
    expect(stepHistoricalUtc(time, seconds, Date.parse('2026-10-07T00:00:00Z'))).toBe(expected);
    expect(Date.parse(expected) - Date.parse(time)).toBe(seconds * 1000);
  });
  it('preserves the existing past-only constraint without clamping to a new invented instant', () => {
    expect(stepHistoricalUtc(at, 600, Date.parse(at))).toBe(at);
  });
  it('rejects old-request and old-effective answers before exposing any historical position', () => {
    const data = decodeReplay(historicalPayload(at), at);
    expect(coherentHistoricalState(data, at)).toBe(data.orbit.primary);
    expect(coherentHistoricalState(data, '2026-10-03T11:50:00Z')).toBeNull();
    data.orbit.primary!.effectiveAt = '2026-10-03T11:50:00Z';
    expect(coherentHistoricalState(data, at)).toBeNull();
  });
});
describe('Historical source and five-slot semantics', () => {
  it.each(['GOOD', 'STALE', 'UNKNOWN'])('shows the actual GP %s quality, never Current quality', quality => {
    const data = decodeReplay(historicalPayload(at), at); data.orbit.primary!.quality = quality;
    const html = renderToStaticMarkup(<HistoricalOrbitalSummary data={data} at={at} loading={false} error={null} sceneError={null} />);
    expect(html).toContain('General Perturbations quality'); expect(html).toContain(`>${quality[0] + quality.slice(1).toLowerCase()}<`);
    expect(html).toContain('4.691° N'); expect(html).toContain('416.4 km'); expect(html).toContain('TEST-retimed-source');
    expect(html).not.toContain('NASA OEM status'); expect(html).not.toContain('is-oem');
  });
  it('uses OEM retained-state availability rather than its accuracy UNKNOWN or today’s expiry guard', () => {
    const data = decodeReplay(historicalPayload(at, 'NASA_OEM'), at);
    const html = renderToStaticMarkup(<HistoricalOrbitalSummary data={data} at={at} loading={false} error={null} sceneError={null} />);
    expect(html).toContain('NASA OEM status'); expect(html).toContain('>Available<'); expect(html).not.toContain('Predicted ephemeris');
    expect(html).not.toContain('General Perturbations quality'); expect(html).not.toContain('>Good<'); expect(html).not.toContain('>Expired<');
    expect(html).toContain('source-state-slot'); expect(html).not.toContain('is-oem');
  });
  it.each(['GP_TLE','NASA_OEM'] as const)('derives one legend directly from the renderer’s %s primary state', kind => {
    const data = decodeReplay(historicalPayload(at, kind), at);
    const source = historicalSource(coherentHistoricalState(data, at));
    const html = renderToStaticMarkup(<TrajectoryLegend selectedSource={source} oemReason={null} />);
    expect(html.match(/trajectory-swatch /g)).toHaveLength(1);
    expect(html).toContain(kind === 'NASA_OEM' ? '>NASA OEM<' : '>GP/TLE<');
  });
  it('shows unavailable physical values and Waiting while a new seek has not resolved', () => {
    const old = decodeReplay(historicalPayload(at), at);
    const html = renderToStaticMarkup(<HistoricalOrbitalSummary data={old} at="2026-10-03T11:50:00Z" loading error={null} sceneError={null} />);
    expect(html.match(/measurement-unavailable/g)).toHaveLength(3); expect(html).toContain('>Waiting<');
    expect(html).not.toContain('4.691° N'); expect(html).not.toContain('416.4 km');
  });
  it('does not label absent evidence as an active GP/OEM source', () => {
    const data = decodeReplay(replayFixture(at), at);
    const html = renderToStaticMarkup(<HistoricalOrbitalSummary data={data} at={at} loading={false} error={null} sceneError={null} />);
    expect(html).toContain('Orbital source status'); expect(html).toContain('Orbit history unavailable');
    expect(html).not.toContain('General Perturbations quality'); expect(historicalSource(null)).toBeNull();
    const legend = renderToStaticMarkup(<TrajectoryLegend selectedSource={null} oemReason={null} />);
    expect(legend).toContain('Unavailable'); expect(legend).not.toContain('trajectory-swatch');
  });
});
