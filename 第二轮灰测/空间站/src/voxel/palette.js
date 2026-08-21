/**
 * voxel/palette.js —— 体素材质调色板
 *
 * 每种材质定义 PBR 参数与「表面细节风格」。网格化阶段（Worker 内）会把材质参数
 * 直接烘焙进顶点属性，因此片元着色器无需任何纹理采样即可获得丰富的表面表现：
 *   · albedo / roughness / metallic / emissive 逐顶点携带
 *   · detail 决定片元着色器里的程序化细节（面板缝、铆钉、电池栅线、隔热毯褶皱…）
 *   · flags 决定动态行为（闪烁、脉冲、扫掠光）
 *   · variance 决定逐面伪随机色差，避免大面积死板的纯色
 */

import { parseColor, srgbToLinear, hash3 } from '../core/math.js';

/** 自发光编码上限：顶点里存 emissive*color/8，着色器再乘回 8 */
export const EMISSIVE_SCALE = 8;

/** 表面细节风格（与 GLSL 中的常量一一对应） */
export const DETAIL = {
  PLAIN: 0,     // 光滑，仅体素格线
  HULL: 1,      // 壳板：面板分格 + 铆钉 + 风化条纹
  FOIL: 2,      // 多层隔热毯：褶皱高光
  SOLAR: 3,     // 太阳能电池：栅线 + 汇流条 + 各向异性反光
  TRUSS: 4,     // 结构金属：磨砂 + 轻微凹槽
  WINDOW: 5,    // 舱窗：内部光晕 + 玻璃高光 + 逐窗随机亮度
  RADIATOR: 6,  // 散热板：细密散热鳍片
  HAZARD: 7,    // 斜向警示条纹
  NOZZLE: 8,    // 喷管：环向加强筋 + 烧蚀渐变
  GRATE: 9,     // 格栅走道：镂空感
  LED: 10,      // 灯具：中心亮斑衰减
};

/** 动态行为标志位 */
export const FLAG = {
  NONE: 0,
  BLINK: 1,   // 周期闪烁（航行灯）
  PULSE: 2,   // 平滑呼吸
  SWEEP: 4,   // 沿面扫掠光带
  FLICKER: 8, // 随机微抖（舱窗）
};

/**
 * @typedef {Object} Material
 * @property {string} key      符号名
 * @property {string} name     中文名
 * @property {string} albedo   sRGB 十六进制
 * @property {number} metal    金属度 0..1
 * @property {number} rough    粗糙度 0..1
 * @property {string} [emit]   自发光颜色
 * @property {number} [power]  自发光强度（0..8）
 * @property {number} detail   DETAIL.*
 * @property {number} [flags]  FLAG 位或
 * @property {number} [var]    逐面色差幅度 0..1
 */

