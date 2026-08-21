/**
 * voxel/blueprint.js —— 「天穹站 / CELESTIAL SPIRE」总装蓝图
 *
 * 坐标系约定（体素单位，1 体素 ≈ 0.6 m）：
 *   +X 站体主轴指向航向前方（指令舱），-X 为尾部（推进舱）
 *   +Y 天顶，-Y 地向（对地面）
 *   ±Z 左右舷，主桁架沿 X 铺设于 z = ±34
 *
 * 每个舱段独立成一个 VoxelVolume，因此可以各自拥有变换矩阵，
 * 从而实现居住环自转、太阳翼对日跟踪、机械臂关节链、爆炸视图与装配动画。
 *
 * 布局经过干涉校核：居住环环体占据半径 42–62 且 |x| ≤ 12，
 * 所有穿越该半径区间的构件都被安排在 |x| > 14 处，旋转部件的行程也据此限幅。
 */

import { VoxelVolume } from './volume.js';
import { Brush } from './builder.js';
import { MAT } from './palette.js';
import { stencil, stencilCylinder } from './stencil.js';
import { mulberry32 } from '../core/math.js';

/* ═══════════════════════ 总体尺寸参数 ═══════════════════════ */

export const L = Object.freeze({
  coreR: 13, coreX0: -36, coreX1: 36,
  ringR: 52, ringr: 10, spokeR: 5,
  cmdX0: 36, cmdX1: 58, domeX: 63, domeR: 10,
  propX0: -66, propX1: -36, nozzleX: -84,
  trussZ: 34, trussX0: -88, trussX1: 88, trussHalf: 6,
  wingX: [-70, -36, 36, 70], wingHalfX: 15, wingZ0: 40, wingZ1: 112,
  radX: [-36, 36], radHalfX: 13, radHalfY: 17, radOffY: 27,
  labX: 20, labY0: 13, labY1: 48, labR: 9,
  dockY0: -46, dockY1: -13, dockR: 10,
  hangarX: [-36, -4], hangarY: [-46, -13], hangarZ: [-22, 22],
  armX: 34,
  VOXEL_SCALE: 0.6,
});

const AU = [1, 2, 0], AV = [2, 0, 1];
/** 圆柱包装：直接传三维中心，避免手算 u/v 分量顺序 */
const cyl = (b, axis, c, r, from, to, mat, opts) => b.cylinder(axis, c[AU[axis]], c[AV[axis]], r, from, to, mat, opts);
const cne = (b, axis, c, r0, r1, from, to, mat, shell = 0) => b.cone(axis, c[AU[axis]], c[AV[axis]], r0, r1, from, to, mat, shell);

/* ═══════════════════════ 舱段元数据 ═══════════════════════ */

/**
 * @typedef {Object} ModuleDef
 * @property {string} id @property {string} name @property {string} en @property {string} code
 * @property {string} category @property {string} desc @property {[string,string][]} specs
 * @property {number[]} min @property {number[]} size          体素体积分配
 * @property {number[]} [pivot] @property {number[]} [axis]     旋转枢轴与轴向
 * @property {object} [motion]                                  运动学
 * @property {string} [parent]                                  父舱段（刚体链）
 * @property {number[]} [explode]                               爆炸视图方向（不填则取质心方向）
 * @property {number} order                                     装配顺序 0..16
 * @property {boolean} [listed]                                 是否在清单中列出
 * @property {number} [focus]                                   聚焦时的相机距离
 */

