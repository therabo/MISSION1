import type { CrewAssessment, CrewMember } from './types';
import { CrewPortrait } from './CrewPortrait';
import { CrewReports, CrewSources } from './CrewSummary';
import { latestCrewSourceUpdate, memberGroups, permittedPortrait, PRESENCE, HISTORICAL_PRESENCE, lastOperationalConfirmation, CURRENT_PRESENCE_NOTICE, QUALITY, utc } from './presentation';
import profileChevron from '../assets/interface/crew-chevron.svg';
import type { Coverage } from '../replay/replayApi';

export interface HistoricalRosterContext { at: string; availability: string; coverage: Coverage }

/** S7 presentation of the existing assessment. Assignment never implies presence. */
export function CurrentCrewRoster({ crew, onMember, selectedMemberId = null, historical }: {
  crew: CrewAssessment; onMember: (id: string) => void; selectedMemberId?: string | null; historical?: HistoricalRosterContext;
}) {
  const historicalCounts = historical && 'unresolvedSubjects' in crew ? crew.counts : null;
  const quality = QUALITY[crew.reconciliation.status];
  const datedPresence = crew.members.some(member => member.presence.state === 'STALE');
  const members = memberGroups(crew.members).flatMap(group => group.members);
  const assertionTimes = crew.provenance.contributingAssertions.map(assertion => assertion.asOf)
    .filter((at): at is string => at !== null && Number.isFinite(Date.parse(at)));
  const latestAssertion = assertionTimes.reduce<string | null>((latest, at) => latest === null || Date.parse(at) > Date.parse(latest) ? at : latest, null);
  const lastUpdate = historical ? null : latestCrewSourceUpdate(crew);
  return <>
    <dl className={`crew-roster-summary${historical ? '' : ' is-current'}`} aria-label={historical ? 'Historical Crew assessment' : 'Crew assessment'}>
      {historicalCounts ? <>
        <div><dt>Reported aboard</dt><dd className={historicalCounts.officialAboard === null ? 'crew-count-unavailable' : undefined}>{historicalCounts.officialAboard ?? 'Unavailable'}</dd>
          {historicalCounts.officialAboard === null && historicalCounts.lastKnownOfficialAboard !== null && <small>Last reported: {historicalCounts.lastKnownOfficialAboard} · count unverified at Historical UTC</small>}
        </div>
        <div><dt>Confirmed identities</dt><dd>{historicalCounts.resolvedAboard}</dd></div>
        <div><dt>Without confirmed identity</dt><dd>{historicalCounts.unidentifiedAboard}</dd>
          {historicalCounts.officialAboard === null && <small>{historicalCounts.lastKnownOfficialAboard === null ? 'Historical reported count unavailable' : 'In the retained count'}</small>}
        </div>
      </> : <div><dt>Current members</dt><dd>{crew.members.length}</dd><small>Membership and physical presence are separate</small></div>}
      {historical && <div className="crew-assessment"><dt>ASSESSMENT UTC</dt><dd><time dateTime={historical.at}>{utc(historical.at)}</time></dd>
        <details className={`crew-assessment-evidence crew-historical-evidence${historical.availability === 'AVAILABLE' && historical.coverage.status === 'AVAILABLE' && crew.reconciliation.status === 'MATCH' ? ' is-aligned' : ''}`}>
          <summary>{historical.coverage.status === 'UNAVAILABLE' ? 'Historical coverage unavailable' : historical.availability === 'PARTIAL' || historical.coverage.status === 'PARTIAL' ? 'Historical coverage partial' : quality.label} · Evidence</summary>
          <p>Best reconstruction from evidence stored today. Presence and assignments are effective at {utc(historical.at)}; coverage and roster may be partial. Assignment alone does not confirm presence.</p>
          <p>Profile names, portraits, biographies and career totals are latest-retained metadata, not historical snapshots.</p>
          <p>Reconciliation: {quality.label}. Coverage: {historical.coverage.status.toLowerCase()}.</p>
          {historicalCounts && historicalCounts.unresolvedSubjects > 0 && <p>{historicalCounts.unresolvedSubjects} unresolved source reports remain separate from confirmed identities.</p>}
          {historical.coverage.limitations.map((limitation, i) => <p key={i}>{limitation}</p>)}
          {datedPresence && <p>Historical presence evidence is dated; last-known confirmation is not confirmation at this UTC.</p>}
          {(crew.freshness.structuredSource.lastRefreshFailed || crew.freshness.verification.lastRefreshFailed) && <p>A retained source refresh failed. Fetch health describes collection, not presence at Historical UTC.</p>}
          <p>Latest retained assertion: {utc(latestAssertion)}</p>
          <CrewReports crew={crew} historicalAt={historical.at} />
          <CrewSources crew={crew} historicalAt={historical.at} />
        </details>
      </div>}
    </dl>
    {!historical && <div className="crew-roster-evidence">
      <p className="crew-last-update" title="Latest successful Crew source fetch. Presence assertions retain their own dates.">
        <span>Last update</span>{lastUpdate ? <time dateTime={lastUpdate}>{utc(lastUpdate)}</time> : <span>Unavailable</span>}
      </p>
      <details className={`crew-assessment-evidence${crew.reconciliation.status === 'MATCH' ? ' is-aligned' : ''}`}>
        <summary>{datedPresence ? CURRENT_PRESENCE_NOTICE : quality.label}
        </summary>
        <p>{quality.note}</p>
        <CrewSources crew={crew} />
      </details>
      {crew.freshness.stale && crew.reconciliation.status !== 'STALE' && <p className="crew-assessment-warning">Crew data may be outdated.</p>}
      {(crew.freshness.structuredSource.lastRefreshFailed || crew.freshness.verification.lastRefreshFailed) && <p className="crew-assessment-warning">A source refresh failed; available information is retained.</p>}
    </div>}
    <div className="crew-roster-columns" aria-hidden="true"><span>PERSON / ROLE</span><span>MISSION</span><span>AGENCY</span><span>PRESENCE EVIDENCE</span></div>
    {members.length ? <ul className="crew-roster-rows" aria-label="Crew identities and presence evidence">
      {members.map(member => <li key={member.id}><CrewRosterRow member={member} crew={crew} historical={historical} selected={member.id === selectedMemberId} onMember={onMember} /></li>)}
    </ul> : <p className="crew-roster-empty" role="status">{historical ? 'No resolved crew members at this Historical UTC.' : 'No resolved crew members are available.'}</p>}
  </>;
}

