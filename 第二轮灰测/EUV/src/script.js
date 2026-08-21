/**
 * script.js — 分镜脚本与时间轴（叙事真源）
 * ==================================================================
 * 规格书 §3 授权执行方自主决定叙事、镜头、节奏。本文件即最终脚本：
 * 一份数据结构同时驱动 摄影机 / 光效 / HUD / 字幕 / 音频，
 * 因此「音画同步」与「字幕与画面一致」由结构本身保证，而非人工对齐。
 *
 * 时间轴 = 18 个镜头，总时长 180 s @ 30 fps = 5400 帧。
 * 10 个工艺步骤按规格书 §1.1 的顺序逐一出现，顺序由 test/checks.js 断言。
 *
 * 摄影机机位一律由 layout.js 的节点派生（at() / off()），
 * 因此调整光学布局后镜头自动跟随，不会出现"镜头对着空气"。
 */

import { PROCESS_STEPS, PARAMS, PV, SIM_TAG } from './params.js';
import {
  CHAIN_BY_KEY, PLASMA, IF_POINT, COLLECTOR_VERTEX, COLLECTOR_REF, DROPLET_NOZZLE,
  DROPLET_CATCHER, LASER_ORIGIN, ILLUMINATOR, MASK, POB, WAFER, PURITY, BOUNDS, vec,
} from './layout.js';
import { FILM } from './config.js';

const { V, add, scale, sub, len, norm } = vec;

/** 取节点位置 + 偏移 */
const at = (key, dx = 0, dy = 0, dz = 0) => {
  const n = CHAIN_BY_KEY[key];
  if (!n) throw new Error(`[script] 未知光路节点: ${key}`);
  return V(n.pos.x + dx, n.pos.y + dy, n.pos.z + dz);
};
const off = (p, dx = 0, dy = 0, dz = 0) => V(p.x + dx, p.y + dy, p.z + dz);

// ═══════════════════════════════════════════════════════════════════
// 缓动函数
// ═══════════════════════════════════════════════════════════════════
export const EASE = {
  linear: (t) => t,
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  in: (t) => t * t * t,
  /** 电影感运镜：起步慢、中段快、收尾极慢（长尾稳定，便于阅读字幕） */
  cine: (t) => {
    const a = 1 - Math.pow(1 - t, 4.2);
    return a * 0.86 + EASE.inOut(t) * 0.14;
  },
};

/** 关键帧采样：kf([[t,v],...]) → f(localT) */
export function kf(points, ease = EASE.inOut) {
  const p = points.slice().sort((a, b) => a[0] - b[0]);
  return (t) => {
    if (t <= p[0][0]) return p[0][1];
    if (t >= p[p.length - 1][0]) return p[p.length - 1][1];
    for (let i = 0; i < p.length - 1; i++) {
      if (t >= p[i][0] && t <= p[i + 1][0]) {
        const span = p[i + 1][0] - p[i][0] || 1;
        const u = ease((t - p[i][0]) / span);
        return p[i][1] + (p[i + 1][1] - p[i][1]) * u;
      }
    }
    return p[p.length - 1][1];
  };
}

/** 常量曲线 */
const K = (v) => () => v;
/** 单次脉冲：在 tc 处出现，宽度 w */
const pulse = (tc, w, peak = 1) => (t) => peak * Math.exp(-Math.pow((t - tc) / w, 2));

// ═══════════════════════════════════════════════════════════════════
// AMBIENT —— 机器状态的「绝对时间包络」
// ═══════════════════════════════════════════════════════════════════
// 本片是一条连续运镜（每个镜头的 from = 上一镜头的 to），没有硬切。
// 如果把「锡滴流强度」「等离子体亮度」「光束强度」这类持续量写成逐镜头常量，
// 镜头交界处就会出现阶跃 → 观众看到的就是一帧闪烁。
//
// 因此这些量一律定义为**绝对时间**上的连续关键帧曲线，跨镜头天然连续；
// 镜头自身的 fx 只负责「戏剧性瞬时量」（白闪、撞击、命中、图版淡入等）。
// 交界连续性由 test/checks.js 的 E 组断言强制校验。
//
// 时间锚点（秒）：S00 0 · S01 11 · S02 22 · S03 30 · S04 40 · S05 47 · S06 58
//              S07 68 · S08 78 · S09 90 · S10 98 · S11 110 · S12 122
//              S13 134 · S14 148 · S15 158 · S16 166 · S17 175 · 结束 180
// ═══════════════════════════════════════════════════════════════════

/** 绝对时间关键帧：kfAbs([[秒, 值], ...]) → f(absoluteSeconds) */
export function kfAbs(points, ease = EASE.inOut) {
  const p = points.slice().sort((a, b) => a[0] - b[0]);
  return (t) => {
    if (t <= p[0][0]) return p[0][1];
    if (t >= p[p.length - 1][0]) return p[p.length - 1][1];
    for (let i = 0; i < p.length - 1; i++) {
      if (t >= p[i][0] && t <= p[i + 1][0]) {
        const span = p[i + 1][0] - p[i][0] || 1;
        return p[i][1] + (p[i + 1][1] - p[i][1]) * ease((t - p[i][0]) / span);
      }
    }
    return p[p.length - 1][1];
  };
}

