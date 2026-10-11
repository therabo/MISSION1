// Actual local API bodies in both builds; no fixture substitution or provider APIs.
const {chromium} = require('../../../frontend/occlusion-aware-workspace-centering/scripts/browser-utils.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=process.env.MISSION1_QA_OUTPUT,backend=process.env.MISSION1_QA_BACKEND||'http://127.0.0.1:8081';
(async()=>{
 fs.mkdirSync(out,{recursive:true});const report={cases:[],errors:[]};
 const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});
 try{
  for(const port of [5175,4175]){
   const page=await browser.newPage({viewport:{width:1440,height:900}});
   page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
   await page.route('**/api/iss/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:backend+u.pathname+u.search})});});
   await page.goto(`http://127.0.0.1:${port}/`);
   await page.waitForFunction(()=>!document.querySelector('button[aria-label="ISS Inspection"]')?.disabled,null,{timeout:90000});
   for(const [width,height] of [[1440,900],[1024,768],[768,1024],[390,844],[320,568]]){
    await page.setViewportSize({width,height});
    await page.getByRole('button',{name:'Crew',exact:true}).click();
    await page.locator('.crew-roster-row').first().waitFor();
    assert.equal(await page.locator('.crew-roster-row').count(),7);
    assert.deepEqual(await page.locator('.crew-roster-summary dt').allTextContents(),['Current members']);
    assert.equal(await page.locator('.crew-roster-summary dd').innerText(),'7');
    assert.equal(await page.locator('.crew-workspace img:not([alt])').count(),0);
    const overflow=await page.locator('.crew-panel-content').evaluate(n=>n.scrollWidth>n.clientWidth+1);assert(!overflow);
    await page.screenshot({path:path.join(out,`roster-${port}-${width}x${height}.png`)});
    await page.getByRole('button',{name:'Close crew panel',exact:true}).click();
    await page.locator('.crew-workspace-host').waitFor({state:'detached'});
    for(const source of ['PRIMARY_GP_TLE','NASA_OEM']){
     await page.getByLabel('Orbital source',{exact:true}).selectOption(source);
     await page.waitForFunction(source=>document.querySelector('select[aria-label="Orbital source"]').value===source,source);
     await page.getByRole('button',{name:'ISS Inspection',exact:true}).click();
     await page.waitForFunction(()=>document.querySelector('main').dataset.viewMode==='ISS_INSPECTION',null,{timeout:30000});
     const canvas=page.locator('canvas').first();assert(await canvas.isVisible());
     assert.equal(await page.locator('.crew-workspace-host').count(),0);
     assert(await page.getByLabel('Orbital source',{exact:true}).isDisabled());
     assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
     await page.screenshot({path:path.join(out,`inspection-${port}-${width}-${source}.png`)});
     await page.getByRole('button',{name:'Earth',exact:true}).click();
     await page.waitForFunction(()=>document.querySelector('main').dataset.viewMode==='EARTH_OVERVIEW',null,{timeout:30000});
     assert(!await page.getByLabel('Orbital source',{exact:true}).isDisabled());
     report.cases.push({port,width,height,source,result:'PASS'});console.log(port,width,source,'PASS');
    }
   }
   await page.close();
  }
  assert.deepEqual(report.errors,[]);report.result='PASS';
 }finally{fs.writeFileSync(path.join(out,'qa.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
