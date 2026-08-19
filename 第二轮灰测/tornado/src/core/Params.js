/**
 * Params.js — 全局参数中心。UI 面板由 SCHEMA 自动生成，各系统 update() 时读取。
 * 支持 URL 覆盖（?t_steps=32&q_fft=64&scene=ocean&selftest=1），便于无头自检与低配调试。
 */

/** kind: range | bool | color | select */
export const SCHEMA = [
  { group: '龙卷风 · 形态', items: [
    { key: 't_visible',    label: '显示龙卷风',   kind: 'bool',  value: true },
    { key: 't_height',     label: '涡柱高度 (m)', min: 200,  max: 1600, step: 10,   value: 820 },
    { key: 't_baseRadius', label: '底部半径 (m)', min: 4,    max: 120,  step: 1,    value: 30 },
    { key: 't_topRadius',  label: '顶部展开 (m)', min: 30,   max: 520,  step: 5,    value: 135 },
    { key: 't_profile',    label: '漏斗曲率',     min: 0.3,  max: 3.5,  step: 0.05, value: 2.1 },
    { key: 't_hollow',     label: '空心程度',     min: 0,    max: 1,    step: 0.01, value: 0.62 },
    { key: 't_wall',       label: '涡壁厚度',     min: 0.06, max: 1.2,  step: 0.01, value: 0.34 },
    { key: 't_tilt',       label: '倾斜 (°)',     min: -35,  max: 35,   step: 0.5,  value: 7 },
    { key: 't_tiltDir',    label: '倾斜方位 (°)', min: 0,    max: 360,  step: 1,    value: 40 },
    { key: 't_wobble',     label: '摆动幅度',     min: 0,    max: 2.5,  step: 0.01, value: 0.42 },
    { key: 't_wobbleSpeed',label: '摆动频率',     min: 0,    max: 3,    step: 0.01, value: 0.45 },
    { key: 't_multi',      label: '多涡旋数量',   min: 0,    max: 4,    step: 1,    value: 0 },
  ]},
  { group: '龙卷风 · 动态', items: [
    { key: 't_swirl',      label: '旋转速度',     min: 0,    max: 9,    step: 0.05, value: 2.9 },
    { key: 't_diff',       label: '差动旋转',     min: 0,    max: 2,    step: 0.01, value: 0.95 },
    { key: 't_updraft',    label: '上升气流',     min: 0,    max: 3,    step: 0.01, value: 0.75 },
    { key: 't_turb',       label: '湍流强度',     min: 0,    max: 2,    step: 0.01, value: 0.9 },
    { key: 't_turbScale',  label: '湍流尺度',     min: 0.2,  max: 3,    step: 0.01, value: 1.0 },
    { key: 't_speed',      label: '移动速度 (m/s)',min: 0,   max: 30,   step: 0.5,  value: 7 },
    { key: 't_pathRadius', label: '路径半径 (m)', min: 0,    max: 900,  step: 10,   value: 300 },
    { key: 't_pathMode',   label: '移动模式',     kind: 'select', value: 'orbit',
      options: [['orbit','绕行'],['line','直线穿场'],['static','定点']] },
  ]},
  { group: '龙卷风 · 渲染', items: [
    { key: 't_density',    label: '烟尘浓度',     min: 0.05, max: 4,    step: 0.01, value: 1.25 },
    { key: 't_bright',     label: '亮度',         min: 0,    max: 3,    step: 0.01, value: 1.0 },
    { key: 't_ambient',    label: '环境光吸收',   min: 0,    max: 2,    step: 0.01, value: 0.62 },
    { key: 't_scatterG',   label: '前向散射 g',   min: -0.3, max: 0.9,  step: 0.01, value: 0.44 },
    { key: 't_condense',   label: '凝结白核',     min: 0,    max: 1,    step: 0.01, value: 0.55 },
    { key: 't_dust',       label: '地面尘裙',     min: 0,    max: 3,    step: 0.01, value: 1.1 },
    { key: 't_dustHeight', label: '尘裙高度 (m)', min: 5,    max: 260,  step: 5,    value: 70 },
    { key: 't_debris',     label: '碎片数量',     min: 0,    max: 3,    step: 0.05, value: 1.0 },
    { key: 't_steps',      label: '光线步数',     min: 20,   max: 168,  step: 4,    value: 76 },
    { key: 't_halfRes',    label: '半分辨率体积', kind: 'bool', value: true },
  ]},
  { group: '龙卷风 · 破坏力', items: [
    { key: 't_suction',    label: '吸力强度',     min: 0,    max: 4,    step: 0.05, value: 1.2 },
    { key: 't_lift',       label: '抬升力',       min: 0,    max: 4,    step: 0.05, value: 1.1 },
    { key: 't_damage',     label: '结构破坏阈值', min: 0.2,  max: 3,    step: 0.05, value: 1.0 },
    { key: 't_autoDamage', label: '自动破坏建筑', kind: 'bool', value: true },
  ]},
  { group: '水面（大海）', items: [
    { key: 'w_windSpeed',  label: '风速 (m/s)',   min: 2,    max: 28,   step: 0.5,  value: 12 },
    { key: 'w_windDir',    label: '风向 (°)',     min: 0,    max: 360,  step: 1,    value: 45 },
    { key: 'w_amp',        label: '浪高倍率',     min: 0,    max: 3,    step: 0.01, value: 1.0 },
    { key: 'w_choppy',     label: '浪尖锐度',     min: 0,    max: 2.5,  step: 0.01, value: 1.35 },
    { key: 'w_patch',      label: '波浪基尺度 (m)',min: 60,  max: 600,  step: 10,   value: 240 },
    { key: 'w_foam',       label: '泡沫',         min: 0,    max: 2.5,  step: 0.01, value: 0.95 },
    { key: 'w_sss',        label: '次表面透光',   min: 0,    max: 2,    step: 0.01, value: 0.95 },
    { key: 'w_reflect',    label: '反射强度',     min: 0,    max: 2,    step: 0.01, value: 1.0 },
    { key: 'w_vortexPull', label: '涡吸水柱',     min: 0,    max: 3,    step: 0.01, value: 1.15 },
    { key: 'w_ripple',     label: '物理涟漪耦合', min: 0,    max: 3,    step: 0.01, value: 1.2 },
    { key: 'w_spray',      label: '水雾飞沫',     min: 0,    max: 3,    step: 0.01, value: 1.2 },
  ]},
  { group: '统一光影', items: [
    { key: 'l_sunElev',    label: '太阳高度 (°)', min: -6,   max: 75,   step: 0.5,  value: 13 },
    { key: 'l_sunAzim',    label: '太阳方位 (°)', min: 0,    max: 360,  step: 1,    value: 116 },
    { key: 'l_turbidity',  label: '大气浑浊度',   min: 1,    max: 12,   step: 0.1,  value: 4.6 },
    { key: 'l_storm',      label: '风暴云量',     min: 0,    max: 1,    step: 0.01, value: 0.85 },
    { key: 'l_stormDark',  label: '云底压暗',     min: 0,    max: 1,    step: 0.01, value: 0.85 },
    { key: 'l_fog',        label: '雾/空气透视',  min: 0,    max: 3,    step: 0.01, value: 1.0 },
    { key: 'l_exposure',   label: '曝光',         min: 0.2,  max: 3,    step: 0.01, value: 1.05 },
    { key: 'l_bloom',      label: '泛光',         min: 0,    max: 2,    step: 0.01, value: 0.5 },
    { key: 'l_shadow',     label: '阴影',         kind: 'bool', value: true },
    { key: 'l_timeScale',  label: '时间流速',     min: 0,    max: 3,    step: 0.05, value: 1.0 },
  ]},
  { group: '画质 / LOD', items: [
    { key: 'q_renderScale',label: '渲染倍率',     min: 0.5,  max: 1.6,  step: 0.05, value: 1.0 },
    { key: 'q_lodBias',    label: 'LOD 距离倍率', min: 0.35, max: 2.5,  step: 0.05, value: 1.0 },
    { key: 'q_density',    label: '场景物件密度', min: 0.1,  max: 2,    step: 0.05, value: 1.0 },
    { key: 'q_fft',        label: '海面 FFT 分辨率', kind: 'select', value: 256,
      options: [[64,'64 (低)'],[128,'128'],[256,'256 (推荐)'],[512,'512 (高)']] },
    { key: 'q_shadowRes',  label: '阴影分辨率',   kind: 'select', value: 2048,
      options: [[1024,'1024'],[2048,'2048'],[4096,'4096']] },
    { key: 'q_showLod',    label: '显示 LOD 配色', kind: 'bool', value: false },
  ]},
];

