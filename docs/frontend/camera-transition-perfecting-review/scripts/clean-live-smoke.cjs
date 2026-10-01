// Uninstrumented app against the actual local backend. No route interceptions.
const fs=require('fs'),path=require('path');
const {chromium}=require(process.env.MISSION1_PLAYWRIGHT_MODULE||'playwright');
const out=process.env.MISSION1_EVIDENCE_DIR||path.resolve(__dirname,'../perceptual');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});const report=[];
try{for(const port of [5175,4175]){
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:2});
 const page=await context.newPage(),row={port,noQa:null,errors:[],sources:[],api:[]};
 page.on('pageerror',e=>row.errors.push(String(e)));
 page.on('response',r=>{if(r.url().includes('/api/iss/orbit/'))row.api.push({url:r.url(),status:r.status()});});
 await page.goto('http://127.0.0.1:'+port);
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Inspect ISS')?.disabled===false,null,{timeout:60000});
 row.noQa=await page.evaluate(()=>globalThis.__qa===undefined);
 for(const source of ['MISSION1 GP/TLE','NASA OEM']){
  const selector=page.getByRole('button',{name:source,exact:true});
  if(await selector.isDisabled()){row.sources.push({source,available:false,body:await page.locator('body').innerText()});continue;}
  await selector.click();await page.getByRole('button',{name:'Inspect ISS',exact:true}).click();
  await page.getByText('Drag to orbit the ISS · Scroll to zoom',{exact:true}).waitFor({timeout:20000});
  const body=await page.locator('body').innerText();
  await page.screenshot({path:`${out}/clean-live-${port}-${source==='NASA OEM'?'oem':'gp'}.jpg`,type:'jpeg',quality:85});
  await page.getByRole('button',{name:'Back to Earth View',exact:true}).click();
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Inspect ISS')?.disabled===false,null,{timeout:20000});
  row.sources.push({source,available:true,entry:true,return:true,body});
 }
 row.finalBody=await page.locator('body').innerText();
 if(!row.noQa||row.errors.length||!row.sources.some(s=>s.source==='MISSION1 GP/TLE'&&s.return))throw Error(JSON.stringify(row));
 report.push(row);await context.close();console.log(port,row.sources.map(s=>({source:s.source,available:s.available,return:s.return})),row.errors);
}}finally{await browser.close();}
fs.writeFileSync(out+'/clean-live-smoke.json',JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
