"""Build the readable audit from preserved measured data, without hand-edited numbers."""
from pathlib import Path
import gzip, json, math, sys
root=Path(sys.argv[1])
def read(name):
    p=root/name
    return json.loads(p.read_text()) if p.exists() else json.loads(gzip.decompress((root/(name+'.gz')).read_bytes()))
def num(x,n=2): return '—' if x is None else f'{x:.{n}f}'
def table(head,rows): return '\n'.join(['| '+' | '.join(head)+' |','| '+' | '.join(['---']*len(head))+' |',*['| '+' | '.join(map(str,r))+' |' for r in rows]])+'\n'
a=read('focus-analysis.json');v=read('focus-validation.json');parts=[]
parts.append('''# Earth ↔ ISS focus acceptance — 2026-10-01

Accepted scope: explicit focus transfer, arbitrary actual camera starts, first-use graphics readiness, and frame pacing with full rendering quality. Starting clean synchronized revision: `b5aa2a82128547f9958f28bcd4bc83341230184c`. The new normal commit and verified SSH publication identity are in Git history and the task's final report. RTN analysis and Replay have not begun.

## Context actually reviewed

Read `/Users/daniel/Documents/ChatGPT/MISSION1/AGENTS.md` and `/Users/daniel/Desktop/mission1-project.md` before source changes. The latter remains outside this repository. Inspected the actual private skill directory and read `iss-3d-earth-view`, `iss-3d-station-view`, `devops-local-platform`, `flight-dynamics-orekit` (the installed flight-dynamics skill), `iss-ground-segment-architecture`, `telemetry-quality-and-provenance`, `architecture-decisions`, and `/Users/daniel/.codex/skills/frontend-design-codex/SKILL.md`, including applicable references. No dedicated rendering/performance skill exists here. The frontend skill's `.shared` visual runtime is absent; [equivalent local lint](scripts/visual-lint.cjs) checks names, alt text, clipping, overflow, tiny text and approximate contrast.

Read [frontend README](../../../../frontend/README.md), [backend README](../../../../backend/README.md), [ISS model](../../iss-model.md), [Inspection mode](../../iss-inspection-mode.md), [rendering quality](../../rendering-quality.md), [orbital trajectory rendering](../../orbital-trajectory-rendering.md), [orientation review](../../inspection-orientation-review/README.md), [rendering optimization review](../../inspection-rendering-optimization-review/README.md), [camera transition review](../README.md), [accepted perceptual results](../perceptual/results.md), [trajectory presentation review](../../trajectory-presentation-review/README.md), [architecture 03](../../../architecture/03-repository-and-roadmap.md), [architecture 04](../../../architecture/04-earth-view-orbital-delivery.md), [ADR-0005](../../../adr/0005-separate-nasa-oem-comparison-trajectory.md), [ADR-0006](../../../adr/0006-selectable-forward-trajectory-visualization.md), and [ADR index](../../../adr/README.md). Traced selected physical samples/frame, display lift, cubic path, metric/inverse, actual camera application, saved frustum/controllers, model/material readiness, globe/imagery/atmosphere, scene and React lifecycle before implementing.

## Reproduced defects and rejected candidates

The baseline names the displayed ISS as its nominal aim for the entire flight, then overlays an interpolated residual orientation. It has no explicit Earth-to-ISS world focal trajectory. A smooth position spline therefore does not imply a smooth, intelligible subject transfer. The first far steering and corresponding return remain concentrated; baseline focal coordinates/velocity are intentionally **unavailable**, rather than invented from that nominal aim.

Native `Camera.setView` introduces a second, independent defect: Direction/Up becomes local ENU heading/pitch/roll. Within `EPSILON3` of vertical, heading uses Up and roll becomes zero. Browser probes reproduced ~1.43° requested/applied direction error and ~501 km focal recapture error on a 10% Back. This happened with already orthonormal input. Direct public position/direction/up/right application under identity transform removes the conversion. The native frame is adopted only at the exact Inspection endpoint. [Camera public API](https://cesium.com/learn/cesiumjs/ref-doc/Camera.html), pinned `@cesium/engine/Source/Scene/Camera.js`: `setView3D`, `directionUpToHeadingPitchRoll`, `getHeading`, `getRoll`. [Rejected native-application reversal](rejected-setview-reversal.txt).

A plain unconstrained spherical focus rail lost the station in rotated/limb/pitch views and was rejected. [Trial geometry](trial-development-arbitrary.json.gz) remains evidence. The accepted rail adds smooth angular containment with endpoint envelopes; it never hard-switches its target.

An initially incomplete prewarm was also rejected after an actual 72.5 ms shader-status wait at **11% rotated entry**. A dense follow-up measured 171.6 ms and captured the linked native Moon ellipsoid shader (`ONLY_SUN_LIGHTING`, `WRITE_DEPTH`, `LOG_DEPTH`); this was first visibility of the Moon. [Original wait](rejected-incomplete-warmup.json), [dense shader diagnosis](rejected-lazy-moon.json), [after sky warmup](after-sky-warm-arbitrary.json.gz). This was a shader/resource hitch, separate from focus mathematics. The accepted startup task submits the retained Moon/Sun draws and then repaints the exact captured Earth view in the same task.

Exact baseline rendered frames follow. Indices are local to each recorded direction; progress is elapsed transition fraction. “Basis” is requested/applied direction error, independently measured from angular motion. These are diagnostics of the reproduced problem, not evidence of a hidden discrete target assignment.
''')
rows=[]
for label,run in a['runs'].items():
 if not label.startswith('baseline-'):continue
 for r in run['routes']:
  bad=r['changedAppliedBasisFrames'];worst=max(bad,key=lambda x:x['requestedDirectionErrorDegrees']) if bad else None;p=r['peakDirection'];j=r['peakRateJump']
  rows.append([label,r['cycle'],r['kind'],f"{p['frameIndex']} / {100*p['progress']:.2f}%",num(p['rate']),f"{j['frameIndex']} / {100*j['progress']:.2f}%",num(r['maxAngularVelocityJumpDegreesPerSecond']),f"{worst['frameIndex']} / {100*worst['progress']:.2f}%" if worst else 'none',num(r['maximumRequestedDirectionErrorDegrees'],5)])
