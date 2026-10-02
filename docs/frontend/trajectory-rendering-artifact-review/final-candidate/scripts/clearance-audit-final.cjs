// Adapted QA: retain exact camera/reveal/restore gates; validate current circular mask and visible safety without tiny-tangent normalization.
// Disposable diagnostic builds only. Real recorded backend products; no runtime fallback.
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.MISSION1_PLAYWRIGHT_MODULE || 'playwright');
const root = process.env.MISSION1_REPO_ROOT || path.resolve(__dirname, '../../../../..');
const out = process.env.MISSION1_EVIDENCE_DIR || '/tmp/mission1-final-clearance-evidence';
const width = +(process.env.MISSION1_QA_WIDTH || 1280), height = +(process.env.MISSION1_QA_HEIGHT || 720);
const port = +process.argv[2], label = process.argv[3];
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal'] });
  try {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
    for (const [api, file] of [['samples', 'real-samples.json'], ['comparison', 'real-comparison.json']])
      await context.route('**/api/iss/orbit/' + api, r => r.fulfill({ json: JSON.parse(fs.readFileSync(root + '/docs/frontend/inspection-orientation-review/' + file)) }));
    await context.route('https://gibs.earthdata.nasa.gov/**', r => r.abort('failed'));
    const page = await context.newPage(), report = { label, viewport: [width, height], epsilon: .005, entries: [], exits: [], errors: [] };
    page.on('pageerror', e => report.errors.push(String(e)));
    await page.goto('http://127.0.0.1:' + port);
    await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Inspect ISS')?.disabled === false, null, { timeout: 60000 });
    await page.evaluate(() => {
      const q = globalThis.__qa, H = q.helpers, v = q.viewer;
      const vec = p => [p.x, p.y, p.z];
      const project = p => { if(!p||H.Cartesian3.dot(H.Cartesian3.subtract(p,v.camera.positionWC,new H.Cartesian3()),v.camera.directionWC)<=v.camera.frustum.near)return null;const s = H.SceneTransforms.worldToWindowCoordinates(v.scene, p, new H.Cartesian2()); return s ? { x: s.x, y: s.y } : null; };
      const distance = (p, hull) => {
        if(!p||!hull)return null;
        let inside = true, d = Infinity;
        for (let i = 0; i < hull.length; i++) {
          const a = hull[i], b = hull[(i + 1) % hull.length], dx = b.x - a.x, dy = b.y - a.y;
          if (dx * (p.y - a.y) - dy * (p.x - a.x) < 0) inside = false;
          const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
          d = Math.min(d, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy));
        }
        return inside ? 0 : d;
      };
      const smooth = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
      q.snapshot = (frameIndex, progress) => {
        const c = v.camera, now = H.JulianDate.toDate(v.clock.currentTime).getTime();
        const physical = q.positionAt(v.clock.currentTime, new H.Cartesian3()), display = q.model.boundingSphere.center;
        const hull = H.projectedModelFootprint(v.scene, q.model), center = project(display);
        const trails = q.trails.trails.map(t => {
          if (q.visibility === 0) return { source: t.source, adaptiveGapSeconds: t.gapSeconds, bodyAlpha: t.layers[1].material.uniforms.maximumAlpha, haloAlpha: t.layers[0].material.uniforms.maximumAlpha, vertexIdentity: t.positions === q.vertexRefs[t.source] };
          const u = t.layers[1].material.uniforms, mask = t.layers[1].material.materials.clearanceMask.uniforms;
          const start = t.startMs + u.forwardStart * (t.endMs - t.startMs), end = t.startMs + u.forwardEnd * (t.endMs - t.startMs);
          const point = ms => t.position.getValue(H.JulianDate.fromDate(new Date(ms)), new H.Cartesian3());
          const first = point(start), origin = point(Math.max(now + 1, t.startMs));
          const nextTime = t.sampleTimes.find(ms => ms > Math.max(now + 1, t.startMs)) || t.endMs;
          const a = project(origin), b = project(point(nextTime));
          const screen = project(first), projectedInterval=a&&b?Math.hypot(b.x-a.x,b.y-a.y):null;
          const maskDistance=(p,ms)=>{if(!p)return 0;const circle=mask.radius!==undefined?Math.hypot(p.x-mask.center.x,p.y-mask.center.y)-mask.radius:distance(p,hull)-mask.clearance;
           if(!mask.initialExternal)return circle;
           const a=mask.origin,b=mask.tangentA,c=mask.tangentB,side=(u,v)=>(v.x-u.x)*(p.y-u.y)-(v.y-u.y)*(p.x-u.x),cross=[side(a,b),side(b,c),side(c,a)];
           const inside=cross.every(x=>x>=0)||cross.every(x=>x<=0),seg=(u,v)=>{const dx=v.x-u.x,dy=v.y-u.y,k=Math.max(0,Math.min(1,((p.x-u.x)*dx+(p.y-u.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-u.x-k*dx,p.y-u.y-k*dy);};
           const triangle=Math.min(seg(a,b),seg(b,c),seg(c,a));return Math.min(circle,inside?-triangle:triangle);} ;
          const futureStart=t.startMs+u.futureStart*(t.endMs-t.startMs);
          const alphaAt = ms => {
            const pixel = project(point(ms));
            return pixel ? u.maximumAlpha * smooth((ms-futureStart)/Math.max(.001,u.startRamp*(t.endMs-t.startMs))) *
              (1 - smooth((ms - start) / (end - start))) * smooth(maskDistance(pixel,ms)/(mask.softness||.75)) : 0;
          };
          let visible = null;
          if (u.maximumAlpha >= .005) {
            let low = futureStart;
            for(const ms of [...t.sampleTimes.filter(ms=>ms>futureStart&&ms<end),end-1]){
             if(alphaAt(ms)>=.005){let high=ms;for(let i=0;i<25&&high-low>1;i++){const mid=(high+low)/2;if(alphaAt(mid)>=.005)high=mid;else low=mid;}
              const p=point(high),pixel=project(p);visible={epoch:new Date(high).toISOString(),world:vec(p),screen:pixel,alpha:alphaAt(high),clearance:distance(pixel,hull)-q.model.silhouetteSize,maskDistance:maskDistance(pixel,high)};break;}low=ms;
            }
          }
          let pathMetres = 0, previous = point(Math.max(now, t.startMs));
          for (const ms of [...t.sampleTimes.filter(ms => ms > now && ms < start), start]) {
            const p = point(ms); pathMetres += H.Cartesian3.distance(previous, p); previous = p;
          }
          let maskError = 0;
          if(mask.radius!==undefined&&hull){
           const left=Math.min(...hull.map(p=>p.x)),right=Math.max(...hull.map(p=>p.x)),top=Math.min(...hull.map(p=>p.y)),bottom=Math.max(...hull.map(p=>p.y));
           maskError=Math.hypot(mask.center.x-(left+right)/2,mask.center.y-(top+bottom)/2);
           for(const p of hull)if(Math.hypot(p.x-mask.center.x,p.y-mask.center.y)+q.model.silhouetteSize>mask.radius+1e-5)maskError=Infinity;
          }else if(hull)for(let i=0;i<hull.length;i++)maskError=Math.max(maskError,Math.hypot(mask['footprint'+i].x-hull[i].x,mask['footprint'+i].y-hull[i].y));
          const safeSamples=t.sampleTimes.filter(ms=>{if(ms<=futureStart||ms>=end)return false;const p=point(ms),pixel=project(p);return pixel&&pixel.x>=0&&pixel.x<=v.scene.canvas.clientWidth&&pixel.y>=0&&pixel.y<=v.scene.canvas.clientHeight&&maskDistance(pixel,ms)>(mask.softness||.75)&&u.maximumAlpha*(1-smooth((ms-now)/(end-now)))>=.005&&!H.earthOccludes(v.camera.positionWC,p);}).length;
          return { safeSamples,projectedInterval,source: t.source, trajectoryStartEpoch: new Date(t.startMs).toISOString(), startEpoch: new Date(start).toISOString(), startWorld: vec(first), startScreen: screen,
            adaptiveGapSeconds: t.gapSeconds, adaptiveGapPathMetres: pathMetres, rampSeconds: t.rampSeconds,
            startClearance: distance(screen, hull), requiredClearance: mask.radius??mask.clearance, maskError, firstPerceptible: visible,
            bodyAlpha: u.maximumAlpha, haloAlpha: t.layers[0].material.uniforms.maximumAlpha, vertexIdentity: t.positions === q.vertexRefs[t.source] };
        });
        return { frameIndex, timestamp: H.JulianDate.toIso8601(v.clock.currentTime), transitionProgress: progress, selectedSource: q.source, mode: q.mode,
          cameraPosition: vec(c.positionWC), cameraDirection: vec(c.directionWC), physicalIssPosition: vec(physical), displayedIssPosition: vec(display), ISS_screenPosition: center,
          cameraRangeToDisplayedISS: H.Cartesian3.distance(c.positionWC, display), trajectoryReveal: q.visibility, silhouetteSize: q.model.silhouetteSize, hull, trails };
      };
      q.setEarth = name => {
        v.useDefaultRenderLoop = false; v.clock.shouldAnimate = false; v.clock.currentTime = H.JulianDate.fromIso8601('2026-09-30T15:45:59.975908Z'); q.override = 0; q.tick();
        const p = q.positionAt(v.clock.currentTime, new H.Cartesian3()), geo = H.Ellipsoid.WGS84.cartesianToCartographic(p);
        let position = new H.Cartesian3(-9412786.358621413, -21163227.169227634, -3167995.3206285993);
        if (name === 'far') H.Cartesian3.multiplyByScalar(position, 3, position);
        if (name === 'close') position = H.Cartesian3.fromRadians(geo.longitude, geo.latitude, 2_000_000);
        if (name === 'rotated') position = H.Cartesian3.fromRadians(geo.longitude + Math.PI / 2, 0, 17_000_000);
        if (name === 'limb') position = H.Cartesian3.fromRadians(geo.longitude + 70 * Math.PI / 180, geo.latitude, 17_000_000);
        const direction = H.Cartesian3.normalize(H.Cartesian3.negate(position, new H.Cartesian3()), new H.Cartesian3());
        const up = H.Cartesian3.normalize(H.Cartesian3.cross(H.Cartesian3.cross(direction, H.Cartesian3.UNIT_Z, new H.Cartesian3()), direction, new H.Cartesian3()), new H.Cartesian3());
        v.camera.lookAtTransform(H.Matrix4.IDENTITY); v.camera.setView({ destination: position, orientation: { direction, up } }); v.camera.frustum.fov = Math.PI / 3; q.tick(); v.render();
        q.vertexRefs = Object.fromEntries(q.trails.trails.map(t => [t.source, t.positions]));
      };
      q.handoff = null;
      const native = v.camera.lookAtTransform;
      v.camera.lookAtTransform = function (...args) {
        const before = { position: H.Cartesian3.clone(this.positionWC), direction: H.Cartesian3.clone(this.directionWC), up: H.Cartesian3.clone(this.upWC), fov: this.frustum.fov };
        const r = native.apply(this, args);
        if (q.mode === 'ENTERING_INSPECTION' && q.override === 1) q.handoff = { positionError: H.Cartesian3.distance(before.position, this.positionWC), directionError: H.Cartesian3.angleBetween(before.direction, this.directionWC), upError: H.Cartesian3.angleBetween(before.up, this.upWC), fovError: this.frustum.fov - before.fov };
        return r;
      };
    });
    const earthPoses = width === 1280 && !process.env.MISSION1_QA_CANONICAL_ONLY ? ['canonical', 'rotated', 'close', 'far', 'limb'] : ['canonical'];
    const departurePoses = process.env.MISSION1_QA_PARTIAL_ONLY ? ['back10','back20','back35','back50','back65','back80','back95'] : process.env.MISSION1_QA_CANONICAL_ONLY ? ['canonical'] : width === 1280 ? ['canonical', 'close-module', 'max-zoom', 'orbit90', 'orbit180'] : ['canonical', 'max-zoom', 'orbit90'];
    for (const source of ['PRIMARY_GP_TLE', 'NASA_OEM']) {
      for (const name of earthPoses) {
        await page.getByRole('button', { name: source === 'NASA_OEM' ? 'NASA OEM' : 'MISSION1 GP/TLE', exact: true }).evaluate(b => b.click());
        await page.evaluate(name => globalThis.__qa.setEarth(name), name);
        await page.getByRole('button', { name: 'Inspect ISS', exact: true }).evaluate(b => b.click());
        const row = await page.evaluate(() => {
          const q = globalThis.__qa, H = q.helpers, v = q.viewer; q.override = 1; q.tick(); v.render();
          const physical = q.positionAt(v.clock.currentTime, new H.Cartesian3()), local = H.Matrix4.multiplyByPoint(H.Matrix4.inverseTransformation(q.frame, new H.Matrix4()), v.camera.positionWC, new H.Cartesian3());
          return { range: H.Cartesian3.distance(v.camera.positionWC, physical), local: [local.x, local.y, local.z], elevation: Math.atan2(local.z, -local.x) * 180 / Math.PI, fov: v.camera.frustum.fov * 180 / Math.PI, handoff: q.handoff, hidden: q.visibility === 0, scale: q.model.scale, minimumPixelSize: q.model.minimumPixelSize };
        });
        const expected = 90 * Math.max(1, 1.2 / (width / height));
        if (Math.abs(row.range - expected) > 1e-6 || Math.abs(row.elevation - 42.5) > 1e-6 || Math.abs(row.local[1]) > 1e-6 || row.fov !== 100 || !row.hidden || row.handoff.positionError > 1e-6 || row.handoff.directionError > 1e-7 || row.handoff.upError > 1e-7 || row.handoff.fovError !== 0) throw Error('Endpoint: ' + JSON.stringify(row));
        report.entries.push({ source, name, ...row });
        await page.getByRole('button', { name: 'Back to Earth View', exact: true }).evaluate(b => b.click());
        await page.evaluate(() => { const q = globalThis.__qa; q.override = 1; q.tick(); q.viewer.render(); });
      }
      for (const name of departurePoses) {
        await page.evaluate(() => globalThis.__qa.setEarth('canonical'));
        await page.getByRole('button', { name: 'Inspect ISS', exact: true }).evaluate(b => b.click());
        await page.evaluate(name => {
          const q = globalThis.__qa, H = q.helpers, v = q.viewer; q.override = name.startsWith('back') ? +name.slice(4) / 100 : 1; q.tick(); v.render();
          const p = H.Cartesian3.clone(v.camera.position);
          if (name === 'close-module') H.Cartesian3.multiplyByScalar(p, .65, p);
          if (name === 'max-zoom') H.Cartesian3.multiplyByScalar(p, 2000 / H.Cartesian3.magnitude(p), p);
          if (name === 'orbit90') { p.y = p.x; p.x = 0; }
          if (name === 'orbit180') p.x = -p.x;
          if (!name.startsWith('back')) { v.camera.lookAtTransform(q.frame, p); q.tick(); v.render(); q.override = 0; q.tick(); }
        }, name);
        await page.getByRole('button', { name: 'Back to Earth View', exact: true }).evaluate(b => b.click());
        const frames = [];
        const fractions = process.env.MISSION1_QA_RASTER_ONLY ? [.705,.707,.72,.73,.75,.78,1] : [...Array.from({ length: 14 }, (_, i) => i * .05), ...Array.from({ length: 151 }, (_, i) => .66 + i * .001), .85, .9, .95, 1];
        for (const [i, progress] of fractions.entries()) {
          const row = await page.evaluate(({ i, progress }) => { const q = globalThis.__qa; q.override = progress; q.tick(); q.viewer.render(); return q.snapshot(i, progress); }, { i, progress });
          frames.push(row);
          if (row.trajectoryReveal > 0 && progress < 1 && !process.env.MISSION1_QA_ALLOW_BAD) for (const t of row.trails) {
            if (!t.vertexIdentity || t.maskError > 1e-5) throw Error('Frame/geometry mismatch: ' + JSON.stringify(row));
            if ((t.safeSamples>0&&!t.firstPerceptible)||(t.firstPerceptible&&(t.firstPerceptible.clearance<=0||t.firstPerceptible.maskDistance<=0))) throw Error('Clearance: ' + JSON.stringify(row));
          }
          if (name === 'canonical' && ((progress >= .705 && progress <= .724) || [0, .697, .73, .75, .78, 1].some(p => Math.abs(p - progress) < 1e-8)))
            await page.screenshot({ path: path.join(out, `${label}-${source}-${name}-${Math.round(progress * 1000)}.jpg`), type: 'jpeg', quality: 85 });
          if (name === 'canonical' && process.env.MISSION1_QA_RASTER && [.705,.707,.72,.73,.75,.78].some(p => Math.abs(p - progress) < 1e-8)) {
            const prefix = path.join(out, `${label}-${source}-${Math.round(progress * 1000)}`);
            await page.evaluate(() => { const q = globalThis.__qa; q.hideModel = q.viewer.scene.preRender.addEventListener(() => q.model.show = false); for(let i=0;i<3;i++)q.viewer.render(); });
            await page.screenshot({path:prefix+'-on.png'});
            await page.evaluate(() => { const q = globalThis.__qa; q.hideTrails = q.viewer.scene.preRender.addEventListener(() => { for (const t of q.trails.trails) for (const l of t.layers) l.primitive.show = false; }); q.viewer.render(); q.viewer.render(); });
            await page.screenshot({path:prefix+'-off.png'});
            await page.evaluate(() => { const q = globalThis.__qa; q.hideTrails(); q.hideModel(); q.tick(); q.viewer.render(); });
          }
        }
        const restore = await page.evaluate(() => { const q = globalThis.__qa, H = q.helpers; return { position: H.Cartesian3.distance(q.viewer.camera.positionWC, q.saved.position), fov: q.viewer.camera.frustum.fov - q.saved.fov }; });
        if (restore.position !== 0 || restore.fov !== 0) throw Error('Earth restoration');
        report.exits.push({ source, name, frames, restore });
        fs.writeFileSync(path.join(out, label + '-audit.json'), JSON.stringify(report));
        console.log(label, source, name, frames.length, 'clear');
      }
    }
    fs.writeFileSync(path.join(out, label + '-audit.json'), JSON.stringify(report));
    if (report.errors.length) throw Error(JSON.stringify(report.errors));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
