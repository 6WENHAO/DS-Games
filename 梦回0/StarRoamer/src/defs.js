'use strict';
/* ================= defs.js — 全部模型零件定义（声明式 JSON + SVG剖面） ================= */
const DEFS={};

/* ---------- 六轮漫游车 R-6（最高优先级） 轴向:+Z前 +Y上 +X右 ---------- */
DEFS.rover=()=>({
  name:'rover',
  pivots:{
    wheel_fl:{p:[1.05,0.42,1.25],mir:'wheel_fr'},
    wheel_ml:{p:[1.05,0.42,0],mir:'wheel_mr'},
    wheel_rl:{p:[1.05,0.42,-1.25],mir:'wheel_rr'},
  },
  parts:[
    /* --- 车轮（车削轮胎剖面 + 轮辋） --- */
    ...['wheel_fl','wheel_ml','wheel_rl'].map(g=>[
      {t:'lathe',g,n:'tire',path:'M 0.22 -0.15 L 0.36 -0.15 C 0.42 -0.15 0.42 -0.11 0.42 -0.07 L 0.42 0.07 C 0.42 0.11 0.42 0.15 0.36 0.15 L 0.22 0.15',seg:24,r:[0,0,90],m:'tire',uvs:[6,1]},
      {t:'cyl',g,n:'rim',s:[0.23,0.23,0.26],r:[0,0,90],m:'rim',seg:18,sink:1},
      {t:'lathe',g,n:'hubcap',path:'M 0 0 L 0.1 0 L 0.07 0.09 L 0 0.1',seg:12,r:[0,0,-90],p:[0.12,0,0],m:'darkMetal',sink:1},
      {t:'cyl',g,n:'brake',s:[0.19,0.19,0.04],r:[0,0,90],p:[-0.1,0,0],m:'darkMetal',seg:16,sink:1},
    ]).flat(),
    /* --- 底盘主体（挤出侧面剖面，带驾驶舱凹槽） --- */
    {t:'ext',n:'tub',path:'M -1.9 0.5 L -1.9 1.02 L -1.45 1.08 L -0.5 1.08 L -0.35 0.62 L 0.7 0.62 L 0.85 1.02 L 1.55 1.0 L 2.0 0.66 L 2.0 0.5 Z',depth:1.5,bevel:[0.03,0.03],r:[0,-90,0],m:'body'},
    {t:'box',n:'belly',p:[0,0.4,0.1],s:[1.5,0.12,3.6],m:'darkMetal'},
    {t:'box',n:'skidF',p:[0,0.48,1.95],r:[20,0,0],s:[1.2,0.06,0.5],m:'darkMetal'},
    /* --- 悬挂（每侧3组摇臂+减震） --- */
    ...[1.25,0,-1.25].map(z=>[
      {t:'box',n:'armU',p:[0.78,0.6,z],r:[0,0,-24],s:[0.55,0.07,0.1],m:'cage'},
      {t:'box',n:'armL',p:[0.78,0.44,z],r:[0,0,-12],s:[0.6,0.07,0.14],m:'cage'},
      {t:'cyl',n:'shock',p:[0.84,0.7,z],r:[0,0,38],s:[0.045,0.045,0.42],m:'accent',seg:10},
      {t:'cyl',n:'piston',p:[0.95,0.6,z],r:[0,0,38],s:[0.022,0.022,0.3],m:'rim',seg:8},
    ]).flat(),
    /* --- 轮拱（挤出拱形剖面） --- */
    ...[1.25,0,-1.25].map(z=>(
      {t:'ext',n:'fender',path:'M -0.62 0 C -0.62 0.55 -0.28 0.72 0 0.72 C 0.28 0.72 0.62 0.55 0.62 0 L 0.5 0 C 0.5 0.42 0.24 0.58 0 0.58 C -0.24 0.58 -0.5 0.42 -0.5 0 Z',depth:0.4,r:[0,-90,0],p:[1.05,0.42,z],m:'body'}
    )),
    {t:'box',n:'slider',p:[0.82,0.48,0],s:[0.12,0.1,2.3],m:'cage'},
    /* --- 保险杠 / 拖钩 / 灯 --- */
    {t:'box',n:'bumpF',p:[0,0.6,2.1],s:[1.6,0.18,0.16],m:'cage'},
    {t:'box',n:'bumpR',p:[0,0.6,-2.0],s:[1.6,0.16,0.14],m:'cage'},
    {t:'torus',n:'towhook',p:[0.5,0.6,2.2],r:[90,0,0],s:[0.09,0.03],arc:200,m:'accent'},
    {t:'lathe',n:'lampcup',path:'M 0 0 L 0.11 0 C 0.14 0.02 0.14 0.1 0.1 0.12 L 0 0.13',seg:14,r:[-90,0,0],p:[0.55,0.86,1.96],m:'darkMetal',sink:1},
    {t:'cyl',n:'lamplens',s:[0.09,0.09,0.03],r:[90,0,0],p:[0.55,0.88,2.06],m:'lightW',seg:14},
    {t:'box',n:'taillight',p:[0.6,0.8,-1.93],s:[0.22,0.1,0.08],m:'lightR',sink:1},
    {t:'box',n:'intake',p:[0,1.12,1.3],s:[0.6,0.1,0.5],m:'darkMetal'},
    /* --- 驾驶舱 --- */
    {t:'box',n:'seatBase',p:[0.38,0.7,-0.05],s:[0.6,0.14,0.55],m:'seat',sink:1},
    {t:'box',n:'seatBack',p:[0.38,0.98,-0.34],r:[-12,0,0],s:[0.6,0.55,0.1],m:'seat'},
    {t:'box',n:'headrest',p:[0.38,1.32,-0.4],s:[0.26,0.18,0.08],m:'seat'},
    {t:'box',n:'dash',p:[0,0.95,0.55],r:[-18,0,0],s:[1.3,0.3,0.08],m:'dashE',sink:1},
    {t:'cyl',n:'steerCol',p:[0.38,0.86,0.44],r:[62,0,0],s:[0.03,0.03,0.3],m:'darkMetal',nomir:true,seg:8,sink:1},
    {t:'torus',n:'steerWheel',p:[0.38,0.97,0.36],r:[28,0,0],s:[0.15,0.025],m:'seat',nomir:true,sink:1},
    /* --- 防滚架 --- */
    {t:'cyl',n:'hoopF',p:[0.62,1.4,0.66],r:[6,0,0],s:[0.045,0.045,0.75],m:'cage',seg:10},
    {t:'cyl',n:'hoopR',p:[0.62,1.4,-0.6],s:[0.045,0.045,0.75],m:'cage',seg:10},
    {t:'cyl',n:'crossF',p:[0,1.76,0.62],r:[0,0,90],s:[0.045,0.045,1.34],m:'cage',seg:10},
    {t:'cyl',n:'crossR',p:[0,1.76,-0.6],r:[0,0,90],s:[0.045,0.045,1.34],m:'cage',seg:10},
    {t:'cyl',n:'railTop',p:[0.62,1.76,0.02],r:[90,0,0],s:[0.045,0.045,1.28],m:'cage',seg:10},
    {t:'cyl',n:'braceR',p:[0.62,1.35,-1.05],r:[38,0,0],s:[0.045,0.045,1.1],m:'cage',seg:10},
    /* --- 车顶灯条 --- */
    {t:'box',n:'lightbar',p:[0,1.85,0.62],s:[0.9,0.09,0.1],m:'darkMetal'},
    {t:'box',n:'lbLensA',p:[0.15,1.85,0.65],s:[0.14,0.05,0.04],m:'lightW',sink:1},
    {t:'box',n:'lbLensB',p:[0.34,1.85,0.65],s:[0.14,0.05,0.04],m:'lightO',sink:1},
    /* --- 后视镜 --- */
    {t:'cyl',n:'mirArm',p:[0.76,1.3,0.72],r:[0,0,55],s:[0.025,0.025,0.32],m:'darkMetal',seg:8},
    {t:'box',n:'mirGlass',p:[0.88,1.4,0.72],s:[0.16,0.12,0.03],m:'glassDark'},
    /* --- 货斗 / 太阳能板 / 油罐 / 货箱 --- */
    {t:'cyl',n:'rackRail',p:[0.66,1.14,-1.25],r:[90,0,0],s:[0.035,0.035,1.15],m:'cage',seg:8},
    {t:'box',n:'crate',p:[0.34,1.3,-1.15],r:[0,12,0],s:[0.55,0.45,0.55],m:'crate'},
    {t:'lathe',n:'tank',path:'M 0 -0.34 L 0.13 -0.34 C 0.18 -0.34 0.18 -0.3 0.18 -0.25 L 0.18 0.25 C 0.18 0.3 0.18 0.34 0.13 0.34 L 0 0.34',seg:14,r:[90,0,0],p:[0.45,1.24,-1.78],m:'barrel'},
    {t:'box',n:'solar',p:[0,1.8,-1.12],r:[-14,0,0],s:[1.5,0.04,1.15],m:'solar',sink:1},
    {t:'cyl',n:'solarStrut',p:[0.6,1.62,-1.55],r:[24,0,0],s:[0.03,0.03,0.4],m:'darkMetal',seg:8},
    /* --- 天线（豁免镜像） --- */
    {t:'cyl',n:'antBase',p:[-0.85,1.12,-1.85],s:[0.05,0.07,0.14],m:'darkMetal',nomir:true,seg:10},
    {t:'cyl',n:'antMast',p:[-0.85,1.7,-1.85],s:[0.018,0.018,1.05],m:'rim',nomir:true,seg:8},
    {t:'sph',n:'antTip',p:[-0.85,2.24,-1.85],s:[0.045],m:'lightR',nomir:true,seg:8},
    /* --- 挡泥板 / 传动 --- */
    {t:'box',n:'mudflap',p:[1.05,0.26,-1.75],s:[0.34,0.3,0.04],m:'darkMetal'},
    ...[1.25,0,-1.25].map(z=>({t:'cyl',n:'axle',p:[0,0.42,z],r:[0,0,90],s:[0.05,0.05,1.7],m:'darkMetal',seg:10})),
    {t:'cyl',n:'driveshaft',p:[0,0.46,0],r:[90,0,0],s:[0.045,0.045,2.5],m:'darkMetal',seg:10},
  ]
});

