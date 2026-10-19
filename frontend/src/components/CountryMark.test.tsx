// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { CountryMark } from './CountryMark';
import { PositionStatusBar } from './PositionStatusBar';
import { COUNTRY_POLICY, type CountryLookupResult } from '../geo/countryLookup';

it('renders local flags directly without a shell and preserves missing-image text', async () => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const host = document.createElement('div'), root = createRoot(host);
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    for (const key of ['it','us','gb','jp','br','ch','va','np']) {
      await act(async () => root.render(<CountryMark flagKey={key} />));
      const img = host.querySelector('img')!;
      expect(host.children).toHaveLength(1); expect(host.firstElementChild).toBe(img);
      expect(img.className).toBe('country-mark'); expect(img.hasAttribute('data-natural-fit')).toBe(false);
      expect(host.querySelector('span,svg')).toBeNull();
      expect(img.getAttribute('src')).toBe(`/flags/${key}.svg`); expect(img.alt).toBe('');
      expect(img.getAttribute('aria-hidden')).toBe('true'); expect(img.draggable).toBe(false);
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
