'use strict';
/* ================= galaxy.js — 1000星球种子化生成 + 地形高度解析函数 ================= */

const GALAXY={systems:[],planets:[],bySys:{}};
const PTYPES=['lava','desert','rock','temperate','forest','ocean','tundra','ice','toxic','gas'];

const TYPE_DEF={
  lava:     {amp:75, ridge:120,sc:2.2,sea:{h:6,c:0xff4a12,emis:true},grav:11,fog:0.00095,crater:40,
             cols:['#2a2320','#3a2d26','#54423a','#1a1512'],sky:['#4a2a1a','#2a160e','#0d0705'],scatter:'lava',cityOk:false},
  desert:   {amp:60, ridge:60, sc:1.7,sea:null,grav:9,fog:0.00075,mesa:32,
             cols:['#c8a05a','#b8894a','#a06a3a','#8a5a3a'],sky:['#e8c48a','#c8783a','#1a0f08'],scatter:'desert',cityOk:true},
  rock:     {amp:95, ridge:150,sc:2.0,sea:null,grav:10,fog:0.0005,crater:65,mesa:40,
             cols:['#8a8078','#6a625a','#54504a','#c8c4bc'],sky:['#9aa4ae','#54524a','#0a0c10'],scatter:'rock',cityOk:true},
  temperate:{amp:55, ridge:95, sc:1.8,sea:{h:4,c:0x2e6f8e},grav:9.8,fog:0.00062,
             cols:['#7a9a4a','#5a8a3e','#8a7a5a','#e8e8e2'],sky:['#7fb8e8','#e8946a','#0a1220'],scatter:'temperate',cityOk:true},
  forest:   {amp:60, ridge:80, sc:2.4,sea:{h:6,c:0x1e5e46},grav:9.5,fog:0.00088,
             cols:['#3e6e30','#2e5a28','#5a7a40','#d8e2d0'],sky:['#8fd0b8','#c87a4a','#081410'],scatter:'forest',cityOk:true},
  ocean:    {amp:38, ridge:50, sc:2.6,sea:{h:14,c:0x1e5a8e},grav:9.6,fog:0.0007,
             cols:['#d8c890','#8aa858','#6a8a4a','#e8e4da'],sky:['#6aacdf','#e8a06a','#0a1424'],scatter:'ocean',cityOk:true},
  tundra:   {amp:50, ridge:85, sc:1.9,sea:{h:2,c:0x4a7a9a},grav:9,fog:0.00062,crater:24,
             cols:['#9aa88a','#b8c0aa','#d8dcd2','#f0f2ee'],sky:['#aac8dd','#c89a7a','#0c1218'],scatter:'tundra',cityOk:true},
  ice:      {amp:65, ridge:110,sc:2.1,sea:{h:3,c:0x9ac8e0},grav:8,fog:0.00072,crater:42,
             cols:['#dde8f0','#c0d4e2','#a8c0d4','#f4f8fa'],sky:['#c8e0f0','#8aa0c8','#0a1018'],scatter:'ice',cityOk:true},
  toxic:    {amp:70, ridge:90, sc:2.3,sea:{h:8,c:0x5aa82a,emis:true},grav:10.5,fog:0.0013,
             cols:['#5a6a3a','#6a5a7a','#4a3e5a','#8a9a5a'],sky:['#9ab86a','#6a5a8a','#0e0a14'],scatter:'toxic',cityOk:false},
  gas:      {amp:14, ridge:8,  sc:3.5,sea:null,grav:6,fog:0.0021,
             cols:['#c8a0d8','#b088c8','#e8c0a8','#f0d8e8'],sky:['#d8b0e8','#a878b8','#180e20'],scatter:'gas',cityOk:false},
};

