# Crew portrait presentation

[ADR-0028](../adr/0028-dynamic-crew-portraits.md) governs the dynamic portrait
policy accepted on 2026-10-20. It supersedes earlier NASA-only display gates and
the external analysis's proposed local-primary delivery architecture.

The existing backend selects canonical people and latest retained LL2 profiles
before presentation. Current members, person details and Historical members
already contain `image` (original, thumbnail, credit, license name/URL and nullable
singleUse) plus typed external IDs. No API or persistence change is needed.
Portrait resolution never creates, merges, aliases, activates or removes people.

`portraitCandidates` receives that canonical person. Attached secure HTTPS media
is primary: thumbnail → distinct original. URLs must parse, use HTTPS and contain
no credentials/whitespace. Browser decoding checks actual image usability;
extensions are not a MIME guarantee. Unsafe/malformed URLs are skipped; load/decode
errors advance to the next distinct URL. Native lazy loading and no-referrer remain.

Roster portraits retain compact 40px cover frames and thumbnail-first preference.
The Current personal/detail variant fills the padded card content width with one
shared 877:1000 viewport (288×328.39px at the accepted desktop width), matching the
previous Luke Delaney presentation. The viewport reserves its full size before
loading; images and initials are positioned inside it without affecting its layout.
Images use centered `object-fit: cover` to fill the frame with crop, without distortion.
Detail images are revealed after native decoding completes, without a transition.
The Current personal card mounts only after the selected UUID's full profile
response has been decoded and accepted. `CurrentCrewProfileRequest`, keyed by that
UUID, uses the existing lazy resource and reports readiness before paint. Until
then, a small status (or safe error with retry/cancel) stays in the visible roster;
the responsive detail layout is activated in the same render as the full card.
Biography, Career, evidence and credit therefore contribute their final geometry
from the first visible detail frame. An accepted `UNAVAILABLE` profile still
renders its existing unavailable content; a failed request never renders a summary
card. Switching selection aborts the old resource and removes its card immediately;
late responses cannot reveal another UUID. Closing a ready card retains only its
complete inert snapshot for the existing exit animation. Each newly ready card
uses the existing entrance motion, without an added delay or masking animation.

The vertical scroll owner retains `overflow-y: scroll`, reserving classic scrollbar
space from first layout. The whole dock owns scrolling on short screens; otherwise
the profile body owns it. The existing native border-token thumb and transparent
track remain unchanged. Their palette alone does not prevent summary-to-full scroll
state changes; waiting for the accepted profile removes that intermediate state.
Overlay widths and settled portrait dimensions remain unchanged. Profiles stay
lazy: local latency measurements did not justify seven speculative requests or a
session cache. Historical loading and semantics are unaffected.
The same exact provider original is preferred, then thumbnail,
then existing reviewed fallback and initials. This is presentation ordering of the
same eligible candidates, not a source, identity or rendering-policy change.
Historical detail does not gain a portrait block.

Incomplete credit/license, non-NASA credit/policy links and `singleUse=true`
do not suppress exact-person remote images. Original metadata remains intact;
display does not assert NASA ownership, public domain or unrestricted permission.
The Current personal card shows useful credit belonging to the active candidate, once beneath its portrait. Mission/roster metadata contains no photo credit; blank or Unknown credit is omitted.

`reviewedPortraits.ts` optionally appends five individually reviewed NASA/CSA
resources after provider candidates. The selector is the canonical person's
unambiguous `LAUNCH_LIBRARY_2` PERSON key, never a name or an old database UUID.
Multiple distinct LL2 keys or conflicting review entries select no reviewed
fallback. These photo bindings are not canonical equivalences or S10 authority.
Each entry retains source page/resource/asset, credit/rights, review date and source
SHA-256. Hashes record review evidence; remote bytes are not pinned at runtime.
Pyotr's special crop and Sergey's group photo are not retained as direct remote
portraits. Their normal person-attached LL2 media still takes precedence.
No Commons mapping, arbitrary runtime image search or face processing is used.

`useCrewPortrait` owns one bounded cycle for image, credit and caption. It tries
each distinct URL once, finishes with initials (`?` without a name), and resets
on canonical/provider/media changes or remount. Stale callbacks cannot advance
another index/cycle. Names are presentation labels; spelling changes do not change
selection. There is no timer, preloading service or loop.

Historical retains **LATEST_AVAILABLE_CANONICAL_METADATA** for independently
selected canonical people, while membership/assignment remain effective at T.
Portraits do not imply past photo capture or alter Current/Historical membership.
No new table, endpoint, proxy, crawler or bundled portrait asset is required.
Future accepted provider people with usable attached media need no manifest entry
or portrait-only deployment. If every candidate fails, Crew stays visible.

Focused tests cover a new unregistered future person, metadata preservation,
URL safety, typed key conflicts, Watkins/Meir separation, alternate spellings,
bounded progression and stale A→B→C→A events. Real network, responsive and
Historical evidence is kept outside Git in the implementation QA directory.
