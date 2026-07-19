'use strict';
/* ================= sim.js — 飞船/漫游车/步行 操控与物理、镜头、武器、迁跃/传送、特效 ================= */

const Input={keys:{},mdx:0,mdy:0,mdown:false,wheel:0,locked:false,mdxR:0,mdyR:0};
const Game={mode:'landed',credits:200,ore:0,hull:100,hullMax:100,hp:100,hpMax:100,medkits:0,
  res:{herb:0,iron:0,alum:0,crystal:0,silver:0,gold:0,diamond:0,uran:0},
  up:{dmg:0,rof:0,mine:0,hp:0,hull:0,od:0},
  visited:{},msg:'',msgT:0,warp:null,tp:0,fovKick:0,shake:0,dmgFlash:0,hitFlash:0};
const RES_DEF={herb:{name:'草药',val:6},iron:{name:'铁矿石',val:8},alum:{name:'铝矿',val:10},crystal:{name:'水晶',val:18},silver:{name:'银矿',val:24},gold:{name:'黄金',val:40},diamond:{name:'钻石',val:70},uran:{name:'铀矿',val:60}};
/* ---------- 升级/合成 ---------- */
const UP_DEF={
  dmg:{name:'枪械伤害',max:5,eff:'+25%伤害/级',cost:l=>({cr:300*Math.pow(1.6,l)|0,res:{iron:6+3*l,crystal:2+l}})},
  rof:{name:'射速',max:4,eff:'-12%冷却/级',cost:l=>({cr:300*Math.pow(1.6,l)|0,res:{alum:4+2*l,silver:2+l}})},
  mine:{name:'采集效率',max:4,eff:'+1产量/级',cost:l=>({cr:200*Math.pow(1.6,l)|0,res:{iron:4+2*l,alum:3+l}})},
  hp:{name:'生命上限',max:4,eff:'+25HP/级',cost:l=>({cr:250*Math.pow(1.6,l)|0,res:{herb:5+2*l,silver:2+l}})},
  hull:{name:'船体上限',max:4,eff:'+25船体/级',cost:l=>({cr:400*Math.pow(1.6,l)|0,res:{iron:8+3*l,gold:2+l}})},
  od:{name:'超巡速度',max:3,eff:'+15%极速/级',cost:l=>({cr:800*Math.pow(1.6,l)|0,res:{uran:2+l,diamond:1+l}})},
};
function upBuy(key){
  const u=UP_DEF[key],lv=Game.up[key];
  if(lv>=u.max){toast(u.name+' 已满级');return false}
  const c=u.cost(lv);
  if(Game.credits<c.cr){toast('信用点不足（需 '+c.cr+'）');return false}
  for(const k in c.res)if((Game.res[k]||0)<c.res[k]){toast(RES_DEF[k].name+'不足（需 '+c.res[k]+'）');return false}
  Game.credits-=c.cr;
  for(const k in c.res)Game.res[k]-=c.res[k];
  Game.up[key]++;
  if(key==='hp'){Game.hpMax=100+Game.up.hp*25;Game.hp=Game.hpMax}
  if(key==='hull'){Game.hullMax=100+Game.up.hull*25;Game.hull=Game.hullMax}
  AudioSys.ev('mined');toast(u.name+' 升级 → Lv'+Game.up[key]);
  return true;
}
function craftMedkit(){
  if(Game.medkits>=5){toast('医疗包已达上限(5)');return false}
  if((Game.res.herb||0)<3){toast('草药不足（需3）');return false}
  Game.res.herb-=3;Game.medkits++;
  AudioSys.ev('reloadDone');toast('合成医疗包 ×1（Q 使用）');
  return true;
}
function useMedkit(){
  if(Game.mode!=='foot'){toast('只能在步行时使用医疗包');return}
  if(Game.medkits<=0){toast('没有医疗包（C 面板合成，3草药/个）');return}
  if(Game.hp>=Game.hpMax){toast('生命值已满');return}
  Game.medkits--;Game.hp=Math.min(Game.hpMax,Game.hp+50);
  AudioSys.ev('reloadDone');toast('使用医疗包 +50 HP');
}
function toast(s,t){Game.msg=s;Game.msgT=t||2.6}

const _q1=new THREE.Quaternion(),_q2=new THREE.Quaternion(),_qL=new THREE.Quaternion(),_m4=new THREE.Matrix4(),_v1=new THREE.Vector3(),_v2=new THREE.Vector3(),_v3=new THREE.Vector3(),_v4=new THREE.Vector3();
const AXIS_X=new THREE.Vector3(1,0,0),AXIS_Y=new THREE.Vector3(0,1,0),AXIS_Z=new THREE.Vector3(0,0,1);

function tangentFrame(up,out){
  out.east.set(0,1,0).cross(up);
  if(out.east.lengthSq()<1e-6)out.east.set(1,0,0);
  out.east.normalize();
  out.north.copy(up).cross(out.east).normalize();
  return out;
}

/* ---------- 静态碰撞体：圆柱/切向矩形 + 空间哈希（散布物/城市物件挡人挡车） ---------- */
const Colliders={
  grid:new Map(),CELL:48,
  _put(c){
    const C=this.CELL;
    const k=((c.x/C)|0)+','+((c.y/C)|0)+','+((c.z/C)|0);
    let a=this.grid.get(k);if(!a){a=[];this.grid.set(k,a)}
    a.push(c);
  },
  clear(tag){
    for(const[k,a]of this.grid){
      const f=a.filter(c=>c.tag!==tag);
      if(f.length)this.grid.set(k,f);else this.grid.delete(k);
    }
  },
  addCyl(tag,x,y,z,r){this._put({tag,x,y,z,r,box:0})},
  addBox(tag,x,y,z,ex,ez,e2,n2){this._put({tag,x,y,z,ex,ez,e2x:e2.x,e2y:e2.y,e2z:e2.z,n2x:n2.x,n2y:n2.y,n2z:n2.z,box:1})},
  resolve(pos,rad,pl){
    if(!pl)return;
    let ux=pos.x-pl.x,uy=pos.y-pl.y,uz=pos.z-pl.z;
    const ul=Math.sqrt(ux*ux+uy*uy+uz*uz)||1;
    ux/=ul;uy/=ul;uz/=ul;
    const C=this.CELL;
    for(let gx=-1;gx<=1;gx++)for(let gy=-1;gy<=1;gy++)for(let gz=-1;gz<=1;gz++){
      const a=this.grid.get((((pos.x+gx*C)/C)|0)+','+(((pos.y+gy*C)/C)|0)+','+(((pos.z+gz*C)/C)|0));
      if(!a)continue;
      for(const c of a){
        let dx=pos.x-c.x,dy=pos.y-c.y,dz=pos.z-c.z;
        /* 高差>6m 不作用；间隔向量投影到切平面，只做水平推出 */
        const vd=dx*ux+dy*uy+dz*uz;
        if(Math.abs(vd)>6)continue;
        dx-=ux*vd;dy-=uy*vd;dz-=uz*vd;
        if(c.box){
          const lx=dx*c.e2x+dy*c.e2y+dz*c.e2z,lz=dx*c.n2x+dy*c.n2y+dz*c.n2z;
          const px=c.ex+rad-Math.abs(lx),pz=c.ez+rad-Math.abs(lz);
          if(px<=0||pz<=0)continue;
          if(px<pz){const s=lx>=0?1:-1;pos.x+=c.e2x*s*px;pos.y+=c.e2y*s*px;pos.z+=c.e2z*s*px}
          else{const s=lz>=0?1:-1;pos.x+=c.n2x*s*pz;pos.y+=c.n2y*s*pz;pos.z+=c.n2z*s*pz}
        }else{
          const d2=dx*dx+dy*dy+dz*dz,rr=c.r+rad;
          if(d2>=rr*rr||d2<1e-8)continue;
          const dl=Math.sqrt(d2),push=(rr-dl)/dl;
          pos.x+=dx*push;pos.y+=dy*push;pos.z+=dz*push;
        }
      }
    }
  }
};

