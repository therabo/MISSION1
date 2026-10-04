const path=require('path');
const {chromium}=require(process.env.MISSION1_PLAYWRIGHT_MODULE||'playwright');
const repo=process.env.MISSION1_REPO_ROOT||path.resolve(__dirname,'../../../..');
const evidence=process.env.MISSION1_EVIDENCE_DIR||path.join(repo,'docs/frontend/dynamic-workspace-centering/evidence');
const fs=require('fs');
const out=evidence;
function measure(){
 const rect=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {class:el.className,left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,display:s.display,visibility:s.visibility,cssTop:s.top,cssLeft:s.left,cssRight:s.right}};
 return {viewport:{width:innerWidth,height:innerHeight},canvas:rect(document.querySelector('canvas')),panels:[...document.querySelectorAll('.status-panel,.crew-panel,.replay-orbit')].map(rect)};
}
(async()=>{const b=await chromium.launch({headless:true,args:['--use-angle=metal']});const report=[];try{for(const [width,height] of [[1440,900],[1280,720],[1024,768],[900,700],[768,1024],[390,844]]){
const p=await b.newPage({viewport:{width,height}});await p.goto('http://127.0.0.1:5175');await p.waitForFunction(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Inspect ISS')?.disabled===false,null,{timeout:90000});
async function capture(name){const r=await p.evaluate(measure);report.push({state:name,...r});await p.screenshot({path:`${out}/before-${width}x${height}-${name}.png`});fs.writeFileSync(`${out}/before-layout.json`,JSON.stringify(report,null,2));console.log(width,height,name,JSON.stringify(r.panels));}
await capture('overview');if([1440,768,390].includes(width)){await p.locator('#crew-launcher').click();await p.locator('.crew-summary').waitFor();await capture('crew');await p.locator('.crew-member').first().click();await p.locator('.crew-profile').waitFor();await capture('crew-detail');await p.getByRole('button',{name:'Close crew panel',exact:true}).click();await p.getByRole('button',{name:'Replay history',exact:true}).click();await p.getByLabel('Replay UTC instant',{exact:true}).fill('2026-10-02T23:00');await p.waitForTimeout(1000);await capture('replay');await p.getByRole('button',{name:'Return to LIVE',exact:true}).click();await p.waitForFunction(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Inspect ISS')?.disabled===false);await p.getByRole('button',{name:'Inspect ISS',exact:true}).click();await p.getByText('Drag to orbit the ISS · Scroll to zoom',{exact:true}).waitFor({timeout:30000});await capture('inspection');}await p.close();}}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