function genGalaxy(){
  const rng=mulberry32(20260718);
  let sid=0;
  while(GALAXY.planets.length<1000){
    const ang=sid*2.39996+rng()*0.35;
    const arm=(sid%3)*(Math.PI*2/3);
    const R=42000+sid*2450+rng()*8000;
    const sx=Math.cos(ang+arm)*R, sz=Math.sin(ang+arm)*R, sy=(rng()-0.5)*14000;
    const srng=mulberry32(hash2i(sid,777));
    const starCls=srng();
    const star={
      id:sid,x:sx,y:sy,z:sz,
      name:genName(srng),
      color:starCls<0.25?0xffd8a0:starCls<0.5?0xfff4d8:starCls<0.75?0xcfe0ff:0xffb890,
      size:900+srng()*1400,
    };
    const n=Math.min(5+((hash2i(sid,31)>>3)%6), 1000-GALAXY.planets.length);
    const list=[];
    for(let i=0;i<n;i++){
      const prng=mulberry32(hash2i(sid*97+i,12345));
      const orbR=5200+i*(4200+prng()*2600)+prng()*1800;
      const oa=prng()*Math.PI*2;
      const px=sx+Math.cos(oa)*orbR, pz=sz+Math.sin(oa)*orbR, py=sy+(prng()-0.5)*2200;
      const slot=clamp(i/Math.max(1,n-1)*1.15+(prng()-0.5)*0.42,0,0.999);
      let type=PTYPES[(slot*PTYPES.length)|0];
      if(type==='gas'&&prng()<0.4)type='ice';
      const td=TYPE_DEF[type];
      const radius=type==='gas'?700+prng()*280:240+prng()*520;
      const pl={
        id:GALAXY.planets.length,sys:sid,idx:i,
        name:star.name+' '+_ROMAN[i%12],
        x:px,y:py,z:pz,radius,type,td,
        seed:hash2i(sid*131+i,999)|0,
        atmo:type==='gas'?radius*0.5:120+radius*0.28,
        grav:td.grav*(0.85+prng()*0.3),
        city:td.cityOk&&prng()<0.16,
        rings:(type==='gas'||type==='ice'||type==='rock')&&prng()<0.3,
        hue:(prng()-0.5)*0.10,
        dayLen:300+prng()*400,
        phase:prng()*Math.PI*2,
      };
      if(pl.city){
        const crng=mulberry32(pl.seed^0xC17F);
        const th=Math.acos(2*(0.35+crng()*0.3)-1), ph=crng()*Math.PI*2;
        pl.cityDir=new THREE.Vector3(Math.sin(th)*Math.cos(ph),Math.cos(th),Math.sin(th)*Math.sin(ph));
        pl.cityName=genName(crng)+(crng()<0.5?'港':'站');
      }
      list.push(pl);GALAXY.planets.push(pl);
    }
    star.planets=list;GALAXY.systems.push(star);GALAXY.bySys[sid]=list;
    sid++;
  }
}

/* ---------- 地形高度（米，基于单位方向向量）— 渲染与物理共用 ---------- */
const _thv=new THREE.Vector3();
function terrainH(pl,dx,dy,dz){
  const td=pl.td,s=pl.seed,sc=td.sc;
  let h=fbm3(dx*sc,dy*sc,dz*sc,s,4,2.1,0.52)*td.amp;
  const m=vnoise3(dx*sc*0.7+9,dy*sc*0.7,dz*sc*0.7,s^0x55AA);
  if(m>0.55)h+=(ridged3(dx*sc*2.6,dy*sc*2.6,dz*sc*2.6,s+7,4)-0.55)*td.ridge*smoothstep(0.55,0.75,m);
  if(pl.type==='desert'){
    const d=Math.sin((dx*7+dz*5)*sc+fbm3(dx*4,dy*4,dz*4,s+3,2)*3);
    h+=Math.abs(d)*14-7;
  }
  /* 陨石坑：环形隆起 + 中央凹陷（岩石/冰封/苔原/熔岩） */
  if(td.crater){
    const cn=vnoise3(dx*sc*1.9+31,dy*sc*1.9,dz*sc*1.9,s^0x9E37);
    if(cn>0.68){
      const t=(cn-0.68)/0.32;
      const rim=Math.sin(Math.min(1,t*1.45)*Math.PI);
      h+=rim*td.crater*0.42-smoothstep(0.3,1,t)*td.crater;
    }
  }
  /* 台地/方山：局部高度阶梯化（沙漠/岩石） */
  if(td.mesa){
    const mm=vnoise3(dx*sc*0.55+77,dy*sc*0.55,dz*sc*0.55,s^0x1B2C);
    if(mm>0.58){
      const hq=Math.floor(h/td.mesa)*td.mesa+td.mesa*0.55;
      h=lerp(h,hq,smoothstep(0.58,0.7,mm)*0.85);
    }
  }
  if(pl.city&&pl.cityDir){
    const dot=dx*pl.cityDir.x+dy*pl.cityDir.y+dz*pl.cityDir.z;
    const arc=Math.acos(clamp(dot,-1,1))*pl.radius;
    if(arc<2100){
      const plateau=terrainCityH(pl);
      h=lerp(plateau,h,smoothstep(1150,2100,arc));
    }
  }
  return h;
}
let _cityHCache={};
function terrainCityH(pl){
  if(_cityHCache[pl.id]!==undefined)return _cityHCache[pl.id];
  const d=pl.cityDir,td=pl.td,s=pl.seed,sc=td.sc;
  let h=fbm3(d.x*sc,d.y*sc,d.z*sc,s,4,2.1,0.52)*td.amp;
  const sea=td.sea?td.sea.h:0;
  h=Math.max(h,sea+8);
  _cityHCache[pl.id]=h;
  return h;
}
/* 地表世界高度: 星球中心距 */
function groundRadius(pl,dir){ return pl.radius+terrainH(pl,dir.x,dir.y,dir.z) }
