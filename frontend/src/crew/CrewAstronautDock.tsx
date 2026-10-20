import { useRef } from 'react';
import { useCrewMember } from '../api/useCrewResource';
import { ContextDock } from '../components/ContextDock';
import { ContextButton } from '../components/ContextButton';
import { CrewPortrait } from './CrewPortrait';
import { CrewProfileEvidence } from './CrewProfile';
import { formatDuration, utc } from './presentation';
import { useCrewPortrait } from './useCrewPortrait';
import type { CrewMember, CurrentCrew } from './types';
import './CrewAstronautDock.css';
import { CrewDetailActions } from './CrewDetailActions';

/** The retained member is an inert exit snapshot, not selected-state ownership.
 * Key only the existing lazy resource, so A→B aborts A without rebuilding the dock. */
export function CrewAstronautDock({ member, crew, onClose }: { member: CrewMember | null; crew: CurrentCrew | null; onClose: () => void }) {
  const last = useRef<{ member: CrewMember; crew: CurrentCrew } | null>(null);
  if (member && crew) last.current = { member, crew };
  const shown = member && crew ? { member, crew } : last.current;
  if (!shown) return null;
  const assignment = shown.member.assignment;
  const mission = assignment?.expeditionId === shown.crew.expedition?.id ? shown.crew.expedition?.name : null;
  return <ContextDock open={!!member} title={shown.member.name ?? 'Name unavailable'}
    context={`${mission ?? 'Expedition unavailable'} · ${assignment?.role ?? (assignment ? 'Role unavailable' : 'No structured assignment')}`}
    className="astronaut-dock crew-detail-surface" entityId={shown.member.id} closeLabel="Close astronaut detail" onClose={onClose} motion="interruptible"
    headerActions={<CrewDetailActions onBack={onClose} onClose={onClose} />}>
    <AstronautProfileResource key={shown.member.id} member={shown.member} crew={shown.crew} />
  </ContextDock>;
}

function AstronautProfileResource({ member, crew }: { member: CrewMember; crew: CurrentCrew }) {
  const resource = useCrewMember(member.id);
  const person = resource.data?.id === member.id ? resource.data : null;
  const portrait = useCrewPortrait(person ?? member, 'detail');
  const credit = portrait.candidate?.media.credit;
  const usefulCredit = credit?.trim() && credit.trim().toLowerCase() !== 'unknown';
  const mission = member.assignment?.expeditionId === crew.expedition?.id ? crew.expedition?.name : null;
  return <>
    <div className="astronaut-profile-body" data-profile-member-id={member.id}>
      <figure className="astronaut-portrait-identity">
        <CrewPortrait name={member.name} portrait={portrait} variant="detail" />
        {usefulCredit && <figcaption className="astronaut-photo-credit">Photo: {credit}</figcaption>}
        {portrait.state === 'unavailable' && <p className="astronaut-secondary">Portrait unavailable</p>}
      </figure>
      <section><h3>Structured assignment</h3><dl><div><dt>Role</dt><dd>{member.assignment?.role ?? (member.assignment ? 'Role unavailable' : 'No structured assignment')}</dd></div>
        <div><dt>Nationality</dt><dd>{(person?.nationalities ?? member.nationalities).map(n => n.displayName ?? n.alpha3 ?? n.alpha2 ?? 'Unavailable').join(', ') || 'Unavailable'}</dd></div></dl>
        <p>{member.agency?.name ?? member.agency?.abbreviation ?? person?.agency?.name ?? person?.agency?.abbreviation ?? 'Agency unavailable'}</p>
      </section>
      <section><h3>Mission context</h3><dl>
        <div><dt>Expedition</dt><dd>{mission ?? 'Unavailable'}</dd></div>
        <div><dt>Arrival / departure</dt><dd>Unavailable</dd></div>
        <div><dt>Vehicle</dt><dd>Unavailable</dd></div>
      </dl></section>
      {resource.loading && <p className="astronaut-secondary" role="status">Loading astronaut profile…</p>}
      {resource.error && <div className="crew-error" role="alert"><p>{resource.error}</p><p>Member summary remains available.</p>
        {person && <p>Showing the previous profile response. The profile refresh failed.</p>}
        <ContextButton onClick={resource.refresh}>Retry profile</ContextButton>
      </div>}
      {person && <>
        {person.profileAvailability === 'UNAVAILABLE' && <p className="astronaut-secondary">Structured profile unavailable. Available identity and NASA presence context are shown.</p>}
        <section className="crew-biography"><h3>Biography</h3>{person.biography ? <p>{person.biography}</p> : <p className="astronaut-secondary">Biography unavailable.</p>}</section>
        <section><h3>Career</h3>{person.career ? <dl>
          <div><dt>Time in space</dt><dd className="astronaut-numeric">{formatDuration(person.career.timeInSpace)}</dd></div>
          <div><dt>EVA time</dt><dd className="astronaut-numeric">{formatDuration(person.career.evaTime)}</dd></div>
          <div><dt>Flights</dt><dd className="astronaut-numeric">{person.career.flightsCount ?? 'Unavailable'}</dd></div>
          <div><dt>Spacewalks</dt><dd className="astronaut-numeric">{person.career.spacewalksCount ?? 'Unavailable'}</dd></div>
          <div><dt>First flight</dt><dd className="astronaut-numeric">{utc(person.career.firstFlight)}</dd></div>
          <div><dt>Last flight</dt><dd className="astronaut-numeric">{utc(person.career.lastFlight)}</dd></div>
        </dl> : <p className="astronaut-secondary">Career statistics unavailable.</p>}
        </section>
        <CrewProfileEvidence person={person} />
      </>}
    </div>
  </>;
}
