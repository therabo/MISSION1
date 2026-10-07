import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { calendarDraftFromUtc, calendarDraftUtc, editCalendarDraft, calendarDays, moveCalendarDate, validateCalendarDraft, daysInMonth } from './calendarDraft';
import type { Coverage } from './replayApi';
const at = '2026-10-05T11:38:41.123Z';
const coverage: Coverage = { status: 'AVAILABLE', start: '2026-09-01T00:00:00Z', end: '2026-10-07T12:00:00Z',
  intervals: [{ start: '2026-09-01T00:00:00Z', end: '2026-10-07T12:00:00Z' }], limitations: [] };
const now = Date.parse(coverage.end!);
describe('UTC-only calendar draft validation', () => {
  it('preserves exact committed UTC, including milliseconds on an unchanged Apply', () => {
    expect(calendarDraftUtc(calendarDraftFromUtc(at))).toBe(at); expect(validateCalendarDraft(calendarDraftFromUtc(at), coverage, now).value).toBe(at);
    expect(calendarDraftUtc(editCalendarDraft(calendarDraftFromUtc(at), { day: 4 }))).toBe('2026-10-04T11:38:41.000Z');
  });
  it.each([[2024,29],[2026,28],[2000,29],[1900,28],[2100,28]])('validates February %s length %s', (year,length) => {
    expect(daysInMonth(year,2)).toBe(length); const draft={...calendarDraftFromUtc(at),year,month:2,day:29};
    expect(calendarDraftUtc(draft) === null).toBe(length===28);
  });
  it.each([['month',0],['month',13],['day',0],['day',32],['day',31],['year',0],['year',10000],['millisecond',-1],['millisecond',1000]])('rejects invalid %s=%s without normalizing', (field,value) => {
    expect(calendarDraftUtc({...calendarDraftFromUtc(at),month:4,[field]:value})).toBeNull();
  });
  it.each([['hour','24'],['hour','-1'],['minute','60'],['second','60'],['second',''],['minute','1.5'],['hour','024'],['second','NaN']])('rejects invalid UTC %s=%s', (field,value) => {
    expect(calendarDraftUtc({...calendarDraftFromUtc(at),[field]:value})).toBeNull();
  });
  it('rejects future time, uncovered range and coverage gaps', () => {
    expect(validateCalendarDraft(calendarDraftFromUtc('2026-10-07T12:00:01Z'),coverage,now).error).toContain('past UTC');
    expect(validateCalendarDraft(calendarDraftFromUtc('2026-08-31T23:59:59Z'),coverage,now).error).toContain('retained');
    expect(validateCalendarDraft(calendarDraftFromUtc(at),{...coverage,intervals:[]},now).error).toContain('retained');
    expect(validateCalendarDraft(calendarDraftFromUtc(at),null,now).error).toContain('loading');
  });
  it('includes coverage endpoints exactly', () => {
    for(const endpoint of [coverage.start!,coverage.end!]) expect(validateCalendarDraft(calendarDraftFromUtc(endpoint),coverage,now).value).toBe(new Date(endpoint).toISOString());
  });
  it('builds a Monday-first October grid matching Figma, with adjacent dates', () => {
    const grid=calendarDays(calendarDraftFromUtc(at));expect(grid).toHaveLength(35);
    expect(grid[0]).toEqual({year:2026,month:9,day:28});expect(grid.at(-1)).toEqual({year:2026,month:11,day:1});
  });
  it.each([['2026-10-01T11:38:41Z','ArrowLeft','2026-09-30T11:38:41.000Z'],['2026-12-31T11:38:41Z','ArrowRight','2027-01-01T11:38:41.000Z'],['2024-03-01T11:38:41Z','ArrowUp','2024-02-23T11:38:41.000Z'],['2026-03-31T11:38:41Z','PageUp','2026-02-28T11:38:41.000Z'],['2026-10-05T11:38:41Z','End','2026-10-11T11:38:41.000Z']])('keyboard %s / %s crosses boundaries in UTC', (input,key,expected) => {
    expect(calendarDraftUtc(moveCalendarDate(calendarDraftFromUtc(input),key))).toBe(expected);
  });
  it('produces identical UTC values in multiple client timezones', () => {
    const script="import {calendarDraftFromUtc,calendarDraftUtc,editCalendarDraft} from './src/replay/calendarDraft.ts'; console.log(calendarDraftUtc(editCalendarDraft(calendarDraftFromUtc('2026-10-05T11:38:41.123Z'),{day:4,hour:'03',minute:'07',second:'09'})));";
    for(const TZ of ['UTC','Europe/Rome','America/Los_Angeles','Asia/Tokyo']) {
      const value=execFileSync(process.execPath,['--input-type=module','-e',script],{cwd:process.cwd(),env:{...process.env,TZ},encoding:'utf8'}).trim();
      expect(value).toBe('2026-10-04T03:07:09.000Z');
    }
  });
});
