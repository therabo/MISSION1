import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { OrbitalNotice } from './OrbitalNotice';

const props = { buffer: 'active' as const, message: null, sceneError: null, sourceNotice: null };
it('keeps a healthy scene free of notices or quality presentation', () => {
  expect(renderToStaticMarkup(<OrbitalNotice {...props} />)).toBe('');
});
it.each(['waiting', 'expired'] as const)('retains the %s buffer notice independently of removed quality UI', buffer => {
  const html = renderToStaticMarkup(<OrbitalNotice {...props} buffer={buffer} />);
  expect(html).toContain('Position unavailable'); expect(html).toContain('role="status"');
  expect(html).not.toMatch(/summary|details|aria-controls|quality/);
});
it('preserves scene-error precedence, alert semantics and explicit OEM fallback', () => {
  const html = renderToStaticMarkup(<OrbitalNotice {...props} sceneError="Scene failed TEST" message="Delivery failed TEST" sourceNotice="OEM display buffer expired" />);
  expect(html).toContain('role="alert"'); expect(html).toContain('Scene failed TEST'); expect(html).not.toContain('Delivery failed TEST');
  expect(html).toContain('NASA OEM fallback · Returned to GP/TLE · OEM display buffer expired');
});
it('preserves delivery failures instead of silently keeping a valid-looking scene', () => {
  expect(renderToStaticMarkup(<OrbitalNotice {...props} message="API unavailable TEST" />)).toContain('API unavailable TEST');
});
