// QA-only native surface search, using the accepted module-center inventory.
function scan({mapping,node,any=false,unmapped=false}){
 __scan=true;try{const v=__v,c=v.camera,r=v.canvas.getBoundingClientRect(),mat=__model.modelMatrix;
 let sx=r.width/2,sy=r.height/2;
 if(node){const local=[node.center[2],node.center[0],node.center[1]],a={x:mat[0]*local[0]+mat[4]*local[1]+mat[8]*local[2]+mat[12],y:mat[1]*local[0]+mat[5]*local[1]+mat[9]*local[2]+mat[13],z:mat[2]*local[0]+mat[6]*local[1]+mat[10]*local[2]+mat[14]},p={x:a.x-c.positionWC.x,y:a.y-c.positionWC.y,z:a.z-c.positionWC.z},dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z,z=dot(p,c.directionWC);
 if(z<=0)return null;sx=r.width*(1-c.frustum.projectionMatrix[8])/2+dot(p,c.rightWC)/z*r.width/(2*Math.tan(c.frustum.fovy/2)*c.frustum.aspectRatio);sy=r.height*(1+c.frustum.projectionMatrix[9])/2-dot(p,c.upWC)/z*r.height/(2*Math.tan(c.frustum.fovy/2));}
 const offsets=node?[0,-3,3,-7,7,-12,12,-18,18]:Array.from({length:80},(_,i)=>(i-40)*8);
 for(const dx of offsets)for(const dy of offsets){const x=sx+dx,y=sy+dy;if(x<0||x>r.width||y<70||y>r.height-60||document.elementFromPoint(x,y)!==v.canvas)continue;const h=v.scene.pick({x,y});
 if(unmapped?h?.primitive===__model&&h.featureId===undefined:any?typeof h?.featureId==='number':h?.featureId===mapping.featureId&&h.getProperty('moduleCode')===mapping.moduleCode)return {x,y,featureId:h.featureId??null};}
 return null;}finally{__scan=false;}
}

module.exports={scan};
