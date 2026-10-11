// Real active profile navigation at every requested size and direct retained UUID HTTP reads.
const { chromium } = require('../../../frontend/occlusion-aware-workspace-centering/scripts/browser-utils.cjs');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const out = process.env.MISSION1_QA_OUTPUT;
const backend = process.env.MISSION1_QA_BACKEND || 'http://127.0.0.1:8081';
(async () => {
  const current = await (await fetch(backend + '/api/iss/crew')).json();
  const retained = JSON.parse(fs.readFileSync('/Users/daniel/.codex/exports/mission1-current-active-projection-activation/before-profiles.json'));
  const report = { active: [], retained: [], errors: [] };
  fs.mkdirSync(out, {recursive:true});
  const browser = await chromium.launch({headless:true,args:['--use-angle=metal']});
  try {
    for (const port of [5175,4175]) {
      const page = await browser.newPage({viewport:{width:1440,height:900}});
      page.on('pageerror',e=>report.errors.push(e.message));
      page.on('console',m=>{if(m.type()==='error') report.errors.push(m.text());});
      await page.route('**/api/iss/**', async route => {
        const u = new URL(route.request().url());
        await route.fulfill({response:await route.fetch({url:backend+u.pathname+u.search})});
      });
      await page.goto(`http://127.0.0.1:${port}/`);
      await page.getByRole('button',{name:'Crew',exact:true}).click();
      await page.locator('.crew-roster-row').first().waitFor();
      for(const [width,height] of [[1440,900],[1024,768],[768,1024],[390,844],[320,568]]) {
        await page.setViewportSize({width,height});
        for(const member of current.members) {
          await page.locator(`[data-member-id="${member.id}"]`).click();
          const detail=page.locator('.crew-detail-surface');await detail.waitFor();
          await page.waitForFunction(()=>document.querySelector('.astronaut-profile-body')?.textContent.includes('Biography / retained profile'));
          assert((await detail.innerText()).includes(member.name));
          assert(!(await detail.innerText()).includes('Structured profile unavailable'));
          assert.equal(await detail.getAttribute('data-entity-id'),member.id);
          assert(await detail.evaluate(n=>n.scrollWidth<=n.clientWidth+1));
          if(['Luke Delaney','Jessica Watkins'].includes(member.name) && [1440,390].includes(width))
            await page.screenshot({path:path.join(out,`${port}-${width}-${member.name.split(' ')[0]}.png`)});
          await detail.getByRole('button',{name:width<=740?'Back to Crew':'Close astronaut detail',exact:true}).click();
          await detail.waitFor({state:'detached'});
          assert.equal(await page.locator('.crew-roster-row').count(),7);
          report.active.push({port,width,height,name:member.name,id:member.id,result:'PASS'});
        }
      }
      for(const [id,person] of Object.entries(retained)) if(['Jessica Meir','Jack Hathaway','Sophie Adenot','Andrei Fedyaev'].includes(person.name)) {
        const response=await page.request.get(backend+'/api/iss/crew/'+id);assert.equal(response.status(),200);
        const detail=await response.json();assert.equal(detail.id,id);assert(detail.biography);assert.equal(detail.profileAvailability,'AVAILABLE');
        report.retained.push({port,name:person.name,id,result:'PASS'});
      }
      await page.close();
    }
    assert.deepEqual(report.errors,[]);report.result='PASS';
  } finally {fs.writeFileSync(path.join(out,'qa.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
