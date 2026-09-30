import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TrajectorySelector } from './TrajectorySelector';

const props = { selectedSource: 'PRIMARY_GP_TLE' as const, viewMode: 'EARTH_OVERVIEW' as const, oemReason: null, sourceNotice: null, onSelect: () => {} };
describe('accessible position-source selector', () => {
  it('exposes primary default, OEM identity and a text description independent of color', () => {
    const html=renderToStaticMarkup(<TrajectorySelector {...props} />);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('MISSION1 GP/TLE propagated state');
    expect(html).toContain('NASA OEM');
    expect(html).not.toContain('disabled');
  });
  it('labels OEM predicted and shows explicit fallback messages', () => {
    const html=renderToStaticMarkup(<TrajectorySelector {...props} selectedSource="NASA_OEM" sourceNotice="Returned to GP/TLE" />);
    expect(html).toContain('NASA predicted ephemeris');
    expect(html).toContain('role="status"');
  });
  it('disables unavailable OEM and locks both options throughout all Inspection states', () => {
    expect(renderToStaticMarkup(<TrajectorySelector {...props} oemReason="Coverage missing" />)).toContain('disabled');
    for(const mode of ['ENTERING_INSPECTION','ISS_INSPECTION','EXITING_INSPECTION'] as const){
      const html=renderToStaticMarkup(<TrajectorySelector {...props} viewMode={mode} />);
      expect(html.match(/disabled=""/g)).toHaveLength(2);
      expect(html).toContain('Return to Earth View to change source');
    }
  });
});
