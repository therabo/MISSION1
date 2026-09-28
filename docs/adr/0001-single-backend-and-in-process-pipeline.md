# ADR-0001: Single backend and in-process pipeline for V1

Status: Accepted  
Date: 2026-09-28

## Context

MISSION1 is an initially empty repository built by one developer. The first credible capability receives a small verified public ISS data set, normalizes it, stores it, and exposes it through an API. The specification sketches separate ingestor, normalizer, orbital, alarm and gateway services with Kafka. There is no present independent scaling, release cadence, consumer, or durable broker replay need that warrants those processes.

## Decision

Implement V1 as one Java/Spring Boot backend deployable with logical source, telemetry, persistence-adapter and API boundaries. Call between modules in-process through narrow contracts. Use a bounded ingestion handoff where the verified source transport requires callback isolation. Do not deploy Kafka, a gateway, or separate telemetry services in V1. PostgreSQL remains a separate database process. The future orbital capability is an in-process module if its verified inputs justify implementation.

## Alternatives considered

- The specification's separate services and Kafka pipeline would isolate processes and enable independent consumers, but would add network contracts, broker operations, cross-service debugging, and more failure modes before a real source-to-API slice exists.
- One backend with no module boundaries would reduce initial file count, but would make provider details and data semantics easy to spread into controllers and persistence.

## Consequences

- Positive: one backend build/deploy, straightforward local diagnosis, direct transactional persistence, and clear room for future extraction at actual ownership boundaries.
- Negative: the backend is one failure/scaling unit; in-process buffering is not durable across restart and does not promise lossless capture. Any later extraction requires an explicit contract and operational work.
- Review trigger: measured throughput or isolation problems, or an actual independently deployed consumer with a justified durable event requirement. Reassess Kafka and service separation through a new ADR then.

## 2026-09-28 application note

[ADR-0004](0004-local-gp-propagation-for-current-orbit.md) verified GP/TLE input and activates the previously conditional orbital capability **inside this same backend** in MVP1. The original deployment and in-process decision is unchanged; “future” above records its status when this ADR was accepted.