/** @type {Material[]} 索引即材质 id（0 号为空气，用占位符） */
const TABLE = [
  { key: 'AIR', name: '真空', albedo: '#000000', metal: 0, rough: 1, detail: 0 },

  { key: 'HULL_WHITE',  name: '白色壳板',     albedo: '#d9dfe7', metal: 0.05, rough: 0.52, detail: DETAIL.HULL, var: 0.045 },
  { key: 'HULL_GREY',   name: '灰蒙皮',       albedo: '#98a2ae', metal: 0.12, rough: 0.58, detail: DETAIL.HULL, var: 0.06 },
  { key: 'HULL_DARK',   name: '深色蒙皮',     albedo: '#3d4650', metal: 0.22, rough: 0.62, detail: DETAIL.HULL, var: 0.07 },
  { key: 'HULL_BONE',   name: '米白隔热板',   albedo: '#e9e3d5', metal: 0.03, rough: 0.68, detail: DETAIL.HULL, var: 0.05 },
  { key: 'HULL_NAVY',   name: '深蓝蒙皮',     albedo: '#2c3a52', metal: 0.18, rough: 0.55, detail: DETAIL.HULL, var: 0.05 },

  { key: 'FOIL_GOLD',   name: '金色隔热毯',   albedo: '#d9a73d', metal: 0.88, rough: 0.30, detail: DETAIL.FOIL, var: 0.14 },
  { key: 'FOIL_COPPER', name: '铜色隔热毯',   albedo: '#b06c36', metal: 0.85, rough: 0.34, detail: DETAIL.FOIL, var: 0.13 },
  { key: 'FOIL_SILVER', name: '银色隔热毯',   albedo: '#ced5dd', metal: 0.80, rough: 0.42, detail: DETAIL.FOIL, var: 0.10 },

  { key: 'SOLAR_CELL',  name: '太阳能电池',   albedo: '#101f3d', metal: 0.38, rough: 0.16, detail: DETAIL.SOLAR, var: 0.05 },
  { key: 'SOLAR_HOT',   name: '电池汇流条',   albedo: '#2d5cc0', metal: 0.55, rough: 0.12, detail: DETAIL.SOLAR, var: 0.04 },
  { key: 'SOLAR_FRAME', name: '帆板框架',     albedo: '#8e94a1', metal: 0.82, rough: 0.34, detail: DETAIL.TRUSS, var: 0.05 },

  { key: 'RADIATOR',    name: '散热板',       albedo: '#e7edf3', metal: 0.10, rough: 0.38, detail: DETAIL.RADIATOR, var: 0.03 },
  { key: 'TRUSS_ALLOY', name: '铝合金桁架',   albedo: '#aab3be', metal: 0.86, rough: 0.36, detail: DETAIL.TRUSS, var: 0.07 },
  { key: 'TITANIUM',    name: '钛合金构件',   albedo: '#808894', metal: 0.94, rough: 0.28, detail: DETAIL.TRUSS, var: 0.05 },
  { key: 'CARBON',      name: '碳纤维复材',   albedo: '#25282d', metal: 0.30, rough: 0.44, detail: DETAIL.TRUSS, var: 0.04 },
  { key: 'PIPE_STEEL',  name: '不锈钢管路',   albedo: '#bac1ca', metal: 0.92, rough: 0.26, detail: DETAIL.PLAIN, var: 0.04 },
  { key: 'ICE_BLUE',    name: '冷却剂管路',   albedo: '#a0cae9', metal: 0.60, rough: 0.28, detail: DETAIL.PLAIN, var: 0.04 },

  { key: 'GLASS_WIN',   name: '舱窗',         albedo: '#5c8fae', metal: 0.00, rough: 0.07, emit: '#8fe4ff', power: 2.4, detail: DETAIL.WINDOW, flags: FLAG.FLICKER, var: 0.10 },
  { key: 'GLASS_DOME',  name: '观测穹顶',     albedo: '#7fb6cf', metal: 0.00, rough: 0.05, emit: '#bdf1ff', power: 1.5, detail: DETAIL.WINDOW, var: 0.05 },
  { key: 'INNER_LIT',   name: '舱内照明面',   albedo: '#cfeaff', metal: 0.00, rough: 0.45, emit: '#a9dcff', power: 3.0, detail: DETAIL.PLAIN },

  { key: 'HAZARD',      name: '警示条纹',     albedo: '#ffb02b', metal: 0.08, rough: 0.55, detail: DETAIL.HAZARD, var: 0.04 },
  { key: 'RED_ACCENT',  name: '红色标识',     albedo: '#d0362e', metal: 0.10, rough: 0.52, detail: DETAIL.HULL, var: 0.05 },
  { key: 'BLUE_ACCENT', name: '蓝色标识',     albedo: '#2f6fd0', metal: 0.10, rough: 0.50, detail: DETAIL.HULL, var: 0.05 },
  { key: 'LAB_TEAL',    name: '实验舱标识',   albedo: '#2aa3a0', metal: 0.10, rough: 0.50, detail: DETAIL.HULL, var: 0.05 },
  { key: 'DECAL_DARK',  name: '涂装深色块',   albedo: '#2c3239', metal: 0.15, rough: 0.60, detail: DETAIL.HULL, var: 0.05 },
  { key: 'SEAL_BLACK',  name: '黑色密封件',   albedo: '#15181c', metal: 0.05, rough: 0.86, detail: DETAIL.PLAIN, var: 0.03 },
  { key: 'SOOT',        name: '烧蚀痕迹',     albedo: '#1b1c1e', metal: 0.10, rough: 0.92, detail: DETAIL.PLAIN, var: 0.08 },

  { key: 'NOZZLE',      name: '发动机喷管',   albedo: '#5b606a', metal: 0.94, rough: 0.26, detail: DETAIL.NOZZLE, var: 0.06 },
  { key: 'THRUSTER',    name: '姿控喷口',     albedo: '#44494f', metal: 0.90, rough: 0.33, detail: DETAIL.NOZZLE, var: 0.05 },
  { key: 'ENGINE_GLOW', name: '主发动机辉光', albedo: '#ff9a52', metal: 0.00, rough: 0.90, emit: '#ff9450', power: 6.5, detail: DETAIL.LED, flags: FLAG.PULSE },

  { key: 'LED_GREEN',   name: '绿色状态灯',   albedo: '#7dffc4', metal: 0, rough: 0.3, emit: '#62ffb0', power: 5.0, detail: DETAIL.LED, flags: FLAG.PULSE },
  { key: 'LED_RED',     name: '红色警示灯',   albedo: '#ff8080', metal: 0, rough: 0.3, emit: '#ff4d4d', power: 5.5, detail: DETAIL.LED, flags: FLAG.BLINK },
  { key: 'LED_AMBER',   name: '琥珀航行灯',   albedo: '#ffd48a', metal: 0, rough: 0.3, emit: '#ffc255', power: 4.5, detail: DETAIL.LED, flags: FLAG.BLINK },
  { key: 'LED_CYAN',    name: '青色导航灯',   albedo: '#a8f2ff', metal: 0, rough: 0.3, emit: '#6fe8ff', power: 4.2, detail: DETAIL.LED, flags: FLAG.SWEEP },

  { key: 'DISH_WHITE',  name: '天线反射面',   albedo: '#eff3f7', metal: 0.12, rough: 0.28, detail: DETAIL.PLAIN, var: 0.03 },
  { key: 'ANTENNA_ROD', name: '天线杆',       albedo: '#dae0e6', metal: 0.90, rough: 0.24, detail: DETAIL.PLAIN, var: 0.03 },
  { key: 'GRATE',       name: '格栅走道',     albedo: '#6b7381', metal: 0.72, rough: 0.48, detail: DETAIL.GRATE, var: 0.06 },
  { key: 'HANDRAIL',    name: '黄色扶手',     albedo: '#f0c53a', metal: 0.55, rough: 0.40, detail: DETAIL.PLAIN, var: 0.04 },
  { key: 'PORT_RING',   name: '对接密封环',   albedo: '#d0d7df', metal: 0.94, rough: 0.20, detail: DETAIL.TRUSS, var: 0.04 },
  { key: 'CARGO_TAN',   name: '货运舱蒙皮',   albedo: '#b9a989', metal: 0.10, rough: 0.62, detail: DETAIL.HULL, var: 0.08 },
];