/* ---------- 星舰 SR-07（车削机身/引擎 + 挤出机翼/尾翼） 着陆姿态：起落架垫片触地 y=0 ---------- */
DEFS.ship=()=>({
  name:'ship',
  pivots:{
    gear_n:{p:[0,1.4,3.5]},
    gear_l:{p:[1,0.9,-2.8],mir:'gear_r'},
  },
  parts:[
    /* 机身：车削泪滴剖面（+Z 机头），垂直略压扁 */
    {t:'lathe',n:'fuselage',path:'M 0 -7 L 0.62 -7 C 0.8 -6.6 0.95 -5 1 -3.5 C 1.15 -1.5 1.15 0 1.1 1.5 C 1.05 3.5 0.75 5.5 0.4 6.8 C 0.25 7.4 0.12 7.8 0 8',seg:28,cs:12,r:[90,0,0],sc:[1,1,0.82],p:[0,2,0],m:'shipHull'},
    /* 座舱玻璃 + 框架 */
    {t:'sph',n:'canopy',s:[0.62],e:[0.78,0.62,1.4],ang:[0,360,0,84],p:[0,2.62,3.1],m:'glass',seg:20,sink:1},
    {t:'torus',n:'canopyFrame',s:[0.5,0.045],r:[0,0,0],p:[0,2.66,3.1],m:'shipDark',sink:1},
    /* 机头武器与传感器 */
    {t:'sph',n:'sensor',s:[0.16],p:[0,1.5,5.9],m:'gunmetal',sink:1},
    {t:'cyl',n:'cannon',p:[0.55,1.55,6.1],r:[90,0,0],s:[0.055,0.055,1.7],m:'gunmetal',seg:10,sink:1},
    {t:'box',n:'cannonMount',p:[0.55,1.7,5.6],s:[0.12,0.3,0.5],m:'shipDark',sink:1},
    {t:'torus',n:'muzzle',p:[0.55,1.55,6.95],r:[90,0,0],s:[0.08,0.025],m:'darkMetal',sink:1},
    /* 机翼（挤出后掠剖面）+ 翼梢小翼 */
    {t:'ext',n:'wing',path:'M 0 2.2 C 1.6 1.7 3.4 0.6 4.9 -0.9 L 4.9 -2.6 C 3.2 -2.2 1.4 -2 0 -1.8 Z',depth:0.14,bevel:[0.03,0.03],r:[90,0,0],p:[0.9,2,-1],m:'shipHull'},
    {t:'ext',n:'winglet',path:'M 0 0 L 1.3 0.25 L 1.05 1.15 C 0.9 1.3 0.75 1.3 0.65 1.15 L 0 0.5 Z',depth:0.1,r:[0,90,0],p:[5.6,2.1,-2.7],m:'accent'},
    {t:'sph',n:'navL',p:[-5.6,2.15,-2.2],s:[0.07],m:'lightR',nomir:true,sink:1},
    {t:'sph',n:'navR',p:[5.6,2.15,-2.2],s:[0.07],m:'lightG',nomir:true,sink:1},
    /* 引擎短舱（车削：进气唇口→筒身→喷口收敛）+ 挂架 + 喷口内芯 */
    {t:'lathe',n:'nacelle',path:'M 0 2.3 L 0.55 2.25 C 0.63 2.15 0.63 2.05 0.57 1.95 L 0.6 -1.6 C 0.6 -2 0.5 -2.2 0.36 -2.35 L 0 -2.4',seg:22,cs:10,r:[90,0,0],p:[2.3,2.1,-3.3],m:'shipDark'},
    {t:'box',n:'pylon',p:[1.6,2.1,-3.3],s:[1.4,0.4,1.2],m:'shipHull',sink:1},
    {t:'cyl',n:'engGlow',p:[2.3,2.1,-5.6],r:[90,0,0],s:[0.34,0.34,0.06],m:'engineE',seg:16,sink:1},
    {t:'lathe',n:'intakeCone',path:'M 0 0 L 0.22 0 L 0 0.5',seg:14,r:[90,0,0],p:[2.3,2.1,-1.35],m:'accent',sink:1},
    /* 尾部：中央主喷口 + 垂尾 */
    {t:'lathe',n:'mainNozzle',path:'M 0 0 L 0.62 0 C 0.72 -0.2 0.7 -0.5 0.52 -0.72 L 0 -0.78',seg:20,r:[90,0,0],p:[0,2,-7],m:'nozzle',sink:1},
    {t:'cyl',n:'mainGlow',p:[0,2,-7.6],r:[90,0,0],s:[0.4,0.4,0.06],m:'engineE',seg:16,sink:1},
    {t:'ext',n:'tailfin',path:'M 0 0 L 2.2 0 L 1.55 1.75 C 1.25 1.95 1.05 1.95 0.95 1.75 Z',depth:0.12,bevel:[0.02,0.02],r:[0,90,0],p:[0,2.85,-4.2],m:'shipHull',sink:1},
    {t:'box',n:'finLight',p:[0,4.55,-5.35],s:[0.08,0.08,0.08],m:'lightW',sink:1},
    /* 货舱吊舱 + 警示条 */
    {t:'box',n:'pod',p:[0.95,1.15,-0.8],s:[0.7,0.55,2.6],m:'shipDark'},
    {t:'box',n:'podStripe',p:[0.95,1.15,0.55],s:[0.72,0.12,0.14],m:'caution',sink:1},
    /* 背部散热板 / 对接环 / 天线 / RCS */
    {t:'box',n:'radiator',p:[0.45,2.95,-2],r:[0,0,8],s:[0.7,0.05,1.8],m:'solar',sink:1},
    {t:'torus',n:'dockRing',p:[0,3,0.6],r:[90,0,0],s:[0.5,0.07],m:'darkMetal',sink:1},
    {t:'box',n:'blade',p:[0,3.1,1.8],s:[0.04,0.35,0.6],m:'shipDark',sink:1},
    {t:'box',n:'rcsA',p:[0.75,2.5,5],r:[0,0,-20],s:[0.2,0.14,0.3],m:'gunmetal',sink:1},
    {t:'box',n:'rcsB',p:[0.9,2.2,-6.2],r:[0,0,15],s:[0.2,0.14,0.3],m:'gunmetal',sink:1},
    {t:'box',n:'floodlight',p:[0,1.07,2.2],s:[0.3,0.05,0.12],m:'lightW',sink:1},
    /* 起落架（可动组）：前起落架 */
    {t:'cyl',n:'strutN',g:'gear_n',p:[0,-0.7,0],s:[0.08,0.08,1.4],m:'rim',seg:10},
    {t:'box',n:'kneeN',g:'gear_n',p:[0,-0.35,0.1],r:[25,0,0],s:[0.08,0.5,0.08],m:'darkMetal'},
    {t:'lathe',n:'padN',g:'gear_n',path:'M 0 0 L 0.4 0 L 0.26 0.15 L 0 0.17',seg:14,p:[0,-1.4,0],m:'darkMetal'},
    /* 主起落架 ×2 */
    {t:'cyl',n:'strutM',g:'gear_l',p:[0,-0.45,0],s:[0.09,0.09,0.9],m:'rim',seg:10},
    {t:'box',n:'kneeM',g:'gear_l',p:[0.12,-0.25,0],r:[0,0,30],s:[0.08,0.5,0.08],m:'darkMetal'},
    {t:'lathe',n:'padM',g:'gear_l',path:'M 0 0 L 0.44 0 L 0.3 0.16 L 0 0.18',seg:14,p:[0,-0.9,0],m:'darkMetal'},
  ]
});