parts.append(table(['Run','Cycle','Direction','Peak frame / progress','Peak °/s','Rate-change frame / progress','Max Δ °/s','Worst basis frame / progress','Basis °'],rows))
parts.append('''## Explicit focus architecture

The [implementation explanation](README.md) defines every equation. Earth focus is `C + D × max(1, −C·D)` captured from the actual Earth camera: the nearest forward principal-ray point to Earth centre. This preserves a valid arbitrary pitch/composition. Inspection focus ends at the actual displayed selected-source station. Intermediate focus is `C(t) + r(t)D(t)`, a positive spherical rail about the current camera; geometric focal-radius blending prevents crossing the camera or moving behind it. Quaternion coordinates specify that rail's angular direction and continuous Up; camera direction equals normalized focus minus camera. This is an equivalent geometric focus formulation, not an independent competing look-at.

The rail budget is `clamp(0.25 + 0.3 × captured basis angle / π, 0.3, 0.5)`, spent at the beginning of entry and end of exit in the existing hybrid metric, with its C2 integrated clock. `focusBlend` describes progress on this rail, not a literal Cartesian percentage of Earth/ISS positions. Smooth angular containment uses a quarter of the smaller captured FOV, an eighth-power soft cap, and C2 envelopes over the first/last 5% of metric progress. The fixed quaternion branch prevents a moving-frame 180° rail reversal.

The cubic/Earth-clear path, 8192 length segments, 1024-interval C1 inverse, 20/60/20 hybrid and close-range presentation remain unchanged. Duration uses captured Earth-to-station range and angular change: base 6/5 s + `0.35 ln(max(90, range)/16573499)` + `0.4 max(0, angle−π/2)`, rounded once to 0.1 s and clipped to 4–7.5 s entry /3.5–7.5 s exit. Canonical remains 6/5 s. Return begins from actual Inspection orbit/zoom, including partial entry.

Presentation focus is C1 across the inverse and retained Back tangent; the clock and blending envelopes are C2. No global C2 claim applies to the full moving-source path: the existing bounded physical interpolation has sample knots, and a real-time finite acceleration difference is not an analytic discontinuity measurement. The coherent Back derivative is `cameraVelocity + radiusRate×direction + radius×(angularVelocity×direction)`, using the same actual pose rates retained by Back. Raw world focus chord derivatives are preserved separately below.

Lift follows the actual rendered station, 75 km→0 on entry and 0→75 km on return. Focus does not mix source samples or modify physical altitude, velocity, timestamps, trajectory vertices or provenance. GP is computed from real orbital elements; OEM is source-provided predicted ephemeris; visual orientation is trajectory-aligned and actual attitude remains unavailable.

## Frame-by-frame focus audit

Every rendered frame records actual world basis, physical/displayed ISS, Earth, focal point/blend/ray, FOV, screen projections, lift, silhouette, applied time, render cadence and camera CPU. Raw JSON and CSV remain reproducible. Maximum world focal velocity **change** and adjacent acceleration change are finite-sample diagnostics: curved travel over tens of milliseconds produces nonzero values even for a smooth path. Exact boundary continuity is established by deterministic boundary tests and measured retained Back derivatives, not by requiring these differences to be zero.
''')
rows=[]
for label,run in a['runs'].items():
 if not label.startswith('final-') or 'ten-cycles' in label:continue
 for r in run['routes']:
  f=r['focus'];rows.append([label,r['cycle'],r['kind'],num(r['maxDirectionDegreesPerSecond']),num(r['maxUpDegreesPerSecond']),num(r['maxAngularVelocityJumpDegreesPerSecond']),num(f['maxVelocityChangeMetersPerSecond']/1000),num(f['maxAdjacentAccelerationChangeMetersPerSecondSquared']/1000),num(r['issScreenSteps']['maximumVisiblePairStepCss']),num(r['earthScreenSteps']['maximumVisiblePairStepCss']),f"{f['maximumRayErrorRadians']:.2e}"])
