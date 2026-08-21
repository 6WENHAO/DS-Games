/**
 * 几何构造工具。
 *
 * 全部结构都是程序化生成的（无外部模型文件）：以解析几何为骨架，叠加确定性噪声，
 * 使蛋白质表面呈现真实的凹凸感，而不是理想的数学球体 —— 这一点对“病毒不能画成
 * 光滑球体”的硬性要求至关重要。
 */

import {
  BufferAttribute,
  type BufferGeometry,
  CatmullRomCurve3,
  Color,
  Euler,
  IcosahedronGeometry,
  Matrix4,
  Quaternion,
  TubeGeometry,
  Vector3,
} from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const geoCache = new Map<string, BufferGeometry>()

/** 几何体按 key 缓存：整页共享，切步骤不会重建，避免 GC 抖动。 */
export function cachedGeometry(key: string, build: () => BufferGeometry): BufferGeometry {
  const hit = geoCache.get(key)
  if (hit) return hit
  const made = build()
  geoCache.set(key, made)
  return made
}

/** 平滑的波状三维噪声：由若干固定方向的余弦波叠加而成，连续、可重复、无缝。 */
export function waveNoise3(x: number, y: number, z: number, seed = 1, octaves = 3): number {
  let sum = 0
  let amp = 1
  let total = 0
  let s = seed * 0.6180339887
  for (let o = 0; o < octaves; o++) {
    const f = 1.7 * Math.pow(2.1, o)
    const a1 = (s = (s * 9301 + 49297) % 233280) / 233280
    const a2 = (s = (s * 9301 + 49297) % 233280) / 233280
    const a3 = (s = (s * 9301 + 49297) % 233280) / 233280
    const ph = a3 * Math.PI * 2
    // 三个互不平行的方向，避免出现规则条纹
    const d1 = Math.cos(a1 * 6.2831853)
    const d2 = Math.sin(a1 * 6.2831853) * Math.cos(a2 * 3.1415927)
    const d3 = Math.sin(a1 * 6.2831853) * Math.sin(a2 * 3.1415927)
    sum += Math.cos((x * d1 + y * d2 + z * d3) * f + ph) * amp
    total += amp
    amp *= 0.55
  }
  return sum / total // -1 … 1
}

/** 给几何体写入统一顶点色（合并后仍能区分不同亚结构域的颜色）。 */
export function colorize(geo: BufferGeometry, color: string): BufferGeometry {
  const c = new Color(color)
  const count = geo.attributes.position.count
  const arr = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    arr[i * 3] = c.r
    arr[i * 3 + 1] = c.g
    arr[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new BufferAttribute(arr, 3))
  return geo
}

export interface TransformSpec {
  pos?: [number, number, number] | Vector3
  rot?: [number, number, number] | Euler
  scale?: [number, number, number] | number
}

const _m = new Matrix4()
const _q = new Quaternion()
const _v = new Vector3()
const _s = new Vector3()

/** 就地变换几何体（构建静态复合结构时用，避免运行时多一层 Object3D）。 */
export function transformGeometry(geo: BufferGeometry, t: TransformSpec): BufferGeometry {
  const pos = t.pos instanceof Vector3 ? t.pos : new Vector3(...(t.pos ?? [0, 0, 0]))
  const rot = t.rot instanceof Euler ? t.rot : new Euler(...(t.rot ?? [0, 0, 0]))
  const sc = typeof t.scale === 'number' ? new Vector3(t.scale, t.scale, t.scale) : new Vector3(...(t.scale ?? [1, 1, 1]))
  _q.setFromEuler(rot)
  _v.copy(pos)
  _s.copy(sc)
  _m.compose(_v, _q, _s)
  geo.applyMatrix4(_m)
  return geo
}

/**
 * 合并若干几何体。
 *
 * three 的 mergeGeometries 要求所有部件的属性集完全一致、且索引状态一致。
 * 本项目里 sphericalUV() 会把几何转成非索引（为了消除球面 UV 接缝），
 * 于是“管道（索引）+ 球面片层（非索引）”这类组合会直接失败。
 * 因此这里做两件事：
 *   1) 若存在非索引部件，则把所有部件统一转成非索引；
 *   2) 补齐缺失的 uv / color / normal 属性；
 * 出错时把每个部件的属性列表打进异常信息，方便定位。
 */
export function mergeAll(parts: BufferGeometry[]): BufferGeometry {
  if (parts.length === 0) throw new Error('mergeAll：没有可合并的部件')

  const needNonIndexed = parts.some((p) => !p.index)
  const normalized = parts.map((p) => {
    let g = p
    if (needNonIndexed && g.index) {
      const converted = g.toNonIndexed()
      g.dispose()
      g = converted
    }
    if (!g.attributes.normal) g.computeVertexNormals()
    if (!g.attributes.uv) g.setAttribute('uv', new BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2))
    if (!g.attributes.color) colorize(g, '#ffffff')
    return g
  })

  const merged = mergeGeometries(normalized, false)
  if (!merged) {
    const summary = normalized.map((g, i) => `#${i}[${Object.keys(g.attributes).join(',')}${g.index ? ',indexed' : ''}]`).join(' ')
    normalized.forEach((g) => g.dispose())
    throw new Error(`mergeGeometries 失败：部件属性集不一致 → ${summary}`)
  }
  normalized.forEach((g) => g.dispose())
  return merged
}

