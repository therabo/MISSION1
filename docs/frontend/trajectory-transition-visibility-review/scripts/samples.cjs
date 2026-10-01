// Fixed geometry/UTC diagnostic in disposable archives; real recorded API fixtures.
const fs=require('fs'),path=require('path');
const repo=path.resolve(__dirname,'../../../..'),out=process.env.MISSION1_EVIDENCE_DIR;
if(!out)throw Error('Set MISSION1_EVIDENCE_DIR to an evidence directory');fs.mkdirSync(out,{recursive:true});
const {chromium}=require(process.env.MISSION1_PLAYWRIGHT_MODULE||'playwright');
const port=+process.argv[2],label=process.argv[3],width=+(process.env.MISSION1_QA_WIDTH||1280),height=+(process.env.MISSION1_QA_HEIGHT||720);
const fractions=[0,.1,.2,.3,.4,.5,.6,.65,.7,.75,.8,.9,1];
(async()=>{const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});try{
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2});
 for(const [api,file]of [['samples','real-samples.json'],['comparison','real-comparison.json']])await context.route('**/api/iss/orbit/'+api,r=>r.fulfill({json:JSON.parse(fs.readFileSync(repo+'/docs/frontend/inspection-orientation-review/'+file))}));
 await context.route('https://gibs.earthdata.nasa.gov/**',r=>r.abort('failed'));
 const page=await context.newPage(),report={label,viewport:[width,height],dpr:2,samples:[],errors:[]};page.on('pageerror',e=>report.errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+port);await page.waitForFunction(()=>globalThis.__qa?.model?.ready,null,{timeout:60000});
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Inspect ISS')?.disabled===false);
 for(const source of ['PRIMARY_GP_TLE','NASA_OEM']){
  await page.getByRole('button',{name:source==='NASA_OEM'?'NASA OEM':'MISSION1 GP/TLE',exact:true}).click();
  await page.evaluate(()=>{const q=globalThis.__qa,H=q.helpers,v=q.viewer;v.clock.shouldAnimate=false;v.clock.currentTime=H.JulianDate.fromIso8601('2026-09-30T15:45:59.975908Z');v.camera.setView({destination:new H.Cartesian3(-9412786.358621413,-21163227.169227634,-3167995.3206285993),orientation:{direction:new H.Cartesian3(.40258878698283174,.9051600270198104,.13640965538109276),up:new H.Cartesian3(-.055435177167269443,-.12463761556457154,.9906525152235831)}});q.override=0;});
  await page.waitForTimeout(1000);
  for(const kind of ['entry','exit']){
   if(kind==='exit'){await page.evaluate(()=>{globalThis.__qa.viewer.clock.shouldAnimate=true;});await page.waitForTimeout(350);await page.evaluate(()=>{globalThis.__qa.viewer.clock.shouldAnimate=false;});}
   await page.getByRole('button',{name:kind==='entry'?'Inspect ISS':'Back to Earth View',exact:true}).evaluate(b=>b.click());
   const start=await page.evaluate(()=>{const q=globalThis.__qa;return {duration:q.flight.duration,utc:q.helpers.JulianDate.toIso8601(q.viewer.clock.currentTime)};});
   for(const fraction of fractions){
    const snap=await page.evaluate(({fraction,start})=>{const q=globalThis.__qa,H=q.helpers,v=q.viewer;q.override=fraction;v.clock.currentTime=H.JulianDate.addSeconds(H.JulianDate.fromIso8601(start.utc),start.duration*fraction,new H.JulianDate());q.tick();v.useDefaultRenderLoop=false;v.render();v.render();const c=v.camera,display=q.model.boundingSphere.center;const vec=p=>[p.x,p.y,p.z];return {fraction,mode:q.mode,visibility:q.visibility,range:H.Cartesian3.distance(c.positionWC,display),hull:H.projectedModelFootprint(v.scene,q.model),position:vec(c.positionWC),direction:vec(c.directionWC),up:vec(c.upWC),fov:c.frustum.fov,lift:H.Cartesian3.distance(display,q.positionAt(v.clock.currentTime,new H.Cartesian3())),trails:q.trails.trails.map(t=>({source:t.source,gap:t.gapSeconds,layers:t.layers.map(l=>({show:l.primitive.show,alpha:l.material.uniforms.maximumAlpha}))}))};},{fraction,start});
    const stem=`${label}-${source}-${kind}-${Math.round(fraction*100)}`;
    if(!process.env.MISSION1_QA_NO_IMAGES)await page.screenshot({path:out+'/'+stem+'.jpg',type:'jpeg',quality:80});
    // Temporary lossless model/background pairs permit actual raster extent,
    // without treating conservative projected bounds as mesh occupancy.
    if(process.env.MISSION1_QA_RASTER){
     await page.screenshot({path:out+'/'+stem+'-model.png'});
     await page.evaluate(()=>{const q=globalThis.__qa;q.hide=q.viewer.scene.preRender.addEventListener(()=>q.model.show=false);q.viewer.render();q.viewer.render();});
     await page.screenshot({path:out+'/'+stem+'-background.png'});
     await page.evaluate(()=>{const q=globalThis.__qa;q.hide();q.model.show=true;q.viewer.render();});
    }
    report.samples.push({source,kind,stem,...snap});
   }
   await page.evaluate(()=>{globalThis.__qa.override=0;globalThis.__qa.viewer.useDefaultRenderLoop=true;});
  }
  await page.evaluate(()=>{globalThis.__qa.override=undefined;});
 }
 fs.writeFileSync(out+'/'+label+'-samples.json',JSON.stringify(report,null,2));if(report.errors.length)throw Error(JSON.stringify(report.errors));
 console.log(label,'samples',report.samples.length,'errors',report.errors.length);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
