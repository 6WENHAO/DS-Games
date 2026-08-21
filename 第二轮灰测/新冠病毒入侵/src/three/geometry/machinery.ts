/**
 * 胞内复制机器的几何：80S 核糖体、多聚蛋白与 nsp、RdRp 复制转录复合体、双膜囊泡 DMV。
 *
 * 结构依据：
 *  - 80S 核糖体由 60S 大亚基与 40S 小亚基组成，直径约 25–30 nm，mRNA 从两亚基之间的
 *    通道穿过，新生肽链从大亚基的出口通道挤出；
 *  - ORF1a/ORF1ab 先翻译成多聚蛋白 pp1a/pp1ab，再由 PLpro(nsp3) 与 3CLpro/Mpro(nsp5)
 *    切成 16 个非结构蛋白；
 *  - 复制核心是 nsp12（RdRp）+ nsp7 + nsp8（“右手”构型的聚合酶，配以两个 nsp8 的
 *    “滑动夹”延伸臂），与 nsp13 解旋酶、nsp14 校对外切酶等共同组成 RTC；
 *  - 复制发生在 nsp3/nsp4/nsp6 诱导形成的双膜囊泡（DMV，直径约 200–350 nm）内，
 *    DMV 膜上有跨双膜的分子孔道，新合成的 RNA 由此输出到细胞质。
 */

import { type BufferGeometry, CapsuleGeometry, CylinderGeometry, TorusGeometry } from 'three'
import { COLORS, SCALE } from '../palette'
import { mulberry32 } from '../rand'
import {
  cachedGeometry,
  colorize,
  displaceByNoise,
  ensureAttributes,
  mergeAll,
  smoothSphere,
  sphericalUV,
  transformGeometry,
} from './helpers'

function blob(radius: number, detail: number, seed: number, color: string, amp = 0.17): BufferGeometry {
  const g = smoothSphere(radius, detail)
  displaceByNoise(g, { amplitude: radius * amp, frequency: 2.8 / radius, seed, octaves: 3 })
  return ensureAttributes(g, color)
}

/** 通用蛋白质团块（nsp、结构蛋白等）。 */
export function buildProteinBlobGeometry(radius: number, color: string, seed = 1, detail = 2): BufferGeometry {
  return cachedGeometry(`blob|${radius.toFixed(3)}|${color}|${seed}|${detail}`, () => blob(radius, detail, seed, color))
}

/** 80S 核糖体：大小亚基 + 中央突起 + mRNA 通道间隙。 */
export function buildRibosomeGeometry(detail = 2): BufferGeometry {
  return cachedGeometry(`ribosome|${detail}`, () => {
    const R = SCALE.ribosome // 0.5
    const parts: BufferGeometry[] = []

    // 60S 大亚基
    const large = blob(R * 0.34, detail, 211, COLORS.ribosome, 0.2)
    transformGeometry(large, { pos: [0, -R * 0.08, 0], scale: [1.08, 0.94, 1] })
    parts.push(large)

    // 中央突起与 L1 柄
    const protub = blob(R * 0.13, Math.max(1, detail - 1), 221, COLORS.ribosome, 0.24)
    transformGeometry(protub, { pos: [-R * 0.06, R * 0.16, R * 0.1] })
    parts.push(protub)
    const stalk = new CapsuleGeometry(R * 0.05, R * 0.14, 2, 6)
    colorize(stalk, COLORS.ribosome)
    transformGeometry(stalk, { pos: [R * 0.26, R * 0.06, -R * 0.12], rot: [0.3, 0, -0.5] })
    parts.push(stalk)

    // 40S 小亚基（含 head / body，留出 mRNA 通道）
    const small = blob(R * 0.24, detail, 231, COLORS.ribosomeSmall, 0.22)
    transformGeometry(small, { pos: [R * 0.02, R * 0.3, -R * 0.02], scale: [1, 0.92, 0.88] })
    parts.push(small)
    const beak = blob(R * 0.1, Math.max(1, detail - 1), 241, COLORS.ribosomeSmall, 0.26)
    transformGeometry(beak, { pos: [R * 0.2, R * 0.4, R * 0.04] })
    parts.push(beak)

    return mergeAll(parts)
  })
}