/** @type {ModuleDef[]} */
export const MODULES = [
  {
    id: 'core', name: '核心舱', en: 'Core Trunk Module', code: 'CS-CORE-01', category: '结构 / 生保',
    desc: '空间站的承力主干与生命保障中枢。轴向贯通设计，内含四条独立环控回路、双冗余电源母线与全站数据总线交换机。外壁覆盖 12 层多层隔热毯与微流星体防护板。',
    specs: [['长度', '43.8 m'], ['直径', '15.6 m'], ['加压容积', '412 m³'], ['常驻乘员', '6 人'], ['姿控推力器', '16 × 220 N']],
    min: [-42, -22, -22], size: [86, 45, 45], order: 0, focus: 120,
  },
  {
    id: 'ring', name: '离心居住环', en: 'Centrifugal Habitat Ring', code: 'CS-HAB-02', category: '居住 / 人工重力',
    desc: '主半径 31 m 的自转环体，以 2.1 rpm 提供约 0.38 g 的人工重力。环体分为 16 个独立舱段，任一舱段失压不影响整体结构完整性。外缘全周布置观景舷窗。',
    specs: [['主半径', '31.2 m'], ['转速', '2.1 rpm'], ['等效重力', '0.38 g'], ['舱段数', '16'], ['舷窗', '64 处']],
    min: [-16, -66, -66], size: [33, 133, 133],
    pivot: [0, 0, 0], axis: [1, 0, 0], motion: { type: 'spin', speed: 0.16 },
    order: 3, focus: 210,
  },
  {
    id: 'command', name: '指令与观测舱', en: 'Command & Cupola Module', code: 'CS-CMD-03', category: '指挥 / 观测',
    desc: '站长指挥席、姿态控制台与交会对接操作台所在。前端 12 m 直径全景观测穹顶采用七层熔融石英夹层，兼作机械臂目视操作窗。',
    specs: [['穹顶口径', '12.0 m'], ['工作席位', '4'], ['视场', '接近 4π 立体角'], ['交会雷达', 'Ku 波段 ×2']],
    min: [32, -22, -22], size: [46, 45, 45], order: 1, focus: 90,
  },
  {
    id: 'propulsion', name: '推进与贮箱舱', en: 'Propulsion & Tankage', code: 'CS-PRP-04', category: '推进 / 燃料',
    desc: '四台可变推力霍尔电推与化学备份机组。两只球形贮箱携带氙工质与单元推进剂，负责轨道维持、碎片规避机动与姿态卸载。',
    specs: [['主发动机', '4 × 5.2 kN'], ['比冲', '2 950 s（电推）'], ['贮箱容积', '2 × 96 m³'], ['ΔV 余量', '412 m/s']],
    min: [-92, -30, -30], size: [60, 61, 61], order: 2, focus: 110,
  },
  {
    id: 'truss-a', name: '右舷主桁架', en: 'Starboard Integrated Truss', code: 'CS-ITS-05S', category: '结构 / 桁架',
    desc: '105 m 长的整体桁架段，承载太阳翼旋转关节、热控辐射器与外部载荷平台。四根碳纤维纵梁 + 交替斜撑构成的空间桁架在轨刚度极高。',
    specs: [['长度', '105.6 m'], ['截面', '7.2 × 7.2 m'], ['纵梁', '4 × 碳纤维'], ['外部载荷位', '6']],
    min: [-92, -14, 6], size: [186, 29, 40], order: 4, focus: 190,
  },
  {
    id: 'truss-b', name: '左舷主桁架', en: 'Port Integrated Truss', code: 'CS-ITS-05P', category: '结构 / 桁架',
    desc: '与右舷镜像的整体桁架段。两侧桁架通过核心舱斜撑与主干连接，构成全站的载荷传递路径。',
    specs: [['长度', '105.6 m'], ['截面', '7.2 × 7.2 m'], ['纵梁', '4 × 碳纤维'], ['外部载荷位', '6']],
    min: [-92, -14, -45], size: [186, 29, 40], order: 4, focus: 190,
  },
  {
    id: 'solar-a', name: '右舷太阳翼阵', en: 'Starboard Solar Array Wing', code: 'CS-SAW-06S', category: '电源',
    desc: '四片三结砷化镓帆板，由 α 旋转关节实现对日定向。单翼展开长度 43 m，全阵峰值输出 128 kW，经桁架电缆汇入 160 V 直流母线。',
    specs: [['帆板数', '4'], ['单翼长度', '43.2 m'], ['峰值功率', '128 kW'], ['电池效率', '32.4 %'], ['跟踪关节', 'α 型 ±22°']],
    min: [-88, -22, 30], size: [178, 45, 88],
    pivot: [0, 0, 34], axis: [1, 0, 0], motion: { type: 'sweep', speed: 0.09, range: 0.38 },
    order: 6, focus: 230,
  },
  {
    id: 'solar-b', name: '左舷太阳翼阵', en: 'Port Solar Array Wing', code: 'CS-SAW-06P', category: '电源',
    desc: '与右舷镜像的四片帆板阵。两阵合计 256 kW 峰值功率，日照期同时为再生燃料电池充电以维持阴影期供电。',
    specs: [['帆板数', '4'], ['单翼长度', '43.2 m'], ['峰值功率', '128 kW'], ['电池效率', '32.4 %'], ['跟踪关节', 'α 型 ±22°']],
    min: [-88, -22, -118], size: [178, 45, 88],
    pivot: [0, 0, -34], axis: [1, 0, 0], motion: { type: 'sweep', speed: 0.09, range: 0.38, phase: Math.PI },
    order: 6, focus: 230,
  },
  {
    id: 'thermal-a', name: '右舷热控辐射器', en: 'Starboard Thermal Radiators', code: 'CS-TCS-07S', category: '热控',
    desc: '四组氨工质单相辐射器，通过 β 关节保持辐射面朝向深空冷背景。总排热能力 82 kW，是全站电子设备与生保系统的散热终端。',
    specs: [['辐射面积', '196 m²'], ['排热能力', '82 kW'], ['工质', '无水氨'], ['转动关节', 'β 型 ±60°']],
    min: [-56, -50, 26], size: [113, 101, 18], order: 5, focus: 190,
  },
  {
    id: 'thermal-b', name: '左舷热控辐射器', en: 'Port Thermal Radiators', code: 'CS-TCS-07P', category: '热控',
    desc: '与右舷镜像的辐射器组。两舷共八片辐射板在阴影期收拢，以减少热损失。',
    specs: [['辐射面积', '196 m²'], ['排热能力', '82 kW'], ['工质', '无水氨'], ['转动关节', 'β 型 ±60°']],
    min: [-56, -50, -44], size: [113, 101, 18], order: 5, focus: 190,
  },
  {
    id: 'lab-a', name: '科学实验舱 α', en: 'Science Laboratory Alpha', code: 'CS-LAB-08A', category: '科研',
    desc: '微重力材料科学与流体物理专用舱。配备 6 个国际标准载荷机柜、手套箱、高温梯度炉与光学诊断台。舱外顶端设有 4 个暴露试验平台。',
    specs: [['载荷机柜', '6'], ['加压容积', '78 m³'], ['暴露平台', '4'], ['微振动水平', '< 1 μg']],
    min: [6, 10, -14], size: [29, 46, 29], order: 7, focus: 80,
  },
  {
    id: 'lab-b', name: '科学实验舱 β', en: 'Science Laboratory Beta', code: 'CS-LAB-08B', category: '科研',
    desc: '生命科学与地球观测专用舱。含离心机、生物培养舱与多光谱对地相机。舱壁嵌有 8 处高透光率石英观测窗。',
    specs: [['载荷机柜', '6'], ['加压容积', '78 m³'], ['观测窗', '8'], ['离心机直径', '2.4 m']],
    min: [-34, 10, -14], size: [29, 46, 29], order: 7, focus: 80,
  },
  {
    id: 'dock', name: '对接枢纽', en: 'Docking Hub', code: 'CS-DOC-09', category: '对接 / 转运',
    desc: '五向对接枢纽：轴向一个大型货运接口，径向四个乘员飞船接口。配备可视化交会引导灯阵、激光测距标靶与柔性对接缓冲机构。',
    specs: [['对接口', '5'], ['最大来访质量', '22 t'], ['引导灯阵', '3 组'], ['缓冲行程', '0.42 m']],
    min: [2, -56, -20], size: [37, 48, 41], order: 8, focus: 80,
  },
  {
    id: 'hangar', name: '在轨机库', en: 'Orbital Service Hangar', code: 'CS-HGR-10', category: '维修 / 库存',
    desc: '半开放式在轨维修机库，可容纳一艘摆渡飞船进行加注与检修。内壁布置全向照明与磁性工装轨道，舱门为双扇对开式。',
    specs: [['净空尺寸', '19 × 20 × 26 m'], ['照明', '48 × LED 阵'], ['工装轨道', '2 条'], ['舱门', '双扇对开']],
    min: [-40, -50, -26], size: [39, 42, 53], order: 9, focus: 95,
  },
  {
    id: 'shuttle', name: '摆渡飞船「云梭」', en: 'Tender Craft "Yunsuo"', code: 'CS-TND-11', category: '来访航天器',
    desc: '停泊于对接枢纽下方的轨道摆渡飞船。三角翼构型兼顾在轨机动与再入能力，可搭载 4 名乘员或 3.2 t 货物往返地面与空间站。',
    specs: [['全长', '21.6 m'], ['翼展', '17.4 m'], ['乘员', '4'], ['货运能力', '3.2 t'], ['状态', '已硬连接']],
    min: [2, -94, -20], size: [37, 48, 41],
    pivot: [20, -60, 0], axis: [0, 1, 0], motion: { type: 'bob', speed: 0.5, range: 0.02 },
    order: 10, focus: 70,
  },
  {
    id: 'comms', name: '通信与测控阵', en: 'Comms & TT&C Array', code: 'CS-TTC-12', category: '通信',
    desc: '双 Ka 波段高增益天线加相控阵中继终端。高增益天线可对地静止中继卫星自主指向，实现 1.2 Gbps 下行速率。',
    specs: [['高增益天线', '2 × 7.2 m'], ['下行速率', '1.2 Gbps'], ['波段', 'Ka / S / 激光'], ['指向精度', '0.02°']],
    min: [36, -50, -22], size: [34, 101, 45],
    pivot: [52, 0, 0], axis: [0, 0, 1], motion: { type: 'sweep', speed: 0.13, range: 0.42 },
    order: 11, focus: 90,
  },
  {
    id: 'arm-base', name: '遥操作机械臂', en: 'Remote Manipulator System', code: 'CS-RMS-13', category: '机械臂',
    desc: '七自由度冗余机械臂，基座可沿桁架移动。末端执行器兼容全站 42 个标准抓持点，用于载荷转运、来访飞船捕获与舱外维修支持。',
    specs: [['自由度', '7'], ['臂长', '17.6 m'], ['负载能力', '116 t（在轨）'], ['末端定位精度', '±0.03 m'], ['抓持点', '42']],
    min: [26, 10, -12], size: [19, 14, 25], order: 12, focus: 60,
  },
  {
    id: 'arm-link1', name: '机械臂 · 大臂', en: 'RMS Boom Segment', code: 'CS-RMS-13A', category: '机械臂',
    desc: '机械臂大臂段，内含关节驱动器、力矩传感器与视觉相机。', specs: [['长度', '9.0 m'], ['关节', '肩偏航 / 俯仰']],
    min: [24, 14, -12], size: [21, 40, 25],
    pivot: [34, 18, 0], axis: [0, 0, 1], motion: { type: 'sweep', speed: 0.11, range: 0.17, bias: -0.07 },
    parent: 'arm-base', order: 12, listed: false,
  },
  {
    id: 'arm-link2', name: '机械臂 · 小臂', en: 'RMS Forearm & Effector', code: 'CS-RMS-13B', category: '机械臂',
    desc: '机械臂小臂与末端执行器，配备三指抓持机构与照明。', specs: [['长度', '7.2 m'], ['关节', '肘 / 腕三轴']],
    min: [22, 42, -14], size: [25, 40, 29],
    pivot: [34, 48, 0], axis: [0, 0, 1], motion: { type: 'sweep', speed: 0.17, range: 0.3, phase: 1.1 },
    parent: 'arm-link1', order: 12, listed: false,
  },
];

