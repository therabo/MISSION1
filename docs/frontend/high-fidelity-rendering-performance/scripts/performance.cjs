const fs = require('fs');
const { chromium } = require(process.env.MISSION1_PLAYWRIGHT_MODULE || 'playwright');
const {viewer, observe} = require('../../occlusion-aware-workspace-centering/scripts/browser-utils.cjs');
const out = process.env.MISSION1_EVIDENCE || require('path').resolve(__dirname,'../evidence/after/dpr'+(process.env.MISSION1_DPR||'1'));
let activeBrowser;
const dpr = Number(process.env.MISSION1_DPR || 1);
const width = Number(process.env.MISSION1_WIDTH || 1440);
const height = Number(process.env.MISSION1_HEIGHT || 900);
fs.mkdirSync(out, {recursive:true});
function stats(values) {
 const a=values.slice().sort((x,y)=>x-y),q=p=>a[Math.min(a.length-1,Math.floor(a.length*p))];
 let lowStart=null,maxLow=0,t=0;
 for(let i=0;i<values.length;i++){t+=values[i];if(values[i]>1000/55){if(lowStart===null)lowStart=t-values[i];maxLow=Math.max(maxLow,t-lowStart);}else lowStart=null;}
 return {count:a.length,medianMs:q(.5),p95Ms:q(.95),p99Ms:q(.99),medianFps:1000/q(.5),p99EquivalentFps:1000/q(.99),onePercentLowFps:1000/(a.slice(-Math.max(1,Math.ceil(a.length*.01))).reduce((x,y)=>x+y,0)/Math.max(1,Math.ceil(a.length*.01))),over20:a.filter(v=>v>20).length,over33:a.filter(v=>v>33.3).length,over50:a.filter(v=>v>50).length,maxConsecutiveBelow55Ms:maxLow};
}
async function measure(p,ms) {
 return p.evaluate(async ms=>{
  const v=window.__v,times=[],longTasks=[],mutations=[];
  const observer=new PerformanceObserver(l=>longTasks.push(...l.getEntries().map(e=>({start:e.startTime,duration:e.duration}))));observer.observe({type:'longtask',buffered:false});
  const dom=new MutationObserver(l=>mutations.push({at:performance.now(),count:l.length}));dom.observe(document.querySelector('.app-shell'),{subtree:true,childList:true,characterData:true,attributes:true});
  const start=performance.now(),remove=v.scene.postRender.addEventListener(()=>times.push(performance.now()));
  await new Promise(r=>setTimeout(r,ms));remove();observer.disconnect();dom.disconnect();
  const g=v.canvas.getContext('webgl2'),ext=g.getExtension('WEBGL_debug_renderer_info');
  return {intervals:times.slice(1).map((x,i)=>x-times[i]),durationMs:performance.now()-start,longTasks,domMutations:mutations,visibility:document.visibilityState,focus:document.hasFocus(),dpr:devicePixelRatio,canvas:[v.canvas.width,v.canvas.height],viewport:[innerWidth,innerHeight],resolutionScale:v.resolutionScale,msaa:v.scene.msaaSamples,hdr:v.scene.highDynamicRange,sceneClockAnimating:v.clock.shouldAnimate,globeTilesLoaded:v.scene.globe.tilesLoaded,servedBundle:performance.getEntriesByType('resource').filter(r=>r.name.includes('/assets/index-')&&r.name.endsWith('.js')).map(r=>r.name),heap:performance.memory&&{used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize},gpu:ext&&g.getParameter(ext.UNMASKED_RENDERER_WEBGL),maxTexture:g.getParameter(g.MAX_TEXTURE_SIZE),maxCube:g.getParameter(g.MAX_CUBE_MAP_TEXTURE_SIZE),maxSamples:g.getParameter(g.MAX_SAMPLES),layers:Array.from({length:v.imageryLayers.length},(_,i)=>{const l=v.imageryLayers.get(i);return {url:l.imageryProvider.url,maximumLevel:l.imageryProvider.maximumLevel,tileWidth:l.imageryProvider.tileWidth,tileHeight:l.imageryProvider.tileHeight,alpha:l.alpha,dayAlpha:l.dayAlpha,nightAlpha:l.nightAlpha,brightness:l.brightness}})};
 },ms);
}
(async()=>{
 const b=activeBrowser=await chromium.launch({headless:false,args:['--use-angle=metal','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
 const context=await b.newContext({viewport:{width,height},deviceScaleFactor:dpr});
 if(!process.env.MISSION1_LIVE) await context.route('**/api/iss/orbit/samples', r=>r.fulfill({json:JSON.parse(fs.readFileSync(require('path').resolve(__dirname,'../evidence/real-samples.json')))}));
 if(!process.env.MISSION1_LIVE) await context.route('**/api/iss/orbit/comparison', r=>r.fulfill({json:JSON.parse(fs.readFileSync(require('path').resolve(__dirname,'../evidence/real-comparison.json')))}));
 const p=await context.newPage();await p.bringToFront();
 const cadence=await p.evaluate(async()=>{const a=[];await new Promise(r=>{const tick=t=>{a.push(t);if(a.length<181)requestAnimationFrame(tick);else r();};requestAnimationFrame(tick);});return a.slice(1).map((x,i)=>x-a[i]);});
 fs.writeFileSync(`${out}/cadence.json`,JSON.stringify({browser:b.version(),headless:false,dpr,...stats(cadence),intervals:cadence},null,2));
 const errors=[],requests=[];p.on('pageerror',e=>errors.push(String(e)));p.on('requestfailed',r=>requests.push({url:r.url(),error:r.failure()?.errorText}));
 await p.goto(process.env.MISSION1_URL || 'http://127.0.0.1:4175');
 await p.waitForFunction(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Inspect ISS')?.disabled===false,null,{timeout:120000});
 await p.evaluate(`window.__v=(${viewer.toString()})();window.__v.clock.shouldAnimate=${process.env.MISSION1_LIVE ? 'true':'false'};`);
 if(!process.env.MISSION1_LIVE){
 const reference=JSON.parse(fs.readFileSync(process.env.MISSION1_REFERENCE || require('path').resolve(__dirname, '../evidence/before/initial-fixture-dpr'+dpr+'.json')));
 await p.evaluate(ref=>{const v=__v,C=v.camera.position.constructor;v.clock.currentTime=v.clock.currentTime.constructor.fromIso8601(ref.time);v.camera.setView({destination:new C(...ref.position),orientation:{direction:new C(...ref.direction),up:new C(...ref.up)}});},reference);
 }
 const fixture=await p.evaluate(observe);fs.writeFileSync(`${out}/initial-fixture.json`,JSON.stringify(fixture,null,2));
 const rows=[];
 async function run(name){await p.bringToFront();await p.waitForTimeout(10000);if(name==='crew-open'&&!await p.locator('.crew-summary').isVisible())throw new Error('Crew must be visibly open before measurement');const r=await measure(p,30000);if(name==='crew-open'&&!await p.locator('.crew-summary').isVisible())throw new Error('Crew must remain visibly open through measurement');rows.push({name,...stats(r.intervals),...r,geometry:await p.evaluate(observe)});fs.writeFileSync(`${out}/performance.json`,JSON.stringify({rows,errors,requestFailures:requests},null,2));await p.screenshot({path:`${out}/${name}.png`});console.log(JSON.stringify({name,...stats(r.intervals),canvas:r.canvas,visibility:r.visibility,focus:r.focus,layers:r.layers}));}
 if(!['replay','crew'].includes(process.env.MISSION1_START)){
 await run('overview-gp');
 if(process.env.MISSION1_QUICK){await b.close();return;}
 if(process.env.MISSION1_SECONDARY){
 await p.getByRole('button',{name:'Inspect ISS',exact:true}).click();await p.getByText('Drag to orbit the ISS · Scroll to zoom',{exact:true}).waitFor({timeout:30000});await run('inspection-gp');await b.close();return;
 }
 await p.getByRole('button',{name:'NASA OEM',exact:true}).click();await run('overview-oem');
 await p.getByRole('button',{name:'Inspect ISS',exact:true}).click();await p.getByText('Drag to orbit the ISS · Scroll to zoom',{exact:true}).waitFor({timeout:30000});await run('inspection-oem');
 await p.getByRole('button',{name:'Back to Earth View',exact:true}).click();await p.waitForFunction(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Inspect ISS')?.disabled===false);await p.getByRole('button',{name:'MISSION1 GP/TLE',exact:true}).click();
 await p.getByRole('button',{name:'Inspect ISS',exact:true}).click();await p.getByText('Drag to orbit the ISS · Scroll to zoom',{exact:true}).waitFor({timeout:30000});await run('inspection-gp');
 await p.getByRole('button',{name:'Back to Earth View',exact:true}).click();await p.waitForFunction(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Inspect ISS')?.disabled===false);
 await p.waitForTimeout(850);await p.getByRole('button',{name:'ISS Crew',exact:true}).click();await p.locator('.crew-summary').waitFor();await run('crew-open');await p.getByRole('button',{name:'Close crew panel',exact:true}).click();
 }
 if(process.env.MISSION1_START==='crew'){await p.getByRole('button',{name:'ISS Crew',exact:true}).click();await p.locator('.crew-summary').waitFor();await run('crew-open');await p.getByRole('button',{name:'Close crew panel',exact:true}).click();}
 await p.getByRole('button',{name:'Replay history',exact:true}).click();await p.getByLabel('Replay UTC instant',{exact:true}).fill('2026-10-02T23:00');await p.waitForFunction(()=>document.querySelector('.replay-orbit .eyebrow')?.textContent.includes('2026-10-02T23:00:00')&&!document.body.textContent.includes('Loading historical state'));await run('replay');
 await b.close();
})().catch(async e=>{console.error(e);await activeBrowser?.close();process.exitCode=1;});