/* ---------- 能量手枪 MK-Ⅱ（第一人称视模，grid 0.005 保留细小零件）
   可动组: slide=滑套后坐 mag=弹匣换弹。+Z 为枪口方向 ---------- */
DEFS.gun=()=>({name:'gun',noShadow:true,grid:0.005,
  pivots:{
    slide:{p:[0,0.09,0]},
    mag:{p:[0,-0.02,-0.09]},
  },
  parts:[
  /* 机匣 */
  {t:'box',n:'receiver',p:[0,0.01,0.05],s:[0.075,0.09,0.4],m:'gunmetal'},
  {t:'box',n:'dustCover',p:[0,-0.045,0.16],s:[0.07,0.03,0.18],m:'darkMetal',sink:1},
  {t:'box',n:'railTop',p:[0,0.062,0.06],s:[0.05,0.014,0.3],m:'darkMetal',sink:1},
  /* 枪管组 */
  {t:'cyl',n:'barrel',p:[0,0.045,0.35],r:[90,0,0],s:[0.02,0.02,0.34],m:'darkMetal',seg:12,sink:1},
  {t:'lathe',n:'muzzleBrake',path:'M 0 0 L 0.032 0 L 0.032 0.02 L 0.024 0.03 L 0.032 0.045 L 0.032 0.075 L 0.024 0.08 L 0 0.08',seg:12,cs:4,r:[90,0,0],p:[0,0.045,0.51],m:'gunmetal'},
  {t:'cyl',n:'emitter',p:[0,0.045,0.53],r:[90,0,0],s:[0.014,0.014,0.02],m:'lightC',seg:8,sink:1},
  {t:'box',n:'shroud',p:[0.032,0.045,0.3],s:[0.012,0.05,0.22],m:'gunmetal',sink:1},
  {t:'cyl',n:'gasTube',p:[0,0.085,0.32],r:[90,0,0],s:[0.011,0.011,0.18],m:'rim',sink:1,seg:8},
  /* 滑套（后坐动画组） */
  {t:'box',n:'slideBody',g:'slide',p:[0,0,0.04],s:[0.082,0.055,0.34],m:'darkMetal'},
  {t:'box',n:'slideTop',g:'slide',p:[0,0.032,0.02],s:[0.06,0.024,0.28],m:'gunmetal',sink:1},
  ...[0,1,2,3,4].map(i=>({t:'box',n:'serr'+i,g:'slide',p:[0.042,0,-0.08-i*0.022],s:[0.004,0.04,0.012],m:'rim',sink:1})),
  {t:'box',n:'ejPort',g:'slide',p:[0.042,0.012,0.09],s:[0.004,0.026,0.09],m:'lightO',sink:1},
  {t:'box',n:'rearSightL',g:'slide',p:[0.018,0.042,-0.15],s:[0.012,0.022,0.02],m:'darkMetal'},
  {t:'box',n:'rearSightR',g:'slide',p:[-0.018,0.042,-0.15],s:[0.012,0.022,0.02],m:'darkMetal'},
  /* 准星 */
  {t:'box',n:'frontSight',p:[0,0.125,0.42],s:[0.012,0.03,0.015],m:'darkMetal'},
  {t:'sph',n:'dot',s:[0.006],p:[0,0.132,0.408],m:'lightR',seg:6,sink:1},
  /* 弹匣（换弹动画组）：能量电池 */
  {t:'box',n:'magBody',g:'mag',p:[0,-0.08,0.06],r:[8,0,0],s:[0.055,0.16,0.07],m:'darkMetal'},
  {t:'box',n:'magCell',g:'mag',p:[0.029,-0.08,0.06],r:[8,0,0],s:[0.004,0.12,0.045],m:'lightC',sink:1},
  {t:'box',n:'magBase',g:'mag',p:[0,-0.165,0.048],r:[8,0,0],s:[0.065,0.022,0.085],m:'gunmetal'},
  /* 握把/扳机/击锤 */
  {t:'ext',n:'grip',path:'M 0 0 L 0.12 0.01 L 0.19 -0.17 C 0.19 -0.2 0.16 -0.21 0.13 -0.2 L 0.02 -0.19 Z',depth:0.062,r:[0,90,0],p:[0,-0.03,-0.12],m:'seat'},
  ...[0,1,2].map(i=>({t:'box',n:'gr'+i,p:[0.032,-0.1-i*0.032,-0.157-i*0.011],r:[18,0,0],s:[0.004,0.014,0.05],m:'darkMetal',sink:1})),
  {t:'torus',n:'trigGuard',s:[0.045,0.008],r:[0,90,0],p:[0,-0.06,0.03],m:'gunmetal',sink:1},
  {t:'box',n:'trig',p:[0,-0.05,0.03],r:[12,0,0],s:[0.012,0.035,0.012],m:'rim',sink:1},
  {t:'box',n:'hammer',p:[0,0.055,-0.155],r:[-24,0,0],s:[0.018,0.035,0.012],m:'rim',sink:1},
  /* 侧面能量指示条 */
  {t:'box',n:'chargeBar',p:[0.04,0.005,0],s:[0.004,0.02,0.14],m:'lightC',sink:1},
]});