export const MODULE_IDS = MODULES.map((m) => m.id);
export const MODULE_MAP = new Map(MODULES.map((m) => [m.id, m]));

export const STATION_INFO = Object.freeze({
  name: '天穹站', en: 'CELESTIAL SPIRE', code: 'CS-Ω',
  telemetry: [
    ['轨道高度', '412.6 km'], ['轨道倾角', '51.6°'], ['轨道速度', '7.66 km/s'],
    ['在轨质量', '482.3 t'], ['母线功率', '256 kW'], ['乘员', '6 / 12'],
  ],
});

/* ═══════════════════════ 建造入口 ═══════════════════════ */

/**
 * 构建指定舱段的体素体积。
 * @param {string} id
 * @returns {VoxelVolume}
 */
export function buildModule(id) {
  const def = MODULE_MAP.get(id);
  if (!def) throw new Error(`未知舱段：${id}`);
  const vol = new VoxelVolume(def.min[0], def.min[1], def.min[2], def.size[0], def.size[1], def.size[2]);
  const brush = new Brush(vol, hashSeed(id));
  const fn = BUILDERS[id];
  if (!fn) throw new Error(`舱段 ${id} 缺少建造程序`);
  fn(brush, vol, def);
  return vol.trim(1);
}

const hashSeed = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

/* ═══════════════════════ 各舱段建造程序 ═══════════════════════ */

/* ── 核心舱 ─────────────────────────────────────────────── */
function buildCore(b, vol) {
  const R = L.coreR, X0 = L.coreX0, X1 = L.coreX1;
  // 主承力筒：沿轴分段涂装，模拟不同批次壳板
  const hull = (x) => {
    const seg = Math.floor((x + 48) / 14);
    if (seg % 3 === 0) return MAT.HULL_WHITE;
    if (seg % 3 === 1) return MAT.HULL_BONE;
    return MAT.HULL_GREY;
  };
  cyl(b, 0, [0, 0, 0], R, X0, X1, hull);
  // 端部锥形过渡与对接法兰
  cne(b, 0, [0, 0, 0], R, R - 3, X1 - 3, X1 + 2, MAT.TITANIUM);
  cne(b, 0, [0, 0, 0], R - 3, R, X0 - 2, X0 + 3, MAT.TITANIUM);

  // 周向加强环（每 14 体素一道），交替金色隔热毯 / 钛环
  for (let x = X0 + 6; x <= X1 - 6; x += 14) {
    b.ribRing(0, [0, 0, 0], R, x, x % 28 === 0 ? MAT.FOIL_GOLD : MAT.TITANIUM, { thickness: 2, protrude: 1 });
  }

  // 舷窗：三处窗带，每带 12 个
  for (const [at, count, phase] of [[-22, 12, 0], [4, 12, 0.26], [26, 8, 0.5]]) {
    b.windowRing(0, [0, 0, 0], R, at, count, MAT.GLASS_WIN, { w: 2, h: 3, phase, ring: MAT.HULL_DARK });
  }

  // 纵向管路与线缆槽：四条 45° 布置
  b.radial(0, [0, 0, 0], R + 1, 4, (p, out) => {
    const c = [0, p[1], p[2]];
    b.pipeRun(0, c, X0 + 4, X1 - 4, MAT.PIPE_STEEL, 1);
    const c2 = [0, p[1] * 0.94 + out[1] * 1.6, p[2] * 0.94 + out[2] * 1.6];
    b.pipeRun(0, c2, X0 + 8, X1 - 8, MAT.ICE_BLUE, 1);
  }, Math.PI / 4);

  // 扶手：两条黄色 EVA 移动扶手
  for (const ang of [Math.PI * 0.15, Math.PI * 1.15]) {
    for (let x = X0 + 5; x <= X1 - 5; x += 7) {
      const y = Math.cos(ang) * (R + 2), z = Math.sin(ang) * (R + 2);
      b.capsule([x, y, z], [x + 4, y, z], 0.9, MAT.HANDRAIL, 'empty');
      b.capsule([x, Math.cos(ang) * R, Math.sin(ang) * R], [x, y, z], 0.7, MAT.TITANIUM, 'empty');
    }
  }

  // 侧向对接颈：为实验舱 / 对接枢纽 / 机库预留法兰
  const collar = (x, dirY, r) => {
    b.cylinder(1, 0, x, r + 2, dirY > 0 ? R - 2 : -(R + 4), dirY > 0 ? R + 4 : -(R - 2), MAT.PORT_RING);
    b.cylinder(1, 0, x, r + 3, dirY > 0 ? R + 2 : -(R + 4), dirY > 0 ? R + 4 : -(R + 2), MAT.HULL_DARK);
  };
  collar(L.labX, +1, L.labR); collar(-L.labX, +1, L.labR);
  collar(L.labX, -1, L.dockR); collar(-L.labX, -1, 12);

  // 尾/首端航行灯与状态灯
  b.radial(0, [0, 0, 0], R + 1, 6, (p) => {
    b.sphere(X1 - 2, p[1], p[2], 1, MAT.LED_CYAN);
    b.sphere(X0 + 2, p[1], p[2], 1, MAT.LED_RED);
  }, 0.3);
  for (let x = X0 + 10; x < X1 - 6; x += 9) {
    b.sphere(x, R + 1, 0, 1, x % 18 === 0 ? MAT.LED_GREEN : MAT.LED_AMBER);
  }

  // 表面细节：设备箱、传感器、微流星体防护板拼缝
  b.greeble([-40, -20, -20], [40, 20, 20], 0.055,
    [MAT.HULL_DARK, MAT.TITANIUM, MAT.CARBON, MAT.FOIL_SILVER, MAT.DECAL_DARK], { maxSize: 3, seed: 11 });
  b.weather([-40, -20, -20], [40, 20, 20], 0.055, MAT.DECAL_DARK,
    (m) => m === MAT.HULL_WHITE || m === MAT.HULL_BONE);

  // 舷号喷涂
  stencilCylinder(vol, 'CS-01', { axis: 0, c: [0, 0, 0], r: R, at: 16, ang0: -Math.PI / 2, mat: MAT.HULL_DARK, scale: 2 });
  stencilCylinder(vol, 'CELESTIAL', { axis: 0, c: [0, 0, 0], r: R, at: -10, ang0: Math.PI * 0.42, mat: MAT.BLUE_ACCENT, scale: 1 });
}