/* ---------- 飞船 ---------- */
const Ship={
  pos:{x:0,y:0,z:0},vel:{x:0,y:0,z:0},quat:new THREE.Quaternion(),
  throttle:0,strafe:0,vert:0,boost:false,od:false,gear:true,landed:true,
  pr:0,yr:0,rr:0,speed:0,alt:0,model:null,glows:[],
  _bf:new THREE.Vector3(),_br:new THREE.Vector3(),_bu:new THREE.Vector3(),
  init(scene){
    this.model=buildModel(DEFS.ship());
    scene.add(this.model);
    const mk=(x,y,z,s)=>{
      const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:Tex.glow('eng','#7ac6ff'),transparent:true,opacity:0.9,depthWrite:false,blending:THREE.AdditiveBlending}));
      sp.position.set(x,y,z);sp.scale.setScalar(s);this.model.add(sp);this.glows.push({sp,s});
    };
    mk(2.3,2.1,-5.75,1.4);mk(-2.3,2.1,-5.75,1.4);mk(0,2,-7.8,1.9);
  },
  basis(){
    /* 专用向量：绝不能返回共享临时向量，否则相机up会被后续计算污染（历史bug：视角翻转/自旋） */
    this._bf.set(0,0,1).applyQuaternion(this.quat);
    this._br.set(1,0,0).applyQuaternion(this.quat);
    this._bu.set(0,1,0).applyQuaternion(this.quat);
    return {f:this._bf,r:this._br,u:this._bu};
  },
  update(dt){
    const k=Input.keys;
    const pl=Planets.current;
    let up=null,alt=1e9,gnd=0;
    if(pl){
      _v4.set(this.pos.x-pl.x,this.pos.y-pl.y,this.pos.z-pl.z);
      const d=_v4.length();up=_v4.normalize().clone();
      gnd=pl.radius+terrainH(pl,up.x,up.y,up.z);
      alt=d-gnd;
    }
    this.alt=alt;
    if(this.landed){
      if(k['KeyW']||k['KeyR']){
        this.landed=false;Game.mode='ship';
        const n=up||AXIS_Y;
        this.vel.x+=n.x*14;this.vel.y+=n.y*14;this.vel.z+=n.z*14;
        AudioSys.ev('takeoff');toast('起飞');
      }
      return;
    }
    /* 姿态 — 帧率无关灵敏度(px/秒)。超巡(od)期间锁定旋转，避免高速下视角乱转 */
    this.boost=!!k['ShiftLeft'];
    this.od=!!k['Space']&&this.throttle>0.5;
    const dzv=110*dt;
    const mx=Math.abs(Input.mdx)<dzv?0:Input.mdx,my=Math.abs(Input.mdy)<dzv?0:Input.mdy;
    const sens=0.039;
    /* 屏幕右=-X：鼠标右移(mx>0)→绕Y负转→机头向屏幕右；鼠标上移(my<0)→绕X负转→抬头(FPS习惯) */
    const rawPR=(my/dt)*sens/60, rawYR=-(mx/dt)*sens/60;
    const tgtPR=clamp(rawPR,-2.8,2.8),tgtYR=clamp(rawYR,-2.4,2.4);
    const tgtRR=(k['KeyE']?1.6:0)+(k['KeyQ']?-1.6:0);
    const rotLock=this.od?0:1;
    this.pr=damp(this.pr,tgtPR*rotLock,9,dt);
    this.yr=damp(this.yr,tgtYR*rotLock,9,dt);
    this.rr=damp(this.rr,tgtRR*rotLock,8,dt);
    _q1.setFromAxisAngle(AXIS_X,this.pr*dt);this.quat.multiply(_q1);
    _q1.setFromAxisAngle(AXIS_Y,this.yr*dt);this.quat.multiply(_q1);
    _q1.setFromAxisAngle(AXIS_Z,this.rr*dt);this.quat.multiply(_q1);
    this.quat.normalize();
    /* 注意：不做俯仰限位 — 玩家要求360°全向翻滚自由（曾经的限位会造成"回弹"手感） */
    /* 低空自动扶正：只在慢速进场着陆且无俯仰输入时轻推，绝不与玩家抢操控 */
    if(pl&&alt<150&&!this.od&&this.speed<45&&Math.abs(tgtPR)<0.05&&Math.abs(tgtRR)<0.05){
      const b=this.basis();
      const ang=b.u.angleTo(up);
      if(ang>0.02&&ang<2.6){
        _v4.crossVectors(b.u,up).normalize();
        _q1.setFromAxisAngle(_v4,Math.min(ang,dt*0.8*ang));
        this.quat.premultiply(_q1).normalize();
      }
    }
    /* 油门 */
    if(k['KeyW'])this.throttle=clamp(this.throttle+dt*0.75,0,1);
    if(k['KeyS'])this.throttle=clamp(this.throttle-dt*0.95,-0.3,1);
    if(k['KeyX']){this.throttle=damp(this.throttle,0,6,dt)}
    /* 屏幕右=-X，所以D键沿-X平移 */
    this.strafe=(k['KeyA']?1:0)-(k['KeyD']?1:0);
    this.vert=(k['KeyR']?1:0)-(k['KeyF']&&!this._fLock?1:0);
    const maxS=this.od?9000*(1+0.15*Game.up.od):this.boost?1400:340;
    const b=this.basis();
    let vmax=110;
    if(this.vert<0&&pl&&alt<260)vmax=clamp(alt*0.45,5,110);
    const des=_v4.set(0,0,0)
      .addScaledVector(b.f,this.throttle*maxS)
      .addScaledVector(b.r,this.strafe*130)
      .addScaledVector(b.u,this.vert*vmax);
    const lam=this.od?0.7:1.5;
    this.vel.x=damp(this.vel.x,des.x,lam,dt);
    this.vel.y=damp(this.vel.y,des.y,lam,dt);
    this.vel.z=damp(this.vel.z,des.z,lam,dt);
    /* 重力 + 悬停辅助 */
    if(pl&&alt<pl.atmo*2&&!this.od){
      const g=pl.grav;
      const hover=alt<420?1:0;
      const gs=g*(1-hover);
      this.vel.x-=up.x*gs*dt;this.vel.y-=up.y*gs*dt;this.vel.z-=up.z*gs*dt;
    }
    this.pos.x+=this.vel.x*dt;this.pos.y+=this.vel.y*dt;this.pos.z+=this.vel.z*dt;
    this.speed=Math.sqrt(this.vel.x**2+this.vel.y**2+this.vel.z**2);
    /* 地面碰撞/着陆 */
    if(pl){
      _v4.set(this.pos.x-pl.x,this.pos.y-pl.y,this.pos.z-pl.z);
      const d=_v4.length();const n=_v4.normalize();
      const gr=pl.radius+terrainH(pl,n.x,n.y,n.z);
      const clr=2.15;
      if(d<gr+clr){
        const vdot=this.vel.x*n.x+this.vel.y*n.y+this.vel.z*n.z;
        if(vdot<-14){
          const dmg=Math.min(45,(-vdot-14)*1.4);
          Game.hull=Math.max(0,Game.hull-dmg);Game.dmgFlash=1;Game.shake=Math.min(1.4,0.4+dmg*0.03);
          AudioSys.ev('crash');
        }else if(vdot<-4){AudioSys.ev('thud');Game.shake=0.3}
        const push=gr+clr-d;
        this.pos.x+=n.x*push;this.pos.y+=n.y*push;this.pos.z+=n.z*push;
        if(vdot<0){this.vel.x-=n.x*vdot;this.vel.y-=n.y*vdot;this.vel.z-=n.z*vdot}
        this.vel.x*=0.985;this.vel.y*=0.985;this.vel.z*=0.985;
        if(this.speed<6&&this.gear){
          this.landed=true;Game.mode='landed';this.throttle=0;
          const q=new THREE.Quaternion().setFromUnitVectors(AXIS_Y,n);
          const bf=this.basis();
          const fwd=bf.f.clone().addScaledVector(n,-bf.f.dot(n)).normalize();
          const ref=new THREE.Vector3(0,0,1).applyQuaternion(q);
          let a=Math.acos(clamp(ref.dot(fwd),-1,1));
          if(new THREE.Vector3().crossVectors(ref,fwd).dot(n)<0)a=-a;
          q.multiply(new THREE.Quaternion().setFromAxisAngle(AXIS_Y,a));
          this.quat.copy(q);
          this.vel.x=this.vel.y=this.vel.z=0;
          if(!Game.visited[pl.id]){Game.visited[pl.id]=1;const r=50+((pl.seed%5))*20;Game.credits+=r;toast('首次着陆 '+pl.name+'  +'+r+' 信用点',3.4)}
          else toast('已着陆 '+pl.name);
          AudioSys.ev('land');
        }
      }
      if(Game.hull<=0){
        Game.hull=60;Game.dmgFlash=1;
        const o={x:pl.x+n.x*(gr+pl.atmo+600),y:pl.y+n.y*(gr+pl.atmo+600),z:pl.z+n.z*(gr+pl.atmo+600)};
        this.pos=o;this.vel={x:0,y:0,z:0};this.throttle=0;
        toast('船体损毁——应急系统已将你弹射至轨道',4);
      }
    }
    if(k['KeyG']&&!this._gLock){this._gLock=true;this.gear=!this.gear;AudioSys.ev('gear');toast(this.gear?'起落架放下':'起落架收起')}
    if(!k['KeyG'])this._gLock=false;
    /* 起落架动画 */
    const g=this.model.userData.groups;
    const t=this.gear?0:1;
    for(const nm of['gear_n','gear_l','gear_r']){
      if(g[nm])g[nm].rotation.x=damp(g[nm].rotation.x,t*-1.5,6,dt);
    }
    /* 引擎光斑 */
    const gl=clamp(Math.abs(this.throttle)+(this.boost?0.4:0)+(this.od?0.8:0),0.06,2);
    for(const e of this.glows){e.sp.scale.setScalar(e.s*(0.4+gl*1.5)*(0.92+Math.random()*0.16));e.sp.material.opacity=0.25+0.6*clamp(gl,0,1)}
  },
  syncModel(){
    W2R(this.pos.x,this.pos.y,this.pos.z,this.model.position);
    this.model.quaternion.copy(this.quat);
  }
};

