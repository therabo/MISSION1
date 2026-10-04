// WebGL instrumentation stays in the QA browser; the application exposes no QA API.
const fs = require('fs'), path = require('path');
const { chromium } = require(process.env.MISSION1_PLAYWRIGHT_MODULE || 'playwright');
const { viewer } = require('../../occlusion-aware-workspace-centering/scripts/browser-utils.cjs');
const out = process.env.MISSION1_EVIDENCE || path.resolve(__dirname, '../evidence/after/gpu');
fs.mkdirSync(out, { recursive: true });
let active;
(async () => {
  const browser = active = await chromium.launch({ headless: false, args: ['--use-angle=metal'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    const textures = window.__textureAudit = [], renderbuffers = window.__renderbufferAudit = [];
    const records = new WeakMap(), buffers = new WeakMap(), wrappedOwners = new WeakMap();
    // WebGL2 inherits several WebGL1/base methods. Instrument each actual
    // owner once and share object records across overloads, avoiding doubled
    // draw counts and parameter-only duplicates for the same GPU texture.
    const ownerFor = (proto, method) => {
      let owner = proto;
      while (owner && !Object.prototype.hasOwnProperty.call(owner, method)) owner = Object.getPrototypeOf(owner);
      if (!owner) return null;
      let methods = wrappedOwners.get(owner);
      if (!methods) wrappedOwners.set(owner, methods = new Set());
      if (methods.has(method)) return null;
      methods.add(method);
      return owner;
    };
    window.__drawAudit = { calls: 0, elements: 0, contextLoss: 0 };
    document.addEventListener('webglcontextlost', () => __drawAudit.contextLoss++, true);
    for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      const binding = (g, target) => target === g.TEXTURE_2D ? g.TEXTURE_BINDING_2D : g.TEXTURE_BINDING_CUBE_MAP;
      function record(g, target) {
        const texture = g.getParameter(binding(g, target)); if (!texture) return null;
        if (!records.has(texture)) {
          const row = { id: textures.length, target: target === g.TEXTURE_2D ? '2D' : 'cube', live: true, levels: {}, parameters: {}, mips: false };
          records.set(texture, row); textures.push(row);
        }
        return records.get(texture);
      }
      for (const method of ['texImage2D', 'texParameteri', 'texParameterf', 'generateMipmap', 'deleteTexture', 'drawElements', 'drawArrays']) {
        const owner = ownerFor(proto, method); if (!owner) continue;
        const original = owner[method];
        owner[method] = function (...args) {
          if (method === 'deleteTexture') { const row = records.get(args[0]); if (row) row.live = false; }
          else if (method.startsWith('draw')) { __drawAudit.calls++; __drawAudit.elements += method === 'drawElements' ? args[1] : args[2]; }
          else {
            const row = record(this, args[0]);
            if (row && method === 'texImage2D') {
              const source = args.at(-1);
              row.levels[`${args[0]}:${args[1]}`] = { width: args.length === 6 ? source?.width : args[3], height: args.length === 6 ? source?.height : args[4], internalFormat: args[2] };
              if (source?.src) row.source = source.src;
            } else if (row && method === 'generateMipmap') row.mips = true;
            else if (row) row.parameters[args[1]] = args[2];
          }
          return original.apply(this, args);
        };
      }
      for (const method of ['renderbufferStorage', 'renderbufferStorageMultisample', 'deleteRenderbuffer']) {
        const owner = ownerFor(proto, method); if (!owner) continue;
        const original = owner[method];
        owner[method] = function (...args) {
          const rb = method === 'deleteRenderbuffer' ? args[0] : this.getParameter(this.RENDERBUFFER_BINDING);
          if (rb) {
            if (!buffers.has(rb)) { const row = { id: renderbuffers.length }; buffers.set(rb, row); renderbuffers.push(row); }
            const row = buffers.get(rb);
            if (method === 'deleteRenderbuffer') row.live = false;
            else Object.assign(row, { live: true, samples: method.includes('Multisample') ? args[1] : 1, format: args.at(-3), width: args.at(-2), height: args.at(-1) });
          }
          return original.apply(this, args);
        };
      }
    }
  });
  const page = await context.newPage(); await page.bringToFront(); const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(process.env.MISSION1_URL || 'http://127.0.0.1:4175');
  await page.waitForFunction(() => [...document.querySelectorAll('button')].find(b => b.textContent === 'Inspect ISS')?.disabled === false, null, { timeout: 120000 });
  await page.evaluate(`window.__v=(${viewer.toString()})();`); await page.waitForTimeout(5000);
  const rows = [];
  for (const mode of ['overview', 'inspection', 'returned']) {
    if (mode === 'inspection') { await page.getByRole('button', { name: 'Inspect ISS', exact: true }).click(); await page.getByText('Drag to orbit the ISS · Scroll to zoom', { exact: true }).waitFor({ timeout: 30000 }); }
    if (mode === 'returned') { await page.getByRole('button', { name: 'Back to Earth View', exact: true }).click(); await page.waitForFunction(() => [...document.querySelectorAll('button')].find(b => b.textContent === 'Inspect ISS')?.disabled === false); }
    await page.waitForTimeout(1500);
    const row = await page.evaluate(async () => {
      const v = __v, g = v.canvas.getContext('webgl2'), anisotropy = g.getExtension('EXT_texture_filter_anisotropic'), timer = g.getExtension('EXT_disjoint_timer_query_webgl2');
      const gpu = [], queries = [], cpu = [], drawCalls = [], intervals = [], before = __drawAudit.calls;
      const original = v.scene.render;
      v.scene.render = function (...args) { const t = performance.now(); try { return original.apply(this, args); } finally { cpu.push(performance.now() - t); } };
      let query = null, previous = null, lastDraws = before;
      const pre = v.scene.preRender.addEventListener(() => { if (timer) { query = g.createQuery(); g.beginQuery(timer.TIME_ELAPSED_EXT, query); } });
      const post = v.scene.postRender.addEventListener(() => {
        if (query) { g.endQuery(timer.TIME_ELAPSED_EXT); queries.push(query); query = null; }
        const now = performance.now(); if (previous !== null) intervals.push(now - previous); previous = now;
        drawCalls.push(__drawAudit.calls - lastDraws); lastDraws = __drawAudit.calls;
        // No synchronous GPU readback: poll completed queries at least 8 frames later.
        while (queries.length > 8 && g.getQueryParameter(queries[0], g.QUERY_RESULT_AVAILABLE)) {
          const q = queries.shift(); if (!g.getParameter(timer.GPU_DISJOINT_EXT)) gpu.push(g.getQueryParameter(q, g.QUERY_RESULT) / 1e6); g.deleteQuery(q);
        }
      });
      await new Promise(r => setTimeout(r, 5000)); pre(); post(); v.scene.render = original;
      queries.forEach(q => g.deleteQuery(q));
      return { cpu, gpu, intervals, drawCalls, gpuTimerAvailable: !!timer, context: g.getContextAttributes(), defaultSamples: g.getParameter(g.SAMPLES), maximumAnisotropy: anisotropy && g.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT), maximumTexture: g.getParameter(g.MAX_TEXTURE_SIZE), maximumCube: g.getParameter(g.MAX_CUBE_MAP_TEXTURE_SIZE), canvas: [v.canvas.width, v.canvas.height], sceneMsaa: v.scene.msaaSamples, textures: __textureAudit, renderbuffers: __renderbufferAudit, contextLoss: __drawAudit.contextLoss, heap: performance.memory && { used: performance.memory.usedJSHeapSize, total: performance.memory.totalJSHeapSize }, tileCacheSize: v.scene.globe.tileCacheSize, screenSpaceError: v.scene.globe.maximumScreenSpaceError, tileQueueSettled: v.scene.globe.tilesLoaded };
    });
    rows.push({ mode, ...row }); fs.writeFileSync(path.join(out, 'gpu-audit.json'), JSON.stringify({ rows, errors }, null, 2));
    console.log(JSON.stringify({ mode, defaultSamples: row.defaultSamples, sceneMsaa: row.sceneMsaa, textures: row.textures.length, liveTextures: row.textures.filter(t => t.live).length, liveRenderbuffers: row.renderbuffers.filter(r => r.live).length, timerSamples: row.gpu.length, contextLoss: row.contextLoss }));
  }
  await browser.close();
})().catch(async e => { console.error(e); await active?.close(); process.exitCode = 1; });
