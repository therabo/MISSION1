import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ISS_MODEL } from '../cesium/modelPresentation';
import { ModuleInfo } from './ModuleInfo';

describe('verified static module information', () => {
  it('renders each approved identity with the simplified card and no selection request', () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    try {
      for (const module of ISS_MODEL.semanticMappings) {
        const html = renderToStaticMarkup(<ModuleInfo module={module} onClose={() => {}} />);
        expect(html).toContain(module.displayName);
        expect(html).toContain(module.componentId);
        expect(html).toContain(module.componentType);
        expect(html).not.toContain(module.nodeName);
        expect(html).toContain('<h3>Function</h3>');
        expect(html).toContain(module.role);
        expect(html).toContain('Supporting technical detail');
        for (const removed of ['Evidence and provenance', 'Evidence &amp; provenance', 'Function / role', 'Configuration context', 'Component reference', 'Configuration evidence', 'Raw telemetry channels', 'Identity mapping', 'Limitations / availability', 'NASA VTAD geometry may differ', 'Identity verified:', 'Earth View display:', 'NOT TO SCALE', '<footer']) {
          expect(html).not.toContain(removed);
        }
        expect(html).toContain('Telemetry');
        expect(html).toContain('Loading telemetry');
        expect(html).not.toContain('Last telemetry record');
        expect(html).not.toContain(ISS_MODEL.sourcePage);
      }
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
    }
  });
  it('keeps historical-asset identity and optional metadata fallbacks without configuration presentation', () => {
    const pirs = ISS_MODEL.semanticMappings.find((entry) => entry.componentId === 'PIRS')!;
    const historical = renderToStaticMarkup(<ModuleInfo module={pirs} onClose={() => {}} />);
    expect(historical).toContain('Pirs');
    expect(historical).toContain(pirs.role);
    expect(historical).not.toContain('Removed from current station');
    expect(historical).toContain('Loading telemetry');

    const destiny = ISS_MODEL.semanticMappings[0];
    const current = renderToStaticMarkup(<ModuleInfo module={{ ...destiny, agency: undefined, role: undefined }} onClose={() => {}} />);
    expect(current).toContain('Agency unavailable');
    expect(current).toContain('Role unavailable for this mapped component');
    expect(current).not.toContain('Current station component confirmed');
    expect(current).not.toContain('Historical NASA VTAD asset representation');
    expect(current).toContain('Loading telemetry');
  });
});