/* ---------- 漫游车 ---------- */
function padLift(pl,x,y,z){
  if(Planets.cityPid===pl.id&&pl._padTopH){
    const pw=cityPadWorld(pl);
    const dx=pw.x-x,dy=pw.y-y,dz=pw.z-z;
    if(dx*dx+dy*dy+dz*dz<16.2*16.2)return pl._padTopH;
  }
  return 0;
}
const Rover={
  deployed:false,pos:{x:0,y:0,z:0},vel:0,yaw:0,model:null,up:new THREE.Vector3(0,1,0),
  camYaw:0,camPitch:0.18,
  frame:{east:new THREE.Vector3(),north:new THREE.Vector3()},quat:new THREE.Quaternion(),wheelSpin:0,
  init(scene){this.model=buildModel(DEFS.rover());this.model.visible=false;scene.add(this.model)},
  deployAt(px,py,pz){
    const pl=Planets.current;if(!pl)return;
    _v1.set(px-pl.x,py-pl.y,pz-pl.z).normalize();
    const gr=pl.radius+terrainH(pl,_v1.x,_v1.y,_v1.z)+padLift(pl,px,py,pz);
    this.pos={x:pl.x+_v1.x*gr,y:pl.y+_v1.y*gr,z:pl.z+_v1.z*gr};
    this.vel=0;this.deployed=true;this.model.visible=true;
    this.yaw=Player.yaw;
    toast('漫游车已部署 (F 上车)');
  },
  stow(){this.deployed=false;this.model.visible=false},
  update(dt,driving){
    if(!this.deployed)return;
    const pl=Planets.current;if(!pl)return;
    _v1.set(this.pos.x-pl.x,this.pos.y-pl.y,this.pos.z-pl.z).normalize();
    this.up.copy(_v1);
    tangentFrame(this.up,this.frame);
    if(driving){
      const k=Input.keys;
      /* 驾驶时鼠标控制环视镜头（不转车身，车身用A/D） */
      this.camYaw+=Input.mdx*0.0022;
      this.camPitch=clamp(this.camPitch-Input.mdy*0.0022,-0.25,1.2);
      const fwdIn=(k['KeyW']?1:0)-(k['KeyS']?1:0);
      const steer=(k['KeyD']?1:0)-(k['KeyA']?1:0);
      const maxV=k['ShiftLeft']?26:15;
      this.vel=damp(this.vel,fwdIn*maxV,fwdIn?1.6:2.8,dt);
      if(k['Space'])this.vel=damp(this.vel,0,6,dt);
      this.yaw+=steer*dt*(1.7*clamp(Math.abs(this.vel)/8,0.15,1))*Math.sign(this.vel||1);
      AudioSys.set('rover',{on:true,rpm:Math.abs(this.vel)/26});
    }else{
      AudioSys.set('rover',{on:false});
      /* 无人驾驶时必须刹车：曾因残速不衰减导致下车后漫游车自己开走，F/V 全部超距失效（玩家感觉"卡住"） */
      this.vel=damp(this.vel,0,6,dt);
      if(Math.abs(this.vel)<0.05)this.vel=0;
    }
    const dir=_v2.copy(this.frame.east).multiplyScalar(Math.sin(this.yaw)).addScaledVector(this.frame.north,Math.cos(this.yaw));
    this.pos.x+=dir.x*this.vel*dt;this.pos.y+=dir.y*this.vel*dt;this.pos.z+=dir.z*this.vel*dt;
    Colliders.resolve(this.pos,1.7,pl);
    _v1.set(this.pos.x-pl.x,this.pos.y-pl.y,this.pos.z-pl.z).normalize();
    const gr=pl.radius+terrainH(pl,_v1.x,_v1.y,_v1.z)+padLift(pl,this.pos.x,this.pos.y,this.pos.z);
    this.pos.x=pl.x+_v1.x*gr;this.pos.y=pl.y+_v1.y*gr;this.pos.z=pl.z+_v1.z*gr;
    /* 姿态: 采样前后地形 */
    const e=2.2;
    const pF={x:this.pos.x+dir.x*e,y:this.pos.y+dir.y*e,z:this.pos.z+dir.z*e};
    _v3.set(pF.x-pl.x,pF.y-pl.y,pF.z-pl.z).normalize();
    const hF=pl.radius+terrainH(pl,_v3.x,_v3.y,_v3.z);
    const pitch=Math.atan2(hF-gr,e);
    /* 车身朝向直接由行驶方向构建：X=up×fwd, Y=up, Z=fwd（+Z=车头，右手系）。
       旧实现 setFromUnitVectors 输运基 + 切向系 yaw 混用，车头与行驶方向差一个随位置变化的角度（斜着开） */
    _v4.copy(dir).addScaledVector(_v1,-dir.dot(_v1)).normalize();
    _v3.crossVectors(_v1,_v4).normalize();
    _m4.makeBasis(_v3,_v1,_v4);
    const q=new THREE.Quaternion().setFromRotationMatrix(_m4);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(AXIS_X,-pitch));
    this.quat.slerp(q,1-Math.exp(-8*dt));
    this.wheelSpin+=this.vel*dt/0.42;
    const g=this.model.userData.groups;
    for(const nm in g)g[nm].rotation.x=this.wheelSpin;
    this.model.quaternion.copy(this.quat);
    W2R(this.pos.x,this.pos.y,this.pos.z,this.model.position);
  }
};

