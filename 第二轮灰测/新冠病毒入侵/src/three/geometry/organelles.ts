/**
 * 细胞器几何：内质网（ER）、ERGIC、高尔基体、细胞核、线粒体、分泌囊泡。
 *
 * 这些结构在画面中是“舞台布景”：低饱和、半透明，把注意力留给病毒与关键分子；
 * 但它们的空间关系必须正确 —— ER → ERGIC → 高尔基体 是分泌途径的顺序，
 * 冠状病毒正是在 ERGIC（内质网—高尔基体中间区室）组装并借分泌途径出胞。
 *
 * 细胞核在画面中始终可见，用于反衬一条硬性科学事实：**病毒 RNA 从不进入细胞核**。
 */

import { type BufferGeometry, CapsuleGeometry, CatmullRomCurve3, TorusGeometry, TubeGeometry, Vector3 } from 'three'
import { COLORS } from '../palette'
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

/** 让扁平囊泡（cisterna）呈现自然的弯曲。 */
function bendGeometry(geo: BufferGeometry, k: number): BufferGeometry {
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    pos.setY(i, y + k * (x * x + z * z))
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

/** 单个扁平膜囊（高尔基体/ERGIC/ER 片层的基本单元）。 */
export function buildCisternaGeometry(
  radius: number,
  thickness: number,
  bend = 0.05,
  detail = 3,
  seed = 401,
): BufferGeometry {
  return cachedGeometry(`cisterna|${radius.toFixed(2)}|${thickness.toFixed(3)}|${bend}|${detail}|${seed}`, () => {
    const g = smoothSphere(1, detail)
    displaceByNoise(g, { amplitude: 0.07, frequency: 2.4, seed, octaves: 2 })
    transformGeometry(g, { scale: [radius, thickness, radius * 0.88] })
    bendGeometry(g, bend)
    const uv = sphericalUV(g)
    return ensureAttributes(uv, COLORS.golgi)
  })
}

/** 高尔基体：多层扁平膜囊堆叠（cis → trans 半径递减）。 */
export function golgiStackLayout(count = 5): { radius: number; y: number; thickness: number; bend: number }[] {
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1)
    return {
      radius: 1.5 - t * 0.42,
      y: t * 0.62,
      thickness: 0.1,
      bend: 0.05 + t * 0.035,
    }
  })
}

/** 内质网小管网络：一串互相连通的管道，程序化生成、确定性。 */
export function buildErNetworkGeometry(seed = 501, tubes = 7, detail = 2): BufferGeometry {
  return cachedGeometry(`er|${seed}|${tubes}|${detail}`, () => {
    const rng = mulberry32(seed * 89)
    const parts: BufferGeometry[] = []
    for (let t = 0; t < tubes; t++) {
      const pts: Vector3[] = []
      const start = new Vector3((rng() - 0.5) * 5.2, (rng() - 0.5) * 1.5, (rng() - 0.5) * 4.4)
      const dir = new Vector3(rng() - 0.5, (rng() - 0.5) * 0.35, rng() - 0.5).normalize()
      let cur = start.clone()
      const steps = 5 + Math.floor(rng() * 3)
      for (let i = 0; i < steps; i++) {
        pts.push(cur.clone())
        dir
          .add(new Vector3((rng() - 0.5) * 1.4, (rng() - 0.5) * 0.45, (rng() - 0.5) * 1.4))
          .normalize()
        cur = cur.clone().add(dir.clone().multiplyScalar(0.9 + rng() * 0.7))
        cur.y = Math.max(-1.6, Math.min(1.6, cur.y))
      }
      const g = new TubeGeometry(
        new CatmullRomCurve3(pts, false, 'catmullrom', 0.5),
        detail >= 2 ? 30 : 18,
        0.1 + rng() * 0.05,
        detail >= 2 ? 9 : 6,
        false,
      )
      parts.push(colorize(g, COLORS.er))
    }
    // 两片粗面内质网片层（后续在其上实例化核糖体）
    for (let s = 0; s < 2; s++) {
      const sheet = buildCisternaSheet(1.7 + s * 0.35, 0.085, 0.03, detail, 511 + s)
      transformGeometry(sheet, { pos: [(s - 0.5) * 2.4, s * 0.55 - 0.3, (s - 0.5) * -1.6], rot: [0.08, s * 0.6, -0.05] })
      parts.push(sheet)
    }
    return mergeAll(parts)
  })
}

/** 独立可变换的片层（不进缓存，供 ER 网络内部使用）。 */
function buildCisternaSheet(radius: number, thickness: number, bend: number, detail: number, seed: number): BufferGeometry {
  const g = smoothSphere(1, detail)
  displaceByNoise(g, { amplitude: 0.08, frequency: 2.6, seed, octaves: 2 })
  transformGeometry(g, { scale: [radius, thickness, radius * 0.8] })
  bendGeometry(g, bend)
  const uv = sphericalUV(g)
  return ensureAttributes(uv, COLORS.er)
}

