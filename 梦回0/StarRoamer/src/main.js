'use strict';
/* ================= main.js — 引导 / 输入 / 状态切换 / 浮动原点 / 主循环 / 存档 ================= */

let renderer,scene,camera;
const SAVE_KEY='star_roamer_save_v1';

function boot(){
  const q=new URLSearchParams(location.search);
  renderer=new THREE.WebGLRenderer({antialias:true,logarithmicDepthBuffer:true,powerPreference:'high-performance'});
  renderer.setSize(innerWidth,innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
  renderer.outputEncoding=THREE.sRGBEncoding;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.08;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  document.getElementById('app').appendChild(renderer.domElement);
  scene=new THREE.Scene();
  scene.fog=new THREE.FogExp2(0x000000,1e-9);
  camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,0.12,600000);
  scene.add(camera);
  initMaterials();
  genGalaxy();
  Planets.init(scene);
  Ship.init(scene);
  Rover.init(scene);
  Player.init(camera);
  /* 座舱内饰：挂相机，仅第一人称(1键)显示 */
  Cam.cockpit=buildModel(DEFS.cockpit());
  Cam.cockpit.visible=false;
  camera.add(Cam.cockpit);
  FX.init(scene,camera);
  Enemies.init(scene);
  Weapons.initBolts(scene);
  UI.init();
  window.addEventListener('resize',()=>{
    renderer.setSize(innerWidth,innerHeight);
    camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
  });
  setupInput();
  const noSave=q.get('fresh')||q.get('scene');
  if(noSave||!loadGame())startAtHome();
  if(q.get('scene'))setupTestScene(q.get('scene'));
  Game._noSave=!!noSave;
  Game.fps=60;
  /* 预编译全部材质（含隐藏的漫游车/手枪），否则首次显示时着色器编译会卡整帧 */
  renderer.compile(scene,camera);
  if(!q.get('scene')&&!q.get('fresh'))UI.showTitle();
  requestAnimationFrame(loop);
  setInterval(saveGame,6000);
  window.addEventListener('beforeunload',saveGame);
}

function homePlanet(){
  return GALAXY.planets.find(p=>p.type==='temperate'&&p.city)||GALAXY.planets[0];
}
function startAtHome(){
  const pl=homePlanet();
  const pw=cityPadWorld(pl);
  const up=_v1.set(pw.x-pl.x,pw.y-pl.y,pw.z-pl.z).normalize();
  Ship.pos={x:pw.x+up.x*3.45,y:pw.y+up.y*3.45,z:pw.z+up.z*3.45};
  /* 构建飞船姿势：Y=up, Z=朝城中心北向 (right-handed: right=Y×Z) */
  const fc=cityFrame(pl);
  const fwd=fc.north.clone();
  const right=new THREE.Vector3().crossVectors(up,fwd).normalize();
  fwd.copy(right).cross(up).normalize();
  _m4.makeBasis(right,up,fwd);
  Ship.quat.setFromRotationMatrix(_m4);
  Ship.landed=true;Ship.gear=true;Game.mode='landed';
  Game.visited[pl.id]=1;
  Travel.target=null;
  toast('欢迎来到 '+pl.cityName+' · '+pl.name+'。按 H 查看操作说明',6);
}
function setupTestScene(sc){
  const pl=homePlanet();
  /* 先确保基础位置在母星并着陆（地表/夜景都需要），然后再根据场景覆盖 */
  if(['surface','night','foot'].includes(sc)){
    const dir=new THREE.Vector3(0.3,0.5,0.8).normalize();
    const gr=pl.radius+terrainH(pl,dir.x,dir.y,dir.z);
    Ship.pos={x:pl.x+dir.x*(gr+2.16),y:pl.y+dir.y*(gr+2.16),z:pl.z+dir.z*(gr+2.16)};
    Ship.quat.setFromUnitVectors(AXIS_Y,dir);
    Ship.landed=true;Game.mode='landed';
    Game.visited[pl.id]=1;
  }
  if(sc==='surface'){
    /* 已处理好 */
  }else if(sc==='night'){
    Planets.timeOfDay=pl.dayLen*0.5;
  }else if(sc==='foot'){
    transitionFootExit();
  }else if(sc==='space'){
    Game.mode='ship';Ship.landed=false;
    const st=GALAXY.systems[pl.sys];
    Ship.pos={x:st.x+30000,y:st.y+3000,z:st.z+30000};Ship.throttle=0.4;
  }else if(sc==='orbit'){
    Game.mode='ship';Ship.landed=false;
    Ship.pos={x:pl.x+pl.radius*2.7,y:pl.y+pl.radius*1.4,z:pl.z+pl.radius*0.2};
    Ship.vel={x:0,y:0,z:0};
    Ship.quat.setFromUnitVectors(AXIS_Z,_v1.set(pl.x-Ship.pos.x,pl.y-Ship.pos.y,pl.z-Ship.pos.z).normalize());
  }
  Game._testScene=sc;
  toast('测试场景: '+sc,3);
}