/* ---------- 步行 ---------- */
const Player={
  pos:{x:0,y:0,z:0},vy:0,yaw:0,pitch:0,up:new THREE.Vector3(0,1,0),
  /* CS 式 FPS：身体朝向存持久四元数（本地Y=up、-Z=面朝向），随行星 up 平行输运；
     鼠标X=绕本地up偏航、鼠标Y=独立俯仰(±89°钳制)。不再从全局Y重建切向系推 yaw——
     那套在星球不同位置会产生基底旋转/跳变（玩家报"鼠标转动不对/乱窜"的根源） */
  quat:new THREE.Quaternion(),
  frame:{east:new THREE.Vector3(),north:new THREE.Vector3()},
  _pv1:new THREE.Vector3(),_pv2:new THREE.Vector3(),_pv3:new THREE.Vector3(),_pq:new THREE.Quaternion(),
  gun:null,bobT:0,stepT:0,
  init(camera){
    this.gun=buildModel(DEFS.gun());
    this.gun.position.set(0.22,-0.2,-0.45);
    this.gun.rotation.y=Math.PI;
    camera.add(this.gun);
    this.gun.visible=false;
    Weapons.initGun(this.gun,camera);
  },
  /* 模式切换时设定站姿：up + 面朝方向 → bodyQuat（俯仰归零） */
  setHeading(upV,fwdV){
    this.up.copy(upV);
    this._pv1.copy(fwdV).addScaledVector(this.up,-fwdV.dot(this.up));
    if(this._pv1.lengthSq()<1e-8)this._pv1.set(1,0,0).addScaledVector(this.up,-this.up.x);
    this._pv1.normalize();
    this._pv3.copy(this._pv1).negate();                    /* Z = -fwd */
    this._pv2.crossVectors(this.up,this._pv3).normalize(); /* X = up×Z */
    _m4.makeBasis(this._pv2,this.up,this._pv3);
    this.quat.setFromRotationMatrix(_m4);
    this.pitch=0;
    tangentFrame(this.up,this.frame);
    this.yaw=Math.atan2(this._pv1.dot(this.frame.east),this._pv1.dot(this.frame.north));
  },
  update(dt){
    const pl=Planets.current;if(!pl)return;
    const k=Input.keys;
    /* 平行输运：身体姿态最小旋转对齐新 up（绕两者叉积轴），航向绝不漂移 */
    this._pv1.set(this.pos.x-pl.x,this.pos.y-pl.y,this.pos.z-pl.z).normalize();
    this._pv2.set(0,1,0).applyQuaternion(this.quat);
    this._pq.setFromUnitVectors(this._pv2,this._pv1);
    this.quat.premultiply(this._pq).normalize();
    this.up.copy(this._pv1);
    /* CS 手感：偏航直接转身体，俯仰独立钳制，无滚转无回弹 */
    if(Input.mdx){
      this._pq.setFromAxisAngle(this.up,-Input.mdx*0.0022);
      this.quat.premultiply(this._pq).normalize();
    }
    this.pitch=clamp(this.pitch-Input.mdy*0.0022,-1.55,1.55);
    /* 派生量：小地图/部署漫游车仍消费 frame+yaw */
    tangentFrame(this.up,this.frame);
    const fwd=this._pv2.set(0,0,-1).applyQuaternion(this.quat);
    this.yaw=Math.atan2(fwd.dot(this.frame.east),fwd.dot(this.frame.north));
    const right=this._pv3.set(1,0,0).applyQuaternion(this.quat);
    const mv=_v4.set(0,0,0);
    if(k['KeyW'])mv.add(fwd);if(k['KeyS'])mv.sub(fwd);
    if(k['KeyD'])mv.add(right);if(k['KeyA'])mv.sub(right);
    const run=k['ShiftLeft']?2.1:1;
    if(mv.lengthSq()>0){
      mv.normalize().multiplyScalar(5.2*run);
      this.bobT+=dt*(run>1?11:7.5);
      this.stepT-=dt;
      if(this.stepT<=0){this.stepT=run>1?0.31:0.46;AudioSys.ev('step')}
    }
    this.pos.x+=mv.x*dt;this.pos.y+=mv.y*dt;this.pos.z+=mv.z*dt;
    Colliders.resolve(this.pos,0.55,pl);
    _v1.set(this.pos.x-pl.x,this.pos.y-pl.y,this.pos.z-pl.z);
    const d=_v1.length();_v1.normalize();
    let gr=pl.radius+terrainH(pl,_v1.x,_v1.y,_v1.z)+padLift(pl,this.pos.x,this.pos.y,this.pos.z);
    const h=d-gr;
    this.vy-=pl.grav*dt;
    if(k['Space']&&h<0.25){this.vy=5.2;AudioSys.ev('jump')}
    let nd=d+this.vy*dt;
    if(nd<gr){nd=gr;this.vy=0}
    this.pos.x=pl.x+_v1.x*nd;this.pos.y=pl.y+_v1.y*nd;this.pos.z=pl.z+_v1.z*nd;
  },
  eyeWorld(out){
    const bob=Math.sin(this.bobT)*0.045;
    out.x=this.pos.x+this.up.x*(1.62+bob);
    out.y=this.pos.y+this.up.y*(1.62+bob);
    out.z=this.pos.z+this.up.z*(1.62+bob);
    return out;
  },
  lookQuat(){
    /* 相机朝向 = 身体四元数 × 俯仰。全程无 lookAt、无基底重建，任何位置手感一致 */
    _q2.setFromAxisAngle(AXIS_X,this.pitch);
    return _qL.copy(this.quat).multiply(_q2);
  }
};

/* ---------- 特效 ---------- */
const FX={
  init(scene,camera){
    this.scene=scene;this.camera=camera;
    const n=150;
    const pos=new Float32Array(n*2*3),col=new Float32Array(n*2*3);
    this.streakDat=[];
    for(let i=0;i<n;i++){
      this.streakDat.push({x:(Math.random()-0.5)*160,y:(Math.random()-0.5)*160,z:Math.random()*300-100});
      col.set([0.5,0.7,1, 0.05,0.08,0.15],i*6);
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.BufferAttribute(pos,3));
    g.setAttribute('color',new THREE.BufferAttribute(col,3));
    this.streaks=new THREE.LineSegments(g,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
    this.streaks.frustumCulled=false;scene.add(this.streaks);
    this.tracers=[];
    for(let i=0;i<10;i++){
      const tg=new THREE.BufferGeometry();
      tg.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));
      const ln=new THREE.Line(tg,new THREE.LineBasicMaterial({color:0x7af0ff,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));
      ln.frustumCulled=false;scene.add(ln);this.tracers.push({ln,ttl:0});
    }
    const sn=80;
    this.sparkDat=[];
    const sp=new Float32Array(sn*3);
    for(let i=0;i<sn;i++)this.sparkDat.push({ttl:0,vx:0,vy:0,vz:0,x:0,y:0,z:0});
    const sg=new THREE.BufferGeometry();
    sg.setAttribute('position',new THREE.BufferAttribute(sp,3));
    this.sparks=new THREE.Points(sg,new THREE.PointsMaterial({color:0xffb060,size:0.24,transparent:true,opacity:0.95,blending:THREE.AdditiveBlending,depthWrite:false,sizeAttenuation:true}));
    this.sparks.frustumCulled=false;scene.add(this.sparks);
  },
  tracer(a,b){
    for(const t of this.tracers){if(t.ttl<=0){
      const p=t.ln.geometry.attributes.position;
      p.setXYZ(0,a.x,a.y,a.z);p.setXYZ(1,b.x,b.y,b.z);p.needsUpdate=true;
      t.ttl=0.07;t.ln.material.opacity=0.95;return;
    }}
  },
  burst(wx,wy,wz,n){
    let c=0;
    for(const s of this.sparkDat){
      if(s.ttl<=0&&c<n){
        s.ttl=0.4+Math.random()*0.3;
        s.x=wx;s.y=wy;s.z=wz;
        s.vx=(Math.random()-0.5)*9;s.vy=(Math.random())*8;s.vz=(Math.random()-0.5)*9;
        c++;
      }
    }
  },
  update(dt,speedFactor,vel){
    const m=this.streaks.material;
    m.opacity=damp(m.opacity,speedFactor>0.12?clamp(speedFactor,0,1)*0.85:0,6,dt);
    if(m.opacity>0.02){
      const p=this.streaks.geometry.attributes.position;
      const cam=this.camera;
      const vl=_v1.set(vel.x,vel.y,vel.z);
      const sp=vl.length();
      const dir=sp>1?vl.multiplyScalar(1/sp):_v1.set(0,0,-1).applyQuaternion(cam.quaternion);
      const L=clamp(sp*0.012,2,90);
      let i=0;
      for(const s of this.streakDat){
        _v2.set(s.x,s.y,s.z).applyQuaternion(cam.quaternion).add(cam.position);
        p.setXYZ(i*2,_v2.x,_v2.y,_v2.z);
        p.setXYZ(i*2+1,_v2.x-dir.x*L,_v2.y-dir.y*L,_v2.z-dir.z*L);
        s.z-=sp*dt*0.9;
        if(s.z<-140){s.z=160+Math.random()*120;s.x=(Math.random()-0.5)*200;s.y=(Math.random()-0.5)*200}
        i++;
      }
      p.needsUpdate=true;
    }
    for(const t of this.tracers){
      if(t.ttl>0){t.ttl-=dt;t.ln.material.opacity=Math.max(0,t.ttl/0.07)}
      else t.ln.material.opacity=0;
    }
    const sp2=this.sparks.geometry.attributes.position;
    let i2=0;
    for(const s of this.sparkDat){
      if(s.ttl>0){
        s.ttl-=dt;s.vy-=9*dt;
        s.x+=s.vx*dt;s.y+=s.vy*dt;s.z+=s.vz*dt;
        sp2.setXYZ(i2,s.x-ORIGIN.x,s.y-ORIGIN.y,s.z-ORIGIN.z);
      }else sp2.setXYZ(i2,0,-99999,0);
      i2++;
    }
    sp2.needsUpdate=true;
  }
};

