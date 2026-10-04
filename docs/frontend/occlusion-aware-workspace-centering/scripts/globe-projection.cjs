// Public-API raster regression: actual imagery, frozen clock/camera, no data fixtures.
// Acceptance is declared before capture: neutral RGB delta <=3 everywhere in ROI;
// shifted textured globe agreement within RGB 30 for >=99% of lit reference samples.
const fs=require('fs'),assert=require('assert/strict');
const {PNG}=require(process.env.MISSION1_PNG_MODULE||'/Users/daniel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pngjs');
const {chromium,ready,observe,evidence}=require('./browser-utils.cjs');
const load=f=>PNG.sync.read(fs.readFileSync(f));
const rgb=(im,x,y)=>{const i=(y*im.width+x)*4;return [im.data[i],im.data[i+1],im.data[i+2]]};
const delta=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
(async()=>{const b=await chromium.launch({headless:true,args:['--use-angle=metal']});const rows=[];try{for(const port of [5175,4175]){const p=await b.newPage({viewport:{width:1440,height:900}}),errors=[];p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});await p.goto(`http://127.0.0.1:${port}`);await ready(p);
await p.evaluate(()=>{const v=window.__v;v.clock.shouldAnimate=false;window.__globeProjection=v.scene.globe.material;window.__offsets=[v.camera.frustum.xOffset,v.camera.frustum.yOffset];v.camera.frustum.xOffset=0;v.camera.frustum.yOffset=0;v.scene.globe.material=undefined;v.scene.requestRender()});
await p.waitForFunction(()=>window.__v.scene.globe.tilesLoaded,null,{timeout:60000});await p.waitForTimeout(2500);
const baseline=`${evidence}/globe-${port}-symmetric-native.png`;await p.screenshot({path:baseline});
await p.evaluate(()=>{window.__v.scene.globe.material=window.__globeProjection;window.__v.scene.requestRender()});await p.waitForTimeout(1800);
const neutral=`${evidence}/globe-${port}-symmetric-adapter.png`;await p.screenshot({path:neutral});
const symmetric=await p.evaluate(observe);
await p.evaluate(()=>{const fr=window.__v.camera.frustum;[fr.xOffset,fr.yOffset]=window.__offsets;window.__v.scene.requestRender()});await p.waitForFunction(()=>window.__v.scene.globe.tilesLoaded,null,{timeout:60000});await p.waitForTimeout(1800);
const shifted=`${evidence}/globe-${port}-off-center-adapter.png`;await p.screenshot({path:shifted});const offset=await p.evaluate(observe);
const a=load(baseline),n=load(neutral),s=load(shifted);let neutralMax=0,neutralSamples=0;
// ROI clear of dashboard, wordmark, credits, clocks and controls.
for(let y=175;y<775;y++)for(let x=420;x<1250;x++){neutralMax=Math.max(neutralMax,delta(rgb(a,x,y),rgb(n,x,y)));neutralSamples++;}
assert(neutralMax<=3,`Neutral material changes RGB: ${neutralMax}`);
const dx=offset.focal.x-symmetric.focal.x,dy=offset.focal.y-symmetric.focal.y;let litSamples=0,matched=0,maxBestDelta=0;const failures=[];
// Reproject a fixed sampling grid; +/-1 pixel accounts for fractional centroid
// translation and raster sampling. Lit reference pixels exclude black sky/night.
for(let y=175;y<775;y+=7)for(let x=420;x<1250;x+=7){const r=rgb(n,x,y);if(Math.max(...r)<35)continue;const sx=Math.round(x+dx),sy=Math.round(y+dy);if(sx<420||sx>=1340||sy<175||sy>=775)continue;let best=255;for(let yy=-1;yy<=1;yy++)for(let xx=-1;xx<=1;xx++)best=Math.min(best,delta(r,rgb(s,sx+xx,sy+yy)));litSamples++;maxBestDelta=Math.max(maxBestDelta,best);if(best<=30)matched++;else failures.push({x,y,sx,sy,rgb:r,bestDelta:best});}
assert(litSamples>1000,`Too few textured samples: ${litSamples}`);assert(matched/litSamples>=.99,`Shifted globe agreement ${matched}/${litSamples}`);assert.deepEqual(errors,[]);
rows.push({port,method:'Public Globe.material toggle, frozen scene clock/camera, native raster PNGs; same real imagery',tolerances:{neutralMaxRgb:3,shiftedRgb:30,shiftedMinFraction:.99,neighbourhoodPixels:1},neutralSamples,neutralMaxRgb:neutralMax,shift:{dx,dy},litSamples,matched,matchedFraction:matched/litSamples,maxBestDelta,failures,physicalPositionDelta:Math.hypot(...offset.position.map((v,i)=>v-symmetric.position[i])),errors});fs.writeFileSync(`${evidence}/globe-projection.json`,JSON.stringify(rows,null,2));console.log(JSON.stringify(rows.at(-1)));await p.close();}}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