/* ---------- 程序化散布植被/岩石（规则铺设的零件原型） ---------- */
DEFS.tree_conifer=()=>({name:'conifer',parts:[
  {t:'cyl',n:'trunk',s:[0.14,0.22,1.6],p:[0,0.8,0],m:'trunkDark',seg:7},
  {t:'cone',n:'c1',s:[1.35,2.2],p:[0,2.4,0],m:'leafB',seg:9},
  {t:'cone',n:'c2',s:[1.0,1.8],p:[0,3.6,0],m:'leafA',seg:9},
  {t:'cone',n:'c3',s:[0.62,1.3],p:[0,4.7,0],m:'leafB',seg:8},
]});
DEFS.tree_broadleaf=()=>({name:'broadleaf',parts:[
  {t:'cyl',n:'trunk',s:[0.16,0.26,2.2],p:[0,1.1,0],m:'trunk',seg:7},
  {t:'sph',n:'b1',s:[1.5],e:[1,0.82,1],p:[0,3.1,0],m:'leafA',seg:9},
  {t:'sph',n:'b2',s:[1.0],p:[0.85,2.6,0.3],m:'leafB',seg:8,sink:1},
  {t:'sph',n:'b3',s:[0.9],p:[-0.6,2.7,-0.55],m:'leafA',seg:8,sink:1,nomir:true},
]});
DEFS.tree_palm=()=>({name:'palm',parts:[
  {t:'cyl',n:'t1',s:[0.13,0.2,1.6],p:[0,0.8,0],r:[0,0,7],m:'trunk',seg:7,nomir:true},
  {t:'cyl',n:'t2',s:[0.11,0.13,1.5],p:[0.3,2.2,0],r:[0,0,14],m:'trunk',seg:7,nomir:true},
  {t:'sph',n:'crown',s:[0.3],p:[0.65,2.9,0],m:'trunkDark',seg:6,nomir:true,sink:1},
  ...[0,60,120,180,240,300].map(a=>({t:'plane',n:'frond',s:[1.1,2.4],p:[0.65+Math.sin(a*DEG)*0.9,2.9,Math.cos(a*DEG)*0.9],r:[70,a,0],m:'frond',nomir:true,sink:1})),
]});
DEFS.tree_cactus=()=>({name:'cactus',parts:[
  {t:'cyl',n:'main',s:[0.35,0.4,2.6],p:[0,1.3,0],m:'cactus',seg:9},
  {t:'cyl',n:'armL',s:[0.2,0.22,1.1],p:[0.55,1.8,0],r:[0,0,-30],m:'cactus',seg:8,nomir:true},
  {t:'sph',n:'top',s:[0.35],p:[0,2.6,0],m:'cactus',seg:8,sink:1},
]});
DEFS.tree_dead=()=>({name:'dead',parts:[
  {t:'cyl',n:'trunk',s:[0.12,0.24,2.4],p:[0,1.2,0],m:'trunkDark',seg:7},
  {t:'cyl',n:'br1',s:[0.06,0.1,1.3],p:[0.4,2.4,0],r:[0,0,-38],m:'trunkDark',seg:6,nomir:true},
  {t:'cyl',n:'br2',s:[0.05,0.08,1.0],p:[-0.3,2.0,0.2],r:[25,0,30],m:'trunkDark',seg:6,nomir:true},
]});
DEFS.mushroom=()=>({name:'mushroom',parts:[
  {t:'lathe',n:'body',path:'M 0 0 L 0.22 0 L 0.18 1.3 C 0.7 1.25 1.05 1.45 1.1 1.8 C 1.05 2.05 0.6 2.15 0 2.15',seg:12,cs:6,m:'toxicShroom'},
  {t:'sph',n:'glow',s:[0.16],p:[0,1.85,0],m:'lightC',seg:6,sink:1},
]});
DEFS.crystal=()=>({name:'crystal',parts:[
  {t:'ext',n:'c1',path:'M 0.35 0 L 0.62 0.5 L 0.35 2.2 L 0.08 0.5 Z',depth:0.5,r:[0,0,8],m:'crystalE'},
  {t:'ext',n:'c2',path:'M 0.2 0 L 0.4 0.3 L 0.2 1.3 L 0.02 0.3 Z',depth:0.35,r:[0,40,-24],p:[0.45,0,0.2],m:'crystalE',nomir:true},
  {t:'ext',n:'c3',path:'M 0.15 0 L 0.32 0.25 L 0.15 1 L 0 0.25 Z',depth:0.3,r:[12,-30,30],p:[-0.4,0,-0.1],m:'crystalE',nomir:true},
]});
DEFS.iceSpike=()=>({name:'iceSpike',parts:[
  {t:'cone',n:'s1',s:[0.55,3.2],p:[0,1.6,0],m:'iceMat',seg:7},
  {t:'cone',n:'s2',s:[0.3,1.7],p:[0.5,0.85,0.2],r:[0,0,-14],m:'iceMat',seg:6,nomir:true},
]});
DEFS.boulder=()=>({name:'boulder',parts:[
  {t:'sph',n:'r1',s:[1],e:[1,0.72,0.85],p:[0,0.5,0],m:'rockMat',seg:7},
  {t:'sph',n:'r2',s:[0.55],e:[1,0.7,1],p:[0.8,0.3,0.3],m:'rockMat',seg:6,nomir:true},
]});
DEFS.bush=()=>({name:'bush',parts:[
  {t:'sph',n:'b1',s:[0.55],e:[1,0.7,1],p:[0,0.35,0],m:'leafB',seg:7},
  {t:'sph',n:'b2',s:[0.4],e:[1,0.7,1],p:[0.4,0.28,0.2],m:'leafA',seg:6,nomir:true},
]});
DEFS.gasOrb=()=>({name:'gasOrb',noShadow:true,parts:[
  {t:'cyl',n:'stalk',s:[0.04,0.07,2.6],p:[0,1.3,0],m:'toxicShroom',seg:6},
  {t:'sph',n:'orb',s:[0.5],p:[0,2.9,0],m:'lightO',seg:8},
]});
DEFS.lavaSpike=()=>({name:'lavaSpike',parts:[
  {t:'cone',n:'s1',s:[0.7,2.8],p:[0,1.4,0],m:'obsidian',seg:7},
  {t:'sph',n:'tip',s:[0.18],p:[0,2.75,0],m:'lightLava',seg:6,sink:1},
]});

