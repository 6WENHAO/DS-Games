'use strict';
/* ================= models.js — declarative part-based model builder =================
   构建规则（符合建模三通道约束）：
   ① lathe/ext 零件：SVG 剖面路径 → LatheGeometry / ExtrudeGeometry
   ② 其余零件：声明式 JSON（位置/尺寸/旋转/材质），位置与尺寸吸附 0.05 栅格
   ③ 程序化铺设在 galaxy.js（地形/植被/散布）
   强制左右对称：p[0]!==0 的零件自动生成 X 镜像（nomir 显式豁免）。
   part 字段: t 类型 | p 位置 | s 尺寸 | r 旋转(度) | m 材质 | g 动态组 | seg 段数
              path 剖面 | depth/bevel 挤出 | e 椭球缩放 | ang 球角度 | arc 弧度(度)
              uvs uv重复 | nomir 不镜像 | n 名称 */

function _geoFor(part,sn){
  const s=part.s||[1,1,1];
  let g=null;
  switch(part.t){
    case 'box': g=new THREE.BoxGeometry(sn(s[0]),sn(s[1]),sn(s[2]));break;
    case 'cyl': g=new THREE.CylinderGeometry(sn(s[0]),sn(s[1]!==undefined?s[1]:s[0]),sn(s[2]!==undefined?s[2]:1),part.seg||16,1,!!part.open);break;
    case 'cone': g=new THREE.ConeGeometry(sn(s[0]),sn(s[1]),part.seg||16,1,!!part.open);break;
    case 'sph': {
      const seg=part.seg||18;const a=part.ang;
      g=new THREE.SphereGeometry(sn(s[0]),seg,Math.max(3,(seg/2)|0),
        a?(a[0]||0)*DEG:0, a?(a[1]!==undefined?a[1]:360)*DEG:Math.PI*2,
        a?(a[2]||0)*DEG:0, a?(a[3]!==undefined?a[3]:180)*DEG:Math.PI);
      if(part.e)g.scale(part.e[0],part.e[1],part.e[2]);
      break;}
    case 'torus': g=new THREE.TorusGeometry(s[0],s[1],part.seg2||8,part.seg||20,(part.arc||360)*DEG);break;
    case 'lathe': g=new THREE.LatheGeometry(pathToLathePts(part.path,part.cs||8),part.seg||20,0,(part.arc||360)*DEG);break;
    case 'ext': {
      const d=part.depth||0.1;
      g=new THREE.ExtrudeGeometry(pathToShape(part.path),{
        depth:d,bevelEnabled:!!part.bevel,
        bevelThickness:part.bevel?part.bevel[0]:0,bevelSize:part.bevel?part.bevel[1]:0,
        bevelSegments:2,curveSegments:part.cs||10,steps:1});
      g.translate(0,0,-d/2);
      break;}
    case 'plane': g=new THREE.PlaneGeometry(s[0],s[1]);break;
  }
  if(g&&part.uvs&&g.attributes.uv){
    const u=g.attributes.uv;
    for(let i=0;i<u.count;i++){u.setXY(i,u.getX(i)*part.uvs[0],u.getY(i)*part.uvs[1])}
  }
  return g;
}

function buildModel(def){
  const grid=def.grid||0.05;
  const sn=v=>Math.round(v/grid)*grid;
  const mirrorM=new THREE.Matrix4().makeScale(-1,1,1);
  const staticBk={};            // matKey -> [{geo,mtx}]
  const grpBk={};               // grpName -> {pivot:[..], bk:{matKey:[..]}}
  const boxes=[];let triCount=0;

  const pivots=def.pivots||{};
  for(const k in pivots){const pv=pivots[k];grpBk[k]={pivot:pv.p||pv,bk:{}};
    if(pv.mir)grpBk[pv.mir]={pivot:[-(pv.p||pv)[0],(pv.p||pv)[1],(pv.p||pv)[2]],bk:{},mirrorOf:k}}

  function addTo(bk,mk,geo,mtx,part,worldShift){
    (bk[mk]=bk[mk]||[]).push({geo,mtx});
    geo.computeBoundingBox();
    const b=geo.boundingBox.clone().applyMatrix4(mtx);
    if(worldShift)b.translate(new THREE.Vector3(worldShift[0],worldShift[1],worldShift[2]));
    boxes.push({n:part.n||part.t,m:mk,box:b,sink:!!part.sink});
    const pa=geo.attributes.position;triCount+=(geo.index?geo.index.count:pa.count)/3;
  }

  for(const part of def.parts){
    const geo=_geoFor(part,sn);if(!geo)continue;
    const p=(part.p||[0,0,0]).map(sn);
    const mtx=composeMtx(p,part.r||[0,0,0],part.sc||[1,1,1]);
    const mk=part.m||'chassis';
    if(part.g){
      const gb=grpBk[part.g];
      if(!gb){console.warn('no pivot for group '+part.g);continue}
      addTo(gb.bk,mk,geo,mtx,part,gb.pivot);
      const twinName=Object.keys(grpBk).find(k=>grpBk[k].mirrorOf===part.g);
      if(twinName){
        const m2=mirrorM.clone().multiply(mtx);
        addTo(grpBk[twinName].bk,mk,geo,m2,part,grpBk[twinName].pivot);
      }
    }else{
      addTo(staticBk,mk,geo,mtx,part);
      if(Math.abs(p[0])>1e-6&&!part.nomir){
        const m2=mirrorM.clone().multiply(mtx);
        addTo(staticBk,mk,geo,m2,part);
      }
    }
  }

  const root=new THREE.Group();root.name=def.name||'model';
  function emit(bk,parent){
    for(const mk in bk){
      const mesh=new THREE.Mesh(mergeGeoms(bk[mk]),M[mk]||M.chassis);
      mesh.castShadow=!def.noShadow;mesh.receiveShadow=!def.noShadow;
      mesh.name=mk;parent.add(mesh);
    }
  }
  emit(staticBk,root);
  const groups={};
  for(const k in grpBk){
    const g=new THREE.Group();g.name=k;
    const pv=grpBk[k].pivot;g.position.set(pv[0],pv[1],pv[2]);
    emit(grpBk[k].bk,g);root.add(g);groups[k]=g;
  }
  const bb=new THREE.Box3();for(const b of boxes)bb.union(b.box);
  root.userData={boxes,tris:triCount|0,partCount:def.parts.length,bounds:bb,groups,name:def.name};
  return root;
}

/* 穿模自检：深度嵌入(>=阈值比例)且非同材质组的零件对 */
function overlapReport(model,thresh){
  thresh=thresh||0.72;
  const bx=model.userData.boxes,out=[];
  const sz=new THREE.Vector3();
  for(let i=0;i<bx.length;i++)for(let j=i+1;j<bx.length;j++){
    const a=bx[i],b=bx[j];
    if(a.m===b.m)continue;
    if(a.sink||b.sink)continue;
    if(!a.box.intersectsBox(b.box))continue;
    const inter=a.box.clone().intersect(b.box);inter.getSize(sz);
    const vi=sz.x*sz.y*sz.z;
    const va=a.box.clone();va.getSize(sz);const v1=sz.x*sz.y*sz.z;
    const vb=b.box.clone();vb.getSize(sz);const v2=sz.x*sz.y*sz.z;
    const ratio=vi/Math.max(1e-9,Math.min(v1,v2));
    if(ratio>thresh)out.push({a:a.n+'('+a.m+')',b:b.n+'('+b.m+')',r:ratio});
  }
  out.sort((x,y)=>y.r-x.r);
  return out;
}
