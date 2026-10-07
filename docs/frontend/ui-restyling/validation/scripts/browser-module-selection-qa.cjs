/* Real feature colors, native GPU picks and real backend envelopes. Reuse the
 * Inspection/astronomy observer without changing shipped source or API data.
 * node browser-module-selection-qa.cjs [url] [development|production]
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
let inspection=fs.readFileSync(path.join(__dirname,'browser-inspection-qa.cjs'),'utf8');
const start=' report.viewports=[];report.intermediate=[];',end=' report.resizeActivity=';
assert.equal(inspection.split(start).length,2);assert.equal(inspection.split(end).length,2);

async function moduleScenario(){
 await p.evaluate(()=>{
  const q=__skyQA;q.features=new Map();q.originalColors=new Map();q.originalBlend={mode:__model.colorBlendMode,amount:__model.colorBlendAmount};
  const native=__v.scene.pick;__v.scene.pick=function(...args){const hit=native.apply(this,args);if(typeof hit?.featureId==='number'&&hit.getProperty?.('moduleCode')){
   q.features.set(hit.featureId,hit);if(!q.originalColors.has(hit.featureId)){const c=hit.color;q.originalColors.set(hit.featureId,[c.red,c.green,c.blue,c.alpha]);}
  }return hit;};
  q.colors=()=>[...q.features].map(([id,f])=>({id,color:[f.color.red,f.color.green,f.color.blue,f.color.alpha]}));
  q.selectionRef=()=>{const e=document.querySelector('.earth-view');let f=e[Object.keys(e).find(k=>k.startsWith('__reactFiber'))];for(;f;f=f.return)for(let h=f.memoizedState;h;h=h.next){const ref=h.memoizedState;if(ref?.current?.componentId&&typeof ref.current.featureId==='number')return ref;}return null;};
 });
 const selectedColor=[83/255,217/255,205/255,1];
 const colors=()=>p.evaluate(()=>__skyQA.colors());
 const selectedIds=async()=> (await colors()).filter(r=>delta(r.color,selectedColor)<1e-12).map(r=>r.id);
 const clear=async()=>{await p.mouse.move(2,2);await p.waitForTimeout(150);};
 const closeDock=async()=>{await p.getByRole('button',{name:'Close module information',exact:true}).click();await p.waitForFunction(()=>!document.querySelector('.module-dock'));await clear();};
 async function checkRestored(){const state=await p.evaluate(()=>({colors:__skyQA.colors(),originals:[...__skyQA.originalColors],blend:{mode:__model.colorBlendMode,amount:__model.colorBlendAmount},native:__skyQA.lastSelectionRef?.current?.componentId??null}));
  for(const r of state.colors)assert.deepEqual(r.color,state.originals.find(([id])=>id===r.id)[1],'Original feature color leaked');assert.deepEqual(state.blend,await p.evaluate(()=>__skyQA.originalBlend));assert.equal(state.native,null,'Close did not synchronize native ref');return state;
 }
 async function findHit(excluded=new Set(),preferred=null,adjust=true){
  const mappings=preferred?[preferred,...manifest.semanticMappings.filter(m=>m!==preferred)]:manifest.semanticMappings;
  const search=async()=>{for(const module of mappings.filter(m=>!excluded.has(m.featureId))){const point=await p.evaluate(scan,{mapping:module,node:nodes.find(n=>n.index===module.nodeIndex)});if(point)return {module,point};}return null;};
  let hit=await search();if(hit||!adjust)return hit;
  for(const offset of [[-119,0,0],[119,0,0],[0,-150,0],[0,150,0],[0,0,-119],[0,0,119],[-100,-100,70],[100,100,-70]]){await p.evaluate(off=>__v.camera.lookAtTransform(__v.camera.transform,new __v.camera.position.constructor(...off)),offset);await p.waitForTimeout(450);hit=await search();if(hit)return hit;}
  return null;
 }
 function cameraStable(a,b){stableScene(a,b);assert.equal(a.resizes,b.resizes,'Dock lifecycle resized Viewer');assert.deepEqual(a.frustum,b.frustum);assert.deepEqual(a.controller,b.controller);
  for(const k of ['position','direction','up','right'])assert(delta(a.camera[k],b.camera[k])<(k==='position'?1e-6:1e-9),'Dock changed local camera '+k);
  if(a.presentedHistorical){sameInspectionCamera(a.camera,b.camera);assert.equal(a.utc,b.utc);assert.deepEqual(a.starTransform,b.starTransform);assert.deepEqual(a.sunPositionWC,b.sunPositionWC);}
  assert.equal(a.source,b.source);assert.equal(a.mode,b.mode);coherent(b);
 }
 async function select(hit){assert(hit);const before=await metrics();await p.mouse.click(hit.point.x,hit.point.y);await p.waitForFunction(id=>document.querySelector('.module-dock[data-state="open"]')?.dataset.entityId===id,hit.module.componentId);await p.evaluate(()=>{__skyQA.lastSelectionRef=__skyQA.selectionRef();});
  assert.equal(await p.locator('.module-dock h2').innerText(),hit.module.displayName);assert.equal(await p.locator('.inspection-selection strong').innerText(),hit.module.displayName);assert.equal(await p.locator('.module-dock').count(),1);assert.equal(await p.locator('.module-panel').count(),0);
  assert.equal(await p.evaluate(()=>__skyQA.lastSelectionRef?.current.componentId),hit.module.componentId);assert.deepEqual(await selectedIds(),[hit.module.featureId]);cameraStable(before,await metrics());return {before,after:await metrics(),module:hit.module.componentId,feature:hit.module.featureId,result:'PASS'};
 }
 async function dockLayout(){return p.locator('.module-dock').evaluate(d=>{const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};},css=getComputedStyle(d),head=d.querySelector('header'),clipped=[];
  for(const e of d.querySelectorAll('h2,h3,p,dt,dd,a')){const range=document.createRange();range.selectNodeContents(e);const r=range.getBoundingClientRect(),b=e.getBoundingClientRect();if(r.width&& (r.left<b.left-1||r.right>b.right+1))clipped.push(e.textContent);}
  return {...box(d),fill:css.backgroundColor,radius:css.borderRadius,shadow:css.boxShadow,blur:css.backdropFilter,header:box(head),close:box(d.querySelector('button')),content:box(d.querySelector('.context-dock-content')),footer:box(d.querySelector('footer')),clipped,overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight,canvasFocusFree:document.elementFromPoint(innerWidth/2,innerHeight/2)===document.querySelector('canvas'),scrollHeight:d.scrollHeight,clientHeight:d.clientHeight};
 });}
 async function dockUsable(){const l=await dockLayout();assert(!l.overflow);assert.deepEqual(l.clipped,[]);assert(l.canvasFocusFree,'Dock blocks native model focus');assert.equal(l.fill,'rgba(21, 29, 39, 0.5)');assert.equal(l.radius,'6px');assert.equal(l.shadow,'none');assert.equal(l.blur,'none');assert(l.x>=0&&l.y>=0&&l.x+l.width<=innerViewport().width);
  const size=await p.viewportSize();assert(l.y+l.height<=size.height);if(size.width<1244)assert(l.close.width>=44&&l.close.height>=44);
  const before=await metrics();for(const name of ['Evidence & provenance — NASA VTAD source model','Component reference']){await p.getByRole('link',{name,exact:true}).evaluate(e=>e.scrollIntoView({block:'nearest'}));const b=await p.getByRole('link',{name,exact:true}).boundingBox();assert(b.y>=l.y&&b.y+b.height<=l.y+l.height+.5,'Evidence unreachable');}
  await p.locator('.module-dock').evaluate(d=>{d.scrollTop=0;d.querySelector('.context-dock-content').scrollTop=0;});cameraStable(before,await metrics());return l;
 }
 // All bounds come from the actual Playwright viewport, including intermediate widths.
 let viewport={width:1440,height:900};function innerViewport(){return viewport;}
 report.viewports=[];report.intermediate=[];
 const requested=[...matrix,...intermediateWidths.map(width=>[width,900])];
 for(const [width,height] of requested){viewport={width,height};await p.setViewportSize(viewport);await p.waitForTimeout(220);checkLayout(await layout(p));report.earthSnapshot=await metrics();const entry=await spatial('ISS Inspection');await clear();
  const a=await findHit(new Set(),width===1440?manifest.semanticMappings.find(m=>m.componentId==='ZVEZDA'):null);assert(a,'No verified module on this viewport');const first=await select(a);await p.waitForTimeout(280);const geometry=await dockUsable();
  if(width===1440&&height===900){assert.deepEqual([geometry.x,geometry.y,geometry.width,geometry.height],[1080,88,336,708]);report.figma={geometry,module:a.module.componentId};}
  if(matrix.some(([w,h])=>w===width&&h===height))await p.screenshot({path:path.join(out,width+'x'+height+'-module-selected.png')});
  const secondHit=await findHit(new Set([a.module.featureId]));assert(secondHit,'No second module outside dock');const beforeSwitch=await p.locator('.module-dock').evaluate(e=>{globalThis.__sameDock=e;return e.dataset.entityId;});const second=await select(secondHit);assert.equal(await p.locator('.module-dock').evaluate(e=>e===globalThis.__sameDock),true,'A→B remounted dock');assert.notEqual(second.module,beforeSwitch);
  const beforeClose=await metrics();await closeDock();cameraStable(beforeClose,await metrics());const restoration=await checkRestored();checkInspection(await inspectionLayout(),await p.evaluate(observe));const exit=await spatial('Earth');
  const row={width,height,geometry,first,second,restoration,entry:{...entry,rawFrames:undefined},exit:{...exit,rawFrames:undefined},result:'PASS'};(matrix.some(([w,h])=>w===width&&h===height)?report.viewports:report.intermediate).push(row);console.log(width+'x'+height+': select / switch / close PASS');fs.writeFileSync(path.join(out,'module-selection-qa.json'),JSON.stringify(report,null,2));
 }
 await p.setViewportSize({width:1440,height:900});viewport={width:1440,height:900};await p.waitForTimeout(220);report.earthSnapshot=await metrics();await spatial('ISS Inspection');await clear();
 // Native feature-color snapshots: normal, hover, selection, A selected + B hover, restored.
 const a=await findHit(),b=await findHit(new Set([a.module.featureId]));assert(a&&b);report.highlight={normal:await colors()};await p.screenshot({path:path.join(out,'highlight-normal.png')});
 await p.mouse.move(a.point.x,a.point.y);await p.waitForTimeout(350);const hovered=await colors();assert(hovered.find(r=>r.id===a.module.featureId).color.some((v,i)=>v!==[1,1,1,1][i]));assert.deepEqual(await selectedIds(),[]);assert.equal(await p.locator('.module-dock').count(),0);report.highlight.hover=hovered;await p.screenshot({path:path.join(out,'highlight-hover.png')});
 await select(a);await p.waitForTimeout(280);await p.screenshot({path:path.join(out,'highlight-selected.png')});
 await p.mouse.move(b.point.x,b.point.y);await p.waitForTimeout(350);assert.deepEqual(await selectedIds(),[a.module.featureId]);report.highlight.selectedPlusHover=await colors();assert(report.highlight.selectedPlusHover.find(r=>r.id===b.module.featureId).color.some((v,i)=>v!==[1,1,1,1][i]));await p.screenshot({path:path.join(out,'highlight-selected-plus-hover.png')});
 await clear();assert.deepEqual(await selectedIds(),[a.module.featureId]);await select(b);assert.deepEqual(await selectedIds(),[b.module.featureId]);await closeDock();report.highlight.restored=await checkRestored();await p.screenshot({path:path.join(out,'highlight-restored.png')});
 // All supported identities, both real orbital sources, plus unmapped exclusion.
 report.modules=[];await spatial('Earth');
 for(const source of ['PRIMARY_GP_TLE','NASA_OEM']){await p.getByLabel('Orbital source',{exact:true}).selectOption(source);await p.waitForTimeout(400);report.earthSnapshot=await metrics();await spatial('ISS Inspection');const seen=new Set();
  while(seen.size<14){const hit=await findHit(seen);assert(hit,'Verified module unreachable');await select(hit);await closeDock();await checkRestored();seen.add(hit.module.featureId);report.modules.push({source,module:hit.module.componentId,feature:hit.module.featureId,result:'PASS'});}
  const valid=await findHit();await select(valid);const unmapped=await p.evaluate(scan,{unmapped:true});assert(unmapped);await p.mouse.click(unmapped.x,unmapped.y);await p.waitForFunction(()=>!document.querySelector('.module-dock'));assert.deepEqual(await selectedIds(),[]);await clear();await checkRestored();report.unmapped={point:unmapped,clearsExistingSelection:true,result:'PASS'};await spatial('Earth');
 }
 await p.getByLabel('Orbital source',{exact:true}).selectOption('PRIMARY_GP_TLE');
 // Historical follows the accepted envelope. UI-only changes have identical sky pixels.
 await historical.click();await p.waitForFunction(()=>document.querySelector('main').getAttribute('aria-busy')==='false');await p.getByRole('button',{name:'Historical back 10 minutes',exact:true}).click();await p.waitForFunction(()=>document.querySelector('main').getAttribute('aria-busy')==='false');report.earthSnapshot=await metrics();await spatial('ISS Inspection');await clear();
 const h=await findHit();const target=(await metrics()).utc;await p.evaluate(()=>{__skyQA.crop=__skyQA.chooseCrop();});const skyBefore=await p.evaluate(()=>__skyQA.sample().then(x=>Array.from(x)));await select(h);await p.waitForTimeout(280);const skyAfter=await p.evaluate(()=>__skyQA.sample().then(x=>Array.from(x)));assert.deepEqual(skyBefore,skyAfter);assert.equal(await p.locator('.module-dock time').getAttribute('datetime'),target);assert((await p.locator('.module-dock').innerText()).includes('not reconstructed'));
 assert(await current.isDisabled());assert(await historical.isDisabled());assert.equal(await p.locator('.historical-time-bar:not([inert])').count(),0);await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('.module-dock'));assert.equal((await metrics()).mode,'ISS_INSPECTION');assert.equal((await metrics()).utc,target);await checkRestored();report.historical={target,module:h.module.componentId,skyPixelDifference:0,seekWhileSelected:'Existing Inspection guard prevents seek/mode change; returning to Earth clears selection',result:'PASS'};await spatial('Earth');
 await current.click();await p.waitForFunction(()=>document.querySelector('main').getAttribute('aria-busy')==='false');report.earthSnapshot=await metrics();await spatial('ISS Inspection');
 // A→B→C, close during entry and reopen while exit is pending. Native picks remain authoritative.
 const hits=[];for(let i=0;i<3;i++){const hit=await findHit(new Set(hits.map(x=>x.module.featureId)));assert(hit);hits.push(hit);await select(hit);}assert.deepEqual(await selectedIds(),[hits[2].module.featureId]);await closeDock();
 await select(hits[0]);await p.getByRole('button',{name:'Close module information',exact:true}).evaluate(e=>e.click());await select(hits[1]);await p.waitForTimeout(350);assert.equal(await p.locator('.module-dock h2').innerText(),hits[1].module.displayName);assert.deepEqual(await selectedIds(),[hits[1].module.featureId]);await closeDock();report.rapid={finalModule:hits[2].module.componentId,staleExitCancelled:true,result:'PASS'};
 // Inspect exact CSS keyframes at runtime; reduced preference removes translation.
 report.motion=[];
 for(const reduced of ['no-preference','reduce']){await p.emulateMedia({reducedMotion:reduced});const hit=await findHit();await select(hit);const enter=await p.locator('.module-dock').evaluate(e=>e.getAnimations().map(a=>({timing:a.effect.getTiming(),frames:a.effect.getKeyframes()})));assert(enter.length);assert.equal(enter[0].timing.duration,reduced==='reduce'?120:240);assert(enter[0].frames.every(f=>reduced!=='reduce'||!f.transform));
  await p.getByRole('button',{name:'Close module information',exact:true}).evaluate(e=>e.click());const exit=await p.locator('.module-dock').evaluate(e=>({inert:e.hasAttribute('inert'),hidden:e.getAttribute('aria-hidden'),motion:e.getAnimations().map(a=>({timing:a.effect.getTiming(),frames:a.effect.getKeyframes()}))}));assert(exit.inert);assert.equal(exit.hidden,'true');assert.equal(exit.motion[0].timing.duration,reduced==='reduce'?120:200);assert(exit.motion[0].frames.every(f=>reduced!=='reduce'||!f.transform));await p.waitForFunction(()=>!document.querySelector('.module-dock'));await clear();await checkRestored();report.motion.push({reduced,enter,exit,result:'PASS'});
 }
 await p.emulateMedia({reducedMotion:'no-preference'});await spatial('Earth');
 // Long identities also fit the compact persistent strip, with no abbreviation.
 report.longNames=[];
 for(const [width,height] of [[320,568],[390,844],[430,932]]){await p.setViewportSize({width,height});await p.waitForTimeout(220);report.earthSnapshot=await metrics();await spatial('ISS Inspection');const module=manifest.semanticMappings.find(m=>m.componentId==='KIBO_PRESSURIZED_MODULE');let point;
  for(const offset of [null,[-119,0,0],[119,0,0],[0,-150,0],[0,150,0],[0,0,-119],[0,0,119],[-100,-100,70],[100,100,-70]]){if(offset){await p.evaluate(off=>__v.camera.lookAtTransform(__v.camera.transform,new __v.camera.position.constructor(...off)),offset);await p.waitForTimeout(450);}point=await p.evaluate(scan,{mapping:module,node:nodes.find(n=>n.index===module.nodeIndex)});if(point)break;}assert(point);await select({module,point});await p.waitForTimeout(280);const geometry=await inspectionLayout();assert.deepEqual(geometry.clipped,[],'Long module identity clipped');await closeDock();await spatial('Earth');report.longNames.push({width,height,module:module.componentId,result:'PASS'});
 }
 // Native touch picking, dock-scroll isolation, orbit/pinch outside the dock.
 await p.setViewportSize({width:390,height:844});viewport={width:390,height:844};await p.waitForTimeout(220);report.earthSnapshot=await metrics();await spatial('ISS Inspection');const hit=await findHit();const cdp=await p.context().newCDPSession(p);const touch=async(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y,id])=>({x,y,id}))});
 await touch('touchStart',[[hit.point.x,hit.point.y,1]]);await touch('touchEnd',[]);await p.waitForFunction(()=>!!document.querySelector('.module-dock[data-state="open"]'));await p.waitForTimeout(300);await p.evaluate(()=>{__skyQA.lastSelectionRef=__skyQA.selectionRef();});
 const beforeScroll=await metrics(),dock=await dockLayout();await p.mouse.move(dock.x+30,dock.y+dock.height-40);await p.mouse.wheel(0,400);await p.waitForTimeout(180);cameraStable(beforeScroll,await metrics());const scroll=await p.locator('.module-dock').evaluate(e=>e.scrollTop);assert(scroll>0,'Touch-sized dock cannot scroll');
 const beforeOrbit=await metrics();await touch('touchStart',[[90,420,1]]);for(let i=1;i<=8;i++){await touch('touchMove',[[90+i*4,420+i*2,1]]);await p.waitForTimeout(16);}await touch('touchEnd',[]);await p.waitForTimeout(1800);const afterOrbit=await metrics();assert(delta(beforeOrbit.camera.direction,afterOrbit.camera.direction)>1e-5);assert.equal(await p.locator('.module-dock').evaluate(e=>e.scrollTop),scroll,'Scene drag scrolled dock');assert.deepEqual(await selectedIds(),[hit.module.featureId]);
 await touch('touchStart',[[45,420,1],[160,420,2]]);await touch('touchMove',[[25,420,1],[180,420,2]]);await touch('touchEnd',[]);await p.waitForTimeout(300);assert(Math.abs(Math.hypot(...(await metrics()).camera.position)-Math.hypot(...afterOrbit.camera.position))>1);await closeDock();await checkRestored();await spatial('Earth');report.touch={nativePicking:true,dockScrollIsolated:true,orbit:true,pinch:true,result:'PASS'};
 report.realInputs={historicalEnvelopes:[...history.values()],currentWindows,comparisons};
}

const code=moduleScenario.toString(),body=code.slice(code.indexOf('{')+1,code.lastIndexOf('}'));
const escaped=body.replaceAll('\\','\\\\').replaceAll('`','\\`').replaceAll('${','\\${');
inspection=inspection.slice(0,inspection.indexOf(start))+escaped+inspection.slice(inspection.indexOf(end));
inspection=inspection.replaceAll("'inspection-qa.json'","'module-selection-qa.json'");
new Function('require','__dirname','process',inspection)(require,__dirname,process);
