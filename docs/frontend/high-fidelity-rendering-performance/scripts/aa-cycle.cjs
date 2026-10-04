const out=process.env.MISSION1_EVIDENCE || require('path').resolve(__dirname,'../evidence/diagnostics/aa-cycle-recheck');require('fs').mkdirSync(out,{recursive:true});
const fs=require('fs');
const {chromium}=require(process.env.MISSION1_PLAYWRIGHT_MODULE || 'playwright');
const {viewer}=require('../../occlusion-aware-workspace-centering/scripts/browser-utils.cjs');
let active;
(async()=>{const b=active=await chromium.launch({headless:false,args:['--use-angle=metal']});const c=await b.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
 for(const [api,file] of [['samples','samples'],['comparison','comparison']])await c.route('**/api/iss/orbit/'+api,r=>r.fulfill({json:JSON.parse(fs.readFileSync(require('path').resolve(__dirname,'../evidence/real-'+file+'.json')))}));
 const p=await c.newPage();await p.bringToFront();await p.goto(process.env.MISSION1_URL || 'http://127.0.0.1:4175');await p.waitForFunction(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Inspect ISS')?.disabled===false,null,{timeout:120000});
 await p.evaluate(`window.__v=(${viewer.toString()})();__v.clock.shouldAnimate=false;window.__stage=Array.from({length:__v.scene.postProcessStages.length},(_,i)=>__v.scene.postProcessStages.get(i)).find(s=>s.name==='mission1_inspection_antialiasing');window.__frames=[];__v.scene.postRender.addEventListener(()=>__frames.push(performance.now()));`);
 const rows=[];
 for(const policy of ['retained','disabled-overview']){
 if(policy==='disabled-overview')await p.evaluate(()=>__v.scene.preRender.addEventListener(()=>{__stage.enabled=!!document.querySelector('.inspection-help')||[...document.querySelectorAll('button')].some(b=>b.textContent==='Back to Earth View');}));
 for(let i=0;i<3;i++){
 await p.waitForTimeout(5000);await p.evaluate(()=>{__frames.length=0});
 await p.getByRole('button',{name:'Inspect ISS',exact:true}).click();await p.getByText('Drag to orbit the ISS · Scroll to zoom',{exact:true}).waitFor({timeout:30000});await p.waitForTimeout(1000);
 await p.getByRole('button',{name:'Back to Earth View',exact:true}).click();await p.waitForFunction(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Inspect ISS')?.disabled===false);await p.waitForTimeout(500);
 const frames=await p.evaluate(()=>__frames.slice(1).map((x,i)=>x-__frames[i]));const a=frames.slice().sort((x,y)=>x-y);rows.push({policy,cycle:i,frames,max:Math.max(...frames),p95:a[Math.floor(a.length*.95)],over50:frames.filter(x=>x>50).length});fs.writeFileSync(`${out}/aa-cycle.json`,JSON.stringify(rows,null,2));console.log(JSON.stringify({policy,cycle:i,max:rows.at(-1).max,p95:rows.at(-1).p95,over50:rows.at(-1).over50}));}
 }
 await b.close();})().catch(async e=>{console.error(e);await active?.close();process.exitCode=1});