export const AMBIENT = {
  // —— 外壳与遮幅 ——
  housing: kfAbs([[0, 1], [20.5, 1], [22, 0.86], [26.4, 0], [180, 0]]),
  letterbox: kfAbs([[0, 0.055], [30, 0.055], [31.5, 0], [172.5, 0], [175, 0.055], [180, 0.055]]),

  // —— 光源：锡滴流与驱动激光 ——
  dropletFlow: kfAbs([[0, 0], [31, 0], [33.4, 1], [47, 1], [58, 0.85], [68, 0.70],
                      [78, 0.55], [90, 0.50], [98, 0.45], [110, 0.45], [122, 0.40],
                      [134, 0.35], [148, 0.30], [158, 0.26], [166, 0.20], [169, 0.70],
                      [178.5, 0.10]]),
  dropletSpeed: kfAbs([[0, 1], [180, 1]]),
  laserUpstream: kfAbs([[0, 0], [43.9, 0], [47, 0.50], [50.1, 1.0], [68, 1.0], [78, 0.70],
                        [90, 0.55], [98, 0.35], [110, 0.20], [122, 0.12], [134, 0.06],
                        [166, 0.06], [178, 0]]),

  // —— 等离子体（主脉冲峰值内建于曲线，镜头不再单独覆盖）——
  plasma: kfAbs([[0, 0], [60.6, 0], [61.1, 0.80], [63.5, 0.54], [68, 0.46], [78, 0.42],
                 [90, 0.38], [98, 0.28], [110, 0.28], [122, 0.26], [134, 0.24],
                 [148, 0.22], [158, 0.18], [166, 0.18], [169.6, 0.50], [178.7, 0.05]]),

  // —— EUV 辐射与收集 ——
  euvHead: kfAbs([[0, 0], [61.2, 0], [64.2, 0.28], [68, 0.28], [73.5, 1], [180, 1]]),
  spray: kfAbs([[0, 0], [61.2, 0], [63, 0.50], [68, 0.50], [71.2, 1.0], [78, 1.0],
                [84, 0.28], [90, 0.15], [98, 0.12], [110, 0.10], [148, 0.08],
                [166, 0.30], [178, 0.05]]),
  spraySteady: kfAbs([[0, 0], [71.2, 0], [75, 0.55], [78, 0.55], [84, 0.12], [90, 0.05],
                      [98, 0.05], [166, 0.05], [169.6, 0.12], [178, 0]]),
  collected: kfAbs([[0, 0], [78.7, 0], [82.1, 0.75], [90, 0.52], [98, 0.30], [110, 0.28],
                    [122, 0.24], [134, 0.20], [148, 0.17], [158, 0.14], [166, 0.14],
                    [169.6, 0.72], [178.7, 0.10]]),
  euvSteady: kfAbs([[0, 0], [82.1, 0], [86.4, 0.52], [90, 0.30], [98, 0.20], [110, 0.18],
                    [122, 0.17], [134, 0.16], [148, 0.14], [158, 0.12], [166, 0.12],
                    [169.6, 0.58], [178.7, 0.10]]),

  // —— 氢气 / 碎屑 ——
  gas: kfAbs([[0, 0], [26.8, 0], [30, 0.20], [47, 0.20], [58, 0.22], [78, 0.24],
              [90, 0.30], [98, 0.30], [101.6, 1.0], [110, 0.50], [122, 0.40],
              [134, 0.32], [148, 0.26], [158, 0.20], [166, 0.40], [173, 0]]),

  // —— 下游光路 ——
  beamHead: kfAbs([[0, 0], [94.4, 0], [98, 0.06], [110, 0.10], [117.4, 0.46], [122, 0.46],
                   [127, 0.62], [134, 0.62], [142.1, 0.965], [148, 0.965], [150.2, 1.0],
                   [180, 1.0]]),
  beamIntensity: kfAbs([[0, 0], [94.4, 0], [98, 0.58], [110, 0.52], [113.6, 1.0],
                        [158, 1.0], [162.8, 0.35], [166, 0.35], [169.6, 1.0], [178.5, 0.15]]),

  // —— 掩模 / 狭缝 / 缩比图示 ——
  maskGlow: kfAbs([[0, 0], [125.6, 0], [128.6, 1], [134, 0.85], [148, 0.60], [158, 0.30],
                   [162, 0], [180, 0]]),
  slit: kfAbs([[0, 0], [128.6, 0], [131.4, 1], [134, 0.90], [158, 0.90], [160.4, 0], [180, 0]]),
  field: kfAbs([[0, 0], [138.2, 0], [141.3, 1], [148, 1], [150.5, 0], [180, 0]]),

  // —— 曝光 / 显影 / 芯片 ——
  latent: kfAbs([[0, 0], [150.4, 0], [153, 1], [160.7, 1], [163, 0.2], [166, 0], [180, 0]]),
  develop: kfAbs([[0, 0], [159.3, 0], [163, 1], [180, 1]]),
  chips: kfAbs([[0, 0], [161.4, 0], [165.2, 1], [180, 1]]),
  resist: kfAbs([[0, 1], [158, 1], [162, 0.35], [180, 0.35]]),
};

/**
 * 由 AMBIENT 管理的通道。镜头 fx 中同名键将被忽略（包络优先），
 * 以此在结构上杜绝镜头交界处的阶跃闪烁。
 */
export const AMBIENT_KEYS = new Set(Object.keys(AMBIENT));

/** 取绝对时间上的机器状态包络 */
export function ambientAt(time) {
  const out = {};
  for (const [k, f] of Object.entries(AMBIENT)) out[k] = f(time);
  return out;
}


// ═══════════════════════════════════════════════════════════════════
// 镜头表 —— 每个镜头一条记录
// ═══════════════════════════════════════════════════════════════════
const S = PROCESS_STEPS.reduce((m, s) => (m[s.key] = s, m), {});

/** 生成中英双语字幕条目 */
const cap = (t0, t1, zh, en) => ({ t0, t1, zh, en });

