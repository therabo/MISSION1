// Equivalent local lint: the skill's .shared visual runtime is absent on this host.
const fs=require('fs'),path=require('path');
const repo=process.env.MISSION1_REPO_ROOT||path.resolve(__dirname,'../../../../..');
const out=process.env.MISSION1_EVIDENCE_DIR,port=+process.argv[2],label=process.argv[3];
const {chromium}=require(process.env.MISSION1_PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});try{
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:2});
 for(const [api,file]of [['samples','real-samples.json'],['comparison','real-comparison.json']])await context.route('**/api/iss/orbit/'+api,r=>r.fulfill({json:JSON.parse(fs.readFileSync(repo+'/docs/frontend/inspection-orientation-review/'+file))}));
 await context.route('https://gibs.earthdata.nasa.gov/**',r=>r.abort('failed'));
 const page=await context.newPage(),report={label,errors:[],cases:[]};page.on('pageerror',e=>report.errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+port);await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Inspect ISS'&&!b.disabled),null,{timeout:60000});
 for(const size of [{width:1280,height:720},{width:900,height:700},{width:390,height:844}]){
  await page.setViewportSize(size);
  for(const mode of ['earth','inspection']){
   if(mode==='inspection'){await page.getByRole('button',{name:'Inspect ISS',exact:true}).click();await page.waitForFunction(()=>globalThis.__qa.mode==='ISS_INSPECTION');}
   const lint=await page.evaluate(()=>{
    const findings={overflow:document.documentElement.scrollWidth>innerWidth,unnamedControls:[],imagesWithoutAlt:[],imagesWithoutName:[],tinyText:[],clippedControls:[],contrast:[]};
    const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width&&r.height&&s.display!=='none'&&s.visibility!=='hidden'&&s.opacity!=='0';};
    const rgba=c=>(c.match(/[\d.]+/g)||[]).map(Number);
    const luminance=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
    for(const e of document.querySelectorAll('button,input,select'))if(visible(e)){
     if(!((e.textContent||'').trim()||e.getAttribute('aria-label')||e.id&&document.querySelector('label[for="'+e.id+'"]')))findings.unnamedControls.push(e.outerHTML.slice(0,180));
     const r=e.getBoundingClientRect();if(r.left<-.5||r.right>innerWidth+.5)findings.clippedControls.push((e.textContent||e.id).trim());
    }
    for(const e of document.querySelectorAll('img'))if(visible(e)&&!e.hasAttribute('alt')){
     findings.imagesWithoutAlt.push({src:e.src,title:e.title});
     // Native Cesium credit uses a title as its image accessible name. Retain
     // absent-alt as a warning, without falsely calling that credit unnamed.
     if(!e.title.trim()&&!e.getAttribute('aria-label')?.trim())findings.imagesWithoutName.push(e.src);
    }
    for(const e of document.querySelectorAll('button,label,span,p,h1,h2,h3,summary,a'))if(visible(e)&&!e.children.length&&(e.textContent||'').trim()){
     const style=getComputedStyle(e),text=e.textContent.trim().slice(0,100);if(parseFloat(style.fontSize)<11)findings.tinyText.push({text,size:style.fontSize});
     let bg=[0,0,0,1];const ancestors=[];for(let a=e;a;a=a.parentElement)ancestors.push(a);
     for(const a of ancestors.reverse()){const c=rgba(getComputedStyle(a).backgroundColor);if(c.length>=3){const alpha=c.length>3?c[3]:1;bg=[...c.slice(0,3).map((v,i)=>v*alpha+bg[i]*(1-alpha)),1];}}
     const fg=rgba(style.color);if(fg.length>=3){const a=fg.length>3?fg[3]:1;const l1=luminance(fg.slice(0,3).map((v,i)=>v*a+bg[i]*(1-a))),l2=luminance(bg);const ratio=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);if(ratio<4.5)findings.contrast.push({text,ratio,disabled:!!e.disabled});}
    }
    return findings;
   });
   report.cases.push({size,mode,...lint});
   if(mode==='inspection'){await page.getByRole('button',{name:'Back to Earth View',exact:true}).click();await page.waitForFunction(()=>globalThis.__qa.mode==='EARTH_OVERVIEW');}
  }
 }
 fs.writeFileSync(out+'/'+label+'-visual-lint.json',JSON.stringify(report,null,2));
 if(report.errors.length||report.cases.some(c=>c.overflow||c.unnamedControls.length||c.imagesWithoutName.length||c.clippedControls.length))throw Error('Visual lint blockers '+JSON.stringify(report));
 console.log(label,'visual lint complete');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