/* ---------- 野兽遭遇战（绝对量化格出生 + 巡游/追击/近战状态机） ---------- */
const BEAST_DENSITY={toxic:1.0,lava:1.0,rock:0.8,desert:0.5,tundra:0.5,ice:0.5,temperate:0.25,forest:0.3,ocean:0.2,gas:0};
const BEAST_DROP={toxic:'uran',lava:'uran',rock:'iron',desert:'silver',tundra:'silver',ice:'diamond',temperate:'herb',forest:'herb',ocean:'herb'};
const Enemies={
  list:[],pool:[],MAX:8,_scanT:0,_pl:-1,_keys:new Set(),
  _e1:new THREE.Vector3(),_e2:new THREE.Vector3(),_e3:new THREE.Vector3(),_eq:new THREE.Quaternion(),_em:new THREE.Matrix4(),
  _frame:{east:new THREE.Vector3(),north:new THREE.Vector3()},
  init(scene){this.scene=scene},
  _model(){
    let m=this.pool.pop();
    if(!m){m=buildModel(DEFS.beast());this.scene.add(m)}
    m.visible=true;return m;
  },
  _free(en,respawnable){
    en.model.visible=false;this.pool.push(en.model);
    if(respawnable)this._keys.delete(en.key);
  },
  clearAll(){for(const en of this.list)this._free(en,true);this.list=[]},
  _scan(pl){
    if(this.list.length>=this.MAX)return;
    const dens=BEAST_DENSITY[pl.type]||0;if(dens<=0)return;
    const cell=90,K=pl.radius/cell;
    this._e1.set(Player.pos.x-pl.x,Player.pos.y-pl.y,Player.pos.z-pl.z).normalize();
    tangentFrame(this._e1,this._frame);
    const sea=pl.td.sea?pl.td.sea.h:0;
    for(let cy=-3;cy<=3;cy++)for(let cx=-3;cx<=3;cx++){
      if(this.list.length>=this.MAX)return;
      this._e2.copy(this._e1).multiplyScalar(pl.radius).addScaledVector(this._frame.east,cx*cell).addScaledVector(this._frame.north,cy*cell).normalize();
      const ix=Math.round(this._e2.x*K),iy=Math.round(this._e2.y*K),iz=Math.round(this._e2.z*K);
      const key=ix+','+iy+','+iz;
      if(this._keys.has(key))continue;
      const rng=mulberry32(hash3i(ix,iy,iz)^pl.seed^0xBEA57);
      if(rng()>dens*0.22){this._keys.add(key);continue}
      this._e2.set(ix/K,iy/K,iz/K).normalize();
      const f2={east:this._e3,north:new THREE.Vector3()};
      tangentFrame(this._e2,f2);
      const d=new THREE.Vector3().copy(this._e2).multiplyScalar(pl.radius)
        .addScaledVector(f2.east,(rng()-0.5)*60).addScaledVector(f2.north,(rng()-0.5)*60).normalize();
      const h=terrainH(pl,d.x,d.y,d.z);
      if(h<sea+1){this._keys.add(key);continue}
      if(pl.city&&pl.cityDir){
        const arc=Math.acos(clamp(d.dot(pl.cityDir),-1,1))*pl.radius;
        if(arc<380){this._keys.add(key);continue}
      }
      /* 距离玩家 30m 内不出生（防脸上刷怪） */
      const w={x:pl.x+d.x*(pl.radius+h),y:pl.y+d.y*(pl.radius+h),z:pl.z+d.z*(pl.radius+h)};
      if(Math.hypot(w.x-Player.pos.x,w.y-Player.pos.y,w.z-Player.pos.z)<30)continue;
      this._keys.add(key);
      const scl=1+rng()*0.6;
      const en={model:this._model(),pos:w,home:{x:w.x,y:w.y,z:w.z},key,
        hp:30+rng()*20,scl,state:'idle',t:0,wander:rng()*Math.PI*2,atkT:0,
        face:new THREE.Vector3().copy(f2.east),up:new THREE.Vector3().copy(d),bobT:rng()*7};
      en.model.scale.setScalar(scl);
      this.list.push(en);
    }
  },
  _stepDir(pl,en,dx,dy,dz,dist){
    const l=Math.sqrt(dx*dx+dy*dy+dz*dz)||1;
    en.pos.x+=dx/l*dist;en.pos.y+=dy/l*dist;en.pos.z+=dz/l*dist;
    en.face.set(dx/l,dy/l,dz/l);
    en.moving=true;
  },
  _ground(pl,en,dt){
    this._e1.set(en.pos.x-pl.x,en.pos.y-pl.y,en.pos.z-pl.z).normalize();
    en.up.copy(this._e1);
    const gr=pl.radius+terrainH(pl,this._e1.x,this._e1.y,this._e1.z);
    en.pos.x=pl.x+this._e1.x*gr;en.pos.y=pl.y+this._e1.y*gr;en.pos.z=pl.z+this._e1.z*gr;
    Colliders.resolve(en.pos,0.9,pl);
    /* 姿态：X=up×fwd Y=up Z=fwd（+Z=头） */
    this._e2.copy(en.face).addScaledVector(en.up,-en.face.dot(en.up));
    if(this._e2.lengthSq()<1e-8)this._e2.copy(this._frame.east);
    this._e2.normalize();
    this._e3.crossVectors(en.up,this._e2).normalize();
    this._em.makeBasis(this._e3,en.up,this._e2);
    this._eq.setFromRotationMatrix(this._em);
    en.model.quaternion.slerp(this._eq,1-Math.exp(-10*dt));
    en.bobT+=dt*(en.moving?9:2);
    W2R(en.pos.x,en.pos.y,en.pos.z,en.model.position);
    en.model.position.addScaledVector(en.up,Math.sin(en.bobT)*(en.moving?0.07:0.02));
    en.moving=false;
  },
  update(dt){
    const pl=Planets.current;
    if(!pl||(Game.mode!=='foot'&&Game.mode!=='rover')||pl.type==='gas'){
      if(this.list.length)this.clearAll();
      return;
    }
    if(this._pl!==pl.id){this.clearAll();this._keys.clear();this._pl=pl.id}
    this._scanT-=dt;
    if(this._scanT<=0){this._scanT=0.7;this._scan(pl)}
    const px=Player.pos.x,py=Player.pos.y,pz=Player.pos.z;
    for(let i=this.list.length-1;i>=0;i--){
      const en=this.list[i];
      const dx=px-en.pos.x,dy=py-en.pos.y,dz=pz-en.pos.z;
      const dP=Math.sqrt(dx*dx+dy*dy+dz*dz);
      if(dP>400){this._free(en,true);this.list.splice(i,1);continue}
      if(en.state==='dead'){
        en.t-=dt;
        en.model.scale.setScalar(Math.max(0.001,en.t)*en.scl);
        if(en.t<=0){this._free(en,false);this.list.splice(i,1)}
        else this._ground(pl,en,dt);
        continue;
      }
      en.atkT-=dt;
      const onFoot=Game.mode==='foot';
      if(en.state==='idle'){
        if(onFoot&&dP<25){en.state='chase';AudioSys.ev('growl')}
        else{
          en.t-=dt;
          if(en.t<=0){en.t=3+Math.random()*3;en.wander=Math.random()*Math.PI*2}
          this._e1.set(en.pos.x-pl.x,en.pos.y-pl.y,en.pos.z-pl.z).normalize();
          tangentFrame(this._e1,this._frame);
          const wx=this._frame.east.x*Math.sin(en.wander)+this._frame.north.x*Math.cos(en.wander);
          const wy=this._frame.east.y*Math.sin(en.wander)+this._frame.north.y*Math.cos(en.wander);
          const wz=this._frame.east.z*Math.sin(en.wander)+this._frame.north.z*Math.cos(en.wander);
          this._stepDir(pl,en,wx,wy,wz,1.2*dt);
        }
      }else if(en.state==='chase'){
        if(!onFoot||dP>60)en.state='return';
        else if(dP<1.8){
          en.face.set(dx,dy,dz).normalize();en.moving=true;
          if(en.atkT<=0){
            en.atkT=1.2;
            Game.hp-=10+Math.random()*8;
            Game.dmgFlash=1;Game.shake=Math.min(1,Game.shake+0.5);
            AudioSys.ev('hurt');
            if(Game.hp<=0){this.respawn();return}
          }
        }else this._stepDir(pl,en,dx,dy,dz,8.8*dt);
      }else if(en.state==='return'){
        const hx=en.home.x-en.pos.x,hy=en.home.y-en.pos.y,hz=en.home.z-en.pos.z;
        const hd=Math.sqrt(hx*hx+hy*hy+hz*hz);
        if(onFoot&&dP<20){en.state='chase';AudioSys.ev('growl')}
        else if(hd<2)en.state='idle';
        else this._stepDir(pl,en,hx,hy,hz,1.8*dt);
      }
      this._ground(pl,en,dt);
    }
  },
  respawn(){
    const b=Ship.basis();
    Player.pos={x:Ship.pos.x+b.r.x*4.2,y:Ship.pos.y+b.r.y*4.2,z:Ship.pos.z+b.r.z*4.2};
    const pl=Planets.current;
    if(pl){
      this._e2.set(Player.pos.x-pl.x,Player.pos.y-pl.y,Player.pos.z-pl.z).normalize();
      const gr=pl.radius+terrainH(pl,this._e2.x,this._e2.y,this._e2.z)+padLift(pl,Player.pos.x,Player.pos.y,Player.pos.z);
      Player.pos={x:pl.x+this._e2.x*gr,y:pl.y+this._e2.y*gr,z:pl.z+this._e2.z*gr};
      Player.setHeading(this._e2,b.f);
    }
    Game.mode='foot';Game.hp=Game.hpMax;
    Game.credits=Math.floor(Game.credits*0.9);
    Game.tp=1;Game.dmgFlash=1;AudioSys.ev('teleport');
    this.clearAll();
    toast('你被击倒了——已传送回飞船旁（信用点 -10%）',4);
  },
  hitTest(eye,dir,maxD){
    let best=null,bd=maxD;
    for(const en of this.list){
      if(en.state==='dead')continue;
      const cx=en.pos.x+en.up.x*en.scl-eye.x,cy=en.pos.y+en.up.y*en.scl-eye.y,cz=en.pos.z+en.up.z*en.scl-eye.z;
      const t=cx*dir.x+cy*dir.y+cz*dir.z;
      if(t<1||t>bd)continue;
      const qx=cx-dir.x*t,qy=cy-dir.y*t,qz=cz-dir.z*t;
      if(Math.sqrt(qx*qx+qy*qy+qz*qz)<1.1*en.scl){bd=t;best=en}
    }
    return best?{en:best,dist:bd}:null;
  },
  damage(en,amt){
    if(en.state==='dead')return;
    en.hp-=amt;
    Game.hitFlash=1;
    FX.burst(en.pos.x+en.up.x,en.pos.y+en.up.y,en.pos.z+en.up.z,6);
    AudioSys.ev('hit');
    if(en.state==='idle')en.state='chase';
    if(en.hp<=0){
      en.state='dead';en.t=1;
      const cr=15+((Math.random()*25)|0);
      Game.credits+=cr;
      let drop='';
      const pl=Planets.current;
      if(pl&&Math.random()<0.35){
        const key=BEAST_DROP[pl.type]||'iron';
        const n=1+((Math.random()*2)|0);
        Game.res[key]=(Game.res[key]||0)+n;
        drop='，掉落 '+RES_DEF[key].name+' ×'+n;
      }
      toast('击杀野兽 +'+cr+' 信用点'+drop);
      AudioSys.ev('beastDie');
    }
  }
};

