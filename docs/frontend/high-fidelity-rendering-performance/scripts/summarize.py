"""Recalculate comparable statistics from original raw evidence, without a browser."""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EVIDENCE = ROOT / "evidence"


def read(path):
    return json.loads((EVIDENCE / path).read_text())


def stats(values):
    ordered = sorted(values)
    q = lambda p: ordered[min(len(ordered) - 1, math.floor(len(ordered) * p))]
    slow = ordered[-max(1, math.ceil(len(ordered) * .01)):]
    times = [0]
    for v in values:
        times.append(times[-1] + v)
    left = 0
    low_start = None
    longest = 0
    for i, now in enumerate(times):
        if now < 1000:
            continue
        while left + 1 < i and times[left + 1] <= now - 1000:
            left += 1
        fps = (i - left) * 1000 / (now - times[left])
        if fps < 55:
            if low_start is None:
                low_start = now
            longest = max(longest, now - low_start)
        else:
            low_start = None
    return dict(count=len(values), medianMs=q(.5), p95Ms=q(.95), p99Ms=q(.99),
                medianFps=1000/q(.5), onePercentLowFps=1000/(sum(slow)/len(slow)),
                over20=sum(v > 20 for v in values), over33=sum(v > 33.3 for v in values),
                over50=sum(v > 50 for v in values), longestRollingBelow55Ms=longest)


def table(rows):
    t = "| State | N | median / P95 / P99 ms | median FPS | 1% low FPS | >20 / >33.3 / >50 ms | rolling <55 s |\n| --- | ---: | --- | ---: | ---: | --- | ---: |\n"
    for r in rows:
        t += (f"| {r['name']} | {r['count']} | {r['medianMs']:.2f} / {r['p95Ms']:.2f} / {r['p99Ms']:.2f} | "
              f"{r['medianFps']:.2f} | {r['onePercentLowFps']:.2f} | {r['over20']} / {r['over33']} / {r['over50']} | {r['longestRollingBelow55Ms']/1000:.2f} |\n")
    return t


def performance(path, label):
    j = read(path)
    return [{"name": r['name'], "label": label, **stats(r['intervals']),
             "canvas": r['canvas'], "viewport": r.get('viewport'), "dpr": r['dpr'],
             "visibility": r['visibility'], "focus": r['focus'],
             "longTasks": len(r.get('longTasks', [])), "domMutationDeliveries": len(r.get('domMutations', [])),
             "tileQueueSettled": r['globeTilesLoaded'], "source": path,
             "servedBundle": r.get('servedBundle'), "pageErrors": j['errors'],
             "requestFailures": j.get('requestFailures', [])} for r in j['rows']]


def loads(path):
    j = read(path)
    documents = sorted((n for n in j['network'] if n['type'] == 'document'), key=lambda n: n['timing']['startTime'])
    result = []
    for i, l in enumerate(j['loads']):
        start = documents[i]['timing']['startTime']
        finish = start + l.get('fullSceneReady', l['tileQueueIdle'])
        network = [n for n in j['network'] if start <= n['timing']['startTime'] <= finish]
        sizes = [n['sizes'] for n in network if n.get('sizes')]
        result.append({"mode": l['mode'], **{k: l.get(k) for k in ['viewerReady', 'firstObservedEarthFrame', 'modelResourcesReady', 'inspectionReady', 'tileQueueIdle', 'starDecodedAt', 'fullSceneReady']},
                       "requestsStartedBySettled": len(network), "observedResponseBodyBytes": sum(n['responseBodySize'] for n in sizes),
                       "observedResponseHeaderBytes": sum(n['responseHeadersSize'] for n in sizes), "requestsWithSizes": len(sizes),
                       "localResourceTimingTransferBytes": l['navigation']['transferSize'] + sum(n['transferSize'] for n in l['resources'] if '127.0.0.1' in n['name']),
                       "localBodyBytes": sum(n['sizes']['responseBodySize'] for n in network if n.get('sizes') and '127.0.0.1' in n['url']),
                       "externalBodyBytes": sum(n['sizes']['responseBodySize'] for n in network if n.get('sizes') and '127.0.0.1' not in n['url'])})
    return result


