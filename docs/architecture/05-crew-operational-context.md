# Crew operational-context architecture

Status: implemented source/domain foundation, 2026-10-03. [ADR-0007](../adr/0007-independent-crew-observations-and-field-authority.md) records the durable domain and source-authority choice.

```text
LL2 2.3.0                        Distinct NASA official documents
    |                                         |
LL2 read-only adapter                  NASA document capture
    |                              future semantic evidence extraction
    +-------------------+---------------------+
                        |
                 Crew domain / evidence contracts
                        |
              FUTURE field-aware reconciliation
                        |
                FUTURE PostgreSQL history
                        |
                  FUTURE REST / UI
```

## Responsibility and data ownership

Crew is a logical module in the existing single Spring backend, owning people/profile observations, station/expedition references, assignments and operational evidence. Orbit continues owning elements, propagation, OEM and trajectory delivery. Neither module imports the other. Spring composition shares the existing UTC Clock bean, with no new deployment or infrastructure. Crew does not write to current orbital tables.

Inputs are explicitly requested LL2 detailed JSON or explicitly selected official NASA HTML. Outputs are source-neutral immutable objects and structured operation failures; no consumer is wired to automatic ingestion. `crew/application` contains narrow ports, `crew/domain` owns semantics, and `source/crew` contains HTTP, LL2 DTOs/mapping and NASA capture. The existing Java HttpClient and Jackson dependencies suffice.

## Calls, failures and operation

LL2 snapshot: one GET to dynamically filtered ISS active expeditions, no follow-up per astronaut or pagination. All returned candidates are preserved; multiple candidates produce `AMBIGUOUS`. If a bounded page is incomplete, total count/completeness stay visible and the adapter does not select a winner or fetch arbitrary next links. Profile enrichment is a separate explicit call. Zero active expeditions is `NO_ACTIVE_EXPEDITION`, not network failure.

Shared transport has configured timeout, never follows redirects in production and makes no retry. Response body parsing is accepted only below 2 MiB; malformed required IDs/station/response mode/active interval/crew/page/counts/durations fail visibly. Additional harmless JSON fields are ignored, while scalar coercion and trailing JSON are rejected. HTTP 404/429/other non-2xx, timeout, interruption and network errors have distinct result metadata. Rate-limit Retry-After is retained without automatically sleeping or retrying. The size check is after receipt, not a streaming network-byte quota.

NASA capture restricts explicit requests to `https://www.nasa.gov` and returns bytes/hash/HTTP metadata with caller-declared document category. It does not claim semantic validity or infer publication/event time. The unimplemented verification port defines the later extraction boundary. Document bodies are transient; no raw-body database store is introduced.

## Trade-offs and validation

A small standalone Crew module introduces more records/fixtures, but protects the existing orbital pipeline and avoids later API identity/source conflation. Building a NASA prose scraper now would require unsupported layout/semantics assumptions. Future database, polling, public API and UI are deferred by milestone scope. No continuous CPU/network work exists; only inert bean/client registration occurs at startup.

Validation uses real captured fixtures plus explicitly synthetic missing-field/multiple-candidate variations, loopback/mock transport, timestamp/media/duration tests, independent NASA evidence alongside LL2 membership, a startup request counter and an architecture fitness test. Existing PostgreSQL Testcontainers tests, orbital API and graphics smoke remain regression gates. No new controller, entity, migration or scheduler exists.
