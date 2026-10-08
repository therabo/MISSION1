import type { CSSProperties } from 'react';
import type { CurrentCrew, CrewMember } from './types';
import { CrewPortrait } from './CrewPortrait';
import { CrewReports, CrewSources } from './CrewSummary';
import { memberGroups, permittedPortrait, PRESENCE, QUALITY, utc } from './presentation';
import profileChevron from '../assets/interface/crew-chevron.svg';

/** S7 presentation of the existing assessment. Assignment never implies presence. */
export function CurrentCrewRoster({ crew, onMember, selectedMemberId = null }: { crew: CurrentCrew; onMember: (id: string) => void; selectedMemberId?: string | null }) {
  const quality = QUALITY[crew.reconciliation.status];
  const datedPresence = crew.members.some(member => member.presence.state === 'STALE');
  const members = memberGroups(crew.members).flatMap(group => group.members);
  const assertionTimes = crew.provenance.contributingAssertions.map(assertion => assertion.asOf)
    .filter((at): at is string => at !== null && Number.isFinite(Date.parse(at)));
  const latestAssertion = assertionTimes.reduce<string | null>((latest, at) => latest === null || Date.parse(at) > Date.parse(latest) ? at : latest, null);
  return <>
    <dl className="crew-roster-summary" aria-label="Crew assessment">
      <div><dt>Reported aboard</dt><dd className={crew.counts.officialAboard === null ? 'crew-count-unavailable' : undefined}>{crew.counts.officialAboard ?? 'Unavailable'}</dd>
        {crew.counts.officialAboard === null && crew.counts.lastKnownOfficialAboard !== null && <small>Last reported: {crew.counts.lastKnownOfficialAboard} · current count unverified</small>}
      </div>
      <div><dt>Confirmed identities</dt><dd>{crew.counts.resolvedAboard}</dd></div>
      <div><dt>Without confirmed identity</dt><dd>{crew.counts.unidentifiedAboard}</dd>
        {crew.counts.officialAboard === null && <small>{crew.counts.lastKnownOfficialAboard === null ? 'Current reported count unavailable' : 'In the retained count'}</small>}
      </div>
      <div className="crew-assessment"><dt>ASSESSMENT UTC</dt><dd><time dateTime={crew.freshness.evaluatedAt}>{utc(crew.freshness.evaluatedAt)}</time></dd>
        <small>Latest retained assertion: {utc(latestAssertion)}</small>
      </div>
    </dl>
    <div className="crew-roster-evidence">
      <details className={`crew-assessment-evidence${crew.reconciliation.status === 'MATCH' ? ' is-aligned' : ''}`}>
        <summary>{datedPresence ? 'Presence evidence is dated · last-known confirmation is not current confirmation.' : quality.label}
          {crew.counts.unresolvedSubjects > 0 && <span> · {crew.counts.unresolvedSubjects} unresolved source reports</span>}
        </summary>
        <p>{quality.note}</p>
        <CrewReports crew={crew} />
        <CrewSources crew={crew} />
      </details>
      {crew.freshness.stale && crew.reconciliation.status !== 'STALE' && <p className="crew-assessment-warning">Crew data may be outdated.</p>}
      {(crew.freshness.structuredSource.lastRefreshFailed || crew.freshness.verification.lastRefreshFailed) && <p className="crew-assessment-warning">A source refresh failed; available information is retained.</p>}
    </div>
    <div className="crew-roster-columns" aria-hidden="true"><span>PERSON / ROLE</span><span>MISSION</span><span>AGENCY</span><span>PRESENCE EVIDENCE</span></div>
    {members.length ? <ul className="crew-roster-rows" aria-label="Crew identities and presence evidence"
      style={{ '--crew-row-count': members.length } as CSSProperties}>
      {members.map(member => <li key={member.id}><CrewRosterRow member={member} crew={crew} selected={member.id === selectedMemberId} onMember={onMember} /></li>)}
    </ul> : <p className="crew-roster-empty" role="status">No resolved crew members are available.</p>}
  </>;
}

function CrewRosterRow({ member, crew, onMember, selected }: { member: CrewMember; crew: CurrentCrew; onMember: (id: string) => void; selected: boolean }) {
  const role = member.assignment?.role ?? (member.assignment ? 'Role unavailable' : 'No structured assignment');
  const mission = member.assignment && member.assignment.expeditionId === crew.expedition?.id ? crew.expedition.name : 'Unavailable';
  const presence = member.presence;
  const supportingPresence = presence.state === 'STALE' && presence.lastKnownState
    ? `Last known: ${PRESENCE[presence.lastKnownState].toLowerCase()}`
    : presence.state === 'CONFIRMED_ABOARD' ? 'Identity confirmed in assessment'
      : presence.state === 'CONFIRMED_NOT_ABOARD' ? 'Confirmed absence in assessment'
        : presence.state === 'AMBIGUOUS' ? 'Conflicting or unresolved evidence' : 'Current confirmation unavailable';
  return <button type="button" className="crew-member crew-roster-row" data-member-id={member.id} aria-pressed={selected}
    onClick={() => onMember(member.id)} aria-label={`${member.name ?? 'Name unavailable'} — open profile`}
    aria-describedby={`crew-context-${member.id} crew-presence-${member.id}`}>
    <CrewPortrait name={member.name} media={member.image} />
    <span className="crew-roster-identity" id={`crew-context-${member.id}`}><strong>{member.name ?? 'Name unavailable'}</strong><span>{role}</span></span>
    <span className="crew-roster-mission"><span className="crew-roster-field-label">Mission</span><span>{mission}</span>
      {permittedPortrait(member.image) && <small>Photo: {member.image?.credit}</small>}
    </span>
    <span className="crew-roster-agency"><span className="crew-roster-field-label">Agency</span>{member.agency?.abbreviation ?? member.agency?.name ?? 'Unavailable'}</span>
    <span id={`crew-presence-${member.id}`} className={`crew-roster-presence state-${presence.state.toLowerCase()}`} title={`Presence as of ${utc(presence.asOf)}`}>
      <span className="crew-roster-field-label">Presence evidence</span><span>{PRESENCE[presence.state]}</span><small>{supportingPresence}</small>
    </span>
    <span className="crew-roster-chevron" aria-hidden="true"><img src={profileChevron} alt="" /></span>
  </button>;
}
