// Real-fixture rendered departure sweeps; retained objects and frozen endpoints.
const fs=require('fs'),path=require('path'),repo=path.resolve(__dirname,'../../../..'),out=process.env.MISSION1_EVIDENCE_DIR;
const {chromium}=require(process.env.MISSION1_PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});try{
const width=+(process.env.MISSION1_QA_WIDTH||1280),height=+(process.env.MISSION1_QA_HEIGHT||720),context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2});
for(const [api,file]of [['samples','real-samples.json'],['comparison','real-comparison.json']])await context.route('**/api/iss/orbit/'+api,r=>r.fulfill({json:JSON.parse(fs.readFileSync(repo+'/docs/frontend/inspection-orientation-review/'+file))}));
await context.route('https://gibs.earthdata.nasa.gov/**',r=>r.abort('failed'));
const page=await context.newPage(),report={label:process.argv[3],viewport:[width,height],cases:[],errors:[]};page.on('pageerror',e=>report.errors.push(String(e)));
await page.goto('http://127.0.0.1:'+process.argv[2]);await page.waitForFunction(()=>globalThis.__qa?.model?.ready,null,{timeout:60000});await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Inspect ISS')?.disabled===false);
for(const source of ['PRIMARY_GP_TLE','NASA_OEM'])for(const name of (process.env.MISSION1_QA_POSES||'canonical,close-module,max-zoom,orbit90,orbit180').split(',')){
await page.getByRole('button',{name:source==='NASA_OEM'?'NASA OEM':'MISSION1 GP/TLE',exact:true}).click();
await page.evaluate(()=>{const q=globalThis.__qa,H=q.helpers,v=q.viewer;v.clock.shouldAnimate=false;v.clock.currentTime=H.JulianDate.fromIso8601('2026-09-30T15:45:59.975908Z');v.camera.setView({destination:new H.Cartesian3(-9412786.358621413,-21163227.169227634,-3167995.3206285993),orientation:{direction:new H.Cartesian3(.40258878698283174,.9051600270198104,.13640965538109276),up:new H.Cartesian3(-.055435177167269443,-.12463761556457154,.9906525152235831)}});q.override=0;});await page.waitForTimeout(150);
await page.getByRole('button',{name:'Inspect ISS',exact:true}).click();
const start=await page.evaluate(name=>{const q=globalThis.__qa,H=q.helpers,v=q.viewer;q.override=1;q.tick();let p=H.Cartesian3.clone(v.camera.position);
if(name==='close-module')H.Cartesian3.multiplyByScalar(p,.65,p);if(name==='max-zoom')H.Cartesian3.multiplyByScalar(p,2000/H.Cartesian3.magnitude(p),p);if(name==='orbit90'){const x=p.x;p.x=-p.y;p.y=x;}if(name==='orbit180'){p.x=-p.x;p.y=-p.y;}
v.camera.lookAtTransform(q.frame,p);q.tick();v.render();q.override=0;
q.retained=q.trails.trails.flatMap(t=>t.layers.map(l=>l.primitive));q.vertices=q.trails.trails.map(t=>JSON.stringify(t.positions));
return {range:H.Cartesian3.magnitude(p),visibility:q.visibility,alpha:q.trails.trails.map(t=>t.layers.map(l=>l.material.uniforms.maximumAlpha))};},name);
if(start.visibility!==0||start.alpha.flat().some(a=>a!==0))throw Error('Stable Inspection trail');
await page.getByRole('button',{name:'Back to Earth View',exact:true}).click();
const result=await page.evaluate(()=>{const q=globalThis.__qa,H=q.helpers,v=q.viewer;v.useDefaultRenderLoop=false;const rows=[];
for(let i=0;i<=100;i++){q.override=i/100;q.tick();v.render();const range=H.Cartesian3.distance(v.camera.positionWC,q.model.boundingSphere.center);rows.push({fraction:i/100,range,mode:q.mode,visibility:q.visibility,trails:q.trails.trails.map(t=>({source:t.source,gap:t.gapSeconds,alpha:t.layers.map(l=>l.material.uniforms.maximumAlpha),show:t.layers.map(l=>l.primitive.show)}))});
 if(q.visibility<0||q.visibility>1)throw Error('Visibility outside bounds');if(range<=100000 && q.visibility!==0)throw Error('Close trail visible');
 for(const t of q.trails.trails)for(const [j,l]of t.layers.entries()){const expected=(t.source===q.source?.trim()?0.85:0.08)*[.26,1][j]*q.visibility;if(t.gapSeconds!==null && Math.abs(l.material.uniforms.maximumAlpha-expected)>1e-12)throw Error('Alpha composition');}
}
const retained=q.trails.trails.flatMap(t=>t.layers.map(l=>l.primitive)).every((p,i)=>p===q.retained[i]),vertices=q.trails.trails.every((t,i)=>JSON.stringify(t.positions)===q.vertices[i]);
const restore=H.Cartesian3.distance(v.camera.positionWC,q.saved.position),fov=v.camera.frustum.fov-q.saved.fov;q.override=undefined;v.useDefaultRenderLoop=true;
return {rows,retained,vertices,restore,fov,primitives:v.scene.primitives.length,scale:q.model.scale,minimumPixel:q.model.minimumPixelSize,canvas:[v.scene.canvas.width,v.scene.canvas.height],msaa:v.scene.msaaSamples};});
if(!result.retained||!result.vertices||result.restore!==0||result.fov!==0||result.rows.at(-1).visibility!==1)throw Error('Frozen resource/endpoint gate');report.cases.push({source,name,start,...result});console.log(report.label,source,name);
}
await page.screenshot({path:out+'/'+report.label+'-surface.jpg',type:'jpeg',quality:80});
fs.writeFileSync(out+'/'+report.label+'-poses.json',JSON.stringify(report));if(report.errors.length)throw Error(JSON.stringify(report.errors));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