/* ── 离心居住环 ─────────────────────────────────────────── */
function buildRing(b) {
  const R = L.ringR, r = L.ringr;
  // 环体主结构：外层白壳 + 内层深色框架，形成"双层"观感
  b.torus(0, 0, 0, 0, R, r, (x, y, z) => {
    const ang = Math.atan2(z, y);
    const seg = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 16);
    if (Math.abs(x) > r - 3) return MAT.HULL_GREY;
    return seg % 2 === 0 ? MAT.HULL_WHITE : MAT.HULL_BONE;
  });
  // 16 道舱段隔框
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2;
    const cy = Math.cos(ang) * R, cz = Math.sin(ang) * R;
    b.obb([0, cy, cz], [1, 0, 0], [0, Math.cos(ang), Math.sin(ang)], [0, -Math.sin(ang), Math.cos(ang)],
      [r + 1, r + 1.5, 1], MAT.TITANIUM);
  }
  // 外缘观景舷窗（朝外辐射方向）
  for (let i = 0; i < 64; i++) {
    const ang = (i / 64) * Math.PI * 2 + 0.05;
    const cy = Math.cos(ang), cz = Math.sin(ang);
    for (let dx = -2; dx <= 2; dx++) {
      for (let k = 0; k <= 2; k++) {
        const rr = R + r - k;
        b.vol.repaint(dx, Math.round(cy * rr), Math.round(cz * rr),
          Math.abs(dx) === 2 ? MAT.HULL_DARK : MAT.GLASS_WIN);
      }
    }
  }
  // 内缘照明灯带（朝向核心舱，营造环内散射光）
  for (let i = 0; i < 48; i++) {
    const ang = (i / 48) * Math.PI * 2;
    const rr = R - r + 1;
    b.vol.repaint(0, Math.round(Math.cos(ang) * rr), Math.round(Math.sin(ang) * rr), MAT.LED_CYAN);
  }
  // 两条辐射连接臂（±Y）：桁架式，含中央转轴与电缆卷
  for (const s of [1, -1]) {
    const y0 = s * (L.coreR + 1), y1 = s * (R - r + 2);
    b.truss([0, y0, 0], [0, y1, 0], L.spokeR, MAT.TRUSS_ALLOY, MAT.CARBON, { segment: 9, rod: 1.4 });
    cyl(b, 1, [0, 0, 0], 3.2, Math.min(y0, y1), Math.max(y0, y1), MAT.FOIL_SILVER);
    // 转轴轴承壳
    b.cylinder(1, 0, 0, 6, s > 0 ? y0 - 1 : y0 - 5, s > 0 ? y0 + 5 : y0 + 1, MAT.PORT_RING);
    // 电缆束
    for (const off of [-3.2, 3.2]) {
      b.capsule([off, y0, off * 0.4], [off, y1, off * 0.4], 0.9, MAT.SEAL_BLACK, 'empty');
    }
    // 环体接入舱
    b.obb([0, s * (R - r - 1), 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [6, 4, 6], MAT.HULL_GREY);
  }
  // 环外壁设备：辐射器小板、天线、抓持点
  const rnd = mulberry32(0x5eed);
  for (let i = 0; i < 24; i++) {
    const ang = (i / 24) * Math.PI * 2 + 0.13;
    const cy = Math.cos(ang), cz = Math.sin(ang);
    const rr = R + r - 1;
    const px = Math.round((rnd() - 0.5) * (r * 1.2));
    b.obb([px, cy * rr, cz * rr], [1, 0, 0], [0, cy, cz], [0, -cz, cy],
      [2.5, 1.5, 2.5], i % 3 === 0 ? MAT.RADIATOR : MAT.HULL_DARK);
    if (i % 4 === 0) b.sphere(px, Math.round(cy * (rr + 2)), Math.round(cz * (rr + 2)), 1, MAT.LED_AMBER);
  }
  b.greeble([-14, -64, -64], [14, 64, 64], 0.035,
    [MAT.HULL_DARK, MAT.FOIL_GOLD, MAT.TITANIUM], { maxSize: 2, avoid: [MAT.GLASS_WIN], seed: 23 });
}

/* ── 指令与观测舱 ───────────────────────────────────────── */
function buildCommand(b, vol) {
  const R = L.coreR;
  // 锥形过渡段
  cne(b, 0, [0, 0, 0], R, 9, L.cmdX0, L.cmdX1, (x) => (Math.floor((x - L.cmdX0) / 5) % 2 ? MAT.HULL_WHITE : MAT.HULL_BONE));
  // 指挥舱环形窗带（前视）
  b.windowRing(0, [0, 0, 0], 11, L.cmdX0 + 7, 10, MAT.GLASS_WIN, { w: 3, h: 4, ring: MAT.HULL_DARK });
  // 穹顶基座与观测穹顶
  cyl(b, 0, [0, 0, 0], 9, L.cmdX1, L.cmdX1 + 3, MAT.PORT_RING);
  b.cylinderRange(0, [0, 0, 0], 10, 8, L.cmdX1 + 1, L.cmdX1 + 3, MAT.TITANIUM);
  b.hemisphere(L.domeX - 2, 0, 0, L.domeR, 0, +1, MAT.GLASS_DOME, 3);
  // 穹顶分格钛肋
  b.radial(0, [0, 0, 0], 1, 8, (p, out, tan) => {
    const a = Math.atan2(out[2], out[1]);
    for (let t = 0; t <= 14; t++) {
      const ph = (t / 14) * (Math.PI / 2);
      const rr = L.domeR * Math.sin(ph);
      b.capsule(
        [L.domeX - 2 + L.domeR * Math.cos(ph), Math.cos(a) * rr, Math.sin(a) * rr],
        [L.domeX - 2 + L.domeR * Math.cos(ph + 0.09), Math.cos(a) * L.domeR * Math.sin(ph + 0.09), Math.sin(a) * L.domeR * Math.sin(ph + 0.09)],
        1, MAT.TITANIUM);
    }
    void tan;
  });
  // 穹顶遮阳板（半开）
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    b.obb([L.domeX + 2, Math.cos(a) * 8, Math.sin(a) * 8],
      [0.55, Math.cos(a) * 0.83, Math.sin(a) * 0.83], [-0.83, Math.cos(a) * 0.55, Math.sin(a) * 0.55], [0, -Math.sin(a), Math.cos(a)],
      [5, 0.8, 4], MAT.FOIL_GOLD);
  }
  // 交会雷达与激光测距头
  for (const s of [1, -1]) {
    b.obb([L.cmdX0 + 5, s * 12, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [3, 2, 4], MAT.HULL_DARK);
    b.dish(0, [L.cmdX0 + 9, s * 12, 0], 4, 2, 1, MAT.DISH_WHITE, +1);
    b.sphere(L.cmdX0 + 6, s * 12, 4, 1, MAT.LED_CYAN);
  }
  // RCS 姿控推力器组（四象限，每组三喷口）
  b.radial(0, [0, 0, 0], 10, 4, (p, out, tan) => {
    for (let k = -1; k <= 1; k++) {
      const c = [L.cmdX0 + 3, p[1] + tan[1] * k * 3, p[2] + tan[2] * k * 3];
      b.obb(c, [1, 0, 0], out, tan, [1.6, 2.2, 1.2], MAT.THRUSTER);
      b.sphere(c[0] + 2, Math.round(c[1] + out[1] * 1.2), Math.round(c[2] + out[2] * 1.2), 1, MAT.HULL_DARK);
    }
  }, Math.PI / 4);
  // 前端泛光灯
  b.radial(0, [0, 0, 0], 7, 4, (p) => b.sphere(L.cmdX1 + 1, p[1], p[2], 1.4, MAT.INNER_LIT), 0.8);
  b.greeble([32, -20, -20], [L.cmdX1, 20, 20], 0.06,
    [MAT.HULL_DARK, MAT.TITANIUM, MAT.FOIL_SILVER, MAT.CARBON], { maxSize: 2, seed: 31 });
  stencilCylinder(vol, 'CMD', { axis: 0, c: [0, 0, 0], r: 12, at: L.cmdX0 + 14, ang0: -Math.PI / 2, mat: MAT.RED_ACCENT, scale: 1 });
}

