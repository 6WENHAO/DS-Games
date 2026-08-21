/**
 * 宿主细胞表面分子几何：ACE2 受体、TMPRSS2 蛋白酶、磷脂分子、核孔。
 *
 * 结构依据：
 *  - ACE2 是 I 型跨膜蛋白：胞外由 N 端的**肽酶结构域（PD）**与 C 端的**颈部结构域**组成，
 *    PD 由两个亚结构域夹成一条“钳口”，SARS-CoV-2 的 RBD 结合在 PD 顶端的 α1 螺旋一侧；
 *  - TMPRSS2 是 II 型跨膜丝氨酸蛋白酶：N 端在胞内，胞外依次是 LDLRA、SRCR 与
 *    C 端的**丝氨酸蛋白酶催化结构域**，催化三联体（His296/Asp345/Ser441）位于顶端的裂隙中；
 *  - 磷脂分子 = 亲水头部 + 两条疏水脂肪酸尾，两层尾对尾排列构成双分子层。
 */

import { type BufferGeometry, CapsuleGeometry, CylinderGeometry, TorusGeometry, Vector3 } from 'three'
import { COLORS, SCALE } from '../palette'
import { cachedGeometry, colorize, displaceByNoise, ensureAttributes, mergeAll, smoothSphere, transformGeometry } from './helpers'

function lobe(radius: number, detail: number, seed: number, color: string, squash = 1): BufferGeometry {
  const g = smoothSphere(radius, detail)
  displaceByNoise(g, { amplitude: radius * 0.16, frequency: 3.0 / radius, seed, octaves: 2 })
  ensureAttributes(g, color)
  if (squash !== 1) transformGeometry(g, { scale: [1, squash, 1] })
  return g
}

/** ACE2 各部分的高度（世界单位，膜面 y=0，+Y 为胞外）。 */
export const ACE2_LAYOUT = {
  tmBottom: -SCALE.bilayer * 0.75,
  neckTop: 0.13,
  pdCenterY: 0.215,
  totalHeight: SCALE.ace2Height, // 0.30
  /** RBD 停靠点：PD 顶端偏一侧 */
  bindingPoint: new Vector3(0.036, 0.288, 0.004),
} as const

/** ACE2 单体（含跨膜段）。+Y 朝胞外，原点在膜面。 */
export function buildAce2Geometry(detail = 2): BufferGeometry {
  return cachedGeometry(`ace2|${detail}`, () => {
    const L = ACE2_LAYOUT
    const parts: BufferGeometry[] = []

    // 跨膜螺旋
    const tm = new CylinderGeometry(0.016, 0.014, Math.abs(L.tmBottom) + 0.02, 8, 1, false)
    colorize(tm, COLORS.ace2)
    transformGeometry(tm, { pos: [0, L.tmBottom / 2, 0] })
    parts.push(tm)

    // 颈部结构域（collectrin-like）：细长、略弯
    const neck = new CapsuleGeometry(0.024, 0.1, 3, detail >= 2 ? 10 : 6)
    colorize(neck, COLORS.ace2)
    transformGeometry(neck, { pos: [0.004, 0.068, 0], rot: [0, 0, -0.06] })
    parts.push(neck)

    // 肽酶结构域：两个亚结构域夹出一条钳口
    const sub1 = lobe(0.052, detail, 101, COLORS.ace2, 0.92)
    transformGeometry(sub1, { pos: [0.022, L.pdCenterY + 0.012, 0.002], scale: [1.06, 1.12, 0.96] })
    parts.push(sub1)

    const sub2 = lobe(0.038, detail, 113, COLORS.ace2, 0.9)
    transformGeometry(sub2, { pos: [-0.034, L.pdCenterY - 0.004, -0.006], scale: [0.96, 1.04, 0.92] })
    parts.push(sub2)

    // 顶端 α1 螺旋（RBD 的主要结合界面），用略亮的一段表示
    const alpha1 = new CapsuleGeometry(0.014, 0.062, 3, 8)
    colorize(alpha1, '#7ceaff')
    transformGeometry(alpha1, { pos: [0.03, 0.276, 0.006], rot: [0.18, 0, 1.22] })
    parts.push(alpha1)

    return mergeAll(parts)
  })
}

export const TMPRSS2_LAYOUT = {
  tmBottom: -SCALE.bilayer * 0.75,
  totalHeight: SCALE.tmprss2Height, // 0.26
  /** 催化裂隙位置（切割 S2′ 的地方） */
  activeSite: new Vector3(0.034, 0.232, 0.012),
} as const

