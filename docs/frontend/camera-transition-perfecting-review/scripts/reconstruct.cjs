// Re-render exact archived camera/display poses. These are reconstructions, not original frame grabs.
const fs=require('fs'),path=require('path');
const repo=process.env.MISSION1_REPO_ROOT||path.resolve(__dirname,'../../../..');
const out=process.env.MISSION1_EVIDENCE_DIR||repo+'/docs/frontend/camera-transition-perfecting-review';
const {chromium}=require(process.env.MISSION1_PLAYWRIGHT_MODULE||'playwright');
const port=+process.argv[2],label=process.argv[3];
(async()=>{
 const b=await chromium.launch({headless:true,args:['--use-angle=metal']});
 try{
  const c=await b.newContext({viewport:{width:1280,height:720},deviceScaleFactor:2});
  for(const [api,file] of [['samples','real-samples.json'],['comparison','real-comparison.json']])
   await c.route('**/api/iss/orbit/'+api,r=>r.fulfill({json:JSON.parse(fs.readFileSync(repo+'/docs/frontend/inspection-orientation-review/'+file))}));
  await c.route('https://gibs.earthdata.nasa.gov/**',r=>r.abort('failed'));
  const p=await c.newPage();await p.goto('http://127.0.0.1:'+port);
  await p.waitForFunction(()=>globalThis.__qa?.model?.ready,null,{timeout:60000});
  const data=JSON.parse(fs.readFileSync(out+'/'+label+'-trace.json'));
  const report=[];
  for(const row of data.rows){
   await p.evaluate(() => { const q=globalThis.__qa;
     if(q.removeReconstruction){q.removeReconstruction();q.removeReconstruction=null;}
     q.viewer.useDefaultRenderLoop=true;q.viewer.clock.shouldAnimate=false;
     q.viewer.clock.currentTime=q.helpers.JulianDate.fromIso8601('2026-09-30T15:45:59.975908Z');
   });
   await p.waitForTimeout(500);
   await p.getByRole('button',{name:row.source==='NASA_OEM'?'NASA OEM':'MISSION1 GP/TLE',exact:true}).evaluate(b=>b.click());
   const indices=label==='baseline'?[6,7,8,76,77]:[1,7,60,110];
   const frames=row.exit.frames;
   for(const index of indices){
    const frame=frames.find(f=>f.frameIndex===index);if(!frame)continue;
    await p.evaluate(f=>{
      const q=globalThis.__qa,H=q.helpers,v=q.viewer;
      v.useDefaultRenderLoop=false;v.clock.shouldAnimate=false;v.clock.currentTime=H.JulianDate.fromIso8601(f.utc);
      if(q.removeReconstruction)q.removeReconstruction();
      q.removeReconstruction=v.scene.preRender.addEventListener(()=>{
       const vec=a=>new H.Cartesian3(...a),m=q.model;
       v.camera.lookAtTransform(H.Matrix4.IDENTITY);
       v.camera.setView({destination:vec(f.position),orientation:{direction:vec(f.direction),up:vec(f.up)}});
       v.camera.frustum.fov=f.fov;
       const delta=H.Cartesian3.subtract(vec(f.display),m.boundingSphere.center,new H.Cartesian3());
       const trans=H.Cartesian3.add(H.Matrix4.getTranslation(m.modelMatrix,new H.Cartesian3()),delta,new H.Cartesian3());
       m.modelMatrix=H.Matrix4.setTranslation(m.modelMatrix,trans,new H.Matrix4());
       m.silhouetteSize=f.silhouette;m.silhouetteColor=H.Color.WHITE.withAlpha(f.silhouetteAlpha);
      });
      v.render();v.render();
    },frame);
    const file=`${label}-${row.source}-exit-reconstruction-${index}.jpg`;
    await p.screenshot({path:out+'/'+file,type:'jpeg',quality:82});
    report.push({file,frameIndex:index,progress:frame.progress,utc:frame.utc,displayScreen:frame.displayScreen});
   }
  }
  fs.writeFileSync(out+'/'+label+'-reconstructions.json',JSON.stringify(report,null,2));
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
