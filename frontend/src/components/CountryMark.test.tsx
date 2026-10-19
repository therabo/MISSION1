// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { CountryMark } from './CountryMark';
import { PositionStatusBar } from './PositionStatusBar';
import { COUNTRY_POLICY, type CountryLookupResult } from '../geo/countryLookup';

it('fits intact local flags in a decorative squircle and preserves name when image loading fails', async () => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const host = document.createElement('div'), root = createRoot(host);
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const css = readFileSync('src/components/CountryMark.css', 'utf8');
  expect(css).toContain('object-fit: contain'); expect(css).not.toMatch(/cover|clip-path|filter:|mask:/);
  try {
    for (const key of ['ch','np','us','gb','ca','za','kr','br']) {
      await act(async () => root.render(<CountryMark flagKey={key} />));
      const img = host.querySelector('img')!;
      expect(img.getAttribute('src')).toBe(`/flags/${key}.svg`); expect(img.alt).toBe('');
      expect(host.querySelector('.country-mark')?.getAttribute('aria-hidden')).toBe('true');
      expect(host.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 28 24');
      expect(host.querySelector('button,a,[tabindex]')).toBeNull();
    }
    const name = 'South Georgia and the South Sandwich Islands';
    const over: CountryLookupResult = { kind: 'country' as const, policy: COUNTRY_POLICY, boundary: false,
      country: { key: 'ne:iso2:GS', iso2: 'GS', iso3: 'SGS', displayName: name, flagKey: 'gs' } };
    await act(async () => root.render(<PositionStatusBar position={null} selectedSource={null} sceneTimeMs={null} buffer="waiting" over={over} />));
    const span = host.querySelector('.country-name')!; expect(span.textContent).toBe(name); expect(span.getAttribute('title')).toBe(name);
    await act(async () => host.querySelector('img')!.dispatchEvent(new Event('error')));
    expect(host.querySelector('.country-mark')).toBeNull(); expect(host.querySelector('.position-over dd')?.textContent).toBe(name);
    expect(warn).toHaveBeenCalledTimes(1); expect(host.querySelector('[aria-live],button,a,[tabindex]')).toBeNull();
  } finally { await act(async () => root.unmount()); warn.mockRestore(); }
});

it('renders all non-country outcomes as — without a mark or duplicate accessible text', async () => {
  const host = document.createElement('div'), root = createRoot(host);
  try {
    for (const kind of ['no-country','invalid-position','dataset-loading','dataset-unavailable','ambiguous-boundary'] as const) {
      const over: CountryLookupResult = kind === 'ambiguous-boundary' ? { kind, candidates: [], policy: COUNTRY_POLICY } : { kind };
      await act(async () => root.render(<PositionStatusBar position={null} selectedSource={null} sceneTimeMs={null} buffer="waiting" over={over} />));
      expect(host.querySelector('.position-over dd')?.textContent).toBe('—');
      expect(host.querySelector('.country-mark')).toBeNull();
      expect(host.querySelector('.position-over > div')?.getAttribute('data-country-state')).toBe(kind);
    }
  } finally { await act(async () => root.unmount()); }
});
