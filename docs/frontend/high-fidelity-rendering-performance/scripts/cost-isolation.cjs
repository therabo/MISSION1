const fs=require('fs');
const {chromium}=require(process.env.MISSION1_PLAYWRIGHT_MODULE || 'playwright');
const {viewer,observe}=require('../../occlusion-aware-workspace-centering/scripts/browser-utils.cjs');
const out=process.env.MISSION1_EVIDENCE || require('path').resolve(__dirname,'../evidence/diagnostics/cost-recheck');fs.mkdirSync(out,{recursive:true});let active;
const stats=a=>{const s=a.slice().sort((x,y)=>x-y),q=p=>s[Math.floor(s.length*p)];return {count:s.length,median:q(.5),p95:q(.95),p99:q(.99),fps:1000/q(.5)}};
(async()=>{const b=active=await chromium.launch({headless:false,args:['--use-angle=metal']});const c=await b.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
 for(const endpoint of ['samples','comparison'])await c.route(`**/api/iss/orbit/${endpoint}`,r=>r.fulfill({json:JSON.parse(fs.readFileSync(require('path').resolve(__dirname,'../evidence/real-'+endpoint+'.json')))}));
 const p=await c.newPage();await p.bringToFront();await p.goto(process.env.MISSION1_URL || 'http://127.0.0.1:4185');await p.waitForFunction(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Inspect ISS')?.disabled===false,null,{timeout:120000});await p.evaluate(`window.__v=(${viewer.toString()})();window.__v.clock.shouldAnimate=false;`);
 const rows=[];
 for(const name of ['baseline','no-copy-stage','no-MSAA','no-ground-atmosphere','no-night','no-model','no-trajectory','no-stars','HDR','baseline-repeat']){
  await p.evaluate(name=>{const v=__v,s=v.scene;window.__saved??={msaa:s.msaaSamples,night:v.imageryLayers.get(2),sky:s.skyBox.show};const a=Array.from({length:s.postProcessStages.length},(_,i)=>s.postProcessStages.get(i)).find(x=>x.name==='mission1_inspection_antialiasing');a.enabled=name!=='no-copy-stage';s.msaaSamples=name==='no-MSAA'?1:__saved.msaa;s.globe.showGroundAtmosphere=name!=='no-ground-atmosphere';__saved.night.show=name!=='no-night';s.skyBox.show=name!=='no-stars';s.highDynamicRange=name==='HDR';
   window.__remove?.();window.__remove=s.preRender.addEventListener(()=>{for(let i=0;i<s.primitives.length;i++){const q=s.primitives.get(i);if(q.id?.includes?.('iss'))q.show=name!=='no-model';else if(q.appearance)q.show=name!=='no-trajectory';}});
  },name);
  await p.waitForTimeout(3000);
  const r=await p.evaluate(async()=>{const a=[],cpu=[],v=__v,s=v.scene,native=s.render;s.render=function(...args){const t=performance.now();try{return native.apply(this,args)}finally{cpu.push(performance.now()-t)}};const remove=s.postRender.addEventListener(()=>a.push(performance.now()));await new Promise(r=>setTimeout(r,8000));remove();s.render=native;const gl=v.canvas.getContext('webgl2');return {intervals:a.slice(1).map((x,i)=>x-a[i]),cpu,extensions:gl.getSupportedExtensions(),config:{tileCacheSize:s.globe.tileCacheSize,sse:s.globe.maximumScreenSpaceError,globeTilesLoaded:s.globe.tilesLoaded,msaa:s.msaaSamples,hdr:s.highDynamicRange},geometry:null}});
  rows.push({name,...stats(r.intervals),cpuStats:stats(r.cpu),...r,geometry:await p.evaluate(observe)});await p.screenshot({path:`${out}/${name}.png`});fs.writeFileSync(`${out}/costs.json`,JSON.stringify(rows,null,2));console.log(JSON.stringify({name,...stats(r.intervals),cpu:stats(r.cpu),config:r.config}));
 }
 await b.close();
})().catch(async e=>{console.error(e);await active?.close();process.exitCode=1});