parts.append(table(['Run','Cycle','Direction','Direction °/s','Up °/s','Max Δ rate °/s','Max Δ focus v km/s','Max adjacent Δa km/s²','ISS visible step CSS px','Earth visible step CSS px','Ray error rad'],rows))
parts.append('''Near-plane projections of Earth centre can become enormous while Earth centre is off screen. The table uses **both endpoints visible** for meaningful screen steps; maximum finite projection steps are retained in [full analysis](focus-analysis.json). There are zero accidental displayed-ISS off-screen frames in the final live canonical/cycle traces and 101-pose arbitrary sweeps. Final requested/applied world basis agrees to floating-point precision, without a final orientation correction.

### First 5 /10 /20 /30% of entry

First production entry, frozen starting pose then advancing real scene UTC. Focal velocity is a world-coordinate finite chord, not spacecraft speed. The first 30% is evaluated at every rendered frame, not just four screenshots.
''')
rows=[]
for label in ['final-prod-gp','final-prod-oem']:
 r=next(r for r in a['runs'][label]['routes'] if r['cycle']==0 and r['kind']=='entry')
 for x in r['firstEntryIntervals']:
  rows.append([label,x['throughPercent'],x['frames'],num(x['maxDirectionDegreesPerSecond']),num(x['maxFocusVelocityMetersPerSecond']/1000),num(x['maxFocusVelocityChangeMetersPerSecond']/1000),num(x['issScreenSteps']['maximumVisiblePairStepCss']),num(x['earthScreenSteps']['maximumVisiblePairStepCss']),num(x['maxRenderDtMs']),num(x['maxMappingMs'],3),num(x['lastFocusBlend'],4)])
