// QA-only passive instrumentation. No camera/clock writes, no input simulation.
(() => {
  const state = new URL(location.href).searchParams.get('qaState');
  const report = {kind: state ? 'EXPLICIT_TEST_FIXTURE' : 'REAL_BACKEND', state, requests: [], transitions: [], latency: [], samples: {}, viewersCreated: 0};
  let viewer, output, latestClick = null, paintStart = 0, lastFrame = 0, lastScroll = -Infinity;
  const originalFetch = window.fetch;
  window.fetch = async function(input, options) {
    const crew = typeof input === 'string' && input.startsWith('/api/iss/crew');
    const started = performance.now();
    const row = crew ? {path: input, started, outcome: 'pending'} : null;
    if (row) report.requests.push(row);
    try {
      const result = await originalFetch.call(this, crew && state ? `${input}?crewQa=${state}` : input, options);
      if (row) Object.assign(row, {durationMs: performance.now() - started, status: result.status, outcome: 'completed'});
      return result;
    } catch(error) {
      if (row) Object.assign(row, {durationMs: performance.now() - started, outcome: error.name});
      throw error;
    }
  };
  const mode = () => !document.getElementById('crew-panel') ? 'closed' : performance.now()-lastScroll<500 ? 'scrolling' : document.querySelector('.crew-detail') ? 'detail' : 'list';
  document.addEventListener('scroll', event => { if(event.target.classList?.contains('crew-panel-content')) lastScroll=performance.now(); },true);
  const pose = () => viewer && {
    position: Object.values(viewer.camera.positionWC), direction: Object.values(viewer.camera.directionWC), up: Object.values(viewer.camera.upWC),
    transform: Array.from({length:16}, (_,i) => viewer.camera.transform[i]), fov: viewer.camera.frustum.fov,
    epoch: {dayNumber:viewer.clock.currentTime.dayNumber,secondsOfDay:viewer.clock.currentTime.secondsOfDay},
    source: document.querySelector('.source-options [aria-pressed="true"]')?.textContent.trim(),
    multiplier: viewer.clock.multiplier, animate: viewer.clock.shouldAnimate,
  };
  function samples(key) { return report.samples[key] ??= {intervals: [], renderMs: []}; }
  document.addEventListener('crew-qa-viewer', event => {
    viewer = event.detail; report.viewersCreated++;
    viewer.scene.preRender.addEventListener(() => { paintStart = performance.now(); });
    viewer.scene.postRender.addEventListener(() => {
      const now = performance.now(), bucket = samples(mode());
      if (lastFrame && now - lastFrame < 1000) { bucket.intervals.push(now-lastFrame); if(bucket.intervals.length>1800) bucket.intervals.shift(); }
      bucket.renderMs.push(now-paintStart); if(bucket.renderMs.length>1800) bucket.renderMs.shift(); lastFrame=now;
    });
  });
  document.addEventListener('click', event => {
    const button = event.target.closest?.('button'); if(!button) return;
    if(button.id === 'crew-launcher' || button.getAttribute('aria-label') === 'Close crew panel') {
      const row = {action:button.id || 'close',before:pose()}; report.transitions.push(row);
      requestAnimationFrame(() => requestAnimationFrame(() => {row.after=pose();}));
    }
    if(button.id === 'crew-launcher' || button.dataset.memberId) {
      latestClick={kind:button.dataset.memberId?'detail':'list',started:performance.now(),firstDomMs:null,dataDomMs:null};
      report.latency.push(latestClick);
    }
  },true);
  document.addEventListener('DOMContentLoaded', () => {
    output=document.createElement('output'); output.id='crew-qa-report'; output.hidden=true; document.body.append(output);
    if(state) { const badge=document.createElement('div'); badge.textContent=`QA FIXTURE · ${state}`; badge.style.cssText='position:fixed;top:0;left:40%;z-index:20;background:#633;color:white;font:12px sans-serif;padding:4px';document.body.append(badge); }
    new MutationObserver(() => {
      if(!latestClick) return;
      const exists=latestClick.kind==='list'?document.querySelector('.crew-panel'):document.querySelector('.crew-detail');
      const data=latestClick.kind==='list'?document.querySelector('.crew-summary'):document.querySelector('.crew-profile');
      if(exists&&latestClick.firstDomMs===null) latestClick.firstDomMs=performance.now()-latestClick.started;
      if(data&&latestClick.dataDomMs===null) latestClick.dataDomMs=performance.now()-latestClick.started;
    }).observe(document.getElementById('root'),{childList:true,subtree:true});
    const stats = values => {const sorted=[...values].sort((a,b)=>a-b);return {n:sorted.length,median:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)]};};
    setInterval(() => {
      const summary=Object.fromEntries(Object.entries(report.samples).map(([key,value])=>[key,{intervalMs:stats(value.intervals),renderMs:stats(value.renderMs)}]));
      output.textContent=JSON.stringify({...report,samples:summary,pose:pose(),dom:{panels:document.querySelectorAll('#crew-panel').length,details:document.querySelectorAll('.crew-detail').length,portraits:document.querySelectorAll('.crew-portrait img').length,canvases:document.querySelectorAll('canvas').length,nodes:document.getElementsByTagName('*').length},listeners:viewer?{preRender:viewer.scene.preRender.numberOfListeners,postRender:viewer.scene.postRender.numberOfListeners,clock:viewer.clock.onTick.numberOfListeners}:null,memory:performance.memory?{used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize}:null});
    },1000);
  });
})();
