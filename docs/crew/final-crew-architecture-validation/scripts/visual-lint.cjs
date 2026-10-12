// Equivalent local visual lint: the skill's .shared/visual-runtime is not installed on this host.
function visualLint(){
 const finding={documentOverflow:document.documentElement.scrollWidth>innerWidth,unnamedControls:[],missingImageAlt:[],tinyText:[],lowContrast:[]};
 const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>2&&r.height>2&&r.bottom>0&&r.top<innerHeight&&s.display!=='none'&&s.visibility!=='hidden'&&s.opacity!=='0';};
 const rgb=s=>{const m=s.match(/^rgba?\(([^)]+)\)/);return m?m[1].split(/[,\s/]+/).filter(Boolean).map(Number):[0,0,0,0];};
 const mix=(top,bottom)=>{const a=top[3]??1;return top.slice(0,3).map((c,i)=>c*a+bottom[i]*(1-a));};
 const background=e=>{const chain=[];for(let n=e;n;n=n.parentElement)chain.push(n);let c=[13,19,27];for(const n of chain.reverse())c=mix(rgb(getComputedStyle(n).backgroundColor),c);return c;};
 const light=c=>c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
 for(const e of document.querySelectorAll('.crew-workspace-group button,.crew-workspace-group input,.crew-workspace-group select'))if(visible(e)&&!(e.textContent?.trim()||e.getAttribute('aria-label')||e.labels?.length))finding.unnamedControls.push(e.outerHTML);
 for(const e of document.querySelectorAll('.crew-workspace-group img'))if(visible(e)&&e.getAttribute('alt')===null)finding.missingImageAlt.push(e.src);
 for(const e of document.querySelectorAll('.crew-workspace-group span,.crew-workspace-group p,.crew-workspace-group a,.crew-workspace-group dt,.crew-workspace-group dd,.crew-workspace-group small,.crew-workspace-group h2,.crew-workspace-group h3,.crew-workspace-group summary')){
  if(!visible(e)||e.children.length||!e.textContent?.trim())continue;
  const style=getComputedStyle(e),size=parseFloat(style.fontSize),text=e.textContent.trim().slice(0,90);
  if(size<11)finding.tinyText.push({text,size});
  const bg=background(e),fg=mix(rgb(style.color),bg),a=light(bg),b=light(fg),contrast=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  const minimum=size>=24||size>=18.66&&Number(style.fontWeight)>=700?3:4.5;
  if(contrast+.02<minimum)finding.lowContrast.push({text,contrast:Number(contrast.toFixed(2)),minimum});
 }
 return finding;
}
module.exports={visualLint};
