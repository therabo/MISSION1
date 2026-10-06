import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OperationalSummary } from './OperationalSummary';
import { OrbitalStatus } from './OrbitalStatus';
import { parseOrbitalWindow } from '../orbital/sampleMapping';
import { orbitalPayload } from '../test/orbitalFixture';
import type { OrbitalWindow } from '../orbital/types';

const window = parseOrbitalWindow(orbitalPayload(), 0);
// Recorded backend fixture is used only in tests, never in the live application.
const position = { source: 'PRIMARY_GP_TLE' as const, timeMs: window.generatedMs, ...window.response.currentGeodetic };
const props = { position, selectedSource: position.source, sceneTimeMs: position.timeMs, buffer: 'active' as const, quality: <span>Unknown</span> };

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
});

function status(orbital: OrbitalWindow | null = window, buffer: 'active' | 'expired' = 'active') {
  return renderToStaticMarkup(<OrbitalStatus compact crewOpen={false} onCrewOpen={() => {}}
    delivery={{ window: orbital, status: orbital ? 'ready' : 'unavailable', message: null }}
    comparison={{ response: null, status: 'loading' }} buffer={buffer} sceneTimeMs={position.timeMs}
    sceneError={null} modelState={{ status: 'ready', loadMs: 1000 }} inspecting={false} approaching={false} returning={false}
    selectedSource="PRIMARY_GP_TLE" position={position} />);
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