/* ---------- 地表小品（草丛/碎石） ---------- */
DEFS.grassTuft=()=>({name:'grassTuft',noShadow:true,parts:[
  {t:'plane',n:'g1',s:[1.3,1.0],p:[0,0.5,0],m:'tuft',nomir:true},
  {t:'plane',n:'g2',s:[1.3,1.0],p:[0,0.5,0],r:[0,90,0],m:'tuft',nomir:true,sink:1},
  {t:'plane',n:'g3',s:[1.1,0.85],p:[0,0.4,0],r:[0,45,0],m:'tuft',nomir:true,sink:1},
]});
DEFS.pebbles=()=>({name:'pebbles',parts:[
  {t:'sph',n:'p1',s:[0.3],e:[1,0.6,0.85],p:[0,0.12,0],m:'rockMat',seg:6},
  {t:'sph',n:'p2',s:[0.2],e:[1,0.55,1],p:[0.45,0.08,0.2],m:'rockMat',seg:5,nomir:true,sink:1},
  {t:'sph',n:'p3',s:[0.16],e:[1,0.6,0.9],p:[-0.35,0.06,-0.3],m:'rockMat',seg:5,nomir:true,sink:1},
  {t:'sph',n:'p4',s:[0.13],e:[1,0.5,1],p:[0.15,0.05,-0.45],m:'rockMat',seg:5,nomir:true,sink:1},
]});

/* ---------- 生态奇观（低密度大尺度地标，制造天际线惊艳感） ---------- */
/* 参天巨树：40m级，双层冠 + 发光果实（温带/森林） */
DEFS.megaTree=()=>({name:'megaTree',parts:[
  {t:'lathe',n:'trunk',path:'M 0 0 L 2.6 0 C 1.6 2 1.2 6 1.05 12 L 0.8 24 L 0 25',seg:12,cs:8,m:'trunkDark',uvs:[3,6]},
  ...[0,72,144,216,288].map(a=>({t:'cyl',n:'root',s:[0.5,1.1,3.2],p:[Math.sin(a*DEG)*2.2,1.2,Math.cos(a*DEG)*2.2],r:[Math.cos(a*DEG)*22,0,-Math.sin(a*DEG)*22],m:'trunkDark',seg:7,nomir:true,sink:1})),
  ...[0,80,150,230,300].map((a,i)=>({t:'cyl',n:'branch'+i,s:[0.22,0.42,7],p:[Math.sin(a*DEG)*3.4,15+i*1.7,Math.cos(a*DEG)*3.4],r:[Math.cos(a*DEG)*58,0,-Math.sin(a*DEG)*58],m:'trunk',seg:6,nomir:true,sink:1})),
  {t:'sph',n:'crownTop',s:[7.5],e:[1,0.62,1],p:[0,26,0],m:'leafA',seg:12,sink:1},
  ...[0,80,150,230,300].map((a,i)=>({t:'sph',n:'crown'+i,s:[4.6],e:[1,0.58,1],p:[Math.sin(a*DEG)*6.2,17.5+i*1.7,Math.cos(a*DEG)*6.2],m:i%2?'leafA':'leafB',seg:10,nomir:true,sink:1})),
  ...[30,120,200,275,340].map((a,i)=>({t:'sph',n:'fruit'+i,s:[0.5],p:[Math.sin(a*DEG)*5.4,16+i*2.1,Math.cos(a*DEG)*5.4],m:'lightC',seg:6,nomir:true,sink:1})),
]});
/* 天然石拱门：25m级（岩石/沙漠/海岛） */
DEFS.rockArch=()=>({name:'rockArch',parts:[
  {t:'torus',n:'arch',s:[9,2.2],arc:180,seg:22,seg2:9,p:[0,0.5,0],m:'rockMat',uvs:[4,1]},
  {t:'sph',n:'baseL',s:[3.4],e:[1,0.7,1.2],p:[9,0.6,0],m:'rockMat',seg:8,sink:1},
  {t:'sph',n:'rubbleA',s:[1.1],e:[1,0.6,1],p:[6.5,0.3,2.2],m:'rockMat',seg:6,nomir:true,sink:1},
  {t:'sph',n:'rubbleB',s:[0.8],e:[1,0.65,1],p:[-5.5,0.25,-2.6],m:'rockMat',seg:6,nomir:true,sink:1},
  {t:'sph',n:'capRock',s:[1.6],e:[1.3,0.65,1],p:[0,9.6,0],m:'rockMat',seg:7,sink:1},
]});
/* 远古方尖碑：黑曜石+悬浮辉光核心（沙漠） */
DEFS.obelisk=()=>({name:'obelisk',parts:[
  {t:'box',n:'plinth',p:[0,0.8,0],s:[5.2,1.6,5.2],m:'concrete'},
  {t:'box',n:'plinth2',p:[0,1.9,0],s:[3.8,1.0,3.8],m:'concrete',sink:1},
  {t:'ext',n:'spire',path:'M -1.3 0 L 1.3 0 L 0.85 14 L 0.45 15.5 L -0.45 15.5 L -0.85 14 Z',depth:2.2,bevel:[0.06,0.06],p:[0,2.4,0],m:'obsidian'},
  {t:'box',n:'glyphA',p:[0,6,1.2],s:[0.5,4.5,0.1],m:'lightC',sink:1},
  {t:'box',n:'glyphB',p:[1.15,9,0],r:[0,90,0],s:[0.4,3.2,0.1],m:'lightC',sink:1},
  {t:'sph',n:'core',s:[0.9],p:[0,19.4,0],m:'lightC',seg:10},
  {t:'torus',n:'haloRing',s:[1.7,0.12],r:[90,0,0],p:[0,19.4,0],m:'obsidian'},
]});
/* 巨型水晶簇：15m级 内芯发光（冰封/岩石/剧毒） */
DEFS.crystalTitan=()=>({name:'crystalTitan',parts:[
  {t:'ext',n:'main',path:'M 1.6 0 L 3.1 2.6 L 1.7 13 L 0.2 2.6 Z',depth:2.6,r:[0,0,6],m:'crystalE'},
  {t:'ext',n:'second',path:'M 1 0 L 2 1.6 L 1.1 8 L 0.2 1.6 Z',depth:1.8,r:[4,35,-28],p:[2.6,0,1],m:'crystalE',nomir:true},
  {t:'ext',n:'third',path:'M 0.8 0 L 1.6 1.2 L 0.9 6 L 0.1 1.2 Z',depth:1.4,r:[10,-50,26],p:[-2.4,0,-0.8],m:'crystalE',nomir:true},
  {t:'ext',n:'fourth',path:'M 0.6 0 L 1.2 1 L 0.7 4.4 L 0.1 1 Z',depth:1.1,r:[-14,120,40],p:[0.6,0,-2.3],m:'crystalE',nomir:true,sink:1},
  {t:'sph',n:'heart',s:[1.3],p:[0,3.4,0],m:'lightC',seg:10,sink:1},
  {t:'sph',n:'rockBase',s:[3.2],e:[1,0.42,1],p:[0,0.2,0],m:'rockMat',seg:9,sink:1},
]});
/* 活火山锥：18m级 岩浆口辉光（熔岩） */
DEFS.volcanoCone=()=>({name:'volcanoCone',parts:[
  {t:'lathe',n:'cone',path:'M 0 10.2 L 2.6 10 C 4.2 8.6 6.5 5 8 1.6 C 8.6 0.8 9 0.3 9.5 0 L 0 0',seg:16,cs:8,m:'obsidian',uvs:[4,2]},
  {t:'cyl',n:'lavaPool',s:[2.3,2.3,0.5],p:[0,9.9,0],m:'lightLava',seg:14,sink:1},
  {t:'sph',n:'glowHalo',s:[3.2],e:[1,0.4,1],p:[0,10.4,0],m:'lightO',seg:10,sink:1},
  ...[20,100,190,290].map((a,i)=>({t:'ext',n:'flow'+i,path:'M 0 0 L 0.9 0 L 0.7 6.5 L 0.2 6.8 Z',depth:0.4,r:[-56,a,0],p:[Math.sin(a*DEG)*4.6,4.6,Math.cos(a*DEG)*4.6],m:'lightLava',nomir:true,sink:1})),
  ...[50,170,260].map((a,i)=>({t:'sph',n:'boulder'+i,s:[1.4],e:[1,0.7,1],p:[Math.sin(a*DEG)*8.2,0.6,Math.cos(a*DEG)*8.2],m:'obsidian',seg:7,nomir:true,sink:1})),
]});
/* 远古石阵：环形巨石+中央祭坛（苔原）。石块刻意分散不相连，sink 豁免连通检测 */
DEFS.monolith=()=>({name:'monolith',parts:[
  ...[0,45,90,135,180,225,270,315].map((a,i)=>({t:'box',n:'stone'+i,
    p:[Math.sin(a*DEG)*7.5,2.2+((i*13)%3)*0.35,Math.cos(a*DEG)*7.5],r:[(i%3-1)*4,a,(i%2)*5-2.5],
    s:[1.7,4.4+((i*7)%3)*0.8,0.9],m:'rockMat',nomir:true,sink:1})),
  ...[0,90,180,270].map((a,i)=>({t:'box',n:'lintel'+i,
    p:[Math.sin((a+22.5)*DEG)*7.3,4.9,Math.cos((a+22.5)*DEG)*7.3],r:[0,a+22.5,0],
    s:[1.4,0.8,6.2],m:'rockMat',nomir:true,sink:1})),
  {t:'cyl',n:'altar',s:[2.2,2.6,1.1],p:[0,0.55,0],m:'concrete',seg:10,sink:1},
  {t:'sph',n:'orb',s:[0.75],p:[0,2.05,0],m:'lightC',seg:10,sink:1},
]});
/* 巨型荧光蘑菇：12m级（剧毒） */
DEFS.megaShroom=()=>({name:'megaShroom',parts:[
  {t:'lathe',n:'stem',path:'M 0 0 L 1.5 0 C 1.05 1.5 0.85 4 0.8 7.5 C 3.6 7.2 5.6 8.2 5.9 10 C 5.6 11.4 3.2 12 0 12',seg:14,cs:8,m:'toxicShroom',uvs:[2,2]},
  {t:'torus',n:'gill',s:[3.4,0.3],r:[90,0,0],p:[0,8.6,0],m:'lightC',sink:1},
  {t:'torus',n:'gill2',s:[2.2,0.24],r:[90,0,0],p:[0,8.2,0],m:'lightC',sink:1},
  ...[0,72,144,216,288].map((a,i)=>({t:'sph',n:'spot'+i,s:[0.55],p:[Math.sin(a*DEG)*3.8,10.9,Math.cos(a*DEG)*3.8],m:'lightC',seg:6,nomir:true,sink:1})),
  {t:'sph',n:'cap',s:[0.9],p:[0,12,0],m:'lightO',seg:8,sink:1},
  ...[40,160,280].map((a,i)=>({t:'lathe',n:'baby'+i,path:'M 0 0 L 0.5 0 L 0.35 1.6 C 1.1 1.55 1.5 1.9 1.55 2.4 C 1.5 2.75 0.9 2.9 0 2.9',seg:9,p:[Math.sin(a*DEG)*4.5,0,Math.cos(a*DEG)*4.5],m:'toxicShroom',nomir:true,sink:1})),
]});

