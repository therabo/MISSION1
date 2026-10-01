// Measures actual captured derivatives and infinitesimal retarget derivatives.
const fs=require('fs'),path=require('path');const repo=process.env.MISSION1_REPO_ROOT||path.resolve(__dirname,'../../../..');
const out=process.env.MISSION1_EVIDENCE_DIR||'/tmp/mission1-perceptual-evidence';fs.mkdirSync(out,{recursive:true});
const {chromium}=require(process.env.MISSION1_PLAYWRIGHT_MODULE||'playwright');const port=+process.argv[2]||5173,label=process.argv[3]||(port===5173?'development':'production');
(async()=>{const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});try{
const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:2});
for(const [api,file]of [['samples','real-samples.json'],['comparison','real-comparison.json']])await context.route('**/api/iss/orbit/'+api,r=>r.fulfill({json:JSON.parse(fs.readFileSync(repo+'/docs/frontend/inspection-orientation-review/'+file))}));
await context.route('https://gibs.earthdata.nasa.gov/**',r=>r.abort('failed'));
const page=await context.newPage(),report={label,cases:[],errors:[]};page.on('pageerror',e=>report.errors.push(String(e)));
await page.goto('http://127.0.0.1:'+port);await page.waitForFunction(()=>globalThis.__qa?.model?.ready,null,{timeout:60000});

