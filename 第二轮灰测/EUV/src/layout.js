/**
 * layout.js — 光学布局与光路真源 (Optical Layout Ground Truth)
 * ==================================================================
 * 规格书 §1.3「光路方向正确」、§1.1「组件功能不得错误」的工程实现。
 * 本模块用几何约束而非美术摆位生成光路，关键性质全部可被测试断言：
 *
 *  1. 集光镜是真实旋转椭球面片：第一焦点 = 等离子体，第二焦点 = 中间焦点 IF。
 *     自 F1 出射的任意光线经该面反射后精确通过 F2（reflectOffCollector 数值验证）。
 *  2. 每片反射镜的法线 = 入射反向量与出射量的角平分线（精确反射律）。
 *  3. 掩模法线被硬约束为与竖直方向成 6°，并由「反射主光线精确竖直向下」
 *     反解出入射方向 —— 掩模入射角是解出来的，不是画出来的。
 *  4. ★ 多层膜只在近法向入射下具备约 70% 反射率，因此 EUV 光路必须是
 *     「折返式」：每次反射的主光线偏转角 Δ 接近 180°，入射角 θ = 90° − Δ/2。
 *     很多科普动画把 EUV 光路画成大角度折线（掠入射），那是物理错误。
 *     本布局以 deviationDeg 定义每片镜的偏转，强制 θ ≤ 23°。
 *
 * 世界单位：1 unit = 33.3 mm（MM_PER_UNIT）。整机纵向尺度经压缩夸张，
 * 已按 §1.2 以「示意 / Simulation」标注。
 */

import { PARAMS } from './params.js';

export const MM_PER_UNIT = 33.3;
export const mm = (v) => v / MM_PER_UNIT;

const DEG = Math.PI / 180;
const V = (x, y, z = 0) => ({ x, y, z });
const add = (a, b) => V(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a, b) => V(a.x - b.x, a.y - b.y, a.z - b.z);
const scale = (a, s) => V(a.x * s, a.y * s, a.z * s);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a) => Math.sqrt(dot(a, a));
const norm = (a) => { const l = len(a) || 1; return V(a.x / l, a.y / l, a.z / l); };
const heading = (deg) => V(Math.cos(deg * DEG), Math.sin(deg * DEG), 0);

export const vec = { V, add, sub, scale, dot, len, norm, heading, DEG };

/** 主光线偏转角 Δ ↔ 入射角 θ 的换算：θ = 90° − Δ/2 */
export const incidenceFromDeviation = (deviationDeg) => 90 - Math.abs(deviationDeg) / 2;
export const deviationFromIncidence = (incDeg) => 180 - 2 * incDeg;

// ═══════════════════════════════════════════════════════════════════
// 1. 椭球集光镜 —— F1 = 等离子体，F2 = 中间焦点
// ═══════════════════════════════════════════════════════════════════
export const PLASMA = V(-26, 0, 0);
export const IF_POINT = V(-12, 0, 0);

export const ELLIPSOID = (() => {
  const f1 = PLASMA, f2 = IF_POINT;
  const center = scale(add(f1, f2), 0.5);
  const c = len(sub(f2, f1)) / 2;
  const a = 15;
  const b = Math.sqrt(a * a - c * c);
  const e = c / a;
  const p = a * (1 - e * e);
  return { center, a, b, c, e, p, f1, f2 };
})();

export const COLLECTOR_APERTURE = {
  phiMin: 9 * DEG,    // 中心孔：CO₂ 驱动激光穿过（孔径经夸张以便观察，示意）
  phiMax: 74 * DEG,   // 外缘：对应约 5 sr 收集立体角量级
};

/** 椭球面上一点（以 F1 为极点的圆锥曲线极坐标，φ=0 指向 -X 近顶点） */
export function collectorPoint(phi, theta) {
  const { p, e, f1 } = ELLIPSOID;
  const r = p / (1 + e * Math.cos(phi));
  const dir = V(-Math.cos(phi), Math.sin(phi) * Math.cos(theta), Math.sin(phi) * Math.sin(theta));
  return { point: add(f1, scale(dir, r)), dir, r };
}

/** 椭球面外法线 */
export function collectorNormal(pt) {
  const { center, a, b } = ELLIPSOID;
  const q = sub(pt, center);
  return norm(V(q.x / (a * a), q.y / (b * b), q.z / (b * b)));
}

/** 自 F1 出射光线在集光镜上的反射；missDistanceToIF 应为 0 */
export function reflectOffCollector(phi, theta) {
  const { point, dir } = collectorPoint(phi, theta);
  const n = collectorNormal(point);
  const reflected = norm(sub(dir, scale(n, 2 * dot(dir, n))));
  const toF2 = sub(IF_POINT, point);
  const along = dot(toF2, reflected);
  const perp = sub(toF2, scale(reflected, along));
  return { hit: point, normal: n, incident: dir, reflected, missDistanceToIF: len(perp), distanceToIF: along };
}

