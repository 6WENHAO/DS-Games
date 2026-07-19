'use strict';
/* ================= planets.js — 星球LOD渲染/地表补丁/散布/殖民地/天空 ================= */

const ORIGIN={x:0,y:0,z:0};
function W2R(x,y,z,t){t.set(x-ORIGIN.x,y-ORIGIN.y,z-ORIGIN.z);return t}

const Planets={
  near:{},order:[],current:null,city:null,cityPid:-1,
  patch:null,patchAnchor:new THREE.Vector3(),patchTier:-1,
  scatterSets:[],scatterAnchor:new THREE.Vector3(),
  mineables:[],sunDir:new THREE.Vector3(0,1,0),skyCol:new THREE.Color(0x000000),
  atmoFactor:0,nightFactor:0,timeOfDay:0,timeScale:1,
};

/* ---------- 初始化：背景星野 / 星系点 / 行星点 ---------- */
Planets.init=function(scene){
  this.scene=scene;
  const rng=mulberry32(42);
  { const n=2600,pos=new Float32Array(n*3),col=new Float32Array(n*3);
    for(let i=0;i<n;i++){
      const v=new THREE.Vector3(rng()-0.5,rng()-0.5,rng()-0.5).normalize().multiplyScalar(380000);
      pos.set([v.x,v.y,v.z],i*3);
      const c=new THREE.Color().setHSL(0.55+rng()*0.15-(rng()<0.2?0.45:0),0.5,0.55+rng()*0.4);
      col.set([c.r,c.g,c.b],i*3);
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.BufferAttribute(pos,3));
    g.setAttribute('color',new THREE.BufferAttribute(col,3));
    this.bgStars=new THREE.Points(g,new THREE.PointsMaterial({size:900,sizeAttenuation:true,vertexColors:true,map:Tex.star(),transparent:true,opacity:0.9,depthWrite:false,fog:false}));
    this.bgStars.frustumCulled=false;scene.add(this.bgStars);
    this.nebGroup=new THREE.Group();
    const nebCols=[['#4a2a8a','#2a4a8a'],['#8a2a5a','#4a2a8a'],['#2a6a8a','#2a8a5a']];
    for(let i=0;i<7;i++){
      const c=nebCols[i%3];
      const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:Tex.nebula('N'+(i%3),c[0],c[1],60+i),transparent:true,opacity:0.5,depthWrite:false,fog:false,blending:THREE.AdditiveBlending}));
      const v=new THREE.Vector3(rng()-0.5,(rng()-0.5)*0.4,rng()-0.5).normalize().multiplyScalar(360000);
      sp.position.copy(v);sp.scale.setScalar(120000+rng()*160000);
      this.nebGroup.add(sp);
    }
    scene.add(this.nebGroup);
  }
  { const ns=GALAXY.systems.length;
    const pos=new Float32Array(ns*3),col=new Float32Array(ns*3),siz=new Float32Array(ns);
    GALAXY.systems.forEach((s,i)=>{const c=new THREE.Color(s.color);col.set([c.r,c.g,c.b],i*3);siz[i]=s.size});
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.BufferAttribute(pos,3));
    g.setAttribute('color',new THREE.BufferAttribute(col,3));
    g.setAttribute('psize',new THREE.BufferAttribute(siz,1));
    this.starPts=new THREE.Points(g,this._ptMat(Tex.star(),34000));
    this.starPts.frustumCulled=false;scene.add(this.starPts);
    const np=GALAXY.planets.length;
    const pos2=new Float32Array(np*3),col2=new Float32Array(np*3),siz2=new Float32Array(np);
    GALAXY.planets.forEach((p,i)=>{const c=new THREE.Color(p.td.cols[1]);c.offsetHSL(p.hue,0.05,0.02);col2.set([c.r,c.g,c.b],i*3);siz2[i]=p.radius*2.2});
    const g2=new THREE.BufferGeometry();
    g2.setAttribute('position',new THREE.BufferAttribute(pos2,3));
    g2.setAttribute('color',new THREE.BufferAttribute(col2,3));
    g2.setAttribute('psize',new THREE.BufferAttribute(siz2,1));
    this.planetPts=new THREE.Points(g2,this._ptMat(Tex.glow('P','#ffffff'),9000));
    this.planetPts.frustumCulled=false;scene.add(this.planetPts);
  }
  this.sunLight=new THREE.DirectionalLight(0xffffff,1.2);
  this.sunLight.castShadow=true;
  const sc=this.sunLight.shadow;
  sc.mapSize.set(2048,2048);sc.camera.near=1;sc.camera.far=900;
  sc.camera.left=sc.camera.bottom=-120;sc.camera.right=sc.camera.top=120;sc.bias=-0.0006;
  scene.add(this.sunLight);scene.add(this.sunLight.target);
  this.hemi=new THREE.HemisphereLight(0xbfd8ee,0x4a4238,0.5);scene.add(this.hemi);
  this.sunSprite=new THREE.Sprite(new THREE.SpriteMaterial({map:Tex.glow('SUN','#fff2c8'),transparent:true,opacity:1,depthWrite:false,fog:false,blending:THREE.AdditiveBlending}));
  this.sunSprite.scale.setScalar(30000);scene.add(this.sunSprite);
  this.updateFarPoints();
};
Planets._ptMat=function(tex,base){
  return new THREE.ShaderMaterial({
    uniforms:{tex:{value:tex},base:{value:base}},
    vertexShader:`attribute float psize;attribute vec3 color;varying vec3 vC;uniform float base;
      void main(){vC=color;vec4 mv=modelViewMatrix*vec4(position,1.0);
      gl_PointSize=clamp(base*psize/max(1.0,-mv.z),1.5,64.0);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform sampler2D tex;varying vec3 vC;
      void main(){vec4 t=texture2D(tex,gl_PointCoord);gl_FragColor=vec4(vC,1.0)*t;if(gl_FragColor.a<0.02)discard;}`,
    transparent:true,depthWrite:false,fog:false,blending:THREE.AdditiveBlending});
};
Planets.updateFarPoints=function(){
  const sp=this.starPts.geometry.attributes.position;
  GALAXY.systems.forEach((s,i)=>{sp.setXYZ(i,s.x-ORIGIN.x,s.y-ORIGIN.y,s.z-ORIGIN.z)});
  sp.needsUpdate=true;
  const pp=this.planetPts.geometry.attributes.position;
  GALAXY.planets.forEach((p,i)=>{pp.setXYZ(i,p.x-ORIGIN.x,p.y-ORIGIN.y,p.z-ORIGIN.z)});
  pp.needsUpdate=true;
};

