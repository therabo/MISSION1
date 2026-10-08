/* Native browser/SDK QA only. No shipped instrumentation or data fixtures.
 * node native-responsive-interactions.cjs URL development|production
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,viewer,observe}=require('../../occlusion-aware-workspace-centering/scripts/browser-utils.cjs');
const {scan}=require('../../inspection-module-hover/scripts/surface-scan.cjs');
const {geometry}=require('./responsive-matrix.cjs');
const root=path.resolve(__dirname,'../../../..');
const mappings=JSON.parse(fs.readFileSync(path.join(root,'frontend/src/cesium/issModelManifest.json'))).semanticMappings;
const nodes=JSON.parse(fs.readFileSync(path.join(root,'docs/frontend/inspection-orientation-review/asset-axes.json'))).nodes;
const [url='http://127.0.0.1:5175/',build='development']=process.argv.slice(2);
const out=path.resolve(process.env.MISSION1_QA_OUTPUT || path.join(__dirname,'native',build));fs.mkdirSync(out,{recursive:true});
const report={url,build,viewports:[],errors:[],console:[]};
const save=()=>fs.writeFileSync(path.join(out,'interactions.json'),JSON.stringify(report,null,2)+'\n');
async function run(){
 const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});
 try{
  const p=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1,hasTouch:true});
  p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error'||/ResizeObserver/.test(m.text()))report.console.push(m.text());});
  await p.goto(url);await p.waitForFunction(()=>[...document.querySelectorAll('button')].some(e=>e.textContent==='ISS Inspection'&&!e.disabled),null,{timeout:120000});
  await p.evaluate(`window.__v=(${viewer.toString()})();window.__model=Array.from({length:__v.scene.primitives.length},(_,i)=>__v.scene.primitives.get(i)).find(p=>typeof p.id==='string'&&p.id.includes('iss'));window.__originalCanvas=__v.canvas;window.__scan=false;`);
  await p.evaluate(()=>{
   window.__features=new Map();window.__originals=new Map();const original=__v.scene.pick;
   __v.scene.pick=function(...args){const h=original.apply(this,args);if(typeof h?.featureId==='number'&&h.getProperty?.('moduleCode')){__features.set(h.featureId,h);if(!__originals.has(h.featureId)){const c=h.color;__originals.set(h.featureId,[c.red,c.green,c.blue,c.alpha]);}}return h;};
   window.__colors=()=>[...__features].map(([id,f])=>({id,color:[f.color.red,f.color.green,f.color.blue,f.color.alpha]}));
  });
  const mode=async m=>{await p.waitForFunction(m=>document.querySelector('main').dataset.viewMode===m,m,{timeout:45000});await p.waitForTimeout(400);};
  async function hit(except=null){for(const mapping of mappings.filter(m=>m.featureId!==except)){const point=await p.evaluate(scan,{mapping,node:nodes.find(n=>n.index===mapping.nodeIndex)});if(point)return {mapping,point};}return null;}
  const colors=()=>p.evaluate(()=>__colors());
  const tinted=async()=> (await colors()).filter(r=>r.color.slice(0,3).some(x=>x<.99)).map(r=>r.id);
  for(const [width,height] of [[1440,900],[1280,720],[1024,768],[900,700],[768,1024],[390,844],[320,568],[844,390]]){
   await p.setViewportSize({width,height});await p.waitForTimeout(250);
   const g=await p.evaluate(geometry);assert.deepEqual(g.failures,[]);const earth=await p.evaluate(observe);assert(earth.error<2);
   // Start a native drag in an actually exposed canvas rectangle.
   const exposed=await p.evaluate(()=>{const c=__v.canvas;for(let y=innerHeight*.45;y<innerHeight*.65;y+=10)for(let x=innerWidth*.3;x<innerWidth*.6;x+=10)if(document.elementFromPoint(x,y)===c&&document.elementFromPoint(x+24,y+12)===c)return {x,y};return null;});assert(exposed);
   await p.mouse.move(exposed.x,exposed.y);await p.mouse.down();await p.mouse.move(exposed.x+24,exposed.y+12,{steps:6});await p.mouse.up();await p.waitForTimeout(1400);
   const dragged=await p.evaluate(observe);assert(Math.hypot(...dragged.position.map((x,i)=>x-earth.position[i]))>1);
   await p.mouse.wheel(0,-100);await p.waitForTimeout(500);const zoomed=await p.evaluate(observe);assert(Math.hypot(...zoomed.position.map((x,i)=>x-dragged.position[i]))>1);
   await p.getByRole('button',{name:'Reset view',exact:true}).click();await p.waitForTimeout(700);
   const before=await p.evaluate(observe);
   await p.getByRole('button',{name:'ISS Inspection',exact:true}).click();await mode('ISS_INSPECTION');
   const canonical=await p.evaluate(observe);assert(Math.abs(canonical.range-90*Math.max(1,1.2/(width/height)))<.02);assert(Math.abs(canonical.elevation-42.5)<.001);assert(Math.abs(canonical.nativeFovDegrees-100)<.001);assert(canonical.error<2);
   assert.deepEqual((await p.evaluate(geometry)).failures,[]);
   const a=await hit();assert(a,'Native module at '+width);await p.mouse.move(a.point.x,a.point.y);await p.waitForTimeout(400);assert((await tinted()).includes(a.mapping.featureId));
   await p.mouse.down();assert.deepEqual(await tinted(),[],'Hover persists during camera movement');await p.mouse.move(a.point.x+18,a.point.y+8,{steps:5});await p.mouse.up();await p.waitForTimeout(1700);
   const orbited=await p.evaluate(observe);assert(Math.hypot(...orbited.direction.map((x,i)=>x-canonical.direction[i]))>1e-5);
   const b=await hit();assert(b);await p.mouse.move(b.point.x,b.point.y);await p.waitForTimeout(350);await p.mouse.wheel(0,-90);assert.deepEqual(await tinted(),[],'Hover persists during wheel');await p.waitForTimeout(500);assert(Math.abs((await p.evaluate(observe)).range-orbited.range)>1);
   const selected=await hit();assert(selected);await p.mouse.click(selected.point.x,selected.point.y);await p.locator('.module-dock[data-state="open"]').waitFor();await p.mouse.move(2,2);await p.waitForTimeout(300);assert.equal(await p.locator('.module-dock').getAttribute('data-entity-id'),selected.mapping.componentId);
   const dockGeometry=await p.evaluate(geometry);assert.deepEqual(dockGeometry.failures,[]);
   // Public GPU scan rejects overlay pixels. Confirm pass-through immediately
   // outside each dock edge; every point underneath it must hit the dock.
   const boundary=await p.evaluate(()=>{const d=document.querySelector('.module-dock').getBoundingClientRect(),y=Math.max(d.top+20,Math.min(innerHeight-20,d.top+d.height/2));return {inside:document.elementFromPoint(d.left+2,y)?.closest('.module-dock')!==null,outside:document.elementFromPoint(d.left-2,y)===__v.canvas};});assert(boundary.inside&&boundary.outside);
   const second=await hit(selected.mapping.featureId);if(second){await p.mouse.click(second.point.x,second.point.y);await p.waitForFunction(id=>document.querySelector('.module-dock')?.dataset.entityId===id,second.mapping.componentId);}
   await p.screenshot({path:path.join(out,`${width}x${height}-native-module.png`)});
   await p.getByRole('button',{name:'Close module information',exact:true}).click();await p.locator('.module-dock').waitFor({state:'detached'});await p.mouse.move(2,2);await p.waitForTimeout(150);assert.deepEqual(await tinted(),[]);
   for(const r of await colors())assert.deepEqual(r.color,await p.evaluate(id=>__originals.get(id),r.id));
   await p.getByRole('button',{name:'Earth',exact:true}).click();await mode('EARTH_OVERVIEW');
   const after=await p.evaluate(observe);assert(Math.hypot(...after.position.map((x,i)=>x-before.position[i]))<.02);assert(await p.evaluate(()=>__originalCanvas===document.querySelector('canvas')&&document.querySelectorAll('.cesium-viewer').length===1));
   report.viewports.push({width,height,earth,canonical,drag:true,wheel:true,reset:true,orbit:true,hover:true,hoverClearsDuringMotion:true,nativePicking:true,boundary,AtoB:!!second,colorsRestored:true,back:true,result:'PASS'});save();console.log(`${width}x${height}: native Earth / Inspection / hover / picking / Back PASS`);
  }
  assert.deepEqual(report.errors,[]);assert(!report.console.some(s=>/ResizeObserver|React|Uncaught/.test(s)));report.result='PASS';save();
 }finally{save();await browser.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
