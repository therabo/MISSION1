import type { CrewAssessment, CurrentCrew, Presence } from './types';
import { CrewPortrait } from './CrewPortrait';
import {
  assertionLabel,
  lastOperationalConfirmation,
  CURRENT_PRESENCE_NOTICE,
  memberGroups,
  permittedPortrait,
  PRESENCE,
  QUALITY,
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
  const quality = QUALITY[crew.reconciliation.status];
  return (
    <>
      <div className="crew-summary">
        <p className="crew-expedition">{crew.expedition?.name ?? 'Expedition unavailable'}</p>
        <p className="crew-count">Current members <strong>{crew.members.length}</strong></p>
        <p className="crew-count-note">Membership and physical presence are separate</p>
      </div>
      <details className={`crew-quality ${crew.reconciliation.status === 'MATCH' ? 'is-aligned' : ''}`}>
        <summary>
          <strong>{crew.members.some(m => m.presence.state === 'STALE') ? CURRENT_PRESENCE_NOTICE : quality.label}</strong>
        </summary>
        <p>{quality.note}</p>
      </details>
      {crew.freshness.stale && crew.reconciliation.status !== 'STALE' && (
        <p className="crew-note">Crew data may be outdated.</p>
      )}
      {(crew.freshness.structuredSource.lastRefreshFailed ||
        crew.freshness.verification.lastRefreshFailed) && (
        <p className="crew-note">A source refresh failed; available information is retained.</p>
      )}
      {memberGroups(crew.members).map((group) => (
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
                    <PresenceLabel presence={member.presence} />
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

export function CrewSources({ crew, historicalAt }: { crew: CrewAssessment; historicalAt?: string }) {
  return (
    <details className="crew-sources">
        <summary>Data sources &amp; freshness</summary>
        <p>
          {historicalAt ? <>Historical assessment at {utc(historicalAt)}. Source fetch times describe retained collection history.</> : <>Evaluated {utc(crew.freshness.evaluatedAt)}. This panel shows the backend assessment at that time.</>}
        </p>
        <p>
          {crew.counts.structuredAssignments ?? 'Unavailable'} structured assignments · {crew.members.length}{' '}
          resolved profiles shown. Assignment and presence are separate.
        </p>
        {!historicalAt && 'membership' in crew && crew.membership && <>
          <p>Current membership evaluated {utc(crew.membership.evaluatedAt)} · {crew.membership.health.toLowerCase()}.
            {' '}{crew.counts.resolvedAboard} identities have current confirmation of physical presence.</p>
          {crew.membership.unresolvedActiveSourceSlots > 0 && <p>{crew.membership.unresolvedActiveSourceSlots} unresolved active source slots remain separate from resolved people; sources may repeat a person.</p>}
          {crew.membership.nonPublishableActive > 0 && <p>{crew.membership.nonPublishableActive} active identities await a publishable profile.</p>}
        </>}
        {(
          [
            [
              'Structured roster · Launch Library 2',
              crew.freshness.structuredSource,
              crew.provenance.structuredSource,
            ],
            ['NASA verification', crew.freshness.verification, crew.provenance.verification],
          ] as const
        ).map(([label, health, observation]) => (
          <section key={label}>
            <h3>{label}</h3>
            <dl>
              <div>
                <dt>Last successful fetch</dt>
                <dd>{utc(health.lastSuccessfulFetchAt)}</dd>
              </div>
              <div>
                <dt>Source state</dt>
                <dd>
                  {health.sourceState?.replaceAll('_', ' ').toLowerCase() ?? 'Not supplied'}
                  {health.stale ? ' · outdated' : ''}
                  {health.lastRefreshFailed ? ' · refresh failed' : ''}
                  {health.rateLimited ? ' · rate limited' : ''}
                </dd>
              </div>
              {observation && (
                <>
                  <div>
                    <dt>Original observation</dt>
                    <dd>{utc(observation.observedAt)}</dd>
                  </div>
                  <div>
                    <dt>Published</dt>
                    <dd>{utc(observation.sourcePublishedAt)}</dd>
                  </div>
                </>
              )}
            </dl>
            {safeHttps(observation?.sourceUrl ?? null) && (
              <a href={safeHttps(observation?.sourceUrl ?? null)} target="_blank" rel="noopener noreferrer">
                Source reference ↗
              </a>
            )}
          </section>
        ))}
        <p>Reconciled {utc(crew.reconciliation.reconciledAt)}</p>
        {crew.provenance.contributingAssertions.length > 0 && (
          <details>
            <summary>Supporting source assertions</summary>
            <ul>
              {crew.provenance.contributingAssertions.map((evidence, index) => (
                <li key={index}>
                  {assertionLabel(evidence)} · {utc(evidence.asOf)}
                  {safeHttps(evidence.provenance.sourceUrl) && (
                    <>
                      {' '}
                      ·{' '}
                      <a
                        href={safeHttps(evidence.provenance.sourceUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        NASA report ↗
                      </a>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </details>
  );
}