/* ---------- 星球网格生成（顶点着色 + 位移） ---------- */
function planetPalette(pl){
  if(pl._pal)return pl._pal;
  const cs=pl.td.cols.map(c=>{const cc=new THREE.Color(c);cc.offsetHSL(pl.hue,0,0);return cc});
  pl._pal=cs;return cs;
}
function vertColor(pl,dir,h,out){
  const cs=planetPalette(pl);const td=pl.td;
  const sea=td.sea?td.sea.h:0;
  const t=clamp((h-sea)/(td.amp+td.ridge*0.6),0,1);
  const lat=Math.abs(dir.y);
  let c0,c1,f;
  if(t<0.25){c0=cs[0];c1=cs[1];f=t/0.25}
  else if(t<0.6){c0=cs[1];c1=cs[2];f=(t-0.25)/0.35}
  else{c0=cs[2];c1=cs[3];f=(t-0.6)/0.4}
  out.copy(c0).lerp(c1,clamp(f,0,1));
  if(lat>0.62&&pl.type!=='gas')out.lerp(cs[3],smoothstep(0.62,0.85,lat));
  const n=vnoise3(dir.x*23,dir.y*23,dir.z*23,pl.seed^11);
  out.multiplyScalar(0.88+n*0.24);
  /* 高频细节斑驳，近地面观感更丰富 */
  const n2=vnoise3(dir.x*210,dir.y*210,dir.z*210,pl.seed^0x5F);
  out.multiplyScalar(0.93+n2*0.14);
  return out;
}
function buildPlanetGeo(pl,sub){
  const g=new THREE.IcosahedronGeometry(pl.radius,sub);
  const pos=g.attributes.position;
  const col=new Float32Array(pos.count*3);
  const d=new THREE.Vector3(),c=new THREE.Color();
  for(let i=0;i<pos.count;i++){
    d.set(pos.getX(i),pos.getY(i),pos.getZ(i)).normalize();
    const h=terrainH(pl,d.x,d.y,d.z);
    pos.setXYZ(i,d.x*(pl.radius+h),d.y*(pl.radius+h),d.z*(pl.radius+h));
    vertColor(pl,d,h,c);col.set([c.r,c.g,c.b],i*3);
  }
  g.setAttribute('color',new THREE.BufferAttribute(col,3));
  g.computeVertexNormals();
  return g;
}
Planets.ensureNear=function(pl,sub){
  let e=this.near[pl.id];
  if(e&&e.sub>=sub)return e;
  if(e)this.disposeNear(pl.id);
  const group=new THREE.Group();
  /* SVG 星球贴图：Icosahedron 自带带接缝修正的球面UV，灰度细节乘在顶点色调色板上 */
  const ptex=Tex.planet(pl);
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.95,metalness:0,
    map:ptex,bumpMap:ptex,bumpScale:pl.type==='gas'?0:7,
    polygonOffset:true,polygonOffsetFactor:3,polygonOffsetUnits:3});
  const mesh=new THREE.Mesh(buildPlanetGeo(pl,sub),mat);
  mesh.receiveShadow=false;group.add(mesh);
  if(pl.td.sea){
    const og=new THREE.IcosahedronGeometry(pl.radius+pl.td.sea.h,Math.min(sub,4));
    const om=pl.td.sea.emis?
      new THREE.MeshStandardMaterial({color:pl.td.sea.c,emissive:pl.td.sea.c,emissiveIntensity:0.9,roughness:0.4}):
      new THREE.MeshStandardMaterial({color:pl.td.sea.c,transparent:true,opacity:0.86,roughness:0.15,metalness:0.4,bumpMap:Tex.waterBump(),bumpScale:2.5});
    e=new THREE.Mesh(og,om);group.add(e);
  }
  const spr=new THREE.Sprite(new THREE.SpriteMaterial({map:Tex.glow('atm'+pl.type,pl.td.sky[0]),transparent:true,opacity:0.5,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));
  spr.scale.setScalar(pl.radius*3.1);group.add(spr);
  if(pl.rings){
    const rg=new THREE.RingGeometry(pl.radius*1.5,pl.radius*2.4,48,1);
    const rm=new THREE.MeshBasicMaterial({map:Tex.ring('R','#c8b8a0'),transparent:true,opacity:0.8,side:THREE.DoubleSide,depthWrite:false});
    const rmesh=new THREE.Mesh(rg,rm);
    const rr=mulberry32(pl.seed^5);
    rmesh.rotation.set(Math.PI/2+(rr()-0.5)*0.7,0,(rr()-0.5)*0.6);
    group.add(rmesh);
  }
  if(['temperate','ocean','forest','gas','toxic'].includes(pl.type)){
    const cg=new THREE.IcosahedronGeometry(pl.radius*1.035,3);
    const cm=new THREE.MeshStandardMaterial({color:0xffffff,alphaMap:Tex.canopy('cl'+(pl.seed%4),'#000000','#ffffff',pl.seed%97),transparent:true,opacity:pl.type==='gas'?0.75:0.45,depthWrite:false,roughness:1});
    const cl=new THREE.Mesh(cg,cm);cl.userData.spin=0.004+((pl.seed%7)*0.001);group.add(cl);
    group.userData.clouds=cl;
  }
  this.scene.add(group);
  const entry={group,sub,pl,t:performance.now()};
  this.near[pl.id]=entry;this.order.push(pl.id);
  { const sa=this.planetPts.geometry.attributes.psize;
    if(pl._ptSize===undefined)pl._ptSize=sa.getX(pl.id);
    sa.setX(pl.id,0);sa.needsUpdate=true; }
  if(this.order.length>10){
    let oldest=null,oi=-1;
    for(let i=0;i<this.order.length;i++){
      const id=this.order[i];
      if(id===(this.current&&this.current.id))continue;
      const en=this.near[id];
      if(en&&(!oldest||en.t<oldest.t)){oldest=en;oi=i}
    }
    if(oi>=0){this.disposeNear(this.order[oi]);this.order.splice(oi,1)}
  }
  return entry;
};
Planets.disposeNear=function(id){
  const e=this.near[id];if(!e)return;
  e.group.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material&&!o.material._shared)o.material.dispose()});
  this.scene.remove(e.group);delete this.near[id];
  const pl=GALAXY.planets[id];
  if(pl&&pl._ptSize!==undefined){
    const sa=this.planetPts.geometry.attributes.psize;
    sa.setX(id,pl._ptSize);sa.needsUpdate=true;
  }
  const i=this.order.indexOf(id);if(i>=0)this.order.splice(i,1);
};

