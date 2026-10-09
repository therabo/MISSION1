/* Native Crew recovery QA. Only two HTTP 503 transport failures are injected;
 * every successful roster/scene response comes from the real local backend.
 * Node 24: node crew-retry-qa.cjs URL BUILD OUTPUT_DIRECTORY
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('../../occlusion-aware-workspace-centering/scripts/browser-utils.cjs');
const {geometry}=require('./responsive-matrix.cjs');
const [url='http://127.0.0.1:5175/',build='development',out='/tmp/mission1-crew-retry']=process.argv.slice(2);
fs.mkdirSync(out,{recursive:true});
const report={url,build,errors:[],console:[],requests:[],checks:[]};
async function run(){
  const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});
  try{
    const p=await browser.newPage({viewport:{width:390,height:844}});
    p.on('pageerror',e=>report.errors.push(e.message));
    p.on('console',m=>{if(m.type()==='error')report.console.push(m.text());});
    let attempts=0;
    await p.route('**/api/iss/crew',async route=>{
      const attempt=++attempts,injected=attempt===1||attempt===3;
      report.requests.push({attempt,url:route.request().url(),injectedStatus:injected?503:null});
      if(injected)await route.fulfill({status:503,body:''});else await route.continue();
    });
    await p.goto(url);await p.evaluate(()=>document.fonts.ready);
    await p.waitForFunction(()=>!document.querySelector('[aria-label="ISS Inspection"]').disabled,null,{timeout:120000});
    const action=name=>p.getByRole('button',{name,exact:true});
    const ready=()=>p.waitForFunction(()=>document.querySelector('main').getAttribute('aria-busy')==='false');
    const header=async()=>{
      assert.deepEqual(await p.locator('.crew-header-actions button').evaluateAll(bs=>bs.map(b=>b.getAttribute('aria-label'))),['Close crew panel']);
      assert.equal(await action('Refresh').count(),0);assert.deepEqual((await p.evaluate(geometry)).failures,[]);
    };
    await action('Crew').click();await action('Retry crew').waitFor();await header();
    const surface=await p.locator('.crew-workspace-host').elementHandle();
    await action('Retry crew').click();await p.locator('.crew-roster-row').first().waitFor();
    assert.equal(attempts,2);assert(await surface.evaluate(e=>e===document.querySelector('.crew-workspace-host')));
    assert.equal(await p.evaluate(()=>document.activeElement.id),'crew-title');
    const retained=await p.locator('.crew-roster-row').evaluateAll(rows=>rows.map(r=>r.dataset.memberId));
    report.checks.push({name:'Initial HTTP 503 → Retry → real roster; same workspace and heading focus',result:'PASS'});
    await action('Historical').click();await ready();await p.locator('.crew-historical').waitFor();await header();
    assert.equal(attempts,2);
    report.checks.push({name:'Historical uses accepted replay data without a new Current read or Refresh action',result:'PASS'});
    await action('Current').click();await ready();await action('Retry crew').waitFor();await header();
    assert.equal(attempts,3);assert.deepEqual(await p.locator('.crew-roster-row').evaluateAll(rows=>rows.map(r=>r.dataset.memberId)),retained);
    assert.match(await p.locator('.crew-error').textContent(),/displayed assessment has not been updated/);
    report.checks.push({name:'Historical → Current automatic API read; failed request retains the previous dated roster',result:'PASS'});
    await action('Retry crew').click();await p.locator('.crew-error').waitFor({state:'detached'});await header();
    assert.equal(attempts,4);assert(await surface.evaluate(e=>e===document.querySelector('.crew-workspace-host')));
    report.checks.push({name:'Explicit Retry recovers the automatic-refresh failure without remounting',result:'PASS'});
    await action('Close crew panel').click();await p.locator('.crew-workspace-host').waitFor({state:'detached'});
    assert.equal(await p.evaluate(()=>document.activeElement.id),'crew-launcher');
    assert.deepEqual(report.errors,[]);
    assert.equal(report.console.filter(e=>/503/.test(e)).length,2);
    assert.deepEqual(report.console.filter(e=>!/503/.test(e)),[]);
    report.result='PASS';console.log(JSON.stringify({build,result:report.result,requests:attempts,checks:report.checks.length,expectedHTTP503:2}));
  }finally{fs.writeFileSync(path.join(out,'retry.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
