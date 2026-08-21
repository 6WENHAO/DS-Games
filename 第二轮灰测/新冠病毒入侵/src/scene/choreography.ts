/**
 * 编排层：世界锚点坐标 + 时间分段 + 相机机位。
 *
 * 这是“导演台本”：所有空间与时间常数集中在这里，场景组件只负责根据播放头
 * 读取这些常数并渲染，互不耦合。修改剧情节奏只需要改这一份文件。
 *
 * 坐标约定（1 世界单位 = 50 nm）：
 *   · 细胞质膜位于 y ≈ 0 的水平面，融合位点严格在 (0, 0, 0)；
 *   · y > 0 为**胞外**（病毒来自这里），y < 0 为**细胞质**（复制发生在这里）；
 *   · 细胞核位于画面深处的下方，全程可见，用于强调“病毒 RNA 从不进入细胞核”。
 */

import { Vector3 } from 'three'
import { envelopeRadiusAt } from '../three/geometry/virion'
import { SCALE } from '../three/palette'

/** 病毒体“南极”处的囊膜实际半径（囊膜有噪声位移，主角刺突必须精确长在这一点上）。 */
export const VIRION_BOTTOM_R = envelopeRadiusAt(new Vector3(0, -1, 0), SCALE.virionRadius, 3)

/**
 * 主角刺突基座到膜面的高度。
 * 由结合几何反推：抬起后的 RBD 中心位于刺突局部坐标 (0.0904, 0.4501)，
 * 要让它正好落在 ACE2 结合位点 y=0.288 上，基座就必须在 0.288 + 0.4501 ≈ 0.738。
 */
export const HERO_SPIKE_BASE_Y = 0.7381

/** 抬起后的 RBD 中心在刺突局部坐标系中的横向偏移（用于对齐 ACE2 位置）。 */
export const RBD_BOUND_OFFSET_X = 0.0904

/** 世界锚点。 */
export const WORLD = {
  /** 展示用膜片边长（≈1.5 µm） */
  membraneSize: 30,
  /** 融合位点（病毒进入） */
  fusion: new Vector3(0, 0, 0),
  /** 胞吐位点（子代病毒释放），与进入位点相距约 120 nm */
  exo: new Vector3(2.35, 0, -1.15),

  /** 第 1 步：病毒体独立展示的位置（远离细胞膜，深空背景） */
  virionFar: new Vector3(0, 7.2, 0),
  /** 第 2 步末：悬停在受体上方 */
  virionHover: new Vector3(0.02, 2.34, 0.04),
  /** 第 3 步：RBD 触及 ACE2 时的病毒中心高度（= 南极囊膜半径 + 刺突基座高度） */
  virionDock: new Vector3(0, VIRION_BOTTOM_R + HERO_SPIKE_BASE_Y, 0),
  /** 第 4 步：半融合时病毒被拉向细胞膜（此高度与膜隆起量互补，正好在此刻两膜相接） */
  virionFused: new Vector3(0, 1.12, 0),

  /** 主角 ACE2：让它的结合位点（+0.036, +0.288）正好接住抬起后的 RBD */
  heroAce2: new Vector3(RBD_BOUND_OFFSET_X - 0.036, 0, -0.004),
  /** 主角 TMPRSS2：紧邻 ACE2（真实细胞中两者常在同一膜微区共定位） */
  heroTmprss2: new Vector3(0.32, 0, 0.2),

  /** 核衣壳进入细胞质后的停留点 */
  rnpCytoplasm: new Vector3(0.6, -1.35, 0.3),
  /** 脱衣壳后 RNA 伸展的区域中心 */
  rnaZone: new Vector3(2.0, -2.5, 0.9),
  /** 多聚核糖体（polysome）翻译区 */
  translationZone: new Vector3(2.2, -2.9, 1.0),
  /** 双膜囊泡（复制细胞器）：与翻译区保持约 5 个单位，便于一个镜头里同时交代两件事 */
  dmv: new Vector3(-2.4, -3.9, -1.2),
  /** 内质网中心 */
  er: new Vector3(-0.6, -5.5, -0.9),
  /** ERGIC（装配位点） */
  ergic: new Vector3(3.9, -5.0, -2.0),
  /** 高尔基体 */
  golgi: new Vector3(6.1, -6.3, -2.9),
  /** 细胞核（全程可见的“禁区”） */
  nucleus: new Vector3(-1.6, -12.3, -1.4),
  nucleusRadius: 6.2,
  /** 线粒体（布景） */
  mitochondria: [new Vector3(-5.2, -2.6, 2.6), new Vector3(4.6, -2.2, 3.4)] as const,
} as const