/* ---------- 主更新 ---------- */
const _pv=new THREE.Vector3(),_pu=new THREE.Vector3(),_pd=new THREE.Vector3();
Planets.getNearest=function(px,py,pz){
  let best=null,bd=1e18;
  for(const pl of GALAXY.planets){
    const dx=pl.x-px,dy=pl.y-py,dz=pl.z-pz;
    const d=Math.sqrt(dx*dx+dy*dy+dz*dz)-pl.radius;
    if(d<bd){bd=d;best=pl}
  }
  return {pl:best,alt:bd};
};
Planets.nearestStar=function(px,py,pz){
  let best=null,bd=1e18;
  for(const s of GALAXY.systems){
    const dx=s.x-px,dy=s.y-py,dz=s.z-pz;
    const d=dx*dx+dy*dy+dz*dz;
    if(d<bd){bd=d;best=s}
  }
  return best;
};
Planets.update=function(dt,pos,camera){
  this.timeOfDay+=dt*this.timeScale;
  /* 近星球网格管理 */
  const {pl,alt}=this.getNearest(pos.x,pos.y,pos.z);
  this.current=(alt<pl.radius*14)?pl:null;
  this.curAlt=alt;
  for(const p of GALAXY.planets){
    const dx=p.x-pos.x,dy=p.y-pos.y,dz=p.z-pos.z;
    const dist=Math.sqrt(dx*dx+dy*dy+dz*dz);
    if(dist<p.radius+80000){
      const sub=dist<p.radius*3?5:dist<p.radius*10?4:3;
      const e=this.ensureNear(p,sub);e.t=performance.now();
      W2R(p.x,p.y,p.z,e.group.position);
      if(e.group.userData.clouds)e.group.userData.clouds.rotation.y+=e.group.userData.clouds.userData.spin*dt;
    }else if(this.near[p.id]&&dist>p.radius+100000){
      this.disposeNear(p.id);
    }
  }
  /* 太阳方向 + 昼夜 */
  const star=this.nearestStar(pos.x,pos.y,pos.z);
  this.curStar=star;
  W2R(star.x,star.y,star.z,this.sunSprite.position);
  const sc=new THREE.Color(star.color);
  this.sunSprite.material.color=sc;
  let sunDir=_pv.set(star.x-pos.x,star.y-pos.y,star.z-pos.z).normalize();
  let elev=1;
  if(this.current&&this.curAlt<this.current.atmo*3){
    const p=this.current;
    _pu.set(pos.x-p.x,pos.y-p.y,pos.z-p.z).normalize();
    const ang=this.timeOfDay*Math.PI*2/p.dayLen+p.phase;
    const axis=_pd.set(Math.sin(p.seed%10),1,Math.cos(p.seed%7)).normalize();
    sunDir=sunDir.clone().applyAxisAngle(axis,ang);
    elev=sunDir.dot(_pu);
  }
  this.sunDir.copy(sunDir);
  this.sunLight.position.copy(sunDir).multiplyScalar(600);
  this.sunLight.target.position.set(0,0,0);
  if(camera){
    this.sunLight.position.add(camera.position);
    this.sunLight.target.position.copy(camera.position);
  }
  /* 大气因子 / 天空色 / 雾 */
  const p=this.current;
  let atmoF=0;
  if(p&&p.type!=='none'){atmoF=1-smoothstep(p.atmo*0.35,p.atmo*2.2,this.curAlt)}
  this.atmoFactor=atmoF;
  const dayC=new THREE.Color(p?p.td.sky[0]:'#000000');
  const duskC=new THREE.Color(p?p.td.sky[1]:'#000000');
  const nightC=new THREE.Color(p?p.td.sky[2]:'#000005');
  let sky=new THREE.Color(0x000000);
  if(p){
    const e2=clamp(elev,-1,1);
    if(e2>0.18)sky.copy(dayC);
    else if(e2>-0.08)sky.copy(duskC).lerp(dayC,smoothstep(-0.08,0.18,e2));
    else sky.copy(nightC).lerp(duskC,smoothstep(-0.35,-0.08,e2));
    sky.lerp(new THREE.Color(0x000000),1-atmoF);
  }
  this.skyCol.copy(sky);
  this.nightFactor=p?(1-smoothstep(-0.12,0.15,elev))*atmoF:0;
  const dayF=clamp(elev,0,1);
  this.sunLight.intensity=p&&atmoF>0.5?lerp(1.25,0.02+dayF*1.25,atmoF):1.25;
  if(p&&atmoF>0.02)this.sunLight.intensity=lerp(1.25,Math.max(0.02,dayF*1.3),atmoF);
  this.sunLight.color.copy(sc).lerp(new THREE.Color(0xff8a4a),p?(1-clamp(elev*3,0,1))*atmoF*0.8:0);
  this.hemi.intensity=0.14+atmoF*dayF*0.5;
  this.hemi.color.copy(sky).lerp(new THREE.Color(0xffffff),0.4);
  this.hemi.groundColor=p?new THREE.Color(p.td.cols[1]):new THREE.Color(0x202020);
  const fogD=p?p.td.fog*atmoF+1e-9:1e-9;
  this.scene.fog.color.copy(sky);
  this.scene.fog.density=fogD;
  this.bgStars.material.opacity=0.9*(1-atmoF*dayF);
  this.nebGroup.children.forEach(s=>s.material.opacity=0.5*(1-atmoF*dayF));
  if(camera){this.bgStars.position.copy(camera.position);this.nebGroup.position.copy(camera.position)}
  /* 灯光材质夜间开启 */
  const night=this.nightFactor;
  M.lampHead.emissiveIntensity=0.2+night*2.2;
  M.wallA.emissiveIntensity=night*1.5;M.wallB.emissiveIntensity=night*1.5;
  M.signNeon.emissiveIntensity=0.4+night*1.6;
  /* 地表补丁 + 散布 + 城市 */
  if(p&&this.curAlt<Math.max(2600,p.atmo*1.5)){
    this.updatePatch(p,pos);
    this.updateScatter(p,pos);
    this.updateCity(p,pos);
  }else if(this.patch){
    this.patch.visible=false;this.patchTier=-1;
    this.unsink();
    this.hideScatter();this.hideCity();
  }
  /* 浮动原点变化后的重定位（每帧廉价） */
  if(this.patch&&this.patch.visible&&this.patchWorldAnchor)
    W2R(this.patchWorldAnchor.x,this.patchWorldAnchor.y,this.patchWorldAnchor.z,this.patch.position);
  if(this.city&&this.city.visible&&this.cityAnchor)
    W2R(this.cityAnchor.x,this.cityAnchor.y,this.cityAnchor.z,this.city.position);
  this.positionScatter();
};