/* ── 推进与贮箱舱 ───────────────────────────────────────── */
function buildPropulsion(b, vol) {
  const R = L.coreR, X0 = L.propX0, X1 = L.propX1;
  cyl(b, 0, [0, 0, 0], R, X0, X1, (x) => (Math.floor((x - X0) / 9) % 2 ? MAT.FOIL_GOLD : MAT.HULL_GREY));
  b.ribRing(0, [0, 0, 0], R, X1 - 4, MAT.TITANIUM, { thickness: 2 });
  b.ribRing(0, [0, 0, 0], R, X0 + 5, MAT.TITANIUM, { thickness: 2 });

  // 两只球形贮箱（±Y），银色隔热毯 + 加强带
  for (const s of [1, -1]) {
    const cyv = s * 21;
    b.sphere(-52, cyv, 0, 9, MAT.FOIL_SILVER);
    b.torus(1, -52, cyv, 0, 9, 1.2, MAT.TITANIUM);
    b.torus(0, -52, cyv, 0, 9, 1.2, MAT.TITANIUM);
    b.capsule([-52, s * 13, 0], [-52, cyv - s * 8, 0], 3, MAT.PIPE_STEEL);
    b.sphere(-52, cyv + s * 9, 0, 1.5, MAT.LED_AMBER);
    stencil(vol, 'XE', { axis: 2, plane: 8, u: -56, v: cyv - 2, mat: MAT.HULL_DARK, scale: 1, depth: 3, dn: -1 });
  }

  // 推力结构桁架 + 四台主发动机
  b.truss([X0, 0, 0], [L.nozzleX + 6, 0, 0], 9, MAT.TRUSS_ALLOY, MAT.CARBON, { segment: 8, rod: 1.3 });
  const eng = [[7, 7], [-7, 7], [7, -7], [-7, -7]];
  for (const [ey, ez] of eng) {
    // 燃烧室 + 收缩段 + 喷管扩张段
    cyl(b, 0, [0, ey, ez], 3.4, X0 - 2, X0 + 2, MAT.TITANIUM);
    b.cone(0, ey, ez, 3.4, 2.2, X0 - 6, X0 - 2, MAT.NOZZLE);
    b.cone(0, ey, ez, 2.2, 6.4, L.nozzleX + 4, X0 - 6, MAT.NOZZLE, 1.4);
    // 喷管加强环
    for (let x = L.nozzleX + 6; x < X0 - 7; x += 4) {
      const t = (x - (L.nozzleX + 4)) / (X0 - 6 - (L.nozzleX + 4));
      const rr = 6.4 + (2.2 - 6.4) * t;
      b.cylinderRange(0, [x, ey, ez], rr + 0.8, rr - 1.2, x, x + 1, MAT.TITANIUM);
    }
    // 喉部辉光与烧蚀
    b.disc(0, L.nozzleX + 5, ey, ez, 5.6, 2, MAT.ENGINE_GLOW);
    b.cylinderRange(0, [0, ey, ez], 6.6, 5.4, L.nozzleX + 4, L.nozzleX + 7, MAT.SOOT);
  }
  // 电推末端离子栅
  b.disc(0, L.nozzleX + 2, 0, 0, 5, 2, MAT.LED_CYAN);
  b.cylinderRange(0, [L.nozzleX, 0, 0], 6, 4.6, L.nozzleX, L.nozzleX + 3, MAT.TITANIUM);
  // 尾部航行灯与管路
  b.radial(0, [0, 0, 0], R + 1, 4, (p) => {
    b.pipeRun(0, [0, p[1], p[2]], X0 + 2, X1 - 2, MAT.PIPE_STEEL, 1);
    b.sphere(X0 + 1, p[1], p[2], 1, MAT.LED_RED);
  }, Math.PI / 4);
  b.greeble([-90, -28, -28], [X1, 28, 28], 0.05,
    [MAT.HULL_DARK, MAT.TITANIUM, MAT.FOIL_COPPER, MAT.CARBON], { maxSize: 2, seed: 41 });
  stencilCylinder(vol, 'PRP-04', { axis: 0, c: [0, 0, 0], r: R, at: -44, ang0: -Math.PI / 2, mat: MAT.HULL_DARK, scale: 1 });
}

/* ── 主桁架（左/右舷共用逻辑） ─────────────────────────── */
function buildTruss(side) {
  return function (b, vol) {
    const z = L.trussZ * side;
    b.truss([L.trussX0, 0, z], [L.trussX1, 0, z], L.trussHalf, MAT.TRUSS_ALLOY, MAT.CARBON, { segment: 11, rod: 1.5 });
    // 与核心舱的斜撑
    for (const sx of [-1, 1]) {
      b.beam([sx * 15, 0, z - side * (L.trussHalf + 1)], [sx * 8, side * 7, side * 12], 1.6, MAT.TITANIUM);
      b.beam([sx * 15, 0, z - side * (L.trussHalf + 1)], [sx * 8, -side * 7, side * 12], 1.6, MAT.TITANIUM);
    }
    // 公用设施走线：流体管 + 电缆 + 数据总线
    for (const [oy, oz, mat, r] of [[L.trussHalf, 0, MAT.ICE_BLUE, 1.2], [-L.trussHalf, 0, MAT.PIPE_STEEL, 1.2], [0, L.trussHalf * side, MAT.SEAL_BLACK, 1]]) {
      b.capsule([L.trussX0 + 3, oy, z + oz], [L.trussX1 - 3, oy, z + oz], r, mat, 'empty');
    }
    // 太阳翼旋转关节壳体
    for (const wx of L.wingX) {
      b.cylinder(2, wx, 0, L.trussHalf + 1.5, z - side * 3, z + side * 3, MAT.PORT_RING);
      b.obb([wx, 0, z + side * (L.trussHalf + 2)], [1, 0, 0], [0, 1, 0], [0, 0, 1], [5, 4, 2], MAT.HULL_DARK);
      b.sphere(wx, 5, z + side * (L.trussHalf + 2), 1, MAT.LED_GREEN);
    }
    // 外部载荷平台与备件箱
    const rnd = mulberry32(side > 0 ? 0xa1 : 0xb2);
    for (let i = 0; i < 6; i++) {
      const px = L.trussX0 + 14 + i * 30;
      const s = 1 + Math.floor(rnd() * 2);
      b.obb([px, L.trussHalf + 3, z], [1, 0, 0], [0, 1, 0], [0, 0, 1], [4 + s, 3, 4], i % 2 ? MAT.FOIL_GOLD : MAT.CARGO_TAN);
      b.obb([px, L.trussHalf + 6, z], [1, 0, 0], [0, 1, 0], [0, 0, 1], [2, 1, 2], MAT.HULL_DARK);
    }
    // 移动小车导轨与工作平台
    b.beam([L.trussX0 + 4, -L.trussHalf - 2, z], [L.trussX1 - 4, -L.trussHalf - 2, z], 1.1, MAT.TITANIUM);
    b.obb([-20 * side, -L.trussHalf - 5, z], [1, 0, 0], [0, 1, 0], [0, 0, 1], [6, 3, 5], MAT.HULL_GREY);
    // 桁架端部导航灯
    for (const ex of [L.trussX0 + 2, L.trussX1 - 2]) {
      b.sphere(ex, 0, z, 1.6, ex < 0 ? MAT.LED_RED : MAT.LED_GREEN);
    }
    b.greeble([L.trussX0, -10, z - 10], [L.trussX1, 10, z + 10], 0.03,
      [MAT.HULL_DARK, MAT.TITANIUM, MAT.FOIL_SILVER], { maxSize: 2, seed: side > 0 ? 51 : 52 });
    // 桁架段号喷涂（在移动小车工作平台侧面）
    stencil(vol, side > 0 ? 'S1' : 'P1', {
      axis: 1, plane: -L.trussHalf - 8, u: z - 4, v: -20 * side - 5, mat: MAT.HULL_DARK, scale: 1, depth: 2, dn: +1,
    });
  };
}

/* ── 太阳翼阵 ───────────────────────────────────────────── */
function buildSolar(side) {
  return function (b, vol) {
    const zRoot = L.trussZ * side;
    const zA = L.wingZ0 * side, zB = L.wingZ1 * side;
    const zc = (zA + zB) / 2, halfZ = Math.abs(zB - zA) / 2;
    for (const wx of L.wingX) {
      // 展开支撑桅杆 + 收拢箱
      b.capsule([wx, 0, zRoot + side * 4], [wx, 0, zA], 2.2, MAT.TITANIUM);
      b.obb([wx, 0, zRoot + side * 8], [1, 0, 0], [0, 1, 0], [0, 0, 1], [L.wingHalfX - 2, 3, 3], MAT.HULL_GREY);
      // 两片帆板（上下叠置形成一对翼）
      for (const oy of [-5, 5]) {
        b.solarPanel(1, [wx, oy, zc], halfZ, L.wingHalfX, 2, {
          cell: MAT.SOLAR_CELL, bus: MAT.SOLAR_HOT, frame: MAT.SOLAR_FRAME, grid: 8,
        });
        // 边梁与横撑
        b.beam([wx - L.wingHalfX, oy, zA], [wx - L.wingHalfX, oy, zB], 1.3, MAT.SOLAR_FRAME);
        b.beam([wx + L.wingHalfX, oy, zA], [wx + L.wingHalfX, oy, zB], 1.3, MAT.SOLAR_FRAME);
        for (let t = 0; t <= 6; t++) {
          const zz = zA + (zB - zA) * (t / 6);
          b.beam([wx - L.wingHalfX, oy, zz], [wx + L.wingHalfX, oy, zz], 1.1, MAT.SOLAR_FRAME);
        }
        // 桅杆到帆板的张紧索
        b.capsule([wx, 0, zA], [wx - L.wingHalfX, oy, zA + side * 6], 0.7, MAT.SEAL_BLACK);
        b.capsule([wx, 0, zA], [wx + L.wingHalfX, oy, zA + side * 6], 0.7, MAT.SEAL_BLACK);
      }
      // 翼尖标识灯
      b.sphere(wx, 0, zB - side * 2, 1.4, MAT.LED_AMBER);
      stencil(vol, 'SAW', {
        axis: 1, plane: -7, u: zc - 8, v: wx - 8, mat: MAT.SOLAR_FRAME, scale: 1, depth: 2, dn: +1,
      });
    }
  };
}

