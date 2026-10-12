# Mission Replay

**Final Crew production migration — 2026-10-12:** Current and Historical now share V7/S10/V10 lifecycle semantics; Replay evaluates effective UTC T using evidence known today. `UNIFIED_V10_S10` is normal; `LEGACY` is explicit rollback/comparison. Source capture and identity knowledge stay distinct, with no source calls, identity scoring, writes or V10 materialization from GET. [Final Crew validation](../crew/final-crew-architecture-validation/README.md). The next Crew milestone is clean-room empty-database bootstrap validation, separately from any orbital timeline or RTN work.


Replay(T) is the best current reconstruction of operational state **effective at T**, using evidence presently stored in PostgreSQL. It includes late acquisition and late publication when an explicit event timestamp establishes an earlier effective time. It does not answer what MISSION1 knew at T; knowledge-time replay is a separate future capability. Source publication, capture, content identity and method lineage remain visible.

```text
Replay T
  ├── Crew Replay Query → immutable structured observations, NASA assertions, identity resolutions
  └── Orbit Historical Query → retained GP/TLE sets and NASA/JSC OEM source vectors
```

The single backend composes both at exactly the same Instant inside a read-only REPEATABLE READ transaction. Each subsystem can independently be unavailable; no current endpoint substitutes for missing historical data. There are no source clients, ingestion calls, reconciliation commands, event discovery or persistence commands in this query path. No per-second history is materialized.

The empirical gate is [FULL within the retained Crew support interval](orbit-historical-feasibility.md), with finite collection and source applicability bounds. Coverage is not completeness or measured accuracy. Crew is partial because retained NASA assertions are partial and some subjects remain unresolved. Orbital quality is UNKNOWN accuracy. GP computation and source-provided OEM prediction remain distinct.

- [Crew rules](crew-replay.md)
- [REST contract](../api/replay-api.md)
- [Architecture](../architecture/06-mission-replay.md)
- [ADR-0011](../adr/0011-effective-time-mission-replay.md)
- [Executable validation and browser evidence](validation/README.md)

LIVE preserves current endpoints and their acquisition policies. REPLAY pauses live UI polling, uses a UTC input and one debounced, cancellable backend read per selected epoch, pauses Cesium time at that epoch, and hides current paths. Historical trajectories and event timeline visualization are not implemented. Mode changes do not issue camera commands; current clock/delivery resumes on exit. The same Viewer, shader, model, source assets and camera transition machinery remain in place.

Next milestone: **ISS REPLAY EVENT TIMELINE**. RTN analysis remains independently pending.