/* ---------- 地表补丁 ---------- */
const PATCH_N=96;
/* 非均匀网格映射：中心格 ~2.6m 精细、边缘渐粗，同样顶点数覆盖 1400m（近处细节+中距覆盖兼得） */
function patchWarp(u){
  const a=0.18,g=2.6;
  const t=Math.abs(u*2);
  return Math.sign(u)*(a*t+(1-a)*Math.pow(t,g))*0.5;
}
Planets.updatePatch=function(pl,pos){
  const alt=this.curAlt;
  /* 高速低飞时用粗档：精细档 45m 就要重建一次，340m/s 下会连环卡顿 */
  const fast=(Game.mode==='ship'||Game.mode==='landed')&&Ship.speed>70;
  const tier=(alt<420&&!fast)?0:1;
  const span=tier===0?1400:PATCH_N*30;
  _pd.set(pos.x-pl.x,pos.y-pl.y,pos.z-pl.z).normalize();
  const anchor=_pd.clone();
  const moved=this.patchAnchor.distanceTo(anchor)*pl.radius;
  const thresh=tier===0?45:span/7;
  if(this.patch&&this.patchPl===pl.id&&this.patchTier===tier&&moved<thresh){
    this.patch.visible=true;
    this.sinkNear(pl);/* 球体网格若因细分升级被重建，需要重新下沉 */
    return;
  }
  if(!this.patch){
    const g=new THREE.PlaneGeometry(1,1,PATCH_N,PATCH_N);
    /* 关键：翻转索引绕向。PlaneGeometry 的默认绕向按本网格 (east,north) 写入方式会让正面朝行星内部，
       正面剔除后补丁从上方完全不可见（"地面透明"的元凶——精细地面从未被渲染过） */
    {const idx=g.index.array;
     for(let k=0;k<idx.length;k+=3){const tmp=idx[k+1];idx[k+1]=idx[k+2];idx[k+2]=tmp;}}
    g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*3),3));
    this.patchMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.95,metalness:0});
    this.patch=new THREE.Mesh(g,this.patchMat);
    this.patch.receiveShadow=true;this.patch.castShadow=false;
    this.scene.add(this.patch);
  }
  this.patchPl=pl.id;this.patchTier=tier;this.patchAnchor.copy(anchor);
  this.patchMat.map=this.groundTex(pl);
  this.patchMat.map.repeat.set(span/11,span/11);
  /* 地面凹凸：同一张 SVG 地表贴图作 bumpMap，近地光照立体感 */
  this.patchMat.bumpMap=this.patchMat.map;
  this.patchMat.bumpScale=0.55;
  this.patchMat.needsUpdate=true;
  /* 切向基 */
  const up=anchor;
  const east=new THREE.Vector3(0,1,0).cross(up);
  if(east.lengthSq()<1e-6)east.set(1,0,0);east.normalize();
  const north=up.clone().cross(east).normalize();
  this.patchFrame={up:up.clone(),east:east.clone(),north:north.clone(),span};
  const g=this.patch.geometry,posA=g.attributes.position,colA=g.attributes.color,uvA=g.attributes.uv;
  const d=new THREE.Vector3(),c=new THREE.Color(),base=new THREE.Vector3();
  base.copy(up).multiplyScalar(pl.radius);
  const anchorWorld={x:pl.x+base.x,y:pl.y+base.y,z:pl.z+base.z};
  let i=0;
  for(let ry=0;ry<=PATCH_N;ry++)for(let rx=0;rx<=PATCH_N;rx++){
    const ux=rx/PATCH_N-0.5,uy=ry/PATCH_N-0.5;
    const ox=(tier===0?patchWarp(ux):ux)*span,oy=(tier===0?patchWarp(uy):uy)*span;
    d.copy(base).addScaledVector(east,ox).addScaledVector(north,oy).normalize();
    const h=terrainH(pl,d.x,d.y,d.z);
    const wx=pl.x+d.x*(pl.radius+h)-anchorWorld.x;
    const wy=pl.y+d.y*(pl.radius+h)-anchorWorld.y;
    const wz=pl.z+d.z*(pl.radius+h)-anchorWorld.z;
    posA.setXYZ(i,wx,wy,wz);
    uvA.setXY(i,ox/span+0.5,oy/span+0.5);
    vertColor(pl,d,h,c);
    colA.setXYZ(i,c.r,c.g,c.b);
    i++;
  }
  posA.needsUpdate=true;colA.needsUpdate=true;uvA.needsUpdate=true;
  g.computeVertexNormals();g.computeBoundingSphere();
  this.patchWorldAnchor=anchorWorld;
  this.patch.visible=true;
  W2R(anchorWorld.x,anchorWorld.y,anchorWorld.z,this.patch.position);
  this.sinkNear(pl);
};
/* 球体网格在补丁覆盖区内下沉几米：球体大三角在谷地会高于解析地形，
   从地面视角穿出补丁（穿模主因之一）。深度偏移只能解决共面闪烁，压不住几米的几何差 */
Planets._restoreSink=function(e){
  if(!e._sinkIdx||!e._sinkIdx.length){e._sinkKey=null;return}
  const posA=e.group.children[0].geometry.attributes.position;
  for(let i=0;i<e._sinkIdx.length;i++){
    const vi=e._sinkIdx[i],a=e._sinkAmt[i];
    const x=posA.getX(vi),y=posA.getY(vi),z=posA.getZ(vi);
    const l=Math.sqrt(x*x+y*y+z*z),f=(l+a)/l;
    posA.setXYZ(vi,x*f,y*f,z*f);
  }
  posA.needsUpdate=true;
  e._sinkIdx=null;e._sinkAmt=null;e._sinkKey=null;
};
Planets.unsink=function(){
  for(const id in this.near)this._restoreSink(this.near[id]);
};
Planets.sinkNear=function(pl){
  const e=this.near[pl.id];
  if(!e||this.patchPl!==pl.id||!this.patchFrame)return;
  const key=pl.id+':'+e.sub+':'+this.patchAnchor.x.toFixed(6)+','+this.patchAnchor.y.toFixed(6)+','+this.patchAnchor.z.toFixed(6)+':'+this.patchTier;
  if(e._sinkKey===key)return;
  this._restoreSink(e);
  const posA=e.group.children[0].geometry.attributes.position;
  const up=this.patchFrame.up,span=this.patchFrame.span;
  const r1=span*0.30,r2=span*0.48;
  const cosR2=Math.cos(r2/pl.radius);
  const S=4+pl.td.amp*0.05+(pl.td.ridge||0)*0.06;
  const idx=[],amt=[];
  for(let i=0;i<posA.count;i++){
    const x=posA.getX(i),y=posA.getY(i),z=posA.getZ(i);
    const l=Math.sqrt(x*x+y*y+z*z);
    const dot=(x*up.x+y*up.y+z*up.z)/l;
    if(dot<cosR2)continue;
    const arc=Math.acos(clamp(dot,-1,1))*pl.radius;
    const s=S*(1-smoothstep(r1,r2,arc));
    if(s<=0.01)continue;
    const f=(l-s)/l;
    posA.setXYZ(i,x*f,y*f,z*f);
    idx.push(i);amt.push(s);
  }
  e._sinkIdx=idx;e._sinkAmt=amt;e._sinkKey=key;
  posA.needsUpdate=true;
};
Planets.groundTex=function(pl){
  if(pl._gtex)return pl._gtex;
  const cs=pl.td.cols;
  let t;
  if(pl.type==='temperate'||pl.type==='forest')t=Tex.grass('g'+pl.type,cs[1],cs[0],pl.seed);
  else if(pl.type==='ocean')t=Tex.grass('gocean',cs[1],cs[0],pl.seed);
  else t=Tex.ground('g'+pl.type+(pl.seed%5),cs[1],cs[0],cs[2],pl.seed);
  t.repeat.set(60,60);
  pl._gtex=t;return t;
};

