/**
 * 内容数据层的类型契约。
 *
 * 这一层只负责“科学叙事文本”，不含任何三维坐标 / 相机 / 动画参数；
 * 视觉与编排参数在 src/scene/choreography.ts 中定义，两者通过 id 关联。
 */

/** 场景中可被点击、可在图例与信息面板中引用的分子 / 结构 id。 */
export type MoleculeId =
  // —— 病毒结构 ——
  | 'spike'
  | 'rbd'
  | 'envelope'
  | 'm-protein'
  | 'e-protein'
  | 'n-protein'
  | 'viral-rna'
  // —— 宿主细胞表面 ——
  | 'host-membrane'
  | 'ace2'
  | 'tmprss2'
  | 'furin'
  | 'cathepsin-l'
  | 'endosome'
  | 'fusion-pore'
  // —— 胞内复制机器 ——
  | 'ribosome'
  | 'pp1ab'
  | 'nsp12-rdrp'
  | 'minus-rna'
  | 'sgrna'
  | 'dmv'
  // —— 细胞器与出胞 ——
  | 'er'
  | 'ergic'
  | 'golgi'
  | 'nucleus'
  | 'secretory-vesicle'
  | 'progeny-virion'

export const MOLECULE_IDS = [
  'spike',
  'rbd',
  'envelope',
  'm-protein',
  'e-protein',
  'n-protein',
  'viral-rna',
  'host-membrane',
  'ace2',
  'tmprss2',
  'furin',
  'cathepsin-l',
  'endosome',
  'fusion-pore',
  'ribosome',
  'pp1ab',
  'nsp12-rdrp',
  'minus-rna',
  'sgrna',
  'dmv',
  'er',
  'ergic',
  'golgi',
  'nucleus',
  'secretory-vesicle',
  'progeny-virion',
] as const satisfies readonly MoleculeId[]

export type MoleculeCategory =
  | 'viral-structure'
  | 'viral-genome'
  | 'viral-enzyme'
  | 'host-receptor'
  | 'host-protease'
  | 'host-machinery'
  | 'host-organelle'
  | 'process'

/** 分子 / 结构词条。颜色不在此处定义，由 src/three/palette.ts 按 id 提供，保证 3D 与 UI 同源。 */
export interface Molecule {
  id: MoleculeId
  /** 中文名 */
  name: string
  /** 英文名 */
  nameEn: string
  /** 常用缩写，如 “S 蛋白”“RdRp”，没有则省略 */
  abbr?: string
  category: MoleculeCategory
  /** 归属：病毒的 / 宿主的 */
  origin: 'virus' | 'host'
  /** 一句话定位，不超过 26 个汉字 */
  tagline: string
  /** 功能说明，2–3 句，面向高中生以上非专业读者 */
  role: string
  /** 深入阅读段落，2–4 段，可含机制细节与数字 */
  detail: string[]
  /** 关键参数表，2–5 条 */
  facts?: { label: string; value: string }[]
  /** 出现在哪些步骤（1–8） */
  appearsIn: number[]
}

/** 8 个演示步骤的叙事内容。时长用于自动播放节奏。 */
export interface InfectionStep {
  id: string
  /** 1–8 */
  index: number
  /** 步骤标题，4–10 个汉字 */
  title: string
  /** 英文标题，用于时间轴副标签 */
  titleEn: string
  /** 副标题 / 一句话概括，不超过 24 个汉字 */
  subtitle: string
  /** 1x 速度下的播放时长（秒），建议 14–24 */
  durationSec: number
  /** 解说词，2–4 句，客观、准确、有画面感 */
  narration: string
  /** 要点，3–4 条，每条不超过 34 个汉字 */
  bullets: string[]
  /** 本步骤高亮的分子，2–5 个，按重要性排序 */
  keyMolecules: MoleculeId[]
  /** 可展开的深入阅读 */
  deepRead: { heading: string; body: string }[]
  /** 常见误区纠正（可选） */
  misconception?: { wrong: string; right: string }
}

export interface GlossaryEntry {
  term: string
  termEn: string
  definition: string
  /** 关联的分子 id，便于点击跳转 */
  related?: MoleculeId[]
}

export interface Reference {
  /** 引用短标签，如 “Hoffmann 2020” */
  label: string
  /** 完整引文：作者. 标题. 期刊 年份;卷(期):页. */
  citation: string
}
