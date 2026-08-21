/**
 * params.js — 唯一参数真源 (Single Source of Truth)
 * ==================================================================
 * 规格书 §1.2 要求「关键参数必须与真实技术一致并在全片保持一致」。
 * 本文件是全片唯一的数值来源：HUD 标注、字幕、术语表、参数校准记录
 * 与 3D 场景的几何比例全部从此处读取，物理上排除「前后矛盾」。
 *
 * 每条参数带 provenance 字段：
 *   'public'    — 公开企业/行业数据，可直接标注数值
 *   'schematic' — 保密或未公开，使用示意值，必须标注「示意 / Simulation」
 *   'derived'   — 由上述公开值推算，标注推算依据
 *
 * 修改本文件即同步全片。禁止在其它模块内硬编码物理数值。
 */

export const PROVENANCE = {
  PUBLIC: 'public',
  SCHEMATIC: 'schematic',
  DERIVED: 'derived',
};

/** 参数条目工厂 */
const P = (id, value, unit, provenance, zh, en, note = '') => ({
  id, value, unit, provenance, zh, en, note,
});

// ───────────────────────────────────────────────────────────────────
// 1. 核心物理参数
// ───────────────────────────────────────────────────────────────────
export const PARAMS = {
  // —— 光 ——
  wavelength: P('wavelength', 13.5, 'nm', PROVENANCE.PUBLIC,
    'EUV 波长', 'EUV wavelength',
    '产业标准工作波长；Mo/Si 多层膜反射率峰值所在。人眼不可见（不可见光，需艺术化可视化）'),
  photonEnergy: P('photonEnergy', 91.8, 'eV', PROVENANCE.DERIVED,
    '光子能量', 'Photon energy',
    'E = hc/λ, λ=13.5 nm → 91.84 eV'),
  inBandWidth: P('inBandWidth', 2, '%', PROVENANCE.PUBLIC,
    '带内宽度', 'In-band bandwidth',
    '13.5 nm ± 1%（2% 带宽）为多层膜可反射的有效带'),

  // —— 驱动激光 ——
  driveLaserType: P('driveLaserType', 'CO₂ MOPA', '', PROVENANCE.PUBLIC,
    '驱动激光', 'Drive laser',
    'CO₂ 主振荡功率放大链，双脉冲（预脉冲 + 主脉冲）'),
  driveLaserWavelength: P('driveLaserWavelength', 10.6, 'µm', PROVENANCE.PUBLIC,
    'CO₂ 激光波长', 'CO₂ laser wavelength',
    '红外，人眼不可见'),
  driveLaserPower: P('driveLaserPower', 30, 'kW', PROVENANCE.PUBLIC,
    'CO₂ 激光输出功率', 'CO₂ laser output power',
    '公开级工业 CO₂ 激光器量级'),
  prePulseRole: P('prePulseRole', '压扁成盘', '', PROVENANCE.PUBLIC,
    '预脉冲作用', 'Pre-pulse function',
    '将球形锡滴压扁为圆盘（pancake），扩大主脉冲吸收截面以提高能量转换效率'),
  mainPulseRole: P('mainPulseRole', '汽化成等离子体', '', PROVENANCE.PUBLIC,
    '主脉冲作用', 'Main-pulse function',
    '击打圆盘状锡滴，使其汽化电离形成高温等离子体'),
  pulseSeparation: P('pulseSeparation', 1.5, 'µs', PROVENANCE.SCHEMATIC,
    '双脉冲间隔', 'Pre/main pulse separation',
    '示意值：预脉冲与主脉冲之间的延时，供圆盘充分展开'),
  conversionEfficiency: P('conversionEfficiency', 5, '%', PROVENANCE.PUBLIC,
    '能量转换效率', 'Conversion efficiency (CE)',
    'CO₂ 激光能量 → 带内 13.5 nm EUV 的转换效率量级'),

  // —— 锡滴 ——
  dropletDiameter: P('dropletDiameter', '25–30', 'µm', PROVENANCE.PUBLIC,
    '锡滴直径', 'Tin droplet diameter',
    '熔融锡微滴，约为人类头发丝直径的三分之一'),
  dropletRate: P('dropletRate', 50000, '滴/秒', PROVENANCE.PUBLIC,
    '锡滴发射频率', 'Droplet generation rate',
    '约 50,000 滴每秒，与激光脉冲一一同步'),
  dropletVelocity: P('dropletVelocity', 70, 'm/s', PROVENANCE.PUBLIC,
    '锡滴飞行速度', 'Droplet velocity',
    '自发生器喷嘴射出后穿越等离子体点'),
  dropletSpacing: P('dropletSpacing', 1.4, 'mm', PROVENANCE.DERIVED,
    '锡滴间距', 'Droplet spacing',
    'v / f = 70 (m/s) / 50,000 (1/s) = 1.4 mm'),
  tinMeltingPoint: P('tinMeltingPoint', 232, '°C', PROVENANCE.PUBLIC,
    '锡熔点', 'Tin melting point',
    '锡在发生器内保持熔融态'),

  // —— 等离子体 ——
  plasmaTemperature: P('plasmaTemperature', 220000, '°C', PROVENANCE.PUBLIC,
    '等离子体温度', 'Plasma temperature',
    '公开引用量级，约为太阳表面温度的数十倍'),
  plasmaIonState: P('plasmaIonState', 'Sn⁸⁺–Sn¹⁴⁺', '', PROVENANCE.PUBLIC,
    '主要辐射离子态', 'Dominant emitting ion states',
    '多电荷锡离子在 13.5 nm 附近形成未分辨跃迁阵列 (UTA)'),
  plasmaLifetime: P('plasmaLifetime', 60, 'ns', PROVENANCE.SCHEMATIC,
    '等离子体寿命', 'Plasma lifetime',
    '示意值：单次脉冲等离子体的有效辐射持续时间量级'),
  euvPowerAtIF: P('euvPowerAtIF', 250, 'W', PROVENANCE.PUBLIC,
    '中间焦点 EUV 功率', 'EUV power at intermediate focus',
    '当代量产机型公开指标量级'),

  // —— 真空与氢气 ——
  vacuumPressure: P('vacuumPressure', '10⁻⁵–10⁻⁷', 'mbar', PROVENANCE.PUBLIC,
    '光学腔真空度', 'Optics vacuum level',
    'EUV 会被空气强烈吸收，全光路必须置于真空'),
  hydrogenPressure: P('hydrogenPressure', '1–10', 'Pa', PROVENANCE.SCHEMATIC,
    '源腔氢气分压', 'Source H₂ partial pressure',
    '示意值：氢气缓冲气用于锡碎屑减缓与清洁'),
  hydrogenRole: P('hydrogenRole', 'Sn + H → SnH₄', '', PROVENANCE.PUBLIC,
    '氢气清洁反应', 'Hydrogen cleaning reaction',
    '氢自由基与沉积锡反应生成挥发性锡烷 (SnH₄)，随气流抽走'),
  euvAirAbsorption: P('euvAirAbsorption', '< 1', 'mm', PROVENANCE.PUBLIC,
    'EUV 在大气中衰减长度', 'EUV attenuation length in air',
    '这是全机必须真空、且必须全反射式光学的根本原因'),

  // —— 多层膜光学 ——
  multilayerStack: P('multilayerStack', 'Mo/Si', '', PROVENANCE.PUBLIC,
    '多层膜材料', 'Multilayer material',
    '钼/硅交替镀层，布拉格式干涉反射'),
  multilayerPairs: P('multilayerPairs', 40, '对', PROVENANCE.PUBLIC,
    '多层膜层对数', 'Multilayer bilayer pairs',
    '约 40–50 对 Mo/Si 交替层'),
  multilayerPeriod: P('multilayerPeriod', 6.9, 'nm', PROVENANCE.PUBLIC,
    '多层膜周期', 'Multilayer period',
    '≈ λ/2，满足 13.5 nm 布拉格条件'),
  multilayerReflectance: P('multilayerReflectance', 70, '%', PROVENANCE.PUBLIC,
    '单镜反射率', 'Per-mirror reflectance',
    '近法向入射峰值反射率上限量级；因此镜片数量必须极少'),
  mirrorRoughness: P('mirrorRoughness', '< 0.2', 'nm', PROVENANCE.PUBLIC,
    '镜面粗糙度', 'Mirror surface roughness',
    '原子级抛光：若放大到德国国土尺度，起伏不超过 1 mm'),
  collectorSolidAngle: P('collectorSolidAngle', 5, 'sr', PROVENANCE.SCHEMATIC,
    '集光镜收集立体角', 'Collector collection solid angle',
    '示意值：椭球集光镜对 4π 辐射的有效收集份额量级'),

  // —— 成像 ——
  demagnification: P('demagnification', '4:1', '', PROVENANCE.PUBLIC,
    '投影缩比', 'Reduction ratio',
    '掩模图形经投影物镜缩小 4 倍成像于晶圆'),
  numericalAperture: P('numericalAperture', 0.33, '', PROVENANCE.PUBLIC,
    '数值孔径 NA', 'Numerical aperture',
    '当代量产 EUV 机型；High-NA 世代为 0.55'),
  pobMirrorCount: P('pobMirrorCount', 6, '片', PROVENANCE.PUBLIC,
    '投影物镜镜片数', 'Projection optics mirror count',
    '多片非球面反射镜，无任何透镜'),
  maskIncidenceAngle: P('maskIncidenceAngle', 6, '°', PROVENANCE.PUBLIC,
    '掩模入射角', 'Mask incidence angle',
    '离轴入射，使入射光与反射光分离（反射式掩模的必然结果）'),
  maskAbsorber: P('maskAbsorber', 'TaBN', '', PROVENANCE.PUBLIC,
    '掩模吸收层', 'Mask absorber',
    '多层膜之上的图形化吸收层，未被吸收处反射成像'),
  maskCapping: P('maskCapping', 'Ru', '', PROVENANCE.PUBLIC,
    '掩模保护层', 'Mask capping layer',
    '钌保护层，防止多层膜氧化'),
  exposureFieldWafer: P('exposureFieldWafer', '26 × 33', 'mm', PROVENANCE.PUBLIC,
    '晶圆曝光场', 'Exposure field on wafer',
    '单次扫描曝光场尺寸'),
  exposureFieldMask: P('exposureFieldMask', '104 × 132', 'mm', PROVENANCE.DERIVED,
    '掩模图形场', 'Field on mask',
    '4:1 缩比 → 晶圆场尺寸 × 4'),
  slitShape: P('slitShape', '弧形', '', PROVENANCE.PUBLIC,
    '照明狭缝形状', 'Illumination slit shape',
    '环形场（ring field）光学系统的弧形狭缝，扫描成完整曝光场'),
  scanRatio: P('scanRatio', '4×反向', '', PROVENANCE.PUBLIC,
    '掩模/晶圆扫描比', 'Reticle : wafer scan ratio',
    '掩模台以晶圆台 4 倍速度反向同步扫描'),
  resolution: P('resolution', 13, 'nm', PROVENANCE.PUBLIC,
    '光刻分辨率', 'Imaging resolution',
    '公开机型指标量级'),
  overlay: P('overlay', 1.1, 'nm', PROVENANCE.PUBLIC,
    '套刻精度', 'Overlay',
    '公开机型指标量级'),
  throughput: P('throughput', 160, '片/小时', PROVENANCE.PUBLIC,
    '产能', 'Throughput',
    '300 mm 晶圆，公开机型指标量级'),

  // —— 晶圆与光刻胶 ——
  waferDiameter: P('waferDiameter', 300, 'mm', PROVENANCE.PUBLIC,
    '晶圆直径', 'Wafer diameter',
    '业界标准 300 mm 硅晶圆'),
  resistThickness: P('resistThickness', '20–40', 'nm', PROVENANCE.SCHEMATIC,
    '光刻胶厚度', 'Photoresist thickness',
    '示意值：EUV 胶膜极薄以控制形貌'),
  resistDose: P('resistDose', 30, 'mJ/cm²', PROVENANCE.SCHEMATIC,
    '曝光剂量', 'Exposure dose',
    '示意值：达到潜影所需能量密度量级'),
  latentImage: P('latentImage', '潜影', '', PROVENANCE.PUBLIC,
    '潜影', 'Latent image',
    '曝光后胶层内部化学状态的不可见图形，显影后显现'),

  // —— 整机 ——
  machineMass: P('machineMass', 180, 't', PROVENANCE.PUBLIC,
    '整机质量', 'Machine mass',
    '公开量级：单台 EUV 光刻机约 180 吨，需数架货机分批运输'),
  partCount: P('partCount', 100000, '个', PROVENANCE.PUBLIC,
    '零件数量', 'Part count',
    '公开量级：约十万个零部件、数千条线缆与数百套子系统集成'),
  totalMirrors: P('totalMirrors', 11, '片', PROVENANCE.PUBLIC,
    '全机反射镜数量', 'Total mirror count',
    '集光镜 + 照明光学 + 投影物镜；每片损失约 30% 光'),
};