parts.append(table(['Run','Through %','Frames','Direction °/s','Focus v km/s','Max Δv km/s','ISS step px','Earth step px','Max dt ms','CPU ms','Last blend'],rows))
parts.append('### Exit interval returning focus to Earth\n\nThe station stays dominant during close departure; the final fraction of the hybrid metric returns Earth context. The transfer uses the same rail with the captured actual Inspection basis. Controllers stay locked until exact restore.\n')
parts.append(table(['Run','Cycle','First/last frame','Start/end %','Max dt ms','Max CPU ms'],[[label,r['cycle'],f"{r['exitFocusInterval']['firstFrame']} / {r['exitFocusInterval']['lastFrame']}",f"{100*r['exitFocusInterval']['startProgress']:.2f} / {100*r['exitFocusInterval']['endProgress']:.2f}",num(r['exitFocusInterval']['maxRenderDtMs']),num(r['exitFocusInterval']['maxMappingMs'],3)] for label,run in a['runs'].items() if label.startswith('final-') and 'ten-cycles' not in label for r in run['routes'] if r['kind']=='exit']))
parts.append('''## Arbitrary starts and direct visual review

Both builds and sources cover canonical/far/close/90° rotated/limb/alternate-pitch Earth entry and the matching returns, plus close-module, 2 km maximum zoom-out, orbit90° and orbit180° Inspection return. Every path has 2001 numerical clearance samples and 101 actual retained-scene rendered poses. The numerical lift target follows actual presentation progress. Camera never intersects WGS84 ellipsoid; terrain is the existing ellipsoid, not downloaded topography. Every tested rendered station centre remains within the viewport. Saved position/direction/Up, FOV, near/far, transform and all 11 controller fields restore. Geometry sampling is distinct from real-time frame-pacing measurements.

Visual review compares contact sequences, native endpoint images, paired actual-raster foreground measurements, lighting and responsive surfaces. [Reviewed views and exact final rate-change frames](visual-acceptance.json) record the direct acceptance; the clean in-app production view also completes a live GP entry/return with zero error/warning logs. The station stays composed during far steering and receding departure; no discrete roll correction or close-up takeover appears in the reviewed sequences. Arbitrary alternate-pitch paths naturally have larger continuous angular rates than canonical paths; this is not hidden by an FPS claim or a universal °/s limit. See all exact values in the arbitrary matrices.
''')
parts.append(table(['Build','Earth poses/source','Inspection poses/source','Min height km','Max restore position m','Unexpected errors'],[[build,d['arbitraryEarthPosesPerSource'],d['arbitraryInspectionPosesPerSource'],num(d['minimumHeightMeters']/1000,6),d['maximumRestorePositionMeters'],d['unexpectedErrors']] for build,d in v['builds'].items()]))
rows=[]
for build in ['development','production']:
 d=read('final-'+build+'-arbitrary.json')
 for r in [x for x in d['entries'] if x['source']=='PRIMARY_GP_TLE']:
  exit=next(x for x in d['exits'] if x['source']==r['source'] and x['name']=='from-'+r['name'])
  rows.append([build,r['name'],r['duration'],exit['duration'],num(r['maxDirectionStep']*2000/r['duration']),num(exit['maxDirectionStep']*2000/exit['duration'])])