function CrewRosterRow({ member, crew, onMember, selected, historical }: { member: CrewMember; crew: CrewAssessment; onMember: (id: string) => void; selected: boolean; historical?: HistoricalRosterContext }) {
  const role = member.assignment?.role ?? (member.assignment ? 'Role unavailable' : 'No structured assignment');
  const mission = member.assignment && member.assignment.expeditionId === crew.expedition?.id ? crew.expedition.name : 'Unavailable';
  const presence = member.presence;
  const supportingPresence = presence.state === 'STALE' && presence.lastKnownState
    ? historical ? `Last known: ${HISTORICAL_PRESENCE[presence.lastKnownState].toLowerCase()}` : `${lastOperationalConfirmation(presence)}${presence.asOf ? ` · ${utc(presence.asOf)}` : ''}`
    : presence.state === 'CONFIRMED_ABOARD' ? historical ? 'Identity confirmed at Historical UTC' : 'Identity confirmed in assessment'
      : presence.state === 'CONFIRMED_NOT_ABOARD' ? historical ? 'Confirmed absence at Historical UTC' : 'Confirmed absence in assessment'
        : presence.state === 'AMBIGUOUS' ? 'Conflicting or unresolved evidence' : historical ? 'Confirmation unavailable at Historical UTC' : 'Current confirmation unavailable';
  return <button type="button" className="crew-member crew-roster-row" data-member-id={member.id} aria-pressed={selected}
    onClick={() => onMember(member.id)} aria-label={`${member.name ?? 'Name unavailable'} — open profile`}
    aria-describedby={`crew-context-${member.id} crew-presence-${member.id}`}>
    <CrewPortrait name={member.name} media={member.image} />
    <span className="crew-roster-identity" id={`crew-context-${member.id}`} title={historical ? `Assignment effective at ${utc(historical.at)}. Identity metadata is latest-retained.` : undefined}><strong>{member.name ?? 'Name unavailable'}</strong><span>{role}</span></span>
    <span className="crew-roster-mission"><span className="crew-roster-field-label">Mission</span><span>{mission}</span>
      {permittedPortrait(member.image) && <small>Photo: {member.image?.credit}</small>}
    </span>
    <span className="crew-roster-agency"><span className="crew-roster-field-label">Agency</span>{member.agency?.abbreviation ?? member.agency?.name ?? 'Unavailable'}</span>
    <span id={`crew-presence-${member.id}`} className={`crew-roster-presence state-${presence.state.toLowerCase()}`} title={`Presence as of ${utc(presence.asOf)}`}>
      <span className="crew-roster-field-label">Presence evidence</span><span>{(historical ? HISTORICAL_PRESENCE : PRESENCE)[presence.state]}</span><small>{supportingPresence}</small>
    </span>
    <span className="crew-roster-chevron" aria-hidden="true"><img src={profileChevron} alt="" /></span>
  </button>;
}