/** 集光镜代表点（主光线折线用）：取面片中部、位于 XY 平面内，便于二维读图 */
export const COLLECTOR_REF_PHI = 42 * DEG;
export const COLLECTOR_REF = collectorPoint(COLLECTOR_REF_PHI, 0).point;
export const COLLECTOR_VERTEX = collectorPoint(0, 0).point;

// ═══════════════════════════════════════════════════════════════════
// 2. 锡滴射流 / CO₂ 驱动激光轴
// ═══════════════════════════════════════════════════════════════════
export const DROPLET_NOZZLE = V(PLASMA.x, 13.5, 0);
export const DROPLET_CATCHER = V(PLASMA.x, -13.5, 0);
export const DROPLET_AXIS = V(0, -1, 0);
export const LASER_ORIGIN = V(-56, 0, 0);
export const LASER_AXIS = V(1, 0, 0);

// ═══════════════════════════════════════════════════════════════════
// 3. 掩模 6° 硬约束 → 反解入射主光线方向
// ═══════════════════════════════════════════════════════════════════
export const MASK_NORMAL = norm(V(
  -Math.sin(PARAMS.maskIncidenceAngle.value * DEG),
  -Math.cos(PARAMS.maskIncidenceAngle.value * DEG), 0));

/** 投影物镜入口方向：精确竖直向下 */
export const POB_ENTRY_DIR = V(0, -1, 0);

/** 由 d = r − 2(r·n)n 反解入射方向；与法线夹角必然 = 6° */
export const MASK_INCIDENT_DIR = (() => {
  const r = POB_ENTRY_DIR, n = MASK_NORMAL;
  return norm(sub(r, scale(n, 2 * dot(r, n))));
})();

export const MASK_INCIDENCE_DEG = Math.acos(
  Math.min(1, Math.abs(dot(scale(MASK_INCIDENT_DIR, -1), MASK_NORMAL)))) / DEG;

/** 入射主光线的航向角（度）—— 必然 = 90° − 2×6° = 78° */
export const MASK_INCIDENT_HEADING = Math.atan2(MASK_INCIDENT_DIR.y, MASK_INCIDENT_DIR.x) / DEG;

// ═══════════════════════════════════════════════════════════════════
// 4. 折返式光路序列
//    照明系统：3 片镜，偏转 |Δ| = 134° → θ = 23°
//    投影物镜：6 片镜，偏转 |Δ| = 156° → θ = 12°
//    最后一段航向被强制等于 MASK_INCIDENT_HEADING，保证掩模入射角精确。
// ═══════════════════════════════════════════════════════════════════
const ILL_DEV = 134;   // θ = 23°
const POB_DEV = 156;   // θ = 12°

/** 照明系统航向序列（度）：IF→场面镜→光瞳面镜→末镜→掩模 */
const ILL_HEADINGS = [
  36,                                   // IF → 场面镜
  36 + ILL_DEV,                         // 场面镜 → 光瞳面镜   (170°)
  36 + ILL_DEV - ILL_DEV * 2 + 46,      // 见下方断言：等于 -56°
];
// 显式写清，避免上式歧义：170 - 226 = -56
ILL_HEADINGS[2] = -56;
const ILL_RUNS = [13.0, 11.0, 11.0];    // 各段主光线长度
const ILL_TO_MASK_RUN = 35.0;           // 末镜 → 掩模

/** 前向求解：给定起点、航向序列与段长，逐点推进并计算每片镜的法线与入射角 */
function solveChain(startPos, headings, runs, nodeSpecs) {
  const out = [];
  let pos = startPos;
  for (let i = 0; i < runs.length; i++) {
    const inDir = heading(headings[i]);
    pos = add(pos, scale(inDir, runs[i]));
    const outDir = heading(headings[i + 1]);
    const n = norm(add(scale(inDir, -1), outDir));
    const deviationDeg = ((headings[i + 1] - headings[i]) % 360 + 540) % 360 - 180;
    const incidenceDeg = Math.acos(Math.min(1, Math.max(-1, dot(scale(inDir, -1), n)))) / DEG;
    out.push({ ...nodeSpecs[i], pos, inDir, outDir, normal: n, deviationDeg, incidenceDeg });
  }
  return { mirrors: out, endPos: pos, endDir: heading(headings[headings.length - 1]) };
}