/* ── 热控辐射器 ─────────────────────────────────────────── */
function buildThermal(side) {
  return function (b, vol) {
    const z = L.trussZ * side;
    for (const rx of L.radX) {
      for (const sy of [1, -1]) {
        const cy = sy * L.radOffY;
        // β 关节与展开臂
        b.cylinder(2, rx, sy * 8, 3.4, z - side * 2, z + side * 2, MAT.PORT_RING);
        b.capsule([rx, sy * 8, z], [rx, cy - sy * L.radHalfY, z], 2, MAT.TITANIUM);
        // 辐射板（法线沿 Z）
        b.radiatorPanel(2, [rx, cy, z], L.radHalfX, L.radHalfY, 2, MAT.RADIATOR, MAT.TITANIUM);
        // 分格鳍片与工质管
        for (let k = -L.radHalfX + 3; k <= L.radHalfX - 3; k += 4) {
          b.beam([rx + k, cy - L.radHalfY + 2, z + side * 1.5], [rx + k, cy + L.radHalfY - 2, z + side * 1.5], 0.8, MAT.TITANIUM);
        }
        b.capsule([rx - L.radHalfX + 2, cy - L.radHalfY + 1, z - side * 1.5],
          [rx + L.radHalfX - 2, cy - L.radHalfY + 1, z - side * 1.5], 1, MAT.ICE_BLUE);
        b.sphere(rx, cy + sy * (L.radHalfY - 1), z + side * 2, 1, MAT.LED_CYAN);
        stencil(vol, 'TCS', {
          axis: 2, plane: z, u: rx - 8, v: cy - 3, mat: MAT.BLUE_ACCENT, scale: 1, depth: 2, dn: -1,
        });
      }
    }
  };
}

/* ── 科学实验舱 ─────────────────────────────────────────── */
function buildLab(side, accent, label) {
  return function (b, vol) {
    const x = L.labX * side, R = L.labR;
    cyl(b, 1, [x, 0, 0], R, L.labY0, L.labY1 - 4, (xx, y) => (Math.floor(y / 6) % 2 ? MAT.HULL_WHITE : MAT.HULL_BONE));
    b.hemisphere(x, L.labY1 - 4, 0, R, 1, +1, MAT.HULL_WHITE);
    // 对接颈与法兰
    b.cylinder(1, 0, x, R + 2, L.labY0 - 2, L.labY0 + 2, MAT.PORT_RING);
    // 加强环
    for (let y = L.labY0 + 6; y < L.labY1 - 6; y += 8) b.ribRing(1, [x, 0, 0], R, y, MAT.TITANIUM, { thickness: 1 });
    // 舷窗两带
    b.windowRing(1, [x, 0, 0], R, L.labY0 + 10, 8, MAT.GLASS_WIN, { w: 2, h: 3, ring: MAT.HULL_DARK });
    b.windowRing(1, [x, 0, 0], R, L.labY1 - 12, 6, MAT.GLASS_WIN, { w: 2, h: 2, phase: 0.4, ring: MAT.HULL_DARK });
    // 标识色环
    b.cylinderRange(1, [x, 0, 0], R + 1, R - 2, L.labY0 + 15, L.labY0 + 17, accent);
    // 舱外暴露试验平台 ×4
    b.radial(1, [x, 0, 0], R + 3, 4, (p, out) => {
      const c = [p[0], L.labY1 - 9, p[2]];
      b.obb(c, [out[0], 0, out[2]], [0, 1, 0], [-out[2], 0, out[0]], [2, 2.5, 4], MAT.CARBON);
      b.obb([c[0] + out[0] * 2, c[1] + 3, c[2] + out[2] * 2], [out[0], 0, out[2]], [0, 1, 0], [-out[2], 0, out[0]],
        [0.8, 0.8, 3.4], MAT.FOIL_GOLD);
      b.sphere(Math.round(c[0] + out[0] * 3), c[1] + 5, Math.round(c[2] + out[2] * 3), 1, MAT.LED_GREEN);
    }, Math.PI / 4);
    // 顶端设备：小型天线 + 抓持点 + 扶手
    b.capsule([x, L.labY1 + 2, 0], [x, L.labY1 + 8, 0], 1, MAT.ANTENNA_ROD);
    b.sphere(x, L.labY1 + 9, 0, 1.6, MAT.LED_CYAN);
    b.dish(1, [x, L.labY1 + 4, 5], 4, 2, 1, MAT.DISH_WHITE, +1);
    for (let y = L.labY0 + 6; y < L.labY1 - 6; y += 7) {
      b.capsule([x + R + 2, y, 0], [x + R + 2, y + 4, 0], 0.9, MAT.HANDRAIL, 'empty');
    }
    b.greeble([x - R - 4, L.labY0, -R - 4], [x + R + 4, L.labY1 + 4, R + 4], 0.05,
      [MAT.HULL_DARK, MAT.TITANIUM, MAT.FOIL_SILVER, accent], { maxSize: 2, avoid: [MAT.GLASS_WIN], seed: side > 0 ? 61 : 62 });
    stencilCylinder(vol, label, { axis: 1, c: [x, 0, 0], r: R, at: L.labY0 + 24, ang0: 0, mat: accent, scale: 1, flip: 1 });
  };
}