/* ---------- 程序化散布（规则铺设） ----------
   dn: 基座下沉比例(×scale)防坡地悬浮 ｜ 奇观规则密度<0.02，每片区域0~3个，天际线级尺度 */
const SCATTER_RULES={
  temperate:[{d:'tree_broadleaf',n:4,minH:2,maxSl:0.45,sc:[0.8,1.6],cr:0.45},{d:'tree_conifer',n:2.5,minH:14,maxSl:0.5,sc:[0.8,1.4],cr:0.45},{d:'bush',n:5,minH:1,maxSl:0.5,sc:[0.8,1.8],cr:0},{d:'boulder',n:1.8,minH:4,maxSl:1,sc:[0.5,1.8],mine:1,res:'iron',cr:1.5},
    {d:'grassTuft',n:7,minH:1,maxSl:0.55,sc:[0.7,1.5],dn:0.04,cr:0},{d:'megaTree',n:0.018,minH:6,maxSl:0.4,sc:[1.1,1.9],dn:0.35,cr:2.6},
    {d:'herbPlant',n:1.2,minH:2,maxSl:0.5,sc:[0.8,1.3],mine:1,res:'herb',cr:0.4,dn:0.05}],
  forest:[{d:'tree_conifer',n:9,minH:3,maxSl:0.55,sc:[0.9,1.9],cr:0.45},{d:'tree_broadleaf',n:3.5,minH:3,maxSl:0.5,sc:[0.9,1.6],cr:0.45},{d:'mushroom',n:1.6,minH:2,maxSl:0.4,sc:[0.3,0.8],cr:0.5},{d:'boulder',n:1.6,minH:2,maxSl:1,sc:[0.5,1.4],mine:1,res:'iron',cr:1.5},
    {d:'grassTuft',n:5,minH:2,maxSl:0.55,sc:[0.7,1.4],dn:0.04,cr:0},{d:'megaTree',n:0.03,minH:5,maxSl:0.45,sc:[1.2,2.2],dn:0.35,cr:2.6},
    {d:'herbPlant',n:1.6,minH:2,maxSl:0.5,sc:[0.8,1.3],mine:1,res:'herb',cr:0.4,dn:0.05}],
  ocean:[{d:'tree_palm',n:3.5,minH:2,maxH:26,maxSl:0.4,sc:[0.8,1.5],cr:0.4},{d:'bush',n:3,minH:1,maxH:30,maxSl:0.5,sc:[0.7,1.4],cr:0},{d:'boulder',n:1.4,minH:1,maxSl:1,sc:[0.4,1.2],mine:1,res:'iron',cr:1.4},
    {d:'grassTuft',n:4,minH:1,maxH:28,maxSl:0.5,sc:[0.7,1.3],dn:0.04,cr:0},{d:'rockArch',n:0.015,minH:2,maxSl:0.45,sc:[1.1,2.0],dn:0.5,cr:0},
    {d:'herbPlant',n:1.0,minH:1,maxH:26,maxSl:0.5,sc:[0.8,1.3],mine:1,res:'herb',cr:0.4,dn:0.05}],
  desert:[{d:'tree_cactus',n:2,minH:1,maxSl:0.4,sc:[0.7,1.7],cr:0.35},{d:'tree_dead',n:0.8,minH:1,maxSl:0.45,sc:[0.7,1.3],cr:0.35},{d:'boulder',n:1.6,minH:1,maxSl:1,sc:[0.5,2],mine:1,res:'iron',cr:1.5},
    {d:'pebbles',n:3,minH:1,maxSl:0.8,sc:[0.7,1.6],dn:0.08,cr:0},{d:'rockArch',n:0.018,minH:2,maxSl:0.45,sc:[1.4,2.6],dn:0.5,cr:0},{d:'obelisk',n:0.012,minH:3,maxSl:0.3,sc:[0.9,1.6],dn:0.2,cr:1.4},
    {d:'oreGold',n:0.5,minH:2,maxSl:0.8,sc:[0.7,1.3],mine:1,res:'gold',cr:1.2,dn:0.3},{d:'oreSilver',n:0.8,minH:2,maxSl:0.8,sc:[0.7,1.3],mine:1,res:'silver',cr:1.2,dn:0.3},{d:'oreIron',n:1.2,minH:1,maxSl:0.8,sc:[0.7,1.4],mine:1,res:'iron',cr:1.2,dn:0.3}],
  rock:[{d:'boulder',n:4,minH:0,maxSl:1,sc:[0.5,2.6],mine:1,res:'iron',cr:1.5},{d:'crystal',n:1,minH:2,maxSl:0.8,sc:[0.7,1.6],mine:2,res:'crystal',cr:0.9},
    {d:'pebbles',n:4,minH:0,maxSl:0.9,sc:[0.7,1.8],dn:0.08,cr:0},{d:'rockArch',n:0.02,minH:3,maxSl:0.5,sc:[1.5,3.0],dn:0.5,cr:0},{d:'crystalTitan',n:0.014,minH:4,maxSl:0.4,sc:[1,1.8],dn:0.3,cr:2.0},
    {d:'oreIron',n:1.5,minH:0,maxSl:0.8,sc:[0.7,1.4],mine:1,res:'iron',cr:1.2,dn:0.3},{d:'oreAlum',n:1.2,minH:0,maxSl:0.8,sc:[0.7,1.4],mine:1,res:'alum',cr:1.2,dn:0.3}],
  tundra:[{d:'tree_conifer',n:2,minH:2,maxSl:0.5,sc:[0.6,1.2],cr:0.4},{d:'tree_dead',n:1.2,minH:1,maxSl:0.5,sc:[0.7,1.2],cr:0.35},{d:'boulder',n:2,minH:1,maxSl:1,sc:[0.5,1.6],mine:1,res:'iron',cr:1.5},
    {d:'pebbles',n:3,minH:1,maxSl:0.9,sc:[0.6,1.4],dn:0.08,cr:0},{d:'monolith',n:0.015,minH:2,maxSl:0.3,sc:[1,1.6],dn:0.25,cr:0},
    {d:'oreSilver',n:0.7,minH:1,maxSl:0.8,sc:[0.7,1.3],mine:1,res:'silver',cr:1.2,dn:0.3},{d:'oreAlum',n:1.0,minH:1,maxSl:0.8,sc:[0.7,1.4],mine:1,res:'alum',cr:1.2,dn:0.3}],
  ice:[{d:'iceSpike',n:3.4,minH:1,maxSl:0.8,sc:[0.6,2.2],cr:0.8},{d:'crystal',n:1.2,minH:2,maxSl:0.8,sc:[0.6,1.5],mine:2,res:'crystal',cr:0.9},{d:'boulder',n:1.4,minH:1,maxSl:1,sc:[0.5,1.5],mine:1,res:'iron',cr:1.4},
    {d:'crystalTitan',n:0.02,minH:3,maxSl:0.45,sc:[1.1,2.2],dn:0.3,cr:2.0},
    {d:'oreDiamond',n:0.45,minH:1,maxSl:0.8,sc:[0.7,1.3],mine:1,res:'diamond',cr:1.2,dn:0.3}],
  toxic:[{d:'mushroom',n:3.5,minH:2,maxSl:0.5,sc:[0.5,1.8],cr:0.5},{d:'gasOrb',n:1.6,minH:2,maxSl:0.4,sc:[0.7,1.4],cr:0},{d:'crystal',n:0.9,minH:2,maxSl:0.8,sc:[0.7,1.6],mine:2,res:'crystal',cr:0.9},
    {d:'megaShroom',n:0.02,minH:3,maxSl:0.4,sc:[1,1.8],dn:0.3,cr:1.8},{d:'crystalTitan',n:0.01,minH:3,maxSl:0.4,sc:[0.9,1.6],dn:0.3,cr:2.0},
    {d:'oreUran',n:0.7,minH:2,maxSl:0.8,sc:[0.7,1.3],mine:1,res:'uran',cr:1.2,dn:0.3}],
  lava:[{d:'lavaSpike',n:3,minH:8,maxSl:0.9,sc:[0.6,2],cr:0.8},{d:'boulder',n:2,minH:8,maxSl:1,sc:[0.5,1.8],mine:1,res:'iron',cr:1.5},
    {d:'pebbles',n:3,minH:8,maxSl:0.9,sc:[0.7,1.6],dn:0.08,cr:0},{d:'volcanoCone',n:0.018,minH:9,maxSl:0.6,sc:[1.2,2.4],dn:0.6,cr:6},
    {d:'oreUran',n:0.6,minH:8,maxSl:0.8,sc:[0.7,1.3],mine:1,res:'uran',cr:1.2,dn:0.3},{d:'oreGold',n:0.5,minH:8,maxSl:0.8,sc:[0.7,1.3],mine:1,res:'gold',cr:1.2,dn:0.3}],
  gas:[{d:'gasOrb',n:3,minH:0,maxSl:1,sc:[0.8,2.4],cr:0}],
};
Planets._archCache={};
Planets.archetype=function(name){
  if(this._archCache[name])return this._archCache[name];
  const model=buildModel(DEFS[name]());
  const meshes=[];
  model.traverse(o=>{if(o.isMesh)meshes.push({geo:o.geometry,mat:o.material})});
  this._archCache[name]={meshes};
  return this._archCache[name];
};
Planets.updateScatter=function(pl,pos){
  _pd.set(pos.x-pl.x,pos.y-pl.y,pos.z-pl.z).normalize();
  const moved=this.scatterAnchor.distanceTo(_pd)*pl.radius;
  if(this.scatterPl===pl.id&&moved<70){this.scatterSets.forEach(s=>s.meshes.forEach(m=>m.visible=true));return}
  if(this.curAlt>900)return;
  this.scatterPl=pl.id;this.scatterAnchor.copy(_pd);
  this.clearScatter();
  const rules=SCATTER_RULES[pl.type]||[];
  const R=460,cellSz=52;
  const up=_pd.clone();
  const east=new THREE.Vector3(0,1,0).cross(up);
  if(east.lengthSq()<1e-6)east.set(1,0,0);east.normalize();
  const north=up.clone().cross(east).normalize();
  const anchorWorld={x:pl.x+up.x*pl.radius,y:pl.y+up.y*pl.radius,z:pl.z+up.z*pl.radius};
  const sea=pl.td.sea?pl.td.sea.h:0;
  const tmpM=new THREE.Matrix4(),tmpQ=new THREE.Quaternion(),tmpS=new THREE.Vector3(),tmpP=new THREE.Vector3();
  const d=new THREE.Vector3(),yAxis=new THREE.Vector3(0,1,0);
  this.mineables=[];
  /* 绝对量化格：格子ID由球面世界网格唯一决定（与玩家位置无关），同一格子任意次重建
     产出完全相同的物体与坐标——修复"走近树却发现树挪位/消失"（旧实现以重建时玩家方向为原点重摆全场） */
  const K=pl.radius/cellSz;
  let ruleIdx=0;
  for(const rule of rules){
    const arch=this.archetype(rule.d);
    const items=[];
    const seen=new Set();
    const e2=new THREE.Vector3(),n2=new THREE.Vector3(),dcq=new THREE.Vector3();
    const cellFrame={east:e2,north:n2};
    const nCells=Math.ceil(R/cellSz);
    for(let cy=-nCells;cy<=nCells;cy++)for(let cx=-nCells;cx<=nCells;cx++){
      d.copy(up).multiplyScalar(pl.radius).addScaledVector(east,cx*cellSz).addScaledVector(north,cy*cellSz).normalize();
      const ix=Math.round(d.x*K),iy=Math.round(d.y*K),iz=Math.round(d.z*K);
      const idKey=ix+','+iy+','+iz;
      if(seen.has(idKey))continue;
      seen.add(idKey);
      dcq.set(ix/K,iy/K,iz/K).normalize();
      const cellRng=mulberry32(hash3i(ix,iy,iz)^pl.seed^(ruleIdx*2654435761|0));
      tangentFrame(dcq,cellFrame);
      /* 概率取整：低密度奇观规则(n<1)也能按期望出现 */
      const ex=rule.n*(cellSz*cellSz)/2700*(0.5+cellRng());
      let cnt=Math.floor(ex);
      if(cellRng()<ex-cnt)cnt++;
      for(let k=0;k<cnt;k++){
        const ox=(cellRng()-0.5)*cellSz,oy=(cellRng()-0.5)*cellSz;
        d.copy(dcq).multiplyScalar(pl.radius).addScaledVector(e2,ox).addScaledVector(n2,oy).normalize();
        const arcP=Math.acos(clamp(d.dot(up),-1,1))*pl.radius;
        if(arcP>R)continue;
        const h=terrainH(pl,d.x,d.y,d.z);
        if(h<sea+(rule.minH||0))continue;
        if(rule.maxH!==undefined&&h>sea+rule.maxH)continue;
        if(pl.city&&pl.cityDir){
          const arc=Math.acos(clamp(d.dot(pl.cityDir),-1,1))*pl.radius;
          if(arc<380)continue;
        }
        const e=0.004;
        const h2=terrainH(pl,d.x+e2.x*e,d.y+e2.y*e,d.z+e2.z*e);
        const slope=Math.abs(h2-h)/(e*pl.radius);
        if(slope>(rule.maxSl||1))continue;
        const scl=rule.sc[0]+cellRng()*(rule.sc[1]-rule.sc[0]);
        /* 基座下沉，避免坡地上边缘悬空穿帮 */
        const dn=(rule.dn!==undefined?rule.dn:0.22)*scl;
        tmpP.set(pl.x+d.x*(pl.radius+h-dn)-anchorWorld.x,pl.y+d.y*(pl.radius+h-dn)-anchorWorld.y,pl.z+d.z*(pl.radius+h-dn)-anchorWorld.z);
        tmpQ.setFromUnitVectors(yAxis,d);
        const yq=new THREE.Quaternion().setFromAxisAngle(yAxis,cellRng()*Math.PI*2);
        tmpQ.multiply(yq);
        tmpS.setScalar(scl);
        tmpM.compose(tmpP,tmpQ,tmpS);
        items.push({m:tmpM.clone(),world:{x:pl.x+d.x*(pl.radius+h),y:pl.y+d.y*(pl.radius+h),z:pl.z+d.z*(pl.radius+h)},sc:scl,cr:(rule.cr!==undefined?rule.cr:0.8)*scl});
      }
    }
    const set={rule,meshes:[],items};
    for(const am of arch.meshes){
      const im=new THREE.InstancedMesh(am.geo,am.mat,Math.max(1,items.length));
      im.castShadow=true;im.receiveShadow=false;
      items.forEach((it,i)=>im.setMatrixAt(i,it.m));
      im.count=items.length;
      im.instanceMatrix.needsUpdate=true;
      im.frustumCulled=false;
      this.scene.add(im);set.meshes.push(im);
    }
    if(rule.mine)items.forEach((it,i)=>this.mineables.push({set,idx:i,world:it.world,hp:rule.mine+1,r:2.2*it.sc,yield:rule.mine,res:rule.res||'iron'}));
    for(const it of items)if(it.cr>0)Colliders.addCyl('scatter',it.world.x,it.world.y,it.world.z,it.cr);
    this.scatterSets.push(set);
    ruleIdx++;
  }
  this.scatterWorldAnchor=anchorWorld;
  this.positionScatter();
};
Planets.positionScatter=function(){
  if(!this.scatterWorldAnchor)return;
  for(const s of this.scatterSets)for(const m of s.meshes)
    W2R(this.scatterWorldAnchor.x,this.scatterWorldAnchor.y,this.scatterWorldAnchor.z,m.position);
};
Planets.clearScatter=function(){
  for(const s of this.scatterSets)for(const m of s.meshes){this.scene.remove(m);m.dispose()}
  this.scatterSets=[];this.mineables=[];
  Colliders.clear('scatter');
};
Planets.hideScatter=function(){for(const s of this.scatterSets)for(const m of s.meshes)m.visible=false;this.scatterPl=-1};
Planets.mineAt=function(worldPt,maxR){
  let best=null,bd=maxR||3;
  for(const mn of this.mineables){
    if(mn.dead)continue;
    const dx=mn.world.x-worldPt.x,dy=mn.world.y-worldPt.y,dz=mn.world.z-worldPt.z;
    const d=Math.sqrt(dx*dx+dy*dy+dz*dz)-mn.r;
    if(d<bd){bd=d;best=mn}
  }
  return best;
};
Planets.destroyMine=function(mn){
  mn.dead=true;
  const z=new THREE.Matrix4().makeScale(0.001,0.001,0.001);
  for(const m of mn.set.meshes){m.setMatrixAt(mn.idx,z);m.instanceMatrix.needsUpdate=true}
};