/** 龙卷风预设 */
export const PRESETS = {
  'EF1 · 细绳涡': { t_height: 620, t_baseRadius: 10, t_topRadius: 90,  t_profile: 2.4, t_hollow: 0.4, t_wall: 0.5,
    t_swirl: 2.2, t_turb: 0.6, t_density: 0.85, t_dust: 0.6, t_dustHeight: 34, t_debris: 0.4, t_suction: 0.5,
    t_lift: 0.5, t_condense: 0.35, t_wobble: 0.8, t_multi: 0, t_speed: 9 },
  'EF3 · 经典漏斗': { t_height: 820, t_baseRadius: 30, t_topRadius: 135, t_profile: 2.1, t_hollow: 0.62, t_wall: 0.34,
    t_swirl: 2.9, t_turb: 0.9, t_density: 1.35, t_dust: 1.1, t_dustHeight: 70, t_debris: 1.0, t_suction: 1.2,
    t_lift: 1.1, t_condense: 0.55, t_wobble: 0.42, t_multi: 0, t_speed: 7 },
  'EF5 · 楔形巨兽': { t_height: 1150, t_baseRadius: 78, t_topRadius: 420, t_profile: 1.15, t_hollow: 0.5, t_wall: 0.62,
    t_swirl: 4.1, t_turb: 1.25, t_density: 1.9, t_dust: 2.1, t_dustHeight: 165, t_debris: 2.2, t_suction: 2.6,
    t_lift: 2.2, t_condense: 0.8, t_wobble: 0.22, t_multi: 3, t_speed: 12 },
  '多涡旋 · 撕裂': { t_height: 900, t_baseRadius: 46, t_topRadius: 300, t_profile: 1.4, t_hollow: 0.78, t_wall: 0.28,
    t_swirl: 5.2, t_turb: 1.5, t_density: 1.35, t_dust: 1.7, t_dustHeight: 120, t_debris: 1.8, t_suction: 2.0,
    t_lift: 1.7, t_condense: 0.45, t_wobble: 0.7, t_multi: 4, t_speed: 10 },
  '水龙卷 · 海上': { t_height: 700, t_baseRadius: 16, t_topRadius: 130, t_profile: 2.0, t_hollow: 0.55, t_wall: 0.4,
    t_swirl: 2.5, t_turb: 0.7, t_density: 1.0, t_dust: 1.3, t_dustHeight: 52, t_debris: 0.5, t_suction: 1.0,
    t_lift: 1.0, t_condense: 0.95, t_wobble: 0.5, t_multi: 0, t_speed: 5 },
};

