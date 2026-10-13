import type { CrewAssessment } from './types';
import { assertionLabel, safeHttps, utc } from './presentation';

/** Shared, unchanged source reports for Current and retained Historical/detail presentation. */
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
  return <details className="crew-sources crew-data-source">
    <summary>Data source</summary>
    {([
      ['Structured roster · Launch Library 2', crew.freshness.structuredSource, crew.provenance.structuredSource],
      ['NASA verification', crew.freshness.verification, crew.provenance.verification],
    ] as const).map(([label, health, observation]) => {
      const reference = safeHttps(observation?.sourceUrl ?? null);
      return <section className="crew-source-group" key={label} aria-label={label}>
        <h3>{label}</h3>
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
  </details>;
}
