const fs=require('fs'),path=require('path');
const {chromium}=require(process.env.MISSION1_PLAYWRIGHT_MODULE||'playwright');
const out=process.env.MISSION1_EVIDENCE_DIR||path.resolve(__dirname,'../browser');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});const report=[];
try{for(const port of [5175,4175])for(const width of [1280,390]){
 const context=await browser.newContext({viewport:{width,height:width===390?844:720},deviceScaleFactor:1});
 const page=await context.newPage(),row={port,width,errors:[],consoleErrors:[],api:[],directProviderData:[],sources:[]};
 page.on('pageerror',e=>row.errors.push(String(e)));page.on('console',e=>{if(e.type()==='error')row.consoleErrors.push(e.text());});
 page.on('response',r=>{if(r.url().includes('/api/iss/'))row.api.push({url:r.url(),status:r.status()});});
 page.on('request',r=>{if(r.url().includes('ll.thespacedevs.com')||r.url().includes('/blogs/spacestation/feed'))row.directProviderData.push(r.url());});
 await page.goto('http://127.0.0.1:'+port);
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Inspect ISS')?.disabled===false,null,{timeout:60000});
 await page.locator('#crew-launcher').click();await page.locator('.crew-summary').waitFor({timeout:20000});
 row.list=await page.locator('#crew-panel').innerText();await page.screenshot({path:`${out}/${port}-${width}-crew-list.png`});
 await page.locator('[data-member-id]').first().click();await page.locator('.crew-profile').waitFor({timeout:20000});
 row.detail=await page.locator('#crew-panel').innerText();await page.screenshot({path:`${out}/${port}-${width}-crew-detail.png`});
 await page.getByRole('button',{name:'Back to crew'}).click();await page.getByRole('button',{name:'Close crew panel'}).click();
 row.crewClosed=await page.locator('#crew-panel').count()===0;
 for(const source of ['MISSION1 GP/TLE','NASA OEM']){
  const selector=page.getByRole('button',{name:source,exact:true});
  if(await selector.isDisabled()){row.sources.push({source,available:false});continue;}
  await selector.click();await page.getByRole('button',{name:'Inspect ISS',exact:true}).click();
  await page.getByText('Drag to orbit the ISS · Scroll to zoom',{exact:true}).waitFor({timeout:20000});
  await page.screenshot({path:`${out}/${port}-${width}-${source==='NASA OEM'?'oem':'gp'}-inspection.png`});
  await page.locator('#crew-launcher').click();await page.locator('.crew-summary').waitFor();
  await page.getByRole('button',{name:'Close crew panel'}).click();
  await page.mouse.move(width*.52,width===390?340:280);await page.mouse.wheel(0,-50);
  await page.getByRole('button',{name:'Back to Earth View',exact:true}).click();
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Inspect ISS')?.disabled===false,null,{timeout:20000});
  row.sources.push({source,available:true,inspection:true,crewInInspection:true,return:true});
 }
 row.noQa=await page.evaluate(()=>globalThis.__qa===undefined&&!document.querySelector('#crew-qa-report'));
 row.canvases=await page.locator('canvas').count();row.body=await page.locator('body').innerText();
 if(row.errors.length||row.directProviderData.length||!row.noQa||!row.crewClosed||row.sources.some(s=>!s.available||!s.return))throw Error(JSON.stringify(row));
 report.push(row);fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({port,width,sources:row.sources,errors:row.errors,consoleErrors:row.consoleErrors}));await context.close();
}}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
