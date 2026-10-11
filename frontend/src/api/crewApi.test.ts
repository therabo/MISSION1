import { afterEach, describe, expect, it, vi } from 'vitest';
import { CrewApiError, getCrewMember, getCurrentCrew, getCurrentExpedition } from './crewApi';
import { crewFixture, expeditionFixture, personFixture } from '../test/crewFixture';
import { decodeCrew, decodePerson } from '../crew/decode';

afterEach(() => vi.unstubAllGlobals());
describe('Crew REST client', () => {
  it('reads all three implemented resources through relative MISSION1 paths with cancellation and no-store', async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(crewFixture()))
      .mockResolvedValueOnce(Response.json(expeditionFixture()))
      .mockResolvedValueOnce(Response.json(personFixture()));
    vi.stubGlobal('fetch', mock);
    const signal = new AbortController().signal;
    expect((await getCurrentCrew(signal)).counts.structuredAssignments).toBe(7);
    expect((await getCurrentExpedition(signal)).assignmentCount).toBe(7);
    const person = personFixture();
    expect((await getCrewMember(person.id, signal)).id).toBe(person.id);
    expect(mock.mock.calls.map((call) => call[0])).toEqual([
      '/api/iss/crew',
      '/api/iss/expedition/current',
      `/api/iss/crew/${person.id}`,
    ]);
    expect(mock.mock.calls.every((call) => call[1].signal === signal && call[1].cache === 'no-store')).toBe(
      true,
    );
  });
  it.each([400, 404, 503, 500, 502])(
    'exposes HTTP %i without reflecting arbitrary body contents',
    async (status) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response('<script>internal SQL credentials</script>', { status })),
      );
      await expect(getCurrentCrew(new AbortController().signal)).rejects.toMatchObject({
        status,
        name: 'CrewApiError',
      });
      try {
        await getCrewMember(personFixture().id, new AbortController().signal);
      } catch (error) {
        expect(error).toBeInstanceOf(CrewApiError);
        expect(String(error)).not.toContain('SQL');
      }
    },
  );
  it('propagates AbortError and the caller signal', async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal(
      'fetch',
      vi.fn((_path, init) => Promise.reject(init.signal.reason)),
    );
    await expect(getCurrentCrew(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('rejects non-JSON success instead of silently creating an empty roster', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not JSON')));
    await expect(getCurrentCrew(new AbortController().signal)).rejects.toThrow();
  });
  it('sanitizes JSON parse errors without reflecting response fragments', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>internal SQL credentials</html>')));
    await expect(getCurrentCrew(new AbortController().signal)).rejects.toThrow(
      'Crew API returned an invalid JSON response.',
    );
  });
  it('encodes the complete member path segment', async () => {
    const mock = vi.fn().mockResolvedValue(Response.json(personFixture()));
    vi.stubGlobal('fetch', mock);
    await getCrewMember('bad/segment?query', new AbortController().signal);
    expect(mock.mock.calls[0][0]).toBe('/api/iss/crew/bad%2Fsegment%3Fquery');
  });
});
describe('wire decoding', () => {
  it('preserves partial-match counts, null profiles, evidence, rights and source times', () => {
    const crew = decodeCrew(crewFixture());
    expect(crew.counts).toEqual({ resolvedAboard: 8, structuredAssignments: 7 });
    expect(crew.members).toHaveLength(9);
    expect(crew).not.toHaveProperty('unresolvedSubjects');
    expect(crew.members.some((m) => m.assignment === null && m.presence.state === 'CONFIRMED_ABOARD')).toBe(
      true,
    );
  });
  it.each([null, {}, [], { counts: {} }])('rejects a missing/unsupported collection shape (%j)', (value) =>
    expect(() => decodeCrew(value)).toThrow(),
  );
  it.each([-1, 1.5, '11', undefined, Infinity])('rejects invalid count %s', (count) => {
    const value = { ...crewFixture(), counts: { ...crewFixture().counts, structuredAssignments: count } };
    expect(() => decodeCrew(value)).toThrow();
  });
  it('accepts unavailable count without deriving a fallback', () => {
    const value = crewFixture();
    value.counts.structuredAssignments = null;
    expect(decodeCrew(value).counts.structuredAssignments).toBeNull();
  });
  it('ignores additive fields and does not infer missing required fields', () => {
    expect(decodeCrew({ ...crewFixture(), futureOptionalField: true })).toEqual(crewFixture());
    expect(() =>
      decodeCrew({ ...crewFixture(), members: [{ ...crewFixture().members[0], presence: null }] }),
    ).toThrow();
  });
  it('rejects an unsupported presence/status and malformed UUID/time', () => {
    const crew = crewFixture();
    expect(() =>
      decodeCrew({ ...crew, reconciliation: { ...crew.reconciliation, status: 'LIVE' } }),
    ).toThrow();
    expect(() => decodeCrew({ ...crew, members: [{ ...crew.members[0], id: '649' }] })).toThrow();
    expect(() =>
      decodeCrew({ ...crew, freshness: { ...crew.freshness, evaluatedAt: 'yesterday' } }),
    ).toThrow();
  });
  it('supports NASA-only partial detail without manufactured structured data', () => {
    const person = personFixture();
    Object.assign(person, {
      biography: null,
      image: null,
      career: null,
      agency: null,
      nationalities: [],
      currentAssignment: null,
      profileAvailability: 'UNAVAILABLE',
      profileProvenance: null,
      profileLastSuccessfulFetchAt: null,
    });
    expect(decodePerson(person)).toEqual(person);
  });
});