/* ---------- 殖民地建筑 ---------- */
DEFS.habDome=()=>({name:'habDome',parts:[
  {t:'cyl',n:'base',s:[4.2,4.5,1.2],p:[0,0.6,0],m:'concrete',seg:20},
  {t:'sph',n:'dome',s:[4.0],ang:[0,360,0,88],p:[0,1.2,0],m:'domeM',seg:20},
  {t:'sph',n:'glassCap',s:[1.6],ang:[0,360,0,80],p:[0,4.6,0],m:'glass',seg:14,sink:1},
  {t:'box',n:'door',p:[0,1.3,4.15],s:[1.6,2.2,0.5],m:'shipDark',sink:1},
  {t:'box',n:'doorPanel',p:[0,1.2,4.45],s:[1.1,1.8,0.1],m:'lightC',sink:1},
  {t:'cyl',n:'vent',s:[0.4,0.4,1.4],p:[2.4,4,0],r:[0,0,-30],m:'darkMetal',seg:10,sink:1},
]});
DEFS.habBlock=()=>({name:'habBlock',parts:[
  {t:'box',n:'b1',p:[0,2.2,0],s:[7,4.4,5.5],m:'wallA',uvs:[2,1]},
  {t:'box',n:'b2',p:[1.2,6,0.4],s:[4.4,3.2,4.4],m:'wallB',nomir:true},
  {t:'box',n:'roofRim',p:[0,4.5,0],s:[7.3,0.24,5.8],m:'darkMetal'},
  {t:'box',n:'ac',p:[-0.4,7.85,0.5],s:[1.1,0.7,1.1],m:'darkMetal',nomir:true},
  {t:'cyl',n:'antenna',s:[0.05,0.05,2.6],p:[2.6,8.8,1.4],m:'rim',seg:6,nomir:true},
  {t:'box',n:'doorway',p:[0,1.15,2.8],s:[2,2.3,0.35],m:'shipDark',sink:1},
  {t:'box',n:'sign',p:[0,3.6,2.8],s:[2.6,1.2,0.15],m:'signNeon',sink:1},
]});
DEFS.tower=()=>({name:'tower',parts:[
  {t:'cyl',n:'shaft',s:[1.6,2.2,11],p:[0,5.5,0],m:'wallA',seg:14,uvs:[3,3]},
  {t:'cyl',n:'obsRing',s:[2.6,2.2,1.8],p:[0,11.5,0],m:'glassDark',seg:14},
  {t:'cyl',n:'cap',s:[2.7,2.7,0.5],p:[0,12.6,0],m:'darkMetal',seg:14},
  {t:'lathe',n:'dish',path:'M 0 0 L 1.3 0.5 L 1.2 0.62 L 0 0.2',seg:14,r:[0,0,-40],p:[1.6,13,0],m:'white',nomir:true},
  {t:'box',n:'beacon',p:[0,13.05,0],s:[0.2,0.5,0.2],m:'lightR'},
]});
DEFS.hangar=()=>({name:'hangar',parts:[
  {t:'ext',n:'arch',path:'M -5 0 L -5 2.5 C -5 5.5 -2.5 6.5 0 6.5 C 2.5 6.5 5 5.5 5 2.5 L 5 0 L 3.9 0 L 3.9 2.5 C 3.9 4.6 2.2 5.4 0 5.4 C -2.2 5.4 -3.9 4.6 -3.9 2.5 L -3.9 0 Z',depth:12,bevel:[0.06,0.06],m:'wallA',cs:8},
  {t:'box',n:'backwall',p:[0,2.7,-5.7],s:[9.8,5.4,0.5],m:'wallB',sink:1},
  {t:'box',n:'doorTrack',p:[0,5.6,6.1],s:[10.4,0.4,0.4],m:'caution',sink:1},
  {t:'box',n:'sideDoor',p:[4.4,1.2,6.05],s:[1.4,2.4,0.3],m:'shipDark',nomir:true},
]});
DEFS.tankBig=()=>({name:'tankBig',parts:[
  {t:'lathe',n:'tank',path:'M 0 0.4 L 1.7 0.4 C 2.05 0.6 2.05 1 2.05 1.4 L 2.05 4.6 C 2.05 5 2.05 5.4 1.7 5.6 L 0 5.6',seg:18,cs:8,m:'barrel'},
  {t:'cyl',n:'legA',s:[0.09,0.09,0.5],p:[1.5,0.25,0],m:'darkMetal',seg:8},
  {t:'cyl',n:'legB',s:[0.09,0.09,0.5],p:[0,0.25,1.5],m:'darkMetal',seg:8},
  {t:'cyl',n:'legC',s:[0.09,0.09,0.5],p:[0,0.25,-1.5],m:'darkMetal',seg:8},
  {t:'cyl',n:'pipe',s:[0.12,0.12,2.6],p:[1.9,1.3,0],r:[0,0,12],m:'rim',seg:8,nomir:true},
  {t:'torus',n:'valve',s:[0.22,0.045],p:[2.2,2.6,0],r:[0,0,90],m:'accent',nomir:true},
]});
DEFS.lampPost=()=>({name:'lampPost',parts:[
  {t:'lathe',n:'pole',path:'M 0 0 L 0.14 0 L 0.09 0.5 L 0.07 4.6 L 0 4.65',seg:8,m:'darkMetal'},
  {t:'box',n:'arm',p:[0,4.5,0.5],s:[0.08,0.08,1.1],m:'darkMetal',nomir:true},
  {t:'box',n:'head',p:[0,4.42,1.05],s:[0.3,0.1,0.5],m:'lampHead',nomir:true},
]});
DEFS.crateStack=()=>({name:'crateStack',parts:[
  {t:'box',n:'c1',p:[0,0.45,0],s:[0.9,0.9,0.9],m:'crate'},
  {t:'box',n:'c2',p:[0.95,0.4,0.1],r:[0,18,0],s:[0.8,0.8,0.8],m:'crate',nomir:true},
  {t:'box',n:'c3',p:[0.3,1.25,0],r:[0,-10,0],s:[0.7,0.7,0.7],m:'crate',nomir:true},
]});
DEFS.barrelProp=()=>({name:'barrelProp',parts:[
  {t:'lathe',n:'b',path:'M 0 0 L 0.32 0 C 0.4 0.15 0.4 0.85 0.32 1 L 0 1',seg:12,m:'barrel'},
]});
DEFS.beacon=()=>({name:'beacon',parts:[
  {t:'cyl',n:'tri',s:[0.06,0.5,1.6],p:[0,0.8,0],m:'darkMetal',seg:5},
  {t:'sph',n:'light',s:[0.14],p:[0,1.7,0],m:'lightO',seg:8},
]});