/* ---------- 殖民地（道路街景 + 建筑，规则铺设） ---------- */
function cityFrame(pl){
  const up=pl.cityDir.clone();
  const east=new THREE.Vector3(0,1,0).cross(up);
  if(east.lengthSq()<1e-6)east.set(1,0,0);east.normalize();
  const north=up.clone().cross(east).normalize();
  const h=terrainCityH(pl);
  return {up,east,north,h,R:pl.radius+h};
}
function cityLocalToWorld(pl,f,lx,ly,out){
  _pd.copy(f.up).multiplyScalar(pl.radius).addScaledVector(f.east,lx).addScaledVector(f.north,ly).normalize();
  out.dir=_pd.clone();
  out.x=pl.x+_pd.x*f.R;out.y=pl.y+_pd.y*f.R;out.z=pl.z+_pd.z*f.R;
  return out;
}
function cityPadWorld(pl){
  const f=cityFrame(pl);
  const o={};cityLocalToWorld(pl,f,0,-60,o);
  return o;
}
Planets.updateCity=function(pl,pos){
  if(!pl.city){this.hideCity();return}
  if(this.cityPid===pl.id&&this.city){
    this.city.visible=true;
    W2R(this.cityAnchor.x,this.cityAnchor.y,this.cityAnchor.z,this.city.position);
    return;
  }
  this.hideCity(true);
  this.city=this.buildCity(pl);
  this.cityPid=pl.id;
  this.scene.add(this.city);
  W2R(this.cityAnchor.x,this.cityAnchor.y,this.cityAnchor.z,this.city.position);
};
Planets.hideCity=function(destroy){
  if(this.city){
    if(destroy){
      this.city.traverse(o=>{if(o.geometry&&!o.userData.sharedGeo)o.geometry.dispose()});
      this.scene.remove(this.city);this.city=null;this.cityPid=-1;
      Colliders.clear('city');
    }else this.city.visible=false;
  }
};
Planets._cityModel=function(name){
  if(!this._archCache['b_'+name])this._archCache['b_'+name]={model:buildModel(DEFS[name]())};
  return this._archCache['b_'+name].model;
};
Planets.buildCity=function(pl){
  const rng=mulberry32(pl.seed^0xC17F);
  const f=cityFrame(pl);
  const group=new THREE.Group();
  const anchor={};cityLocalToWorld(pl,f,0,0,anchor);
  this.cityAnchor=anchor;
  const yAxis=new THREE.Vector3(0,1,0);
  const place=(obj,lx,ly,rotY,lift)=>{
    const o={};cityLocalToWorld(pl,f,lx,ly,o);
    obj.position.set(o.x-anchor.x,o.y-anchor.y,o.z-anchor.z);
    if(lift)obj.position.addScaledVector(o.dir,lift);
    /* 城市统一切向基 X=east′ Y=up Z=−north′（右手系）。
       旧 setFromUnitVectors(Y,dir) 输运基随位置乱转 → 路面一块一块、路灯朝外 */
    const n2=new THREE.Vector3().copy(f.north).addScaledVector(o.dir,-f.north.dot(o.dir)).normalize();
    const e2=new THREE.Vector3().crossVectors(n2,o.dir).normalize();
    const bm=new THREE.Matrix4().makeBasis(e2,o.dir,new THREE.Vector3().copy(n2).negate());
    const q=new THREE.Quaternion().setFromRotationMatrix(bm);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(yAxis,(rotY||0)*DEG));
    obj.quaternion.copy(q);
    group.add(obj);
    return obj;
  };
  const inst=(name,lx,ly,rotY,scale)=>{
    const src=this._cityModel(name);
    const c=src.clone(true);
    c.name=name;
    c.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.userData.sharedGeo=true}});
    if(scale)c.scale.setScalar(scale);
    return place(c,lx,ly,rotY,0.02);
  };
  /* 起降坪 */
  {
    const pad=new THREE.Group();
    const base=new THREE.Mesh(new THREE.CylinderGeometry(15,16.5,1.1,28),M.concrete);
    base.position.y=0.55;base.receiveShadow=true;pad.add(base);
    const top=new THREE.Mesh(new THREE.CylinderGeometry(14.2,14.2,0.16,28),M.pad);
    top.position.y=1.15;top.receiveShadow=true;pad.add(top);
    for(let i=0;i<8;i++){
      const a=i/8*Math.PI*2;
      const lt=new THREE.Mesh(new THREE.BoxGeometry(0.4,0.3,0.4),M.lightO);
      lt.position.set(Math.cos(a)*14.6,0.9,Math.sin(a)*14.6);pad.add(lt);
    }
    place(pad,0,-60,0,0);
    pl._padTopH=1.25;
  }
  /* 道路：主街(南北) + 横街(东西)，分段贴合球面 */
  const roadSeg=(lx,ly,rotY,len,wid)=>{
    const rgeo=new THREE.BoxGeometry(wid||7,0.14,len+0.35);
    const m=new THREE.Mesh(rgeo,M.road);
    m.receiveShadow=true;
    place(m,lx,ly,rotY,0.07);
  };
  for(let y=-42;y<=160;y+=12)roadSeg(0,y,0,12);
  for(let x=-90;x<=90;x+=12){if(Math.abs(x)>4)roadSeg(x,52,90,12)}
  /* 建筑群 */
  inst('hangar',52,-52,90);
  inst('habDome',-38,8,rng()*360|0);
  inst('habDome',34,110,rng()*360|0,0.8);
  inst('habBlock',26,20,-90);
  inst('habBlock',-30,80,90);
  inst('habBlock',30,74,-90,0.85);
  inst('tower',-58,128,0);
  inst('tankBig',-24,-46,0,0.9);
  inst('tankBig',-36,-38,0,0.7);
  /* 路灯沿主街（灯头=模型+Z：东侧朝西、西侧朝东、横街朝北，全部面向路心） */
  for(let y=-30;y<=150;y+=30){
    inst('lampPost',5.6,y,-90);
    inst('lampPost',-5.6,y+15,90);
  }
  for(let x=-66;x<=66;x+=33){if(Math.abs(x)>8){inst('lampPost',x,46.4,180);}}
  /* 小品 */
  inst('crateStack',12,-38,rng()*360|0);
  inst('crateStack',-14,34,rng()*360|0,0.9);
  inst('barrelProp',15,-42,0,1.1);
  inst('barrelProp',16.5,-40,0);
  inst('beacon',8,-74,0);
  inst('beacon',-8,-74,0);
  inst('beacon',0,166,0);
  /* 碰撞登记：建筑=切向矩形，杆件/罐箱=圆柱 */
  const reg=(lx,ly,kind,a,b)=>{
    const o={};cityLocalToWorld(pl,f,lx,ly,o);
    const n2p=new THREE.Vector3().copy(f.north).addScaledVector(o.dir,-f.north.dot(o.dir)).normalize();
    const e2p=new THREE.Vector3().crossVectors(n2p,o.dir).normalize();
    if(kind==='c')Colliders.addCyl('city',o.x,o.y,o.z,a);
    else Colliders.addBox('city',o.x,o.y,o.z,a,b,e2p,n2p);
  };
  reg(52,-52,'b',11,14);
  reg(-38,8,'c',9.5);reg(34,110,'c',7.8);
  reg(26,20,'b',5.5,9);reg(-30,80,'b',5.5,9);reg(30,74,'b',4.8,8);
  reg(-58,128,'c',4.5);
  reg(-24,-46,'c',3.2);reg(-36,-38,'c',2.6);
  for(let y=-30;y<=150;y+=30){reg(5.6,y,'c',0.3);reg(-5.6,y+15,'c',0.3)}
  for(let x=-66;x<=66;x+=33)if(Math.abs(x)>8)reg(x,46.4,'c',0.3);
  reg(12,-38,'c',1.7);reg(-14,34,'c',1.6);
  reg(15,-42,'c',0.7);reg(16.5,-40,'c',0.6);
  reg(8,-74,'c',0.5);reg(-8,-74,'c',0.5);reg(0,166,'c',0.5);
  group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
  return group;
};
