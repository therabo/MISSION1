/* Native compact-face / outer-target QA. Actual API data, no scene fixtures.
 * Node 24: node secondary-controls-qa.cjs URL BUILD OUTPUT
 * Broader states and scene behavior use the existing matrix/native scripts.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,viewer}=require('../../occlusion-aware-workspace-centering/scripts/browser-utils.cjs');
const {geometry}=require('./responsive-matrix.cjs');
const [url='http://127.0.0.1:5175/',build='development',out='/tmp/mission1-secondary-qa']=process.argv.slice(2);
fs.mkdirSync(out,{recursive:true});
const matrix=[[1920,1080],[1600,900],[1440,900],[1280,720],[1024,768],[900,700],[834,1194],[820,1180],[768,1024],[430,932],[412,915],[390,844],[375,812],[360,800],[320,568],[844,390],[932,430]];
const resume=process.env.MISSION1_QA_RESUME==='resize';
const report=resume?JSON.parse(fs.readFileSync(path.join(out,'secondary.json'))):{url,build,viewports:[],resize:[],errors:[],console:[]};
if(resume){assert.equal(report.url,url);assert.equal(report.build,build);assert.equal(report.viewports.length,17);report.resize=[];}
const save=()=>fs.writeFileSync(path.join(out,'secondary.json'),JSON.stringify(report,null,2)+'\n');
function measure() {
  const dialog=document.querySelector('.cesium-credit-lightbox-overlay');
  const modal=dialog&&getComputedStyle(dialog).display!=='none';
  const calendar=document.querySelector('#historical-calendar');
  const calendarOpen=calendar&&calendar.checkVisibility({visibilityProperty:true});
  const visible=e=>e.checkVisibility({visibilityProperty:true})&&!e.closest('[inert]')&&(!modal||dialog.contains(e))&&(!calendarOpen||!e.closest('.earth-scene-controls'));
  const rect=e=>e.getBoundingClientRect().toJSON();
  const face=e=>{const c=getComputedStyle(e,'::before');return c.content==='none'?rect(e):{width:parseFloat(c.width),height:parseFloat(c.height)};};
  const controls=[...document.querySelectorAll('.earth-scene-controls button,.secondary-close,.calendar-actions button,.calendar-time-control select,.cesium-credit-lightbox-close')].filter(visible).map(e=>{
    const b=rect(e),icon=e.querySelector('.secondary-icon');
    const v=e.matches('select')?face(e.parentElement):face(e);
    const points=[[b.x+b.width/2,b.y+b.height/2],[b.x+2,b.y+b.height/2],[b.right-2,b.y+b.height/2]];
    const exposed=points.every(([x,y])=>{const h=document.elementFromPoint(x,y);return h===e||e.contains(h);});
    return {name:e.getAttribute('aria-label')||e.textContent.trim(),target:b,face:v,icon:icon?rect(icon):null,
      exposed,font:getComputedStyle(e).fontSize,focus:getComputedStyle(e).outlineStyle};
  });
  const legend=document.querySelector('.trajectory-legend'),c=getComputedStyle(legend),s=getComputedStyle(legend.querySelector('span'));
  return {width:innerWidth,height:innerHeight,controls,legend:{box:rect(legend),font:c.fontSize,line:c.lineHeight,gap:s.gap,backing:getComputedStyle(legend,'::before').inset,marker:rect(legend.querySelector('i')),text:legend.textContent},geometry:geometry()};
}
async function run(){
 const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});
 try{
  const p=await browser.newPage({viewport:{width:1440,height:900},hasTouch:false});p.setDefaultTimeout(90000);
  p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error'||/ResizeObserver/.test(m.text()))report.console.push(m.text());});
  await p.goto(url);await p.evaluate(()=>document.fonts.ready);await p.waitForFunction(()=>!document.querySelector('[aria-label="ISS Inspection"]').disabled);
  await p.evaluate(`window.geometry=(${geometry.toString()});window.__v=(${viewer.toString()})();window.__originalCanvas=__v.canvas;`);
  const action=n=>p.getByRole('button',{name:n,exact:true}),bar=p.locator('.historical-time-bar');
  const ready=async()=>p.waitForFunction(()=>document.querySelector('main').getAttribute('aria-busy')==='false');
  const check=async()=>{const s=await p.evaluate(measure);if(s.geometry.failures.length){fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify(s,null,2));await p.screenshot({path:path.join(out,'failure.png')});console.log(await p.evaluate(()=>{const e=document.querySelector('.cesium-credit-lightbox-close'),b=e.getBoundingClientRect();return {width:innerWidth,rect:b.toJSON(),hit:document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.outerHTML.slice(0,500),overlay:getComputedStyle(e.closest('.cesium-credit-lightbox-overlay')).display};}));}assert.deepEqual(s.geometry.failures,[]);for(const c of s.controls){if(s.width<=1243){assert(c.face.width<=c.target.width+0.5&&c.face.height<=c.target.height+0.5,`${c.name} face exceeds target`);assert(c.target.width>=40||c.name.startsWith('UTC'));assert(c.target.height>=40);if(!c.name.startsWith('UTC'))assert(c.exposed,`${c.name} outer target occluded`);if(c.name.startsWith('Zoom')){assert.equal(c.face.width,s.width<=379?32:s.width<=740?34:38);assert.equal(c.face.height,c.face.width);}if(c.name.startsWith('Close'))assert.equal(c.face.width,s.width<=379?30:s.width<=740?32:38);}}return s;};
  for(const [width,height]of resume?[]:matrix){
   await p.setViewportSize({width,height});await action('Current').click();await ready();await bar.waitFor({state:'detached'});
   const current=await check();
   if([1440,768,390,360,320,844].includes(width)){await p.waitForTimeout(200);await p.screenshot({path:path.join(out,`${width}x${height}-current.png`)});}
   await p.keyboard.press('Tab');
   for(const name of ['Zoom out','Zoom in','Reset view']){await action(name).focus();assert.equal(await action(name).evaluate(e=>getComputedStyle(e).outlineStyle),'solid');}
   await action('Historical').click();await ready();
   if(width<=740){await action('Open Historical controls').click();await p.waitForFunction(()=>document.querySelector('.historical-time-bar').dataset.disclosure==='EXPANDED');}
   await p.locator('.historical-date').click();await p.locator('#historical-calendar').waitFor();await p.waitForTimeout(200);
   const calendar=await check();
   if([1440,768,390,360,320,844].includes(width)){await p.waitForTimeout(200);await p.screenshot({path:path.join(out,`${width}x${height}-calendar.png`)});}
   assert.equal(await p.locator('[role="columnheader"]').count(),7);
   for(const label of ['UTC hour','UTC minute','UTC second']){const e=p.getByLabel(label,{exact:true});await e.evaluate(e=>e.scrollIntoView({block:'end'}));await e.focus();assert(['solid','auto'].includes(await e.evaluate(e=>getComputedStyle(e).outlineStyle)));}
   await p.keyboard.press('Tab');await action('Close Historical calendar').focus();assert.equal(await action('Close Historical calendar').evaluate(e=>getComputedStyle(e).outlineStyle),'solid');
   await p.keyboard.press('Enter');await p.locator('#historical-calendar').waitFor({state:'detached'});
   assert.equal(await bar.getAttribute('data-disclosure'),'EXPANDED');
   await action('Current').click();await ready();
   const credit=p.locator('.cesium-credit-expand-link');await credit.focus();await p.keyboard.press('Enter');await p.getByRole('dialog',{name:'Data attribution',exact:true}).waitFor();
   await p.waitForTimeout(250);const attribution=await check();await action('Close data attribution').focus();assert.equal(await action('Close data attribution').evaluate(e=>getComputedStyle(e).outlineStyle),'solid');await p.keyboard.press('Space');
   await p.getByRole('dialog',{name:'Data attribution',exact:true}).waitFor({state:'hidden'});
   report.viewports.push({width,height,current,calendar,attribution});save();console.log(`${width}x${height}: secondary faces / targets / keyboard PASS`);
  }
  await p.setViewportSize({width:1440,height:900});await action('Historical').click();await ready();await p.locator('.historical-date').click();await p.locator('#historical-calendar').waitFor();
  const widths=[...new Set([...Array.from({length:71},(_,i)=>320+i*16),378,379,380,599,600,601,739,740,741,1242,1243,1244,1398,1399,1400,1440])].sort((a,b)=>a-b);
  for(const width of [...widths,...widths.toReversed()]){
   await p.setViewportSize({width,height:800});
   // CDP resolves before native resize delivery; measure rendered frames after
   // the existing portal positioning handler has received that event.
   await p.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));
   for(const moment of ['immediate','next-frame']){if(moment==='next-frame')await p.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));const s=await check();assert(await p.evaluate(()=>__originalCanvas===document.querySelector('.earth-view canvas')));report.resize.push({width,moment,controls:s.controls,failures:s.geometry.failures});}
  }
  await p.close();
  const touch=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});touch.setDefaultTimeout(90000);
  touch.on('pageerror',e=>report.errors.push(e.message));touch.on('console',m=>{if(m.type()==='error')report.console.push(m.text());});
  await touch.goto(url);await touch.waitForFunction(()=>!document.querySelector('[aria-label="ISS Inspection"]').disabled);
  await touch.evaluate(`window.geometry=(${geometry.toString()});`);
  report.touch=[];
  for(const [width,height]of [[390,844],[320,568],[844,390]]){
   await touch.setViewportSize({width,height});const action=n=>touch.getByRole('button',{name:n,exact:true});
   for(const name of ['Zoom in','Zoom out','Reset view'])await action(name).tap();
   await action('Historical').tap();await touch.waitForFunction(()=>document.querySelector('main').getAttribute('aria-busy')==='false');
   if(width<=740)await action('Open Historical controls').tap();
   await touch.locator('.historical-date').tap();await touch.locator('#historical-calendar').waitFor();await touch.waitForTimeout(200);
   const calendar=await touch.evaluate(measure);assert.deepEqual(calendar.geometry.failures,[]);
   await action('Cancel').tap();await touch.locator('#historical-calendar').waitFor({state:'detached'});
   await action('Current').tap();await touch.waitForFunction(()=>document.querySelector('main').getAttribute('aria-busy')==='false');
   await action('Crew').tap();await touch.locator('.crew-roster-row').first().waitFor();await touch.locator('.crew-roster-row').first().tap();await touch.locator('.astronaut-dock').waitFor();await touch.waitForTimeout(300);
   const astronaut=await touch.evaluate(measure);assert.deepEqual(astronaut.geometry.failures,[]);
   await action('Close astronaut detail').tap();await touch.locator('.astronaut-dock').waitFor({state:'detached'});await action('Close crew panel').tap();await touch.locator('.crew-workspace-host').waitFor({state:'detached'});
   await touch.locator('.cesium-credit-expand-link').tap();await touch.getByRole('dialog',{name:'Data attribution',exact:true}).waitFor();await touch.waitForTimeout(200);
   const attribution=await touch.evaluate(measure);assert.deepEqual(attribution.geometry.failures,[]);await action('Close data attribution').tap();await touch.getByRole('dialog',{name:'Data attribution',exact:true}).waitFor({state:'hidden'});
   report.touch.push({width,height,calendar,astronaut,attribution,result:'PASS'});
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.console,[]);report.result='PASS';save();
 }finally{save();await browser.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
