import { afterEach, expect, it, vi } from 'vitest';
import { fetchOrbitalSamples } from './orbitalApi';
import { orbitalPayload } from '../test/orbitalFixture';

afterEach(() => vi.unstubAllGlobals());

it('maps a successful response from the relative API route', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => orbitalPayload() });
  vi.stubGlobal('fetch', fetchMock);
  const window = await fetchOrbitalSamples(new AbortController().signal);
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(fetchMock.mock.calls[0][0]).toBe('/api/iss/orbit/samples');
  expect(window.response.samples).toHaveLength(3);
});

it('treats HTTP 503 as unavailable without creating an orbital window', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
  await expect(fetchOrbitalSamples(new AbortController().signal)).rejects.toThrow('Orbital data unavailable');
});