parts.append(table(['Build','Earth pose','Entry s','Exit s','Max dense step/dt entry °/s','Exit °/s'],rows))
parts.append('''The dense step/dt figures above use uniform 1/2000 progress increments; they are geometry-rate diagnostics, not measured render FPS. All four additional Inspection return poses pass for each build/source. [Development matrix](final-development-arbitrary.json.gz), [production matrix](final-production-arbitrary.json.gz).

## Startup, resources and first/warm pacing

The model gate waits for texture and semantic readiness, then eight renders: zero-imagery/close-atmosphere variants, restored imagery, restored globe, and four normal model/PBR/silhouette/FXAA/environment frames. During loading the model can submit real draw commands while the loading locator and disabled Inspect communicate readiness. The separate idle celestial task uses public Simon1994 and Transforms, temporarily exposes the retained Moon/Sun to the GPU, restores exact camera/input/loop/far/transform, and paints the real Earth view before returning. No scene/model/provider replacement or private shader binding is introduced. [Public positions](https://cesium.com/learn/cesiumjs/ref-doc/Simon1994PlanetaryPositions.html), [Viewer](https://cesium.com/learn/cesiumjs/ref-doc/Viewer.html), [Transforms](https://cesium.com/learn/cesiumjs/ref-doc/Transforms.html).

Model preparation counting waits for sky completion. A forced six-second idle delay confirms that a ready GLB cannot enable Inspect early; seven observer-visible warm frames precede the eighth frame whose callback completes readiness. Both delayed-sky browser tests and the deterministic eight-frame test pass. Optional NASA imagery/skybox network failure retains existing local/default fallbacks; critical model/render failure is explicit. Global imagery LOD is not exhaustively prefetched, and newly requested imagery can still depend on network/cache availability. No terrain resource is introduced.

Zero programs link during the complete arbitrary pose matrices and the final resource-only sweeps, and no >10ms shader-status/link call occurs in those flights. Startup retains some one-time compilation/render cost before controls enable. Direct preparation cost includes one-time spline/LUT capture, never a per-frame rebuild. Stock atmosphere, fog, skybox, PBR maps, trajectory materials, FXAA, silhouette and full textures remain; see actual native shader diagnostics and resource identity records.

Matched baseline/final profiles use the same Mac, Chromium/ANGLE Metal, UTC `2026-09-30T15:45:59.975908Z`, archived real API inputs, starting world pose, 1280×720 CSS and native DPR2. GIBS failure is held constant for reproducible local imagery. One benchmark page runs at a time; no simultaneous Chromium benchmarks/builds/tests. First Inspect is requested ~50ms after readiness; warm follows the first round trip and two-second wait. The real selected-source frame keeps advancing during each timed flight.
''')
parts.append(table(['Run','GLB ready ms','Inspect enabled ms','Sky idle task ms','Sky ready / warming at enabled'],[[label,num(d['metadata']['readiness']['modelReadyObservedAt']),num(d['metadata']['readiness']['inspectEnabledAt']),num(d['metadata']['skyWarmup']['endMs']-d['metadata']['skyWarmup']['startMs']),f"{d['metadata']['readiness']['skyReadyWhenEnabled']} / {d['metadata']['readiness']['warmingWhenEnabled']}" ] for label,d in a['runs'].items() if label.startswith('final-') and 'ten-cycles' not in label]))
parts.append('''### Baseline vs final: every first/warm direction

Cycle0 is first use, cycle1 warmed. Frame cadence is postRender wall-time; angular/focal derivatives use actual camera application time, independently. Threshold counts exclude the first frame's missing interval. Long tasks intersect the active route. Small differences in GPU/browser scheduling do not establish a universal speedup.
''')
rows=[]
for label,run in a['runs'].items():
 if 'ten-cycles' in label:continue
 for r in run['routes']:
  p=r['performance'];rows.append([label,'first' if r['cycle']==0 else 'warm',r['kind'],num(p['medianFPS']),num(p['p50']),num(p['p95']),num(p['p99']),num(p['worst']),p['over33_3'],p['over50'],p['longTasks'],num(r['mappingMs']['p50'],3),num(r['mappingMs']['worst'],3),num(r['focusMs']['worst'],3),num(r['prepareMs'])])
