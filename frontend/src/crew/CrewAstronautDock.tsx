import { useRef } from 'react';
import { ContextDock } from '../components/ContextDock';
import { CrewPortrait } from './CrewPortrait';
import { CrewProfileEvidence } from './CrewProfile';
import { formatDuration, utc } from './presentation';
import { useCrewPortrait } from './useCrewPortrait';
import type { CrewMember, CrewPerson, CurrentCrew } from './types';
import './CrewAstronautDock.css';
import { CrewDetailActions } from './CrewDetailActions';

/** Only accepted, matching profiles enter the final card. The retained complete
 * snapshot serves the existing inert close animation; pending switches show no card. */
export function CrewAstronautDock({ member, crew, person, onClose }: { member: CrewMember | null; crew: CurrentCrew | null; person: CrewPerson | null; onClose: () => void }) {
  const last = useRef<{ member: CrewMember; crew: CurrentCrew; person: CrewPerson } | null>(null);
  const ready = member && crew && person?.id === member.id ? { member, crew, person } : null;
  if (ready) last.current = ready;
  const shown = member ? ready : last.current;
  if (!shown) return null;
  const assignment = shown.member.assignment;
  const mission = assignment?.expeditionId === shown.crew.expedition?.id ? shown.crew.expedition?.name : null;
  return <ContextDock open={!!member} title={shown.member.name ?? 'Name unavailable'}
    context={`${mission ?? 'Expedition unavailable'} · ${assignment?.role ?? (assignment ? 'Role unavailable' : 'No structured assignment')}`}
    className="astronaut-dock crew-detail-surface" entityId={shown.member.id} closeLabel="Close astronaut detail" onClose={onClose} motion="interruptible"
    headerActions={<CrewDetailActions onBack={onClose} onClose={onClose} />}>
    <AstronautProfile key={shown.member.id} member={shown.member} crew={shown.crew} person={shown.person} />
  </ContextDock>;
}

function AstronautProfile({ member, crew, person }: { member: CrewMember; crew: CurrentCrew; person: CrewPerson }) {
  const portrait = useCrewPortrait(person, 'detail');
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
        <div><dt>Nationality</dt><dd>{person.nationalities.map(n => n.displayName ?? n.alpha3 ?? n.alpha2 ?? 'Unavailable').join(', ') || 'Unavailable'}</dd></div></dl>
        <p>{member.agency?.name ?? member.agency?.abbreviation ?? person.agency?.name ?? person.agency?.abbreviation ?? 'Agency unavailable'}</p>
      </section>
      <section><h3>Mission context</h3><dl>
        <div><dt>Expedition</dt><dd>{mission ?? 'Unavailable'}</dd></div>
        <div><dt>Arrival / departure</dt><dd>Unavailable</dd></div>
        <div><dt>Vehicle</dt><dd>Unavailable</dd></div>
      </dl></section>
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
    </div>
  </>;
}
