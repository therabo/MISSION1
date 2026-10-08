/* Reuse the approved Phase 4 native observer, real API capture and astronomical
 * oracle unchanged. Guarded scenario anchors fail loudly if that harness moves.
 * Only the QA scenario is replaced; no application source or API body is changed.
 * node browser-calendar-qa.cjs [base-url] [development|production]
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
let harness=fs.readFileSync(path.join(__dirname,'browser-scene-stability-qa.cjs'),'utf8');
const start=' // Capture normal Current evolution without changing UI, data, camera or clock.';
const finish=' report.resizeActivity=';
assert.equal(harness.split(start).length,2);assert.equal(harness.split(finish).length,2);
const scenario=String.raw`
 async function ready(){await p.waitForFunction(()=>document.querySelector('main').getAttribute('aria-busy')==='false'&&document.querySelector('.context-date > span').textContent==='HISTORICAL DATE');}
 async function settled(){await p.waitForFunction(()=>{const e=document.querySelector('#historical-calendar');return e?.dataset.state==='open'&&getComputedStyle(e).opacity==='1'&&e.getAnimations().every(a=>a.playState==='finished');});}
 const trigger=p.getByRole('button',{name:'Open Historical calendar',exact:true});
 const replayReads=()=>p.evaluate(()=>globalThis.__skyQA.replayReads);
 await p.evaluate(()=>{const q=globalThis.__skyQA;q.replayReads=0;const nativeFetch=fetch;globalThis.fetch=function(...args){if(String(args[0]).includes('/api/iss/replay?'))q.replayReads++;return nativeFetch.apply(this,args);};
  q.begin=async()=>{const pixels=await q.sample();q.calendarTrace={before:q.metrics(),frames:[],nonBlack:Array.from(pixels).filter(Boolean).length};
   q.removeTrace=q.viewers[0].scene.postRender.addEventListener(()=>{const next=q.read(q.crop);let max=0;for(let i=0;i<next.length;i++)max=Math.max(max,Math.abs(next[i]-pixels[i]));q.calendarTrace.frames.push({...q.metrics(),pixelMaxDifference:max});});};
  q.end=()=>{q.removeTrace();return q.calendarTrace;};
 });
 function sameTemporal(trace){assert(trace.frames.length);assert(trace.nonBlack);for(const f of trace.frames){equal(trace.before,f);coherent(f);
  for(const k of ['utc','iss','starTransform','sunPositionWC','moonDirectionEC','sunDirectionWC','source','values'])assert.deepEqual(f[k],trace.before[k],'UI-only calendar changed '+k);
  assert.equal(f.pixelMaxDifference,0,'Calendar UI moved celestial pixels');}}
 async function popup(){return p.locator('#historical-calendar').evaluate(e=>{const box=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};},css=getComputedStyle(e);
  return {...box(e),background:css.backgroundColor,border:css.borderColor,radius:css.borderRadius,shadow:css.boxShadow,blur:css.backdropFilter,
   cells:[...e.querySelectorAll('.calendar-day')].map(n=>({...box(n),selected:n.parentElement.getAttribute('aria-selected'),disabled:n.getAttribute('aria-disabled')})),
   fields:[...e.querySelectorAll('.calendar-time-control select')].map(box),actions:[...e.querySelectorAll('.calendar-actions button')].map(box),
   month:{...box(e.querySelector('h2')),font:getComputedStyle(e.querySelector('h2')).fontSize,weight:getComputedStyle(e.querySelector('h2')).fontWeight},
   weekday:{...box(e.querySelector('.calendar-weekdays')),font:getComputedStyle(e.querySelector('.calendar-weekdays')).fontSize},
   grid:box(e.querySelector('.calendar-grid')),body:box(e.querySelector('.calendar-body')),bodyScroll:getComputedStyle(e.querySelector('.calendar-body')).overflowY,divider:box(e.querySelector('.calendar-divider')),actionsRow:box(e.querySelector('.calendar-actions')),
   active:document.activeElement.getAttribute('aria-label'),bodyOverflow:document.documentElement.scrollHeight>innerHeight||document.documentElement.scrollWidth>innerWidth};});}
 function bounds(cal,state){assert.equal(cal.background,'rgba(21, 29, 39, 0.94)');assert.equal(cal.border,'rgba(42, 53, 66, 0.9)');assert.equal(cal.radius,'6px');assert.equal(cal.shadow,'none');assert.equal(cal.blur,'none');assert(!cal.bodyOverflow);
  assert(cal.x>=11.5&&cal.y>=11.5&&cal.x+cal.width<=state.width-11.5&&cal.y+cal.height<=state.height-11.5,'Calendar outside viewport');
  // Compact date/time content intentionally scrolls in one body. Off-screen
  // content is valid; pinned actions and actual focused controls must fit.
  for(const box of [...cal.cells,...cal.fields]){assert(box.x>=cal.x&&box.x+box.width<=cal.x+cal.width+.5);if(cal.bodyScroll!=='auto')assert(box.y>=cal.y&&box.y+box.height<=cal.y+cal.height+.5);}
  for(const box of cal.actions)assert(box.x>=cal.x&&box.y>=cal.y&&box.x+box.width<=cal.x+cal.width+.5&&box.y+box.height<=cal.y+cal.height+.5);
  assert(cal.cells.filter(x=>x.selected==='true').length===1);assert(cal.cells.every(x=>x.width>=24&&x.height>=24));}
 await historical.click();await ready();
 for(const [width,height] of matrix){await p.setViewportSize({width,height});await p.waitForTimeout(180);const before=await layout(p);checkLayout(before);
  await trigger.click();await settled();const cal=await popup();bounds(cal,before);
  const crop=await p.evaluate(()=>{const q=globalThis.__skyQA;q.crop=q.chooseCrop();return q.crop;});
  assert(!(crop.x<cal.x+cal.width&&crop.x+crop.width>cal.x&&crop.y<cal.y+cal.height&&crop.y+crop.height>cal.y),'GPU crop intersects calendar');
  const reads=await replayReads();await p.evaluate(()=>globalThis.__skyQA.begin());
  await p.getByLabel('UTC minute',{exact:true}).selectOption('07');await p.getByLabel('UTC second',{exact:true}).selectOption('09');
  const selected=p.locator('.calendar-day[tabindex="0"]');await selected.press('ArrowLeft');await selected.press('ArrowRight');
  await p.getByRole('button',{name:'Cancel',exact:true}).click();await p.waitForTimeout(140);await trigger.click();await settled();
  assert.equal(await p.getByLabel('UTC minute',{exact:true}).inputValue(),new Date(await p.locator('.historical-date time').getAttribute('datetime')).getUTCMinutes().toString().padStart(2,'0'));
  await p.keyboard.press('Escape');await p.waitForTimeout(140);await trigger.click();await settled();
  await p.mouse.click((await p.viewportSize()).width-4,4);await p.waitForTimeout(140);assert.equal(await trigger.getAttribute('aria-expanded'),'false');
  const trace=await p.evaluate(()=>globalThis.__skyQA.end());sameTemporal(trace);assert.equal(await replayReads(),reads,'Draft/Cancel/Escape/outside caused replay query');
  await trigger.click();await settled();const open=await layout(p);checkLayout(open);for(const key of ['.top-context-bar','.operational-summary','.trajectory-legend','.earth-scene-controls','.earth-view canvas'])assert.deepEqual(open.geometry[key],before.geometry[key]);
  await p.screenshot({path:path.join(out,width+'x'+height+'-calendar.png')});
  const latest=await popup();bounds(latest,open);report.viewports.push({width,height,calendar:latest,closed:before,open,uiOnlyFrames:trace.frames.length,pixelDifference:0,replayReads:0,result:'PASS'});
  await p.keyboard.press('Escape');await p.waitForTimeout(140);console.log(width+'x'+height+': calendar geometry, draft isolation, pixels PASS');
 }
 report.intermediateWidths=[];
 for(const width of intermediateWidths){await p.setViewportSize({width,height:800});await p.waitForTimeout(100);await trigger.click();await settled();const state=await layout(p);checkLayout(state);bounds(await popup(),state);await p.keyboard.press('Escape');await p.waitForTimeout(140);report.intermediateWidths.push({width,result:'PASS'});}
 await p.setViewportSize({width:1440,height:900});await p.waitForTimeout(180);await p.evaluate(()=>{globalThis.__skyQA.crop=globalThis.__skyQA.chooseCrop();});
 // Match Figma's illustrated draft without changing accepted time before Apply.
 await trigger.click();await settled();await p.getByRole('button',{name:'2026-10-05 UTC',exact:true}).click();await p.getByLabel('UTC hour',{exact:true}).selectOption('11');await p.getByLabel('UTC minute',{exact:true}).selectOption('38');await p.getByLabel('UTC second',{exact:true}).selectOption('41');await settled();
 const figma=await popup();assert.deepEqual([figma.x,figma.y,figma.width,figma.height],[360,148,280,334]);assert.equal(figma.month.font,'13px');assert.equal(figma.month.weight,'700');assert.equal(figma.weekday.font,'10px');
 assert(figma.fields.every(x=>Math.abs(x.width-72)<.03&&x.height===28));assert.deepEqual(figma.actions.map(x=>[x.width,x.height]),[[96,28],[152,28]]);
 assert.equal(figma.weekday.y-figma.y,48);assert.equal(figma.grid.y-figma.y,70);assert.equal(figma.divider.y-figma.y,234);assert.equal(figma.actionsRow.y-figma.y,293);
 report.figma=figma;await p.screenshot({path:path.join(out,'figma-matched-calendar.png')});await p.locator('#historical-calendar').screenshot({path:path.join(out,'calendar-crop.png')});
 const apply=await trace('Apply');validate(apply);assert(apply.frames.some(f=>f.holding));assert.equal(apply.frames.at(-1).utc,'2026-10-05T11:38:41.000Z');assert(delta(apply.before.starTransform,apply.frames.at(-1).starTransform)>1e-6);assert(delta(apply.before.iss,apply.frames.at(-1).iss)>1);report.apply={frames:apply.frames.length,heldFrames:apply.frames.filter(f=>f.holding).length,old:apply.before.utc,accepted:apply.frames.at(-1).utc,result:'PASS'};fs.writeFileSync(path.join(out,'apply-frames.json'),JSON.stringify(apply,null,2));
 await trigger.click();await settled();assert.equal(await p.getByLabel('UTC minute',{exact:true}).inputValue(),'38');assert.equal(await p.locator('.calendar-day[tabindex="0"]').textContent(),'5');await p.keyboard.press('Escape');
 const returned=await trace('Current');validate(returned);assert(returned.frames.at(-1).animate&&!returned.frames.at(-1).presentedHistorical);report.currentReturn={frames:returned.frames.length,result:'PASS'};
 await historical.click();await ready();
 // Supersede a real Apply request with a newer target through the same controls.
 await trigger.click();await settled();await p.getByLabel('UTC minute',{exact:true}).selectOption('20');await p.getByRole('button',{name:'Apply',exact:true}).click();await p.waitForTimeout(300);
 await trigger.click();await settled();await p.getByLabel('UTC minute',{exact:true}).selectOption('21');const final=await trace('Apply');validate(final);assert.equal(final.frames.at(-1).utc,'2026-10-05T11:21:41.000Z');report.lastRequestWins={accepted:final.frames.at(-1).utc,result:'PASS'};
 await trigger.click();await settled();await p.getByLabel('UTC minute',{exact:true}).selectOption('22');await p.getByRole('button',{name:'Apply',exact:true}).click();await p.waitForTimeout(300);const pendingReturn=await trace('Current');validate(pendingReturn);assert(!pendingReturn.frames.at(-1).presentedHistorical);report.pendingReturn='PASS';
 await historical.click();await ready();
 report.motion=[];
 for(const reduced of ['no-preference','reduce']){await p.emulateMedia({reducedMotion:reduced});await trigger.click();
  const opening=await p.locator('#historical-calendar').evaluate(e=>({animation:getComputedStyle(e).animationName,duration:getComputedStyle(e).animationDuration,easing:getComputedStyle(e).animationTimingFunction,keyframes:e.getAnimations().flatMap(a=>a.effect.getKeyframes())}));
  assert.equal(opening.duration,reduced==='reduce'?'0.12s':'0.16s');if(reduced==='reduce')assert(opening.keyframes.every(k=>!k.transform||k.transform==='none'));
  await p.keyboard.press('Escape');const closing=await p.locator('#historical-calendar').evaluate(e=>({duration:getComputedStyle(e).animationDuration,inert:e.inert,hidden:e.getAttribute('aria-hidden')}));assert(closing.inert);assert.equal(closing.duration,'0.12s');
  await trigger.click();await p.waitForTimeout(260);assert.equal(await trigger.getAttribute('aria-expanded'),'true');await settled();await p.mouse.click((await p.viewportSize()).width-4,4);await p.waitForTimeout(140);report.motion.push({reduced,opening,closing,interruptedReopen:true,result:'PASS'});
 }
 // Native keyboard activation and non-modal Tab order; no synthesized click.
 await trigger.focus();await p.keyboard.press('Enter');await settled();assert.equal(await p.locator('.calendar-day[tabindex="0"]').evaluate(e=>e===document.activeElement),true);await p.keyboard.press('Tab');assert.equal(await p.getByLabel('UTC hour',{exact:true}).evaluate(e=>e===document.activeElement),true);await p.keyboard.press('Shift+Tab');assert.equal(await p.locator('.calendar-day[tabindex="0"]').evaluate(e=>e===document.activeElement),true);await p.keyboard.press('Escape');assert(await trigger.evaluate(e=>e===document.activeElement));report.keyboard='PASS';
`;
harness=harness.replace("{chromium,matrix,layout,checkLayout}","{chromium,matrix,intermediateWidths,layout,checkLayout}");
harness=harness.replace("'.top-context-bar,.historical-time-bar,.trajectory-legend", "'#historical-calendar,.top-context-bar,.historical-time-bar,.trajectory-legend");
harness=harness.slice(0,harness.indexOf(start))+scenario+harness.slice(harness.indexOf(finish));
harness=harness.replaceAll("'temporal-coherence-qa.json'","'calendar-qa.json'");
new Function('require','__dirname','process',harness)(require,__dirname,process);