for(const source of ['PRIMARY_GP_TLE','NASA_OEM']){
 await page.getByRole('button',{name:source==='NASA_OEM'?'NASA OEM':'MISSION1 GP/TLE',exact:true}).click();
 for(const fraction of [.1,.2,.35,.5,.65,.8,.95]){
  await page.evaluate(()=>{const q=globalThis.__qa,H=q.helpers,v=q.viewer;v.clock.shouldAnimate=false;v.clock.currentTime=H.JulianDate.fromIso8601('2026-09-30T15:45:59.975908Z');v.camera.setView({destination:new H.Cartesian3(-9412786.358621413,-21163227.169227634,-3167995.3206285993),orientation:{direction:new H.Cartesian3(.40258878698283174,.9051600270198104,.13640965538109276),up:new H.Cartesian3(-.055435177167269443,-.12463761556457154,.9906525152235831)}});});
  await page.waitForTimeout(150);await page.evaluate(()=>globalThis.__qa.viewer.clock.shouldAnimate=true);
  await page.getByRole('button',{name:'Inspect ISS',exact:true}).evaluate(b=>b.click());
  await page.waitForFunction(f=>globalThis.__qa.progress>=f&&globalThis.__qa.progress<1&&globalThis.__qa.mode==='ENTERING_INSPECTION',fraction);
  const result=await page.evaluate(()=>{
   try { const q=globalThis.__qa,H=q.helpers,c=q.viewer.camera,vec=a=>[a.x,a.y,a.z];
   const before={position:H.Cartesian3.clone(c.positionWC),direction:H.Cartesian3.clone(c.directionWC),up:H.Cartesian3.clone(c.upWC),fov:c.frustum.fov};
   const opacityBefore=q.visibility,rangeBefore=H.Cartesian3.distance(c.positionWC,q.model.boundingSphere.center);
   const velocity=H.Cartesian3.clone(q.derivatives.velocity),progress=q.progress;
   const oldPoseDirection=H.Cartesian3.clone(q.flight.pose.direction),oldPosePosition=H.Cartesian3.clone(q.flight.pose.position);const oldFlightFocus=H.Cartesian3.clone(q.flight.focusPoint);const initialFocus=H.Cartesian3.clone(q.focus),incomingFocusVelocity=H.Cartesian3.clone(q.derivatives.focus);
   const incomingQuaternion=H.Quaternion.clone(q.derivatives.quaternion),incomingOrientation=H.Quaternion.clone(q.derivatives.orientation),incomingFov=q.derivatives.fov;
   const poseQuaternion=(direction,up)=>{
     const right=H.Cartesian3.normalize(H.Cartesian3.cross(direction,up,new H.Cartesian3()),new H.Cartesian3());
     const correctedUp=H.Cartesian3.cross(right,direction,new H.Cartesian3()),back=H.Cartesian3.negate(direction,new H.Cartesian3());
     const matrix=new H.Matrix3();H.Matrix3.setColumn(matrix,0,right,matrix);H.Matrix3.setColumn(matrix,1,correctedUp,matrix);H.Matrix3.setColumn(matrix,2,back,matrix);
     return H.Quaternion.fromRotationMatrix(matrix,new H.Quaternion());
   };
   q.back(); // Same handler as Back; synchronous dispatch permits the derivative audit.
   const high=Math.min(10000000,H.Cartesian3.distance(q.saved.position,q.model.boundingSphere.center)),low=Math.min(100000,high/2),x=Math.max(0,Math.min(1,Math.log(Math.max(low,rangeBefore)/low)/Math.log(high/low)));
   const opacityAfter=x*x*x*(10+x*(-15+6*x)),opacityJump=Math.abs(opacityAfter-opacityBefore);
   const f=q.flight,step=Math.min(1e-5,f.tangentDuration/10000),time=H.JulianDate.addSeconds(q.viewer.clock.currentTime,step,new H.JulianDate());
   const position=q.positionAt(time,new H.Cartesian3()),v=q.velocityAt(time,new H.Cartesian3()),frame=new H.Matrix4();new H.TrajectoryVisualFrame().update(position,v,frame);
   const physicalNow=H.Matrix4.getTranslation(q.frame,new H.Cartesian3());
   const displayNow=q.model.boundingSphere.center;const localDisplay=H.Matrix4.multiplyByPoint(H.Matrix4.inverseTransformation(q.frame,new H.Matrix4()),displayNow,new H.Cartesian3());
   const futureDisplay=H.Matrix4.multiplyByPoint(frame,localDisplay,new H.Cartesian3());
   const initial=f.evaluate(q.frame,0,displayNow),first={position:H.Cartesian3.clone(initial.position),direction:H.Cartesian3.clone(initial.direction),up:H.Cartesian3.clone(initial.up),fov:initial.fov};
   const firstFocus=H.Cartesian3.clone(f.focusPoint);
   const next=f.evaluate(frame,step/f.duration,futureDisplay);
   const outgoingFocusVelocity=H.Cartesian3.divideByScalar(H.Cartesian3.subtract(f.focusPoint,firstFocus,new H.Cartesian3()),step,new H.Cartesian3());
   const focusError=H.Cartesian3.distance(initialFocus,firstFocus),focusVelocityError=H.Cartesian3.distance(outgoingFocusVelocity,incomingFocusVelocity);
   const outgoing=H.Cartesian3.divideByScalar(H.Cartesian3.subtract(next.position,first.position,new H.Cartesian3()),step,new H.Cartesian3());
   const initialQuaternion=poseQuaternion(first.direction,first.up),nextQuaternion=poseQuaternion(next.direction,next.up);
   if(H.Quaternion.dot(initialQuaternion,incomingOrientation)<0)H.Quaternion.negate(initialQuaternion,initialQuaternion);
   if(H.Quaternion.dot(nextQuaternion,initialQuaternion)<0)H.Quaternion.negate(nextQuaternion,nextQuaternion);
   const outgoingQuaternion=H.Quaternion.multiplyByScalar(H.Quaternion.subtract(nextQuaternion,initialQuaternion,new H.Quaternion()),1/step,new H.Quaternion());
   const quaternionRateError=H.Quaternion.magnitude(H.Quaternion.subtract(outgoingQuaternion,incomingQuaternion,new H.Quaternion()));
   const angularVelocity=(rate,orientation)=>{
    const rotation=H.Quaternion.multiply(rate,H.Quaternion.conjugate(orientation,new H.Quaternion()),new H.Quaternion());
    return new H.Cartesian3(2*rotation.x,2*rotation.y,2*rotation.z);
   };
   const preAngularVelocity=angularVelocity(incomingQuaternion,incomingOrientation);
   const postAngularVelocity=angularVelocity(outgoingQuaternion,initialQuaternion);
   const angularVelocityError=H.Cartesian3.distance(preAngularVelocity,postAngularVelocity);
   const outgoingFov=(next.fov-first.fov)/step;
   if(!Number.isFinite(outgoing.x)||H.Cartesian3.magnitudeSquared(velocity)===0||H.Cartesian3.magnitudeSquared(outgoing)===0)return {failure:'Invalid derivative',progress,step,tangentDuration:f.tangentDuration,pre:vec(velocity),post:vec(outgoing)};
   return {opacityBefore,opacityAfter,opacityJump,rangeBefore,oldPoseDirection:vec(oldPoseDirection),cameraDirection:vec(before.direction),oldPosePosition:vec(oldPosePosition),cameraPosition:vec(before.position),preFocus:vec(initialFocus),oldFlightFocus:vec(oldFlightFocus),firstFocus:vec(firstFocus),focusInput:f.composition.initialDistance,focusActualDistance:H.Cartesian3.distance(first.position,firstFocus),preRayAngle:H.Cartesian3.angleBetween(H.Cartesian3.subtract(oldFlightFocus,before.position,new H.Cartesian3()),before.direction),focusError,focusVelocityError,preFocusVelocity:vec(incomingFocusVelocity),postFocusVelocity:vec(outgoingFocusVelocity),progress,step,tangentDuration:f.tangentDuration,preVelocity:vec(velocity),postVelocity:vec(outgoing),preQuaternionRate:[incomingQuaternion.x,incomingQuaternion.y,incomingQuaternion.z,incomingQuaternion.w],postQuaternionRate:[outgoingQuaternion.x,outgoingQuaternion.y,outgoingQuaternion.z,outgoingQuaternion.w],quaternionRateError,preAngularVelocity:vec(preAngularVelocity),postAngularVelocity:vec(postAngularVelocity),angularVelocityError,preFovRate:incomingFov,postFovRate:outgoingFov,fovRateError:outgoingFov-incomingFov,velocityAngleDegrees:H.CesiumMath.toDegrees(H.Cartesian3.angleBetween(velocity,outgoing)),velocityMagnitudeFraction:(H.Cartesian3.magnitude(outgoing)-H.Cartesian3.magnitude(velocity))/H.Cartesian3.magnitude(velocity),positionError:H.Cartesian3.distance(before.position,first.position),directionError:H.Cartesian3.angleBetween(before.direction,first.direction),upError:H.Cartesian3.angleBetween(before.up,first.up),fovError:first.fov-before.fov};
   } catch(e) { return {failure:String(e),message:e.message,stack:e.stack}; }
  });
  if(result.failure) throw Error(JSON.stringify(result));
  report.cases.push({source,fraction,...result});console.log(label,source,fraction,result.velocityAngleDegrees,result.velocityMagnitudeFraction);
  if(result.opacityJump>0.00001||result.focusError>1e-5||result.focusVelocityError/Math.max(1,Math.hypot(...result.preFocusVelocity))>.01||result.positionError>1e-6||result.directionError>1e-7||result.upError>1e-7||Math.abs(result.fovError)>1e-10||result.velocityAngleDegrees>1||Math.abs(result.velocityMagnitudeFraction)>.01||result.quaternionRateError>.01||result.angularVelocityError>.0001||Math.abs(result.fovRateError)>.001)throw Error('Reversal gate '+JSON.stringify(result));
  await page.waitForFunction(()=>globalThis.__qa.mode==='EARTH_OVERVIEW',null,{timeout:15000});
 }
}
fs.writeFileSync(out+'/'+label+'-reversals.json',JSON.stringify(report,null,2));if(report.errors.length)throw Error(JSON.stringify(report.errors));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
