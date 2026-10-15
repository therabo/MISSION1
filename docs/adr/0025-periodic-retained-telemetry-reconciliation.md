# ADR-0025: Periodic retained telemetry reconciliation

Status: Accepted
Date: 2026-10-15
Supersedes the bootstrap-only acquisition policy in [ADR-0024](0024-component-telemetry-record-history.md); its catalog, admission, history and UI decisions remain active.

## Context

Native push and visible Current refresh already work autonomously. Completed
bootstrap permanently skips SenseData and ISS.live, so newer retained records
cannot be discovered by an already running application during native silence.
A restart must not reset public-provider pacing, and retained I/O must not occupy
the native callback or persistence worker.

## Decision

Keep one telemetry capability and one normalization/admission/JDBC model. Own two
cancellable provider deadlines after readiness, using a bounded two-thread timer.
Each provider independently follows durable eligibility: default PT30M after a
successful completed pass, including empty, duplicate-only and rejected-only passes.
Failures double the interval progressively, capped at PT6H; success resets backoff.
Runtime initializes coordination from existing bootstrap history. Fresh bootstrap
uses the same provider claim and advances the same deadline as reconciliation.

Use a dedicated PostgreSQL session advisory lock per provider across the bounded
fetch/parse/write pass, with committed attempt/deadline state before I/O. A crash
releases ownership while retaining pessimistic failure pacing. A slow owner cannot
lose its claim merely because a lease deadline expires. Two held pool connections
are the explicit cost; no transaction or telemetry writer lock spans external I/O.
Native callbacks keep their bounded queue/worker; retained writes use the same
normalizer and bounded JDBC transactions with the existing writer advisory lock.

V3 is structure only: provider coordination and immutable future-time rejection
identity evidence. V1/V2 remain byte-identical. A previously future-rejected
SenseData identity cannot become dated merely when the clock catches up; original
representation/time is preserved without changing the upstream inferred year.
Acquisitions distinguish RETAINED_RECONCILIATION from historical bootstrap/native
methods. GET remains local and read-only. No mapping, frontend cadence, Historical,
Crew, Orbit, power or rendering changes.

## Alternatives considered

A bootstrap flag cannot express periodic eligibility. Fixed delay from process
startup resets pacing and delays overdue work. Expiring leases can admit duplicate
slow fetches. Holding a database transaction over network I/O delays vacuum and
hides durable attempts. A broker/service or priority writer is unjustified at this
bounded volume. Jitter is omitted for the current single-instance deployment;
provider ownership already prevents simultaneous duplicate acquisitions.

## Consequences and validation

At PT30M, approximately 48 bounded SenseData connections and 48 ISS.live passes per
day per continuously running instance; the current 21 keys fit one request/pass.
This is project policy, not a provider rate promise or SLA. Database connection loss
aborts the pass; native overload remains counted, not lossless capture.
Deterministic scheduler/clock plus PostgreSQL tests cover discovery, idempotency,
chronology, quarantine, restart, ownership, backoff and concurrent native writes.
Actual default-cadence scheduled public acquisitions and existing Current UI are
validated separately, preserving canonical history.