/** DMV 半径（外膜）。 */
export const DMV_RADIUS = SCALE.dmv / 2

/**
 * 时间分段（p 空间，p = 0 基步骤号 + 步内进度）。
 * 允许跨越步骤边界 —— 例如融合孔在第 4 步末打开、第 5 步初继续扩大，
 * 这样即使观众直接跳到第 5 步，画面状态依然自洽。
 */
export const SEG = {
  // —— 第 1 步：结构总览 ——
  /** 结构标签依次浮现 */
  labelsIn: [0.06, 0.5] as const,
  /** 剖切展示内部核衣壳（囊膜透明度提高） */
  cutaway: [0.42, 0.95] as const,

  // —— 第 2 步：接近与附着 ——
  approach: [1.02, 1.78] as const,
  hover: [1.78, 2.06] as const,

  // —— 第 3 步：受体结合 ——
  rbdUp: [2.04, 2.42] as const,
  dock: [2.3, 2.72] as const,
  bindFlash: [2.62, 2.9] as const,
  /** 更多刺突陆续结合邻近 ACE2 */
  multiBind: [2.8, 3.1] as const,

  // —— 第 4 步：切割与膜融合 ——
  // 顺序严格遵循“鱼叉模型”：先切割 → S1 脱落 → S2 伸出前发夹中间体插膜 →
  // 折叠成六螺旋束把两膜拉近 → 半融合 → 融合孔。病毒体只有在 S1 脱落后才可能贴近细胞膜，
  // 因此 membranePull 必须晚于 fpInsert。
  tmprss2Move: [3.06, 3.3] as const,
  cleave: [3.3, 3.44] as const,
  fpInsert: [3.42, 3.64] as const,
  zipper: [3.6, 3.86] as const,
  membranePull: [3.56, 3.9] as const,
  hemifusion: [3.84, 3.94] as const,
  poreOpen: [3.92, 4.14] as const,
  envelopeMerge: [3.96, 4.32] as const,

  // —— 第 5 步：基因组释放 ——
  rnpEnter: [4.12, 4.5] as const,
  poreClose: [4.46, 4.78] as const,
  uncoat: [4.48, 4.88] as const,
  nucleusWarning: [4.6, 5.0] as const,

  // —— 第 6 步：翻译与复制 ——
  ribosomeBind: [5.04, 5.32] as const,
  translate: [5.18, 5.62] as const,
  polyproteinCut: [5.52, 5.72] as const,
  rtcAssemble: [5.62, 5.84] as const,
  minusStrand: [5.74, 5.9] as const,
  plusStrand: [5.86, 6.02] as const,
  sgRna: [5.9, 6.06] as const,

  // —— 第 7 步：ERGIC 装配 ——
  structuralSynth: [6.04, 6.36] as const,
  toErgic: [6.24, 6.54] as const,
  mLattice: [6.4, 6.66] as const,
  budIn: [6.56, 6.9] as const,
  virionComplete: [6.86, 7.06] as const,

  // —— 第 8 步：胞吐释放 ——
  vesicleLoad: [7.02, 7.24] as const,
  vesicleTravel: [7.2, 7.58] as const,
  exoFuse: [7.54, 7.76] as const,
  release: [7.7, 7.94] as const,
  wideShot: [7.72, 8.0] as const,
} as const

