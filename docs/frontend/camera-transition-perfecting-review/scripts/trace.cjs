// Offline diagnostic: real archived backend products, instrumented disposable frontend only.
const fs = require('fs');
const {chromium} = require(process.env.MISSION1_PLAYWRIGHT_MODULE || 'playwright');
const repo = process.env.MISSION1_REPO_ROOT || require('path').resolve(__dirname, '../../../..');
const out = process.env.MISSION1_EVIDENCE_DIR || repo + '/docs/frontend/camera-transition-perfecting-review';
fs.mkdirSync(out, {recursive:true});
const port = Number(process.argv[2] || 4174), label = process.argv[3] || 'baseline';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});
 try {
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:2});
 for (const [api,file] of [['samples','real-samples.json'],['comparison','real-comparison.json']])
  await context.route('**/api/iss/orbit/'+api,r=>r.fulfill({json:JSON.parse(fs.readFileSync(repo+'/docs/frontend/inspection-orientation-review/'+file))}));
 // Shared local imagery in both runs, without expected HTTP error console messages.
 await context.route('https://gibs.earthdata.nasa.gov/**',r=>r.abort('failed'));
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+port);
 await page.waitForFunction(()=>globalThis.__qa?.model?.ready,null,{timeout:60000});
 await page.evaluate(()=>{
  const q=globalThis.__qa,H=q.helpers,v=q.viewer;
  q.longTasks=[];new PerformanceObserver(l=>q.longTasks.push(...l.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});
  q.records=[];q.capture=false;q.handoffs=[];
  const array=a=>a?[a.x,a.y,a.z]:null;
  const original=v.camera.lookAtTransform;
  v.camera.lookAtTransform=function(...a){
   const before={position:H.Cartesian3.clone(this.positionWC),direction:H.Cartesian3.clone(this.directionWC),up:H.Cartesian3.clone(this.upWC),fov:this.frustum.fov};
   const r=original.apply(this,a);
   if(q.mode!=='ISS_INSPECTION')q.handoffs.push({mode:q.mode,positionError:H.Cartesian3.distance(before.position,this.positionWC),directionError:H.Cartesian3.angleBetween(before.direction,this.directionWC),upError:H.Cartesian3.angleBetween(before.up,this.upWC),fovError:this.frustum.fov-before.fov});
   return r;
  };
  v.scene.postRender.addEventListener(()=>{
   if(!q.capture)return;
   const c=v.camera,p=q.positionAt(v.clock.currentTime,new H.Cartesian3()),display=q.model.boundingSphere.center,zero=H.Cartesian3.ZERO;
   const project=x=>{const s=H.SceneTransforms.worldToWindowCoordinates(v.scene,x);return s?[s.x,s.y]:null;};
   const target=q.saved?H.Cartesian3.add(q.saved.position,H.Cartesian3.multiplyByScalar(q.saved.direction,Math.max(1,-H.Cartesian3.dot(q.saved.position,q.saved.direction)),new H.Cartesian3()),new H.Cartesian3()):zero;
   const controller=v.scene.screenSpaceCameraController;
   q.records.push({frameIndex:q.records.length,wall:performance.now(),appliedMs:q.appliedMs,progress:q.progress,mode:q.mode,utc:H.JulianDate.toIso8601(v.clock.currentTime),position:array(c.positionWC),physical:array(p),display:array(display),direction:array(c.directionWC),up:array(c.upWC),right:array(c.rightWC),relative:array(H.Cartesian3.subtract(c.positionWC,p,new H.Cartesian3())),range:H.Cartesian3.distance(c.positionWC,p),earthRange:H.Cartesian3.magnitude(c.positionWC),height:H.Ellipsoid.WGS84.cartesianToCartographic(c.positionWC).height,transform:Array.from(c.transform),fov:c.frustum.fov,lift:H.Cartesian3.distance(display,p),silhouette:q.model.silhouetteSize,silhouetteAlpha:q.model.silhouetteColor.alpha,inputs:controller.enableInputs,zoom:controller.enableZoom,issScreen:project(p),displayScreen:project(display),earthScreen:project(zero),targetScreen:project(target),footprint:H.projectedModelFootprint(v.scene,q.model)});
  });
 });
 const rows=[];
 await page.waitForTimeout(6000);
 for(const source of ['PRIMARY_GP_TLE','NASA_OEM']){
  await page.getByRole('button',{name:source==='NASA_OEM'?'NASA OEM':'MISSION1 GP/TLE',exact:true}).click();
  await page.evaluate(()=>{
   const q=globalThis.__qa,H=q.helpers,v=q.viewer;
   v.clock.shouldAnimate=false;v.clock.currentTime=H.JulianDate.fromIso8601('2026-09-30T15:45:59.975908Z');
   v.camera.setView({destination:new H.Cartesian3(-9412786.358621413,-21163227.169227634,-3167995.3206285993),orientation:{direction:new H.Cartesian3(0.40258878698283174,0.9051600270198104,0.13640965538109276),up:new H.Cartesian3(-0.055435177167269443,-0.12463761556457154,0.9906525152235831)}});
  });
  await page.waitForTimeout(2000);
  await page.evaluate(()=>{const q=globalThis.__qa;q.records=[];q.handoffs=[];q.capture=true;q.viewer.clock.shouldAnimate=true;});
  await page.getByRole('button',{name:'Inspect ISS',exact:true}).click();
  const path=await page.evaluate(()=>{const q=globalThis.__qa,f=q.flight;return {pathLength:f.pathLength??null,duration:f.duration,startMs:f.startMs,start:f.start};});
  await page.waitForFunction(()=>globalThis.__qa.mode==='ISS_INSPECTION',null,{timeout:20000});
  const entry=await page.evaluate(()=>{const q=globalThis.__qa;q.capture=false;q.viewer.clock.shouldAnimate=false;return {frames:q.records,handoffs:q.handoffs};});
  await page.screenshot({path:out+'/'+label+'-'+source+'-inspection.jpg',type:'jpeg',quality:85});
  await page.waitForTimeout(2000);
  await page.evaluate(()=>{const q=globalThis.__qa;q.records=[];q.handoffs=[];q.capture=true;q.viewer.clock.shouldAnimate=true;});
  await page.getByRole('button',{name:'Back to Earth View',exact:true}).click();
  const exitPath=await page.evaluate(()=>{const f=globalThis.__qa.flight;return {pathLength:f.pathLength??null,duration:f.duration,startMs:f.startMs};});
  await page.waitForFunction(()=>globalThis.__qa.mode==='EARTH_OVERVIEW',null,{timeout:20000});
  const exit=await page.evaluate(()=>{const q=globalThis.__qa;q.capture=false;q.viewer.clock.shouldAnimate=false;return {frames:q.records,handoffs:q.handoffs,saved:q.saved};});
  rows.push({source,path,entry,exitPath,exit});
  console.log(source,entry.frames.length,exit.frames.length);
 }
 const metadata=await page.evaluate(()=>{const q=globalThis.__qa,v=q.viewer,g=v.scene.canvas.getContext('webgl2'),e=g.getExtension('WEBGL_debug_renderer_info');return {renderer:e&&g.getParameter(e.UNMASKED_RENDERER_WEBGL),canvas:[v.scene.canvas.width,v.scene.canvas.height],longTasks:q.longTasks};});
 fs.writeFileSync(out+'/'+label+'-trace.json',JSON.stringify({label,baseline:'538bb0642205be7f326aa3ae08ec2dc46134a212',viewport:[1280,720],dpr:2,rows,metadata,errors},null,2));
 console.log(errors);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