/* ---------- 座舱内饰（挂相机、仅第一人称显示；相机朝 -Z，单位:米） ---------- */
DEFS.cockpit=()=>({
  name:'cockpit',grid:0.005,
  parts:[
    /* 主仪表台 */
    {t:'box',n:'dashTop',p:[0,-0.36,-0.86],r:[-14,0,0],s:[1.42,0.06,0.42],m:'shipDark'},
    {t:'box',n:'dashBody',p:[0,-0.52,-0.78],r:[-6,0,0],s:[1.5,0.3,0.4],m:'shipDark'},
    {t:'box',n:'dashTrim',p:[0,-0.335,-0.66],r:[-14,0,0],s:[1.42,0.02,0.03],m:'accent',sink:1},
    /* 屏幕：中央 + 两侧内倾（自动镜像出右侧） */
    {t:'box',n:'scrC',p:[0,-0.365,-0.755],r:[-32,0,0],s:[0.45,0.2,0.015],m:'dashE'},
    {t:'box',n:'scrS',p:[0.45,-0.375,-0.72],r:[-30,-16,0],s:[0.3,0.17,0.015],m:'dashE'},
    /* 仪表灯组 */
    {t:'box',n:'lampsA',p:[0.24,-0.3,-0.84],r:[-14,0,0],s:[0.1,0.01,0.03],m:'lightC',sink:1},
    {t:'box',n:'lampsB',p:[0.1,-0.3,-0.84],r:[-14,0,0],s:[0.05,0.01,0.03],m:'lightR',sink:1},
    /* 操纵杆（右侧，不镜像） */
    {t:'cyl',n:'stickBase',p:[0.3,-0.53,-0.5],s:[0.06,0.05,0.05],m:'darkMetal',seg:10,nomir:1},
    {t:'cyl',n:'stick',p:[0.3,-0.45,-0.51],r:[12,0,0],s:[0.016,0.016,0.15],m:'gunmetal',seg:8,nomir:1},
    {t:'sph',n:'stickTop',p:[0.3,-0.375,-0.53],s:[0.032,0.04,0.032],m:'darkMetal',nomir:1},
    {t:'box',n:'stickBtn',p:[0.3,-0.36,-0.545],s:[0.012,0.008,0.012],m:'lightR',nomir:1,sink:1},
    /* 油门杆（左侧，不镜像） */
    {t:'box',n:'thrBase',p:[-0.3,-0.53,-0.5],s:[0.09,0.04,0.14],m:'darkMetal',nomir:1},
    {t:'box',n:'thrLever',p:[-0.3,-0.45,-0.52],r:[-28,0,0],s:[0.03,0.12,0.02],m:'gunmetal',nomir:1},
    {t:'box',n:'thrKnob',p:[-0.3,-0.395,-0.545],s:[0.05,0.03,0.04],m:'accent',nomir:1},
    /* 舱盖框架：A柱（镜像）+ 顶梁 + 前下沿 */
    {t:'box',n:'pillar',p:[0.66,0.06,-0.62],r:[-38,20,8],s:[0.05,0.72,0.06],m:'shipDark'},
    {t:'box',n:'topBeam',p:[0,0.5,-0.42],r:[16,0,0],s:[1.34,0.05,0.07],m:'shipDark'},
    {t:'box',n:'botBeam',p:[0,-0.24,-0.98],r:[-10,0,0],s:[1.5,0.05,0.05],m:'shipDark'},
    /* 侧壁 + 侧操作板 + 扶手（镜像） */
    {t:'box',n:'sideWall',p:[0.74,-0.12,-0.25],r:[0,10,0],s:[0.05,0.56,0.85],m:'darkMetal'},
    {t:'box',n:'sidePanel',p:[0.68,-0.34,-0.3],r:[0,10,-8],s:[0.03,0.12,0.5],m:'dashE'},
    {t:'box',n:'armrest',p:[0.46,-0.5,-0.12],s:[0.1,0.06,0.44],m:'seat'},
    /* 顶部舱灯 */
    {t:'box',n:'cabinLight',p:[0,0.485,-0.35],r:[16,0,0],s:[0.4,0.015,0.03],m:'lightC',sink:1},
  ]
});

