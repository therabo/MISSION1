// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ReplayCrewPanel } from './ReplayCrewPanel';
import { decodeReplay, type ReplayResult } from './replayApi';
import { replayFixture } from '../test/replayFixture';
import { decodeCrew, decodeHistoricalCrew } from '../crew/decode';

const at = '2026-10-07T12:05:00Z';
let node: HTMLDivElement, root: Root;
function modern(time = at): ReplayResult {
  const result = decodeReplay(replayFixture(time), time);
  const crew = result.crew.state!;
  crew.freshness.evaluatedAt = time;
  crew.membership = { mode: 'HISTORICAL_V10_S10', revision: 0, evaluatedAt: time,
    policyVersion: 'crew-active-production-v1/crew-freshness-v2', health: 'HEALTHY', ageSeconds: 0,
    resolvedCurrentMembers: crew.members.length, nonPublishableActive: 0, canonicalCollisions: 0, unresolvedActiveSourceSlots: 0 };
  return result;
}
beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  vi.stubGlobal('fetch', vi.fn());
  node = document.createElement('div'); document.body.append(node); root = createRoot(node);
});
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.unstubAllGlobals(); });
async function show(result: ReplayResult) {
  await act(async () => root.render(<ReplayCrewPanel data={result} at={result.requestedAt} loading={false} error={null} onClose={() => {}} />));
}
const rows = () => [...node.querySelectorAll<HTMLButtonElement>('[data-member-id]')];

it('preserves modern historical policy metadata and rejects a Current mode in Historical', () => {
  const crew = modern().crew.state!;
  expect(decodeHistoricalCrew(crew).membership).toEqual(crew.membership);
  expect(() => decodeCrew(crew)).toThrow();
  expect(() => decodeHistoricalCrew({ ...crew, membership: { ...crew.membership, mode: 'ACTIVE_PROJECTION' } })).toThrow();
  expect(decodeHistoricalCrew({ ...crew, membership: undefined }).membership).toBeUndefined();
});
it('labels all active members uniformly, including a member with no assignment or current confirmation', async () => {
  const result = modern(), crew = result.crew.state!;
  const member = crew.members[0];
  member.assignment = null; member.presence = { ...member.presence, state: 'UNKNOWN', evidence: [], asOf: null };
  crew.counts.officialAboard = 200; // TEST ONLY aggregate cannot determine roster membership.
  await show(result);
  expect(rows()).toHaveLength(crew.members.length);
  expect(node.querySelector('.crew-roster-summary dd')?.textContent).toBe(String(crew.members.length));
  expect(node.querySelectorAll('.crew-roster-row .crew-historical-membership')).toHaveLength(crew.members.length);
  const row = rows().find(row => row.dataset.memberId === member.id)!;
  expect(row.textContent).toContain('Member at Historical UTC');
  expect(row.textContent).toContain('No individual operational observation available');
  expect(node.textContent).not.toContain('Identity confirmed at Historical UTC');
  expect(fetch).not.toHaveBeenCalled();
});
it('evaluates the annotation seven-day boundary relative to accepted Historical UTC, independent of wall clock', async () => {
  const result = modern(), member = result.crew.state!.members[0];
  const observed = '2026-09-30T12:05:00Z';
  member.presence = { ...member.presence, state: 'CONFIRMED_ABOARD', asOf: observed,
    evidence: [{ ...member.presence.evidence[0], type: 'PERSON_CURRENTLY_ABOARD', assertion: 'OBSERVED', asOf: observed }] };
  // A later read-time freshness timestamp must not replace the accepted effective time.
  result.crew.state!.freshness.evaluatedAt = '2027-01-01T00:00:00Z';
  await show(result);
  expect(rows().find(row => row.dataset.memberId === member.id)!.textContent).toContain('Operational presence recently observed');
  const later = modern('2026-10-07T12:05:00.001Z'); later.crew.state!.members[0].presence = member.presence;
  await show(later);
  expect(rows().find(row => row.dataset.memberId === member.id)!.textContent).toContain('No recent operational confirmation');
});
it('shows accepted historical membership and assignment independently of newer canonical profile lifecycle fields', async () => {
  const result = modern(), member = result.crew.state!.members.find(m => m.id === result.crew.profiles[0].id)!;
  member.assignment = null; member.presence = { ...member.presence, state: 'UNKNOWN', evidence: [], asOf: null };
  const person = result.crew.profiles[0];
  person.currentAssignment = { ...person.currentAssignment!, role: 'TEST ONLY today role' };
  person.currentPresence = { ...person.currentPresence, asOf: '2026-10-11T10:00:00Z' };
  await show(result);
  await act(async () => rows().find(row => row.dataset.memberId === member.id)!.click());
  const detail = node.querySelector('.crew-historical-detail')!;
  expect(detail.textContent).toContain('Membership at Historical UTC');
  expect(detail.textContent).toContain('Member at 2026-10-07 12:05:00 UTC');
  expect(detail.textContent).toContain('Operational presence evidence at Historical UTC');
  expect(detail.textContent).toContain('No structured assignment');
  expect(detail.textContent).toContain('latest retained canonical metadata');
  expect(detail.textContent).not.toContain('TEST ONLY today role');
  expect(detail.textContent).not.toContain('2026-10-11 10:00:00 UTC');
  expect(fetch).not.toHaveBeenCalled();
});
it('clears a selected departing member on an accepted Historical seek while retaining the new roster', async () => {
  const result = modern('2026-10-07T12:04:59Z'); await show(result);
  const id = rows()[0].dataset.memberId;
  await act(async () => rows()[0].click());
  const after = modern(); after.crew.state!.members = after.crew.state!.members.filter(m => m.id !== id);
  await show(after);
  expect(node.querySelector('.crew-historical-detail')).toBeNull();
  expect(rows().some(row => row.dataset.memberId === id)).toBe(false);
  expect(document.activeElement?.id).toBe('replay-crew-title');
  expect(node.querySelector('.crew-assessment time')?.getAttribute('datetime')).toBe(at);
  expect(fetch).not.toHaveBeenCalled();
});
