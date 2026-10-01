// Serial browser work: no overlapping Chromium benchmark workloads.
const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const root=process.env.MISSION1_REPO_ROOT||'/Users/daniel/Desktop/MISSION1';
const out=root+'/docs/frontend/camera-transition-perfecting-review/focus-optimization';
const scripts=out+'/scripts',old=root+'/docs/frontend/camera-transition-perfecting-review/scripts';
const env={...process.env,MISSION1_REPO_ROOT:root,MISSION1_EVIDENCE_DIR:out,MISSION1_PLAYWRIGHT_MODULE:process.env.MISSION1_PLAYWRIGHT_MODULE||'/Users/daniel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'};
const jobs=[];
function job(name,file,args,extra={}){jobs.push({name,file,args,extra});}
job('baseline-arbitrary','arbitrary-focus.cjs',['5183','baseline-development']);
for(const [version,dev,prod]of [['baseline',5183,4183],['final',5184,4184]])for(const [build,port]of [['dev',dev],['prod',prod]])for(const [source,key]of [['PRIMARY_GP_TLE','gp'],['NASA_OEM','oem']])job(`${version}-${build}-${key}`,'trace-focus.cjs',[String(port),`${version}-${build}-${key}`],{MISSION1_QA_SOURCE:source,MISSION1_QA_GL_TIMINGS:'1',MISSION1_QA_CPU_PROFILE:'1'});
job('development-arbitrary','arbitrary-focus.cjs',['5184','final-development']);
job('production-arbitrary','arbitrary-focus.cjs',['4184','final-production']);
for(const [build,port]of [['development',5184],['production',4184]]){
 job(build+'-ten-cycles','trace-focus.cjs',[String(port),'final-'+build+'-ten-cycles'],{MISSION1_QA_TEN_CYCLES:'1',MISSION1_QA_GL_TIMINGS:'1'});
 job(build+'-reversals','focus-reversals.cjs',[String(port),build]);
 job(build+'-regressions','browser-regressions.cjs',[String(port),build]);
 job(build+'-visual-matrix','browser-matrix.cjs',[String(port),build],{MISSION1_FOCUS_ALREADY_CYCLED:'1',MISSION1_FOCUS_ALREADY_REVERSED:'1'});
}
const selected=process.env.MISSION1_QA_FINAL_ONLY?jobs.filter(j=>!j.name.startsWith('baseline')):jobs;
const report={started:new Date().toISOString(),jobs:[]};
(async()=>{for(const j of selected){console.log('START',j.name);const started=Date.now();const log=fs.openSync('/tmp/mission1-focus/'+j.name+'.log','w');const code=await new Promise(resolve=>{const p=spawn(process.execPath,[scripts+'/'+j.file,...j.args],{env:{...env,...j.extra},stdio:['ignore',log,log]});p.on('exit',resolve);});fs.closeSync(log);report.jobs.push({...j,code,seconds:(Date.now()-started)/1000});fs.writeFileSync(out+'/qa-run.json',JSON.stringify(report,null,2));console.log('DONE',j.name,code);if(code!==0)throw Error(j.name+' failed; inspect /tmp/mission1-focus/'+j.name+'.log');}report.finished=new Date().toISOString();fs.writeFileSync(out+'/qa-run.json',JSON.stringify(report,null,2));})().catch(e=>{console.error(e);process.exitCode=1;});
