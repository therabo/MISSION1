# Numerical validation

Generated from raw original evidence by `scripts/summarize.py`. All primary rows have 10 s warmup + 30 s foreground measurement. 1% low is recalculated consistently from the slowest 1% mean; rolling low-cadence duration is evaluated after the first full second.

## Baseline, 1440×900 DPR 1

| State | N | median / P95 / P99 ms | median FPS | 1% low FPS | >20 / >33.3 / >50 ms | rolling <55 s |
| --- | ---: | --- | ---: | ---: | --- | ---: |
| overview-gp | 1023 | 29.20 / 31.40 / 33.10 | 34.25 | 28.36 | 1023 / 10 / 0 | 28.95 |
| overview-oem | 1037 | 29.10 / 30.60 / 31.90 | 34.36 | 30.15 | 1037 / 4 / 0 | 28.95 |
| inspection-oem | 1120 | 27.10 / 28.60 / 30.50 | 36.90 | 30.05 | 1119 / 2 / 1 | 28.97 |
| inspection-gp | 1108 | 27.20 / 28.70 / 29.80 | 36.76 | 32.77 | 1108 / 0 / 0 | 28.98 |
| crew-open | 1026 | 29.30 / 30.60 / 31.90 | 34.13 | 30.50 | 1026 / 2 / 0 | 28.96 |
| replay | 1397 | 21.60 / 24.60 / 26.40 | 46.30 | 36.87 | 1023 / 0 / 0 | 28.96 |

## Final matched scene, 1440×900 DPR 1

| State | N | median / P95 / P99 ms | median FPS | 1% low FPS | >20 / >33.3 / >50 ms | rolling <55 s |
| --- | ---: | --- | ---: | ---: | --- | ---: |
| overview-gp | 1148 | 26.20 / 27.40 / 28.40 | 38.17 | 32.90 | 1147 / 2 / 0 | 28.94 |
| overview-oem | 1163 | 26.10 / 27.30 / 28.20 | 38.31 | 34.20 | 1162 / 0 / 0 | 28.94 |
| inspection-oem | 1251 | 24.20 / 25.40 / 26.60 | 41.32 | 36.29 | 1249 / 0 / 0 | 28.99 |
| inspection-gp | 1240 | 24.40 / 25.50 / 26.30 | 40.98 | 36.56 | 1240 / 0 / 0 | 28.96 |
| crew-open | 1146 | 26.20 / 27.20 / 28.10 | 38.17 | 34.29 | 1146 / 0 / 0 | 28.97 |
| replay | 1634 | 18.40 / 19.30 / 20.40 | 54.35 | 47.08 | 29 / 0 / 0 | 24.75 |

## Native Retina, actual LIVE and smaller viewport reference

| State | N | median / P95 / P99 ms | median FPS | 1% low FPS | >20 / >33.3 / >50 ms | rolling <55 s |
| --- | ---: | --- | ---: | ---: | --- | ---: |
| baseline native DPR2 / overview-gp | 495 | 60.60 / 63.50 / 65.70 | 16.50 | 14.88 | 495 / 495 / 495 | 28.91 |
| final native DPR2 / overview-gp | 547 | 54.70 / 57.80 / 59.90 | 18.28 | 16.43 | 547 / 547 / 532 | 28.94 |
| final actual LIVE / overview-gp | 1212 | 24.70 / 26.00 / 27.20 | 40.49 | 35.82 | 1212 / 0 / 0 | 28.97 |
| final actual LIVE / overview-oem | 1325 | 22.80 / 24.70 / 26.40 | 43.86 | 30.89 | 1270 / 2 / 1 | 28.96 |
| final actual LIVE / inspection-oem | 1250 | 23.70 / 26.40 / 30.80 | 42.19 | 28.94 | 1249 / 6 / 0 | 28.94 |
| final actual LIVE / inspection-gp | 1241 | 24.60 / 26.00 / 26.80 | 40.65 | 35.31 | 1240 / 1 / 0 | 28.97 |
| final actual LIVE / crew-open | 1232 | 24.00 / 28.20 / 32.30 | 41.67 | 27.72 | 1229 / 10 / 1 | 28.97 |
| final actual LIVE / replay | 1589 | 18.70 / 21.70 / 26.20 | 53.48 | 35.04 | 217 / 0 / 0 | 11.13 |
| 1280×720 / overview-gp | 1752 | 16.70 / 20.20 / 22.00 | 59.88 | 37.39 | 98 / 1 / 1 | 2.05 |
| 1280×720 / inspection-gp | 1579 | 18.90 / 20.30 / 21.30 | 52.91 | 44.94 | 123 / 0 / 0 | 28.97 |
| 900×700 / overview-gp | 1799 | 16.70 / 17.40 / 17.90 | 59.88 | 54.18 | 1 / 0 / 0 | 0.00 |
| 390×844 emulation / overview-gp | 1799 | 16.70 / 17.10 / 17.60 | 59.88 | 55.87 | 0 / 0 / 0 | 0.00 |

