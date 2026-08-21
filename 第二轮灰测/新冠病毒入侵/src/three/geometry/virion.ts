/**
 * 病毒体（virion）几何：囊膜、刺突三聚体、M/E 蛋白、核衣壳。
 *
 * 结构依据（详见 docs/SCIENCE.md）：
 *  - 病毒体直径 60–140 nm，外形不规则、略呈椭球，**不是光滑球体**；
 *  - 表面每个病毒体约 24–40 个刺突（S）三聚体，呈“冠状”；
 *  - 每个 S 单体分 S1（含 NTD 与 RBD）与 S2（含融合肽、HR1/HR2）；
 *    prefusion 状态下三个 RBD 有“下（closed）/上（open）”两种构象，
 *    只有“上”构象的 RBD 才能结合 ACE2；
 *  - M 蛋白以二聚体形式大量嵌在膜内（丰度最高的结构蛋白，胞外部分很小）；
 *  - E 蛋白数量少、为五聚体离子通道；
 *  - 内部是 N 蛋白包裹 +ssRNA 形成的核衣壳，呈“串珠状”的核糖核蛋白复合体。
 */

import {
  type BufferGeometry,
  CapsuleGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  Quaternion,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from 'three'
import { COLORS, SCALE } from '../palette'
import { fibonacciSphere, mulberry32 } from '../rand'
import {
  cachedGeometry,
  colorize,
  displaceByNoise,
  ensureAttributes,
  mergeAll,
  smoothSphere,
  sphericalUV,
  transformGeometry,
  waveNoise3,
} from './helpers'

/** 刺突三聚体的分区尺寸（世界单位，基点在囊膜表面，+Y 为朝外方向）。 */
export const SPIKE_LAYOUT = {
  totalHeight: SCALE.spikeHeight, // ≈0.5（25 nm）
  /** S2 柄部（HR2 stalk）：柔性铰链，画面上会轻微摆动 */
  stemTop: 0.2,
  stemHelixRadius: 0.019,
  stemTubeRadius: 0.0105,
  /** S2 中央螺旋 */
  coreY: 0.26,
  coreLength: 0.12,
  coreRadius: 0.021,
  coreOffset: 0.019,
  /** S1 的 NTD 叶（外下方） */
  ntdY: 0.35,
  ntdDist: 0.068,
  ntdR: 0.054,
  /** S1 的 RBD 叶（内上方，可抬起） */
  rbdY: 0.45,
  rbdDist: 0.044,
  rbdR: 0.039,
  /**
   * S2′ 切割位点 / 融合肽所在高度。
   * 结构依据：融合肽（R815 之后）在 prefusion 三聚体中位于 S2 的上部，紧贴 S1 头部下方，
   * 距病毒膜约 15 nm —— 这也是 TMPRSS2 能够接近它的前提。
   */
  s2PrimeY: 0.3,
  /** 三聚体顶冠 */
  apexY: 0.472,
  apexR: 0.026,
  /** RBD 抬起（up 构象）时绕铰链旋转的角度 */
  rbdUpAngle: 1.05,
} as const

function lobe(radius: number, detail: number, seed: number, color: string): BufferGeometry {
  const g = smoothSphere(radius, detail)
  displaceByNoise(g, { amplitude: radius * 0.15, frequency: 3.1 / radius, seed, octaves: 2 })
  return ensureAttributes(g, color)
}

/** S2 柄部：三条轻微缠绕的螺旋，体现三聚体本质。 */
function stemHelices(detail: number): BufferGeometry[] {
  const L = SPIKE_LAYOUT
  const parts: BufferGeometry[] = []
  const radial = detail >= 2 ? 7 : 5
  for (let k = 0; k < 3; k++) {
    const pts: Vector3[] = []
    const steps = 9
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const a = t * Math.PI * 1.5 + (k * Math.PI * 2) / 3
      const r = L.stemHelixRadius * (1 - 0.18 * t)
      pts.push(new Vector3(Math.cos(a) * r, t * L.stemTop, Math.sin(a) * r))
    }
    const g = new TubeGeometry(new CatmullRomCurve3(pts), detail >= 2 ? 26 : 14, L.stemTubeRadius, radial, false)
    parts.push(colorize(g, COLORS.spikeDeep))
  }
  return parts
}

/**
 * 完整刺突三聚体（prefusion，RBD 全部处于“下”构象）。
 * 用于实例化渲染整个病毒表面的刺突冠。
 */