/** TMPRSS2（II 型跨膜丝氨酸蛋白酶）。 */
export function buildTmprss2Geometry(detail = 2): BufferGeometry {
  return cachedGeometry(`tmprss2|${detail}`, () => {
    const parts: BufferGeometry[] = []

    const tm = new CylinderGeometry(0.014, 0.012, Math.abs(TMPRSS2_LAYOUT.tmBottom) + 0.02, 8, 1, false)
    colorize(tm, COLORS.tmprss2)
    transformGeometry(tm, { pos: [0, TMPRSS2_LAYOUT.tmBottom / 2, 0] })
    parts.push(tm)

    // LDLRA 结构域
    const ldlra = lobe(0.026, Math.max(1, detail - 1), 121, COLORS.tmprss2)
    transformGeometry(ldlra, { pos: [0, 0.055, 0] })
    parts.push(ldlra)

    // SRCR 结构域
    const srcr = lobe(0.033, detail, 131, COLORS.tmprss2)
    transformGeometry(srcr, { pos: [-0.008, 0.118, 0.004], scale: [1, 1.1, 1] })
    parts.push(srcr)

    // 丝氨酸蛋白酶催化结构域：两瓣夹出催化裂隙
    const cat1 = lobe(0.042, detail, 141, COLORS.tmprss2)
    transformGeometry(cat1, { pos: [0.014, 0.198, -0.014], scale: [1.05, 1, 1] })
    parts.push(cat1)
    const cat2 = lobe(0.03, detail, 151, COLORS.tmprss2)
    transformGeometry(cat2, { pos: [-0.006, 0.216, 0.03] })
    parts.push(cat2)

    // 催化三联体标记（Ser441 一侧），略亮
    const ser = lobe(0.011, 1, 161, '#e9c8ff')
    transformGeometry(ser, { pos: [0.034, 0.232, 0.012] })
    parts.push(ser)

    return mergeAll(parts)
  })
}

/**
 * TMPRSS2 拆成两部分，便于表现“柔性茎把催化结构域送到 S2′ 位点”这一动作：
 *   anchor    —— 跨膜段 + LDLRA + SRCR（固定在膜上）
 *   catalytic —— 丝氨酸蛋白酶催化结构域（可动，含催化三联体标记）
 */
export function buildTmprss2AnchorGeometry(detail = 2): BufferGeometry {
  return cachedGeometry(`tmprss2-anchor|${detail}`, () => {
    const parts: BufferGeometry[] = []
    const tm = new CylinderGeometry(0.014, 0.012, Math.abs(TMPRSS2_LAYOUT.tmBottom) + 0.02, 8, 1, false)
    colorize(tm, COLORS.tmprss2)
    transformGeometry(tm, { pos: [0, TMPRSS2_LAYOUT.tmBottom / 2, 0] })
    parts.push(tm)
    const ldlra = lobe(0.026, Math.max(1, detail - 1), 121, COLORS.tmprss2)
    transformGeometry(ldlra, { pos: [0, 0.055, 0] })
    parts.push(ldlra)
    const srcr = lobe(0.033, detail, 131, COLORS.tmprss2)
    transformGeometry(srcr, { pos: [-0.008, 0.118, 0.004], scale: [1, 1.1, 1] })
    parts.push(srcr)
    return mergeAll(parts)
  })
}

/** 催化结构域：原点位于结构域中心，催化三联体（Ser441 一侧）朝 +X/+Y。 */
export function buildTmprss2CatalyticGeometry(detail = 2): BufferGeometry {
  return cachedGeometry(`tmprss2-catalytic|${detail}`, () => {
    const parts: BufferGeometry[] = []
    const cat1 = lobe(0.042, detail, 141, COLORS.tmprss2)
    transformGeometry(cat1, { pos: [0, -0.006, -0.014], scale: [1.05, 1, 1] })
    parts.push(cat1)
    const cat2 = lobe(0.03, detail, 151, COLORS.tmprss2)
    transformGeometry(cat2, { pos: [-0.02, 0.014, 0.03] })
    parts.push(cat2)
    const ser = lobe(0.011, 1, 161, '#e9c8ff')
    transformGeometry(ser, { pos: [0.02, 0.03, 0.012] })
    parts.push(ser)
    return mergeAll(parts)
  })
}

/** 催化结构域中心相对 TMPRSS2 锚点的静止位置。 */
export const TMPRSS2_CATALYTIC_REST = new Vector3(0.014, 0.204, 0)