/** 便捷取值：PV('wavelength') → '13.5 nm' */
export function PV(id, { withUnit = true } = {}) {
  const p = PARAMS[id];
  if (!p) throw new Error(`[params] 未定义参数: ${id}`);
  const v = typeof p.value === 'number' ? formatNumber(p.value) : p.value;
  return withUnit && p.unit ? `${v} ${p.unit}` : String(v);
}

export function formatNumber(n) {
  if (!Number.isFinite(n)) return String(n);
  if (Number.isInteger(n) && Math.abs(n) >= 10000) return n.toLocaleString('en-US');
  return String(n);
}

/** 该参数是否必须携带「示意 / Simulation」标注 */
export function needsSimTag(id) {
  return PARAMS[id]?.provenance === PROVENANCE.SCHEMATIC;
}

// ───────────────────────────────────────────────────────────────────
// 2. 十个工艺步骤 —— 顺序即验收依据（规格书 §1.1）
//    order 字段固化顺序，test/ 会校验其完整性与单调性。
// ───────────────────────────────────────────────────────────────────
export const PROCESS_STEPS = [
  {
    order: 1,
    key: 'droplet',
    zh: '锡滴发生器喷射',
    en: 'Tin Droplet Generation',
    zhDesc: '锡滴发生器在超高真空腔内以约 50,000 滴/秒的频率，喷射直径 25–30 µm 的熔融锡微滴。',
    enDesc: 'Inside an ultra-high-vacuum vessel, the droplet generator ejects molten tin droplets 25–30 µm across at about 50,000 per second.',
    params: ['dropletDiameter', 'dropletRate', 'dropletVelocity', 'vacuumPressure'],
  },
  {
    order: 2,
    key: 'prepulse',
    zh: '预脉冲压扁锡滴',
    en: 'Pre-pulse Flattening',
    zhDesc: '预脉冲激光击打球形锡滴，将其压扁成圆盘状，扩大主脉冲的吸收截面，从而提高能量转换效率。',
    enDesc: 'A pre-pulse laser strikes the spherical droplet and flattens it into a disc, enlarging the absorption cross-section for the main pulse and raising conversion efficiency.',
    params: ['prePulseRole', 'pulseSeparation', 'conversionEfficiency'],
  },
  {
    order: 3,
    key: 'mainpulse',
    zh: '主脉冲生成等离子体',
    en: 'Main Pulse → Plasma',
    zhDesc: '高功率 CO₂ 主脉冲击打圆盘状锡滴，使其瞬间汽化电离，形成温度约 220,000 °C 的高温等离子体。',
    enDesc: 'The high-power CO₂ main pulse hits the flattened disc, vaporising and ionising it into a plasma at roughly 220,000 °C.',
    params: ['driveLaserType', 'driveLaserWavelength', 'driveLaserPower', 'plasmaTemperature'],
  },
  {
    order: 4,
    key: 'emission',
    zh: '等离子体辐射 13.5 nm EUV',
    en: '13.5 nm EUV Emission',
    zhDesc: '多电荷锡离子向整个空间辐射 13.5 nm 极紫外光。该波长人眼不可见，画面中的颜色为艺术化可视化表现。',
    enDesc: 'Multiply-charged tin ions radiate 13.5 nm extreme ultraviolet light in all directions. This wavelength is invisible to the eye; the colour here is an artistic visualisation.',
    params: ['wavelength', 'photonEnergy', 'plasmaIonState', 'inBandWidth'],
  },
  {
    order: 5,
    key: 'collector',
    zh: '多层膜集光镜聚焦至中间焦点',
    en: 'Multilayer Collector → Intermediate Focus',
    zhDesc: 'Mo/Si 多层膜椭球集光镜收集向后辐射的 EUV，并将其聚焦到中间焦点（IF）。等离子体位于椭球第一焦点，中间焦点为第二焦点。',
    enDesc: 'A Mo/Si multilayer ellipsoidal collector gathers the backward-radiated EUV and focuses it onto the intermediate focus. The plasma sits at the first ellipsoid focus; the intermediate focus is the second.',
    params: ['multilayerStack', 'multilayerPairs', 'multilayerPeriod', 'multilayerReflectance', 'euvPowerAtIF'],
  },
  {
    order: 6,
    key: 'purity',
    zh: '光谱纯化与锡碎屑防护',
    en: 'Spectral Purity & Debris Mitigation',
    zhDesc: '光谱纯化滤除 10.6 µm 红外等带外杂散光；氢气气流减缓并清洁锡碎屑，保护下游多层膜光学。',
    enDesc: 'A spectral purity stage rejects out-of-band radiation such as the 10.6 µm infrared, while a hydrogen flow slows and cleans tin debris to protect the downstream multilayer optics.',
    params: ['hydrogenPressure', 'hydrogenRole', 'driveLaserWavelength'],
  },
  {
    order: 7,
    key: 'illuminator',
    zh: '照明光学整形为均匀照明',
    en: 'Illuminator → Uniform Illumination',
    zhDesc: '照明光学系统的场面镜与光瞳面镜将光束整形为均匀的弧形照明狭缝，并设定照明光瞳。',
    enDesc: 'Field-facet and pupil-facet mirrors in the illuminator shape the beam into a uniform arcuate slit and define the illumination pupil.',
    params: ['slitShape', 'exposureFieldMask', 'vacuumPressure'],
  },
  {
    order: 8,
    key: 'mask',
    zh: 'EUV 照射反射式多层膜掩模',
    en: 'Reflective Multilayer Mask',
    zhDesc: 'EUV 以约 6° 离轴入射到反射式多层膜掩模；TaBN 吸收层遮挡处不反射，其余区域反射成像。EUV 光刻不存在透射式掩模。',
    enDesc: 'EUV strikes the reflective multilayer mask at about 6° off-axis. Where the TaBN absorber sits, light is blocked; elsewhere it reflects to form the image. EUV lithography has no transmissive mask.',
    params: ['maskIncidenceAngle', 'maskAbsorber', 'maskCapping', 'multilayerPairs'],
  },
  {
    order: 9,
    key: 'projection',
    zh: '投影光学 4:1 缩比成像',
    en: 'Projection Optics — 4:1 Reduction',
    zhDesc: '由多片非球面反射镜组成的投影物镜，将掩模图形以 4:1 缩比投影到晶圆；掩模台与晶圆台以 4 倍速反向同步扫描。',
    enDesc: 'The projection optics box — several aspheric mirrors, no lenses — projects the mask pattern onto the wafer at 4:1 reduction, with the reticle stage scanning four times faster than the wafer stage, in the opposite direction.',
    params: ['demagnification', 'numericalAperture', 'pobMirrorCount', 'scanRatio', 'exposureFieldWafer'],
  },
  {
    order: 10,
    key: 'exposure',
    zh: '光刻胶曝光成潜影与芯片图形',
    en: 'Resist Exposure → Latent Image → Pattern',
    zhDesc: 'EUV 光子在光刻胶内引发化学反应，形成不可见的潜影；经烘烤与显影，纳米级芯片图形最终显现。',
    enDesc: 'EUV photons trigger chemistry inside the photoresist, forming an invisible latent image. Bake and development finally reveal the nanometre-scale circuit pattern.',
    params: ['resistThickness', 'resistDose', 'latentImage', 'resolution'],
  },
];