/* ---------- 武器/采矿 ---------- */
const Weapons={
  cd:0,mag:999,magSize:999,reloadT:0,recoil:0,flashT:0,bolts:[],gun:null,
  RELOAD_T:1.25,BOLT_SPD:240,
  shotDmg(){return 10*(1+0.25*Game.up.dmg)},
  initGun(gun,camera){
    this.gun=gun;
    /* 枪口火光（挂在枪上） */
    this.flash=new THREE.Sprite(new THREE.SpriteMaterial({map:Tex.glow('muzzle','#ffd9a0'),transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));
    this.flash.position.set(0,0.045,0.64);
    this.flash.scale.setScalar(0.22);
    gun.add(this.flash);
    /* 点光源必须挂常显节点(相机)：若挂在随模式隐藏的枪上，灯光数量变化会
       触发 three.js 全场景着色器重编译 → 上下船/部署漫游车时整帧卡死 */
    this.light=new THREE.PointLight(0xffc080,0,9,2);
    this.light.position.set(0.2,-0.15,-1.1);
    camera.add(this.light);
  },
  initBolts(scene){
    for(let i=0;i<10;i++){
      const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:Tex.glow('bolt','#9fe8ff'),transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));
      sp.scale.setScalar(0.5);
      scene.add(sp);
      this.bolts.push({sp,on:false,x:0,y:0,z:0,dx:0,dy:0,dz:0,left:0,hit:null,ground:false});
    }
  },
  startReload(){
    if(this.reloadT>0||this.mag>=this.magSize||Game.mode!=='foot')return;
    this.reloadT=this.RELOAD_T;
    AudioSys.ev('reload');
  },
  fireFoot(){
    this.cd=0.17*Math.pow(0.88,Game.up.rof);this.mag--;
    this.recoil=1;this.flashT=0.06;
    this.flash.material.rotation=Math.random()*6.28;
    this.flash.scale.setScalar(0.16+Math.random()*0.14);
    AudioSys.ev('shot');Game.shake=Math.min(0.5,Game.shake+0.1);
    const q=Player.lookQuat();
    const dir=_v1.set(0,0,1).applyQuaternion(q).negate();
    const eye={};Player.eyeWorld(eye);
    /* 命中判定（瞬时），弹丸只做可视化飞行，抵达后结算。野兽优先于矿物 */
    let hit=null,hd=60,beast=null;
    const bh=Enemies.hitTest(eye,dir,60);
    if(bh){hd=bh.dist;beast=bh.en}
    for(const mn of Planets.mineables){
      if(mn.dead)continue;
      _v2.set(mn.world.x-eye.x,mn.world.y-eye.y,mn.world.z-eye.z);
      const t=_v2.dot(dir);
      if(t<1||t>hd)continue;
      const perp=_v2.addScaledVector(dir,-t).length();
      if(perp<mn.r*0.9){hd=t;hit=mn}
    }
    if(hit)beast=null;
    /* 未命中时检测地面，好让弹丸落点有尘土反馈 */
    let ground=false;
    if(!hit&&!beast){
      const pl=Planets.current;
      if(pl){
        for(let s=6;s<=60;s+=6){
          const px=eye.x+dir.x*s,py=eye.y+dir.y*s,pz=eye.z+dir.z*s;
          _v3.set(px-pl.x,py-pl.y,pz-pl.z);
          const d=_v3.length();_v3.normalize();
          if(d<pl.radius+terrainH(pl,_v3.x,_v3.y,_v3.z)){hd=s;ground=true;break}
        }
      }
    }
    /* 弹丸从枪口世界位置射出 */
    let mx=eye.x+dir.x*0.9,my=eye.y+dir.y*0.9-0.14,mz=eye.z+dir.z*0.9;
    if(this.flash){
      this.flash.getWorldPosition(_v4);
      mx=_v4.x+ORIGIN.x;my=_v4.y+ORIGIN.y;mz=_v4.z+ORIGIN.z;
    }
    const ex=eye.x+dir.x*hd,ey=eye.y+dir.y*hd,ez=eye.z+dir.z*hd;
    _v2.set(ex-mx,ey-my,ez-mz);
    const dist=_v2.length();_v2.normalize();
    for(const b of this.bolts){
      if(b.on)continue;
      b.on=true;b.x=mx;b.y=my;b.z=mz;
      b.dx=_v2.x;b.dy=_v2.y;b.dz=_v2.z;
      b.left=dist;b.hit=hit;b.ground=ground;b.beast=beast;
      b.sp.material.opacity=0.95;
      break;
    }
  },
  _impact(b){
    if(b.beast){
      Enemies.damage(b.beast,this.shotDmg());
    }else if(b.hit&&!b.hit.dead){
      const hit=b.hit;
      Game.hitFlash=1;FX.burst(b.x,b.y,b.z,10);AudioSys.ev('hit');
      hit.hp--;
      if(hit.hp<=0){
        Planets.destroyMine(hit);
        const key=hit.res||'iron',rd=RES_DEF[key];
        const cnt=hit.yield+Game.up.mine;
        Game.res[key]=(Game.res[key]||0)+cnt;
        const gain=rd.val*cnt+((Math.random()*4)|0);
        Game.credits+=gain;
        toast('获得 '+rd.name+' ×'+cnt+'  +'+gain+' 信用点');
        AudioSys.ev('mined');
      }
    }else if(b.ground){
      FX.burst(b.x,b.y,b.z,5);
    }
  },
  update(dt,camera){
    this.cd-=dt;
    this.recoil=Math.max(0,this.recoil-dt*6.5);
    this.flashT=Math.max(0,this.flashT-dt);
    if(this.flash){
      this.flash.material.opacity=this.flashT>0?(this.flashT/0.06)*0.9:0;
      this.light.intensity=this.flashT>0?2.4:0;
    }
    /* 弹丸飞行 + 拖尾轨迹 */
    for(const b of this.bolts){
      if(!b.on)continue;
      const adv=Math.min(this.BOLT_SPD*dt,b.left);
      const px=b.x,py=b.y,pz=b.z;
      b.x+=b.dx*adv;b.y+=b.dy*adv;b.z+=b.dz*adv;
      b.left-=adv;
      FX.tracer(
        {x:px-ORIGIN.x-b.dx*1.4,y:py-ORIGIN.y-b.dy*1.4,z:pz-ORIGIN.z-b.dz*1.4},
        {x:b.x-ORIGIN.x,y:b.y-ORIGIN.y,z:b.z-ORIGIN.z});
      b.sp.position.set(b.x-ORIGIN.x,b.y-ORIGIN.y,b.z-ORIGIN.z);
      if(b.left<=0.001){b.on=false;b.sp.material.opacity=0;this._impact(b)}
    }
    /* 枪械动画：后坐 + 滑套 + 换弹（弹匣抽出→复位） */
    if(this.gun&&Game.mode==='foot'){
      const g=this.gun.userData.groups;
      let tilt=0;
      if(this.reloadT>0){
        this.reloadT-=dt;
        const t=this.RELOAD_T-this.reloadT;
        let mo;
        if(t<0.35)mo=t/0.35;
        else if(t<0.9)mo=1;
        else mo=Math.max(0,1-(t-0.9)/0.35);
        if(g&&g.mag){g.mag.position.y=-0.02-mo*0.32;g.mag.rotation.x=-mo*0.75}
        tilt=mo;
        if(this.reloadT<=0){
          this.mag=this.magSize;
          if(g&&g.mag){g.mag.position.y=-0.02;g.mag.rotation.x=0}
          AudioSys.ev('reloadDone');
        }
      }
      if(g&&g.slide)g.slide.position.z=-this.recoil*0.075;
      const bob=Math.sin(Player.bobT)*0.006;
      this.gun.position.set(0.22,-0.2-tilt*0.07+bob,-0.45+this.recoil*0.07);
      this.gun.rotation.set(this.recoil*0.15-tilt*0.5,Math.PI,0);
    }
    if(!Input.mdown||this.cd>0)return;
    if(Game.mode==='foot'){
      if(this.reloadT>0)return;
      if(this.mag<=0){this.cd=0.3;AudioSys.ev('empty');this.startReload();return}
      this.fireFoot();
    }
  }
};