def load_table(rows):
    t = "| Load | Viewer / observed Earth ms | native ISS / Inspection ready ms | tile idle / stars ready / fully refined ms | requests | observed body / headers bytes | local / external body bytes | local Resource Timing transfer bytes |\n| --- | --- | --- | --- | ---: | --- | --- | ---: |\n"
    f = lambda v: 'unobserved' if v is None else f'{v:.1f}'
    for r in rows:
        t += (f"| {r['mode']} | {f(r['viewerReady'])} / {f(r['firstObservedEarthFrame'])} | {f(r['modelResourcesReady'])} / {f(r['inspectionReady'])} | "
              f"{f(r['tileQueueIdle'])} / {f(r['starDecodedAt'])} / {f(r['fullSceneReady'])} | {r['requestsStartedBySettled']} | "
              f"{r['observedResponseBodyBytes']:,} / {r['observedResponseHeaderBytes']:,} | {r['localBodyBytes']:,} / {r['externalBodyBytes']:,} | {r['localResourceTimingTransferBytes']:,} |\n")
    return t


def gpu():
    result = []
    for r in read('after/gpu/gpu-audit.json')['rows']:
        textures = [t for t in r['textures'] if t['live']]
        # Observable texImage allocations only; exclude unknown formats from byte total.
        bpp = {6407: 3, 6408: 4, 32849: 3, 32856: 4, 34842: 8, 34836: 16, 35056: 4, 33326: 4, 33321: 1, 33323: 2}
        texture_bytes = 0
        unknown = []
        for t in textures:
            for l in t['levels'].values():
                if l['internalFormat'] not in bpp:
                    unknown.append(l)
                else:
                    texture_bytes += (l.get('width') or 0)*(l.get('height') or 0)*bpp[l['internalFormat']]*(4/3 if t['mips'] else 1)
        buffers = [b for b in r['renderbuffers'] if b.get('live')]
        rb_bytes = sum(b['width']*b['height']*b['samples']*bpp.get(b['format'], 0) for b in buffers)
        q = lambda a, p: sorted(a)[min(len(a)-1, math.floor(len(a)*p))] if a else None
        result.append(dict(mode=r['mode'], cpuMedianMs=q(r['cpu'], .5), cpuP95Ms=q(r['cpu'], .95),
                           gpuMedianMs=q(r['gpu'], .5), gpuP95Ms=q(r['gpu'], .95), gpuSamples=len(r['gpu']),
                           medianDrawCalls=q(r['drawCalls'], .5), p95DrawCalls=q(r['drawCalls'], .95),
                           liveTextures=len(textures), cumulativeTextures=len(r['textures']),
                           textureEstimateMiB=texture_bytes/2**20, unknownTextureFormats=unknown,
                           liveRenderbuffers=len(buffers), renderbufferEstimateMiB=rb_bytes/2**20,
                           heap=r['heap'], defaultSamples=r['defaultSamples'], sceneMsaa=r['sceneMsaa'],
                           maximumAnisotropy=r['maximumAnisotropy'], maximumTexture=r['maximumTexture'],
                           maximumCube=r['maximumCube'], contextLoss=r['contextLoss'],
                           tileCacheSize=r['tileCacheSize'], screenSpaceError=r['screenSpaceError'], tileQueueSettled=r['tileQueueSettled']))
    return result