const ILL_SOLVED = solveChain(
  IF_POINT,
  [...ILL_HEADINGS, MASK_INCIDENT_HEADING],
  ILL_RUNS,
  [
    { key: 'ILL_FIELD', label: 'FF', shape: 'faceted', zh: '场面镜', en: 'Field Facet Mirror' },
    { key: 'ILL_PUPIL', label: 'PF', shape: 'faceted', zh: '光瞳面镜', en: 'Pupil Facet Mirror' },
    { key: 'ILL_LAST',  label: 'RM', shape: 'concave', zh: '照明末镜', en: 'Relay Mirror' },
  ],
);

export const ILLUMINATOR = {
  mirrors: ILL_SOLVED.mirrors,
  fieldFacet: ILL_SOLVED.mirrors[0].pos,
  pupilFacet: ILL_SOLVED.mirrors[1].pos,
  lastMirror: ILL_SOLVED.mirrors[2].pos,
};

/** 掩模位置：由照明末镜沿精确入射方向推进得到（派生量，非人工摆位） */
export const MASK = {
  pos: add(ILLUMINATOR.lastMirror, scale(MASK_INCIDENT_DIR, ILL_TO_MASK_RUN)),
  normal: MASK_NORMAL,
  incidentDir: MASK_INCIDENT_DIR,
  reflectedDir: POB_ENTRY_DIR,
  incidenceDeg: MASK_INCIDENCE_DEG,
  blank: { w: mm(152), h: mm(152), t: mm(6.35) },
  field: { w: mm(104), h: mm(132) },
};

/** 投影物镜航向序列：−90°（竖直向下）与 66° 交替 */
const POB_HEADINGS = [-90, -90 + POB_DEV, -90, -90 + POB_DEV, -90, -90 + POB_DEV, -90];
const POB_RUNS = [15.0, 13.0, 14.0, 12.0, 13.0, 8.0];
const POB_EXIT_RUN = 16.0;

const POB_SOLVED = solveChain(
  MASK.pos, POB_HEADINGS, POB_RUNS,
  [
    { key: 'POB_M1', label: 'M1', shape: 'concave', zh: '投影物镜 M1', en: 'Projection M1' },
    { key: 'POB_M2', label: 'M2', shape: 'convex',  zh: '投影物镜 M2', en: 'Projection M2' },
    { key: 'POB_M3', label: 'M3', shape: 'concave', zh: '投影物镜 M3', en: 'Projection M3' },
    { key: 'POB_M4', label: 'M4', shape: 'concave', zh: '投影物镜 M4', en: 'Projection M4' },
    { key: 'POB_M5', label: 'M5', shape: 'convex',  zh: '投影物镜 M5', en: 'Projection M5' },
    { key: 'POB_M6', label: 'M6', shape: 'concave', zh: '投影物镜 M6', en: 'Projection M6' },
  ],
);

export const POB = POB_SOLVED.mirrors;

// ═══════════════════════════════════════════════════════════════════
// 5. 晶圆台
// ═══════════════════════════════════════════════════════════════════
export const WAFER = {
  pos: add(POB_SOLVED.endPos, scale(POB_SOLVED.endDir, POB_EXIT_RUN)),
  normal: scale(POB_SOLVED.endDir, -1),
  incomingDir: POB_SOLVED.endDir,
  diameter: mm(PARAMS.waferDiameter.value),
  field: { w: mm(26), h: mm(33) },
};

// ═══════════════════════════════════════════════════════════════════
// 6. 光谱纯化与碎屑防护段
// ═══════════════════════════════════════════════════════════════════
export const PURITY = {
  gasCurtain: { from: V(-22.5, 0, 0), to: V(-15.5, 0, 0), radius: 3.2 },
  spf: { pos: V(-14.2, 0, 0), radius: 2.1 },
  ifAperture: { pos: IF_POINT, radius: 0.62 },
};

// ═══════════════════════════════════════════════════════════════════
// 7. 镜面半径（可读性与不相交的折中，由测试校验最小间隙 > 0）
// ═══════════════════════════════════════════════════════════════════
export const MIRROR_RADIUS = {
  COLLECTOR: 10.2,
  ILL_FIELD: 2.0, ILL_PUPIL: 2.0, ILL_LAST: 2.3,
  POB_M1: 2.4, POB_M2: 1.5, POB_M3: 2.2, POB_M4: 2.5, POB_M5: 1.4, POB_M6: 2.6,
};
export const mirrorRadius = (key) => MIRROR_RADIUS[key] ?? 2.0;