/** 确保几何体带有 uv 与 color 属性，便于统一合并。 */
export function ensureAttributes(geo: BufferGeometry, color: string): BufferGeometry {
  if (!geo.attributes.uv) {
    const count = geo.attributes.position.count
    geo.setAttribute('uv', new BufferAttribute(new Float32Array(count * 2), 2))
  }
  if (!geo.attributes.normal) geo.computeVertexNormals()
  if (!geo.attributes.color) colorize(geo, color)
  return geo
}

/**
 * 光滑可形变球体：以正二十面体细分为基底，按位置合并顶点后才能得到连续法线，
 * 这是做“非光滑球体”的病毒囊膜与蛋白质凸起的基础。
 */
export function smoothSphere(radius: number, detail: number): BufferGeometry {
  const g = new IcosahedronGeometry(radius, detail)
  g.deleteAttribute('normal')
  g.deleteAttribute('uv')
  const merged = mergeVertices(g)
  g.dispose()
  return merged
}

/** 按噪声位移顶点（沿法线方向），得到不规则的生物表面。 */
export function displaceByNoise(
  geo: BufferGeometry,
  opts: { amplitude: number; frequency: number; seed?: number; octaves?: number },
): BufferGeometry {
  const { amplitude, frequency, seed = 1, octaves = 3 } = opts
  const pos = geo.attributes.position as BufferAttribute
  const v = new Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const len = v.length() || 1
    const n = waveNoise3(v.x * frequency, v.y * frequency, v.z * frequency, seed, octaves)
    const scale = (len + n * amplitude) / len
    pos.setXYZ(i, v.x * scale, v.y * scale, v.z * scale)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  return geo
}

/**
 * 为球状几何体生成无接缝的等距柱面 UV。
 *
 * 做法：先算平滑法线，再转为非索引几何，逐三角形修正 u 的跨界（u 相差 >0.5 时补 1），
 * 这样贴磷脂法线贴图时不会出现一条纵向裂缝。
 */
export function sphericalUV(geo: BufferGeometry, repeatV = 1): BufferGeometry {
  if (!geo.attributes.normal) geo.computeVertexNormals()
  const solid = geo.index ? geo.toNonIndexed() : geo
  if (solid !== geo) geo.dispose()
  const pos = solid.attributes.position as BufferAttribute
  const count = pos.count
  const uv = new Float32Array(count * 2)
  const v = new Vector3()
  for (let i = 0; i < count; i++) {
    v.fromBufferAttribute(pos, i).normalize()
    uv[i * 2] = (Math.atan2(v.z, v.x) / (Math.PI * 2) + 0.5) % 1
    uv[i * 2 + 1] = (Math.asin(Math.max(-1, Math.min(1, v.y))) / Math.PI + 0.5) * repeatV
  }
  // 逐三角形修正跨接缝的 u
  for (let f = 0; f < count; f += 3) {
    const u0 = uv[f * 2]
    const u1 = uv[(f + 1) * 2]
    const u2 = uv[(f + 2) * 2]
    const min = Math.min(u0, u1, u2)
    const max = Math.max(u0, u1, u2)
    if (max - min > 0.5) {
      for (let k = 0; k < 3; k++) {
        const idx = (f + k) * 2
        if (uv[idx] < 0.5) uv[idx] += 1
      }
    }
  }
  solid.setAttribute('uv', new BufferAttribute(uv, 2))
  return solid
}

/** 沿一串控制点生成管状几何（RNA 链、内质网小管、多肽链）。 */
export function tubeFromPoints(
  points: Vector3[],
  radius: number,
  tubularSegments = points.length * 4,
  radialSegments = 8,
  closed = false,
): TubeGeometry {
  const curve = new CatmullRomCurve3(points, closed, 'catmullrom', 0.5)
  return new TubeGeometry(curve, tubularSegments, radius, radialSegments, closed)
}

/** 在球体内部做一次“自回避随机游走”，作为核衣壳内 RNA 的盘绕路径。 */
export function coiledPathInSphere(
  radius: number,
  pointCount: number,
  rng: () => number,
  minSeparation = 0.18,
): Vector3[] {
  const pts: Vector3[] = []
  let cur = new Vector3((rng() - 0.5) * radius, (rng() - 0.5) * radius, (rng() - 0.5) * radius)
  const dir = new Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize()
  const step = radius * 0.42
  for (let i = 0; i < pointCount; i++) {
    pts.push(cur.clone())
    let best: Vector3 | null = null
    let bestScore = -Infinity
    for (let tries = 0; tries < 12; tries++) {
      const cand = dir
        .clone()
        .add(new Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).multiplyScalar(1.35))
        .normalize()
        .multiplyScalar(step)
        .add(cur)
      // 保持在球内
      if (cand.length() > radius * 0.93) cand.multiplyScalar((radius * 0.93) / cand.length())
      let minD = Infinity
      for (let j = 0; j < pts.length - 1; j++) minD = Math.min(minD, cand.distanceTo(pts[j]))
      const score = Math.min(minD, minSeparation * radius) - cand.length() * 0.05
      if (score > bestScore) {
        bestScore = score
        best = cand
      }
    }
    if (!best) break
    dir.copy(best).sub(cur).normalize()
    cur = best
  }
  return pts
}

export function disposeGeometryCache(): void {
  geoCache.forEach((g) => g.dispose())
  geoCache.clear()
}