parts.append(table(['Run','State','Direction','FPS','p50 ms','p95','p99','Worst','>33.3','>50','Long tasks','CPU p50 ms','CPU max','Focus max','Capture ms'],rows))
parts.append('''### CPU, GPU and network interpretation

Per-frame transition/composition work is measured directly, including any nested focal evaluation once in transition total. Construction is separately measured above. [CDP CPU sampling](cpu-analysis.json) preserves first/warm entry and exit profiles, native idle/GC samples and top self-sampled functions. Minified profiles do not permit perfect React/render preparation attribution; no fabricated per-pass timings are reported. Camera state lives in retained Cesium vectors, with no per-frame React camera update. Existing meaningful mode changes and throttled time/readout UI callbacks persist. No LUT/material/provider/primitive allocation hotspot is added in the transition loop.

The browser supports `EXT_disjoint_timer_query_webgl2`. Asynchronous elapsed queries are consumed only after availability, with disjoint checks; raw nanosecond-derived durations bracket scene draw submission, including queue scheduling, rather than identifying individual passes. [Timer query semantics](https://developer.mozilla.org/en-US/docs/Web/API/EXT_disjoint_timer_query). Native GL wrappers separately identify shader-status stalls. GPU elapsed time and wall cadence can differ under shared pipeline scheduling. Full-resolution model/atmosphere/silhouette/FXAA cost remains significant; no 60FPS guarantee is claimed. Controlled local-image runs isolate network failure; live smoke verifies ordinary backend delivery separately.
''')
parts.append(table(['Run','State','Direction','GPU p50 ms','p95','p99','Max','Disjoint'],[[label,'first' if r['cycle']==0 else 'warm',r['kind'],num(r['gpuMs']['p50']),num(r['gpuMs']['p95']),num(r['gpuMs']['p99']),num(r['gpuMs']['worst']),run['metadata']['gpu']['disjoint']] for label,run in a['runs'].items() if 'ten-cycles' not in label for r in run['routes'] if r['gpuMs']]))
parts.append('''## Partial Back and repeated-cycle stability

Back10/20/35/50/65/80/95% passes for two builds×two sources. Capture preserves position, basis, FOV and explicit focus; outgoing epsilon preserves incoming world velocity and angular/focal derivative. The finite focus chord diagnostic is distinct from the coherent retained derivative. No instantaneous frame switch occurs at the request.
''')
parts.append(table(['Back %','Cases','Max focus jump m','Max relative focus derivative error','Max position jump m','Max angular derivative error rad/s'],[[100*r['fraction'],r['cases'],f"{r['maxFocusErrorMeters']:.3e}",f"{r['maxFocusVelocityRelativeError']:.3e}",f"{r['maxPositionErrorMeters']:.3e}",f"{r['maxAngularVelocityErrorRadiansPerSecond']:.3e}"] for r in v['checkpoints']]))
parts.append('''Twenty real-time round trips per build alternate sources: ten GP and ten OEM. Ten accelerated geometry cycles per source/build provide additional restoration checks. GC-normalized heap falls after transient trace/LUT data is released; this is a local leak check, not GPU-memory accounting. Querying the transition prototype yields zero retained transition instances. [CDP queryObjects](https://chromedevtools.github.io/devtools-protocol/tot/Runtime/#method-queryObjects). One retained model, six scene primitives, two imagery layers, the same Globe/Atmosphere/providers and post-process resources persist. Camera/FOV drift is zero.
''')
parts.append(table(['Build','Real cycles/source','Heap before MiB','Heap after MiB','Retained transitions','Position/FOV drift'],[[build,d['realTimeCyclesPerSource'],num(d['heapBefore']['usedSize']/1048576),num(d['heapAfter']['usedSize']/1048576),d['retainedTransitions'],'0 m /0 rad'] for build,d in v['builds'].items()]))
rows=[]
for build in ['development','production']:
 routes=a['runs']['final-'+build+'-ten-cycles']['routes']
 for source in ['PRIMARY_GP_TLE','NASA_OEM']:
  for kind in ['entry','exit']:
   first=[r['performance']['p50'] for r in routes if r['source']==source and r['kind']==kind and r['cycle']<10]
   last=[r['performance']['p50'] for r in routes if r['source']==source and r['kind']==kind and r['cycle']>=10]
   rows.append([build,source,kind,num(sum(first)/len(first)),num(sum(last)/len(last))])
parts.append(table(['Build','Source','Direction','Mean p50 first five cycles ms','Last five ms'],rows))
parts.append('''## Quality, pacing and regression proof

The unchanged NASA VTAD `/models/iss-vtad-source-png.glb` is 32,735,516 bytes, SHA256 `ce23515c6bf4a77d3bac6b7c2554e3c92e137c11c8db3ee1ffc1f3ef2030a16f`: 19 source PNG images (15×1024²,4×512²),27 materials,132 nodes,131 meshes, mipmap minFilter9987. No image/model simplification or replacement. [Full asset/source hash audit](quality-preservation.json).

MSAA4, retained native FXAA (Overview bypass/active close modes), resolutionScale1, browser recommended resolution disabled, DPR2 and 2560×1440 buffer remain. Same PBR custom shader, environment maps, silhouette policy, imagery/provider quality, native Earth depth, full trajectory geometry and adaptive gap/rounded start. Source hashes of graphicsQuality, issMaterialQuality, inspectionAntialiasing, earthImagery, trajectoryRendering, trajectoryClearance, earthViewPresentation, inspectionControls, perceptualPath and arcLengthPath equal baseline. The six retained primitives/two layers and quality flags are checked in browser resources, not solely inferred from hashes.

Desktop endpoint remains 90 m /42.5° /100°, rear/elevated with zero lateral offset; portrait retains accepted aspect widening. Model scale1/minimumOverview80, trajectory-aligned visual orientation and honest unavailable attitude remain. Back restores exact captured Earth pose, frustum, transform and controllers. Perceptual raster growth remains distributed near entry: actual model-minus-background image pairs quantify the final5%, including native mobile foreshortening. Height-growth fractions below refer to the net0→100 height change; mobile is not falsely claimed to have monotone distant mesh height.
''')
rows=[]
for label in ['baseline','production','narrow','mobile']:
 d=read(label+'-projected-samples.json')
 for source in ['PRIMARY_GP_TLE','NASA_OEM']:
  r=[x for x in d['samples'] if x['source']==source and x['kind']=='entry'];h=lambda x:x['raster']['heightCss'];start=h(next(x for x in r if x['percent']==0));end=h(next(x for x in r if x['percent']==100));last=end-h(next(x for x in r if x['percent']==95))
  rows.append([label,source,num(start,1),num(end,1),num(last,1),num(100*last/(end-start))])