// ═══════════════════════════════════════════════════════════════════
// 8. 主光线折线 —— 全片光路唯一来源
// ═══════════════════════════════════════════════════════════════════
export const CHAIN = (() => {
  const nodes = [
    { key: 'PLASMA',    pos: PLASMA,      kind: 'source', zh: '等离子体',        en: 'Plasma',             step: 'mainpulse'   },
    { key: 'COLLECTOR', pos: COLLECTOR_REF, kind: 'mirror', zh: '多层膜集光镜',  en: 'Multilayer Collector', step: 'collector' },
    { key: 'IF',        pos: IF_POINT,    kind: 'focus',  zh: '中间焦点 IF',     en: 'Intermediate Focus', step: 'collector'   },
    ...ILLUMINATOR.mirrors.map((m) => ({ key: m.key, pos: m.pos, kind: 'mirror', zh: m.zh, en: m.en, step: 'illuminator' })),
    { key: 'MASK',      pos: MASK.pos,    kind: 'mask',   zh: '反射式掩模',      en: 'Reflective Mask',    step: 'mask'        },
    ...POB.map((m) => ({ key: m.key, pos: m.pos, kind: 'mirror', zh: m.zh, en: m.en, step: 'projection' })),
    { key: 'WAFER',     pos: WAFER.pos,   kind: 'wafer',  zh: '晶圆',            en: 'Wafer',              step: 'exposure'    },
  ];
  let acc = 0;
  for (let i = 0; i < nodes.length; i++) {
    if (i > 0) {
      const seg = sub(nodes[i].pos, nodes[i - 1].pos);
      const l = len(seg);
      nodes[i - 1].outDir = norm(seg);
      nodes[i].inDir = norm(seg);
      nodes[i].segLength = l;
      acc += l;
    }
    nodes[i].arcLength = acc;
  }
  for (const n of nodes) n.t = acc > 0 ? n.arcLength / acc : 0;
  return { nodes, total: acc };
})();

export const CHAIN_POINTS = CHAIN.nodes.map((n) => n.pos);
export const CHAIN_BY_KEY = Object.fromEntries(CHAIN.nodes.map((n) => [n.key, n]));

/** 各镜面实际入射角报告（HUD 显示 + 测试断言） */
export function incidenceReport() {
  const out = [];
  for (const n of CHAIN.nodes) {
    if (!n.inDir || !n.outDir) continue;
    if (n.kind !== 'mirror' && n.kind !== 'mask') continue;
    const normal = norm(add(scale(n.inDir, -1), n.outDir));
    const inc = Math.acos(Math.min(1, Math.max(-1, dot(scale(n.inDir, -1), normal)))) / DEG;
    const dev = 180 - 2 * inc;
    out.push({ key: n.key, zh: n.zh, en: n.en, incidenceDeg: inc, deviationDeg: dev, normal });
  }
  return out;
}

/** 节点镜面法线 —— 几何建模与光路绘制共用同一法线，绝不各画一套 */
export function nodeNormal(key) {
  if (key === 'MASK') return MASK.normal;
  if (key === 'WAFER') return WAFER.normal;
  if (key === 'COLLECTOR') return scale(collectorNormal(COLLECTOR_REF), -1); // 内法线（反射面朝向等离子体）
  const n = CHAIN_BY_KEY[key];
  if (!n || !n.inDir || !n.outDir) return V(0, 1, 0);
  return norm(add(scale(n.inDir, -1), n.outDir));
}

/** 4:1 缩比：沿投影光路的图形尺寸倍率（掩模 ×4 → 晶圆 ×1） */
const PATTERN_ORDER = ['MASK', 'POB_M1', 'POB_M2', 'POB_M3', 'POB_M4', 'POB_M5', 'POB_M6', 'WAFER'];
export function patternScaleAt(nodeKey) {
  const i = PATTERN_ORDER.indexOf(nodeKey);
  if (i < 0) return 4;
  return 4 - 3 * (i / (PATTERN_ORDER.length - 1));
}

/** 整体包围盒（摄影机取景与网格地面用） */
export const BOUNDS = (() => {
  const pts = [
    ...CHAIN_POINTS, DROPLET_NOZZLE, DROPLET_CATCHER, LASER_ORIGIN,
    COLLECTOR_VERTEX, collectorPoint(COLLECTOR_APERTURE.phiMax, 0).point,
    collectorPoint(COLLECTOR_APERTURE.phiMax, Math.PI).point,
  ];
  const min = V(Infinity, Infinity, Infinity), max = V(-Infinity, -Infinity, -Infinity);
  for (const p of pts) {
    min.x = Math.min(min.x, p.x); min.y = Math.min(min.y, p.y); min.z = Math.min(min.z, p.z);
    max.x = Math.max(max.x, p.x); max.y = Math.max(max.y, p.y); max.z = Math.max(max.z, p.z);
  }
  return { min, max, center: scale(add(min, max), 0.5), size: sub(max, min) };
})();