export const SHOTS = [
  // ───────────────────────────── 片头 ─────────────────────────────
  {
    id: 'S00', name: '片头 · 标题', dur: 11, step: null, act: '片头',
    desc: '黑场渐入。整机轮廓自暗部浮现，标题与副标题淡入。建立"精密、冷峻、庞大"的第一印象。',
    camera: {
      from: off(BOUNDS.center, 38, 22, 112), to: off(BOUNDS.center, 26, 15, 90),
      lookFrom: off(BOUNDS.center, 4, 2, 0), lookTo: off(BOUNDS.center, 0, 4, 0),
      fov: [34, 31], ease: EASE.cine, focus: 96,
    },
    fx: { housing: K(1), fade: kf([[0, 1], [0.22, 0]]), letterbox: K(0.055) },
    grade: { saturation: 0.92, contrast: 1.02, vignette: 0.44 },
    hud: { title: true, chapter: null },
    captions: [
      cap(0.30, 0.72, '这是当代人类制造精度的顶点', 'The apex of human manufacturing precision'),
      cap(0.74, 1.00, '一台 EUV 光刻机', 'An EUV lithography machine'),
    ],
    audio: [{ cue: 'intro', at: 0.0 }, { cue: 'sub_drop', at: 0.22 }],
  },
  {
    id: 'S01', name: '整机建立镜头', dur: 11, step: null, act: '片头',
    desc: '绕机环绕运镜，展示整机体量与三大模块：驱动激光、光源腔、扫描机。HUD 标出模块名。',
    camera: {
      from: off(BOUNDS.center, 26, 15, 90), to: off(BOUNDS.center, -64, 26, 70),
      lookFrom: off(BOUNDS.center, 0, 4, 0), lookTo: off(BOUNDS.center, -6, 6, 0),
      fov: [31, 33], ease: EASE.inOutCubic, focus: 88, orbit: true,
    },
    fx: { housing: kf([[0, 1], [0.86, 1], [1, 0.86]]), letterbox: K(0.055) },
    grade: { saturation: 0.95, contrast: 1.03, vignette: 0.40 },
    hud: {
      modules: true,
      stats: [['machineMass', 0.18], ['partCount', 0.42], ['totalMirrors', 0.66]],
    },
    captions: [
      cap(0.04, 0.40, `整机约 ${PV('machineMass')}，逾 ${PV('partCount')}零件`, `About ${PV('machineMass')}, over ${PARAMS.partCount.value.toLocaleString('en-US')} parts`),
      cap(0.44, 0.78, '它的任务只有一件：把电路图形印到硅片上', 'Its single job: print circuit patterns onto silicon'),
      cap(0.80, 1.00, '用一种波长只有 13.5 纳米的光', 'Using light just 13.5 nanometres long'),
    ],
    audio: [{ cue: 'riser', at: 0.6 }],
  },
  {
    id: 'S02', name: '穿入真空腔', dur: 8, step: null, act: '片头',
    desc: '外壳板溶解，摄影机穿过腔壁进入超高真空内部。强调"全程真空"的物理必要性。',
    camera: {
      from: off(BOUNDS.center, -64, 26, 70), to: off(PLASMA, 6, 3.5, 24),
      lookFrom: off(BOUNDS.center, -6, 6, 0), lookTo: off(PLASMA, 0, 0, 0),
      fov: [33, 40], ease: EASE.cine, focus: 30,
    },
    fx: { housing: kf([[0, 0.86], [0.55, 0]]), letterbox: K(0.055), gas: kf([[0.6, 0], [1, 0.25]]) },
    grade: { saturation: 1.0, contrast: 1.05, vignette: 0.36 },
    hud: { simNote: 'machineScale', params: [['vacuumPressure', 0.42], ['euvAirAbsorption', 0.7]] },
    captions: [
      cap(0.06, 0.46, 'EUV 会被空气吸收，传播不到一毫米', 'Air absorbs EUV within a millimetre'),
      cap(0.50, 1.00, `所以整条光路必须置于 ${PV('vacuumPressure')} 的超高真空中`, `So the entire light path sits in ultra-high vacuum at ${PV('vacuumPressure')}`),
    ],
    audio: [{ cue: 'whoosh', at: 0.1 }, { cue: 'vacuum', at: 0.55 }],
  },

  // ──────────────────── 步骤 1：锡滴发生器 ────────────────────
  {
    id: 'S03', name: '步骤 1 · 锡滴发生器', dur: 10, step: 'droplet', act: '光源',
    /** 有意的硬切：序幕结束 → 工艺链开始。硬切处允许机位与光效跳变。 */
    cut: true,
    desc: '仰视锡滴发生器喷嘴。储罐内熔融锡经压电调制，以 50,000 滴/秒射出。',
    camera: {
      from: off(DROPLET_NOZZLE, 4.5, -1.5, 12), to: off(DROPLET_NOZZLE, 1.5, -5.0, 7.5),
      lookFrom: off(DROPLET_NOZZLE, 0, 1.0, 0), lookTo: off(DROPLET_NOZZLE, 0, -3.5, 0),
      fov: [40, 34], ease: EASE.cine, focus: 9,
    },
    fx: {},
    grade: { saturation: 1.04, contrast: 1.05, vignette: 0.34 },
    hud: {
      label: 'DROPLET_GEN', simNote: 'dropletRadius',
      params: [['tinMeltingPoint', 0.12], ['dropletDiameter', 0.34], ['dropletRate', 0.56], ['dropletVelocity', 0.78]],
    },
    captions: [
      cap(0.04, 0.30, '第一步：锡滴发生器', 'Step 1 — The tin droplet generator'),
      cap(0.32, 0.62, `熔融锡在 ${PV('tinMeltingPoint')} 以上保持液态，经压电调制喷出`, `Molten tin, held above ${PV('tinMeltingPoint')}, is ejected under piezo modulation`),
      cap(0.64, 1.00, `直径 ${PV('dropletDiameter')} 的锡滴，每秒 ${PARAMS.dropletRate.value.toLocaleString('en-US')} 颗`, `Droplets ${PV('dropletDiameter')} across — ${PARAMS.dropletRate.value.toLocaleString('en-US')} every second`),
    ],
    audio: [{ cue: 'chapter', at: 0.02 }, { cue: 'droplet_loop', at: 0.3 }],
  },
  {
    id: 'S04', name: '步骤 1 · 锡滴射流', dur: 7, step: 'droplet', act: '光源',
    desc: '横移跟随锡滴流下落，露出等离子体点与集光镜中心孔的相对位置。',
    camera: {
      from: off(DROPLET_NOZZLE, 1.5, -5.0, 7.5), to: off(PLASMA, 3.0, 2.2, 9.5),
      lookFrom: off(DROPLET_NOZZLE, 0, -3.5, 0), lookTo: off(PLASMA, 0, 0.4, 0),
      fov: [34, 30], ease: EASE.inOutCubic, focus: 10,
    },
    fx: { dropletFlow: K(1), dropletSpeed: K(1), gas: K(0.2), laserUpstream: kf([[0.55, 0], [1, 0.5]]) },
    grade: { saturation: 1.04, contrast: 1.05, vignette: 0.34 },
    hud: {
      label: 'DROPLET_JET', simNote: 'timeScale',
      params: [['dropletSpacing', 0.2], ['vacuumPressure', 0.55]],
    },
    captions: [
      cap(0.05, 0.45, `滴间距约 ${PV('dropletSpacing')}，射流笔直穿过腔体中心`, `Spaced about ${PV('dropletSpacing')} apart, the jet crosses the vessel centre`),
      cap(0.50, 1.00, '那个中心，就是等离子体即将诞生的位置', 'That centre is where the plasma is about to be born'),
    ],
    audio: [{ cue: 'droplet_loop', at: 0 }, { cue: 'tension', at: 0.5 }],
  },

  // ──────────────────── 步骤 2：预脉冲压扁 ────────────────────
  {
    id: 'S05', name: '步骤 2 · 预脉冲压扁成盘', dur: 11, step: 'prepulse', act: '光源',
    desc: '极特写。预脉冲自 -X 方向击中球形锡滴，锡滴被压扁成圆盘。强调这是为提高转换效率。',
    camera: {
      from: off(PLASMA, 3.0, 2.2, 9.5), to: off(PLASMA, 2.2, 0.7, 3.1),
      lookFrom: off(PLASMA, 0, 0.4, 0), lookTo: off(PLASMA, 0, 0, 0),
      fov: [30, 22], ease: EASE.cine, focus: 3.4, aperture: 0.00034,
    },
    fx: {
      heroPos: kf([[0, 0.34], [0.30, 0.5]], EASE.linear), heroVisible: K(1),
      prePulse: pulse(0.36, 0.035, 1),
      pancake: kf([[0.34, 0], [0.40, 0.35], [0.52, 1], [1, 1]], EASE.out),
      flash: pulse(0.36, 0.016, 0.20),
    },
    grade: { saturation: 1.06, contrast: 1.07, vignette: 0.30 },
    hud: {
      label: 'PRE_PULSE', simNote: 'irColor',
      params: [['driveLaserWavelength', 0.10], ['prePulseRole', 0.40], ['conversionEfficiency', 0.68], ['pulseSeparation', 0.86]],
    },
    captions: [
      cap(0.03, 0.30, '第二步：预脉冲激光', 'Step 2 — The pre-pulse laser'),
      cap(0.32, 0.44, '击中', 'Impact'),
      cap(0.46, 0.74, '球形锡滴被压扁成一枚圆盘', 'The spherical droplet is flattened into a disc'),
      cap(0.76, 1.00, `更大的迎光面积，把能量转换效率推到约 ${PV('conversionEfficiency')}`, `A larger target area pushes conversion efficiency to about ${PV('conversionEfficiency')}`),
    ],
    audio: [{ cue: 'chapter', at: 0.02 }, { cue: 'prepulse_hit', at: 0.36 }],
  },

  // ──────────────────── 步骤 3：主脉冲等离子体 ────────────────────
  {
    id: 'S06', name: '步骤 3 · 主脉冲汽化成等离子体', dur: 10, step: 'mainpulse', act: '光源',
    desc: '主脉冲击中圆盘，锡瞬间汽化电离，形成约 220,000 °C 的高温等离子体。全片能量峰值。',
    camera: {
      from: off(PLASMA, 2.2, 0.7, 3.1), to: off(PLASMA, 4.6, 1.6, 6.4),
      lookFrom: off(PLASMA, 0, 0, 0), lookTo: off(PLASMA, 0, 0, 0),
      fov: [22, 27], ease: EASE.out, focus: 6.6, aperture: 0.00030,
    },
    fx: {
      heroPos: K(0.5), pancake: K(1),
      heroVisible: kf([[0, 1], [0.29, 1], [0.31, 0]], EASE.linear),
      mainPulse: pulse(0.30, 0.028, 1),
      flash: pulse(0.30, 0.020, 0.40),
      shake: pulse(0.31, 0.05, 1),
    },
    grade: { saturation: 1.08, contrast: 1.10, vignette: 0.28, halation: 0.24 },
    bloom: { strength: [0.46, 0.58], threshold: [0.84, 0.78] },
    hud: {
      label: 'MAIN_PULSE', simNote: 'timeScale',
      params: [['driveLaserType', 0.06], ['driveLaserPower', 0.20], ['plasmaTemperature', 0.42], ['plasmaIonState', 0.70]],
    },
    captions: [
      cap(0.02, 0.26, `第三步：${PV('driveLaserPower')} 的 CO₂ 主脉冲`, `Step 3 — The ${PV('driveLaserPower')} CO₂ main pulse`),
      cap(0.33, 0.60, `锡盘瞬间汽化电离，温度约 ${PARAMS.plasmaTemperature.value.toLocaleString('en-US')} °C`, `The tin disc vaporises and ionises at about ${PARAMS.plasmaTemperature.value.toLocaleString('en-US')} °C`),
      cap(0.62, 1.00, '一团高电荷态锡离子等离子体诞生了', 'A plasma of multiply-charged tin ions is born'),
    ],
    audio: [{ cue: 'chapter', at: 0.01 }, { cue: 'main_impact', at: 0.30 }, { cue: 'plasma_hum', at: 0.34 }],
  },

  // ──────────────────── 步骤 4：13.5 nm 辐射 ────────────────────
  {
    id: 'S07', name: '步骤 4 · 辐射 13.5 nm EUV', dur: 10, step: 'emission', act: '光源',
    desc: '拉开，露出等离子体向 4π 方向辐射。反复强调 13.5 nm 人眼不可见，画面着色为示意。',
    camera: {
      from: off(PLASMA, 4.6, 1.6, 6.4), to: off(PLASMA, 7.5, 4.5, 17.5),
      lookFrom: off(PLASMA, 0, 0, 0), lookTo: off(PLASMA, 1.2, 0.4, 0),
      fov: [27, 32], ease: EASE.cine, focus: 18, aperture: 0.00020,
    },
    fx: {},
    grade: { saturation: 1.06, contrast: 1.07, vignette: 0.30, halation: 0.20 },
    hud: {
      label: 'EUV_EMISSION', simNote: 'euvColor', simBanner: true,
      params: [['wavelength', 0.08], ['photonEnergy', 0.32], ['inBandWidth', 0.58], ['plasmaLifetime', 0.80]],
    },
    captions: [
      cap(0.02, 0.28, `第四步：等离子体向四面八方辐射 ${PV('wavelength')} 极紫外光`, `Step 4 — The plasma radiates ${PV('wavelength')} EUV in all directions`),
      cap(0.30, 0.62, SIM_TAG.invisibleZh, SIM_TAG.invisibleEn),
      cap(0.64, 1.00, `单个光子能量约 ${PV('photonEnergy')}，是可见光的四十多倍`, `Each photon carries about ${PV('photonEnergy')} — over forty times a visible photon`),
    ],
    audio: [{ cue: 'chapter', at: 0.01 }, { cue: 'euv_shimmer', at: 0.3 }],
  },

  // ──────────────────── 步骤 5：集光镜 → 中间焦点 ────────────────────
  {
    id: 'S08', name: '步骤 5 · 多层膜集光镜收集', dur: 12, step: 'collector', act: '收集',
    desc: '横移到集光镜正面，露出椭球面与 Mo/Si 多层膜干涉色。被收集的光线在镜面反射。',
    camera: {
      from: off(PLASMA, 7.5, 4.5, 17.5), to: off(COLLECTOR_REF, 16.5, 3.0, 22.0),
      lookFrom: off(PLASMA, 1.2, 0.4, 0), lookTo: off(COLLECTOR_VERTEX, 5.5, 0, 0),
      fov: [32, 36], ease: EASE.cine, focus: 26, aperture: 0.00018,
    },
    fx: {},
    grade: { saturation: 1.05, contrast: 1.06, vignette: 0.32 },
    hud: {
      label: 'COLLECTOR', simNote: 'euvColor',
      params: [['multilayerStack', 0.08], ['multilayerPairs', 0.28], ['multilayerPeriod', 0.48], ['multilayerReflectance', 0.68], ['mirrorRoughness', 0.86]],
    },
    captions: [
      cap(0.02, 0.26, '第五步：多层膜椭球集光镜', 'Step 5 — The multilayer ellipsoidal collector'),
      cap(0.28, 0.56, `${PV('multilayerPairs')} 钼／硅交替镀层，靠布拉格干涉反射 13.5 nm`, `${PV('multilayerPairs')} alternating molybdenum/silicon layers reflect 13.5 nm by Bragg interference`),
      cap(0.58, 0.82, `面形粗糙度 ${PV('mirrorRoughness')} —— 放大到国土尺度，起伏不超过一毫米`, `Surface roughness ${PV('mirrorRoughness')} — scaled to a country, the bumps stay under a millimetre`),
      cap(0.84, 1.00, '等离子体正位于椭球的第一焦点', 'The plasma sits at the first focus of the ellipsoid'),
    ],
    audio: [{ cue: 'chapter', at: 0.01 }, { cue: 'reveal', at: 0.3 }],
  },
  {
    id: 'S09', name: '步骤 5 · 汇聚中间焦点', dur: 8, step: 'collector', act: '收集',
    desc: '沿光轴推进，数百条反射光线精确汇聚于中间焦点 —— 这是几何真实反射的结果，非美术曲线。',
    camera: {
      from: off(COLLECTOR_REF, 16.5, 3.0, 22.0), to: off(IF_POINT, -3.0, 2.6, 8.6),
      lookFrom: off(COLLECTOR_VERTEX, 5.5, 0, 0), lookTo: off(IF_POINT, 0.4, 0, 0),
      fov: [36, 30], ease: EASE.cine, focus: 9.2, aperture: 0.00028,
    },
    fx: {},
    grade: { saturation: 1.05, contrast: 1.02, vignette: 0.36 },
    bloom: { strength: [0.34, 0.30], threshold: [0.88, 0.90] },
    hud: {
      label: 'IF', simNote: 'euvColor',
      params: [['collectorSolidAngle', 0.12], ['euvPowerAtIF', 0.48]],
      ifCallout: true,
    },
    captions: [
      cap(0.04, 0.44, '所有被收集的光线，精确汇聚到椭球的第二焦点', 'Every collected ray converges on the second focus of the ellipsoid'),
      cap(0.46, 1.00, `这个点叫中间焦点，此处的 EUV 功率约 ${PV('euvPowerAtIF')}`, `This point is the intermediate focus — about ${PV('euvPowerAtIF')} of EUV power`),
    ],
    audio: [{ cue: 'converge', at: 0.1 }, { cue: 'ping', at: 0.5 }],
  },

  // ──────────────────── 步骤 6：光谱纯化与碎屑防护 ────────────────────
  {
    id: 'S10', name: '步骤 6 · 光谱纯化与锡碎屑防护', dur: 12, step: 'purity', act: '收集',
    desc: '侧视净化段。氢气帘扫走锡碎屑，光谱纯化滤除 10.6 µm 红外与带外杂散光。',
    camera: {
      from: off(IF_POINT, -3.0, 2.6, 8.6), to: off(PURITY.spf.pos, -6.0, 5.6, 13.0),
      lookFrom: off(IF_POINT, 0.4, 0, 0), lookTo: off(PURITY.gasCurtain.from, 4.0, 0, 0),
      fov: [30, 34], ease: EASE.inOutCubic, focus: 14.5, aperture: 0.00020,
    },
    fx: {
      debrisHighlight: kf([[0.3, 0], [0.62, 1], [0.92, 0.4], [1, 0]]),
      irReject: kf([[0.55, 0], [0.78, 1], [0.92, 0.5], [1, 0]]),
    },
    grade: { saturation: 1.04, contrast: 1.02, vignette: 0.36 },
    bloom: { strength: [0.32, 0.36], threshold: [0.90, 0.88] },
    hud: {
      label: 'PURITY', simNote: 'irColor',
      params: [['hydrogenPressure', 0.10], ['hydrogenRole', 0.36], ['driveLaserWavelength', 0.62], ['multilayerReflectance', 0.84]],
    },
    captions: [
      cap(0.02, 0.26, '第六步：光谱纯化与锡碎屑防护', 'Step 6 — Spectral purity and debris mitigation'),
      cap(0.28, 0.56, '氢气流减缓并带走锡碎屑，保护下游每一片多层膜', 'A hydrogen flow slows and carries away tin debris, protecting every downstream multilayer'),
      cap(0.58, 0.80, `氢自由基与沉积锡反应生成挥发性锡烷：${PARAMS.hydrogenRole.value}`, `Hydrogen radicals convert deposited tin into volatile stannane: ${PARAMS.hydrogenRole.value}`),
      cap(0.82, 1.00, `同时滤除 ${PV('driveLaserWavelength')} 红外等带外辐射`, `Meanwhile out-of-band radiation such as the ${PV('driveLaserWavelength')} infrared is rejected`),
    ],
    audio: [{ cue: 'chapter', at: 0.01 }, { cue: 'gas_flow', at: 0.3 }],
  },

  // ──────────────────── 步骤 7：照明光学 ────────────────────
  {
    id: 'S11', name: '步骤 7 · 照明光学整形', dur: 12, step: 'illuminator', act: '成像',
    desc: '摄影机上升，露出照明系统的折返式光路。核心知识点：多层膜只在近法向入射有效，故光路必须折返。',
    camera: {
      from: off(PURITY.spf.pos, -6.0, 5.6, 13.0), to: off(ILLUMINATOR.pupilFacet, 11.0, 4.5, 19.5),
      lookFrom: off(PURITY.gasCurtain.from, 4.0, 0, 0), lookTo: off(ILLUMINATOR.fieldFacet, -2.0, 4.0, 0),
      fov: [34, 33], ease: EASE.cine, focus: 21, aperture: 0.00016,
    },
    fx: {
      incidenceCallout: kf([[0.5, 0], [0.72, 1], [0.93, 1], [1, 0]]),
    },
    grade: { saturation: 1.04, contrast: 1.05, vignette: 0.33 },
    hud: {
      label: 'ILLUMINATOR',
      params: [['slitShape', 0.12], ['exposureFieldMask', 0.38], ['multilayerReflectance', 0.62], ['totalMirrors', 0.84]],
      incidence: true,
    },
    captions: [
      cap(0.02, 0.26, '第七步：照明光学系统', 'Step 7 — The illuminator'),
      cap(0.28, 0.50, '场面镜与光瞳面镜把光斑重排，整形为均匀的弧形照明狭缝', 'Field- and pupil-facet mirrors rearrange the beam into a uniform arcuate slit'),
      cap(0.52, 0.78, '注意光路在折返 —— 多层膜只在接近垂直入射时才有反射率', 'Notice the path folds back — a multilayer only reflects near normal incidence'),
      cap(0.80, 1.00, `全机仅 ${PV('totalMirrors')}反射镜，每一片都要损失约三成光`, `Only ${PV('totalMirrors')} mirrors in the whole machine — each costs about 30% of the light`),
    ],
    audio: [{ cue: 'chapter', at: 0.01 }, { cue: 'fold', at: 0.5 }],
  },

  // ──────────────────── 步骤 8：反射式掩模 ────────────────────
  {
    id: 'S12', name: '步骤 8 · 反射式多层膜掩模', dur: 12, step: 'mask', act: '成像',
    desc: '仰视掩模底面。EUV 以精确 6° 离轴入射，被 TaBN 吸收层挡住的地方不反射 —— 图形由此形成。',
    camera: {
      from: off(ILLUMINATOR.pupilFacet, 11.0, 4.5, 19.5), to: off(MASK.pos, 4.4, -4.6, 8.4),
      lookFrom: off(ILLUMINATOR.fieldFacet, -2.0, 4.0, 0), lookTo: off(MASK.pos, 0, -0.6, 0),
      fov: [33, 27], ease: EASE.cine, focus: 10.5, aperture: 0.00026,
    },
    fx: {
      angleCallout: kf([[0.18, 0], [0.40, 1], [0.93, 1], [1, 0]]),
    },
    grade: { saturation: 1.05, contrast: 1.06, vignette: 0.32 },
    hud: {
      label: 'MASK',
      params: [['maskIncidenceAngle', 0.14], ['maskAbsorber', 0.40], ['maskCapping', 0.60], ['exposureFieldMask', 0.82]],
      maskAngle: true,
    },
    captions: [
      cap(0.02, 0.24, '第八步：掩模', 'Step 8 — The mask'),
      cap(0.26, 0.52, `EUV 无法穿透任何材料，所以掩模是反射式的，光以 ${PV('maskIncidenceAngle')} 离轴入射`, `EUV penetrates nothing, so the mask is reflective — light arrives ${PV('maskIncidenceAngle')} off-axis`),
      cap(0.54, 0.78, `${PARAMS.maskAbsorber.value} 吸收层挡住的地方不反射，其余区域把图形反射出去`, `Where the ${PARAMS.maskAbsorber.value} absorber sits, nothing reflects; elsewhere the pattern bounces onward`),
      cap(0.80, 1.00, 'EUV 光刻不存在透射式掩模', 'There is no transmissive mask in EUV lithography'),
    ],
    audio: [{ cue: 'chapter', at: 0.01 }, { cue: 'mask_reveal', at: 0.34 }],
  },

  // ──────────────────── 步骤 9：投影物镜 4:1 ────────────────────
  {
    id: 'S13', name: '步骤 9 · 投影物镜 4:1 缩比', dur: 14, step: 'projection', act: '成像',
    desc: '大幅拉开，展示六片非球面反射镜的折返式镜筒；图形沿光路 4:1 收缩。强调无任何透镜。',
    camera: {
      from: off(MASK.pos, 4.4, -4.6, 8.4), to: off(POB[2].pos, 12.5, 4.5, 26.0),
      lookFrom: off(MASK.pos, 0, -0.6, 0), lookTo: off(POB[2].pos, 3.0, -1.0, 0),
      fov: [27, 36], ease: EASE.cine, focus: 28, aperture: 0.00015,
    },
    fx: {
      demagCallout: kf([[0.52, 0], [0.72, 1], [0.93, 1], [1, 0]]),
      scanPhase: (t) => Math.sin(t * Math.PI * 3) * (1 - t) * 0.75 - t,
    },
    grade: { saturation: 1.04, contrast: 1.05, vignette: 0.34 },
    hud: {
      label: 'POB',
      params: [['pobMirrorCount', 0.10], ['demagnification', 0.32], ['numericalAperture', 0.54], ['scanRatio', 0.76], ['exposureFieldWafer', 0.92]],
      demag: true,
    },
    captions: [
      cap(0.02, 0.24, `第九步：投影物镜 —— ${PV('pobMirrorCount')}非球面反射镜，没有一片透镜`, `Step 9 — Projection optics: ${PV('pobMirrorCount')} aspheric mirrors, not a single lens`),
      cap(0.26, 0.52, `掩模上的图形被缩小到原来的四分之一：${PV('demagnification')} 缩比`, `The mask pattern shrinks to a quarter of its size — ${PV('demagnification')} reduction`),
      cap(0.54, 0.78, `数值孔径 NA = ${PV('numericalAperture')}，决定了能分辨多细的线条`, `A numerical aperture of ${PV('numericalAperture')} sets how fine a line can be resolved`),
      cap(0.80, 1.00, '掩模台以晶圆台四倍的速度反向同步扫描', 'The reticle stage scans four times faster than the wafer stage, in the opposite direction'),
    ],
    audio: [{ cue: 'chapter', at: 0.01 }, { cue: 'scan', at: 0.55 }],
  },

  // ──────────────────── 步骤 10：曝光成潜影与芯片 ────────────────────
  {
    id: 'S14', name: '步骤 10 · 光刻胶曝光成潜影', dur: 10, step: 'exposure', act: '成像',
    desc: '俯视晶圆。弧形狭缝扫过曝光场，胶层内部形成不可见的潜影。',
    camera: {
      from: off(POB[2].pos, 12.5, 4.5, 26.0), to: off(WAFER.pos, 2.0, 6.4, 7.6),
      lookFrom: off(POB[2].pos, 3.0, -1.0, 0), lookTo: off(WAFER.pos, 0, 0, 0),
      fov: [36, 26], ease: EASE.cine, focus: 10.2, aperture: 0.00024,
    },
    fx: {
      scan: kf([[0.28, 0.02], [0.86, 0.98]], EASE.linear),
      scanPhase: (t) => -1 + 2 * Math.min(1, Math.max(0, (t - 0.28) / 0.58)),
    },
    grade: { saturation: 1.05, contrast: 1.06, vignette: 0.32 },
    hud: {
      label: 'WAFER', simNote: 'euvColor',
      params: [['resistThickness', 0.12], ['resistDose', 0.36], ['latentImage', 0.62], ['exposureFieldWafer', 0.86]],
    },
    captions: [
      cap(0.02, 0.24, '第十步：曝光', 'Step 10 — Exposure'),
      cap(0.26, 0.54, `弧形狭缝扫过晶圆，累积约 ${PV('resistDose')} 的剂量`, `The arcuate slit sweeps the wafer, delivering about ${PV('resistDose')}`),
      cap(0.56, 0.82, 'EUV 光子在光刻胶里引发化学反应，形成潜影', 'EUV photons trigger chemistry in the resist, forming a latent image'),
      cap(0.84, 1.00, '此刻图形已经存在，但还看不见', 'The pattern exists now — but it cannot yet be seen'),
    ],
    audio: [{ cue: 'chapter', at: 0.01 }, { cue: 'expose', at: 0.28 }],
  },
  {
    id: 'S15', name: '步骤 10 · 显影 · 芯片图形显现', dur: 8, step: 'exposure', act: '成像',
    desc: '烘烤与显影，潜影转为实体图形；镜头拉开，整片晶圆布满已曝光的芯片。全片情绪收束点。',
    camera: {
      from: off(WAFER.pos, 2.0, 6.4, 7.6), to: off(WAFER.pos, -0.6, 12.0, 13.5),
      lookFrom: off(WAFER.pos, 0, 0, 0), lookTo: off(WAFER.pos, 0, 0, 0),
      fov: [26, 32], ease: EASE.cine, focus: 18, aperture: 0.00017,
    },
    fx: {
      // 承接 S14 末帧的扫描相位 +1，平滑归零（否则台面位置会跳变 → 交界闪烁）
      scan: kf([[0, 0.98], [0.30, 1.0]], EASE.linear),
      scanPhase: (t) => 1 - Math.min(1, t / 0.34),
    },
    grade: { saturation: 1.08, contrast: 1.06, vignette: 0.30 },
    hud: {
      label: 'CHIP',
      params: [['resolution', 0.20], ['overlay', 0.46], ['waferDiameter', 0.68], ['throughput', 0.88]],
    },
    captions: [
      cap(0.04, 0.34, '烘烤，显影 —— 潜影变成实体图形', 'Bake, develop — the latent image becomes real'),
      cap(0.36, 0.66, `线宽可至 ${PV('resolution')}，套刻精度约 ${PV('overlay')}`, `Features down to ${PV('resolution')}, overlay about ${PV('overlay')}`),
      cap(0.68, 1.00, `一片 ${PV('waferDiameter')} 晶圆上，是数百颗芯片`, `Hundreds of chips on a single ${PV('waferDiameter')} wafer`),
    ],
    audio: [{ cue: 'develop', at: 0.16 }, { cue: 'resolve', at: 0.5 }],
  },

  // ───────────────────────────── 收束 ─────────────────────────────
  {
    id: 'S16', name: '全光路总览', dur: 9, step: null, act: '收束',
    desc: '大幅拉开到全景，整条 11 次反射的光路同时点亮，从锡滴一路走到晶圆。',
    camera: {
      from: off(WAFER.pos, -0.6, 12.0, 13.5), to: off(BOUNDS.center, 22, 16, 94),
      lookFrom: off(WAFER.pos, 0, 0, 0), lookTo: off(BOUNDS.center, -2, 8, 0),
      fov: [32, 31], ease: EASE.cine, focus: 98, aperture: 0.00010,
    },
    fx: {
      pathOverview: kf([[0.2, 0], [0.5, 1]]),
    },
    grade: { saturation: 1.05, contrast: 1.05, vignette: 0.34 },
    hud: { pathSummary: true, stepsRecap: true },
    captions: [
      cap(0.04, 0.40, '从一颗锡滴，到一片晶圆', 'From a single droplet of tin to a finished wafer'),
      cap(0.42, 0.74, `十一次反射，全程真空，${PV('wavelength')}`, `Eleven reflections, all in vacuum, all at ${PV('wavelength')}`),
      cap(0.76, 1.00, `每小时 ${PARAMS.throughput.value} 片，日夜不停`, `${PARAMS.throughput.value} wafers an hour, around the clock`),
    ],
    audio: [{ cue: 'finale', at: 0.05 }],
  },
  {
    id: 'S17', name: '片尾', dur: 5, step: null, act: '片尾',
    desc: '光路余晖渐隐，品牌标语与 Logo 定版，黑场收尾。',
    camera: {
      from: off(BOUNDS.center, 22, 16, 94), to: off(BOUNDS.center, 17, 13, 104),
      lookFrom: off(BOUNDS.center, -2, 8, 0), lookTo: off(BOUNDS.center, -2, 8, 0),
      fov: [31, 30], ease: EASE.out, focus: 106, aperture: 0.00010,
    },
    fx: {
      pathOverview: kf([[0, 1], [0.6, 0.3]]),
      fade: kf([[0.66, 0], [1, 1]]), letterbox: K(0.055),
    },
    grade: { saturation: 1.0, contrast: 1.02, vignette: 0.42 },
    hud: { endCard: true },
    captions: [
      cap(0.06, 0.62, '在 13.5 纳米的尺度上，定义下一代芯片', 'Defining the next generation of chips at 13.5 nanometres'),
    ],
    audio: [{ cue: 'outro', at: 0.0 }],
  },
];

