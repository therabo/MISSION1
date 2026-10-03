# Crew API — DRAFT, NOT IMPLEMENTED

No public Crew endpoints exist. These paths describe future product use cases, not executable APIs:

- `GET /api/iss/crew`: reconciled, as-of station presence and count, current expedition reference, profiles/assignments where available, independent quality/provenance and reconciliation.
- `GET /api/iss/expedition/current`: canonical current expedition, or explicit no-data/ambiguity.
- `GET /api/iss/crew/{mission1AstronautId}`: a MISSION1-owned person identity and optional profile detail, independent of LL2 IDs.

Use persisted MISSION1 UUIDs, never require clients to know an LL2 integer. Current count is reconciled physical presence, not the structured assignment array's length. Allow a person present without an LL2 assignment and an assigned person with uncertain presence. Expose `structuredSource=LAUNCH_LIBRARY_2` and `presenceAuthority=NASA_OFFICIAL` only with the supporting observations, `fetchedAt`, `verificationFetchedAt`, as-of instant, age/quality policy and `reconciliation` state. A NASA authority label is not a verification boolean.

Absent optional fields remain null/empty under documented semantics; durations are machine-readable at the REST boundary, not backend formatted strings. Publication/event/retrieval times use explicit UTC roles. Profile and presence may have different observation times. Multiple active expedition candidates cannot silently become the first entry. Partial source availability must expose which portion exists; it must not return an invented zero-person count. Before delivery, finalize no-data versus unknown-resource and partial/conflict behavior using the existing ProblemDetail/stable-code conventions and contract tests.

No realtime subscriptions, replay endpoints or controllers are introduced here. Review media license/credit/restrictions before display; no automatic remote mirroring.

Persistence now provides source snapshots and UUID anchors. A future API must distinguish `sourceSnapshotObservedAt` (first retrieval of immutable state) from `latestSuccessfulFetchAt` (retrieval on the latest successful run referencing that state). Last attempt/failure/Retry-After are separate source operations. These names remain draft; no Crew controller is implemented.
