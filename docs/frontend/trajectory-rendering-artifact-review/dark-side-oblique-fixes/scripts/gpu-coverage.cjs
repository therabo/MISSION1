// Deterministic GPU property tests. Extract public FINAL shader sources from the
// disposable renderer; no copied production coverage implementation or QA hook.
// All coordinates in this test are explicitly synthetic screen/eye geometry.
const fs=require('fs'),path=require('path');
const {chromium}=require(process.env.MISSION1_PLAYWRIGHT_MODULE);
const out=process.env.MISSION1_EVIDENCE_DIR||path.resolve(__dirname,'../runs');
const port=process.argv[2],label=process.argv[3];
(async()=>{const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});try{
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:2});
 for(const [api,file]of[['samples','real-samples.json'],['comparison','real-comparison.json']])await context.route('**/api/iss/orbit/'+api,r=>r.fulfill({json:JSON.parse(fs.readFileSync(path.join(process.env.MISSION1_FIXTURE_DIR||path.resolve(__dirname,'../fixtures'),file)))}));
 await context.route('https://gibs.earthdata.nasa.gov/**',r=>r.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+port);await page.waitForFunction(()=>!!globalThis.__qa?.trails?.trails?.length,null,{timeout:60000});
 const result=await page.evaluate(()=>{
  const q=globalThis.__qa,layer=q.trails.trails[0].layers[1],appearance=layer.primitive.appearance,material=layer.material;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const gl=canvas.getContext('webgl2',{antialias:false,preserveDrawingBuffer:true});if(!gl)throw Error('WebGL2 required');
  const head='#version 300 es\nprecision highp float;\n';
  const automatic=`uniform vec4 czm_viewport;uniform mat4 czm_inverseProjection;uniform mat3 czm_inverseViewRotation;uniform vec3 czm_viewerPositionWC;uniform vec3 czm_ellipsoidInverseRadii;`;
  const structs=`struct czm_materialInput {float s;vec2 st;vec3 str;};struct czm_material {vec3 diffuse;vec3 emission;float alpha;};czm_material czm_getDefaultMaterial(czm_materialInput i){czm_material m;m.diffuse=vec3(0);m.emission=vec3(0);m.alpha=1.;return m;}void czm_writeLogDepth(){}`;
  const earth=material.shaderSource.match(/bool mission1EarthOccludesDepth\(float depth\) \{[\s\S]*?\n\s*\}/)[0];
  const compile=(kind,s)=>{const shader=gl.createShader(kind);gl.shaderSource(shader,s);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;};
  const program=(vs,fs)=>{const p=gl.createProgram(),a=compile(gl.VERTEX_SHADER,head+vs),b=compile(gl.FRAGMENT_SHADER,head+fs);gl.attachShader(p,a);gl.attachShader(p,b);gl.linkProgram(p);gl.deleteShader(a);gl.deleteShader(b);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;};
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const uniform=(p,n,v)=>{const loc=gl.getUniformLocation(p,n);if(loc===null)return;if(typeof v==='number')gl.uniform1f(loc,v);else if(v.length===16)gl.uniformMatrix4fv(loc,false,v);else if(v.length===9)gl.uniformMatrix3fv(loc,false,v);else gl['uniform'+v.length+'fv'](loc,v);};
  const setup=p=>{gl.useProgram(p);const at=gl.getAttribLocation(p,'position');gl.enableVertexAttribArray(at);gl.vertexAttribPointer(at,2,gl.FLOAT,false,0,0);gl.viewport(0,0,256,256);uniform(p,'czm_viewport',[0,0,256,256]);uniform(p,'czm_inverseProjection',[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);uniform(p,'czm_inverseViewRotation',[1,0,0,0,1,0,0,0,1]);uniform(p,'czm_viewerPositionWC',[0,0,23000000]);uniform(p,'czm_ellipsoidInverseRadii',[1/6378137,1/6378137,1/6356752.314245]);};
  const read=()=>{const p=new Uint8Array(256*256*4);gl.readPixels(0,0,256,256,gl.RGBA,gl.UNSIGNED_BYTE,p);return p;};
  const declarations=appearance.fragmentShaderSource.match(/flat in [^;]+;/g).join('\n').replaceAll('flat in','flat out');
  const names=['Segment','Before','After','Time','BeforeTime','AfterTime'];
  const vs=`in vec2 position;${declarations}${names.map(n=>`uniform vec4 u${n};`).join('')}uniform float uHalfWidth;uniform vec2 uNeighbors;void main(){${names.map(n=>`v_mission1${n}=u${n};`).join('')}v_mission1HalfWidth=uHalfWidth;v_mission1Neighbors=uNeighbors;gl_Position=vec4(position,0,1);}`;
  const start=appearance.fragmentShaderSource.match(/before\.y > (\w+)/)[1],end=appearance.fragmentShaderSource.match(/before\.y < (\w+)/)[1];
  const shape=program(vs,automatic+structs+earth+`uniform float ${start};uniform float ${end};out vec4 out_FragColor;czm_material czm_getMaterial(czm_materialInput i){czm_material m=czm_getDefaultMaterial(i);float a=i.st.t<=1.?1.:0.;m.diffuse=vec3(a/255.,0,0);return m;}`+appearance.fragmentShaderSource);
  setup(shape);uniform(shape,start,0);uniform(shape,end,1);
  // Independent reference: endpoint disks plus perpendicular distance to the
  // finite interior. It does not reuse the GLSL closest-point interpolation.
  const distance=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(!len)return Math.hypot(p[0]-a[0],p[1]-a[1]);const dot=(p[0]-a[0])*dx+(p[1]-a[1])*dy;if(dot<=0)return Math.hypot(p[0]-a[0],p[1]-a[1]);if(dot>=len*len)return Math.hypot(p[0]-b[0],p[1]-b[1]);return Math.abs(dx*(p[1]-a[1])-dy*(p[0]-a[0]))/len;};
  const joins=[];
  for(const angle of [0,10,15,20,30,45,60,75,89.9,179.9])for(const radius of [4.25,8.5,10.25,20.5]){
   const a=[16,128],b=[128,128],c=[128+112*Math.cos(angle*Math.PI/180),128+112*Math.sin(angle*Math.PI/180)],ab=[...a,...b],bc=[...b,...c];
   gl.disable(gl.BLEND);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);uniform(shape,'uHalfWidth',radius);
   for(const i of [0,1]){uniform(shape,'uSegment',i?bc:ab);uniform(shape,'uBefore',ab);uniform(shape,'uAfter',bc);uniform(shape,'uTime',i?[.4,.6,100,100]:[.2,.4,100,100]);uniform(shape,'uBeforeTime',[.2,.4,100,100]);uniform(shape,'uAfterTime',[.4,.6,100,100]);uniform(shape,'uNeighbors',i?[1,0]:[0,1]);gl.drawArrays(gl.TRIANGLES,0,6);}
   const pixels=read();let overdraw=0,leak=0,missing=0,covered=0;
   for(let y=0;y<256;y++)for(let x=0;x<256;x++){const d=Math.min(distance([x+.5,y+.5],a,b),distance([x+.5,y+.5],b,c)),n=pixels[(y*256+x)*4];if(n>1)overdraw++;if(Math.abs(d-radius)<.002)continue;if(d>radius&&n)leak++;if(d<radius&&!n)missing++;if(n)covered++;}
   joins.push({angle,radius,covered,overdraw,leak,missing});
  }
  const mixed=[];
  for(const angle of [0,10,15,20,30,45,60,75,89.9,179.9])for(const radius of [4.25,8.5,10.25,20.5])for(const depths of [[1000000,16650000,30000000],[30000000,16650000,1000000]]) {
   const a=[16,128],b=[128,128],c=[128+112*Math.cos(angle*Math.PI/180),128+112*Math.sin(angle*Math.PI/180)],ab=[...a,...b],bc=[...b,...c];
   gl.disable(gl.BLEND);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);uniform(shape,'uHalfWidth',radius);
   for(const i of [0,1]){uniform(shape,'uSegment',i?bc:ab);uniform(shape,'uBefore',ab);uniform(shape,'uAfter',bc);uniform(shape,'uTime',i?[.4,.6,depths[1],depths[2]]:[.2,.4,depths[0],depths[1]]);uniform(shape,'uBeforeTime',[.2,.4,depths[0],depths[1]]);uniform(shape,'uAfterTime',[.4,.6,depths[1],depths[2]]);uniform(shape,'uNeighbors',i?[1,0]:[0,1]);gl.drawArrays(gl.TRIANGLES,0,6);}
   const pixels=read();let overdraw=0,leak=0,missing=0,covered=0;
   for(let y=0;y<256;y++)for(let x=0;x<256;x++){const d=Math.min(distance([x+.5,y+.5],a,b),distance([x+.5,y+.5],b,c)),n=pixels[(y*256+x)*4];if(n>1)overdraw++;if(Math.abs(d-radius)<.002)continue;if(d>radius&&n)leak++;if(d<radius&&!n)missing++;if(n)covered++;}
   mixed.push({angle,radius,depths,covered,overdraw,leak,missing});
  }
  gl.deleteProgram(shape);gl.disable(gl.BLEND);
  const maskSource=material.materials.clearanceMask.shaderSource;
  const maskFunction=maskSource.match(/czm_material (czm_getMaterial(?:_\d+)?)\(/)[1];
  const mask=program('in vec2 position;void main(){gl_Position=vec4(position,0,1);}',automatic+structs+maskSource+`out vec4 out_FragColor;uniform float testTime;void main(){czm_materialInput i;i.s=testTime;i.st=vec2(testTime,.5);i.str=vec3(i.st,0);out_FragColor=vec4(${maskFunction}(i).alpha,0,0,1);}`)
  setup(mask);const actualName=n=>maskSource.match(new RegExp('uniform (?:float|bool|vec2) ('+n+'(?:_\\d+)?);'))[1];
  const setMask=(n,v)=>{const key=actualName(n);if(typeof v==='boolean')gl.uniform1i(gl.getUniformLocation(mask,key),v?1:0);else uniform(mask,key,v);};
  setMask('radius',30);setMask('softness',4);setMask('cssHeight',256);setMask('bufferToCss',[1,1]);
  const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
  // Independent ray/ellipsoid oracle uses closest approach in the unit sphere,
  // followed by conversion to positive camera -Z metres.
  const occluded=(x,y,depth)=>{const vx=(x/256*2-1)/6378137,vy=(y/256*2-1)/6378137,vz=-1/6356752.314245,l=Math.hypot(vx,vy,vz),uz=vz/l,qz=23000000/6356752.314245,t=-qz*uz,perp2=qz*qz-t*t;if(t<=0||perp2>1)return false;return (t-Math.sqrt(1-perp2))/l<depth-1;};
  const masks=[];
  for(const rotation of [0,45,90,180])for(const depth of [100,30000000])for(const external of [false,true]){
   const center=[128,128],r=rotation*Math.PI/180,rot=p=>[128+(p[0]-128)*Math.cos(r)-(p[1]-128)*Math.sin(r),128+(p[0]-128)*Math.sin(r)+(p[1]-128)*Math.cos(r)];
   const origin=rot([68,128]),ta=rot([113,128+Math.sqrt(675)]),tb=rot([113,128-Math.sqrt(675)]);
   for(const [n,v]of Object.entries({center,origin,tangentA:ta,tangentB:tb,initialExternal:external,stationNearDepth:depth}))setMask(n,v);
   let mismatches=0,reentryDifferences=0;const frames=[];
   for(const time of [.1,.9]){uniform(mask,'testTime',time);gl.drawArrays(gl.TRIANGLES,0,6);frames.push(read());}
   const triangleInside=p=>{let winding=0;const poly=[origin,ta,tb];for(let j=0;j<3;j++){const a=poly[j],b=poly[(j+1)%3];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])winding++;}return winding%2===1;};
   for(let y=0;y<256;y++)for(let x=0;x<256;x++){const index=(y*256+x)*4,p=[x+.5,256-y-.5];let d=Math.hypot(p[0]-128,p[1]-128)-30;if(external){const t=Math.min(distance(p,origin,ta),distance(p,ta,tb),distance(p,tb,origin));d=Math.min(d,triangleInside(p)?-t:t);}const expected=occluded(x+.5,y+.5,depth)?255:Math.round(255*smooth(d/4));if(Math.abs(frames[0][index]-expected)>2)mismatches++;if(frames[0][index]!==frames[1][index])reentryDifferences++;}
   masks.push({rotation,depth,external,mismatches,reentryDifferences});
  }gl.deleteProgram(mask);
  const vertex=appearance.vertexShaderSource;
  const clip=vertex.slice(vertex.indexOf('void clipLineSegmentToNearPlane'),vertex.indexOf('vec4 getPolylineWindowCoordinatesEC'));
  const project=vertex.slice(vertex.indexOf('void projectSegment'),vertex.indexOf('void main()',vertex.indexOf('void projectSegment')));
  const planesProgram=program('in vec2 position;void main(){gl_Position=vec4(position,0,1);}',`const float czm_epsilon7=0.0000001;uniform vec2 czm_currentFrustum;vec4 czm_eyeToWindowCoordinates(vec4 p){return vec4(p.xy/-p.z,p.z,1);}${clip}${project}uniform vec4 testA;uniform vec4 testB;uniform int testIndex;out vec4 out_FragColor;void main(){vec4 screen,timeDepth;bool culled;projectSegment(testA,testB,vec2(.2,.6),screen,timeDepth,culled);float value=testIndex<4?screen[testIndex]:(testIndex<8?timeDepth[testIndex-4]:(culled?1.:0.));uint bits=floatBitsToUint(value);out_FragColor=vec4(float(bits&255u),float((bits>>8)&255u),float((bits>>16)&255u),float((bits>>24)&255u))/255.;}`);
  setup(planesProgram);uniform(planesProgram,'czm_currentFrustum',[1,100]);const planes=[];
  for(const [name,a,b,expected]of [
    ['front',[-1,0,-4,1],[1,0,-2,1],[-.25,0,.5,0,.2,.6,4,2,0]],
    ['crossing',[-1,0,0,1],[1,0,-2,1],[0,0,.5,0,.4,.6,1,2,0]],
    ['on-near',[-1,0,-1,1],[1,0,-2,1],[-1,0,.5,0,.2,.6,1,2,0]],
    ['behind',[-1,0,.5,1],[1,0,.2,1],[0,0,0,0,.2,.6,1,1,1]],
    ['zero-extent',[0,0,-2,1],[0,0,-2,1],[0,0,0,0,.2,.6,2,2,0]]
  ]){uniform(planesProgram,'testA',a);uniform(planesProgram,'testB',b);const actual=[];for(let i=0;i<9;i++){gl.uniform1i(gl.getUniformLocation(planesProgram,'testIndex'),i);gl.drawArrays(gl.TRIANGLES,0,6);const bytes=read();actual.push(new DataView(bytes.buffer).getFloat32(0,true));}planes.push({name,actual,expected,mismatches:actual.filter((v,i)=>!Number.isFinite(v)||Math.abs(v-expected[i])>2e-6).length});}
  gl.deleteProgram(planesProgram);gl.deleteBuffer(buffer);const glError=gl.getError();gl.getExtension('WEBGL_lose_context')?.loseContext();
  return {joins,mixed,masks,planes,glError};
 });
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,label+'-gpu.json'),JSON.stringify({label,browser:browser.version(),errors,...result},null,2));
 const failed=[...result.joins.filter(r=>r.overdraw||r.leak||r.missing),...result.mixed.filter(r=>r.overdraw||r.leak||r.missing),...result.masks.filter(r=>r.mismatches||r.reentryDifferences),...result.planes.filter(r=>r.mismatches)];console.log(label,'joins',result.joins.length,'masks',result.masks.length,'failures',failed,'errors',errors);if(failed.length||errors.length||result.glError)process.exitCode=1;
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
