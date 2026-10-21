# Recorded test-source provenance

These resources are test inputs, never runtime seeds or replacements for public data.

## Crew operational corpus

Frozen source-derived fixtures captured on 2026-10-11 retain 25 exact source subjects,
version/evidence/document hashes, official resource captures or minimal factual
derivatives, 275 enriched candidate vectors and 256 distinct-human controls.
The 25 gate faults and 16 resource faults are explicitly constructed test cases;
evaluation labels are not operational evidence.

NASA WordPress captures are byte-preserved. LL2 derivatives contain factual
person/flight fields; agency derivatives contain bounded birth/mission clauses and
directory rows. Each derivative records its original source SHA256 and its separate
fixture SHA256. Third-party images, navigation and unrelated page content are excluded.
Source URLs and capture timestamps are embedded in the corpus.

## Historical orbital excerpts

The replay resources were read from retained MISSION1 PostgreSQL observations on
2026-10-03, without provider calls. TLE lines retain verified source hash identities
(September 28, September 29 and October 1 GP epochs). The OEM test XML contains the
first 18 unchanged vectors of NASA/JSC product
`14f2dce1e0263fba4fee8e042a89173ec632768f8cd54190e7c0d99040ef2433`.
Its excerpt hash differs from the full document; the original metadata coverage
must not be interpreted as coverage supplied by the shorter excerpt.