/* ── 对接枢纽 ───────────────────────────────────────────── */
function buildDock(b, vol) {
  const x = L.labX, R = L.dockR;
  cyl(b, 1, [x, 0, 0], R, L.dockY0 + 4, L.dockY1, (xx, y) => (Math.floor(-y / 7) % 2 ? MAT.HULL_GREY : MAT.HULL_WHITE));
  b.hemisphere(x, L.dockY0 + 4, 0, R, 1, -1, MAT.HULL_GREY);
  b.cylinder(1, 0, x, R + 2, L.dockY1 - 2, L.dockY1 + 2, MAT.PORT_RING);
  // 轴向大型对接口（朝 -Y）
  b.cylinderRange(1, [x, 0, 0], 8, 5.5, L.dockY0 - 2, L.dockY0 + 1, MAT.PORT_RING);
  b.torus(1, x, L.dockY0 - 1, 0, 6.8, 1.4, MAT.SEAL_BLACK);
  b.disc(1, x, L.dockY0 + 2, 0, 5.4, 2, MAT.HULL_DARK);
  // 交会引导灯阵与标靶
  b.radial(1, [x, L.dockY0 - 1, 0], 9.5, 8, (p) => b.sphere(Math.round(p[0]), L.dockY0 - 1, Math.round(p[2]), 1, MAT.LED_CYAN));
  b.radial(1, [x, L.dockY0 + 2, 0], 4, 4, (p) => b.sphere(Math.round(p[0]), L.dockY0 + 2, Math.round(p[2]), 1, MAT.LED_RED));
  // 四个径向乘员接口
  b.radial(1, [x, 0, 0], R, 4, (p, out) => {
    const cy = L.dockY0 + 16;
    const c = [p[0] + out[0] * 3, cy, p[2] + out[2] * 3];
    b.obb(c, [out[0], 0, out[2]], [0, 1, 0], [-out[2], 0, out[0]], [3.5, 5, 5], MAT.HULL_WHITE);
    b.obb([c[0] + out[0] * 3, cy, c[2] + out[2] * 3], [out[0], 0, out[2]], [0, 1, 0], [-out[2], 0, out[0]],
      [1.5, 4, 4], MAT.PORT_RING);
    b.sphere(Math.round(c[0] + out[0] * 5), cy + 5, Math.round(c[2] + out[2] * 5), 1, MAT.LED_GREEN);
    b.sphere(Math.round(c[0] + out[0] * 5), cy - 5, Math.round(c[2] + out[2] * 5), 1, MAT.LED_AMBER);
  }, Math.PI / 4);
  // 危险警示带 + 管路
  b.cylinderRange(1, [x, 0, 0], R + 1, R - 2, L.dockY1 - 8, L.dockY1 - 6, MAT.HAZARD);
  for (const ang of [0.3, 1.9, 3.5, 5.1]) {
    b.pipeRun(1, [x + Math.cos(ang) * (R + 1), 0, Math.sin(ang) * (R + 1)], L.dockY0 + 6, L.dockY1 - 4, MAT.PIPE_STEEL, 1);
  }
  b.greeble([x - R - 4, L.dockY0 - 4, -R - 4], [x + R + 4, L.dockY1, R + 4], 0.05,
    [MAT.HULL_DARK, MAT.TITANIUM, MAT.HAZARD, MAT.FOIL_SILVER], { maxSize: 2, seed: 71 });
  stencil(vol, 'PORT-1', { axis: 0, plane: x + R + 1, u: -6, v: L.dockY0 + 26, mat: MAT.HULL_DARK, scale: 1, depth: 3, dn: -1 });
}

