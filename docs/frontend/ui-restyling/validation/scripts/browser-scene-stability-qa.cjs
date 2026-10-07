/* Temporal coherence: unchanged real API envelopes, every render frame, and star-only GPU
 * crops outside Earth/UI. Observe the SDK in isolated QA responses only; neither
 * source files, shipped bundles nor data responses are modified by the probe.
 * node browser-scene-stability-qa.cjs [base-url] [development|production]
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,matrix,layout,checkLayout}=require('./browser-responsive-qa.cjs');
const base=process.argv[2]||'http://127.0.0.1:5175/',production=process.argv[3]==='production';
const out=path.resolve(process.env.MISSION1_QA_OUTPUT||'/tmp/mission1-scene-stability');fs.mkdirSync(out,{recursive:true});
function equal(a,b){for(const k of ['container','canvasBox','canvas','document','dpr','frustum','controls'])assert.deepEqual(b[k],a[k],`Scene ${k} changed`);
 for(const k of ['x','y','height'])assert.equal(b.legend[k],a.legend[k],`Legend ${k} moved`);
 for(const k of Object.keys(a.camera)){const av=Array.isArray(a.camera[k])?a.camera[k]:[a.camera[k]],bv=Array.isArray(b.camera[k])?b.camera[k]:[b.camera[k]];
  for(let i=0;i<av.length;i++)assert(Math.abs(av[i]-bv[i])<(k.startsWith('position')||k==='viewMatrix'?1e-6:1e-12),`Camera ${k} moved`);}
 assert.equal(b.resizes,a.resizes,'Viewer resize called merely by temporal switching');assert.equal(b.viewerCount,1);assert(b.canvasSame);
 assert(b.nativeSkyCommand&&b.panoramaCommands===0,'Star background lost its native early environment draw order');assert.deepEqual(b.notices,[],'Yellow warning regression');}
(async()=>{const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});const report={base,production,viewports:[],rapid:[],errors:[]};const history=new Map(),currentWindows=[],comparisons=[];
try{const p=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1,hasTouch:true});
 p.on('pageerror',e=>report.errors.push(e.message));
 p.on('response',async response=>{try{if(response.ok()&&response.url().endsWith('/api/iss/orbit/samples'))currentWindows.push(await response.json());if(response.ok()&&response.url().endsWith('/api/iss/orbit/comparison'))comparisons.push(await response.json());}catch{}});
 await p.addInitScript(()=>{const q=globalThis.__skyQA={viewers:[],resizes:[],observers:[]},Native=ResizeObserver;
  globalThis.ResizeObserver=class extends Native{constructor(cb){super((entries,o)=>{q.observers.push({at:performance.now(),boxes:entries.map(e=>({target:e.target.className,width:e.contentRect.width,height:e.contentRect.height}))});cb(entries,o);});}};});
 const instrument=name=>`globalThis.__skyQA.viewers.push(${name});const qaNativeResize=${name}.resize;${name}.resize=function(...args){const c=${name}.scene.canvas,before=[c.clientWidth,c.clientHeight,c.width,c.height];const result=qaNativeResize.apply(this,args);globalThis.__skyQA.resizes.push({before,after:[c.clientWidth,c.clientHeight,c.width,c.height]});return result;};`;
 if(!production)await p.route('**/src/cesium/EarthView.tsx*',async route=>{const response=await route.fetch(),body=await response.text();assert(body.includes('viewer.current = instance;'));await route.fulfill({response,body:body.replace('viewer.current = instance;',`viewer.current = instance;${instrument('instance')}`)});});
 else await p.route('**/assets/index-*.js',async route=>{const response=await route.fetch(),body=await response.text(),marker='3D Earth could not start. Check browser WebGL support.',i=body.indexOf(marker);assert(i>=0);
  const tail=body.slice(i,i+400),match=/return\}([\w$]+)\.current=([\w$]+),\2\.camera/.exec(tail);assert(match,'Cannot observe this production build safely');
  const anchor=`${match[1]}.current=${match[2]},${match[2]}.camera`,observed=`${match[1]}.current=${match[2]},(()=>{${instrument(match[2])}})(),${match[2]}.camera`;
  assert.equal(body.split(anchor).length,2);await route.fulfill({response,body:body.replace(anchor,observed)});});
 await p.goto(base);await p.evaluate(()=>document.fonts.ready);
 await p.waitForFunction(()=>[...document.querySelectorAll('button')].some(e=>e.textContent==='ISS Inspection'&&!e.disabled),null,{timeout:90000});
 await p.waitForFunction(()=>typeof globalThis.__skyQA.viewers[0]?.scene.skyBox.sources.positiveX!=='string'&&globalThis.__skyQA.viewers[0]?.scene.skyBox.sources.positiveX.complete,null,{timeout:30000});
 await p.waitForTimeout(300);
 await p.evaluate(()=>{const q=globalThis.__skyQA,v=q.viewers[0],s=v.scene,can=s.canvas,originalCanvas=can,vec=p=>[p.x,p.y,p.z],mat=(m,n)=>Array.from({length:n},(_,i)=>m[i]),box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
  q.metrics=()=>{const c=v.camera,f=c.frustum,d=document.documentElement,u=s.context.uniformState;
   return {at:performance.now(),container:box(document.querySelector('.earth-view')),canvasBox:box(can),canvas:{clientWidth:can.clientWidth,clientHeight:can.clientHeight,width:can.width,height:can.height,drawingBufferWidth:s.drawingBufferWidth,drawingBufferHeight:s.drawingBufferHeight},dpr:devicePixelRatio,
    camera:{position:vec(c.position),positionWC:vec(c.positionWC),direction:vec(c.direction),directionWC:vec(c.directionWC),up:vec(c.up),upWC:vec(c.upWC),right:vec(c.right),rightWC:vec(c.rightWC),heading:c.heading,pitch:c.pitch,roll:c.roll,viewMatrix:mat(c.viewMatrix,16),transform:mat(c.transform,16)},
    frustum:{aspectRatio:f.aspectRatio,fov:f.fov,near:f.near,far:f.far,xOffset:f.xOffset,yOffset:f.yOffset,projectionMatrix:mat(f.projectionMatrix,16)},
    document:{clientWidth:d.clientWidth,clientHeight:d.clientHeight,scrollWidth:d.scrollWidth,scrollHeight:d.scrollHeight,innerWidth,innerHeight},
    utc:v.clock.currentTime.constructor.toIso8601(v.clock.currentTime,3),historicalTimeMatches:document.querySelector('.context-date > span').textContent==='HISTORICAL DATE'?v.clock.currentTime.constructor.equals(v.clock.currentTime,v.clock.currentTime.constructor.fromDate(new Date(document.querySelector('.context-date time').dateTime))):null,day:v.clock.currentTime.dayNumber,seconds:v.clock.currentTime.secondsOfDay,renderDay:s.frameState.time.dayNumber,renderSeconds:s.frameState.time.secondsOfDay,holding:document.querySelector('main').getAttribute('aria-busy')==='true',presentedHistorical:document.querySelector('.context-date > span').textContent==='HISTORICAL DATE',headerUtc:document.querySelector('.context-date time').dateTime,source:document.querySelector('select[aria-label="Orbital source"]').value,iss:vec(v.entities.values.find(e=>e.name==='ISS').position.getValue(v.clock.currentTime)),issShown:v.entities.values.find(e=>e.name==='ISS').show,values:[...document.querySelectorAll('.summary-position dd')].map(e=>e.textContent),globeLighting:s.globe.enableLighting,dynamicAtmosphere:s.globe.dynamicAtmosphereLightingFromSun,illuminationX:u.sunDirectionWC.x,sunDirectionWC:vec(u.sunDirectionWC),animate:v.clock.shouldAnimate,teme:mat(u.temeToPseudoFixedMatrix,9),starTransform:mat(s.skyBox.transform,9),sunPositionWC:vec(u.sunPositionWC),moonDirectionEC:vec(u.moonDirectionEC),
    resizes:q.resizes.length,observers:q.observers.length,viewerCount:q.viewers.length,canvasSame:can===document.querySelector('.earth-view canvas'),nativeSkyCommand:!!s.environmentState.skyBoxCommand,panoramaCommands:s.frameState.panoramaCommandList.length,
    legend:box(document.querySelector('.trajectory-legend')),controls:box(document.querySelector('.earth-scene-controls')),notices:[...document.querySelectorAll('.earth-current-notice')].map(e=>e.textContent)};
  };
  q.chooseCrop=()=>{const area=box(document.querySelector('.earth-scene-ui')),excluded=[...document.querySelectorAll('.top-context-bar,.historical-time-bar,.trajectory-legend,.earth-scene-controls,.operational-summary,.cesium-viewer-bottom')].map(box);
   const intersects=(a,b)=>Math.min(a.x+a.width,b.x+b.width)>Math.max(a.x,b.x)&&Math.min(a.y+a.height,b.y+b.height)>Math.max(a.y,b.y);
   const skyOnly=(x,y)=>{const r=v.camera.getPickRay({x,y}),o=r.origin,d=r.direction,R=7178137,b=o.x*d.x+o.y*d.y+o.z*d.z,c=o.x*o.x+o.y*o.y+o.z*o.z-R*R;return c>0&&(b>=0||b*b<c);};
   const candidates=[{x:32,y:220,width:192,height:128}];
   for(const width of [192,128,64,32,16,8])for(const height of [128,64,32])for(const x of [2,16,32,innerWidth-width-2])for(const y of [area.y+8,area.y+80,area.y+160,area.y+area.height-height-8])candidates.push({x,y,width,height});
   for(const r of candidates){if(r.x<0||r.y<area.y||r.x+r.width>innerWidth||r.y+r.height>area.y+area.height||excluded.some(e=>intersects(r,e)))continue;
    if([0,.5,1].every(a=>[0,.5,1].every(b=>skyOnly(r.x+r.width*a,r.y+r.height*b))))return r;
   }throw Error('No star-only crop outside Earth/UI');
  };
  q.read=rect=>{const gl=can.getContext('webgl2'),sx=gl.drawingBufferWidth/can.clientWidth,sy=gl.drawingBufferHeight/can.clientHeight,x=Math.round(rect.x*sx),y=gl.drawingBufferHeight-Math.round((rect.y+rect.height)*sy),w=Math.round(rect.width*sx),h=Math.round(rect.height*sy),data=new Uint8Array(w*h*4),binding=gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
   gl.bindFramebuffer(gl.READ_FRAMEBUFFER,null);gl.readPixels(x,y,w,h,gl.RGBA,gl.UNSIGNED_BYTE,data);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,binding);return data;
  };
  q.sample=()=>new Promise(resolve=>{const remove=s.postRender.addEventListener(()=>{remove();resolve(q.read(q.crop));});s.requestRender();});
  q.trace=async(destination,count=24)=>{const pixels=await q.sample(),before=q.metrics(),frames=[],mutations=[],nonBlackPixels=Array.from({length:pixels.length/4},(_,i)=>pixels[i*4]|pixels[i*4+1]|pixels[i*4+2]).filter(Boolean).length,observer=new MutationObserver(()=>mutations.push(q.metrics()));observer.observe(document.querySelector('.app-shell'),{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','style','data-state']});
   const remove=s.postRender.addEventListener(()=>{const next=q.read(q.crop);let max=0,changed=0;for(let i=0;i<next.length;i++){const d=Math.abs(next[i]-pixels[i]);max=Math.max(max,d);if(d)changed++;}frames.push({...q.metrics(),pixelMaxDifference:max,changedChannels:changed});});
   const button=[...document.querySelectorAll('button')].find(e=>e.textContent===destination||e.getAttribute('aria-label')===destination);button.click();const start=performance.now();while(performance.now()-start<1100||q.metrics().holding){if(performance.now()-start>15000)throw Error('Temporal target did not settle');await new Promise(requestAnimationFrame);}
   remove();observer.disconnect();return {before,frames,mutations,nonBlackPixels,requestedUtc:document.querySelector('.historical-date time')?.dateTime};
  };
 });
 await p.evaluate(()=>{globalThis.__skyQA.crop=globalThis.__skyQA.chooseCrop();});
 const sdkModule=await import(path.resolve(__dirname,'../../../../../frontend/node_modules/cesium/Source/Cesium.js'));
 const {JulianDate,TimeStandard,Transforms,Matrix3,Cartesian3,Matrix4,Simon1994PlanetaryPositions}=sdkModule;
 // Match the browser's loaded IAU2006 table rather than Node's initially
 // unloaded TEME fallback. Copy unchanged bundled samples exactly as Cesium's
 // chunk loader does; this affects only the independent QA oracle in Node.
 const xysFolder=path.resolve(__dirname,'../../../../../frontend/node_modules/cesium/Build/Cesium/Assets/IAU2006_XYS');
 for(const filename of fs.readdirSync(xysFolder)){const chunk=Number(/_(\d+)\.json$/.exec(filename)[1]),samples=JSON.parse(fs.readFileSync(path.join(xysFolder,filename),'utf8')).samples;
  for(let i=0;i<samples.length;i++)Transforms.iau2006XysData._samples[chunk*3000+i]=samples[i];}
 const {makeSampledPosition}=await import(path.resolve(__dirname,'../../../../../frontend/src/cesium/sampleProperty.ts'));
 const current=p.getByRole('button',{name:'Current',exact:true}),historical=p.getByRole('button',{name:'Historical',exact:true});
 // Read real responses without replacing data; delay delivery only to exercise the handoff.
 await p.route('**/api/iss/replay?*',async route=>{const response=await route.fetch(),data=await response.json();history.set(Date.parse(data.requestedAt),data);
  await new Promise(resolve=>setTimeout(resolve,650));try{await route.fulfill({response});}catch{/* Superseded native request. */}});
 async function captureCurrentResponses(){
  const [samples,comparison]=await Promise.all([p.request.get(new URL('/api/iss/orbit/samples',base).href),p.request.get(new URL('/api/iss/orbit/comparison',base).href)]);
  currentWindows.push(await samples.json());comparisons.push(await comparison.json());
 }

 // Store the exact initial scene inputs as well (the observer above starts after boot).
 // Re-enable Current polling once to obtain the unchanged real responses used by the renderer.
 await captureCurrentResponses();
 function delta(a,b){return Math.max(...a.map((v,i)=>Math.abs(v-b[i])));}
 function coherent(m){
  assert.equal(m.day,m.renderDay);assert.equal(m.seconds,m.renderSeconds,'Clock and render use different instants');
  const at=new JulianDate(m.day,m.seconds,TimeStandard.TAI),expected=Transforms.computeTemeToPseudoFixedMatrix(at,new Matrix3());
  assert(delta(m.starTransform,Array.from({length:9},(_,i)=>expected[i]))<1e-12,'Stars do not correspond to coherent scene UTC');
  assert(delta(m.teme,m.starTransform)<1e-12,'Astronomy and sky differ in scene time');
  const fixed=Transforms.computeIcrfToCentralBodyFixedMatrix(at,new Matrix3());
  const expectedSun=Matrix3.multiplyByVector(fixed,Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(at),new Cartesian3());
  const solarDelta=delta(m.sunPositionWC,[expectedSun.x,expectedSun.y,expectedSun.z]);assert(solarDelta<.001,`Sun expected UTC ${m.utc}: delta ${solarDelta} m; actual ${m.sunPositionWC}; expected ${[expectedSun.x,expectedSun.y,expectedSun.z]}`);
  const moon=Matrix3.multiplyByVector(fixed,Simon1994PlanetaryPositions.computeMoonPositionInEarthInertialFrame(at),new Cartesian3());
  const viewRotation=Matrix4.getMatrix3(Matrix4.fromArray(m.camera.viewMatrix),new Matrix3());
  Matrix3.multiplyByVector(viewRotation,moon,moon);Cartesian3.normalize(moon,moon);
  assert(delta(m.moonDirectionEC,[moon.x,moon.y,moon.z])<1e-12,'Moon belongs to another UTC');
  const sunDirection=Cartesian3.normalize(expectedSun,new Cartesian3());assert(delta(m.sunDirectionWC,[sunDirection.x,sunDirection.y,sunDirection.z])<1e-12,'Earth illumination belongs to another UTC');
  assert(m.globeLighting&&m.dynamicAtmosphere);assert(Math.abs(Math.hypot(...m.sunDirectionWC)-1)<1e-12);
  assert(Math.abs(m.illuminationX-m.sunDirectionWC[0])<1e-12);
  assert(m.issShown,'Usable ISS vanished during a temporal handoff');
  if(m.presentedHistorical){
   assert.equal(m.historicalTimeMatches,true);const data=history.get(Date.parse(m.utc));assert(data?.orbit.primary,'No authoritative replay envelope for rendered UTC');
   const state=data.orbit.primary;assert.equal(Date.parse(state.effectiveAt),Date.parse(m.utc));
   assert(delta(m.iss,[state.position.x,state.position.y,state.position.z])<1e-6,'Historical ISS and sky use different instants');
   assert.equal(m.source,state.source.kind==='NASA_OEM'?'NASA_OEM':'PRIMARY_GP_TLE');
   const texts=[`${Math.abs(state.latitudeDegrees).toFixed(3)}° ${state.latitudeDegrees<0?'S':'N'}`,`${Math.abs(state.longitudeDegrees).toFixed(3)}° ${state.longitudeDegrees<0?'W':'E'}`,`${(state.altitudeMeters/1000).toFixed(1)} km`];
   assert.deepEqual(m.values,texts,'Historical operational values and scene use different instants');
  }else{
   const candidates=(m.source==='NASA_OEM'?comparisons.map(d=>d.oem.samples):currentWindows.map(d=>d.samples)).filter(samples=>samples?.length>=2&&Date.parse(samples[0].time)<=Date.parse(m.utc)&&Date.parse(samples.at(-1).time)>=Date.parse(m.utc));
   assert(candidates.some(samples=>{const point=makeSampledPosition(samples).getValue(at);return point&&delta(m.iss,[point.x,point.y,point.z])<.01;}),'Current ISS not evaluated against its sky/scene time');
  }
 }
 function validate(trace){
  assert(trace.frames.length>0);for(const f of [...trace.frames,...trace.mutations])equal(trace.before,f);
  for(const f of trace.frames){coherent(f);if(f.presentedHistorical)assert([Date.parse(trace.before.utc),Date.parse(trace.requestedUtc)].includes(Date.parse(f.utc)),'Scene traversed an intermediate historical instant');}
  const held=trace.frames.filter(f=>f.holding);if(held.length){const origin=held[0];
   for(const f of held){assert.equal(f.day,origin.day);assert.equal(f.seconds,origin.seconds);assert.deepEqual(f.iss,origin.iss);assert.deepEqual(f.starTransform,origin.starTransform);assert.deepEqual(f.sunPositionWC,origin.sunPositionWC);assert.deepEqual(f.moonDirectionEC,origin.moonDirectionEC);assert.equal(f.pixelMaxDifference,held[0].pixelMaxDifference);}
  }
  return {frames:trace.frames.length,heldFrames:held.length,settledUtc:trace.frames.at(-1).utc,result:'PASS'};
 }
 async function trace(destination){return p.evaluate(d=>globalThis.__skyQA.trace(d),destination);}
 // Capture normal Current evolution without changing UI, data, camera or clock.
 const live=await p.evaluate(async()=>{const q=globalThis.__skyQA;await q.sample();const before=q.metrics();await new Promise(resolve=>setTimeout(resolve,1200));await q.sample();return {before,after:q.metrics()};});
 equal(live.before,live.after);assert(live.after.animate);assert(Date.parse(live.after.utc)>Date.parse(live.before.utc));
 assert(delta(live.before.starTransform,live.after.starTransform)>0);assert(delta(live.before.iss,live.after.iss)>0);assert(delta(live.before.sunPositionWC,live.after.sunPositionWC)>0);report.live=live;
 // Move the requested target far enough into the past to enable both ±600 s controls.
 await historical.click();await p.getByRole('button',{name:'Historical back 10 minutes',exact:true}).evaluate(e=>{e.click();e.click();});
 await p.waitForFunction(()=>document.querySelector('main').getAttribute('aria-busy')==='false');await current.click();await p.waitForTimeout(300);
 for(const [width,height] of matrix){await p.setViewportSize({width,height});await p.waitForTimeout(180);checkLayout(await layout(p));
  const crop=await p.evaluate(()=>{const q=globalThis.__skyQA;q.crop=q.chooseCrop();return q.crop;});
  if(width===1440&&height===900)await p.screenshot({path:path.join(out,'current-star-crop.png'),clip:crop});
  const enter=await trace('Historical'),enterResult=validate(enter);assert(enterResult.heldFrames>0,'Historical handoff was not exercised');
  const first=enter.frames.at(-1);assert(first.presentedHistorical&&!first.animate);assert(delta(enter.before.starTransform,first.starTransform)>1e-6,'Different UTC incorrectly kept fixed stars');
  // Focus/hover changes only: exact same UTC and exact same star pixels.
  const uiOnly=await p.evaluate(async()=>{const q=globalThis.__skyQA,pixels=await q.sample(),before=q.metrics(),frames=[];
   const remove=q.viewers[0].scene.postRender.addEventListener(()=>{const next=q.read(q.crop);let max=0;for(let i=0;i<next.length;i++)max=Math.max(max,Math.abs(next[i]-pixels[i]));frames.push({...q.metrics(),pixelMaxDifference:max});});
   document.querySelector('.context-temporal button:last-child').focus();for(let i=0;i<12;i++)await new Promise(requestAnimationFrame);remove();return {before,frames};});
  for(const f of uiOnly.frames){equal(uiOnly.before,f);coherent(f);assert.deepEqual(f.starTransform,uiOnly.before.starTransform);assert.equal(f.pixelMaxDifference,0);}
  const plus=await trace('Historical forward 10 minutes'),plusResult=validate(plus),next=plus.frames.at(-1);
  assert.equal(Date.parse(next.utc)-Date.parse(first.utc),600000);assert(delta(first.starTransform,next.starTransform)>1e-6);assert(delta(first.iss,next.iss)>1);
  assert(delta(first.sunPositionWC,next.sunPositionWC)>1);assert(delta(first.moonDirectionEC,next.moonDirectionEC)>1e-6);assert(Math.abs(first.illuminationX-next.illuminationX)>1e-6);
  const minus=await trace('Historical back 10 minutes'),minusResult=validate(minus),restored=minus.frames.at(-1);
  assert.equal(Date.parse(restored.utc),Date.parse(first.utc));assert.deepEqual(restored.starTransform,first.starTransform);assert.deepEqual(restored.iss,first.iss);assert.deepEqual(restored.sunPositionWC,first.sunPositionWC);assert.deepEqual(restored.moonDirectionEC,first.moonDirectionEC);
  if(width===1440&&height===900){await p.screenshot({path:path.join(out,'historical-star-crop.png'),clip:crop});await p.screenshot({path:path.join(out,'historical-1440x900.png')});fs.writeFileSync(path.join(out,'enter-frames.json'),JSON.stringify(enter,null,2));fs.writeFileSync(path.join(out,'plus-frames.json'),JSON.stringify(plus,null,2));fs.writeFileSync(path.join(out,'minus-frames.json'),JSON.stringify(minus,null,2));}
  const exit=await trace('Current'),exitResult=validate(exit),returned=exit.frames.at(-1);assert(!returned.presentedHistorical&&returned.animate);assert(delta(restored.starTransform,returned.starTransform)>1e-6);checkLayout(await layout(p));
  if(width===1440&&height===900){await p.screenshot({path:path.join(out,'returned-star-crop.png'),clip:crop});await p.screenshot({path:path.join(out,'current-1440x900.png')});fs.writeFileSync(path.join(out,'exit-frames.json'),JSON.stringify(exit,null,2));assert.deepEqual([exit.before.legend.x,exit.before.legend.y,exit.before.controls.x,exit.before.controls.y],[24,764,1188,760]);}
  report.viewports.push({width,height,crop,current:enter.before,historical:first,plus:next,restored,returned,enter:enterResult,plusTrace:plusResult,minus:minusResult,exit:exitResult,sameUtcUiFrames:uiOnly.frames.length,sameUtcStarPixelDifference:0,result:'PASS'});
  console.log(`${width}x${height}: coherent handoffs, ±10min, same/different UTC PASS`);fs.writeFileSync(path.join(out,'temporal-coherence-qa.json'),JSON.stringify(report,null,2));
 }
 await p.setViewportSize({width:1440,height:900});await p.waitForTimeout(200);await p.evaluate(()=>{globalThis.__skyQA.crop=globalThis.__skyQA.chooseCrop();});
 for(const reduced of ['no-preference','reduce']){await p.emulateMedia({reducedMotion:reduced});
  const rapid=await p.evaluate(async()=>{const q=globalThis.__skyQA,before=q.metrics(),frames=[];const remove=q.viewers[0].scene.postRender.addEventListener(()=>frames.push(q.metrics()));
   for(let i=0;i<60;i++){if(i<24&&i%3===0)document.querySelectorAll('.context-temporal button')[i%6===0?1:0].click();await new Promise(requestAnimationFrame);}remove();return {before,frames};});
  for(const f of rapid.frames){equal(rapid.before,f);coherent(f);}report.rapid.push({reduced,frames:rapid.frames.length,result:'PASS'});
  const enter=await trace('Historical');validate(enter);const plus=await trace('Historical forward 10 minutes');validate(plus);const minus=await trace('Historical back 10 minutes');validate(minus);const exit=await trace('Current');validate(exit);
  report.rapid.at(-1).settledReducedHandoffs='PASS';
 }
 // Deterministic cache-expiry seam: advance only Date.now's elapsed receipt
 // age in this isolated QA page; do not change Cesium's clock, replayAt, API
 // envelopes, camera or native render time. Delay the fresh real Current response.
 // This exercises the outgoing Historical hold without a 10-minute wall wait.
 await historical.click();await p.waitForFunction(()=>document.querySelector('main').getAttribute('aria-busy')==='false');
 await p.route('**/api/iss/orbit/samples',async route=>{const response=await route.fetch();await new Promise(resolve=>setTimeout(resolve,700));await route.fulfill({response});});
 await p.evaluate(()=>{const q=globalThis.__skyQA;q.nativeDateNow=Date.now;Date.now=()=>q.nativeDateNow()+700000;});
 const preparedReturn=await trace('Current'),preparedResult=validate(preparedReturn);assert(preparedResult.heldFrames>0,'Delayed Current preparation was not exercised');
 assert(preparedReturn.frames.at(-1).animate&&!preparedReturn.frames.at(-1).presentedHistorical);report.preparedCurrentReturn={...preparedResult,receiptAgeProbeSeconds:700,realEnvelopesUnchanged:true};
 fs.writeFileSync(path.join(out,'prepared-current-return-frames.json'),JSON.stringify(preparedReturn,null,2));
 await p.evaluate(()=>{Date.now=globalThis.__skyQA.nativeDateNow;});
 report.realInputs={historicalEnvelopes:[...history.values()],currentWindows,comparisons};
 report.resizeActivity=await p.evaluate(()=>({calls:globalThis.__skyQA.resizes,observers:globalThis.__skyQA.observers}));
 assert.deepEqual(report.errors,[]);report.result='PASS';
}finally{fs.writeFileSync(path.join(out,'temporal-coherence-qa.json'),JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