/** 弗林蛋白酶（furin）：在“生产细胞”中预切割 S1/S2，用作第 1、4 步的说明性分子。 */
export function buildFurinGeometry(detail = 2): BufferGeometry {
  return cachedGeometry(`furin|${detail}`, () => {
    const parts: BufferGeometry[] = []
    const main = lobe(0.05, detail, 171, COLORS.furin)
    transformGeometry(main, { scale: [1.1, 0.9, 1] })
    parts.push(main)
    const lid = lobe(0.03, Math.max(1, detail - 1), 181, COLORS.furin)
    transformGeometry(lid, { pos: [0.028, 0.042, 0.01] })
    parts.push(lid)
    return mergeAll(parts)
  })
}

/** 组织蛋白酶 L（cathepsin L）：内体途径中的替代激活蛋白酶。 */
export function buildCathepsinGeometry(detail = 1): BufferGeometry {
  return cachedGeometry(`cathepsin|${detail}`, () => {
    const parts: BufferGeometry[] = []
    const a = lobe(0.036, detail, 191, COLORS.cathepsin)
    parts.push(a)
    const b = lobe(0.026, detail, 201, COLORS.cathepsin)
    transformGeometry(b, { pos: [0.03, 0.024, 0.008] })
    parts.push(b)
    return mergeAll(parts)
  })
}

/**
 * 单个磷脂分子：头部球 + 两条尾链。
 * 用顶点色区分亲水头部（亮）与疏水尾部（暗），一次实例化即可画出整片双分子层特写。
 */
export function buildLipidGeometry(headColor: string, tailColor: string, detail = 1): BufferGeometry {
  return cachedGeometry(`lipid|${headColor}|${tailColor}|${detail}`, () => {
    const r = SCALE.lipidHead
    const tailLen = SCALE.leaflet * 0.62
    const parts: BufferGeometry[] = []
    const head = smoothSphere(r, detail)
    ensureAttributes(head, headColor)
    parts.push(head)
    for (let k = 0; k < 2; k++) {
      const t = new CapsuleGeometry(r * 0.3, tailLen, 2, 5)
      colorize(t, tailColor)
      transformGeometry(t, {
        pos: [(k - 0.5) * r * 0.85, -(tailLen / 2 + r * 0.55), 0],
        rot: [0, 0, (k - 0.5) * 0.22],
      })
      parts.push(t)
    }
    return mergeAll(parts)
  })
}

/** 胆固醇分子：让膜的成分不只有磷脂（真实质膜含大量胆固醇）。 */
export function buildCholesterolGeometry(detail = 1): BufferGeometry {
  return cachedGeometry(`cholesterol|${detail}`, () => {
    const g = new CapsuleGeometry(SCALE.lipidHead * 0.62, SCALE.leaflet * 0.5, 2, 6)
    transformGeometry(g, { pos: [0, -SCALE.leaflet * 0.28, 0] })
    return colorize(g, '#f0e6c8')
  })
}

/** 核孔复合体：环形，用于细胞核表面（强调“病毒 RNA 不经此进入核内”）。 */
export function buildNuclearPoreGeometry(detail = 1): BufferGeometry {
  return cachedGeometry(`nuclear-pore|${detail}`, () => {
    const parts: BufferGeometry[] = []
    const ring = new TorusGeometry(0.11, 0.028, 6, detail >= 2 ? 18 : 12)
    colorize(ring, COLORS.nucleusEnvelope)
    transformGeometry(ring, { rot: [Math.PI / 2, 0, 0] })
    parts.push(ring)
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI * 2) / 8
      const stud = new CapsuleGeometry(0.016, 0.02, 2, 5)
      colorize(stud, COLORS.nucleusEnvelope)
      transformGeometry(stud, { pos: [Math.cos(a) * 0.11, 0.024, Math.sin(a) * 0.11] })
      parts.push(stud)
    }
    return mergeAll(parts)
  })
}

/** 融合孔的高亮环：膜融合完成瞬间的视觉锚点。 */
export function buildPoreRingGeometry(radius: number, thickness: number): BufferGeometry {
  return cachedGeometry(`pore-ring|${radius.toFixed(3)}|${thickness.toFixed(3)}`, () => {
    const g = new TorusGeometry(radius, thickness, 8, 48)
    transformGeometry(g, { rot: [Math.PI / 2, 0, 0] })
    return ensureAttributes(g, COLORS.accent)
  })
}