/* ---------- 输入 ---------- */
function setupInput(){
  addEventListener('keydown',e=>{
    if(e.repeat)return;
    if(UI.titleOpen){if(e.code==='Escape'&&UI.helpOpen)UI.toggleHelp();return}
    Input.keys[e.code]=true;
    if(['Space','ShiftLeft','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();
    switch(e.code){
      case 'KeyH': UI.toggleHelp();break;
      case 'KeyM': UI.toggleMap();break;
      case 'KeyJ': Travel.warp();break;
      case 'KeyT': Travel.teleport();break;
      case 'KeyB': {const n=AudioSys.cycleStation();if(n){UI.$('radioLine').textContent='电台: '+n+' (B切换)';toast('电台: '+n)}break}
      case 'KeyN': Planets.timeScale=Planets.timeScale===1?10:1;toast('时间流速 ×'+Planets.timeScale);break;
      case 'Digit1': Cam.firstPerson=!Cam.firstPerson;toast(Cam.firstPerson?'座舱视角':'第三人称视角');break;
      case 'Digit2': Cam.dist=Cam.dist<14?14:Math.min(30,Cam.dist+3);if(Cam.dist>=30)Cam.dist=8;toast('镜头距离 '+Cam.dist.toFixed(0));break;
      case 'Minus': AudioSys.setVol(AudioSys.volume-0.1);toast('音量 '+(AudioSys.volume*100|0)+'%');break;
      case 'Equal': AudioSys.setVol(AudioSys.volume+0.1);toast('音量 '+(AudioSys.volume*100|0)+'%');break;
      case 'KeyF': handleF();break;
      case 'KeyV': handleV();break;
      case 'KeyC': if(!UI.mapOpen)UI.toggleCraft();break;
      case 'KeyQ': useMedkit();break;
      case 'KeyR': if(Game.mode==='foot')Weapons.startReload();break;
      case 'Escape': if(UI.mapOpen)UI.toggleMap(false);if(UI.helpOpen)UI.toggleHelp();if(UI.craftOpen)UI.toggleCraft(false);break;
    }
  });
  addEventListener('keyup',e=>{Input.keys[e.code]=false});
  const cv=renderer.domElement;
  cv.addEventListener('mousedown',e=>{
    if(UI.titleOpen)return;
    AudioSys.boot();
    if(!Input.locked){cv.requestPointerLock();return}
    if(e.button===0)Input.mdown=true;
  });
  addEventListener('mouseup',e=>{if(e.button===0)Input.mdown=false});
  document.addEventListener('pointerlockchange',()=>{
    Input.locked=document.pointerLockElement===cv;
    const hu=UI.mapOpen||UI.helpOpen||UI.craftOpen||UI.titleOpen;
    document.getElementById('lockHint').style.display=(Input.locked||hu)?'none':'flex';
  });
  addEventListener('mousemove',e=>{
    if(Input.locked){Input.mdx+=e.movementX;Input.mdy+=e.movementY}
  });
  addEventListener('wheel',e=>{
    if(UI.mapOpen){UI.mapZoom=clamp(UI.mapZoom*(e.deltaY>0?0.82:1.22),0.4,20);return}
    if(Input.locked){
      Cam.dist=clamp(Cam.dist*(e.deltaY>0?1.12:0.89),5,40);
    }
  },{passive:true});
}
function transitionFootExit(){
  const b=Ship.basis();
  const side=_v2.copy(b.r).multiplyScalar(4.2);
  Player.pos={x:Ship.pos.x+side.x,y:Ship.pos.y+side.y,z:Ship.pos.z+side.z};
  const pl=Planets.current;
  if(pl){
    _v1.set(Player.pos.x-pl.x,Player.pos.y-pl.y,Player.pos.z-pl.z);
    const d=_v1.length();_v1.normalize();
    let gr=pl.radius+terrainH(pl,_v1.x,_v1.y,_v1.z);
    if(Planets.cityPid===pl.id&&pl._padTopH){
      const pw=cityPadWorld(pl);
      if(((pw.x-Player.pos.x)**2+(pw.y-Player.pos.y)**2+(pw.z-Player.pos.z)**2)<16.2*16.2)gr+=pl._padTopH;
    }
    Player.pos={x:pl.x+_v1.x*gr,y:pl.y+_v1.y*gr,z:pl.z+_v1.z*gr};
    Player.setHeading(_v1,b.f);
  }
  Game.mode='foot';
  toast('已下船');
}
function handleF(){
  if(Game.mode==='landed'){
    transitionFootExit();
  }else if(Game.mode==='foot'){
    const dRover=Rover.deployed?dist3(Rover.pos,Player.pos):1e9;
    const dShip=dist3(Ship.pos,Player.pos);
    /* 都在范围内时就近交互，避免站在车旁永远上不了船 */
    if(dRover<6.5&&(dRover<=dShip||dShip>=8)){Game.mode='rover';Rover.camYaw=0;Rover.camPitch=0.18;toast('驾驶漫游车。鼠标环视 · A/D 转向')}
    else if(dShip<8){Game.mode='landed';toast('已登船。W 起飞')}
    else if(Rover.deployed&&dRover<60)toast('漫游车在 '+dRover.toFixed(0)+' 米外');
    else if(dShip<120)toast('飞船在 '+dShip.toFixed(0)+' 米外');
  }else if(Game.mode==='rover'){
    Rover.vel=0;
    const side=_v2.copy(Rover.frame.east).multiplyScalar(Math.cos(Rover.yaw)).addScaledVector(Rover.frame.north,-Math.sin(Rover.yaw)).multiplyScalar(2.6);
    Player.pos={x:Rover.pos.x+side.x,y:Rover.pos.y+side.y,z:Rover.pos.z+side.z};
    const fwdR=_v3.copy(Rover.frame.east).multiplyScalar(Math.sin(Rover.yaw)).addScaledVector(Rover.frame.north,Math.cos(Rover.yaw));
    Player.setHeading(Rover.up,fwdR);
    Game.mode='foot';
    AudioSys.set('rover',{on:false});
    toast('已下车');
  }
}
function handleV(){
  if(Game.mode!=='foot')return;
  if(!Rover.deployed){
    if(dist3(Ship.pos,Player.pos)<18){
      const f=Player.frame;
      const fwd=_v2.copy(f.east).multiplyScalar(Math.sin(Player.yaw)).addScaledVector(f.north,Math.cos(Player.yaw));
      Rover.deployAt(Player.pos.x+fwd.x*4.5,Player.pos.y+fwd.y*4.5,Player.pos.z+fwd.z*4.5);
    }else toast('需要在飞船附近才能部署漫游车');
  }else{
    if(dist3(Rover.pos,Player.pos)<18){Rover.stow();toast('漫游车已收回')}
    else toast('离漫游车太远，走近后再按 V 收回');
  }
}
function dist3(a,b){return Math.sqrt((a.x-b.x)**2+(a.y-b.y)**2+(a.z-b.z)**2)}

/* ---------- 存档 ---------- */
function saveGame(){
  if(Game._noSave)return;
  try{
    const d={
      pos:Ship.pos,quat:Ship.quat.toArray(),landed:Ship.landed,gear:Ship.gear,
      mode:(Game.mode==='foot'||Game.mode==='rover')?'landed':Game.mode,
      credits:Game.credits,ore:Game.ore,hull:Game.hull,
      res:Game.res,up:Game.up,medkits:Game.medkits,hp:Game.hp,
      visited:Object.keys(Game.visited),target:Travel.target?Travel.target.id:-1,
      time:Planets.timeOfDay,
    };
    localStorage.setItem(SAVE_KEY,JSON.stringify(d));
  }catch(e){}
}
function loadGame(){
  try{
    const s=localStorage.getItem(SAVE_KEY);if(!s)return false;
    const d=JSON.parse(s);
    if(!d.pos)return false;
    Ship.pos=d.pos;Ship.quat.fromArray(d.quat);Ship.landed=!!d.landed;Ship.gear=d.gear!==false;
    Game.mode=d.mode||'ship';
    Game.credits=d.credits||0;Game.ore=d.ore||0;Game.hull=d.hull||100;
    if(d.res)Game.res=Object.assign({herb:0,iron:0,alum:0,crystal:0,silver:0,gold:0,diamond:0,uran:0},d.res);
    else if(d.ore)Game.res.iron+=d.ore;   /* 旧档折算：矿石→铁矿石 */
    Game.up=Object.assign({dmg:0,rof:0,mine:0,hp:0,hull:0,od:0},d.up||{});
    Game.medkits=d.medkits||0;
    Game.hpMax=100+Game.up.hp*25;Game.hp=Math.min(d.hp||Game.hpMax,Game.hpMax);
    Game.hullMax=100+Game.up.hull*25;
    (d.visited||[]).forEach(id=>Game.visited[id]=1);
    if(d.target>=0)Travel.target=GALAXY.planets[d.target];
    Planets.timeOfDay=d.time||0;
    toast('已读取存档。按 H 查看操作说明',4);
    return true;
  }catch(e){return false}
}

/* ---------- 浮动原点 ---------- */
function rebase(active){
  const dx=active.x-ORIGIN.x,dy=active.y-ORIGIN.y,dz=active.z-ORIGIN.z;
  if(dx*dx+dy*dy+dz*dz>8192*8192){
    const ox=ORIGIN.x,oy=ORIGIN.y,oz=ORIGIN.z;
    ORIGIN.x=Math.round(active.x/2048)*2048;
    ORIGIN.y=Math.round(active.y/2048)*2048;
    ORIGIN.z=Math.round(active.z/2048)*2048;
    Cam.onRebase(ORIGIN.x-ox,ORIGIN.y-oy,ORIGIN.z-oz);
    Planets.updateFarPoints();
  }
}

/* ---------- 主循环 ---------- */
let _last=performance.now(),_fpsA=60,_qaFrames=0,_qaErrors=[];
window.onerror=(m,s,l)=>{_qaErrors.push(m+'@'+(s||'').split('/').pop()+':'+l);
  const el=document.getElementById('errBox');
  if(el){el.style.display='block';el.textContent=('ERR: '+m+' @'+(s||'').split('/').pop()+':'+l)}
};
function loop(){
  requestAnimationFrame(loop);
  const now=performance.now();
  const dt=clamp((now-_last)/1000,0.001,0.05);
  _last=now;
  _fpsA=lerp(_fpsA,1/dt,0.05);Game.fps=_fpsA;
  const busy=UI.mapOpen||UI.helpOpen||UI.craftOpen||UI.titleOpen;
  /* 任一子系统异常都不允许冻结渲染循环（曾因音频 NaN 异常每帧中断→画面死住数分钟） */
  try{
    Travel.update(dt);
    if(!busy&&!Game.warp){
      if(Game.mode==='ship'||Game.mode==='landed')Ship.update(dt);
      if(Game.mode==='foot')Player.update(dt);
    }
    Rover.update(dt,Game.mode==='rover'&&!busy);
    if(Game.mode==='rover')Player.pos={x:Rover.pos.x,y:Rover.pos.y,z:Rover.pos.z};
    if(!busy)Enemies.update(dt);
    if(!busy)Weapons.update(dt,camera);
    const active=Game.mode==='foot'?Player.pos:Game.mode==='rover'?Rover.pos:Ship.pos;
    rebase(active);
    Planets.update(dt,active,camera);
    Ship.syncModel();
    Cam.update(dt,camera);
    AudioSys.set('engine',{on:(Game.mode==='ship')&&!Ship.landed,rpm:clamp(Math.abs(Ship.throttle)+Ship.speed/9000,0,1.4),boost:Ship.boost,od:Ship.od});
    AudioSys.set('wind',{amt:clamp(Planets.atmoFactor*(Game.mode==='ship'?Ship.speed/300:0.15),0,1)});
    const warpF=Game.warp&&Game.warp.started?1:clamp((Ship.speed-1100)/8000,0,1);
    FX.update(dt,warpF,Ship.vel);
    UI.update(dt,camera);
  }catch(err){
    window.onerror(String(err&&err.message||err),String(err&&err.stack||'').split('\n')[1]||'',0);
  }
  Input.mdx=0;Input.mdy=0;
  renderer.render(scene,camera);
  /* 自动化测试报告 */
  _qaFrames++;
  if(_qaFrames>=55&&_qaFrames%30===0){
    window.QA_REPORT={
      fps:+Game.fps.toFixed(1),calls:renderer.info.render.calls,tris:renderer.info.render.triangles,
      mode:Game.mode,planet:Planets.current?Planets.current.name+'/'+Planets.current.type:'deep',
      alt:+(Ship.alt<1e8?Ship.alt.toFixed(1):-1),planetCount:GALAXY.planets.length,sysCount:GALAXY.systems.length,
      city:Planets.cityPid,scatterSets:Planets.scatterSets.length,mineables:Planets.mineables.length,
      night:+Planets.nightFactor.toFixed(2),atmo:+Planets.atmoFactor.toFixed(2),
      errors:_qaErrors.slice(0,6),
    };
  }
}
boot();