export function buildSpikeGeometry(detail = 2): BufferGeometry {
  return cachedGeometry(`spike|${detail}`, () => {
    const L = SPIKE_LAYOUT
    const parts: BufferGeometry[] = [...stemHelices(detail)]

    // S2 中央螺旋束（三条）
    for (let k = 0; k < 3; k++) {
      const a = (k * Math.PI * 2) / 3 + 0.4
      const g = new CapsuleGeometry(L.coreRadius, L.coreLength, 3, detail >= 2 ? 10 : 6)
      colorize(g, COLORS.spikeDeep)
      transformGeometry(g, {
        pos: [Math.cos(a) * L.coreOffset, L.coreY, Math.sin(a) * L.coreOffset],
        rot: [Math.cos(a) * 0.12, 0, -Math.sin(a) * 0.12],
      })
      parts.push(g)
    }

    // S1：3 个 NTD + 3 个 RBD + 顶冠
    for (let k = 0; k < 3; k++) {
      const a = (k * Math.PI * 2) / 3
      const ntd = lobe(L.ntdR, detail, 11 + k, COLORS.spike)
      transformGeometry(ntd, {
        pos: [Math.cos(a) * L.ntdDist, L.ntdY, Math.sin(a) * L.ntdDist],
        scale: [1.06, 0.88, 1.06],
      })
      parts.push(ntd)

      const ar = a + Math.PI / 3
      const rbd = lobe(L.rbdR, detail, 31 + k, COLORS.rbd)
      transformGeometry(rbd, {
        pos: [Math.cos(ar) * L.rbdDist, L.rbdY, Math.sin(ar) * L.rbdDist],
        scale: [1, 0.82, 1],
      })
      parts.push(rbd)

      const apex = lobe(L.apexR, Math.max(1, detail - 1), 51 + k, COLORS.spike)
      transformGeometry(apex, { pos: [Math.cos(ar) * 0.012, L.apexY, Math.sin(ar) * 0.012], scale: [1, 0.7, 1] })
      parts.push(apex)
    }

    return mergeAll(parts)
  })
}

/** 主角刺突的可动部件：拆开成独立几何，供逐部件动画（RBD 抬起、S1 脱落、S2 伸展）。 */
export interface SpikePartGeometries {
  stem: BufferGeometry
  core: BufferGeometry
  ntd: BufferGeometry
  rbd: BufferGeometry
  apex: BufferGeometry
  /** 融合肽：S2′ 位点被切开后暴露，插入宿主膜 */
  fusionPeptide: BufferGeometry
  /** postfusion 六螺旋束：融合后 S2 折叠成的长杆 */
  sixHelixBundle: BufferGeometry
  /** S2′ 切割位点的指示环 */
  cleavageRing: BufferGeometry
}

export function spikeParts(detail = 2): SpikePartGeometries {
  const L = SPIKE_LAYOUT
  return {
    stem: cachedGeometry(`spike-stem|${detail}`, () => mergeAll(stemHelices(detail))),
    core: cachedGeometry(`spike-core|${detail}`, () => {
      const parts: BufferGeometry[] = []
      for (let k = 0; k < 3; k++) {
        const a = (k * Math.PI * 2) / 3 + 0.4
        const g = new CapsuleGeometry(L.coreRadius, L.coreLength, 3, detail >= 2 ? 10 : 6)
        colorize(g, COLORS.spikeDeep)
        transformGeometry(g, {
          pos: [Math.cos(a) * L.coreOffset, 0, Math.sin(a) * L.coreOffset],
          rot: [Math.cos(a) * 0.12, 0, -Math.sin(a) * 0.12],
        })
        parts.push(g)
      }
      return mergeAll(parts)
    }),
    ntd: cachedGeometry(`spike-ntd|${detail}`, () => {
      const g = lobe(L.ntdR, detail, 11, COLORS.spike)
      return transformGeometry(g, { scale: [1.06, 0.88, 1.06] })
    }),
    rbd: cachedGeometry(`spike-rbd|${detail}`, () => {
      const g = lobe(L.rbdR, detail, 31, COLORS.rbd)
      return transformGeometry(g, { scale: [1, 0.82, 1] })
    }),
    apex: cachedGeometry(`spike-apex|${detail}`, () => lobe(L.apexR, Math.max(1, detail - 1), 51, COLORS.spike)),
    fusionPeptide: cachedGeometry(`spike-fp|${detail}`, () => {
      const pts: Vector3[] = []
      for (let i = 0; i <= 8; i++) {
        const t = i / 8
        pts.push(new Vector3(Math.sin(t * 3.4) * 0.014, t * 0.16, Math.cos(t * 2.1) * 0.01))
      }
      const g = new TubeGeometry(new CatmullRomCurve3(pts), 16, 0.0115, 6, false)
      return colorize(g, COLORS.rbd)
    }),
    sixHelixBundle: cachedGeometry(`spike-6hb|${detail}`, () => {
      const parts: BufferGeometry[] = []
      for (let k = 0; k < 3; k++) {
        const a = (k * Math.PI * 2) / 3
        const g = new CapsuleGeometry(0.016, 0.3, 3, detail >= 2 ? 9 : 6)
        colorize(g, COLORS.spikeDeep)
        transformGeometry(g, { pos: [Math.cos(a) * 0.022, 0.15, Math.sin(a) * 0.022] })
        parts.push(g)
        const g2 = new CapsuleGeometry(0.0115, 0.26, 3, detail >= 2 ? 9 : 6)
        colorize(g2, COLORS.spike)
        transformGeometry(g2, { pos: [Math.cos(a + 0.5) * 0.04, 0.14, Math.sin(a + 0.5) * 0.04] })
        parts.push(g2)
      }
      return mergeAll(parts)
    }),
    cleavageRing: cachedGeometry('spike-cleave', () => {
      const g = new TorusGeometry(0.036, 0.005, 6, 20)
      transformGeometry(g, { rot: [Math.PI / 2, 0, 0] })
      return colorize(g, COLORS.tmprss2)
    }),
  }
}