/* ---------- 矿物节点（岩基+专属晶簇/矿脉）与草药 ---------- */
DEFS.oreIron=()=>({name:'oreIron',parts:[
  {t:'sph',n:'base',p:[0,0.45,0],s:[1.1,0.7,0.95],m:'rockMat'},
  {t:'box',n:'vein1',p:[0.35,0.6,0.2],r:[20,30,10],s:[0.5,0.18,0.3],m:'oreFe',sink:1},
  {t:'box',n:'vein2',p:[-0.3,0.5,-0.25],r:[-15,60,0],s:[0.4,0.15,0.25],m:'oreFe',sink:1,nomir:1},
  {t:'box',n:'vein3',p:[0,0.85,0],r:[40,15,25],s:[0.3,0.14,0.2],m:'oreFe',sink:1},
]});
DEFS.oreAlum=()=>({name:'oreAlum',parts:[
  {t:'sph',n:'base',p:[0,0.4,0],s:[1.0,0.65,0.9],m:'rockMat'},
  {t:'box',n:'slab1',p:[0.3,0.65,0.15],r:[12,40,6],s:[0.55,0.1,0.4],m:'oreAl',sink:1},
  {t:'box',n:'slab2',p:[-0.25,0.5,-0.2],r:[-10,70,0],s:[0.45,0.1,0.35],m:'oreAl',sink:1,nomir:1},
  {t:'box',n:'slab3',p:[0.05,0.8,-0.1],r:[35,20,15],s:[0.35,0.08,0.3],m:'oreAl',sink:1,nomir:1},
]});
DEFS.oreSilver=()=>({name:'oreSilver',parts:[
  {t:'sph',n:'base',p:[0,0.42,0],s:[1.0,0.68,0.9],m:'rockMat'},
  {t:'box',n:'vein1',p:[0.3,0.6,0.2],r:[25,35,12],s:[0.45,0.14,0.26],m:'oreAg',sink:1},
  {t:'box',n:'vein2',p:[-0.28,0.52,-0.2],r:[-18,55,5],s:[0.4,0.12,0.22],m:'oreAg',sink:1,nomir:1},
  {t:'cone',n:'spk',p:[0,0.85,0.1],r:[15,0,-10],s:[0.12,0.35,0.12],m:'oreAg',seg:6,sink:1},
]});
DEFS.oreGold=()=>({name:'oreGold',parts:[
  {t:'sph',n:'base',p:[0,0.42,0],s:[1.05,0.66,0.92],m:'rockMat'},
  {t:'box',n:'vein1',p:[0.32,0.58,0.18],r:[22,30,8],s:[0.48,0.15,0.28],m:'oreAu',sink:1},
  {t:'box',n:'vein2',p:[-0.26,0.5,-0.22],r:[-14,65,4],s:[0.4,0.13,0.24],m:'oreAu',sink:1,nomir:1},
  {t:'sph',n:'nug',p:[0.1,0.82,0.05],s:[0.16,0.13,0.15],m:'oreAu',sink:1,nomir:1},
]});
DEFS.oreDiamond=()=>({name:'oreDiamond',parts:[
  {t:'sph',n:'base',p:[0,0.4,0],s:[1.0,0.6,0.9],m:'rockMat'},
  {t:'cone',n:'c1',p:[0.2,0.9,0.1],r:[10,0,-8],s:[0.22,0.7,0.22],m:'oreDia',seg:6,sink:1},
  {t:'cone',n:'c2',p:[-0.25,0.75,-0.15],r:[-12,30,14],s:[0.16,0.5,0.16],m:'oreDia',seg:6,sink:1,nomir:1},
  {t:'cone',n:'c3',p:[0,0.7,0.3],r:[24,0,6],s:[0.13,0.4,0.13],m:'oreDia',seg:6,sink:1,nomir:1},
]});
DEFS.oreUran=()=>({name:'oreUran',parts:[
  {t:'sph',n:'base',p:[0,0.42,0],s:[1.05,0.65,0.95],m:'rockMat'},
  {t:'cone',n:'c1',p:[0.22,0.8,0.1],r:[8,0,-10],s:[0.26,0.45,0.26],m:'oreU',seg:6,sink:1},
  {t:'cone',n:'c2',p:[-0.24,0.7,-0.12],r:[-10,40,12],s:[0.2,0.35,0.2],m:'oreU',seg:6,sink:1,nomir:1},
  {t:'sph',n:'blob',p:[0,0.75,0.25],s:[0.18,0.14,0.18],m:'oreU',sink:1,nomir:1},
]});
DEFS.herbPlant=()=>({name:'herbPlant',parts:[
  {t:'cyl',n:'stem',p:[0,0.35,0],s:[0.04,0.04,0.7],m:'trunk',seg:6},
  {t:'plane',n:'leafA',p:[0,0.6,0],r:[0,0,0],s:[0.9,0.9],m:'herbG',nomir:1},
  {t:'plane',n:'leafB',p:[0,0.6,0],r:[0,90,0],s:[0.9,0.9],m:'herbG',nomir:1},
  {t:'sph',n:'bud',p:[0,0.78,0],s:[0.12,0.16,0.12],m:'lightG',sink:1},
]});

/* ---------- 外星野兽（四足近战，+Z=头部朝向，与漫游车同约定） ---------- */
DEFS.beast=()=>({name:'beast',parts:[
  {t:'sph',n:'body',p:[0,0.95,0],s:[0.75,0.65,1.15],m:'toxicShroom'},
  {t:'sph',n:'head',p:[0,1.15,1.05],s:[0.42,0.38,0.45],m:'toxicShroom'},
  {t:'sph',n:'eyeL',p:[0.18,1.22,1.4],s:[0.07,0.07,0.07],m:'lightR',sink:1},
  {t:'cone',n:'hornL',p:[0.2,1.5,1.0],r:[-20,0,-15],s:[0.07,0.35,0.07],m:'obsidian',sink:1},
  {t:'cyl',n:'legFL',p:[0.4,0.45,0.7],s:[0.11,0.09,0.9],r:[8,0,0],m:'obsidian'},
  {t:'cyl',n:'legRL',p:[0.42,0.45,-0.6],s:[0.12,0.1,0.95],r:[-8,0,0],m:'obsidian'},
  {t:'cone',n:'tail',p:[0,0.95,-1.2],r:[-70,0,0],s:[0.12,0.7,0.12],m:'toxicShroom',sink:1},
  {t:'box',n:'plate',p:[0,1.35,0],s:[0.5,0.12,0.9],m:'obsidian',sink:1},
]});
