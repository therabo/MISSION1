/* Reproducible declaration ledger. Classifications are the audited sizing
 * policy, not a unit-replacement recipe. See architecture-audit.md for decisions.
 * node architecture-dimensions.cjs [OUTPUT_DIRECTORY] [BASELINE_SHA]
 */
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../../../..');
const postcss=require(path.join(root,'frontend/node_modules/postcss'));
const out=path.resolve(process.argv[2]||path.join(require('node:os').tmpdir(),'mission1-architecture-dimensions'));
const baseline=process.argv[3]||'e0780705580bf23c841f0a415ed56ce9601a52d0';
const files=['styles.css','components/InspectionStrip.css','components/ModuleInfo.css','crew/CurrentCrewWorkspace.css','crew/CrewAstronautDock.css','replay/HistoricalCalendar.css'].map(f=>'frontend/src/'+f);
const meaningful=/^(--(space-primary|context-height|operational-height|radius-.+|secondary-.+|calendar-action-face|crew-.+)|display|position|inset.*|top|right|bottom|left|width|height|min-.+|max-.+|margin.*|padding.*|gap|row-gap|column-gap|font|font-size|line-height|letter-spacing|border|border-(width|radius|left|right|top|bottom)|outline|outline-offset|grid-.+|flex.*|align-.+|justify-.+|overflow.*|overscroll-behavior|white-space|word-break|overflow-wrap|text-overflow|transform|clip.*|object-fit|container)$/;
function family(s){
  for(const [re,label] of [[/astronaut/,'Astronaut detail'],[/crew-roster|crew-assessment/,'Crew roster'],[/crew/,'Crew workspace/shared helpers'],[/calendar/,'Historical Calendar'],[/historical/,'Historical bar'],[/module/,'Module detail'],[/inspection/,'Inspection'],[/context-(source)|source-select/,'Source selector'],[/context-(date|temporal)/,'UTC/temporal navigation'],[/context-(spatial|identity|crew|divider)|top-context|top-brand|brand-wordmark/,'Navigation/brand'],[/summary|source-state|orbital-status/,'Operational/orbital summary'],[/legend|swatch/,'Legend'],[/scene-controls|secondary/,'Scene/shared controls'],[/context-dock/,'ContextDock'],[/context-button|control-icon/,'Button/icon primitives'],[/cesium-credit|cesium-viewer-bottom|widget-credits/,'Attribution'],[/replay/,'Replay compatibility'],[/data-line|time-card|panel-|notice|model-note|provenance/,'Evidence/shared text']])if(re.test(s))return label;
  return 'Shell/foundations/compatibility';
}
function verdict(prop,val,context,selector){
  if(/^(overflow|white-space|word-break|text-overflow|object-fit|overscroll)/.test(prop))return ['CONTENT_DRIVEN','Wrap or scroll at the owning surface; preserve readable content.'];
  if(prop==='position'&&/static|relative/.test(val))return ['CONTENT_DRIVEN','Normal grid/flex/flow item; relative positioning establishes the local decoration/overlay containing box.'];
  if(/^(top|right|bottom|left)$/.test(prop)&&val==='auto')return ['CONTENT_DRIVEN','Placement follows normal layout rather than a coordinate.'];
  if(/^(top|right|bottom|left|transform)$/.test(prop)&&val.includes('%'))return ['CONTAINER_RELATIVE','Center or offset relative to the containing box, or the transformed element itself.'];
  if(prop==='position'||/^(top|right|bottom|left|inset|transform|clip)/.test(prop))return ['INTENTIONAL_FIXED','Scene/modal overlay, local decoration, optical alignment, motion or accessibility clipping; see component positioning rationale.'];
  if(/grid|flex|align|justify|display|container/.test(prop))return ['CONTAINER_RELATIVE','Structural distribution or intrinsic flow within the parent; zero minima permit shrink.'];
  if(/\b(auto|contents|fit-content|max-content|min-content)\b/.test(val))return ['CONTENT_DRIVEN','Intrinsic content/track sizing; explicit bounds, when present, constrain growth.'];
  if(/\d(?:\.\d+)?(?:dvh|svh|lvh|vh|vw)\b/.test(val))return ['VIEWPORT_RELATIVE','Scene-level or body-portal bound; compatibility viewport rules remain isolated.'];
  if(/\d(?:\.\d+)?%/.test(val))return ['CONTAINER_RELATIVE','Fraction of the containing box (or local pseudo-face); color percentages are not layout.'];
  if(/min\(|max\(|clamp\(|minmax\(/.test(val))return ['FLUID','Explicit minimum/maximum bounds with available space or intrinsic content.'];
  if(/^(border|outline)|radius/.test(prop))return ['INTENTIONAL_FIXED','Hairline, focus ring or optical corner primitive; physical CSS pixels are deliberate.'];
  if(/font|line-height|letter-spacing/.test(prop))return [context.includes('@media')?'BREAKPOINT_VARIANT':'BOUNDED_FIXED','Accepted optical typography; em letter spacing follows glyph size. Browser zoom scales CSS pixels. Root scaling is measured separately.'];
  if(/^(min|max)-/.test(prop)||/--secondary|calendar-action-face|crew-row-min/.test(prop))return ['BOUNDED_FIXED','Density or interaction bound; content may grow, controls retain an optical face/usable target.'];
  if(context.includes('@media'))return ['BREAKPOINT_VARIANT','Deliberate presentation/density or height/interaction variant; threshold rationale is documented.'];
  return ['BOUNDED_FIXED','Accepted gutter, control/portrait/track bound or reusable spacing; no proportional scaling of interaction primitives.'];
}
function parse(css,file){
  const ast=postcss.parse(css,{from:file}), declarations=[],rules=[],thresholds=[];
  ast.walkRules(r=>rules.push({file,line:r.source.start.line,selector:r.selector}));
  ast.walkAtRules(r=>{if(['media','container'].includes(r.name))thresholds.push({file,line:r.source.start.line,type:r.name,query:r.params});});
  const occurrences=new Map();
  ast.walkDecls(d=>{
    if(!meaningful.test(d.prop))return;
    let n=d.parent,contexts=[];
    while(n&&n.type!=='root'){if(n.type==='atrule')contexts.unshift('@'+n.name+' '+n.params);n=n.parent;}
    const selector=d.parent.selector||':root';
    // Animation percentages describe progress, not parent-relative layout.
    if(contexts.some(c=>c.includes('keyframes')))return;
    const context=contexts.join(' / ')||'base',key=[file,context,selector,d.prop].join('|');
    const occurrence=occurrences.get(key)||0;occurrences.set(key,occurrence+1);
    const [classification,reason]=verdict(d.prop,d.value,context,selector);
    declarations.push({key:key+'|'+occurrence,file,line:d.source.start.line,component:family(selector),selector,context,property:d.prop,value:d.value,classification,reason});
  });return {declarations,rules,thresholds};
}
const before=files.map(file=>parse(cp.execFileSync('git',['show',baseline+':'+file],{cwd:root,encoding:'utf8'}),file));
const after=files.map(file=>parse(fs.readFileSync(path.join(root,file),'utf8'),file));
const old=new Map(before.flatMap(f=>f.declarations).map(d=>[d.key,d]));
const current=new Map(after.flatMap(f=>f.declarations).map(d=>[d.key,d]));
function replacedClassification(b,a){
  if(/crew-row-count/.test(b.value))return 'REDUNDANT_PATCH';
  if(/crew-roster-current-layout/.test(b.selector)&&b.value.includes('360px'))return 'ACCIDENTAL_HARDCODE';
  if(!a&&b.property==='height'&&/operational-summary|summary-|source-state|inspection-|module-dock/.test(b.selector))return 'ACCIDENTAL_HARDCODE';
  if(!a&&b.property==='width'&&/module-dock.*context-dock-identity/.test(b.selector))return 'ACCIDENTAL_HARDCODE';
  if(!a&&/context-source-value|context-source.*select-chevron/.test(b.selector)&&/^(position|top|transform)$/.test(b.property))return 'ACCIDENTAL_HARDCODE';
  if(!a&&b.selector==='.top-brand')return 'ACCIDENTAL_HARDCODE';
  return !a?'REDUNDANT_PATCH':b.classification;
}
const ledger=[...new Set([...old.keys(),...current.keys()])].map(key=>{
  const b=old.get(key),a=current.get(key),d=a||b;
  let classification=d.classification,reason=d.reason;
  if(!a){classification=replacedClassification(b,a);reason='Removed/replaced: see explicit before/final unit decision table. Compatibility-only rules are not mechanically deleted.';}
  return {component:d.component,file:d.file,beforeLine:b?.line||'',finalLine:a?.line||'',selector:d.selector,context:d.context,property:d.property,before:b?.value||'—',beforeClassification:b?replacedClassification(b,a):'—',classification,final:a?.value||'REMOVED',reason};
});
function counts(data){const ds=data.flatMap(f=>f.declarations);const unit={};for(const u of ['px','rem','em','lh','%','vw','vh','dvh','svh','lvh','fr']){
  const re=u==='%'?/\d+(?:\.\d+)?%/g:new RegExp('[-+]?(?:\\d*\\.)?\\d+'+u+'\\b','g');unit[u]=ds.reduce((n,d)=>n+(d.value.match(re)||[]).length,0);
}return {rules:data.reduce((n,f)=>n+f.rules.length,0),declarations:ds.length,unitTokens:unit,
  functions:Object.fromEntries(['min','max','clamp','minmax'].map(k=>[k,ds.reduce((n,d)=>n+(d.value.match(new RegExp('(?<![\\w-])'+k+'\\(','g'))||[]).length,0)])),
  absolute:ds.filter(d=>d.property==='position'&&d.value==='absolute').length,fixed:ds.filter(d=>d.property==='position'&&d.value==='fixed').length,
  thresholds:data.flatMap(f=>f.thresholds),classifications:ds.reduce((a,d)=>(a[d.classification]=(a[d.classification]||0)+1,a),{})};}
fs.mkdirSync(out,{recursive:true});
const quote=v=>'"'+String(v).replaceAll('"','""')+'"';
const fields=Object.keys(ledger[0]);fs.writeFileSync(path.join(out,'dimension-decisions.csv'),fields.join(',')+'\n'+ledger.map(d=>fields.map(k=>quote(d[k])).join(',')).join('\n')+'\n');
fs.writeFileSync(path.join(out,'dimension-summary.json'),JSON.stringify({baseline,files,method:'PostCSS: layout/typography declarations, excluding colors and animation keyframe percentages; includes shared and compatibility styles.',before:counts(before),final:counts(after),ledgerRows:ledger.length},null,2)+'\n');
console.log(JSON.stringify({before:counts(before).declarations,final:counts(after).declarations,ledgerRows:ledger.length,units:counts(after).unitTokens}));
