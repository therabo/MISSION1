// Run after run-qa.cjs, serially, so timed Chromium workloads never overlap.
const fs=require('fs'),{spawn}=require('child_process');
const root=process.env.MISSION1_REPO_ROOT||'/Users/daniel/Desktop/MISSION1';
const out=root+'/docs/frontend/camera-transition-perfecting-review/focus-optimization',scripts=out+'/scripts',old=root+'/docs/frontend/camera-transition-perfecting-review/scripts';
const env={...process.env,MISSION1_REPO_ROOT:root,MISSION1_EVIDENCE_DIR:out,MISSION1_PLAYWRIGHT_MODULE:process.env.MISSION1_PLAYWRIGHT_MODULE||'/Users/daniel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'};
const jobs=[];const job=(name,file,args,extra={},command=process.execPath)=>jobs.push({name,file,args,extra,command});
// The first dev baseline capture preceded the optional GPU timer addition.
for(const [source,key]of [['PRIMARY_GP_TLE','gp'],['NASA_OEM','oem']])job('baseline-dev-'+key,scripts+'/trace-focus.cjs',['5183','baseline-dev-'+key],{MISSION1_QA_SOURCE:source,MISSION1_QA_GL_TIMINGS:'1',MISSION1_QA_CPU_PROFILE:'1'});
for(const [build,port,key]of [['development',5184,'dev'],['production',4184,'prod']]){
 for(const [source,suffix]of [['PRIMARY_GP_TLE','gp'],['NASA_OEM','oem']])job('final-'+key+'-'+suffix,scripts+'/trace-focus.cjs',[String(port),'final-'+key+'-'+suffix],{MISSION1_QA_SOURCE:source,MISSION1_QA_GL_TIMINGS:'1',MISSION1_QA_CPU_PROFILE:'1'});
 job('startup-race-'+build,scripts+'/startup-race.cjs',[String(port),build]);
}
for(const [label,port,width,height]of [['baseline',4183,1280,720],['production',4184,1280,720],['narrow',4184,900,700],['mobile',4184,390,844]]){
 const raw='/tmp/mission1-focus/raster-'+label;
 job('raster-'+label,old+'/perceptual-snapshots.cjs',[String(port),label],{MISSION1_EVIDENCE_DIR:raw,MISSION1_QA_WIDTH:String(width),MISSION1_QA_HEIGHT:String(height)});
 job('measure-'+label,old+'/measure-perceptual-snapshots.py',[raw,out,label],{},'/tmp/mission1-camera-plot/bin/python');
 job('discard-raw-'+label,scripts+'/discard-raw-snapshots.py',[raw],{},'/tmp/mission1-camera-plot/bin/python');
}
for(const [build,port]of [['development',5184],['production',4184]])job('resources-'+build,scripts+'/arbitrary-focus.cjs',[String(port),build+'-resources'],{MISSION1_QA_RESOURCE_ONLY:'1'});
for(const [build,port]of [['development',5184],['production',4184]])job('lint-'+build,scripts+'/visual-lint.cjs',[String(port),build]);
job('clean-live-smoke',old+'/clean-live-smoke.cjs',[],{MISSION1_EVIDENCE_DIR:out});
// Complete first/warm entry and exit CPU profiles on all baseline builds too.
for(const [name,port,label,source]of [['baseline-dev-gp-cpu',5183,'baseline-dev-gp','PRIMARY_GP_TLE'],['baseline-prod-gp-cpu',4183,'baseline-prod-gp','PRIMARY_GP_TLE'],['baseline-prod-oem-cpu',4183,'baseline-prod-oem','NASA_OEM']])job(name,scripts+'/trace-focus.cjs',[String(port),label],{MISSION1_QA_SOURCE:source,MISSION1_QA_GL_TIMINGS:'1',MISSION1_QA_CPU_PROFILE:'1'});
const report=process.env.MISSION1_QA_RESUME?JSON.parse(fs.readFileSync(out+'/qa-evidence-run.json')):{started:new Date().toISOString(),jobs:[]};
(async()=>{for(const j of jobs){const previous=report.jobs.find(row=>row.name===j.name);if(previous?.code===0)continue;const attempts=previous?[...(previous.attempts||[]),{code:previous.code,seconds:previous.seconds}]:[];if(previous)report.jobs.splice(report.jobs.indexOf(previous),1);console.log('START',j.name);const started=Date.now(),log=fs.openSync('/tmp/mission1-focus/'+j.name+'.log','w');const code=await new Promise(resolve=>spawn(j.command,[j.file,...j.args],{env:{...env,...j.extra},stdio:['ignore',log,log]}).on('exit',resolve));fs.closeSync(log);report.jobs.push({...j,code,seconds:(Date.now()-started)/1000,...(attempts.length?{attempts}:{})});fs.writeFileSync(out+'/qa-evidence-run.json',JSON.stringify(report,null,2));console.log('DONE',j.name,code);if(code!==0)throw Error(j.name+' failed');}report.finished=new Date().toISOString();fs.writeFileSync(out+'/qa-evidence-run.json',JSON.stringify(report,null,2));})().catch(e=>{console.error(e);process.exitCode=1;});