class ParamStore {
  constructor() {
    /** @type {Record<string, any>} */
    this.values = {};
    /** @type {Record<string, any>} */
    this.meta = {};
    this._listeners = new Map();   // key -> Set<fn>
    this._any = new Set();
    for (const g of SCHEMA) {
      for (const it of g.items) {
        this.meta[it.key] = { ...it, kind: it.kind || 'range', group: g.group };
        this.values[it.key] = it.value;
      }
    }
    this._applyUrl();
  }

  _applyUrl() {
    const q = new URLSearchParams(location.search);
    for (const [k, v] of q.entries()) {
      if (!(k in this.values)) continue;
      const m = this.meta[k];
      if (m.kind === 'bool') this.values[k] = v !== '0' && v !== 'false';
      else if (m.kind === 'select') this.values[k] = typeof m.value === 'number' ? Number(v) : v;
      else if (m.kind === 'color') this.values[k] = v;
      else this.values[k] = Number(v);
    }
  }

  get(k) { return this.values[k]; }
  /** 角度参数转弧度 */
  rad(k) { return this.values[k] * Math.PI / 180; }

  set(k, v, silent = false) {
    if (this.values[k] === v) return;
    this.values[k] = v;
    if (silent) return;
    const s = this._listeners.get(k);
    if (s) for (const fn of s) fn(v, k);
    for (const fn of this._any) fn(v, k);
  }

  /** 监听单个键 */
  on(k, fn) {
    if (!this._listeners.has(k)) this._listeners.set(k, new Set());
    this._listeners.get(k).add(fn);
    return () => this._listeners.get(k).delete(fn);
  }
  /** 监听任意变化 */
  onAny(fn) { this._any.add(fn); return () => this._any.delete(fn); }

  applyPreset(name) {
    const p = PRESETS[name];
    if (!p) return;
    for (const k in p) this.set(k, p[k]);
  }

  resetAll() {
    for (const k in this.meta) this.set(k, this.meta[k].value);
  }

  snapshot() { return { ...this.values }; }
}

export const P = new ParamStore();

/** URL 开关 */
export const FLAGS = (() => {
  const q = new URLSearchParams(location.search);
  return {
    scene: q.get('scene') || 'plain',
    selftest: q.get('selftest') === '1',
    cycle: q.get('cycle') === '1',
    frames: Number(q.get('frames') || 0),
    noui: q.get('noui') === '1',
    freecam: q.get('freecam') === '1',
    cam: q.get('cam') || '',
    camDist: Number(q.get('camDist') || 0),
    fixedDt: q.get('fixedDt') ? Number(q.get('fixedDt')) : 0,
    lowend: q.get('lowend') === '1',
    /** 固定体积步数倍率（1 = 不做性能自适应），用于无头出图对比真实画质 */
    perf: q.get('perf') ? Number(q.get('perf')) : 0,
  };
})();
