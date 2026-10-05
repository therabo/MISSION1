// Sequential matched browser benchmark; saved responses are REAL backend captures.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium,viewer,observe}=require('../../occlusion-aware-workspace-centering/scripts/browser-utils.cjs');
const out=path.resolve(__dirname,'../evidence');
function stats(a){a=a.slice().sort((x,y)=>x-y);return {count:a.length,median:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],p99:a[Math.floor(a.length*.99)]};}
(async()=>{const rows=[];for(const [port,label] of [[4185,'baseline'],[4175,'candidate']]){
 const b=await chromium.launch({headless:true,args:['--use-angle=metal']});try{const c=await b.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
 for(const name of ['samples','comparison'])await c.route('**/api/iss/orbit/'+name,r=>r.fulfill({json:JSON.parse(fs.readFileSync(path.join(out,`recorded-real-${name}.json`)))}));
 const p=await c.newPage();await p.goto(`http://127.0.0.1:${port}`);await p.waitForFunction(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Inspect ISS')?.disabled===false,null,{timeout:120000});await p.evaluate(`window.__v=(${viewer})();__v.clock.shouldAnimate=false;`);
 await p.getByRole('button',{name:'Inspect ISS',exact:true}).click();await p.getByText('Drag to orbit the ISS · Scroll to zoom',{exact:true}).waitFor({timeout:30000});await p.waitForTimeout(1200);
 const frozen=await p.evaluate(observe);await p.evaluate(()=>{__v.scene.screenSpaceCameraController.enableInputs=false;window.__nativePick=__v.scene.pick;window.__pickDurations=[];window.__scan=false;__v.scene.pick=function(...args){const start=performance.now(),h=__nativePick.apply(this,args);if(!__scan)__pickDurations.push(performance.now()-start);return h;};});
 const point=await p.evaluate(()=>{__scan=true;try{for(let y=390;y<660;y+=5)for(let x=640;x<800;x+=5){const h=__v.scene.pick({x,y});if(typeof h?.featureId==='number')return {x,y,id:h.featureId};}}finally{__scan=false;}});assert(point);
 for(const mode of label==='candidate'?['normal','hover']:['normal']){
 await p.mouse.move(mode==='hover'?point.x:1400,mode==='hover'?point.y:80);await p.waitForTimeout(10_000);
 const timing=await p.evaluate(async()=>{const t=[];const remove=__v.scene.postRender.addEventListener(()=>t.push(performance.now()));__pickDurations=[];await new Promise(r=>setTimeout(r,15000));remove();return {intervals:t.slice(1).map((x,i)=>x-t[i]),pickDurations:__pickDurations,visibility:document.visibilityState,dpr:devicePixelRatio,canvas:[__v.canvas.width,__v.canvas.height]};});
 const pose=await p.evaluate(observe);assert.deepEqual(pose.position,frozen.position);assert.deepEqual(pose.direction,frozen.direction);assert.equal(timing.pickDurations.length,0);assert(timing.intervals.length>200);
 rows.push({label,port,mode,point,pose,...timing,statistics:stats(timing.intervals)});fs.writeFileSync(path.join(out,'performance.json'),JSON.stringify(rows,null,2));console.log(JSON.stringify({label,mode,...rows.at(-1).statistics,picks:timing.pickDurations.length}));
 }
 }finally{await b.close();}}
})().catch(e=>{console.error(e);process.exitCode=1;});
