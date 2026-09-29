import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ISS_MODEL } from '../cesium/modelPresentation';
import { ModuleInfo } from './ModuleInfo';

describe('verified static module information', () => {
  it('renders each approved identity, explicit telemetry absence, and no selection request', () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    try {
      for (const module of ISS_MODEL.semanticMappings) {
        const html = renderToStaticMarkup(<ModuleInfo module={module} onClose={() => {}} />);
        expect(html).toContain(module.displayName);
        expect(html).toContain(module.nodeName);
        expect(html).toContain('Live module telemetry:');
        expect(html).toContain('unavailable');
        expect(html).toContain('NOT TO SCALE');
        expect(html).toContain(ISS_MODEL.sourcePage);
      }
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
    }
  });
});
