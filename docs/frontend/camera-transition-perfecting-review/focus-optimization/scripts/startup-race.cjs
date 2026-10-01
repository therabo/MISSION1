// Deliberately deliver the celestial idle task after a cached/local GLB is ready.
const fs=require('fs'),{chromium}=require(process.env.MISSION1_PLAYWRIGHT_MODULE||'playwright');
const root=process.env.MISSION1_REPO_ROOT||'/Users/daniel/Desktop/MISSION1';
const out=process.env.MISSION1_EVIDENCE_DIR||root+'/docs/frontend/camera-transition-perfecting-review/focus-optimization';
(async()=>{const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});try{
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:2});
 await context.addInitScript(()=>{globalThis.requestIdleCallback=callback=>setTimeout(()=>callback({didTimeout:true,timeRemaining:()=>0}),6000);globalThis.cancelIdleCallback=clearTimeout;});
 for(const [api,file]of [['samples','real-samples.json'],['comparison','real-comparison.json']])await context.route('**/api/iss/orbit/'+api,r=>r.fulfill({json:JSON.parse(fs.readFileSync(root+'/docs/frontend/inspection-orientation-review/'+file))}));
 await context.route('https://gibs.earthdata.nasa.gov/**',r=>r.abort('failed'));
 const page=await context.newPage(),report={label:process.argv[3],errors:[]};page.on('pageerror',e=>report.errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+process.argv[2]);
 await page.waitForFunction(()=>globalThis.__qa?.model?.ready,null,{timeout:60000});
 report.beforeSky=await page.evaluate(()=>{const q=globalThis.__qa;q.normalWarmFrames=0;q.viewer.scene.postRender.addEventListener(()=>{if(q.skyReady&&q.warming)q.normalWarmFrames++;});return {modelReady:q.model.ready,skyReady:q.skyReady,warming:q.warming,inspectDisabled:Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Inspect ISS').disabled};});
 if(!report.beforeSky.modelReady||report.beforeSky.skyReady||!report.beforeSky.warming||!report.beforeSky.inspectDisabled)throw Error('Did not exercise delayed celestial preparation');
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Inspect ISS')?.disabled===false,{},{timeout:20000});
 report.enabled=await page.evaluate(()=>{const q=globalThis.__qa;return {skyReady:q.skyReady,warming:q.warming,normalWarmFrames:q.normalWarmFrames,skyWarmup:q.skyWarmup};});
 if(!report.enabled.skyReady||report.enabled.warming||report.enabled.normalWarmFrames<7)throw Error('Control enabled before eight genuine normal frames');
 await page.getByRole('button',{name:'Inspect ISS',exact:true}).click();await page.waitForFunction(()=>globalThis.__qa.mode==='ISS_INSPECTION',{},{timeout:20000});
 await page.getByRole('button',{name:'Back to Earth View',exact:true}).click();await page.waitForFunction(()=>globalThis.__qa.mode==='EARTH_OVERVIEW',{},{timeout:20000});
 if(report.errors.length)throw Error(JSON.stringify(report.errors));
 fs.writeFileSync(out+'/'+report.label+'-startup-race.json',JSON.stringify(report,null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
