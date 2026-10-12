import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { crewFixture } from '../test/crewFixture';
import { operationalAnnotation } from './presentation';
import { CurrentCrewRoster } from './CurrentCrewRoster';
import { CrewAstronautDock } from './CrewAstronautDock';
import type { Presence } from './types';

const at = '2026-10-01T00:00:00Z';
function evidence(type = 'PERSON_CURRENTLY_ABOARD'): Presence {
  const crew=crewFixture();
  return { state:'CONFIRMED_ABOARD', lastKnownState:'CONFIRMED_ABOARD', asOf:at, authority:'NASA_OFFICIAL',
    evidence:[{source:'NASA_OFFICIAL',sourceType:'NASA_ISS_OPERATIONAL_POST',type,assertion:type==='PERSON_ENTERED_STATION'?'COMPLETED':'OBSERVED',
      completeness:'PARTIAL',asOf:at,provenance:{...crew.provenance.verification!,sourceEventAt:null,sourcePublishedAt:at}}] };
}
describe('Current membership and dated operational annotations', () => {
  it.each([-1,0,1])('uses inclusive seven-day observation boundary, offset%s ms', offset => {
    const end=new Date(Date.parse(at)+7*86400_000+offset).toISOString();
    expect(operationalAnnotation(evidence(),end).label).toBe(offset<=0?'Operational presence recently observed':'No recent operational confirmation');
  });
  it('explains identical entry and observation times with distinct semantics', () => {
    const crew=crewFixture();crew.freshness.evaluatedAt='2026-10-07T00:00:00Z';
    crew.members=crew.members.slice(0,2).map((m,i)=>({...m,presence:evidence(i?'PERSON_CURRENTLY_ABOARD':'PERSON_ENTERED_STATION')}));
    const html=renderToStaticMarkup(<CurrentCrewRoster crew={crew} onMember={()=>{}} />);
    expect(html.match(/class="crew-current-membership"/g)).toHaveLength(2);
    expect(html).toContain('Operational entry confirmed');expect(html).toContain('Operational presence recently observed');
    expect(html).toContain('Last operational entry');expect(html).toContain('Last operational observation: aboard');
    expect(html).not.toContain('Identity confirmed');
  });
  it('preserves fourteen-day entry continuity and explains expiry independently', () => {
    expect(operationalAnnotation(evidence('PERSON_ENTERED_STATION'),'2026-10-15T00:00:00Z').label).toBe('Operational entry confirmed');
    expect(operationalAnnotation(evidence('PERSON_ENTERED_STATION'),'2026-10-15T00:00:00.001Z').label).toBe('No recent operational confirmation');
  });
  it('gives every Current card uniform membership regardless of evidence state', () => {
    const crew=crewFixture();crew.members=crew.members.map((m,i)=>({...m,presence:i%2?{...evidence(),state:'STALE'}:{...evidence(),evidence:[],state:'UNKNOWN'}}));
    const html=renderToStaticMarkup(<CurrentCrewRoster crew={crew} onMember={()=>{}} />);
    expect(html.match(/class="crew-current-membership"/g)).toHaveLength(crew.members.length);
    expect(html).toContain('No recent operational confirmation');expect(html).toContain('No individual operational observation available');
    expect(html).not.toContain('state-stale');expect(html).not.toContain('Presence not currently confirmed');
  });
  it('separates detail membership, assignment and source precision', () => {
    const crew=crewFixture();const member={...crew.members[0],presence:evidence()};
    const html=renderToStaticMarkup(<CrewAstronautDock crew={crew} member={member} onClose={()=>{}} />);
    expect(html).not.toContain('Current membership');expect(html).not.toContain('Current member');expect(html).toContain('Structured assignment');
    expect(html).not.toContain('Operational presence evidence');expect(html).not.toContain('Publication-time proxy');expect(html).not.toContain('Operational source'); expect(member.presence.evidence[0].provenance.sourcePublishedAt).toBe(at);
    expect(html).not.toContain('Identity confirmed in Crew assessment');
  });
  it('does not label source outage or future evidence recently observed', () => {
    expect(operationalAnnotation({...evidence(),state:'UNVERIFIED'},at).label).toBe('Operational verification unavailable');
    expect(operationalAnnotation(evidence(),'2026-09-30T23:59:59Z').fresh).toBe(false);
  });
});
