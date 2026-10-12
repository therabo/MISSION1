import type { CrewAssessment, CurrentCrew, Presence } from './types';
import { CrewPortrait } from './CrewPortrait';
import {
  assertionLabel,
  lastOperationalConfirmation,
  operationalAnnotation,
  memberGroups,
  permittedPortrait,
  PRESENCE,
  safeHttps,
  utc,
} from './presentation';

export function PresenceLabel({ presence }: { presence: Presence }) {
  return (
    <span className={`crew-presence state-${presence.state.toLowerCase()}`}>
      {PRESENCE[presence.state]}
      {presence.state === 'STALE' && presence.lastKnownState && (
        <span> · {lastOperationalConfirmation(presence)}{presence.asOf && <> · <time dateTime={presence.asOf}>{utc(presence.asOf)}</time></>}</span>
      )}
    </span>
  );
}
export function CrewSummary({ crew, onMember }: { crew: CurrentCrew; onMember: (id: string) => void }) {
  return (
    <>
      <div className="crew-summary">
        <p className="crew-expedition">{crew.expedition?.name ?? 'Expedition unavailable'}</p>
        <p className="crew-count">Current members <strong>{crew.members.length}</strong></p>
      </div>
      {crew.freshness.stale && crew.reconciliation.status !== 'STALE' && (
        <p className="crew-note">Crew data may be outdated.</p>
      )}
      {(crew.freshness.structuredSource.lastRefreshFailed ||
        crew.freshness.verification.lastRefreshFailed) && (
        <p className="crew-note">A source refresh failed; available information is retained.</p>
      )}
      {memberGroups(crew.members, true).map((group) => (
        <section className="crew-group" key={group.label} aria-label={group.label}>
          <h3>{group.label}</h3>
          <ul className="crew-members">
            {group.members.map((member) => (
              <li key={member.id}>
                <button
                  className="crew-member"
                  type="button"
                  data-member-id={member.id}
                  onClick={() => onMember(member.id)}
                >
                  <CrewPortrait name={member.name} media={member.image} />
                  <span className="crew-member-copy">
                    <strong>{member.name ?? 'Name unavailable'}</strong>
                    <span>
                      {member.assignment?.role ??
                        (member.assignment ? 'Role unavailable' : 'No structured assignment')}
                      {member.agency && (
                        <> · {member.agency.abbreviation ?? member.agency.name ?? 'Agency unavailable'}</>
                      )}
                    </span>
                    <span className="crew-current-membership">Current member</span>
                    <span className="crew-secondary-operational">{operationalAnnotation(member.presence, crew.freshness.evaluatedAt).label}</span>
                    {permittedPortrait(member.image) && <small>Photo: {member.image?.credit}</small>}
                  </span>
                  <span className="crew-chevron" aria-hidden="true">
                    ›
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {crew.members.length === 0 && <p className="crew-note">No resolved crew members are available.</p>}
      <CrewSources crew={crew} />
    </>
  );
}

/** Shared, unchanged source reports for Current and legacy Historical/detail presentation. */
export function CrewReports({ crew, historicalAt }: { crew: CrewAssessment; historicalAt?: string }) {
  return <>
    {'unresolvedSubjects' in crew && crew.unresolvedSubjects.length > 0 && (
        <section className="crew-unresolved" aria-label="Unresolved source reports">
          <h3>Additional NASA-reported crew</h3>
          <p>
            {crew.counts.unresolvedSubjects} unresolved report entries. Identity reconciliation is pending;
            reports may repeat a name.
          </p>
          <ul>
            {crew.unresolvedSubjects.map((subject, index) => (
              <li key={index}>
                <strong>{subject.displayName}</strong>
                <span>
                  {assertionLabel(subject.evidence)} · {subject.evidence.assertion.toLowerCase()} ·{' '}
                  {subject.resolution === 'AMBIGUOUS' ? 'Identity ambiguous' : 'Identity unresolved'}
                </span>
                <span>
                  {subject.applicable
                    ? 'Applicable source assertion'
                    : historicalAt ? 'Retained assertion · not applicable at Historical UTC' : 'Retained assertion · not currently applicable'}{' '}
                  · {utc(subject.evidence.asOf)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
  </>;
}

/** Essential collection provenance; underlying diagnostics remain in the REST contract. */
export function CrewSources({ crew }: { crew: CrewAssessment }) {
  return <section className="crew-data-source" aria-label="Data source">
    <h3>Data source</h3>
    {([
      ['Structured roster · Launch Library 2', crew.freshness.structuredSource, crew.provenance.structuredSource],
      ['NASA verification', crew.freshness.verification, crew.provenance.verification],
    ] as const).map(([label, health, observation]) => {
      const reference = safeHttps(observation?.sourceUrl ?? null);
      return <section className="crew-source-group" key={label} aria-label={label}>
        <h4>{label}</h4>
        <dl>
          <div><dt>Last successful fetch</dt><dd>{utc(health.lastSuccessfulFetchAt)}</dd></div>
          <div><dt>Source state</dt><dd>{health.sourceState?.replaceAll('_', ' ').toLowerCase() ?? 'Unavailable'}</dd></div>
          <div><dt>Original observation</dt><dd>{utc(observation?.observedAt ?? null)}</dd></div>
          <div><dt>Published</dt><dd>{utc(observation?.sourcePublishedAt ?? null)}</dd></div>
        </dl>
        {reference && <a href={reference} aria-label={`${label} source reference`} target="_blank" rel="noopener noreferrer">Source reference ↗</a>}
      </section>;
    })}
    <p className="crew-source-reconciled">Reconciled {utc(crew.reconciliation.reconciledAt)}</p>
  </section>;
}
