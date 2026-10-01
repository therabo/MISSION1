// QA-only fixed progress samples in a disposable instrumented frontend.
// Images are actual scene renders at explicit progress/UTC, not live observations.
const fs=require('fs'),path=require('path');
const repo=process.env.MISSION1_REPO_ROOT||path.resolve(__dirname,'../../../..');
const out=process.env.MISSION1_EVIDENCE_DIR||'/tmp/mission1-perceptual-snapshots';fs.mkdirSync(out,{recursive:true});
const {chromium}=require(process.env.MISSION1_PLAYWRIGHT_MODULE||'playwright');
const port=+process.argv[2]||5173,label=process.argv[3]||'development';
const percentages=[0,5,10,15,20,30,40,50,60,70,80,85,90,95,100];
(async()=>{const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});
try{
 const width=Number(process.env.MISSION1_QA_WIDTH||1280),height=Number(process.env.MISSION1_QA_HEIGHT||720);
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2});
 for(const [api,file]of [['samples','real-samples.json'],['comparison','real-comparison.json']])await context.route('**/api/iss/orbit/'+api,r=>r.fulfill({json:JSON.parse(fs.readFileSync(repo+'/docs/frontend/inspection-orientation-review/'+file))}));
 await context.route('https://gibs.earthdata.nasa.gov/**',r=>r.abort('failed'));
 const page=await context.newPage(),report={label,viewport:[width,height],dpr:2,samples:[],errors:[]};page.on('pageerror',e=>report.errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+port);await page.waitForFunction(()=>globalThis.__qa?.model?.ready,null,{timeout:60000});
 for(const source of ['PRIMARY_GP_TLE','NASA_OEM']){
  await page.getByRole('button',{name:source==='NASA_OEM'?'NASA OEM':'MISSION1 GP/TLE',exact:true}).click();
  await page.evaluate(()=>{const q=globalThis.__qa,H=q.helpers,v=q.viewer;v.clock.shouldAnimate=false;v.clock.currentTime=H.JulianDate.fromIso8601('2026-09-30T15:45:59.975908Z');v.camera.setView({destination:new H.Cartesian3(-9412786.358621413,-21163227.169227634,-3167995.3206285993),orientation:{direction:new H.Cartesian3(0.40258878698283174,0.9051600270198104,0.13640965538109276),up:new H.Cartesian3(-0.055435177167269443,-0.12463761556457154,0.9906525152235831)}});q.override=0;});
  await page.waitForTimeout(1500);
  for(const kind of ['entry','exit']){
   if(kind==='exit'){
    // Discard derivatives from manually stepped captures. Establish the real
    // 1x Inspection tracking derivative before freezing the return start UTC.
    await page.evaluate(()=>{globalThis.__qa.viewer.clock.shouldAnimate=true;});
    await page.waitForTimeout(350);
    await page.evaluate(()=>{globalThis.__qa.viewer.clock.shouldAnimate=false;});
   }
   await page.getByRole('button',{name:kind==='entry'?'Inspect ISS':'Back to Earth View',exact:true}).evaluate(b=>b.click());
   const start=await page.evaluate(()=>{const q=globalThis.__qa;return {duration:q.flight.duration,utc:q.helpers.JulianDate.toIso8601(q.viewer.clock.currentTime)};});
   for(const percent of percentages){
    const snapshot=await page.evaluate(({percent,start})=>{const q=globalThis.__qa,H=q.helpers,v=q.viewer;q.override=percent/100;v.clock.currentTime=H.JulianDate.addSeconds(H.JulianDate.fromIso8601(start.utc),start.duration*percent/100,new H.JulianDate());q.tick();v.useDefaultRenderLoop=false;v.render();v.render();const c=v.camera,p=q.positionAt(v.clock.currentTime,new H.Cartesian3()),display=q.model.boundingSphere.center;const vec=a=>[a.x,a.y,a.z];const s=H.SceneTransforms.worldToWindowCoordinates(v.scene,display);return {percent,range:H.Cartesian3.distance(c.positionWC,p),displayRange:H.Cartesian3.distance(c.positionWC,display),lift:H.Cartesian3.distance(display,p),fov:c.frustum.fov,position:vec(c.positionWC),direction:vec(c.directionWC),up:vec(c.upWC),screen:s&&[s.x,s.y],hull:H.projectedModelFootprint(v.scene,q.model),utc:H.JulianDate.toIso8601(v.clock.currentTime)};},{percent,start});
    const filename=`${label}-${source}-${kind}-${String(percent).padStart(3,'0')}`;
    await page.screenshot({path:out+'/'+filename+'-model.png',animations:'disabled'});
    await page.evaluate(()=>{const q=globalThis.__qa;q.hide=q.viewer.scene.preRender.addEventListener(()=>q.model.show=false);q.viewer.render();q.viewer.render();});
    await page.screenshot({path:out+'/'+filename+'-background.png',animations:'disabled'});
    await page.evaluate(()=>{const q=globalThis.__qa;q.hide();q.model.show=true;q.viewer.render();});
    report.samples.push({source,kind,filename,...snapshot});
   }
   await page.evaluate(()=>{globalThis.__qa.override=0;globalThis.__qa.viewer.useDefaultRenderLoop=true;});
   console.log(label,source,kind);
  }
  await page.evaluate(()=>{globalThis.__qa.override=undefined;});
 }
 fs.writeFileSync(out+'/'+label+'-samples.json',JSON.stringify(report,null,2));if(report.errors.length)throw Error(JSON.stringify(report.errors));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
