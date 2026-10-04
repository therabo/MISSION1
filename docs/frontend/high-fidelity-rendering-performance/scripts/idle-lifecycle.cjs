const fs=require('fs'),assert=require('assert/strict');
const {chromium,ready}=require('../../occlusion-aware-workspace-centering/scripts/browser-utils.cjs');
const evidence=process.env.MISSION1_EVIDENCE_DIR||require('path').resolve(__dirname,'../evidence/regression');fs.mkdirSync(evidence,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});const report=[];try{for(const port of [5175,4175]){
 const p=await browser.newPage({viewport:{width:1440,height:900}});
 await p.addInitScript(()=>{
 const events=window.__workspaceEvents={resize:[],mutation:[],measurements:0,offsetWrites:0,pixelCalls:0,pixelCpuMs:0,frames:[],listeners:[]};
 const NativeResize=ResizeObserver;window.ResizeObserver=class extends NativeResize{constructor(callback){const row={active:true,targets:[],calls:0,totalMs:0};super((entries,observer)=>{const t=performance.now();row.calls++;callback(entries,observer);row.totalMs+=performance.now()-t});this.row=row;events.resize.push(row)}observe(el,options){this.row.targets.push(el.className);return super.observe(el,options)}disconnect(){this.row.active=false;return super.disconnect()}};
 const NativeMutation=MutationObserver;window.MutationObserver=class extends NativeMutation{constructor(callback){const row={active:true,targets:[],calls:0,totalMs:0};super((entries,observer)=>{const t=performance.now();row.calls++;callback(entries,observer);row.totalMs+=performance.now()-t});this.row=row;events.mutation.push(row)}observe(el,options){this.row.targets.push(el.className);return super.observe(el,options)}disconnect(){this.row.active=false;return super.disconnect()}};
 const measure=HTMLElement.prototype.getBoundingClientRect;HTMLElement.prototype.getBoundingClientRect=function(){if(this.matches('.app-shell,.status-panel,.replay-orbit'))events.measurements++;return measure.call(this)};
 const add=window.addEventListener,remove=window.removeEventListener;window.addEventListener=function(type,fn,options){if(type==='resize'&&!events.listeners.some(r=>r.fn===fn&&r.active))events.listeners.push({fn,active:true});return add.call(this,type,fn,options)};window.removeEventListener=function(type,fn,options){if(type==='resize')events.listeners.filter(r=>r.fn===fn).forEach(r=>r.active=false);return remove.call(this,type,fn,options)};
 });
 const errors=[],warnings=[];p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(/ResizeObserver/i.test(m.text()))warnings.push(m.text())});
 await p.goto(`http://127.0.0.1:${port}`);await ready(p);
 await p.evaluate(()=>{const e=window.__workspaceEvents,fr=window.__v.camera.frustum;for(const key of ['xOffset','yOffset']){let value=fr[key];Object.defineProperty(fr,key,{configurable:true,enumerable:true,get:()=>value,set:next=>{e.offsetWrites++;value=next}})}const pixel=fr.getPixelDimensions;fr.getPixelDimensions=function(...args){const t=performance.now();try{return pixel.apply(this,args)}finally{e.pixelCalls++;e.pixelCpuMs+=performance.now()-t}};let previous=performance.now();window.__v.scene.postRender.addEventListener(()=>{const now=performance.now();e.frames.push(now-previous);previous=now});});
 await p.waitForTimeout(1000);
 const snapshot=()=>{const e=window.__workspaceEvents;return {...e,listeners:e.listeners.map(r=>({active:r.active}))}};
 const layoutMutation=rows=>rows.filter(r=>r.active&&r.targets.some(name=>String(name).split(' ').includes('app-shell')));
 const first=await p.evaluate(snapshot);await p.waitForTimeout(10000);const second=await p.evaluate(snapshot);
 const callbacks=key=>second[key].reduce((n,r,i)=>n+r.calls-(first[key][i]?.calls||0),0);
 const idleMeasurements=second.measurements-first.measurements,idleResizeCallbacks=callbacks('resize'),idleMutationCallbacks=callbacks('mutation'),idleOffsetWrites=second.offsetWrites-first.offsetWrites;
 assert.equal(idleMeasurements,0);assert.equal(idleResizeCallbacks,0);assert.equal(idleMutationCallbacks,0);assert.equal(idleOffsetWrites,0);
 assert.equal(second.resize.filter(r=>r.active).length,2);assert.equal(layoutMutation(second.mutation).length,1);assert.equal(second.listeners.filter(r=>r.active).length,1);
 const frameTimes=second.frames.slice(first.frames.length).sort((a,b)=>a-b),cpuMs=second.pixelCpuMs-first.pixelCpuMs,calls=second.pixelCalls-first.pixelCalls;
 for(let i=0;i<4;i++){await p.locator('#crew-launcher').click();await p.locator('.crew-summary').waitFor();await p.getByRole('button',{name:'Close crew panel',exact:true}).click();await p.waitForTimeout(700)}
 const cycled=await p.evaluate(snapshot);assert.equal(cycled.resize.filter(r=>r.active).length,2);assert.equal(layoutMutation(cycled.mutation).length,1);assert.equal(cycled.listeners.filter(r=>r.active).length,1);
 assert.equal(cycled.mutation.filter(r=>r.active).length,second.mutation.filter(r=>r.active).length);
 assert.deepEqual(errors,[]);assert.deepEqual(warnings,[]);
 const row={port,idleSeconds:10,idleMeasurements,idleResizeCallbacks,idleMutationCallbacks,idleOffsetWrites,activeResizeObservers:2,activeLayoutMutationObservers:1,totalActiveMutationObservers:second.mutation.filter(r=>r.active).length,windowResizeListeners:1,frames:frameTimes.length,medianFrameMs:frameTimes[Math.floor(frameTimes.length/2)],p95FrameMs:frameTimes[Math.floor(frameTimes.length*.95)],pixelDimensionCalls:calls,pixelDimensionCpuTotalMs:cpuMs,pixelDimensionCpuMeanMs:calls?cpuMs/calls:0,before:first,after:second,afterFourCrewCycles:cycled,pageErrors:errors,resizeObserverWarnings:warnings};report.push(row);console.log(JSON.stringify({...row,before:undefined,after:undefined,afterFourCrewCycles:undefined}));fs.writeFileSync(`${evidence}/idle-lifecycle.json`,JSON.stringify(report,null,2));await p.close();
}}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
