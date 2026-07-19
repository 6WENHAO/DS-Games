'use strict';
// ===================== 静态世界合批 (性能基建) =====================
// 把大量小型静态 Mesh 按 [材质 × 空间分块 × 阴影标志 × renderOrder] 合并成大网格:
// - drawcall 大幅下降(墙体/石墙/树木/箱子/弹坑等全部合并)
// - 按 44m 分块保留视锥剔除能力
// - 可摧毁墙体/屋顶/旗帜/机枪等动态物体保持独立
// - 在首帧渲染前执行, 原几何从未上传 GPU, 无泄漏
const MERGE_STATS={before:0,after:0,groups:0,merged:0};
function mergeStaticWorld(){
const CHUNK=44;
const skip=new Set();
for(const g of DESTRUCTIBLES){
for(const m of g.meshes) skip.add(m);
if(g.roofRef){ const rms=Array.isArray(g.roofRef.m)?g.roofRef.m:[g.roofRef.m]; rms.forEach(m=>skip.add(m)); }
}
if(typeof FLAGS!=='undefined') for(const f of FLAGS){ if(f.flagMesh) skip.add(f.flagMesh); }
const groups=new Map();
for(const c of world.children){
if(!c.isMesh||c.isInstancedMesh) continue;
if(skip.has(c)) continue;
if(c.userData&&c.userData.noMerge) continue;
const g=c.geometry;
if(!g||!g.isBufferGeometry||!g.attributes.position) continue;
if(g.attributes.color||c.morphTargetInfluences) continue;
const ci=Math.floor((c.position.x+MAP_SIZE)/CHUNK), cj=Math.floor((c.position.z+MAP_SIZE)/CHUNK);
const key=c.material.uuid+'|'+ci+'|'+cj+'|'+(c.castShadow?1:0)+(c.receiveShadow?1:0)+'|'+(c.renderOrder||0);
let arr=groups.get(key); if(!arr){ arr=[]; groups.set(key,arr); }
arr.push(c);
}
MERGE_STATS.before=world.children.length;
let mergedTotal=0;
for(const [key,list] of groups){
if(list.length<2) continue;
let vtx=0; let allUV=true;
const parts=list.map(m=>{
m.updateWorldMatrix(true,false);
let g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();
g.applyMatrix4(m.matrixWorld);
if(!g.attributes.uv) allUV=false;
vtx+=g.attributes.position.count;
return g;
});
const pos=new Float32Array(vtx*3);
const nor=new Float32Array(vtx*3);
const uv=allUV?new Float32Array(vtx*2):null;
let o3=0,o2=0;
for(const g of parts){
pos.set(g.attributes.position.array,o3);
if(g.attributes.normal) nor.set(g.attributes.normal.array,o3);
if(uv&&g.attributes.uv) uv.set(g.attributes.uv.array,o2);
o3+=g.attributes.position.count*3;
o2+=g.attributes.position.count*2;
}
const mg=new THREE.BufferGeometry();
mg.setAttribute('position',new THREE.BufferAttribute(pos,3));
mg.setAttribute('normal',new THREE.BufferAttribute(nor,3));
if(uv) mg.setAttribute('uv',new THREE.BufferAttribute(uv,2));
mg.computeBoundingSphere();
const src=list[0];
const mm=new THREE.Mesh(mg,src.material);
mm.castShadow=src.castShadow; mm.receiveShadow=src.receiveShadow;
mm.renderOrder=src.renderOrder||0;
mm.matrixAutoUpdate=false;
mm.updateMatrix();
mm.userData.mergedChunk=true;
world.add(mm);
for(const m of list) world.remove(m);
mergedTotal+=list.length;
}
MERGE_STATS.after=world.children.length;
MERGE_STATS.groups=groups.size;
MERGE_STATS.merged=mergedTotal;
}