/* ── 在轨机库 ───────────────────────────────────────────── */
function buildHangar(b, vol) {
  const [X0, X1] = L.hangarX, [Y0, Y1] = L.hangarY, [Z0, Z1] = L.hangarZ;
  // 外壳（-Y 面开口）
  b.boxShell(X0, Y0, Z0, X1, Y1, Z1, MAT.HULL_GREY, 2, '-y');
  // 内壁照明与结构
  b.box(X0 + 2, Y0 + 2, Z0 + 2, X1 - 2, Y0 + 3, Z1 - 2, MAT.INNER_LIT);   // 内顶（-Y 视角的"天花板"）
  b.box(X0 + 2, Y1 - 3, Z0 + 2, X1 - 2, Y1 - 2, Z1 - 2, MAT.GRATE);       // 内底
  for (let z = Z0 + 5; z < Z1 - 3; z += 6) {
    b.box(X0 + 2, Y0 + 3, z, X0 + 3, Y1 - 3, z + 1, MAT.INNER_LIT);
    b.box(X1 - 3, Y0 + 3, z, X1 - 2, Y1 - 3, z + 1, MAT.INNER_LIT);
  }
  // 内部工装轨道与龙门架
  for (const zz of [Z0 + 6, Z1 - 6]) {
    b.beam([X0 + 3, Y0 + 4, zz], [X1 - 3, Y0 + 4, zz], 1.2, MAT.TITANIUM);
  }
  b.beam([X0 + 4, Y0 + 6, 0], [X1 - 4, Y0 + 6, 0], 1.4, MAT.TRUSS_ALLOY);
  b.obb([(X0 + X1) / 2, Y0 + 9, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [4, 3, 3], MAT.HULL_DARK);
  b.capsule([(X0 + X1) / 2, Y0 + 6, 0], [(X0 + X1) / 2, Y0 + 12, 0], 1, MAT.PIPE_STEEL);
  // 双扇对开舱门（半开状态：向两侧滑出）
  for (const s of [1, -1]) {
    const zOff = s * 13;
    b.box(X0 + 1, Y1 - 1, zOff - 9, X1 - 1, Y1 + 1, zOff + 9,
      (x, y, z) => (Math.abs(z - zOff) > 7 || Math.abs(x - (X0 + X1) / 2) > 13 ? MAT.TITANIUM : MAT.HULL_WHITE));
    // 门上斜向警示条
    b.box(X0 + 1, Y1 + 1, zOff - 9, X1 - 1, Y1 + 1, zOff + 9,
      (x, y, z) => ((x + z * 2) % 12 < 4 ? MAT.HAZARD : -1));
  }
  // 门框、导轨、开门指示
  b.box(X0, Y1 - 2, Z0, X1, Y1, Z0 + 1, MAT.HAZARD);
  b.box(X0, Y1 - 2, Z1 - 1, X1, Y1, Z1, MAT.HAZARD);
  for (const s of [1, -1]) b.sphere((X0 + X1) / 2, Y1, s * 24, 1.4, MAT.LED_AMBER);
  // 外壁设备与隔热毯
  b.box(X0, Y0, Z0, X0 + 1, Y1, Z1, MAT.FOIL_GOLD);
  b.greeble([X0 - 3, Y0 - 3, Z0 - 3], [X1 + 3, Y1 + 3, Z1 + 3], 0.05,
    [MAT.HULL_DARK, MAT.TITANIUM, MAT.FOIL_SILVER, MAT.CARBON], { maxSize: 3, avoid: [MAT.INNER_LIT, MAT.HAZARD], seed: 81 });
  stencil(vol, 'BAY-02', { axis: 2, plane: Z1, u: X0 + 6, v: Y0 + 8, mat: MAT.HULL_DARK, scale: 2, depth: 3, dn: -1 });
}

/* ── 摆渡飞船 ───────────────────────────────────────────── */
function buildShuttle(b, vol) {
  const x = L.labX, yTop = -50, yBot = -80;
  // 机身（沿 Y，头朝 +Y 与对接口硬连接）
  cyl(b, 1, [x, 0, 0], 6, yBot + 4, yTop - 4, MAT.HULL_WHITE);
  b.cone(1, 0, x, 6, 3, yTop - 4, yTop, MAT.HULL_WHITE);
  b.cone(1, 0, x, 6, 4.4, yBot, yBot + 4, MAT.HULL_DARK);
  // 对接探杆与密封环
  b.cylinderRange(1, [x, 0, 0], 3.4, 2, yTop, yTop + 3, MAT.PORT_RING);
  b.torus(1, x, yTop + 3, 0, 2.7, 0.9, MAT.SEAL_BLACK);
  // 三角翼（XZ 平面）
  for (const s of [1, -1]) {
    for (let t = 0; t <= 12; t++) {
      const f = t / 12;
      const zz = s * (5 + f * 12);
      const halfY = 9 * (1 - f * 0.75);
      b.obb([x, yBot + 12 + halfY * 0.2, zz], [1, 0, 0], [0, 1, 0], [0, 0, 1], [3.4 - f * 1.4, halfY, 1.2], MAT.HULL_BONE);
    }
    // 翼前缘热防护与翼梢小翼
    b.capsule([x, yBot + 21, s * 5], [x, yBot + 6, s * 17], 1.4, MAT.SOOT);
    b.obb([x, yBot + 10, s * 17], [1, 0, 0], [0, 1, 0], [0, 0, 1], [2.4, 6, 1], MAT.RED_ACCENT);
    b.sphere(x, yBot + 15, s * 18, 1, s > 0 ? MAT.LED_GREEN : MAT.LED_RED);
  }
  // 座舱窗与舷号
  b.windowRing(1, [x, 0, 0], 6, yTop - 9, 6, MAT.GLASS_WIN, { w: 2, h: 2, ring: MAT.HULL_DARK });
  // 两台轨道机动发动机
  for (const s of [1, -1]) {
    b.cone(1, s * 3.4, x, 2.6, 3.8, yBot - 5, yBot, MAT.NOZZLE, 1);
    b.disc(1, x, yBot - 4, s * 3.4, 3, 2, MAT.ENGINE_GLOW);
  }
  // 姿控喷口与货舱门
  b.radial(1, [x, 0, 0], 6, 4, (p, out) => {
    b.obb([p[0], yTop - 16, p[2]], [out[0], 0, out[2]], [0, 1, 0], [-out[2], 0, out[0]], [1.4, 1.6, 1.4], MAT.THRUSTER);
  }, Math.PI / 4);
  b.box(x - 4, yBot + 16, 5, x + 4, yTop - 16, 6, MAT.HULL_GREY);
  b.greeble([x - 8, yBot - 6, -20], [x + 8, yTop + 3, 20], 0.04,
    [MAT.HULL_DARK, MAT.TITANIUM, MAT.SOOT], { maxSize: 2, avoid: [MAT.GLASS_WIN, MAT.ENGINE_GLOW], seed: 91 });
  stencil(vol, 'TND-11', { axis: 2, plane: 6, u: x - 8, v: yBot + 26, mat: MAT.BLUE_ACCENT, scale: 1, depth: 3, dn: -1 });
}

/* ── 通信与测控阵 ───────────────────────────────────────── */
function buildComms(b) {
  const x = 52;
  for (const s of [1, -1]) {
    const y0 = s * 10, y1 = s * 28;
    // 桅杆与云台
    b.capsule([x, y0, 0], [x, y1, 0], 1.6, MAT.ANTENNA_ROD);
    b.obb([x, y1, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [3, 3, 3], MAT.HULL_DARK);
    b.cylinder(1, 0, x, 2.4, s > 0 ? y1 : y1 + 3, s > 0 ? y1 + 3 : y1, MAT.PORT_RING);
    // 高增益抛物面天线
    const yd = s * 34;
    b.dish(1, [x, yd, 0], 12, 5, 1.6, MAT.DISH_WHITE, s);
    // 副反射面与四支撑
    b.sphere(x, yd + s * 8, 0, 2, MAT.TITANIUM);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.79;
      b.capsule([x + Math.cos(a) * 9, yd + s * 2, Math.sin(a) * 9], [x, yd + s * 8, 0], 0.7, MAT.ANTENNA_ROD);
    }
    b.torus(1, x, yd + s * 0.5, 0, 12, 1.1, MAT.TITANIUM);
    b.sphere(x, yd + s * 3, 12, 1, MAT.LED_AMBER);
  }
  // 相控阵中继终端 + 激光通信头（±Z 侧）
  for (const s of [1, -1]) {
    b.obb([x, 0, s * 13], [1, 0, 0], [0, 1, 0], [0, 0, 1], [6, 6, 1.5],
      (xx, yy, zz) => ((xx + yy) % 4 < 2 ? MAT.HULL_DARK : MAT.CARBON));
    b.box(x - 6, -6, s * 14, x + 6, 6, s * 15, MAT.TITANIUM);
    b.sphere(x + 5, 5, s * 15, 1, MAT.LED_CYAN);
    b.capsule([x - 4, 0, s * 14], [x - 4, 0, s * 18], 1.4, MAT.HULL_DARK);
    b.sphere(x - 4, 0, s * 19, 1.4, MAT.LED_GREEN);
  }
  b.greeble([x - 8, -46, -20], [x + 8, 46, 20], 0.04,
    [MAT.HULL_DARK, MAT.TITANIUM, MAT.FOIL_SILVER], { maxSize: 2, avoid: [MAT.DISH_WHITE], seed: 101 });
}

/* ── 机械臂（基座 / 大臂 / 小臂） ───────────────────────── */
function buildArmBase(b) {
  const x = L.armX, y = L.coreR;
  b.obb([x, y + 2, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [6, 2.5, 7], MAT.HULL_GREY);
  b.cylinder(1, 0, x, 5, y + 4, y + 7, MAT.PORT_RING);           // 回转支承
  b.obb([x, y + 5, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [3, 2, 5], MAT.TITANIUM);
  b.sphere(x + 5, y + 3, 5, 1, MAT.LED_GREEN);
  b.sphere(x - 5, y + 3, -5, 1, MAT.LED_AMBER);
  // 电缆卷与控制盒
  b.obb([x - 6, y + 3, 4], [1, 0, 0], [0, 1, 0], [0, 0, 1], [2, 2, 2], MAT.HULL_DARK);
  b.capsule([x - 6, y + 4, 4], [x, y + 5, 2], 0.8, MAT.SEAL_BLACK);
}

function buildArmLink1(b) {
  const x = L.armX, y0 = L.coreR + 5;
  // 肩关节壳
  b.sphere(x, y0, 0, 4, MAT.TITANIUM);
  // 大臂：方管 + 加强肋 + 相机
  b.beam([x, y0 + 2, 0], [x, y0 + 30, 0], 2.6, MAT.CARBON);
  for (let y = y0 + 5; y < y0 + 29; y += 5) {
    b.cylinderRange(1, [x, 0, 0], 3.4, 2.4, y, y + 1, MAT.HULL_WHITE);
  }
  b.capsule([x, y0 + 3, 0], [x, y0 + 29, 0], 1, MAT.PIPE_STEEL, 'empty');
  b.obb([x + 3, y0 + 24, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [1.4, 2, 2], MAT.HULL_DARK);
  b.sphere(x + 4, y0 + 24, 0, 1, MAT.LED_CYAN);
  b.sphere(x, y0 + 30, 0, 3.4, MAT.TITANIUM);
}

function buildArmLink2(b) {
  const x = L.armX, y0 = 48;
  // 肘关节 + 小臂
  b.beam([x, y0 + 2, 0], [x, y0 + 20, 0], 2.1, MAT.CARBON);
  for (let y = y0 + 5; y < y0 + 19; y += 4) {
    b.cylinderRange(1, [x, 0, 0], 2.9, 2, y, y + 1, MAT.HULL_WHITE);
  }
  // 腕部三轴 + 末端执行器
  b.sphere(x, y0 + 21, 0, 3, MAT.TITANIUM);
  b.cylinder(1, 0, x, 2.6, y0 + 22, y0 + 25, MAT.PORT_RING);
  b.radial(1, [x, 0, 0], 2.6, 3, (p, out) => {
    b.capsule([p[0], y0 + 25, p[2]], [p[0] + out[0] * 2.4, y0 + 29, p[2] + out[2] * 2.4], 0.9, MAT.TITANIUM);
    b.sphere(Math.round(p[0] + out[0] * 2.4), y0 + 29, Math.round(p[2] + out[2] * 2.4), 1, MAT.HULL_DARK);
  });
  // 作业照明与视觉相机
  b.sphere(x + 3, y0 + 24, 0, 1.4, MAT.INNER_LIT);
  b.sphere(x - 3, y0 + 24, 0, 1.4, MAT.INNER_LIT);
  b.obb([x, y0 + 23, 3], [1, 0, 0], [0, 1, 0], [0, 0, 1], [1.4, 1.4, 1.2], MAT.HULL_DARK);
  b.sphere(x, y0 + 23, 4.4, 1, MAT.LED_CYAN);
}

/* ═══════════════════════ 建造程序注册表 ═══════════════════════ */

const BUILDERS = {
  core: buildCore,
  ring: buildRing,
  command: buildCommand,
  propulsion: buildPropulsion,
  'truss-a': buildTruss(+1),
  'truss-b': buildTruss(-1),
  'solar-a': buildSolar(+1),
  'solar-b': buildSolar(-1),
  'thermal-a': buildThermal(+1),
  'thermal-b': buildThermal(-1),
  'lab-a': buildLab(+1, MAT.LAB_TEAL, 'LAB-A'),
  'lab-b': buildLab(-1, MAT.BLUE_ACCENT, 'LAB-B'),
  dock: buildDock,
  hangar: buildHangar,
  shuttle: buildShuttle,
  comms: buildComms,
  'arm-base': buildArmBase,
  'arm-link1': buildArmLink1,
  'arm-link2': buildArmLink2,
};

export { BUILDERS };
