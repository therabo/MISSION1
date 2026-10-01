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
 const width=Number(process.env.MISSION1_QA_WIDTH||1280),height=Number(process.env.MISSION1_QA_HEIGHT||720);
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2});
 for (const [api,file] of [['samples','real-samples.json'],['comparison','real-comparison.json']])
  await context.route('**/api/iss/orbit/'+api,r=>r.fulfill({json:JSON.parse(fs.readFileSync(repo+'/docs/frontend/inspection-orientation-review/'+file))}));
 // Shared local imagery in both runs, without expected HTTP error console messages.
 await context.route('https://gibs.earthdata.nasa.gov/**',r=>r.abort('failed'));
 const page=await context.newPage(),errors=[];
 const profiler=process.env.MISSION1_QA_CPU_PROFILE?await context.newCDPSession(page):null;
 if(profiler){await profiler.send('Profiler.enable');await profiler.send('Profiler.setSamplingInterval',{interval:1000});}
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+port);
 await page.waitForFunction(()=>globalThis.__qa?.model?.ready,null,{timeout:60000});
 await page.evaluate(()=>{
  const q=globalThis.__qa,H=q.helpers,v=q.viewer;
  q.longTasks=[];new PerformanceObserver(l=>q.longTasks.push(...l.getEntries().map(e=>({start:e.startTime,duration:e.duration,attribution:e.attribution?.map(a=>({name:a.name,containerType:a.containerType,containerName:a.containerName}))})))).observe({type:'longtask',buffered:true});
  q.readiness={modelReadyObservedAt:performance.now(),warmingWhenModelReady:q.warming??null,inspectEnabledWhenModelReady:Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Inspect ISS')?.disabled===false};
  q.records=[];q.capture=false;q.handoffs=[];q.mappingMs=0;q.focusMs=0;
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
   if(q.flight&&!q.flight.qaTimed){
    q.flight.qaTimed=true;if(q.flight.composition){const original=q.flight.composition.evaluate;q.flight.composition.evaluate=function(...args){const begin=performance.now();const r=original.apply(this,args);q.focusMs+=performance.now()-begin;return r;};}
    for(const method of ['presentationAt','evaluate'])if(typeof q.flight[method]==='function'){
     const original=q.flight[method];q.flight[method]=function(...args){const begin=performance.now();const result=original.apply(this,args);q.mappingMs+=performance.now()-begin;return result;};
    }
   }
   const c=v.camera,p=q.positionAt(v.clock.currentTime,new H.Cartesian3()),display=q.model.boundingSphere.center,zero=H.Cartesian3.ZERO;
   const project=x=>{const s=H.SceneTransforms.worldToWindowCoordinates(v.scene,x);return s?[s.x,s.y]:null;};
   const target=q.saved?H.Cartesian3.add(q.saved.position,H.Cartesian3.multiplyByScalar(q.saved.direction,Math.max(1,-H.Cartesian3.dot(q.saved.position,q.saved.direction)),new H.Cartesian3()),new H.Cartesian3()):zero;
   const controller=v.scene.screenSpaceCameraController;
   const localOffset=H.Matrix4.multiplyByPoint(H.Matrix4.inverseTransformation(q.frame,new H.Matrix4()),c.positionWC,new H.Cartesian3());
   q.records.push({frameIndex:q.records.length,wall:performance.now(),appliedMs:q.appliedMs,mappingMs:q.mappingMs,trajectoryCpu:q.trajectoryCpu,visibility:q.visibility,progress:q.progress,mode:q.mode,utc:H.JulianDate.toIso8601(v.clock.currentTime),position:array(c.positionWC),physical:array(p),display:array(display),direction:array(c.directionWC),up:array(c.upWC),right:array(c.rightWC),relative:array(H.Cartesian3.subtract(c.positionWC,p,new H.Cartesian3())),localOffset:array(localOffset),pathParameter:q.flight?.pathParameter??null,perceptualProgress:q.flight?.perceptualProgress??null,displayRange:H.Cartesian3.distance(c.positionWC,display),range:H.Cartesian3.distance(c.positionWC,p),earthRange:H.Cartesian3.magnitude(c.positionWC),height:H.Ellipsoid.WGS84.cartesianToCartographic(c.positionWC).height,transform:Array.from(c.transform),fov:c.frustum.fov,lift:H.Cartesian3.distance(display,p),silhouette:q.model.silhouetteSize,silhouetteAlpha:q.model.silhouetteColor.alpha,inputs:controller.enableInputs,zoom:controller.enableZoom,issScreen:project(p),displayScreen:project(display),earthScreen:project(zero),targetScreen:project(target),requestedDirection:array(q.flight?.pose?.direction),requestedUp:array(q.flight?.pose?.up),requestedDirectionError:q.flight?.pose?H.Cartesian3.angleBetween(c.directionWC,q.flight.pose.direction):null,requestedUpError:q.flight?.pose?H.Cartesian3.angleBetween(c.upWC,q.flight.pose.up):null,focusRayError:q.flight?.focusPoint?H.Cartesian3.angleBetween(c.directionWC,H.Cartesian3.subtract(q.flight.focusPoint,c.positionWC,new H.Cartesian3())):null,focusScreen:q.flight?.focusPoint?project(q.flight.focusPoint):null,focus:array(q.flight?.focusPoint??q.focus),focusBlend:q.flight?.focusBlend??null,focusMs:q.focusMs||0,footprint:H.projectedModelFootprint(v.scene,q.model)});
  q.mappingMs=0;q.focusMs=0;
  });
 });
 if(process.env.MISSION1_QA_GL_TIMINGS)await page.evaluate(()=>{
  const q=globalThis.__qa,gl=q.viewer.scene.canvas.getContext('webgl2');q.slowGl=[];
  const timer=gl.getExtension('EXT_disjoint_timer_query_webgl2');q.gpu={supported:!!timer,frames:[],disjoint:0};
  if(timer){let active=null;const pending=[];
   q.viewer.scene.preRender.addEventListener(()=>{
    while(pending.length&&gl.getQueryParameter(pending[0].query,gl.QUERY_RESULT_AVAILABLE)){
     const done=pending.shift();if(gl.getParameter(timer.GPU_DISJOINT_EXT))q.gpu.disjoint++;else q.gpu.frames.push({...done,query:undefined,milliseconds:gl.getQueryParameter(done.query,gl.QUERY_RESULT)/1e6});gl.deleteQuery(done.query);
    }
    active=gl.createQuery();gl.beginQuery(timer.TIME_ELAPSED_EXT,active);
   });
   q.viewer.scene.postRender.addEventListener(()=>{gl.endQuery(timer.TIME_ELAPSED_EXT);pending.push({query:active,wall:performance.now(),progress:q.progress,mode:q.mode,capture:q.capture});active=null;});
  }
  for(const name of ['linkProgram','getProgramParameter','drawElements','drawArrays']){
   const original=gl[name];gl[name]=function(...args){const begin=performance.now();const result=original.apply(this,args);const duration=performance.now()-begin;
    if(duration>10){const program=name==='linkProgram'||name==='getProgramParameter'?args[0]:gl.getParameter(gl.CURRENT_PROGRAM);
     q.slowGl.push({name,duration,wall:performance.now(),progress:q.progress,mode:q.mode,
       shaders:program?gl.getAttachedShaders(program).map(s=>gl.getShaderSource(s)):[]});}
    return result;};
  }
 });
 const rows=[];
 await page.getByRole('button',{name:'Inspect ISS',exact:true}).waitFor({state:'visible'});
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Inspect ISS')?.disabled===false);
 await page.evaluate(()=>{const q=globalThis.__qa;q.readiness.inspectEnabledAt=performance.now();q.readiness.warmingWhenEnabled=q.warming??null;q.readiness.skyReadyWhenEnabled=q.skyReady??null;if(q.warming||q.skyReady===false)throw Error('Inspection enabled before graphics warmup');});
 let cycle=0;
 const heapClient=await context.newCDPSession(page);await heapClient.send('HeapProfiler.enable');await heapClient.send('HeapProfiler.collectGarbage');
 const heapBefore=await heapClient.send('Runtime.getHeapUsage');
 await page.evaluate(()=>{const q=globalThis.__qa,v=q.viewer;q.resourceRefs={model:q.model,globe:v.scene.globe,atmosphere:v.scene.skyAtmosphere,providers:Array.from({length:v.imageryLayers.length},(_,i)=>v.imageryLayers.get(i).imageryProvider)};});
 for(const source of process.env.MISSION1_QA_TEN_CYCLES?Array.from({length:20},(_,i)=>i%2?'NASA_OEM':'PRIMARY_GP_TLE'):Array(2).fill(process.env.MISSION1_QA_SOURCE||'PRIMARY_GP_TLE')){
  await page.getByRole('button',{name:source==='NASA_OEM'?'NASA OEM':'MISSION1 GP/TLE',exact:true}).click();
  await page.evaluate(()=>{
   const q=globalThis.__qa,H=q.helpers,v=q.viewer;
   v.clock.shouldAnimate=false;v.clock.currentTime=H.JulianDate.fromIso8601('2026-09-30T15:45:59.975908Z');
   v.camera.setView({destination:new H.Cartesian3(-9412786.358621413,-21163227.169227634,-3167995.3206285993),orientation:{direction:new H.Cartesian3(0.40258878698283174,0.9051600270198104,0.13640965538109276),up:new H.Cartesian3(-0.055435177167269443,-0.12463761556457154,0.9906525152235831)}});
  });
  await page.waitForTimeout(cycle===0?50:2000);
  await page.evaluate(()=>{const q=globalThis.__qa;q.records=[];q.handoffs=[];q.capture=true;q.viewer.clock.shouldAnimate=true;});
  if(profiler)await profiler.send('Profiler.start');
  await page.getByRole('button',{name:'Inspect ISS',exact:true}).click();
  const path=await page.evaluate(()=>{const q=globalThis.__qa,f=q.flight;q.flightClass=f.constructor;return {prepareMs:q.prepareMs,pathLength:f.pathLength??null,duration:f.duration,startMs:f.startMs,start:f.start,startOffset:f.startOffset,endOffset:f.endOffset,startLens:f.startLens,endLens:f.endLens};});
  await page.waitForFunction(()=>globalThis.__qa.mode==='ISS_INSPECTION',null,{timeout:20000});
  const entry=await page.evaluate(()=>{const q=globalThis.__qa;q.capture=false;q.viewer.clock.shouldAnimate=false;return {frames:q.records,handoffs:q.handoffs};});
  if(profiler){const cpu=await profiler.send('Profiler.stop');fs.writeFileSync(out+'/'+label+'-'+source+'-entry-cpu-cycle'+cycle+'.json',JSON.stringify(cpu.profile));}
  await page.screenshot({path:out+'/'+label+'-'+source+'-inspection.jpg',type:'jpeg',quality:85});
  await page.waitForTimeout(2000);
  await page.evaluate(()=>{const q=globalThis.__qa;q.records=[];q.handoffs=[];q.capture=true;q.viewer.clock.shouldAnimate=true;});
  if(profiler)await profiler.send('Profiler.start');
  await page.getByRole('button',{name:'Back to Earth View',exact:true}).click();
  const exitPath=await page.evaluate(()=>{const q=globalThis.__qa,f=q.flight;q.flightClass=f.constructor;return {prepareMs:q.prepareMs,pathLength:f.pathLength??null,duration:f.duration,startMs:f.startMs,start:f.start,startOffset:f.startOffset,endOffset:f.endOffset,startLens:f.startLens,endLens:f.endLens};});
  await page.waitForFunction(()=>globalThis.__qa.mode==='EARTH_OVERVIEW',null,{timeout:20000});
  const exit=await page.evaluate(()=>{const q=globalThis.__qa;q.capture=false;q.viewer.clock.shouldAnimate=false;return {frames:q.records,handoffs:q.handoffs,saved:q.saved};});
  if(profiler){const cpu=await profiler.send('Profiler.stop');fs.writeFileSync(out+'/'+label+'-'+source+'-exit-cpu-cycle'+cycle+'.json',JSON.stringify(cpu.profile));}
  const resources=await page.evaluate(()=>{const q=globalThis.__qa,v=q.viewer,c=v.camera;return {modelSame:q.model===q.resourceRefs.model,globeSame:v.scene.globe===q.resourceRefs.globe,atmosphereSame:v.scene.skyAtmosphere===q.resourceRefs.atmosphere,providersSame:q.resourceRefs.providers.every((p,i)=>p===v.imageryLayers.get(i).imageryProvider),primitives:v.scene.primitives.length,layers:v.imageryLayers.length,activeTransition:!!q.flight,restorePosition:q.helpers.Cartesian3.distance(c.positionWC,q.saved.position),restoreDirection:q.helpers.Cartesian3.angleBetween(c.directionWC,q.saved.direction),restoreUp:q.helpers.Cartesian3.angleBetween(c.upWC,q.saved.up),restoreFov:c.frustum.fov-q.saved.fov};});
  await heapClient.send('HeapProfiler.collectGarbage');const heap=await heapClient.send('Runtime.getHeapUsage');
  rows.push({source,cycle:cycle++,path,entry,exitPath,exit,resources,heap});
  console.log(source,entry.frames.length,exit.frames.length);
 }
 await page.evaluate(()=>{globalThis.__qa.records=[];});await heapClient.send('HeapProfiler.collectGarbage');const heapAfter=await heapClient.send('Runtime.getHeapUsage');
 const proto=await heapClient.send('Runtime.evaluate',{expression:'globalThis.__qa.flightClass.prototype'});const objects=await heapClient.send('Runtime.queryObjects',{prototypeObjectId:proto.result.objectId});const count=await heapClient.send('Runtime.callFunctionOn',{objectId:objects.objects.objectId,functionDeclaration:'function(){return this.length}',returnByValue:true});await heapClient.send('Runtime.releaseObject',{objectId:objects.objects.objectId});
 const metadata=await page.evaluate(()=>{const q=globalThis.__qa,v=q.viewer,g=v.scene.canvas.getContext('webgl2'),e=g.getExtension('WEBGL_debug_renderer_info');return {renderer:e&&g.getParameter(e.UNMASKED_RENDERER_WEBGL),gpuTimerExtension:!!g.getExtension('EXT_disjoint_timer_query_webgl2'),canvas:[v.scene.canvas.width,v.scene.canvas.height],longTasks:q.longTasks,readiness:q.readiness,skyWarmup:q.skyWarmup??null,gpu:q.gpu??null};});
 if(process.env.MISSION1_QA_GL_TIMINGS)fs.writeFileSync(out+'/'+label+'-slow-gl.json',JSON.stringify(await page.evaluate(()=>globalThis.__qa.slowGl),null,2));
 fs.writeFileSync(out+'/'+label+'-trace.json',JSON.stringify({label,baseline:'c3d24aed576b368bb2343abcb65d9067f5eaa7f2',viewport:[width,height],dpr:2,rows,metadata,heapBefore,heapAfter,retainedTransitions:count.result.value,errors},null,2));
 console.log(errors);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
