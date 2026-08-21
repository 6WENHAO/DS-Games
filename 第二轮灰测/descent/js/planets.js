/* ============================================================
   planets.js — 六个世界的物理 / 光学 / 气象参数
   颜色一律用 u.hexLin(hex, 亮度倍率) 转成线性辐射量
   ============================================================ */
(function (glob) {
  'use strict';
  const L = (h, m) => u.hexLin(h, m);

  /* ---------- 1. 海洋世界 ---------- */
  const THALASSA = {
    id: 'thalassa', name: '塔拉萨 IV', sub: 'OCEAN WORLD', accent: ['#0b3f6b', '#7fc8e8'],
    desc: '全球性海洋，没有一寸陆地。赤道风暴带宽三千公里，每秒上万次闪电。你会砸进浪里。',
    diff: '难度 ★★☆', gLabel: '1.13 g',
    R: 8200, g: 11.2, H: 8.2, rho0: 1.35, cSound: 305, Tsurf: 295,
    startAlt: 104000, startVel: 1240, atmTop: 105000,
    surf: 0, surfCol: L('#0c2f42', 1.0), groundGlow: 0, dust: 1.0, fogK: 0.030,
    sun: u.dir(23, 42), sunCol: L('#fff4e2', 11), aurora: 0,
    layers: [
      { base: 10.4, thick: 2.4, cov: 0.44, dens: 0.55, col: L('#eef6ff', 1.0) },
      { base: 2.3, thick: 3.4, cov: 0.60, dens: 1.45, col: L('#ffffff', 1.0) },
      { base: 0.30, thick: 0.95, cov: 0.46, dens: 0.95, col: L('#dfe9f0', 1.0) }
    ],
    pal: [
      { a: 120, zen: L('#010206', .6), hor: L('#04101d', .8), haze: L('#07182a', .9), amb: L('#0a1828', .5), exp: 1.0 },
      { a: 62, zen: L('#02102a', .9), hor: L('#0e3a63', 1.0), haze: L('#12405f', 1.0), amb: L('#123a58', .7), exp: 1.0 },
      { a: 22, zen: L('#0a3070', 1.0), hor: L('#5fa2d4', 1.0), haze: L('#6ba8cf', 1.0), amb: L('#3b7bb0', .9), exp: 1.0 },
      { a: 6.5, zen: L('#175da8', 1.0), hor: L('#a9d1e8', 1.0), haze: L('#a3c9dd', 1.0), amb: L('#6f9fc0', 1.0), exp: 1.0 },
      { a: 0, zen: L('#2a74bf', 1.0), hor: L('#cfe3ee', 1.0), haze: L('#b7d5e4', 1.0), amb: L('#7fa8c4', 1.0), exp: 1.0 }
    ],
    precip: 'rain', precipAlt: 7.0, lightning: 0.55, embers: 0,
    wind: { base: 16, shear: 26, gust: 8 },
    audio: { ambience: 'storm', windLow: 90, windMul: 1.0, rumble: .8, drone: 55 },
    objective: { type: 'splash', label: '在海面软着水（撞击 < 12 m/s）', safe: 12, hurt: 27 },
    hazard: { type: 'storm', count: 10, r: 1100, altLo: 1.2, altHi: 8.5, spread: 5200, str: 1.0 },
    beacons: 8,
    events: [
      { a: 112, t: '轨道舱已分离。<b>祝你好运，跳伞者。</b>' },
      { a: 88, t: '开始接触外层大气 — 前方等离子鞘即将形成。' },
      { a: 52, t: '<b>峰值热流</b>：保持展开姿态可降低热载。' },
      { a: 26, t: '进入平流层。下方是一整颗星球的水。' },
      { a: 12, t: '云顶就在下方。注意雷暴单体 — 雷达上的红色扇区。' },
      { a: 4.2, t: '雨。真正的雨，从下往上抽打你的面罩。' },
      { a: 1.1, t: '<b>该开伞了。</b>' }
    ]
  };

  /* ---------- 2. 气态巨行星 ---------- */
  const YMIR = {
    id: 'ymir', name: '伊米尔', sub: 'GAS GIANT', accent: ['#6b4a1e', '#f0d9a8'],
    desc: '氢氦深渊，没有底。1 巴层以下压力每十公里翻倍。任务不是着陆 —— 是活着送出数据。',
    diff: '难度 ★★★★', gLabel: '2.40 g',
    R: 58000, g: 23.5, H: 27, rho0: 0.38, cSound: 1120, Tsurf: 420,
    startAlt: 330000, startVel: 2200, atmTop: 300000,
    surf: 4, surfCol: L('#100a06', 1), groundGlow: 0, dust: 1.5, fogK: 0.012,
    sun: u.dir(13, 300), sunCol: L('#fff0d4', 4.6), aurora: 0,
    layers: [
      { base: 150, thick: 70, cov: 0.72, dens: 0.22, col: L('#f7ecd2', 1.0) },
      { base: 54, thick: 48, cov: 0.62, dens: 1.05, col: L('#f6e6c0', 1.0) },
      { base: 2, thick: 38, cov: 0.70, dens: 1.5, col: L('#c58c55', 1.0) }
    ],
    pal: [
      { a: 340, zen: L('#010104', .5), hor: L('#0a0906', .7), haze: L('#241a10', .8), amb: L('#1a1408', .4), exp: 1.0 },
      { a: 200, zen: L('#150f08', .9), hor: L('#6a5330', 1.0), haze: L('#7a6038', 1.0), amb: L('#4a3a20', .7), exp: 1.0 },
      { a: 96, zen: L('#3a3018', 1.0), hor: L('#c9ab72', 1.0), haze: L('#b89a66', 1.0), amb: L('#8a7345', .9), exp: 1.0 },
      { a: 40, zen: L('#6e5227', 1.0), hor: L('#c08c4e', 1.0), haze: L('#9c6f3c', 1.0), amb: L('#7a5730', 1.0), exp: .9 },
      { a: 4, zen: L('#3a2010', 1.0), hor: L('#5c3418', 1.0), haze: L('#4a2a12', 1.0), amb: L('#40240f', 1.0), exp: .7 },
      { a: -30, zen: L('#120806', 1.0), hor: L('#1c0c06', 1.0), haze: L('#160a05', 1.0), amb: L('#180c06', 1.0), exp: .45 }
    ],
    precip: 'ammonia', precipAlt: 110, lightning: 0.9, embers: 0,
    wind: { base: 70, shear: 130, gust: 28 },
    audio: { ambience: 'infra', windLow: 55, windMul: 1.25, rumble: 1.4, drone: 36 },
    objective: { type: 'depth', target: 0, crush: -24000, label: '下潜到 1 巴层（高度 0）并发回数据', safe: 999, hurt: 999 },
    hazard: { type: 'shear', count: 14, r: 2600, altLo: 4, altHi: 170, spread: 16000, str: 1.35 },
    beacons: 9,
    events: [
      { a: 320, t: '探测舱抛离。<b>你现在是这颗行星上唯一的固体。</b>' },
      { a: 240, t: '氨霾顶层。风速 480 米每秒 —— 相对风，你感觉不到。' },
      { a: 150, t: '<b>热流峰值</b>。2.4 g 的重力不会给你时间犹豫。' },
      { a: 96, t: '白色氨云海。下面每一层都比上一层暗。' },
      { a: 40, t: '硫氢化铵层：褐色的、带静电的、能见度归零。' },
      { a: 12, t: '接近 1 巴层。<b>准备高增益上行。</b>' },
      { a: 1.5, t: '数据链锁定 —— 保持姿态。' }
    ]
  };

  /* ---------- 3. 火山世界 ---------- */
  const ASHKELON = {
    id: 'ashkelon', name: '阿什克伦', sub: 'VOLCANIC', accent: ['#54140a', '#ff9a4d'],
    desc: '潮汐加热撕开了地壳。空气是二氧化碳和硅酸盐灰，地面在自己发光。热，是这里唯一的敌人。',
    diff: '难度 ★★★☆', gLabel: '0.88 g',
    R: 5100, g: 8.6, H: 6.4, rho0: 2.30, cSound: 252, Tsurf: 640,
    startAlt: 66000, startVel: 1080, atmTop: 82000,
    surf: 5, surfCol: L('#1a1210', 1.0), groundGlow: 1.0, dust: 1.9, fogK: 0.055,
    sun: u.dir(9, 205), sunCol: L('#ffb478', 3.6), aurora: 0,
    layers: [
      { base: 21, thick: 9, cov: 0.60, dens: 0.75, col: L('#8a7a72', 1.0) },
      { base: 3.4, thick: 5.2, cov: 0.56, dens: 1.55, col: L('#6b5148', 1.0) },
      { base: 0.15, thick: 1.4, cov: 0.52, dens: 1.10, col: L('#3a2a24', 1.0) }
    ],
    pal: [
      { a: 100, zen: L('#040203', .6), hor: L('#160804', .8), haze: L('#2a0e05', .9), amb: L('#200a04', .5), exp: 1.0 },
      { a: 52, zen: L('#150604', .9), hor: L('#5c1c08', 1.0), haze: L('#6a2409', 1.0), amb: L('#431606', .8), exp: 1.0 },
      { a: 18, zen: L('#3c1006', 1.0), hor: L('#a83c12', 1.0), haze: L('#8e3410', 1.0), amb: L('#6e2a0c', 1.0), exp: 1.0 },
      { a: 5, zen: L('#5c1c08', 1.0), hor: L('#c4501c', 1.0), haze: L('#8c3612', 1.0), amb: L('#7a3010', 1.0), exp: 1.0 },
      { a: 0, zen: L('#6e2409', 1.0), hor: L('#d9662a', 1.0), haze: L('#9c4418', 1.0), amb: L('#8e3c14', 1.0), exp: 1.0 }
    ],
    precip: 'ash', precipAlt: 24, lightning: 0.35, embers: 1.0,
    wind: { base: 20, shear: 30, gust: 12 },
    audio: { ambience: 'infra', windLow: 70, windMul: 1.1, rumble: 1.6, drone: 41 },
    objective: { type: 'land', label: '落在玄武岩台地上（撞击 < 10 m/s）', safe: 10, hurt: 20 },
    hazard: { type: 'thermal', count: 11, r: 1000, altLo: 0.4, altHi: 20, spread: 4600, str: 1.2 },
    beacons: 8,
    events: [
      { a: 92, t: '轨道舱脱离。<b>下面那些橙色的线，是裂谷。</b>' },
      { a: 60, t: '大气很厚 —— 减速会很猛，热会很久。' },
      { a: 34, t: '<b>外壳温度告警。</b>张开身体，把速度扔掉。' },
      { a: 18, t: '灰幕层。能见度：糟糕。雷达是你的眼睛。' },
      { a: 6, t: '注意上升热柱 —— 那是刚从地面掀起来的一千度空气。' },
      { a: 1.6, t: '找一块黑的地方落下去。<b>亮的地方是熔岩。</b>' }
    ]
  };

  /* ---------- 4. 冰卫星 ---------- */
  const NIFLHEIM = {
    id: 'niflheim', name: '尼芙尔海姆', sub: 'ICE MOON', accent: ['#12384f', '#cfe9ff'],
    desc: '稀薄、干燥、零下一百八十度。空气太少，伞几乎抓不住东西 —— 你会一直很快。',
    diff: '难度 ★★★★', gLabel: '0.32 g',
    R: 3400, g: 3.1, H: 5.6, rho0: 0.24, cSound: 208, Tsurf: 96,
    startAlt: 84000, startVel: 900, atmTop: 62000,
    surf: 2, surfCol: L('#c9dcea', 1.0), groundGlow: 0, dust: 0.6, fogK: 0.014,
    sun: u.dir(6, 305), sunCol: L('#dceaff', 6.2), aurora: 1.0,
    layers: [
      { base: 8.6, thick: 3.2, cov: 0.36, dens: 0.42, col: L('#e8f2ff', 1.0) },
      { base: 1.1, thick: 2.6, cov: 0.50, dens: 0.90, col: L('#dbe9f7', 1.0) },
      { base: 0, thick: 0, cov: 0, dens: 0, col: L('#ffffff', 1) }
    ],
    pal: [
      { a: 90, zen: L('#01020a', .6), hor: L('#050d1c', .8), haze: L('#0a1626', .9), amb: L('#0c1524', .5), exp: 1.0 },
      { a: 44, zen: L('#040d22', .9), hor: L('#123350', 1.0), haze: L('#16384f', 1.0), amb: L('#123048', .7), exp: 1.0 },
      { a: 14, zen: L('#0b2c56', 1.0), hor: L('#5a86ad', 1.0), haze: L('#6d93b3', 1.0), amb: L('#3f6b90', .9), exp: 1.0 },
      { a: 3, zen: L('#1d4d7c', 1.0), hor: L('#9dbdd6', 1.0), haze: L('#a8c4d8', 1.0), amb: L('#7396b2', 1.0), exp: 1.0 },
      { a: 0, zen: L('#2b5f8c', 1.0), hor: L('#c4d8e6', 1.0), haze: L('#bfd3e0', 1.0), amb: L('#93b2c8', 1.0), exp: 1.0 }
    ],
    precip: 'snow', precipAlt: 4.5, lightning: 0, embers: 0,
    wind: { base: 15, shear: 26, gust: 12 },
    audio: { ambience: 'wind', windLow: 120, windMul: 0.8, rumble: .45, drone: 62 },
    objective: { type: 'land', label: '落在冰原上（撞击 < 9 m/s）', safe: 9, hurt: 18 },
    hazard: { type: 'debris', count: 11, r: 900, altLo: 0.6, altHi: 12, spread: 4200, str: 1.1 },
    beacons: 8,
    events: [
      { a: 80, t: '分离完成。<b>极光在你脚下。</b>' },
      { a: 46, t: '大气稀薄 —— 减速很晚才会到来，而且不够。' },
      { a: 20, t: '注意：本地终端速度约 50 米每秒。<b>伞必须提前开。</b>' },
      { a: 7, t: '冰晶飑线。它们像玻璃碴一样打在壳上。' },
      { a: 2.2, t: '<b>现在开伞。</b>再等就来不及了。' }
    ]
  };

  /* ---------- 5. 沙漠世界 ---------- */
  const RAKHAT = {
    id: 'rakhat', name: '拉赫特', sub: 'DESERT', accent: ['#5c3a12', '#ffd79a'],
    desc: '一颗被行星级沙暴统治的干世界。空气会把你吹到十公里外，然后再把你摔在沙丘上。',
    diff: '难度 ★★★', gLabel: '0.75 g',
    R: 6100, g: 7.4, H: 11.5, rho0: 0.55, cSound: 246, Tsurf: 318,
    startAlt: 102000, startVel: 1150, atmTop: 88000,
    surf: 3, surfCol: L('#8a5a2e', 1.0), groundGlow: 0, dust: 1.5, fogK: 0.032,
    sun: u.dir(33, 125), sunCol: L('#ffdfb2', 9), aurora: 0,
    layers: [
      { base: 13.5, thick: 10, cov: 0.62, dens: 0.48, col: L('#d9b98c', 1.0) },
      { base: 0.8, thick: 4.4, cov: 0.55, dens: 1.15, col: L('#c89a63', 1.0) },
      { base: 0, thick: 0, cov: 0, dens: 0, col: L('#ffffff', 1) }
    ],
    pal: [
      { a: 108, zen: L('#030309', .6), hor: L('#120c08', .8), haze: L('#22160c', .9), amb: L('#1c1208', .5), exp: 1.0 },
      { a: 54, zen: L('#0c0f22', .9), hor: L('#5a4326', 1.0), haze: L('#6a4e2a', 1.0), amb: L('#4a3720', .7), exp: 1.0 },
      { a: 20, zen: L('#33406e', 1.0), hor: L('#c39a63', 1.0), haze: L('#b08a56', 1.0), amb: L('#8a6c44', .9), exp: 1.0 },
      { a: 5, zen: L('#5a6c95', 1.0), hor: L('#e0b781', 1.0), haze: L('#c69a68', 1.0), amb: L('#a68054', 1.0), exp: 1.0 },
      { a: 0, zen: L('#77879f', 1.0), hor: L('#efcda0', 1.0), haze: L('#d4a878', 1.0), amb: L('#b89066', 1.0), exp: 1.0 }
    ],
    precip: 'dust', precipAlt: 18, lightning: 0.22, embers: 0,
    wind: { base: 26, shear: 44, gust: 18 },
    audio: { ambience: 'wind', windLow: 100, windMul: 1.05, rumble: .7, drone: 48 },
    objective: { type: 'land', label: '落在沙丘上（撞击 < 11 m/s）', safe: 11, hurt: 23 },
    hazard: { type: 'shear', count: 12, r: 800, altLo: 0.3, altHi: 14, spread: 4400, str: 1.0 },
    beacons: 8,
    events: [
      { a: 96, t: '分离。<b>整颗行星都是同一场沙暴。</b>' },
      { a: 58, t: '进入热层。空气稀薄但足够点火。' },
      { a: 24, t: '尘幕顶。太阳变成一枚铜钉。' },
      { a: 9, t: '<b>尘卷风</b>：雷达红点会把你抛起来，绕开它们。' },
      { a: 1.8, t: '沙丘就在下面。开伞，顺风落。' }
    ]
  };

  /* ---------- 6. 雾霾卫星（低重力 · 浓大气 · 从飞艇上迈出去） ---------- */
  const TITANIS = {
    id: 'titanis', name: '泰坦尼斯', sub: 'HAZE MOON', accent: ['#4a3308', '#ffcf7a'],
    desc: '空气浓得像水，重力轻得像玩笑。你不是从轨道掉下来 —— 是从飞艇栏杆上迈出去，然后慢慢飘向甲烷海。',
    diff: '难度 ★☆', gLabel: '0.14 g',
    R: 2570, g: 1.35, H: 21, rho0: 5.20, cSound: 198, Tsurf: 94,
    startAlt: 2800, startVel: 4, atmTop: 2800,
    surf: 0, surfCol: L('#2a1d10', 1.0), groundGlow: 0, dust: 2.2, fogK: 0.085,
    sun: u.dir(42, 95), sunCol: L('#ffc47e', 2.2), aurora: 0,
    layers: [
      { base: 1.62, thick: 1.65, cov: 0.88, dens: 0.34, col: L('#e0a662', 1.0) },
      { base: 0.86, thick: 0.80, cov: 0.50, dens: 0.80, col: L('#f0d0a0', 1.0) },
      { base: 0.10, thick: 0.55, cov: 0.42, dens: 0.55, col: L('#caa478', 1.0) }
    ],
    pal: [
      { a: 3.4, zen: L('#3a2008', .95), hor: L('#8a5c22', 1.0), haze: L('#7a5220', 1.0), amb: L('#5c3c16', .85), exp: 1.0 },
      { a: 2.2, zen: L('#6a4210', 1.0), hor: L('#d09850', 1.0), haze: L('#b07c3c', 1.0), amb: L('#8a6028', 1.0), exp: 1.0 },
      { a: 1.0, zen: L('#8a5a1c', 1.0), hor: L('#e0ac68', 1.0), haze: L('#b8823c', 1.0), amb: L('#9c6c2c', 1.0), exp: 1.0 },
      { a: 0, zen: L('#a06a24', 1.0), hor: L('#e8bc80', 1.0), haze: L('#c08c46', 1.0), amb: L('#a87830', 1.0), exp: 1.0 }
    ],
    precip: 'drizzle', precipAlt: 2.4, lightning: 0.05, embers: 0,
    wind: { base: 6, shear: 10, gust: 3 },
    audio: { ambience: 'quiet', windLow: 150, windMul: 0.7, rumble: .3, drone: 73 },
    objective: { type: 'splash', label: '落进甲烷海（撞击 < 15 m/s）', safe: 15, hurt: 30 },
    hazard: { type: 'calm', count: 9, r: 320, altLo: 0.3, altHi: 2.4, spread: 700, str: 0.5 },
    beacons: 8,
    events: [
      { a: 2.7, t: '你从飞艇栏杆上迈了出去。<b>这里没有坠落，只有下沉。</b>' },
      { a: 2.0, t: '橙色的霾。阳光只剩百分之一，但足够看清一切。' },
      { a: 1.4, t: '甲烷云。雨滴有葡萄那么大，落得比雪还慢。' },
      { a: 0.7, t: '张开双臂 —— 在这颗卫星上，人类真的能飞。' },
      { a: 0.25, t: '下面是甲烷海。<b>轻轻地落进去。</b>' }
    ]
  };

  const list = [THALASSA, TITANIS, RAKHAT, ASHKELON, NIFLHEIM, YMIR];

  /* 按高度插值调色板 */
  function palette(p, altKm) {
    const st = p.pal;
    let i = 0;
    while (i < st.length - 1 && altKm < st[i + 1].a) i++;
    const A = st[i], B = st[Math.min(i + 1, st.length - 1)];
    const t = A === B ? 0 : u.clamp((A.a - altKm) / (A.a - B.a), 0, 1);
    return {
      zen: u.mix3(A.zen, B.zen, t), hor: u.mix3(A.hor, B.hor, t),
      haze: u.mix3(A.haze, B.haze, t), amb: u.mix3(A.amb, B.amb, t),
      exp: u.lerp(A.exp === undefined ? 1 : A.exp, B.exp === undefined ? 1 : B.exp, t)
    };
  }

  /* 高度相关的风（含切变与阵风） */
  function windAt(p, altM, t) {
    const km = altM / 1000;
    const shear = Math.sin(km * 0.31) * 0.6 + Math.sin(km * 0.083 + 1.7) * 0.4;
    const bl = 0.14 + 0.86 * u.smoothstep(80, 1400, altM);   // 近地边界层风速衰减
    const spd = (p.wind.base + p.wind.shear * shear) * bl;
    const dir = km * 0.06 + Math.sin(km * 0.017) * 2.2;
    const gust = p.wind.gust * u.fbm1(t * 0.31 + km * 0.5);
    return [Math.cos(dir) * spd + gust, Math.sin(dir) * spd + gust * 0.7];
  }

  glob.PLANETS = { list: list, palette: palette, windAt: windAt, byId: id => list.filter(p => p.id === id)[0] };
})(window);
