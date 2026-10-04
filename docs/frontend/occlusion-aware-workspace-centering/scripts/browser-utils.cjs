const path=require('path');
const repo=path.resolve(__dirname,'../../../..');
const evidence=path.join(repo,'docs/frontend/occlusion-aware-workspace-centering/evidence');
const {chromium}=require(process.env.MISSION1_PLAYWRIGHT_MODULE||'/Users/daniel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
function viewer(){const el=document.querySelector('.earth-view');let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];for(;f;f=f.return)for(let h=f.memoizedState;h;h=h.next){const v=h.memoizedState?.current;if(v?.scene?.camera&&v?.clock)return v;}}
function observe(){
 const v=window.__v,c=v.camera,fr=c.frustum;
 const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
 const viewport=rect(document.querySelector('.app-shell')),canvas=rect(v.canvas);
 const panels=[...document.querySelectorAll('.status-panel,.replay-orbit')].map(e=>{const s=getComputedStyle(e);return {...rect(e),owner:e.className,side:s.display!=='none'&&s.visibility!=='hidden'&&s.getPropertyValue('--earth-workspace-side').trim()==='1'}});
 const dashboard=panels.find(p=>p.side&&p.width>0&&p.height>0)||null;
 const clipped=dashboard?{left:Math.max(viewport.left,dashboard.left),top:Math.max(viewport.top,dashboard.top),right:Math.min(viewport.right,dashboard.right),bottom:Math.min(viewport.bottom,dashboard.bottom)}:null;
 const A=viewport.width*viewport.height,a=clipped?Math.max(0,clipped.right-clipped.left)*Math.max(0,clipped.bottom-clipped.top):0;
 const centroid=a<A?{x:(A*(viewport.left+viewport.width/2)-a*((clipped?.left??0)+(clipped?.right??0))/2)/(A-a),y:(A*(viewport.top+viewport.height/2)-a*((clipped?.top??0)+(clipped?.bottom??0))/2)/(A-a)}:{x:viewport.width/2,y:viewport.height/2};
 const vector=p=>[p.x,p.y,p.z],dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
 // Public camera.viewMatrix and frustum.projectionMatrix, same projection used by SceneTransforms.
 function project(a){const p=c.viewMatrix,m=fr.projectionMatrix,world=[a.x,a.y,a.z,1],eye=[0,1,2,3].map(i=>world.reduce((n,w,j)=>n+p[j*4+i]*w,0)),clip=[0,1,2,3].map(i=>eye.reduce((n,w,j)=>n+m[j*4+i]*w,0));return {x:canvas.left+(clip[0]/clip[3]+1)*canvas.width/2,y:canvas.top+(1-clip[1]/clip[3])*canvas.height/2};}
 const model=[...Array(v.scene.primitives.length)].map((_,i)=>v.scene.primitives.get(i)).find(p=>typeof p.id==='string'&&p.id.includes('iss'));
 const focus={x:c.positionWC.x+c.directionWC.x*1000,y:c.positionWC.y+c.directionWC.y*1000,z:c.positionWC.z+c.directionWC.z*1000};
 const focal=project(focus),ray=c.getPickRay({x:focal.x-canvas.left,y:focal.y-canvas.top});
 const pixels=fr.getPixelDimensions(canvas.width,canvas.height,1000,1,{x:0,y:0});
 return {viewport,canvas,panels,dashboard,clipped,layout:dashboard?'LEFT_DASHBOARD':'FULL_VIEWPORT / BOTTOM_OR_HIDDEN',viewportArea:A,dashboardArea:a,freeArea:A-a,centroid,focal,error:Math.hypot(focal.x-centroid.x,focal.y-centroid.y),earth:project({x:0,y:0,z:0}),model:model?.ready?project(model.boundingSphere.center):null,position:vector(c.positionWC),direction:vector(c.directionWC),up:vector(c.upWC),right:vector(c.rightWC),local:vector(c.position),heading:c.heading,pitch:c.pitch,roll:c.roll,transform:Array.from(c.transform),range:Math.hypot(c.position.x,c.position.y,c.position.z),elevation:Math.atan2(c.position.z,Math.hypot(c.position.x,c.position.y))*180/Math.PI,lateral:c.position.y,nativeFovDegrees:fr.fov*180/Math.PI,xOffset:fr.xOffset,yOffset:fr.yOffset,near:fr.near,far:fr.far,pixels,rayDot:ray&&dot(ray.direction,c.directionWC),animate:v.clock.shouldAnimate,time:v.clock.currentTime.constructor.toIso8601(v.clock.currentTime),primitives:v.scene.primitives.length,modelReady:!!model?.ready,minimumPixelSize:model?.minimumPixelSize};
}
async function ready(p){await p.waitForFunction(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Inspect ISS')?.disabled===false,null,{timeout:90000});await p.evaluate(`window.__v=(${viewer.toString()})();`);await p.waitForTimeout(800);}
module.exports={chromium,repo,evidence,viewer,observe,ready};
