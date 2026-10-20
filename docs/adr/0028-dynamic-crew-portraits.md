# ADR-0028: Dynamic exact-person Crew portraits

Status: Accepted · 2026-10-20

## Context

The canonical LL2 profile pipeline already retains original/thumbnail URLs and
unchanged rights metadata in Current, person and Historical responses. The exact
NASA credit/license name/URL and `singleUse === false` frontend gate withheld six
of seven current portraits before any request. All fourteen LL2 URLs were verified
as decodable HTTPS images. Requiring bundled portraits would require deployments
for future Crew. The product decision approves direct remote exact-person display.

## Decision

Portraits are presentation enrichment below Canonical Identity, Resource
Acquisition, Operational Subject Binding and Membership/Lifecycle. Input is an
already-canonical API person with typed provider identities and attached media.
Names, photos and resource reviews never resolve humans, add equivalences,
activate membership or alter assignments or temporal selection.

Use parseable HTTPS URLs without credentials or malformed/whitespace references.
Browser image decoding establishes runtime usability, including extensionless
resources. Keep native lazy loading, no-referrer, alt text and existing cover
frames. Reject HTTP, data and executable schemes. Credit/license/singleUse, source
URLs, identity and observation provenance stay unchanged. Missing, unknown or
non-NASA metadata and `singleUse=true` do not gate display. This rendering policy
makes no blanket copyright or redistribution claim.

Try attached thumbnail → distinct original → explicitly reviewed official
resource for the same unambiguous typed LL2 PERSON key → initials. Normalize and
deduplicate URLs; attempt each once per mounted identity/media cycle. One bounded
React state owner drives image, credit and loading status. Canonical/provider/media
changes reset the cycle; old index/cycle callbacks cannot affect a new selection,
including A→B→C→A. There are no timers or automatic repeat retries.

The small frontend `reviewedPortraits` manifest selects photo resources only.
It retains provider key, authority, resource/page/asset, review date, source SHA-256,
credit and rights note from the reviewed analysis. API canonical UUIDs remain
authority; installation-specific UUID lists and display names are not selectors.
Conflicting provider selectors or duplicate reviews select no reviewed fallback.
Five individual NASA/CSA resources are retained. Pyotr's dedicated-crop source
and Sergey's group photo are excluded: unchanged center-cover presentation must
not choose arbitrary group crops. No Commons mapping is retained.

Current and Historical share this presentation path. Historical continues using
latest retained canonical profile metadata for its independently selected people,
not images captured at membership time. No runtime image/name search, fuzzy
matching, transliteration, face detection or facial recognition is introduced.

## Consequences

Future canonical people with usable attached provider media work without a
manifest entry, bundled asset or portrait-only deployment. Remote failures and
mutable publisher bytes remain possible; review hashes are audit proof, not
runtime byte-integrity enforcement. Exhaustion shows initials without changing
Crew. A new relevant cycle/remount permits a new attempt; there is no retry loop.

No backend, API, database, crawler, source worker or proxy change is required.
No image is downloaded into production storage. Optional reviewed resources need
reviewed configuration changes; primary dynamic provider coverage does not.

## Evidence

Observed facts: external `mission1-crew-portrait-analysis-2026-10-20` REPORT and
`portrait-identity-bindings.json`. Its local-primary proposal and untracked ADR
draft are superseded. QA: external `mission1-dynamic-crew-portraits-2026-10-20`.
[Maintained portrait contract](../crew/portraits.md).
