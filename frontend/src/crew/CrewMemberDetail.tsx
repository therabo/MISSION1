import { useEffect, useRef } from 'react';
import { useCrewMember } from '../api/useCrewResource';
import type { CrewMember } from './types';
import { CrewPortrait } from './CrewPortrait';
import { PresenceLabel } from './CrewSummary';
import { formatDuration, permittedPortrait, QUALITY, safeHttps, utc } from './presentation';
import type { CrewPerson } from './types';

export function CrewProfile({ person, replayAt }: { person: CrewPerson; replayAt?: string }) {
  const nationality = person.nationalities
    .map((n) => n.displayName ?? n.alpha3 ?? n.alpha2 ?? 'Unavailable')
    .join(', ');
  const profileUrl = safeHttps(person.officialProfileUrl);
  return (
    <div className="crew-profile">
      {replayAt && <p className="crew-note">Assignment and presence are effective at {replayAt}. Profile details use the latest retained metadata and may be newer.</p>}
      <dl>
        <div>
          <dt>Agency</dt>
          <dd>{person.agency?.name ?? person.agency?.abbreviation ?? 'Unavailable'}</dd>
        </div>
        <div>
          <dt>Nationality</dt>
          <dd>{nationality || 'Unavailable'}</dd>
        </div>
        <div>
          <dt>{replayAt ? "Assignment at replay time" : "Current assignment"}</dt>
          <dd>
            {person.currentAssignment
              ? (person.currentAssignment.role ?? 'Role unavailable')
              : 'No structured assignment'}
          </dd>
        </div>
        {person.currentAssignment && (
          <div>
            <dt>Assignment validity</dt>
            <dd>
              {utc(person.currentAssignment.validFrom)} → {utc(person.currentAssignment.validUntil)}
            </dd>
          </div>
        )}
        <div>
          <dt>Presence as of</dt>
          <dd>{utc(person.currentPresence.asOf)}</dd>
        </div>
      </dl>
      <p className="crew-note">
        {QUALITY[person.reconciliation.status].label} · evaluated {utc(person.reconciliation.evaluatedAt)}
      </p>
      {person.profileAvailability === 'UNAVAILABLE' && (
        <p className="crew-note">
          Structured profile unavailable. Available identity and NASA presence context are shown.
        </p>
      )}
      {person.biography ? (
        <section className="crew-biography">
          <h3>Biography</h3>
          {person.biography.length > 700 ? (
            <details>
              <summary>Read biography</summary>
              <p>{person.biography}</p>
            </details>
          ) : (
            <p>{person.biography}</p>
          )}
        </section>
      ) : (
        <p className="crew-note">Biography unavailable.</p>
      )}
      <section className="crew-career">
        <h3>{replayAt ? "Latest retained career totals" : "Career totals"}</h3>
        {person.career ? (
          <dl>
            <div>
              <dt>Time in space</dt>
              <dd>{formatDuration(person.career.timeInSpace)}</dd>
            </div>
            <div>
              <dt>EVA time</dt>
              <dd>{formatDuration(person.career.evaTime)}</dd>
            </div>
            <div>
              <dt>Flights</dt>
              <dd>{person.career.flightsCount ?? 'Unavailable'}</dd>
            </div>
            <div>
              <dt>Spacewalks</dt>
              <dd>{person.career.spacewalksCount ?? 'Unavailable'}</dd>
            </div>
            <div>
              <dt>First flight</dt>
              <dd>{utc(person.career.firstFlight)}</dd>
            </div>
            <div>
              <dt>Last flight</dt>
              <dd>{utc(person.career.lastFlight)}</dd>
            </div>
          </dl>
        ) : (
          <p className="crew-note">Career statistics unavailable.</p>
        )}
        <p className="crew-note">{replayAt ? "Latest retained profile metadata; career totals are not reconstructed at replay time." : "Cumulative source totals; not elapsed time on this expedition."}</p>
      </section>
      {profileUrl && (
        <p>
          <a href={profileUrl} target="_blank" rel="noopener noreferrer">
            Official profile ↗
          </a>
        </p>
      )}
      {person.image && (
        <details className="crew-sources">
          <summary>Portrait credit &amp; rights</summary>
          {!permittedPortrait(person.image) && (
            <p>Portrait withheld because reuse permission is unknown or restricted.</p>
          )}
          <p>
            Credit: {person.image.credit ?? 'Not supplied'}
            <br />
            License: {person.image.licenseName ?? 'Not supplied'}
            <br />
            Single-use restriction:{' '}
            {person.image.singleUse === null ? 'Not supplied' : person.image.singleUse ? 'Yes' : 'No'}
          </p>
          {safeHttps(person.image.licenseUrl) && (
            <a href={safeHttps(person.image.licenseUrl)} target="_blank" rel="noopener noreferrer">
              License reference ↗
            </a>
          )}
        </details>
      )}
      <details className="crew-sources">
        <summary>Profile source &amp; presence evidence</summary>
        <p>Profile last successful fetch: {utc(person.profileLastSuccessfulFetchAt)}</p>
        <p>Original profile observation: {utc(person.profileProvenance?.observedAt ?? null)}</p>
        {safeHttps(person.profileProvenance?.sourceUrl ?? null) && (
          <a
            href={safeHttps(person.profileProvenance?.sourceUrl ?? null)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Profile source ↗
          </a>
        )}
        {person.currentPresence.evidence.map((evidence, index) => (
          <p key={index}>
            {evidence.type.replaceAll('_', ' ').toLowerCase()} · {evidence.assertion.toLowerCase()} ·{' '}
            {utc(evidence.asOf)}
            {safeHttps(evidence.provenance.sourceUrl) && (
              <>
                {' '}
                ·{' '}
                <a href={safeHttps(evidence.provenance.sourceUrl)} target="_blank" rel="noopener noreferrer">
                  Source report ↗
                </a>
              </>
            )}
          </p>
        ))}
      </details>
    </div>
  );
}
export function CrewMemberDetail({ member }: { member: CrewMember }) {
  const resource = useCrewMember(member.id);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    title.current?.focus();
  }, []);
  const person = resource.data;
  const name = person ? person.name : member.name;
  const media = person ? person.image : member.image;
  return (
    <div className="crew-detail">
      <div className="crew-detail-heading">
        <CrewPortrait name={name} media={media} />
        <div>
          <h3 ref={title} tabIndex={-1}>
            {name ?? 'Name unavailable'}
          </h3>
          <PresenceLabel presence={person?.currentPresence ?? member.presence} />
          {permittedPortrait(media) && <small>Photo: {media?.credit}</small>}
        </div>
      </div>
      {resource.loading && (
        <p className="crew-note" role="status">
          Loading astronaut profile…
        </p>
      )}
      {resource.error && (
        <div className="crew-error" role="alert">
          <p>{resource.error}</p>
          <p>Member summary remains available.</p>
          <button
            type="button"
            onClick={() => {
              title.current?.focus();
              resource.refresh();
            }}
          >
            Retry profile
          </button>
        </div>
      )}
      {person && <CrewProfile person={person} />}
    </div>
  );
}
