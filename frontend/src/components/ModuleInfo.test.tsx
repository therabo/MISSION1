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
        expect(html).toContain(module.componentId);
        expect(html).toContain(module.componentType);
        expect(html).toContain(module.nodeName);
        expect(html).toContain('Configuration context');
        expect(html).toContain('Live module telemetry');
        expect(html).toContain('unavailable');
        expect(html).toContain('NOT TO SCALE');
        expect(html).toContain(ISS_MODEL.sourcePage);
      }
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
    }
  });
  it('shows removal distinctly from current configuration and tolerates optional metadata', () => {
    const pirs = ISS_MODEL.semanticMappings.find((entry) => entry.componentId === 'PIRS')!;
    const historical = renderToStaticMarkup(<ModuleInfo module={pirs} onClose={() => {}} />);
    expect(historical).toContain('Removed from current station');
    expect(historical).toContain('Historical NASA VTAD asset representation');
    expect(historical).toContain('unavailable');

    const destiny = ISS_MODEL.semanticMappings[0];
    const current = renderToStaticMarkup(<ModuleInfo module={{ ...destiny, agency: undefined, role: undefined }} onClose={() => {}} />);
    expect(current).toContain('Current station component confirmed');
    expect(current).not.toContain('Historical NASA VTAD asset representation');
    expect(current).toContain('Live module telemetry');
  });
});