/** RdRp 复制转录复合体核心：nsp12 的“右手”+ nsp7/nsp8 辅因子。 */
export function buildRtcGeometry(detail = 2): BufferGeometry {
  return cachedGeometry(`rtc|${detail}`, () => {
    const parts: BufferGeometry[] = []
    // nsp12 palm
    const palm = blob(0.088, detail, 251, COLORS.rdrp, 0.16)
    transformGeometry(palm, { scale: [1.15, 0.9, 1] })
    parts.push(palm)
    // fingers
    const fingers = blob(0.055, detail, 261, COLORS.rdrp, 0.2)
    transformGeometry(fingers, { pos: [0.07, 0.05, 0.02], scale: [0.9, 1.15, 0.9] })
    parts.push(fingers)
    // thumb
    const thumb = blob(0.046, detail, 271, COLORS.rdrp, 0.2)
    transformGeometry(thumb, { pos: [-0.062, 0.052, -0.026] })
    parts.push(thumb)
    // nsp7 / nsp8 辅因子（其中一个 nsp8 带长“滑动夹”延伸臂）
    const nsp7 = blob(0.032, Math.max(1, detail - 1), 281, COLORS.polyprotein, 0.2)
    transformGeometry(nsp7, { pos: [-0.03, -0.072, 0.06] })
    parts.push(nsp7)
    const nsp8 = new CapsuleGeometry(0.014, 0.15, 3, 7)
    colorize(nsp8, COLORS.polyprotein)
    transformGeometry(nsp8, { pos: [0.02, -0.02, 0.1], rot: [0.7, 0.2, 0.3] })
    parts.push(nsp8)
    const nsp8b = new CapsuleGeometry(0.014, 0.12, 3, 7)
    colorize(nsp8b, COLORS.polyprotein)
    transformGeometry(nsp8b, { pos: [-0.05, -0.02, -0.09], rot: [-0.6, 0, -0.3] })
    parts.push(nsp8b)
    return mergeAll(parts)
  })
}

/** nsp13 解旋酶：挂在 RTC 上，负责解开 RNA 二级结构。 */
export function buildHelicaseGeometry(detail = 1): BufferGeometry {
  return cachedGeometry(`helicase|${detail}`, () => {
    const parts: BufferGeometry[] = []
    const a = blob(0.042, detail, 291, '#7fa6ff', 0.2)
    transformGeometry(a, { scale: [1, 1.2, 1] })
    parts.push(a)
    const b = blob(0.026, detail, 301, '#a6c0ff', 0.2)
    transformGeometry(b, { pos: [0.03, 0.045, 0.01] })
    parts.push(b)
    return mergeAll(parts)
  })
}

/** 双膜囊泡 DMV 的一层膜（外膜/内膜各调用一次）。 */
export function buildDmvShellGeometry(radius: number, detail = 3, seed = 311): BufferGeometry {
  return cachedGeometry(`dmv|${radius.toFixed(3)}|${detail}|${seed}`, () => {
    const g = smoothSphere(radius, detail)
    displaceByNoise(g, { amplitude: radius * 0.05, frequency: 2.2 / radius, seed, octaves: 2 })
    const uv = sphericalUV(g)
    return ensureAttributes(uv, COLORS.dmv)
  })
}

/** DMV 上跨双膜的分子孔道（RNA 输出口）。 */
export function buildDmvPoreGeometry(detail = 1): BufferGeometry {
  return cachedGeometry(`dmv-pore|${detail}`, () => {
    const parts: BufferGeometry[] = []
    const crown = new CylinderGeometry(0.115, 0.085, 0.16, detail >= 2 ? 16 : 10, 1, true)
    colorize(crown, '#8fb4e8')
    parts.push(crown)
    const ring = new TorusGeometry(0.115, 0.022, 6, detail >= 2 ? 18 : 12)
    colorize(ring, '#a8c8f0')
    transformGeometry(ring, { rot: [Math.PI / 2, 0, 0], pos: [0, 0.08, 0] })
    parts.push(ring)
    return mergeAll(parts)
  })
}

/**
 * 多聚蛋白 pp1ab 被切割后的 16 个 nsp：给出一组确定性的“碎块”布局，
 * 用于第 6 步展示“一条长链被剪成一堆功能蛋白”。
 */
export function nspFragmentLayout(seed = 7): { radius: number; offset: [number, number, number]; color: string }[] {
  const rng = mulberry32(seed * 131)
  const palette = [COLORS.polyprotein, COLORS.rdrp, '#8fb4e8', '#c9b6ff', '#7fa6ff']
  return Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2 + rng() * 0.4
    const r = 0.32 + rng() * 0.5
    return {
      radius: 0.026 + rng() * 0.028,
      offset: [Math.cos(a) * r, (rng() - 0.5) * 0.5, Math.sin(a) * r] as [number, number, number],
      color: palette[i % palette.length],
    }
  })
}