/* ---------- 迁跃 / 传送 ---------- */
const Travel={
  target:null,
  setTarget(pl){this.target=pl;toast('目标: '+pl.name+' ('+pl.type+')')},
  warp(){
    if(Game.warp)return;
    if(!this.target){toast('先在星图(M)中选择目标');return}
    if(Game.mode!=='ship'&&Game.mode!=='landed'){toast('需要在飞船上才能迁跃');return}
    const t=this.target;
    const dx=t.x-Ship.pos.x,dy=t.y-Ship.pos.y,dz=t.z-Ship.pos.z;
    const dist=Math.sqrt(dx*dx+dy*dy+dz*dz);
    if(dist<t.radius*8){toast('目标就在附近');return}
    if(Game.mode==='landed'){Ship.landed=false;Game.mode='ship';
      const pl=Planets.current;
      if(pl){_v1.set(Ship.pos.x-pl.x,Ship.pos.y-pl.y,Ship.pos.z-pl.z).normalize();
        Ship.pos.x+=_v1.x*30;Ship.pos.y+=_v1.y*30;Ship.pos.z+=_v1.z*30}
    }
    const from={x:Ship.pos.x,y:Ship.pos.y,z:Ship.pos.z};
    const nd={x:dx/dist,y:dy/dist,z:dz/dist};
    const to={x:t.x-nd.x*t.radius*4.5,y:t.y-nd.y*t.radius*4.5,z:t.z-nd.z*t.radius*4.5};
    Game.warp={t:0,dur:3.2,from,to,charge:1.1,target:t};
    Ship.quat.setFromUnitVectors(AXIS_Z,_v1.set(nd.x,nd.y,nd.z));
    AudioSys.ev('warpCharge');
    toast('迁跃引擎充能中 → '+t.name);
  },
  teleport(){
    if(Game.warp)return;
    if(Game.mode==='foot'||Game.mode==='rover'){
      /* 步行/驾车时: 召回至飞船旁 */
      const b=Ship.basis();
      const side=_v2.copy(b.r).multiplyScalar(4.2);
      Player.pos={x:Ship.pos.x+side.x,y:Ship.pos.y+side.y,z:Ship.pos.z+side.z};
      const pl=Planets.current;
      if(pl){
        _v1.set(Player.pos.x-pl.x,Player.pos.y-pl.y,Player.pos.z-pl.z).normalize();
        const gr=pl.radius+terrainH(pl,_v1.x,_v1.y,_v1.z);
        Player.pos={x:pl.x+_v1.x*gr,y:pl.y+_v1.y*gr,z:pl.z+_v1.z*gr};
        Player.setHeading(_v1,b.f);
      }
      Game.mode='foot';Game.tp=1;AudioSys.ev('teleport');
      toast('已传送回飞船旁');
      return;
    }
    if(!this.target){toast('先在星图(M)中选择目标');return}
    const t=this.target;
    let to;
    if(t.city){
      const pw=cityPadWorld(t);
      _v1.set(pw.x-t.x,pw.y-t.y,pw.z-t.z).normalize();
      to={x:t.x+_v1.x*(t.radius+t.atmo*0.8),y:t.y+_v1.y*(t.radius+t.atmo*0.8),z:t.z+_v1.z*(t.radius+t.atmo*0.8)};
    }else{
      const dx=Ship.pos.x-t.x,dy=Ship.pos.y-t.y,dz=Ship.pos.z-t.z;
      const l=Math.sqrt(dx*dx+dy*dy+dz*dz)||1;
      to={x:t.x+dx/l*t.radius*3.5,y:t.y+dy/l*t.radius*3.5,z:t.z+dz/l*t.radius*3.5};
    }
    if(Game.mode==='landed'){Ship.landed=false;Game.mode='ship'}
    Ship.pos=to;Ship.vel={x:0,y:0,z:0};Ship.throttle=0;
    _v1.set(t.x-to.x,t.y-to.y,t.z-to.z).normalize();
    Ship.quat.setFromUnitVectors(AXIS_Z,_v1);
    Game.tp=1;AudioSys.ev('teleport');
    toast('已传送至 '+t.name+(t.city?' 轨道（正对殖民地）':' 轨道'));
  },
  update(dt){
    const w=Game.warp;if(!w)return;
    w.t+=dt;
    if(w.t<w.charge){Game.fovKick=damp(Game.fovKick,-8,4,dt);return}
    const p=(w.t-w.charge)/w.dur;
    if(p>=1){
      Ship.pos={x:w.to.x,y:w.to.y,z:w.to.z};
      Ship.vel={x:0,y:0,z:0};Ship.throttle=0.2;
      Game.warp=null;Game.fovKick=0;
      AudioSys.ev('warpExit');
      toast('抵达 '+w.target.name);
      return;
    }
    if(!w.started){w.started=true;AudioSys.ev('warpGo')}
    const e=p<0.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;
    Ship.pos.x=lerp(w.from.x,w.to.x,e);
    Ship.pos.y=lerp(w.from.y,w.to.y,e);
    Ship.pos.z=lerp(w.from.z,w.to.z,e);
    const sp=Math.sin(p*Math.PI);
    Ship.vel.x=(w.to.x-w.from.x)*0.001*sp;Ship.vel.y=(w.to.y-w.from.y)*0.001*sp;Ship.vel.z=(w.to.z-w.from.z)*0.001*sp;
    Game.fovKick=damp(Game.fovKick,22*sp,5,dt);
  }
};