export interface CameraKey {
  target: [number, number, number]
  /** 方位角（弧度，绕 +Y 轴） */
  azimuth: number
  /** 极角（弧度，自 +Y 轴起算；> π/2 表示位于膜平面之下） */
  polar: number
  radius: number
  fov: number
}

export interface StepCamera {
  from: CameraKey
  /** 步内缓慢推移的终点机位（可选），营造电影级运镜 */
  to?: CameraKey
}

/** 8 步机位。每步都带一点缓慢推移，配合自动旋转形成持续运动感。 */
export const STEP_CAMERAS: StepCamera[] = [
  // 1 病毒整体结构：贴近病毒体缓慢环绕
  {
    from: { target: [0, 7.2, 0], azimuth: 0.85, polar: 1.3, radius: 3.5, fov: 38 },
    to: { target: [0, 7.2, 0], azimuth: 1.5, polar: 1.16, radius: 2.95, fov: 38 },
  },
  // 2 接近与附着：拉开，同时看到病毒与铺满受体的细胞膜
  {
    from: { target: [0, 5.0, 0], azimuth: 0.8, polar: 1.12, radius: 8.6, fov: 44 },
    to: { target: [0, 1.9, 0], azimuth: 1.02, polar: 1.3, radius: 4.4, fov: 42 },
  },
  // 3 受体结合：特写 RBD–ACE2 界面
  {
    from: { target: [0.02, 0.78, 0], azimuth: 0.72, polar: 1.36, radius: 2.35, fov: 34 },
    to: { target: [0.02, 0.5, 0], azimuth: 0.42, polar: 1.44, radius: 1.75, fov: 34 },
  },
  // 4 切割与膜融合：贴着膜面看融合孔打开
  {
    from: { target: [0.12, 0.4, 0.04], azimuth: 0.5, polar: 1.46, radius: 1.95, fov: 36 },
    to: { target: [0.06, 0.16, 0.02], azimuth: 0.06, polar: 1.55, radius: 2.3, fov: 38 },
  },
  // 5 基因组释放：镜头下潜到细胞质，从内侧仰望融合孔（构图经截图核对，让核衣壳占足画面）
  {
    from: { target: [0.4, -0.85, 0.22], azimuth: 0.7, polar: 1.72, radius: 2.8, fov: 40 },
    to: { target: [0.62, -1.5, 0.32], azimuth: 1.12, polar: 1.58, radius: 4.2, fov: 42 },
  },
  // 6 翻译与复制：以多聚核糖体为主体，DMV 留在画面一侧
  {
    from: { target: [1.7, -2.6, 0.85], azimuth: 1.08, polar: 1.46, radius: 3.9, fov: 42 },
    to: { target: [0.2, -3.2, 0.15], azimuth: 1.56, polar: 1.4, radius: 6.4, fov: 45 },
  },
  // 7 ERGIC 装配：贴近装配腔
  {
    from: { target: [3.4, -4.7, -1.7], azimuth: 0.72, polar: 1.3, radius: 5.2, fov: 40 },
    to: { target: [3.95, -5.0, -2.05], azimuth: 0.3, polar: 1.44, radius: 3.4, fov: 38 },
  },
  // 8 胞吐释放：跟随囊泡上行，最后适度拉远收尾（拉远幅度与子代散开距离都按截图核对过）
  {
    from: { target: [3.1, -2.6, -1.6], azimuth: 0.66, polar: 1.36, radius: 4.6, fov: 42 },
    to: { target: [2.0, 0.6, -0.9], azimuth: 1.28, polar: 1.2, radius: 8.4, fov: 46 },
  },
]

/** 步骤中被“高亮”的分子（用于自发光增强与图例联动）；与数据层的 keyMolecules 互补。 */
export const CAMERA_TRANSITION_SEC = 1.35

/** 相机极角限制，防止翻转到膜的另一侧看到穿模。 */
export const POLAR_LIMITS: [number, number] = [0.16, 2.98]
/** 缩放范围（世界单位） */
export const RADIUS_LIMITS: [number, number] = [0.9, 34]