/** 符号名 → 材质 id */
export const MAT = Object.freeze(
  TABLE.reduce((acc, m, i) => { acc[m.key] = i; return acc; }, /** @type {Record<string,number>} */({}))
);

export const MATERIAL_COUNT = TABLE.length;
export const materials = TABLE;

/**
 * 预计算表：把材质参数展开成扁平数组，网格化时零对象访问开销。
 * 布局（每材质 12 项）：
 *   0..2  线性 albedo (0..1)
 *   3     roughness
 *   4     metallic
 *   5..7  线性 emissive * power / EMISSIVE_SCALE  (0..1)
 *   8     detail
 *   9     flags
 *   10    variance
 *   11    是否自发光（0/1）
 */
export const STRIDE = 12;
export const packed = new Float32Array(MATERIAL_COUNT * STRIDE);

for (let i = 0; i < MATERIAL_COUNT; i++) {
  const m = TABLE[i];
  const [ar, ag, ab] = parseColor(m.albedo);
  const o = i * STRIDE;
  packed[o] = srgbToLinear(ar);
  packed[o + 1] = srgbToLinear(ag);
  packed[o + 2] = srgbToLinear(ab);
  packed[o + 3] = m.rough;
  packed[o + 4] = m.metal;
  if (m.emit && m.power) {
    const [er, eg, eb] = parseColor(m.emit);
    const k = m.power / EMISSIVE_SCALE;
    packed[o + 5] = srgbToLinear(er) * k;
    packed[o + 6] = srgbToLinear(eg) * k;
    packed[o + 7] = srgbToLinear(eb) * k;
    packed[o + 11] = 1;
  }
  packed[o + 8] = m.detail | 0;
  packed[o + 9] = m.flags | 0;
  packed[o + 10] = m.var || 0;
}

/** 该材质是否发光（用于统计与灯光提取） */
export const isEmissive = (id) => packed[id * STRIDE + 11] > 0;

/**
 * 取得逐面烘焙后的 8 位属性。
 * @param {number} id 材质 id
 * @param {number} x @param {number} y @param {number} z 面所在体素坐标（决定伪随机色差）
 * @param {Uint8Array} out 长度 ≥ 8 的输出：[aR,aG,aB,rough, eR,eG,eB,metal]
 */
export function bakeMaterial(id, x, y, z, out) {
  const o = id * STRIDE;
  const variance = packed[o + 10];
  // 逐面色差：hash 后映射到 [1-v, 1+v]，并对亮度做轻微非线性以模拟涂层不均
  const t = variance > 0 ? 1 + (hash3(x * 3 + 7, y * 5 + 13, z * 11 + 29) - 0.5) * 2 * variance : 1;
  out[0] = clamp255(packed[o] * t * 255);
  out[1] = clamp255(packed[o + 1] * t * 255);
  out[2] = clamp255(packed[o + 2] * t * 255);
  out[3] = clamp255(packed[o + 3] * 255);
  out[4] = clamp255(packed[o + 5] * 255);
  out[5] = clamp255(packed[o + 6] * 255);
  out[6] = clamp255(packed[o + 7] * 255);
  out[7] = clamp255(packed[o + 4] * 255);
  return out;
}

/** detail 与 flags 打包进一个字节：低 4 位 detail，高 4 位 flags */
export function packCode(id) {
  const o = id * STRIDE;
  return ((packed[o + 8] | 0) & 15) | (((packed[o + 9] | 0) & 15) << 4);
}

const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