/**
 * 囊膜表面的实际半径（含噪声位移）。
 * 刺突与 M/E 蛋白的布点必须调用同一函数，才能严丝合缝地长在膜上。
 */
export function envelopeRadiusAt(dir: Vector3, baseRadius: number, seed = 3): number {
  const x = dir.x * baseRadius
  const y = dir.y * baseRadius
  const z = dir.z * baseRadius
  const low = waveNoise3(x * 3.3, y * 3.3, z * 3.3, seed, 3)
  const high = waveNoise3(x * 19, y * 19, z * 19, seed + 7, 2)
  return baseRadius * (1 + low * 0.075) + high * 0.01
}

/** 病毒囊膜（脂双层的某一层）。detail 决定细分级别。 */
export function buildEnvelopeGeometry(baseRadius: number, detail: number, seed = 3): BufferGeometry {
  return cachedGeometry(`envelope|${baseRadius.toFixed(3)}|${detail}|${seed}`, () => {
    const g = smoothSphere(1, detail)
    const pos = g.attributes.position
    const v = new Vector3()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).normalize()
      const r = envelopeRadiusAt(v, baseRadius, seed)
      pos.setXYZ(i, v.x * r, v.y * r, v.z * r)
    }
    pos.needsUpdate = true
    g.computeVertexNormals()
    const withUv = sphericalUV(g)
    return ensureAttributes(withUv, COLORS.envelope)
  })
}

/** M 蛋白二聚体：大部分埋在膜内，胞外只露出很小的一截。 */
export function buildMProteinGeometry(detail = 2): BufferGeometry {
  return cachedGeometry(`m-protein|${detail}`, () => {
    const parts: BufferGeometry[] = []
    for (let k = 0; k < 2; k++) {
      const g = new CapsuleGeometry(0.017, 0.026, 3, detail >= 2 ? 9 : 6)
      colorize(g, COLORS.mProtein)
      transformGeometry(g, { pos: [(k - 0.5) * 0.034, 0.014, 0], rot: [0, 0, (k - 0.5) * 0.2] })
      parts.push(g)
    }
    const cap = lobe(0.018, Math.max(1, detail - 1), 71, COLORS.mProtein)
    transformGeometry(cap, { pos: [0, 0.036, 0], scale: [1.5, 0.6, 1] })
    parts.push(cap)
    return mergeAll(parts)
  })
}

/** E 蛋白五聚体离子通道：数量少、个头小。 */
export function buildEProteinGeometry(detail = 2): BufferGeometry {
  return cachedGeometry(`e-protein|${detail}`, () => {
    const parts: BufferGeometry[] = []
    for (let k = 0; k < 5; k++) {
      const a = (k * Math.PI * 2) / 5
      const g = new CapsuleGeometry(0.0075, 0.03, 2, 6)
      colorize(g, COLORS.eProtein)
      transformGeometry(g, {
        pos: [Math.cos(a) * 0.0135, 0.018, Math.sin(a) * 0.0135],
        rot: [Math.cos(a) * -0.14, 0, Math.sin(a) * 0.14],
      })
      parts.push(g)
    }
    return mergeAll(parts)
  })
}

