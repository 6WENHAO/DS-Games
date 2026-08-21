/**
 * 全局配色与尺度常量 —— 3D 场景与 UI 的唯一颜色来源。
 *
 * 配色遵循需求约定：刺突蛋白橙红、ACE2 青蓝、病毒 RNA 荧光绿、TMPRSS2 紫。
 * 其余分子在此基础上扩展，并遵循两条设计规则：
 *   1) 病毒来源的结构用暖色（橙/琥珀/粉），宿主来源的结构用冷色（蓝/青/灰紫），
 *      让“膜融合”这一刻的暖冷交融在画面上可读；
 *   2) 细胞器保持低饱和度，把高饱和与自发光留给当前步骤的关键分子。
 */

import type { MoleculeId } from '../data/types'

export const COLORS = {
  // —— 病毒（暖色系）——
  spike: '#ff6b3d',
  spikeDeep: '#c9401f',
  rbd: '#ffa62b',
  envelope: '#eda070',
  envelopeCore: '#7a4630',
  mProtein: '#f59e42',
  eProtein: '#ffe1a0',
  nProtein: '#ff7ab8',
  rna: '#39ff9e',
  rnaMinus: '#12b98a',
  sgRna: '#9dffd0',

  // —— 宿主（冷色系）——
  ace2: '#22d3ee',
  tmprss2: '#a855f7',
  furin: '#c084fc',
  cathepsin: '#8b5cf6',
  hostMembrane: '#7fa8d9',
  hostMembraneCore: '#2a4a6b',
  cytoplasm: '#0d2036',
  ribosome: '#cfd6e6',
  ribosomeSmall: '#9fb0c9',
  polyprotein: '#b7c4ff',
  rdrp: '#5b8cff',
  dmv: '#4a6fa5',
  er: '#5c7590',
  ergic: '#9c8fd6',
  golgi: '#7a6f9e',
  nucleus: '#2f4a6b',
  nucleusEnvelope: '#6b86a8',
  mitochondria: '#3f6b68',
  vesicle: '#86a4c9',

  // —— 场景与 UI ——
  bgDeep: '#03060d',
  bgMid: '#071120',
  fog: '#040a14',
  accent: '#4dd6ff',
  danger: '#ff5d6c',
  ok: '#39ff9e',
  textDim: '#8aa0bd',
} as const

/** 分子 id → 主色。UI 图例、标签、信息面板与 3D 材质共用，保证颜色语义一致。 */
export const MOLECULE_COLOR: Record<MoleculeId, string> = {
  spike: COLORS.spike,
  rbd: COLORS.rbd,
  envelope: COLORS.envelope,
  'm-protein': COLORS.mProtein,
  'e-protein': COLORS.eProtein,
  'n-protein': COLORS.nProtein,
  'viral-rna': COLORS.rna,
  'host-membrane': COLORS.hostMembrane,
  ace2: COLORS.ace2,
  tmprss2: COLORS.tmprss2,
  furin: COLORS.furin,
  'cathepsin-l': COLORS.cathepsin,
  endosome: COLORS.vesicle,
  'fusion-pore': COLORS.accent,
  ribosome: COLORS.ribosome,
  pp1ab: COLORS.polyprotein,
  'nsp12-rdrp': COLORS.rdrp,
  'minus-rna': COLORS.rnaMinus,
  sgrna: COLORS.sgRna,
  dmv: COLORS.dmv,
  er: COLORS.er,
  ergic: COLORS.ergic,
  golgi: COLORS.golgi,
  nucleus: COLORS.nucleusEnvelope,
  'secretory-vesicle': COLORS.vesicle,
  'progeny-virion': COLORS.spike,
}

/**
 * 尺度约定：1 世界单位 = 50 nm。
 *
 * 真实尺寸与画面尺寸的换算集中在这里，便于在文档中说明“哪些地方被刻意放大了”。
 * 详见 docs/SCIENCE.md 的“可视化取舍”一节。
 */
export const NM = 1 / 50

/**
 * 膜结构的统一夸张系数。
 *
 * 真实脂双层只有约 5 nm 厚、磷脂头部直径约 0.8 nm；若严格按比例绘制，
 * 在能看清整个病毒体的镜头下磷脂头部不足一个像素。因此所有“膜类”厚度与
 * 磷脂尺寸统一放大 2 倍，且**头部直径与膜厚的比例（约 1:6）保持不变**，
 * 保证画面仍能正确传达“双分子层”的结构关系。此取舍已在 docs/SCIENCE.md 中说明。
 */
export const MEMBRANE_EXAGGERATION = 2

export const SCALE = {
  /** 病毒体囊膜外半径：约 45 nm（真实病毒体直径 60–140 nm，取中位） */
  virionRadius: 45 * NM,
  /** 刺突三聚体总高：约 25 nm */
  spikeHeight: 25 * NM,
  /** 每个病毒体的刺突三聚体数量（冷冻电镜统计约 24–40） */
  spikeCount: 30,
  /** 脂双层厚度：真实约 5 nm，画面放大 2 倍 */
  bilayer: 5 * NM * MEMBRANE_EXAGGERATION,
  /** 单层（leaflet）厚度 */
  leaflet: 2.5 * NM * MEMBRANE_EXAGGERATION,
  /** 磷脂头部半径：真实约 0.4 nm，同比放大 2 倍 */
  lipidHead: 0.4 * NM * MEMBRANE_EXAGGERATION,
  /** ACE2 胞外区总高：约 15 nm（肽酶结构域 + 颈部结构域） */
  ace2Height: 15 * NM,
  /** TMPRSS2 胞外区总高：约 13 nm */
  tmprss2Height: 13 * NM,
  /** 80S 核糖体直径：约 25 nm */
  ribosome: 25 * NM,
  /** 双膜囊泡 DMV 直径：约 200 nm（真实 200–350 nm） */
  dmv: 200 * NM,
  /** 展示用细胞膜方形膜片边长：约 2 µm */
  membranePatch: 2000 * NM,
} as const
