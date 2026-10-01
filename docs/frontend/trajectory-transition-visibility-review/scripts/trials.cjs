// Actual browser opacity trials on the frozen baseline; no production changes.
const fs=require('fs'),path=require('path'),repo=path.resolve(__dirname,'../../../..'),out=process.env.MISSION1_EVIDENCE_DIR;
const {chromium}=require(process.env.MISSION1_PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});try{
const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:2});
for(const [api,file]of [['samples','real-samples.json'],['comparison','real-comparison.json']])await context.route('**/api/iss/orbit/'+api,r=>r.fulfill({json:JSON.parse(fs.readFileSync(repo+'/docs/frontend/inspection-orientation-review/'+file))}));
await context.route('https://gibs.earthdata.nasa.gov/**',r=>r.abort('failed'));
const page=await context.newPage(),report={trials:[],errors:[]};page.on('pageerror',e=>report.errors.push(String(e)));
await page.goto('http://127.0.0.1:'+process.argv[2]);await page.waitForFunction(()=>globalThis.__qa?.model?.ready,null,{timeout:60000});await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Inspect ISS')?.disabled===false);
await page.evaluate(()=>{const q=globalThis.__qa,H=q.helpers,v=q.viewer;v.clock.shouldAnimate=false;v.clock.currentTime=H.JulianDate.fromIso8601('2026-09-30T15:45:59.975908Z');v.camera.setView({destination:new H.Cartesian3(-9412786.358621413,-21163227.169227634,-3167995.3206285993),orientation:{direction:new H.Cartesian3(.40258878698283174,.9051600270198104,.13640965538109276),up:new H.Cartesian3(-.055435177167269443,-.12463761556457154,.9906525152235831)}});q.override=0;});await page.waitForTimeout(1000);
await page.getByRole('button',{name:'Inspect ISS',exact:true}).click();await page.evaluate(()=>{const q=globalThis.__qa;q.override=1;q.tick();});await page.waitForTimeout(350);await page.evaluate(()=>{globalThis.__qa.override=0;});
await page.getByRole('button',{name:'Back to Earth View',exact:true}).click();
await page.evaluate(()=>{const q=globalThis.__qa;q.viewer.useDefaultRenderLoop=false;q.removeTrial=q.viewer.scene.preRender.addEventListener(()=>{if(!q.trial)return;const h=q.helpers,r=h.Cartesian3.distance(q.viewer.camera.positionWC,q.model.boundingSphere.center),[a,b]=q.trial;const x=Math.max(0,Math.min(1,Math.log(r/a)/Math.log(b/a)));q.trialFactor=x*x*x*(10+x*(-15+6*x));for(const t of q.trails.trails)for(const l of t.layers)l.material.uniforms.maximumAlpha*=q.trialFactor;});});
for(const window of [[2000,20000],[10000,1000000],[100000,10000000]])for(const fraction of [.6,.65,.7,.725,.75,.8,.9]){
const row=await page.evaluate(({window,fraction})=>{const q=globalThis.__qa;q.trial=window;q.override=fraction;q.tick();q.viewer.render();return {range:q.helpers.Cartesian3.distance(q.viewer.camera.positionWC,q.model.boundingSphere.center),factor:q.trialFactor,mode:q.mode};},{window,fraction});
const filename=`window-${window.join('-')}-${Math.round(1000*fraction)}.jpg`;await page.screenshot({path:out+'/'+filename,type:'jpeg',quality:80});report.trials.push({window,fraction,filename,...row});}
fs.writeFileSync(out+'/windows.json',JSON.stringify(report,null,2));console.log('trials',report.trials.length,report.errors);if(report.errors.length)throw Error(JSON.stringify(report.errors));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