/** N 蛋白单体（核衣壳串珠）。直径约 4.5 nm，明显粗于 RNA 链，才能读出"串珠状"结构。 */
export function buildNProteinGeometry(detail = 1): BufferGeometry {
  return cachedGeometry(`n-protein|${detail}`, () => {
    const g = lobe(0.09, detail, 91, COLORS.nProtein)
    return transformGeometry(g, { scale: [1.12, 0.88, 1] })
  })
}

export interface SpikeSite {
  /** 囊膜表面上的位置 */
  position: Vector3
  /** 让 +Y 朝外的朝向 */
  quaternion: Quaternion
  /** 表面法线方向 */
  normal: Vector3
}

/** 在囊膜表面均匀布点（斐波那契球），并让每个刺突的 +Y 指向表面外法线。 */
export function distributeOnEnvelope(count: number, baseRadius: number, seed = 3, jitter = 0.35): SpikeSite[] {
  const rng = mulberry32(seed * 977 + count)
  const dirs = fibonacciSphere(count)
  const up = new Vector3(0, 1, 0)
  return dirs.map(([x, y, z]) => {
    const dir = new Vector3(x, y, z)
    // 轻微抖动，避免过于规整的“数学感”
    dir
      .add(new Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).multiplyScalar(jitter / Math.cbrt(count)))
      .normalize()
    const r = envelopeRadiusAt(dir, baseRadius, seed)
    const position = dir.clone().multiplyScalar(r)
    const quaternion = new Quaternion().setFromUnitVectors(up, dir)
    return { position, quaternion, normal: dir }
  })
}

/** 核衣壳：+ssRNA 的盘绕路径（单链！绝非双螺旋）与 N 蛋白串珠位置。 */
export function buildNucleocapsid(
  innerRadius: number,
  seed = 5,
  pointCount = 34,
): { path: Vector3[]; beads: { position: Vector3; quaternion: Quaternion }[] } {
  const rng = mulberry32(seed * 7919)
  const path: Vector3[] = []
  // 以“扁平螺旋 + 随机扰动”生成盘绕路径：既像真实的螺旋核糖核蛋白，也避免自交
  const turns = 3.4
  for (let i = 0; i < pointCount; i++) {
    const t = i / (pointCount - 1)
    const a = t * Math.PI * 2 * turns
    const bulge = Math.sin(t * Math.PI) * 0.92 + 0.08
    const r = innerRadius * 0.72 * bulge
    const wobble = 0.22 * innerRadius
    path.push(
      new Vector3(
        Math.cos(a) * r + (rng() - 0.5) * wobble,
        (t - 0.5) * 2 * innerRadius * 0.62 + (rng() - 0.5) * wobble * 0.7,
        Math.sin(a) * r + (rng() - 0.5) * wobble,
      ),
    )
  }

  const curve = new CatmullRomCurve3(path, false, 'catmullrom', 0.5)
  // 真实病毒体内约有 35–40 个核糖核蛋白（RNP）复合体，这里取 34 个，
  // 让内部读起来是"串珠状的核衣壳"而不是一团发光的线
  const beadCount = 34
  const up = new Vector3(0, 1, 0)
  const beads = Array.from({ length: beadCount }, (_, i) => {
    const t = (i + 0.5) / beadCount
    const position = curve.getPoint(t)
    const tangent = curve.getTangent(t).normalize()
    return { position, quaternion: new Quaternion().setFromUnitVectors(up, tangent) }
  })
  return { path, beads }
}

/** 病毒体内部“空腔”的柔光球，用于表现囊膜的半透明与内部荧光。 */
export function buildInnerGlowGeometry(radius: number, detail = 2): BufferGeometry {
  return cachedGeometry(`inner-glow|${radius.toFixed(3)}|${detail}`, () => {
    const g = smoothSphere(radius, detail)
    return ensureAttributes(g, COLORS.rna)
  })
}

/** 跨膜柄（M/E/S 共用的“埋入膜内”那一段），让蛋白看起来真的插在膜里。 */
export function buildTransmembraneStub(radius: number, height: number, color: string): BufferGeometry {
  return cachedGeometry(`tm-stub|${radius.toFixed(3)}|${height.toFixed(3)}|${color}`, () => {
    const g = new CylinderGeometry(radius, radius * 0.9, height, 10, 1, false)
    transformGeometry(g, { pos: [0, -height / 2, 0] })
    return colorize(g, color)
  })
}
