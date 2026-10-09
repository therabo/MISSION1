/* Focused real-data smoke. Node 24; no API substitutions or synthetic ISS data.
 * Usage: node interface-metadata-cleanup.cjs URL BUILD [EXTERNAL_OUTPUT] */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,viewer}=require('../../occlusion-aware-workspace-centering/scripts/browser-utils.cjs');
const [url='http://127.0.0.1:5175/',build='development',out=path.join(require('node:os').tmpdir(),'mission1-metadata-cleanup',build)]=process.argv.slice(2);
fs.mkdirSync(out,{recursive:true});
const sizes=[[1440,900],[1024,768],[768,1024],[390,844],[320,568]];
const report={url,build,viewports:[],errors:[]};
function geometry(){
 const box=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
 const visible=n=>getComputedStyle(n).display!=='none'&&getComputedStyle(n).visibility!=='hidden'&&n.getBoundingClientRect().width>0;
 const nodes=[...document.querySelectorAll('.operational-summary,.crew-workspace,.crew-detail-surface,.crew-panel-content,.astronaut-profile-body,.crew-historical-profile-body')].filter(visible);
 const overflow=nodes.filter(n=>n.scrollWidth>n.clientWidth+1).map(n=>n.className);
 const collisions=[...document.querySelectorAll('.crew-roster-row')].filter(visible).flatMap(row=>[...row.children].filter(visible)
  .filter(n=>{const a=box(row),b=box(n);return b.x<a.x-1||b.right>a.right+1||b.y<a.y-1||b.bottom>a.bottom+1;}).map(n=>n.className));
 const roster=document.querySelector('.crew-workspace'),summary=roster?.querySelector('.crew-roster-summary'),evidence=roster?.querySelector('.crew-roster-evidence');
 const bar=document.querySelector('.operational-summary'),identity=bar.querySelector('.summary-identity');
 const fields=[identity,...bar.querySelectorAll('.summary-position > div')];
 return {documentOverflow:document.documentElement.scrollWidth>innerWidth,overflow,collisions,
  bar:box(bar),identity:box(identity),identityText:identity.textContent,identityChildren:identity.children.length,
  fieldCenters:fields.map(n=>{const r=box(n);return r.y+r.height/2;}),
  roster:roster&&box(roster),summary:summary&&box(summary),evidence:evidence&&box(evidence),
  current:!!document.querySelector('.crew-roster-summary.is-current'),rosterVisible:roster&&visible(roster),
  detail:document.querySelector('.crew-detail-surface')&&box(document.querySelector('.crew-detail-surface'))};
}
const valid=g=>{assert(!g.documentOverflow);assert.deepEqual(g.overflow,[]);assert.deepEqual(g.collisions,[]);};
(async()=>{const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});let lastCrew=null;
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 page.on('response',async r=>{if(r.ok()&&new URL(r.url()).pathname==='/api/iss/crew')lastCrew=await r.json();});
 await page.goto(url);await page.waitForFunction(()=>!document.querySelector('[aria-label="ISS Inspection"]').disabled);
 await page.evaluate(`window.__metadataViewer=(${viewer.toString()})();window.__metadataCanvas=__metadataViewer.canvas;`);
 const action=name=>page.getByRole('button',{name,exact:true});
 const ready=()=>page.waitForFunction(()=>document.querySelector('main').getAttribute('aria-busy')==='false');
 const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const save=()=>fs.writeFileSync(path.join(out,'qa.json'),JSON.stringify(report,null,2));
 for(const [width,height] of sizes){
  await page.setViewportSize({width,height});await settle();
  const item={width,height,sources:[]};
  for(const source of ['PRIMARY_GP_TLE','NASA_OEM']){
   const select=page.getByLabel('Orbital source',{exact:true});assert(!(await select.locator(`option[value="${source}"]`).isDisabled()));
   await select.selectOption(source);await page.waitForTimeout(300);const g=await page.evaluate(geometry);valid(g);
   assert.equal(g.identityText,'ISS / WGS84');assert.equal(g.identityChildren,1);
   if(width>740)assert(g.fieldCenters.every(c=>Math.abs(c-g.fieldCenters[0])<1),'Operational groups not vertically centered');
   else {const cells=await page.locator('.source-state-slot').evaluate(n=>{const b=n.getBoundingClientRect();return {center:b.y+b.height/2};});assert(Math.abs(g.fieldCenters[0]-cells.center)<1);}
   assert(!(await page.locator('.cesium-credit-textContainer').innerText()).includes('ISS 3D model: NASA VTAD'));
   item.sources.push({source,geometry:g,result:'PASS'});
  }
  await page.getByLabel('Orbital source',{exact:true}).selectOption('PRIMARY_GP_TLE');
  await page.locator('.source-state-slot > summary').click();await page.locator('.orbital-status-evidence').waitFor({state:'visible'});
  assert((await page.locator('.orbital-status-evidence').innerText()).includes('ISS 3D model: NASA VTAD'));
  assert((await page.locator('.orbital-status-evidence').innerText()).includes('Neither product is onboard position telemetry'));
  await page.locator('.source-state-slot > summary').click();
  await page.locator('.cesium-credit-expand-link').focus();await page.keyboard.press('Enter');await page.locator('.cesium-credit-lightbox').waitFor({state:'visible'});
  assert((await page.locator('.cesium-credit-lightbox').innerText()).includes('ISS 3D model: NASA VTAD'));
  await page.locator('.cesium-credit-lightbox-close').click();
  if(build==='development'&&width===1440||build==='production'&&width===390)await page.screenshot({path:path.join(out,`earth-${width}.png`)});
  await action('Crew').click();await page.locator('.crew-roster-row').first().waitFor();await page.waitForTimeout(300);
  assert(lastCrew);const current=await page.evaluate(geometry);valid(current);
  const content=await page.locator('.crew-workspace').innerText();
  for(const text of ['Last reported:','In the retained count','ASSESSMENT UTC','Latest retained assertion'])assert(!content.includes(text),text);
  const expected=[lastCrew.freshness.structuredSource.lastSuccessfulFetchAt,lastCrew.freshness.verification.lastSuccessfulFetchAt]
   .filter(t=>t&&Number.isFinite(Date.parse(t))).sort((a,b)=>Date.parse(b)-Date.parse(a))[0]||null;
  if(expected)assert.equal(await page.locator('.crew-last-update time').getAttribute('datetime'),expected);
  else assert((await page.locator('.crew-last-update').innerText()).includes('Unavailable'));
  const counts=await page.locator('.crew-roster-summary dd').allTextContents();assert.equal(counts[0],lastCrew.counts.officialAboard===null?'Unavailable':String(lastCrew.counts.officialAboard));
  assert.equal(counts[1],String(lastCrew.counts.resolvedAboard));assert.equal(counts[2],String(lastCrew.counts.unidentifiedAboard));
  await page.locator('.crew-roster-evidence > details > summary').click();
  const protectedText=await page.locator('.crew-roster-evidence').innerText();
  assert(protectedText.includes('Data sources & freshness'));
  if(lastCrew.reconciliation.status==='VERIFICATION_UNAVAILABLE'){
   assert(protectedText.includes('NASA verification unavailable'));assert(protectedText.includes('Assignments remain visible. Current presence cannot be assumed from assignment alone.'));
  }
  if(lastCrew.unresolvedSubjects.length){assert(protectedText.includes('Additional NASA-reported crew'));assert(protectedText.includes('Identity reconciliation is pending; reports may repeat a name.'));}
  if(lastCrew.freshness.structuredSource.lastRefreshFailed||lastCrew.freshness.verification.lastRefreshFailed)assert(protectedText.includes('A source refresh failed; available information is retained.'));
  await page.locator('.crew-sources > summary').click();assert((await page.locator('.crew-sources').innerText()).includes('Evaluated '));
  assert.equal(await page.locator('.crew-unresolved li').count(),lastCrew.unresolvedSubjects.length);
  await page.locator('.crew-roster-evidence > details > summary').click();
  await page.locator('.crew-panel-content').evaluate(n=>n.scrollTop=0);
  if(build==='development'&&width===1440||build==='production'&&width===320)await page.screenshot({path:path.join(out,`current-crew-${width}.png`)});
  const first=page.locator('.crew-roster-row').first(),id=await first.getAttribute('data-member-id');await first.click();
  const detail=page.locator('.crew-detail-surface');await detail.waitFor();await detail.evaluate(n=>Promise.all(n.getAnimations().map(a=>a.finished)));valid(await page.evaluate(geometry));
  assert.equal(await detail.getAttribute('data-entity-id'),id);assert.equal(await page.getByRole('button',{name:'Back to Crew',exact:true}).count(),width<=740?1:0);
  await detail.getByRole('button',{name:width<=740?'Back to Crew':'Close astronaut detail',exact:true}).click();await detail.waitFor({state:'detached'});
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.memberId),id);await action('Close crew panel').click();await page.locator('.crew-workspace-host').waitFor({state:'detached'});
  await action('Historical').click();await ready();await action('Crew').click();await page.locator('.crew-historical .crew-roster-row').first().waitFor();
  assert.equal(await page.locator('.crew-assessment time').getAttribute('datetime'),await page.locator('.context-date time').getAttribute('datetime'));
  assert.equal(await page.locator('.crew-last-update').count(),0);const historical=await page.evaluate(geometry);valid(historical);
  await page.locator('.crew-roster-row').first().click();await detail.waitFor();valid(await page.evaluate(geometry));
  await detail.getByRole('button',{name:width<=740?'Back to Crew':'Close astronaut detail',exact:true}).click();await detail.waitFor({state:'detached'});
  await action('Close crew panel').click();await page.locator('.crew-workspace-host').waitFor({state:'detached'});await action('Current').click();await ready();
  assert(await page.evaluate(()=>__metadataCanvas===document.querySelector('.earth-view canvas')&&document.querySelectorAll('.cesium-viewer').length===1));
  item.current={geometry:current,lastUpdate:expected,result:'PASS'};item.historical={geometry:historical,result:'PASS'};
  report.viewports.push(item);save();console.log(`${build} ${width}x${height}: Earth GP/OEM, credit/provenance, Current/History roster/detail PASS`);
 }
 assert.deepEqual(report.errors,[]);report.result='PASS';save();
} catch(e){report.failure=e.stack;report.result='FAIL';fs.writeFileSync(path.join(out,'qa.json'),JSON.stringify(report,null,2));throw e;}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
