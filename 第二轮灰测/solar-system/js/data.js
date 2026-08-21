/* =======================================================================
 *  data.js  —  真实天体数据（J2000 轨道要素、物理参数、撞击靶体属性）
 *
 *  数据来源：NASA JPL Planetary Fact Sheet / IAU 2015 / Horizons 平均要素
 *  轨道要素：a(AU 或 km, 卫星用 km) e i(°) om=Ω(°) w=ω(°) M0(°) T(天, 负=逆行)
 *  atmo.rho0: 地表大气密度 kg/m^3 ; atmo.H: 标高 km
 *  target: 撞击靶体（rock / ice / water / gas），density kg/m^3
 * ======================================================================= */
(function (global) {
  'use strict';
  const SS = (global.SS = global.SS || {});

  const AU = 149597870.7; // km
  const KM = 1 / 1000;    // km → 引擎单位（1 unit = 1000 km）

  /** sRGB(0-255) → 线性空间 */
  function srgb(r, g, b) {
    const f = (c) => {
      c /= 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return [f(r), f(g), f(b)];
  }

  // 表面类型枚举，需与着色器中的常量保持一致
  const KIND = { SUN: 0, ROCKY: 1, EARTH: 2, VENUS: 3, GAS: 4, ICEGIANT: 5, ICEMOON: 6, VOLCANIC: 7, MARS: 8, DWARF: 9 };

  const BODIES = [
    /* ------------------------------- 太阳 ------------------------------ */
    {
      id: 'sun', name: '太阳', en: 'Sun', cls: 'star', parent: null,
      radius: 696000, mass: 1.9885e30, g: 274.0, vesc: 617.7,
      rotHours: 609.12, tilt: 7.25,
      orbit: null,
      atmo: null,
      target: { type: 'plasma', density: 1408, label: '等离子体' },
      typicalV: 620,
      look: {
        kind: KIND.SUN, colA: srgb(255, 248, 232), colB: srgb(255, 176, 58), colC: srgb(255, 96, 12),
        relief: 0, noiseFreq: 5.5, rough: 0.55, ocean: 0, ice: 0,
        cloud: 0, cloudFreq: 0, cloudSpeed: 0, cloudCol: srgb(255, 255, 255),
        night: 0, emissive: 1, corona: 1,
      },
      desc: 'G2V 主序星。核心 1500 万 K 的氢核聚变每秒把 400 万吨质量转成能量，撑起整个星系的光。',
    },

    /* ------------------------------ 水星 ------------------------------ */
    {
      id: 'mercury', name: '水星', en: 'Mercury', cls: 'planet', parent: 'sun',
      radius: 2439.7, mass: 3.3011e23, g: 3.70, vesc: 4.25,
      rotHours: 1407.6, tilt: 0.034,
      orbit: { a: 0.387098 * AU, e: 0.205630, i: 7.005, om: 48.331, w: 29.124, M0: 174.796, T: 87.9691 },
      atmo: null,
      target: { type: 'rock', density: 2900, label: '硅酸盐岩壳' },
      typicalV: 42.5,
      look: {
        kind: KIND.ROCKY, colA: srgb(150, 141, 132), colB: srgb(96, 89, 83), colC: srgb(203, 196, 186),
        relief: 4200, noiseFreq: 4.2, rough: 0.62, ocean: 0, ice: 0.0,
        cloud: 0, cloudFreq: 0, cloudSpeed: 0, cloudCol: srgb(255, 255, 255),
        night: 0, emissive: 0, corona: 0, craterField: 1.0, dustCol: srgb(178, 170, 158),
      },
      desc: '没有大气的铁核世界。白天 430°C、夜间 -180°C，任何尺寸的陨石都能毫发无损地砸到地面。',
    },

    /* ------------------------------ 金星 ------------------------------ */
    {
      id: 'venus', name: '金星', en: 'Venus', cls: 'planet', parent: 'sun',
      radius: 6051.8, mass: 4.8675e24, g: 8.87, vesc: 10.36,
      rotHours: -5832.6, tilt: 177.36,
      orbit: { a: 0.723332 * AU, e: 0.006772, i: 3.39458, om: 76.680, w: 54.884, M0: 50.115, T: 224.701 },
      atmo: { rho0: 65.0, H: 15.9, top: 250, rayleigh: srgb(232, 196, 120), mie: 0.85, thick: 2.6 },
      target: { type: 'rock', density: 2900, label: '玄武岩平原' },
      typicalV: 27.0,
      look: {
        kind: KIND.VENUS, colA: srgb(232, 204, 148), colB: srgb(190, 152, 92), colC: srgb(255, 238, 200),
        relief: 2800, noiseFreq: 3.4, rough: 0.5, ocean: 0, ice: 0,
        cloud: 0.98, cloudFreq: 2.1, cloudSpeed: 3.2, cloudCol: srgb(255, 240, 205),
        night: 0, emissive: 0, corona: 0, craterField: 0.25, dustCol: srgb(210, 180, 130),
      },
      desc: '92 倍地球气压的硫酸云地狱。极厚大气会把 1 公里以下的来客全部撕碎成空爆，地表几乎见不到小坑。',
    },

    /* ------------------------------ 地球 ------------------------------ */
    {
      id: 'earth', name: '地球', en: 'Earth', cls: 'planet', parent: 'sun',
      radius: 6371.0, mass: 5.97237e24, g: 9.807, vesc: 11.186,
      rotHours: 23.9345, tilt: 23.4393,
      orbit: { a: 1.00000011 * AU, e: 0.01671022, i: 0.00005, om: -11.26064, w: 114.20783, M0: 358.617, T: 365.256363 },
      atmo: { rho0: 1.225, H: 8.5, top: 120, rayleigh: srgb(88, 140, 255), mie: 0.28, thick: 1.0 },
      target: { type: 'rock', density: 2700, label: '大陆结晶岩 / 深海' },
      typicalV: 20.3,
      look: {
        kind: KIND.EARTH, colA: srgb(48, 96, 42), colB: srgb(150, 130, 92), colC: srgb(238, 246, 255),
        relief: 8848, noiseFreq: 2.35, rough: 0.58, ocean: 0.62, ice: 0.87,
        cloud: 0.46, cloudFreq: 3.6, cloudSpeed: 1.0, cloudCol: srgb(255, 255, 255),
        night: 1.0, emissive: 0, corona: 0, craterField: 0.02, dustCol: srgb(150, 140, 120),
        oceanCol: srgb(8, 34, 78), shoreCol: srgb(28, 96, 132),
      },
      desc: '唯一已知有生物圈的行星。70% 表面是水，撞击更可能砸进海洋并掀起跨洋海啸而非留下陨石坑。',
    },
    {
      id: 'moon', name: '月球', en: 'Moon', cls: 'moon', parent: 'earth',
      radius: 1737.4, mass: 7.342e22, g: 1.62, vesc: 2.38,
      rotHours: 655.728, tilt: 6.68,
      orbit: { a: 384400, e: 0.0549, i: 5.145, om: 125.08, w: 318.15, M0: 135.27, T: 27.321661 },
      atmo: null,
      target: { type: 'rock', density: 2500, label: '月海玄武岩 / 风化层' },
      typicalV: 18.0,
      look: {
        kind: KIND.ROCKY, colA: srgb(148, 145, 140), colB: srgb(78, 76, 74), colC: srgb(205, 203, 198),
        relief: 5500, noiseFreq: 3.6, rough: 0.66, ocean: 0, ice: 0,
        cloud: 0, cloudFreq: 0, cloudSpeed: 0, cloudCol: srgb(255, 255, 255),
        night: 0, emissive: 0, corona: 0, craterField: 1.15, dustCol: srgb(190, 188, 182),
        mare: 1.0,
      },
      desc: '45 亿年撞击史的活化石。真空 + 低重力让喷出物飞得极远，射线状亮纹可以横跨半个球面。',
    },

    /* ------------------------------ 火星 ------------------------------ */
    {
      id: 'mars', name: '火星', en: 'Mars', cls: 'planet', parent: 'sun',
      radius: 3389.5, mass: 6.4171e23, g: 3.721, vesc: 5.027,
      rotHours: 24.6229, tilt: 25.19,
      orbit: { a: 1.523679 * AU, e: 0.093400, i: 1.850, om: 49.558, w: 286.502, M0: 19.373, T: 686.980 },
      atmo: { rho0: 0.020, H: 11.1, top: 90, rayleigh: srgb(214, 148, 106), mie: 0.55, thick: 0.35 },
      target: { type: 'rock', density: 2600, label: '玄武岩 / 冻土层' },
      typicalV: 10.2,
      look: {
        kind: KIND.MARS, colA: srgb(176, 96, 58), colB: srgb(120, 62, 40), colC: srgb(240, 232, 222),
        relief: 21229, noiseFreq: 2.9, rough: 0.6, ocean: 0, ice: 0.92,
        cloud: 0.10, cloudFreq: 3.0, cloudSpeed: 1.4, cloudCol: srgb(240, 226, 210),
        night: 0, emissive: 0, corona: 0, craterField: 0.85, dustCol: srgb(214, 152, 104),
      },
      desc: '稀薄的 CO₂ 大气只能挡住最小的碎块。冻土层被击穿时会喷出水冰，形成独有的“泼溅状”喷出物毯。',
    },

    /* ------------------------------ 谷神星 ---------------------------- */
    {
      id: 'ceres', name: '谷神星', en: 'Ceres', cls: 'dwarf', parent: 'sun',
      radius: 473, mass: 9.3839e20, g: 0.28, vesc: 0.51,
      rotHours: 9.074, tilt: 4.0,
      orbit: { a: 2.7675 * AU, e: 0.0757, i: 10.593, om: 80.393, w: 73.597, M0: 95.99, T: 1681.63 },
      atmo: null,
      target: { type: 'ice', density: 1600, label: '含水盐冰壳' },
      typicalV: 5.0,
      look: {
        kind: KIND.DWARF, colA: srgb(112, 108, 104), colB: srgb(72, 70, 68), colC: srgb(238, 240, 242),
        relief: 7000, noiseFreq: 4.6, rough: 0.68, ocean: 0, ice: 0.2,
        cloud: 0, cloudFreq: 0, cloudSpeed: 0, cloudCol: srgb(255, 255, 255),
        night: 0, emissive: 0, corona: 0, craterField: 1.05, dustCol: srgb(210, 214, 220),
      },
      desc: '主带里最大的天体，四分之一是水冰。撞击会翻出高反射率的盐冰，留下亮得反常的白斑。',
    },

    /* ------------------------------ 木星 ------------------------------ */
    {
      id: 'jupiter', name: '木星', en: 'Jupiter', cls: 'planet', parent: 'sun',
      radius: 69911, mass: 1.8982e27, g: 24.79, vesc: 59.5,
      rotHours: 9.925, tilt: 3.13,
      orbit: { a: 5.2044 * AU, e: 0.0489, i: 1.303, om: 100.464, w: 273.867, M0: 20.020, T: 4332.589 },
      atmo: { rho0: 0.16, H: 27, top: 1200, rayleigh: srgb(214, 186, 150), mie: 0.6, thick: 1.4 },
      target: { type: 'gas', density: 0.16, label: '氢氦大气（无固体表面）' },
      typicalV: 60.0,
      look: {
        kind: KIND.GAS, colA: srgb(226, 202, 172), colB: srgb(158, 116, 84), colC: srgb(244, 232, 214),
        relief: 0, noiseFreq: 2.2, rough: 0.62, ocean: 0, ice: 0,
        cloud: 1.0, cloudFreq: 2.6, cloudSpeed: 1.0, cloudCol: srgb(255, 246, 232),
        night: 0, emissive: 0, corona: 0, bands: 11.0, storm: 1.0,
        ringInner: 1.72, ringOuter: 1.81, ringOpacity: 0.05, ringCol: srgb(150, 130, 118),
      },
      desc: '没有地面可砸。1994 年 SL9 彗星的碎片在这里炸出了比地球还大的深色伤痕，几个月后才被环流抹平。',
    },
    {
      id: 'io', name: '木卫一 · 伊奥', en: 'Io', cls: 'moon', parent: 'jupiter',
      radius: 1821.6, mass: 8.931938e22, g: 1.796, vesc: 2.558,
      rotHours: 42.459, tilt: 0.0,
      orbit: { a: 421700, e: 0.0041, i: 0.05, om: 0, w: 0, M0: 32.0, T: 1.769138 },
      atmo: null,
      target: { type: 'rock', density: 3000, label: '硫 / 硅酸盐熔岩' },
      typicalV: 32.0,
      look: {
        kind: KIND.VOLCANIC, colA: srgb(236, 214, 96), colB: srgb(196, 108, 40), colC: srgb(250, 246, 216),
        relief: 9000, noiseFreq: 3.2, rough: 0.55, ocean: 0, ice: 0,
        cloud: 0, cloudFreq: 0, cloudSpeed: 0, cloudCol: srgb(255, 255, 255),
        night: 0.35, emissive: 0, corona: 0, craterField: 0.05, dustCol: srgb(240, 220, 120),
      },
      desc: '太阳系最活跃的火山世界。潮汐加热让地表每百万年翻新一遍，撞击坑基本存不下来。',
    },
    {
      id: 'europa', name: '木卫二 · 欧罗巴', en: 'Europa', cls: 'moon', parent: 'jupiter',
      radius: 1560.8, mass: 4.799844e22, g: 1.314, vesc: 2.025,
      rotHours: 85.228, tilt: 0.1,
      orbit: { a: 671034, e: 0.009, i: 0.47, om: 0, w: 0, M0: 190.0, T: 3.551181 },
      atmo: null,
      target: { type: 'ice', density: 917, label: '水冰壳（下方液态海洋）' },
      typicalV: 26.0,
      look: {
        kind: KIND.ICEMOON, colA: srgb(228, 220, 208), colB: srgb(186, 138, 106), colC: srgb(250, 250, 252),
        relief: 1200, noiseFreq: 3.0, rough: 0.4, ocean: 0, ice: 1.0,
        cloud: 0, cloudFreq: 0, cloudSpeed: 0, cloudCol: srgb(255, 255, 255),
        night: 0, emissive: 0, corona: 0, craterField: 0.12, dustCol: srgb(250, 250, 255),
        cracks: 1.0,
      },
      desc: '几公里厚的冰壳下藏着比地球总量更多的液态水。大撞击可能击穿冰壳，让内部海水直接喷向真空。',
    },
    {
      id: 'ganymede', name: '木卫三 · 盖尼米得', en: 'Ganymede', cls: 'moon', parent: 'jupiter',
      radius: 2634.1, mass: 1.4819e23, g: 1.428, vesc: 2.741,
      rotHours: 171.709, tilt: 0.33,
      orbit: { a: 1070412, e: 0.0013, i: 0.2, om: 0, w: 0, M0: 60.0, T: 7.15455 },
      atmo: null,
      target: { type: 'ice', density: 1100, label: '冰 - 岩混合壳' },
      typicalV: 20.0,
      look: {
        kind: KIND.ICEMOON, colA: srgb(160, 152, 146), colB: srgb(104, 98, 96), colC: srgb(226, 228, 232),
        relief: 3000, noiseFreq: 3.4, rough: 0.55, ocean: 0, ice: 0.7,
        cloud: 0, cloudFreq: 0, cloudSpeed: 0, cloudCol: srgb(255, 255, 255),
        night: 0, emissive: 0, corona: 0, craterField: 0.75, dustCol: srgb(235, 238, 244),
        cracks: 0.55,
      },
      desc: '太阳系最大的卫星，比水星还大，拥有自己的磁场。冰壳上的古老沟槽记录了早期的构造运动。',
    },
    {
      id: 'callisto', name: '木卫四 · 卡利斯托', en: 'Callisto', cls: 'moon', parent: 'jupiter',
      radius: 2410.3, mass: 1.075938e23, g: 1.235, vesc: 2.440,
      rotHours: 400.536, tilt: 0.0,
      orbit: { a: 1882709, e: 0.0074, i: 0.19, om: 0, w: 0, M0: 250.0, T: 16.6890 },
      atmo: null,
      target: { type: 'ice', density: 1200, label: '饱和撞击的冰岩壳' },
      typicalV: 15.0,
      look: {
        kind: KIND.ICEMOON, colA: srgb(120, 110, 100), colB: srgb(72, 66, 62), colC: srgb(216, 214, 210),
        relief: 4000, noiseFreq: 4.2, rough: 0.62, ocean: 0, ice: 0.45,
        cloud: 0, cloudFreq: 0, cloudSpeed: 0, cloudCol: srgb(255, 255, 255),
        night: 0, emissive: 0, corona: 0, craterField: 1.35, dustCol: srgb(220, 218, 214),
        cracks: 0.1,
      },
      desc: '撞击坑密度已经饱和：新坑只能覆盖旧坑。太阳系里最古老、最不设防的表面之一。',
    },

    /* ------------------------------ 土星 ------------------------------ */
    {
      id: 'saturn', name: '土星', en: 'Saturn', cls: 'planet', parent: 'sun',
      radius: 58232, mass: 5.6834e26, g: 10.44, vesc: 35.5,
      rotHours: 10.656, tilt: 26.73,
      orbit: { a: 9.5826 * AU, e: 0.0565, i: 2.485, om: 113.665, w: 339.392, M0: 317.020, T: 10759.22 },
      atmo: { rho0: 0.19, H: 59.5, top: 1500, rayleigh: srgb(226, 206, 164), mie: 0.55, thick: 1.2 },
      target: { type: 'gas', density: 0.19, label: '氢氦大气（无固体表面）' },
      typicalV: 36.0,
      look: {
        kind: KIND.GAS, colA: srgb(232, 214, 172), colB: srgb(190, 164, 118), colC: srgb(250, 242, 222),
        relief: 0, noiseFreq: 1.9, rough: 0.55, ocean: 0, ice: 0,
        cloud: 1.0, cloudFreq: 2.2, cloudSpeed: 0.85, cloudCol: srgb(255, 250, 234),
        night: 0, emissive: 0, corona: 0, bands: 8.0, storm: 0.45,
        ringInner: 1.18, ringOuter: 2.34, ringOpacity: 1.0, ringCol: srgb(226, 210, 184),
      },
      desc: '平均密度比水还小。环由数万亿块冰组成，厚度却往往不到 20 米——撞击掀起的碎屑会在这里排成新的环。',
    },
    {
      id: 'titan', name: '土卫六 · 泰坦', en: 'Titan', cls: 'moon', parent: 'saturn',
      radius: 2574.7, mass: 1.3452e23, g: 1.352, vesc: 2.639,
      rotHours: 382.68, tilt: 0.3,
      orbit: { a: 1221870, e: 0.0288, i: 0.35, om: 0, w: 0, M0: 120.0, T: 15.945 },
      atmo: { rho0: 5.3, H: 21.0, top: 600, rayleigh: srgb(210, 158, 78), mie: 0.9, thick: 1.9 },
      target: { type: 'ice', density: 950, label: '水冰基岩 / 甲烷湖' },
      typicalV: 10.5,
      look: {
        kind: KIND.ICEMOON, colA: srgb(196, 146, 66), colB: srgb(150, 102, 44), colC: srgb(232, 200, 140),
        relief: 1500, noiseFreq: 3.2, rough: 0.5, ocean: 0.18, ice: 0.1,
        cloud: 0.85, cloudFreq: 2.4, cloudSpeed: 0.7, cloudCol: srgb(226, 186, 120),
        night: 0, emissive: 0, corona: 0, craterField: 0.2, dustCol: srgb(210, 170, 90),
        oceanCol: srgb(30, 26, 20), shoreCol: srgb(90, 70, 40),
      },
      desc: '唯一拥有浓密大气和地表液体（液态甲烷）的卫星。气压比地球还高，小陨石在这里同样活不到落地。',
    },

    /* ------------------------------ 天王星 ---------------------------- */
    {
      id: 'uranus', name: '天王星', en: 'Uranus', cls: 'planet', parent: 'sun',
      radius: 25362, mass: 8.6810e25, g: 8.87, vesc: 21.3,
      rotHours: -17.24, tilt: 97.77,
      orbit: { a: 19.2184 * AU, e: 0.046381, i: 0.773, om: 74.006, w: 96.998, M0: 142.238, T: 30688.5 },
      atmo: { rho0: 0.42, H: 27.7, top: 900, rayleigh: srgb(120, 210, 226), mie: 0.4, thick: 1.1 },
      target: { type: 'gas', density: 0.42, label: '氢氦 - 甲烷大气' },
      typicalV: 25.0,
      look: {
        kind: KIND.ICEGIANT, colA: srgb(178, 226, 232), colB: srgb(128, 196, 210), colC: srgb(226, 248, 250),
        relief: 0, noiseFreq: 1.6, rough: 0.45, ocean: 0, ice: 0,
        cloud: 1.0, cloudFreq: 1.6, cloudSpeed: 0.5, cloudCol: srgb(226, 250, 252),
        night: 0, emissive: 0, corona: 0, bands: 5.0, storm: 0.12,
        ringInner: 1.64, ringOuter: 2.00, ringOpacity: 0.22, ringCol: srgb(120, 120, 128),
      },
      desc: '躺着自转的冰巨星——98° 的转轴倾角很可能来自一次地球大小天体的正面撞击。',
    },

    /* ------------------------------ 海王星 ---------------------------- */
    {
      id: 'neptune', name: '海王星', en: 'Neptune', cls: 'planet', parent: 'sun',
      radius: 24622, mass: 1.02413e26, g: 11.15, vesc: 23.5,
      rotHours: 16.11, tilt: 28.32,
      orbit: { a: 30.07 * AU, e: 0.008678, i: 1.770, om: 131.784, w: 276.336, M0: 256.228, T: 60195.0 },
      atmo: { rho0: 0.45, H: 19.7, top: 900, rayleigh: srgb(74, 132, 240), mie: 0.4, thick: 1.15 },
      target: { type: 'gas', density: 0.45, label: '氢氦 - 甲烷大气' },
      typicalV: 25.0,
      look: {
        kind: KIND.ICEGIANT, colA: srgb(74, 122, 226), colB: srgb(40, 74, 168), colC: srgb(206, 226, 255),
        relief: 0, noiseFreq: 1.9, rough: 0.5, ocean: 0, ice: 0,
        cloud: 1.0, cloudFreq: 2.0, cloudSpeed: 1.8, cloudCol: srgb(236, 244, 255),
        night: 0, emissive: 0, corona: 0, bands: 6.0, storm: 0.8,
        ringInner: 1.7, ringOuter: 2.5, ringOpacity: 0.08, ringCol: srgb(90, 100, 130),
      },
      desc: '风速可达 2100 km/h，太阳系最狂暴的大气。撞击留下的暗斑会被超音速环流迅速拉成细带。',
    },
    {
      id: 'triton', name: '海卫一 · 特里同', en: 'Triton', cls: 'moon', parent: 'neptune',
      radius: 1353.4, mass: 2.1389e22, g: 0.779, vesc: 1.455,
      rotHours: -141.045, tilt: 0.0,
      orbit: { a: 354759, e: 0.000016, i: 156.885, om: 0, w: 0, M0: 20.0, T: -5.876854 },
      atmo: { rho0: 0.00003, H: 20, top: 100, rayleigh: srgb(200, 220, 255), mie: 0.2, thick: 0.05 },
      target: { type: 'ice', density: 930, label: '氮冰 / 水冰壳' },
      typicalV: 8.0,
      look: {
        kind: KIND.ICEMOON, colA: srgb(226, 214, 206), colB: srgb(196, 156, 140), colC: srgb(248, 246, 250),
        relief: 1000, noiseFreq: 3.8, rough: 0.45, ocean: 0, ice: 0.95,
        cloud: 0.05, cloudFreq: 2.0, cloudSpeed: 0.4, cloudCol: srgb(240, 246, 255),
        night: 0, emissive: 0, corona: 0, craterField: 0.25, dustCol: srgb(250, 248, 252),
        cracks: 0.7,
      },
      desc: '唯一逆行的大卫星，被捕获的柯伊伯带天体。-235°C 的氮冰地表上还有活跃的冰火山喷泉。',
    },

    /* ------------------------------ 冥王星 ---------------------------- */
    {
      id: 'pluto', name: '冥王星', en: 'Pluto', cls: 'dwarf', parent: 'sun',
      radius: 1188.3, mass: 1.303e22, g: 0.62, vesc: 1.21,
      rotHours: 153.2928, tilt: 122.53,
      orbit: { a: 39.482 * AU, e: 0.2488, i: 17.16, om: 110.299, w: 113.834, M0: 14.53, T: 90560.0 },
      atmo: { rho0: 0.000085, H: 50, top: 200, rayleigh: srgb(180, 190, 230), mie: 0.3, thick: 0.06 },
      target: { type: 'ice', density: 1000, label: '氮 - 甲烷冰壳' },
      typicalV: 2.0,
      look: {
        kind: KIND.DWARF, colA: srgb(210, 178, 148), colB: srgb(128, 100, 84), colC: srgb(246, 240, 232),
        relief: 3500, noiseFreq: 3.4, rough: 0.5, ocean: 0, ice: 0.85,
        cloud: 0, cloudFreq: 0, cloudSpeed: 0, cloudCol: srgb(255, 255, 255),
        night: 0, emissive: 0, corona: 0, craterField: 0.55, dustCol: srgb(240, 230, 220),
      },
      desc: '“冥王之心”是一块 1000 公里宽的氮冰冰川。极低的引力让喷出物几乎全部逃逸到太空。',
    },
  ];

  /* ---------------- 陨石材质预设（密度 kg/m^3 与抗压强度 Pa） ----------
   * 强度决定“在多深的大气里被压碎”：疏松彗核在百公里高空就散架，
   * 铁镍陨石几乎不会解体。数值取自陨石实测与进入体解体反演的常用区间。 */
  const IMPACTORS = [
    { id: 'comet', name: '彗星冰核', density: 600, strength: 5e4, color: srgb(190, 220, 255), desc: '疏松冰尘团，极易在高空解体' },
    { id: 'ice', name: '致密水冰', density: 917, strength: 3e5, color: srgb(210, 236, 255), desc: '柯伊伯带来客' },
    { id: 'carbon', name: '碳质球粒', density: 2200, strength: 4e5, color: srgb(60, 58, 56), desc: '最常见的小行星类型，脆而黑' },
    { id: 'stone', name: '普通石质', density: 3000, strength: 1e6, color: srgb(120, 112, 104), desc: 'S 型小行星，主带主力' },
    { id: 'iron', name: '铁镍金属', density: 7800, strength: 4e8, color: srgb(168, 158, 148), desc: '几乎不会在大气中解体' },
  ];

  /* ------------------------- 场景预设（一键演示） ---------------------- */
  const PRESETS = [
    { id: 'tunguska', name: '通古斯 1908', body: 'earth', d: 60, mat: 'stone', v: 15, angle: 45, note: '空爆摧平 2000 km² 森林，未留下陨石坑' },
    { id: 'chelyabinsk', name: '车里雅宾斯克 2013', body: 'earth', d: 19, mat: 'stone', v: 19, angle: 18, note: '30 km 高空解体，冲击波震碎 7000 栋玻璃' },
    { id: 'barringer', name: '巴林杰陨石坑', body: 'earth', d: 50, mat: 'iron', v: 12.8, angle: 45, note: '铁陨石撑到落地，挖出 1.2 km 的坑' },
    { id: 'chicxulub', name: '希克苏鲁伯 K-Pg', body: 'earth', d: 12000, mat: 'carbon', v: 20, angle: 60, note: '恐龙灭绝级：180 km 撞击坑 + 全球撞击冬天' },
    { id: 'sl9', name: 'SL9 撞木星 1994', body: 'jupiter', d: 1500, mat: 'comet', v: 60, angle: 45, note: '碎片在木星大气炸出比地球更大的暗斑' },
    { id: 'imbrium', name: '雨海撞击事件', body: 'moon', d: 70000, mat: 'stone', v: 17, angle: 75, note: '在月球正面挖出 1150 km 的巨型盆地' },
    { id: 'venuscheck', name: '金星大气过滤', body: 'venus', d: 300, mat: 'stone', v: 27, angle: 45, note: '同样的石块在金星上会被压碎成空爆' },
    { id: 'europacrack', name: '击穿欧罗巴冰壳', body: 'europa', d: 3000, mat: 'ice', v: 26, angle: 90, note: '低重力冰壳 + 垂直入射，内部海水直喷真空' },
  ];

  SS.DATA = {
    AU, KM, KIND, BODIES, IMPACTORS, PRESETS, srgb,
    byId(id) { return BODIES.find((b) => b.id === id); },
  };
})(window);