/** ERGIC：内质网—高尔基体中间区室，由一个较大的管泡状腔 + 一圈小囊泡构成。 */
export function buildErgicSacGeometry(radius = 1.25, detail = 3, seed = 601): BufferGeometry {
  return cachedGeometry(`ergic-sac|${radius.toFixed(2)}|${detail}|${seed}`, () => {
    const g = smoothSphere(radius, detail)
    displaceByNoise(g, { amplitude: radius * 0.16, frequency: 2.0 / radius, seed, octaves: 3 })
    transformGeometry(g, { scale: [1.25, 0.78, 1] })
    const uv = sphericalUV(g)
    return ensureAttributes(uv, COLORS.ergic)
  })
}

export function ergicSatelliteLayout(seed = 611, count = 9): { r: number; pos: [number, number, number] }[] {
  const rng = mulberry32(seed * 47)
  return Array.from({ length: count }, () => {
    const a = rng() * Math.PI * 2
    const d = 1.35 + rng() * 0.9
    return {
      r: 0.13 + rng() * 0.16,
      pos: [Math.cos(a) * d, (rng() - 0.5) * 0.75, Math.sin(a) * d * 0.8] as [number, number, number],
    }
  })
}

/** 通用囊泡 / 内体 / 分泌囊泡外壳。 */
export function buildVesicleGeometry(radius: number, detail = 2, seed = 701): BufferGeometry {
  return cachedGeometry(`vesicle|${radius.toFixed(3)}|${detail}|${seed}`, () => {
    const g = smoothSphere(radius, detail)
    displaceByNoise(g, { amplitude: radius * 0.09, frequency: 2.4 / radius, seed, octaves: 2 })
    const uv = sphericalUV(g)
    return ensureAttributes(uv, COLORS.vesicle)
  })
}

/** 细胞核外膜/内膜：大尺度、略不规则。 */
export function buildNucleusGeometry(radius: number, detail = 3, seed = 801): BufferGeometry {
  return cachedGeometry(`nucleus|${radius.toFixed(2)}|${detail}|${seed}`, () => {
    const g = smoothSphere(radius, detail)
    displaceByNoise(g, { amplitude: radius * 0.045, frequency: 1.6 / radius, seed, octaves: 3 })
    const uv = sphericalUV(g)
    return ensureAttributes(uv, COLORS.nucleus)
  })
}

/**
 * 染色质纤维：宿主自身的遗传物质。
 * 刻意画成松散、缠绕的纤维束而**不是**教科书式的双螺旋 —— 避免观众把它与病毒 RNA 混淆。
 */
export function buildChromatinGeometry(radius: number, strands = 6, seed = 811, detail = 1): BufferGeometry {
  return cachedGeometry(`chromatin|${radius.toFixed(2)}|${strands}|${seed}|${detail}`, () => {
    const rng = mulberry32(seed * 173)
    const parts: BufferGeometry[] = []
    for (let s = 0; s < strands; s++) {
      const pts: Vector3[] = []
      let cur = new Vector3((rng() - 0.5) * radius, (rng() - 0.5) * radius, (rng() - 0.5) * radius)
      for (let i = 0; i < 9; i++) {
        pts.push(cur.clone())
        cur = cur
          .clone()
          .add(new Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize().multiplyScalar(radius * 0.42))
        if (cur.length() > radius * 0.82) cur.multiplyScalar((radius * 0.82) / cur.length())
      }
      const g = new TubeGeometry(new CatmullRomCurve3(pts, false, 'catmullrom', 0.5), detail >= 2 ? 40 : 24, radius * 0.035, 6, false)
      parts.push(colorize(g, '#5a7ba8'))
    }
    return mergeAll(parts)
  })
}

/** 线粒体：外膜胶囊 + 内部皱褶（cristae）。纯布景，数量很少。 */
export function buildMitochondrionGeometry(detail = 2, seed = 901): BufferGeometry {
  return cachedGeometry(`mito|${detail}|${seed}`, () => {
    const parts: BufferGeometry[] = []
    const body = new CapsuleGeometry(0.42, 1.1, 4, detail >= 2 ? 14 : 9)
    colorize(body, COLORS.mitochondria)
    transformGeometry(body, { rot: [0, 0, Math.PI / 2] })
    parts.push(body)
    const rng = mulberry32(seed)
    for (let i = 0; i < 6; i++) {
      const g = new TorusGeometry(0.3, 0.035, 5, 14, Math.PI * 1.3)
      colorize(g, '#6fa8a2')
      transformGeometry(g, {
        pos: [-0.55 + i * 0.22, 0, 0],
        rot: [rng() * 0.4, Math.PI / 2, rng() * 0.6 - 0.3],
      })
      parts.push(g)
    }
    return mergeAll(parts)
  })
}

/** 内体（endosome）：备选进入途径的舞台，内含腔内小泡。 */
export function buildEndosomeGeometry(radius = 0.95, detail = 3, seed = 951): BufferGeometry {
  return cachedGeometry(`endosome|${radius.toFixed(2)}|${detail}|${seed}`, () => {
    const g = smoothSphere(radius, detail)
    displaceByNoise(g, { amplitude: radius * 0.12, frequency: 2.6 / radius, seed, octaves: 3 })
    const uv = sphericalUV(g)
    return ensureAttributes(uv, COLORS.vesicle)
  })
}