def main():
    before = performance('before/performance-dpr1.json', 'baseline') + performance('before/performance-replay.json', 'baseline')
    after = performance('after/dpr1/performance.json', 'final')
    secondary = []
    for path, label in [('before/performance-dpr2.json', 'baseline native DPR2'), ('after/dpr2/performance.json', 'final native DPR2'),
                        ('after/live/performance.json', 'final actual LIVE'), ('after/1280x720/performance.json', '1280×720'),
                        ('after/900x700/performance.json', '900×700'), ('after/390x844/performance.json', '390×844 emulation')]:
        for r in performance(path, label):
            r['name'] = label + ' / ' + r['name']
            secondary.append(r)
    loading = {k: loads(p) for k,p in [('before', 'before/loading.json'), ('after', 'after/loading.json'), ('baselineRecheck', 'before/loading-recheck/loading.json')]}
    g = gpu()
    (EVIDENCE/'metrics.json').write_text(json.dumps(dict(before=before, after=after, secondary=secondary, loading=loading, gpu=g), indent=2)+'\n')
    t = '# Numerical validation\n\nGenerated from raw original evidence by `scripts/summarize.py`. All primary rows have 10 s warmup + 30 s foreground measurement. 1% low is recalculated consistently from the slowest 1% mean; rolling low-cadence duration is evaluated after the first full second.\n\n## Baseline, 1440×900 DPR 1\n\n'+table(before)+'\n## Final matched scene, 1440×900 DPR 1\n\n'+table(after)
    t += '\n## Native Retina, actual LIVE and smaller viewport reference\n\n'+table(secondary)
    t += '\nThe primary Overview target (median≥59 FPS, preferably P95≤18 ms and no rolling <55 FPS run exceeding 1 s) **FAILS**. Display cadence is approximately 60 Hz, so this is a real rendering-budget limit. GPU fill/MSAA and original model/PBR/draw work exceed 16.67 ms; no quality reduction is counted as a performance pass. Smaller viewport emulation is the same Mac/browser, not physical mobile hardware.\n'
    for label,k in [('Original baseline loading','before'),('Final loading','after'),('Untouched baseline contemporaneous recheck','baselineRecheck')]:
        t+='\n## '+label+'\n\n'+load_table(loading[k])
    t+='\nRequest/body figures count instrumented requests started by the observed settlement boundary and their returned response-body/header sizes; they are not packet-level wire measurements. Warm HTTP revalidation can reuse cached bytes. Failed/aborted/in-flight requests without completed size records are not invented. Original baseline did not observe separate high-star decode/fully-refined timing; the untouched-build recheck does. All loading runs above are normal-network, isolated from compilation/tests. External NASA latency changes; the controlled one-tile outage and overlapping candidate loads are excluded.\n\n## Instrumented GPU/CPU and memory\n\n| Mode | scene CPU median / P95 ms | GPU median / P95 ms (N) | draw calls median / P95 | live textures / total created | texture / MSAA buffer MiB estimate | JS heap used / allocated MiB |\n| --- | --- | --- | --- | --- | --- | --- |\n'
    for r in g:
        t+=f"| {r['mode']} | {r['cpuMedianMs']:.2f} / {r['cpuP95Ms']:.2f} | {r['gpuMedianMs']:.2f} / {r['gpuP95Ms']:.2f} ({r['gpuSamples']}) | {r['medianDrawCalls']} / {r['p95DrawCalls']} | {r['liveTextures']} / {r['cumulativeTextures']} | {r['textureEstimateMiB']:.2f} / {r['renderbufferEstimateMiB']:.2f} | {r['heap']['used']/2**20:.2f} / {r['heap']['total']/2**20:.2f} |\n"
    t+='\nGPU timers are asynchronous instrumented scene-work measurements; overhead and different real epochs make them distinct from uninstrumented FPS intervals. Texture totals include observable texture allocations and generated mip estimates; unknown formats, texStorage/private driver allocations and physical residency are not guessed. Renderbuffer estimate is separate, not double-counted as a texture. GPU audit records texture/cube limits, anisotropy, scene MSAA, tile cache and zero context loss in raw JSON. The stable source model/cube and deletion after return are verified; short-run observations do not certify unlimited memory safety.\n'
    (ROOT/'metrics.md').write_text(t)


if __name__ == '__main__':
    main()