/* ---------- 镜头 ---------- */
const Cam={
  pos:new THREE.Vector3(),lookTarget:new THREE.Vector3(),firstPerson:false,dist:14,
  shakeT:0,
  _t1:new THREE.Vector3(),_t2:new THREE.Vector3(),_t3:new THREE.Vector3(),
  /* ORIGIN重定位时渲染坐标整体跳变，平滑量必须同步平移，否则镜头会飞扑过去（超巡时表现为画面乱转） */
  onRebase(dx,dy,dz){
    this.pos.x-=dx;this.pos.y-=dy;this.pos.z-=dz;
    this.lookTarget.x-=dx;this.lookTarget.y-=dy;this.lookTarget.z-=dz;
    if(this._ls){this._ls.x-=dx;this._ls.y-=dy;this._ls.z-=dz}
  },
  update(dt,camera){
    Game.shake=Math.max(0,Game.shake-dt*2.2);
    this.shakeT+=dt*30;
    const shk=Game.shake;
    let targetFov=62;
    if(this.cockpit)this.cockpit.visible=false;
    if(Game.mode==='ship'||Game.mode==='landed'){
      const b=Ship.basis();
      /* 船体位移前馈：镜头平滑只处理姿态变化，不因高速产生千米级拖尾 */
      const sx=Ship.pos.x-ORIGIN.x,sy=Ship.pos.y-ORIGIN.y,sz=Ship.pos.z-ORIGIN.z;
      if(this._ls){
        const ddx=sx-this._ls.x,ddy=sy-this._ls.y,ddz=sz-this._ls.z;
        this.pos.x+=ddx;this.pos.y+=ddy;this.pos.z+=ddz;
        this.lookTarget.x+=ddx;this.lookTarget.y+=ddy;this.lookTarget.z+=ddz;
      }else this._ls=new THREE.Vector3();
      this._ls.set(sx,sy,sz);
      if(this.firstPerson){
        /* 座舱视角：隐藏船体外模型，显示座舱内饰 */
        const cock=this._t1.set(0,2.66,3.1).applyQuaternion(Ship.quat);
        const dpos=this._t2.set(Ship.pos.x-ORIGIN.x+cock.x,Ship.pos.y-ORIGIN.y+cock.y,Ship.pos.z-ORIGIN.z+cock.z);
        this.pos.x=damp(this.pos.x,dpos.x,12,dt);
        this.pos.y=damp(this.pos.y,dpos.y,12,dt);
        this.pos.z=damp(this.pos.z,dpos.z,12,dt);
        camera.position.copy(this.pos);
        const look=this._t3.set(Ship.pos.x-ORIGIN.x,Ship.pos.y-ORIGIN.y,Ship.pos.z-ORIGIN.z).addScaledVector(b.f,24);
        this.lookTarget.lerp(look,1-Math.exp(-14*dt));
        camera.up.copy(b.u);
        camera.lookAt(this.lookTarget);
        targetFov=78+clamp(Ship.speed/9000,0,1)*34+Game.fovKick;
        Ship.model.visible=false;Player.gun.visible=false;
        if(this.cockpit)this.cockpit.visible=true;
      }else{
        const back=this._t1.copy(b.f).multiplyScalar(-this.dist).addScaledVector(b.u,this.dist*0.31);
        const dpos=this._t2.set(Ship.pos.x-ORIGIN.x+back.x,Ship.pos.y-ORIGIN.y+back.y,Ship.pos.z-ORIGIN.z+back.z);
        const lam=Game.warp?20:6;
        this.pos.x=damp(this.pos.x,dpos.x,lam,dt);
        this.pos.y=damp(this.pos.y,dpos.y,lam,dt);
        this.pos.z=damp(this.pos.z,dpos.z,lam,dt);
        camera.position.copy(this.pos);
        const look=this._t3.set(Ship.pos.x-ORIGIN.x,Ship.pos.y-ORIGIN.y,Ship.pos.z-ORIGIN.z).addScaledVector(b.f,9);
        this.lookTarget.lerp(look,1-Math.exp(-10*dt));
        camera.up.copy(b.u);
        camera.lookAt(this.lookTarget);
        targetFov=62+clamp(Ship.speed/9000,0,1)*26+Game.fovKick;
        Ship.model.visible=true;Player.gun.visible=false;
      }
    }else if(Game.mode==='rover'){
      const up=Rover.up;
      const rd=clamp(this.dist*0.62,5.5,22);
      const oy=Rover.yaw+Rover.camYaw,cp=Rover.camPitch;
      const fwdO=this._t1.copy(Rover.frame.east).multiplyScalar(Math.sin(oy)).addScaledVector(Rover.frame.north,Math.cos(oy));
      const dpos=this._t2.set(Rover.pos.x-ORIGIN.x,Rover.pos.y-ORIGIN.y,Rover.pos.z-ORIGIN.z)
        .addScaledVector(fwdO,-rd*Math.cos(cp)).addScaledVector(up,rd*(0.28+Math.sin(Math.max(0,cp))*0.95)+1.4);
      this.pos.x=damp(this.pos.x,dpos.x,9,dt);
      this.pos.y=damp(this.pos.y,dpos.y,9,dt);
      this.pos.z=damp(this.pos.z,dpos.z,9,dt);
      camera.position.copy(this.pos);
      const fwd=this._t1.copy(Rover.frame.east).multiplyScalar(Math.sin(Rover.yaw)).addScaledVector(Rover.frame.north,Math.cos(Rover.yaw));
      const look=this._t3.set(Rover.pos.x-ORIGIN.x,Rover.pos.y-ORIGIN.y,Rover.pos.z-ORIGIN.z).addScaledVector(fwd,2.5).addScaledVector(up,1.4);
      this.lookTarget.lerp(look,1-Math.exp(-12*dt));
      camera.up.copy(up);camera.lookAt(this.lookTarget);
      targetFov=68;Player.gun.visible=false;
    }else{
      const eye={};Player.eyeWorld(eye);
      camera.position.set(eye.x-ORIGIN.x,eye.y-ORIGIN.y,eye.z-ORIGIN.z);
      camera.quaternion.copy(Player.lookQuat());
      camera.up.copy(Player.up);
      targetFov=70;Player.gun.visible=true;
    }
    if(shk>0.01){
      camera.position.x+=Math.sin(this.shakeT*1.3)*shk*0.12;
      camera.position.y+=Math.cos(this.shakeT*1.7)*shk*0.1;
    }
    /* 镜头-地形碰撞：追尾镜头低飞/驾车下坡时曾钻进地面导致透视穿模 */
    {
      const pl=Planets.current;
      if(pl&&!Game.warp){
        const wx=camera.position.x+ORIGIN.x,wy=camera.position.y+ORIGIN.y,wz=camera.position.z+ORIGIN.z;
        this._t1.set(wx-pl.x,wy-pl.y,wz-pl.z);
        const d=this._t1.length();
        if(d>1e-3){
          this._t1.multiplyScalar(1/d);
          const clear=Game.mode==='foot'?0.42:1.6;
          const gr=pl.radius+terrainH(pl,this._t1.x,this._t1.y,this._t1.z)+padLift(pl,wx,wy,wz)+clear;
          if(d<gr){
            const push=gr-d;
            camera.position.x+=this._t1.x*push;
            camera.position.y+=this._t1.y*push;
            camera.position.z+=this._t1.z*push;
          }
        }
      }
    }
    camera.fov=damp(camera.fov,targetFov,8,dt);
    camera.updateProjectionMatrix();
  }
};