// ═══════════════════════════════════════════════════════════════════
// 时间轴装配：为每个镜头补上绝对起止时间
// ═══════════════════════════════════════════════════════════════════
export const TIMELINE = (() => {
  let t = 0;
  const shots = SHOTS.map((s) => {
    const rec = { ...s, start: t, end: t + s.dur };
    t += s.dur;
    return rec;
  });
  return { shots, duration: t, fps: FILM.fps, frames: Math.round(t * FILM.fps) };
})();

/** 按时间取当前镜头与镜头内归一化进度 */
export function shotAt(time) {
  const shots = TIMELINE.shots;
  const t = Math.max(0, Math.min(TIMELINE.duration - 1e-6, time));
  let lo = 0, hi = shots.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (t < shots[mid].end) hi = mid; else lo = mid + 1;
  }
  const s = shots[lo];
  return { shot: s, local: (t - s.start) / s.dur, index: lo };
}

/**
 * 取 fx 控制量 = AMBIENT 绝对时间包络 ⊕ 镜头局部戏剧量。
 * AMBIENT 通道优先，镜头内同名键被忽略 —— 这保证跨镜头连续、无交界闪烁。
 * @param shot  镜头记录
 * @param local 镜头内归一化进度 0..1
 * @param time  绝对时间（秒）；省略时由 shot.start + local × shot.dur 推出
 */
