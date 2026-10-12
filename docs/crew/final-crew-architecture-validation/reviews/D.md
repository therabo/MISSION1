# D — FINAL independent identity-safety review

**PASS — no unresolved blockers in D's identity-safety scope.**

Canonical `/Users/daniel/Desktop/MISSION1` reviewed read-only after the final
producer/consumer V7-route guard and Java formatting changes. No additional tests
were launched during the browser E2E; no canonical files or production DB rows
were modified by this review.

## Evidence

- D independently ran131 focused tests:56 new production-consumer controls,
  34 resolver tests and41 fault tests.0 failures/errors/skips.
  `d-final-safety-tests.log` records that run.
- The primary integrated the test file and reran canonical `mvn test` and
  `mvn verify`:**1163 tests each,0 failures/errors/skips,BUILD SUCCESS**.
  This review independently inspected both final logs, including the passing
  56 consumer controls and resolver/fault classes.
- Research operational parity:275 vectors, maximum probability delta
  `8.673617379884035E-19` in both canonical full runs.
- Unchanged frozen model parity:14382 vectors, maximum probability delta
  `3.3306690738754696E-16` in both canonical full runs. No diff to
  `FrozenIdentityModel.java` or `OperationalNames.java` was present.

## Negative and positive safety controls

**0 consumable matches among256 wrong-human controls**, including deliberate
mis-tagged MATCH evaluations with stored rejection reasons cleared.25 constructed
gate cases preserve23 rejects and2 intended positive controls.16 resource-link
faults retain their expected qualification outcomes; a link alone cannot yield
an existing canonical target.25 genuine retained source subjects remain accepted.
These finite benchmarks are regression evidence, not a claimed accuracy guarantee.

Menon/Anna separation, source-scoped Josh/Joshua and generic Andrey/Andrei paths
remain covered by the retained fixtures and independent witness audit. No generic
surname/family/agency/cohort evidence becomes identity authority, and no global
Josh alias or hardcoded Andrey/Andrei mapping is introduced.

Observation/arrival threshold remains0.991; completed departure threshold remains
0.999; minimum runner margin remains0.20. Adjacent-representable score boundaries,
nonfinite scores, strict computed margin, complete candidate set, source-time
person-flight interval, required stable-provider plus official/agency/roster proof,
proof contradictions, source-scoped short-form authority and stronger completed
departure named-roster authority all remain fail-closed.

## Final authority and route review

The latest exact evidence/subject head is selected before release/outcome
compatibility checks. Newer DEFER, CONFLICT, SUPERSEDED or incompatible release
cannot revive an earlier MATCH or fall back to weaker resolution.

Independent explicit V7 fallback is available only when no S10 head exists and
when source identity/current reviewed knowledge and exact source-person name
agree. Accepted S10 versus a strong independent V7 mismatch becomes conflict.
Exact-name, unresolved or unreviewed raw personal-resource links do not authorize
fallback. Missing or unpublished existing V7 targets fail closed.

The final producer and consumer now implement the same route guard: a reviewed
LL2 binding may not disagree with the canonicalized retained provider anchor.
If it does, both omit that provider route rather than assigning another human.
When the binding is absent or agrees, both use the canonical existing anchor.
This resolves the consistency concern recorded in `d-production-review.md`.

The consumer reads sealed retained facts and performs no acquisition, scoring,
materialization, canonical write, alias creation, equivalence/merge or target
creation. Its JDBC calls remain set based. Normalized candidate/proof columns
must equal their immutable payloads, in addition to the exact source, version,
document/evidence hashes, release/model/parser, winner/runner and proof checks.
TTL and resource capture are evaluated at knowledge time; operational proof
intervals are checked against effective event time.

The production policy is separately versioned `s10-scoped-production-v1` and pins
the immutable consumption rules, model SHA, ICU78.3, resource parser and proof
validity. Shadow release serialization is preserved. Production factual input
hashes omit diagnostic V10 projection/resolution revision IDs, so an otherwise
unchanged S10 factual cut cannot self-trigger another revision through the V10
notification loop.

## Final result

All seven initially reported consumer omissions have passing regression controls.
No remaining D blocker was found in the latest canonical route guard, policy,
consumer or negative-test evidence. Database fingerprints, real activation,
Historical/Replay timeline and frontend E2E remain verified by the primary and
their dedicated reviewers; this report does not substitute for those reviews.