/** 供 HUD / 字幕 / 测试使用的步骤索引 */
export const STEP_BY_KEY = Object.fromEntries(PROCESS_STEPS.map((s) => [s.key, s]));
export const STEP_COUNT = PROCESS_STEPS.length;

// ───────────────────────────────────────────────────────────────────
// 3. 强制标注文案（规格书 §1.2）
// ───────────────────────────────────────────────────────────────────
export const SIM_TAG = {
  zh: '示意',
  en: 'Simulation',
  both: '示意 / Simulation',
  /** 不可见光可视化的固定免责文案 */
  invisibleZh: '13.5 nm 极紫外光人眼不可见，画面颜色为艺术化示意',
  invisibleEn: '13.5 nm EUV is invisible to the human eye — colour is an artistic visualisation',
  /** 非等比/夸张表现的固定免责文案 */
  scaleZh: '尺度与时间经夸张处理，非等比',
  scaleEn: 'Scale and timing exaggerated — not to scale',
};

/** 全片必须常驻水印的场景键（不可见光 / 等离子体 / 夸张尺度） */
export const SIM_TAGGED_STEPS = new Set([
  'prepulse', 'mainpulse', 'emission', 'collector', 'purity',
  'illuminator', 'mask', 'projection', 'exposure', 'droplet',
]);