export function sampleFX(shot, local, time) {
  const t = time !== undefined ? time : (shot.start ?? 0) + local * shot.dur;
  const out = ambientAt(t);
  if (shot.fx) {
    for (const [k, f] of Object.entries(shot.fx)) {
      if (AMBIENT_KEYS.has(k)) continue;              // 包络接管，忽略镜头覆盖
      out[k] = typeof f === 'function' ? f(local) : f;
    }
  }
  return out;
}

/** 取当前应显示的字幕（可能为 null） */
export function captionAt(shot, local) {
  if (!shot.captions) return null;
  for (const c of shot.captions) if (local >= c.t0 && local <= c.t1) return c;
  return null;
}

/** 全片字幕清单（绝对时间）—— 供 SRT/ASS 导出与音画同步校验 */
export function allCaptions() {
  const out = [];
  for (const s of TIMELINE.shots) {
    if (!s.captions) continue;
    for (const c of s.captions) {
      out.push({
        shot: s.id, step: s.step,
        start: s.start + c.t0 * s.dur,
        end: s.start + c.t1 * s.dur,
        zh: c.zh, en: c.en,
      });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** 全片音频提示点（绝对时间）—— audio.js 直接消费，保证音画同步 */
export function allAudioCues() {
  const out = [];
  for (const s of TIMELINE.shots) {
    if (!s.audio) continue;
    for (const a of s.audio) out.push({ cue: a.cue, time: s.start + a.at * s.dur, shot: s.id });
  }
  return out.sort((a, b) => a.time - b.time);
}

/** 每个工艺步骤的时间区间（HUD 章节条与验收核对用） */
export function stepSpans() {
  const spans = new Map();
  for (const s of TIMELINE.shots) {
    if (!s.step) continue;
    const cur = spans.get(s.step);
    if (cur) { cur.end = s.end; cur.shots.push(s.id); }
    else spans.set(s.step, { step: s.step, start: s.start, end: s.end, shots: [s.id] });
  }
  return [...spans.values()];
}

// ═══════════════════════════════════════════════════════════════════
// 衍生版本剪辑表（规格书 §2）—— 只做时间区间摘取，无需重新渲染
// ═══════════════════════════════════════════════════════════════════
const seg = (shotId, from = 0, to = 1) => {
  const s = TIMELINE.shots.find((x) => x.id === shotId);
  if (!s) throw new Error(`[script] 未知镜头: ${shotId}`);
  return { shot: shotId, start: s.start + from * s.dur, end: s.start + to * s.dur };
};

export const CUTS = {
  social60: {
    label: '社媒 60s',
    segments: [
      seg('S00', 0.55, 1.0),    // 标题
      seg('S03', 0.30, 0.80),   // 步骤 1 锡滴发生器
      seg('S05', 0.24, 0.62),   // 步骤 2 预脉冲压扁
      seg('S06', 0.18, 0.68),   // 步骤 3 主脉冲等离子体
      seg('S07', 0.24, 0.56),   // 步骤 4 13.5 nm 辐射
      seg('S08', 0.18, 0.58),   // 步骤 5 多层膜集光镜
      seg('S10', 0.24, 0.52),   // 步骤 6 光谱纯化与碎屑防护
      seg('S11', 0.26, 0.54),   // 步骤 7 照明光学
      seg('S12', 0.20, 0.58),   // 步骤 8 反射式掩模
      seg('S13', 0.22, 0.62),   // 步骤 9 投影物镜 4:1
      seg('S14', 0.22, 0.60),   // 步骤 10 曝光成潜影
      seg('S15', 0.10, 0.78),   // 显影成芯片
      seg('S17', 0.0, 1.0),     // 片尾
    ],
  },
  social30: {
    label: '社媒 30s',
    segments: [
      seg('S00', 0.72, 1.0),
      seg('S05', 0.30, 0.56),
      seg('S06', 0.20, 0.52),
      seg('S07', 0.26, 0.46),
      seg('S12', 0.24, 0.48),
      seg('S13', 0.26, 0.48),
      seg('S15', 0.16, 0.62),
      seg('S17', 0.0, 0.9),
    ],
  },
};

export function cutDuration(cut) {
  return cut.segments.reduce((a, s) => a + (s.end - s.start), 0);
}