The primary Overview target (median≥59 FPS, preferably P95≤18 ms and no rolling <55 FPS run exceeding 1 s) **FAILS**. Display cadence is approximately 60 Hz, so this is a real rendering-budget limit. GPU fill/MSAA and original model/PBR/draw work exceed 16.67 ms; no quality reduction is counted as a performance pass. Smaller viewport emulation is the same Mac/browser, not physical mobile hardware.

## Original baseline loading

| Load | Viewer / observed Earth ms | native ISS / Inspection ready ms | tile idle / stars ready / fully refined ms | requests | observed body / headers bytes | local / external body bytes | local Resource Timing transfer bytes |
| --- | --- | --- | --- | ---: | --- | --- | ---: |
| cold | 599.9 / 615.8 | 1538.9 / 2395.1 | 3549.5 / unobserved / unobserved | 178 | 55,416,997 / 22,460 | 53,935,076 / 1,481,921 | 53,970,062 |
| warm | 330.1 / 336.1 | 1120.7 / 2348.7 | 3796.3 / unobserved / unobserved | 178 | 34,326,808 / 12,022 | 32,844,960 / 1,481,848 | 32,868,791 |
| repeat | 334.2 / 339.5 | 1102.1 / 1815.2 | 3397.3 / unobserved / unobserved | 178 | 34,326,761 / 12,022 | 32,844,936 / 1,481,825 | 32,868,785 |

## Final loading

| Load | Viewer / observed Earth ms | native ISS / Inspection ready ms | tile idle / stars ready / fully refined ms | requests | observed body / headers bytes | local / external body bytes | local Resource Timing transfer bytes |
| --- | --- | --- | --- | ---: | --- | --- | ---: |
| cold | 464.2 / 485.0 | 1255.6 / 2067.1 | 4247.0 / 3041.7 / 4247.0 | 191 | 73,867,345 / 23,282 | 71,791,047 / 2,076,298 | 71,826,938 |
| warm | 349.2 / 355.2 | 1037.0 / 1807.8 | 4065.9 / 2632.6 / 4065.9 | 191 | 48,787,325 / 12,693 | 46,711,064 / 2,076,261 | 46,735,771 |
| repeat | 308.3 / 314.5 | 932.0 / 1623.7 | 4196.2 / 2455.4 / 4196.2 | 191 | 48,787,198 / 12,693 | 46,710,945 / 2,076,253 | 46,735,706 |

## Untouched baseline contemporaneous recheck

| Load | Viewer / observed Earth ms | native ISS / Inspection ready ms | tile idle / stars ready / fully refined ms | requests | observed body / headers bytes | local / external body bytes | local Resource Timing transfer bytes |
| --- | --- | --- | --- | ---: | --- | --- | ---: |
| cold | 491.7 / 505.2 | 1463.0 / 2270.3 | 3645.4 / 829.9 / 3645.4 | 178 | 55,736,262 / 22,470 | 53,955,579 / 1,780,683 | 53,990,625 |
| warm | 305.1 / 310.6 | 1094.9 / 1801.2 | 3035.4 / 451.0 / 3035.4 | 178 | 34,625,535 / 12,022 | 32,844,907 / 1,780,628 | 32,868,708 |
| repeat | 305.9 / 311.6 | 1025.3 / 1741.3 | 3079.5 / 450.8 / 3079.6 | 178 | 34,625,634 / 12,022 | 32,844,935 / 1,780,699 | 32,868,742 |

Request/body figures count instrumented requests started by the observed settlement boundary and their returned response-body/header sizes; they are not packet-level wire measurements. Warm HTTP revalidation can reuse cached bytes. Failed/aborted/in-flight requests without completed size records are not invented. Original baseline did not observe separate high-star decode/fully-refined timing; the untouched-build recheck does. All loading runs above are normal-network, isolated from compilation/tests. External NASA latency changes; the controlled one-tile outage and overlapping candidate loads are excluded.

## Instrumented GPU/CPU and memory

| Mode | scene CPU median / P95 ms | GPU median / P95 ms (N) | draw calls median / P95 | live textures / total created | texture / MSAA buffer MiB estimate | JS heap used / allocated MiB |
| --- | --- | --- | --- | --- | --- | --- |
| overview | 6.10 / 7.50 | 29.09 / 34.00 (208) | 717 / 717 | 232 / 278 | 726.75 / 123.60 | 241.74 / 286.42 |
| inspection | 7.00 / 7.80 | 25.92 / 26.96 (201) | 733 / 736 | 339 / 501 | 764.42 / 123.60 | 256.44 / 300.31 |
| returned | 7.20 / 8.30 | 29.60 / 31.31 (200) | 717 / 717 | 300 / 589 | 749.42 / 123.60 | 246.82 / 306.89 |

GPU timers are asynchronous instrumented scene-work measurements; overhead and different real epochs make them distinct from uninstrumented FPS intervals. Texture totals include observable texture allocations and generated mip estimates; unknown formats, texStorage/private driver allocations and physical residency are not guessed. Renderbuffer estimate is separate, not double-counted as a texture. GPU audit records texture/cube limits, anisotropy, scene MSAA, tile cache and zero context loss in raw JSON. The stable source model/cube and deletion after return are verified; short-run observations do not certify unlimited memory safety.
