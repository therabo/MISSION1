# CelesTrak ISS GP refresh and source health

Status: MISSION1 operational policy, updated 2026-10-13 under ADR-0022. Scope: CelesTrak GP TLE for ISS/NORAD 25544 only.

## Verified provider constraint

[CelesTrak's usage policy](https://celestrak.org/usage-policy.php), rechecked 2026-10-13, says GP data updates once every two hours, asks users to download only needed data once per update, and instructs automated clients to stop querying and report any non-200 response for investigation. Repeated excessive/error queries can be blocked. The selected single-object query is documented by [CelesTrak's GP format guide](https://celestrak.org/NORAD/documentation/gp-data-formats.php): `CATNR=25544&FORMAT=TLE`. These are **resource-use constraints**, not ISS element-epoch freshness or position-accuracy guarantees.

## MISSION1 retrieval policy

The default minimum interval remains **2 hours 10 minutes**, with the same two-hour
configuration minimum. After `ApplicationReadyEvent`, one scheduled eligibility
check runs promptly. An empty installation with no successful observation or
request reservation can acquire immediately through the normal production adapter,
validation and `storeIfNew` path. Existing durable observations suppress unnecessary
restart fetches. A recently acquired stale-epoch TLE does not override provider
pacing; orbital quality remains a separate evaluation.

Eligibility is the later of the durable successful retrieval plus interval and the
persisted request deadline (and any process-local last-attempt cooldown). V13 adds
one `celestrak_request_state` singleton, containing a request deadline and suspension
flag, with no orbital data. Before HTTP, an atomic conditional UPDATE reserves the
full interval. This also protects against concurrent owners, transport failures,
local storage failures after HTTP, and a process crash after reservation. Failure
before a reservation makes no provider request. No source-response cache or fixture
is used to initialize an installation.

The scheduler owns one cancellable timer. Every non-suspended result arms it for
`nextEligibleAt`; a check at T minus 377ms re-arms T instead of discarding the
eligibility point. Timer callbacks carry generation ownership, so stale/repeated
callbacks are inert. Fractional timer rounding uses a bounded 1ms ceiling after an
early check; the service rechecks eligibility before any request. PostgreSQL
reservation deadlines round upward to microseconds, while reservation checks round
down. No busy polling or early provider retry occurs. Local DB failures before HTTP
retry the local check after one minute. A successful refresh schedules from the
actual persisted receipt time plus interval; network/timeout/invalid-200 failures
schedule from the request attempt plus interval.

HTTP 403 remains `RATE_LIMITED_OR_BLOCKED`; **every non-200 response suspends automatic
requests**, now durably across restarts. No timer is armed while suspended. Operator
review must resolve the cause before explicitly clearing only the persisted
`suspended` flag, retaining `next_eligible_at`, then restarting the worker. Restart
alone no longer clears a provider block. The separate REST source-health status,
failure count/category and diagnostic last-attempt remain process-local; last
successful retrieval still comes from immutable observations. A local persistence
failure does not blame the provider or erase the last valid elements. If the DB
fails while recording suspension, the current process remains suspended and logs
the persistence failure; the already reserved cooldown remains conservative.

Configuration retains `MISSION1_CELESTRAK_REFRESH_ENABLED` and
`MISSION1_CELESTRAK_REFRESH_INTERVAL`. The obsolete initial-delay property is removed;
old initial-delay environment values no longer control bootstrap. Tests disable
production scheduling and use deterministic virtual clocks/loopback sources.
Deployment remains one backend; durable GP reservation is not a general multi-node
architecture. The last-success query filters `CELESTRAK_GP`/25544; TLE element epoch
never determines HTTP eligibility. GETs do not acquire source data. Repeated valid
TLEs retain ordinary provenance and add retrieval observations without duplicating
an element set. See [ADR-0022](../adr/0022-durable-gp-eligibility-and-source-directed-resource-discovery.md)
and [final clean-room proof](../bootstrap/clean-room-validation/final-fixes.md).

Four independent concepts must remain distinct: provider refresh policy ≠ age since MISSION1 retrieval ≠ TLE element-epoch age ≠ `orbital-current-v1` state quality. The 24-hour element-epoch boundary is a separate MISSION1 display policy. A valid cached state can be `GOOD` while acquisition health is `DEGRADED`, and a successful fetch of an old valid TLE can be `HEALTHY` while computed state is `STALE`.