parts.append(table(['Surface','Source','Start height CSS px','Endpoint height','Last5% px','% net growth'],rows))
parts.append('''The complete development/production matrix passes day/night/terminator and city-light/local-image fallback, both sources, 900px desktop and390px mobile, native wheel/orbit/pinch, refresh,14 semantic picks per source, delayed5s GLB, OEM loss during entry/stable Inspection/exit, atomic focus-preserving GP retarget, silhouettes/lift/trajectories and endpoint/restore. No unexpected page/application/WebGL errors remain; expected intentionally aborted GIBS/503 resource diagnostics are identified separately. [Full matrix](production-full.json), [regressions](production-extra.json), [reversals](production-reversals.json), [clean live smoke](clean-live-smoke.json).

Equivalent visual lint has no unnamed controls, unnamed images, clipped controls or overflow blockers. An initial lint flagged the unchanged Cesium ion credit for absent alt. Its native `title="Cesium ion"` gives the image an accessible name in both baseline and final; the corrected gate checks that name and retains absent-alt as a warning. The initial report and failed attempt remain preserved. Tiny-credit/approximate-contrast warnings are reported in raw lint evidence; this transition-only change does not redesign existing typography or treat a WebGL background contrast estimate as an accessibility certification.

## Validation, documentation and acceptance

Frontend **130 tests /24 files**, complete suite, typecheck and production build pass on Node24. Backend **82 tests**, zero failures/errors/skips, `mvn test` and `mvn verify` pass on Java21; backend sources are unchanged. Existing large Cesium bundle warning remains. The final source is free from QA globals; served clean production bundle identity equals local dist. [Validation/source manifest](validation.json), [numerical/browser acceptance](focus-validation.json), [full serial matrix execution](qa-run.json), [final source profiles/resource/raster/startup/lint execution](qa-evidence-run.json).

The complete geometry/reversal/20-cycle matrix was captured immediately before the final startup ordering guard. That guard only excludes temporary celestial renders from the eight-frame counter: all complete-matrix captures had sky ready before model ready, so it was inactive for their paths and timings. Exact final source then passed fresh/warm dev/prod×GP/OEM profiles, both forced startup races, final resource sweeps, raster/lint and clean live smoke. This distinction preserves honest source lineage without attributing changed motion to an inert startup predicate.

Updated frontend README, iss-inspection-mode, iss-model, rendering-quality, orbital-trajectory-rendering, architecture03/04 and ADR-0006's dated camera clarification. Existing source/domain/physical/display separation and accepted architecture persist; no new ADR threshold is crossed. Evidence here retains complete JSON (raw trace and large arbitrary/probe JSON losslessly gzip-compressed), per-frame CSV, profiles, plots, contact sheets and rejection diagnostics; disposable redundant PNGs/JPEGs are omitted. `/Users/daniel/Desktop/mission1-project.md` is updated outside Git. Normal new commit only; no history rewriting. SSH push to `git@github.com:therabo/MISSION1.git`, branch main, explicit intended Ed25519 key; fetched origin/main and direct GitHub main must equal local HEAD before reporting completion.

All A–O acceptance gates pass in the reviewed conditions: continuous subject transfer both directions, smooth camera/Up, no avoidable focus-time compilation/resource event, arbitrary starts, first/warm readiness, repeated-cycle stability, quality/pacing/endpoint preservation, continuous partial Back, GP/OEM and regressions. Local GPU cost and unbounded future global imagery/network coverage remain explicit limits; neither is disguised through reduced quality.

Next single milestone: **GP/TLE ↔ NASA OEM RTN TRAJECTORY-SEPARATION ANALYSIS**. Not started.
''')
(root/'results.md').write_text('\n\n'.join(parts));print('Wrote measured acceptance report')
