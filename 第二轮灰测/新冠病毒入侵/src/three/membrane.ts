/**
 * 宿主细胞质膜：可实时形变的磷脂双分子层膜片。
 *
 * 生物学要点：
 *  - 双分子层由“外层（extracellular leaflet）+ 疏水尾部核心 + 内层（cytoplasmic leaflet）”三层构成，
 *    因此这里生成 3 张共享同一形变场的网格，而不是一张平面贴图；
 *  - 膜融合不是“病毒穿墙”，而是两层脂双层先被拉近、形成半融合茎，再打开一个真正的
 *    **融合孔（fusion pore）**。所以形变场里包含“向上隆起”和“中心开孔”两个分量，
 *    开孔是真几何开孔（内圈顶点被推到孔沿并卷边），而不是贴图上的假窟窿；
 *  - 出胞（胞吐）用同一套形变场在第二个位点复用。
 *
 * 工程要点：
 *  - 网格采用**中心加密**的非均匀分布：融合孔附近约 0.08 世界单位一格（4 nm），
 *    远处逐渐放宽，用 1.6 万顶点同时兼顾“孔沿细节”与“1.5 µm 视野”；
 *  - 静态基底（低频起伏）在初始化时烘焙一次；每帧只重算受形变影响的顶点集合，
 *    因此即使在移动端也不会因为膜形变掉帧。
 */

import { BufferAttribute, BufferGeometry, Vector3 } from 'three'
import { SCALE } from './palette'
import { valueNoise2D } from './rand'

export interface DeformSite {
  /** 位点中心（世界 XZ） */
  x: number
  z: number
  /** 朝病毒方向的隆起高度（半融合茎形成前的膜拉近） */
  bulge: number
  /** 融合孔半径；>0 时膜上出现真正的开孔 */
  pore: number
  /** 孔沿卷边高度 */
  rim: number
}

export const NO_SITE: DeformSite = { x: 0, z: 0, bulge: 0, pore: 0, rim: 0 }

export interface MembraneState {
  /** 主融合位点（病毒进入） */
  fusion: DeformSite
  /** 胞吐位点（子代病毒释放） */
  exo: DeformSite
}

export function createMembraneState(): MembraneState {
  return { fusion: { ...NO_SITE }, exo: { ...NO_SITE } }
}

const BULGE_SIGMA = 0.62
const RIM_SIGMA = 0.2

/** 低频静态起伏：真实细胞膜不是理想平面。 */
function rawRipple(x: number, z: number): number {
  const a = (valueNoise2D(x * 0.11 + 8, z * 0.11 + 3, 17) - 0.5) * 0.62
  const b = (valueNoise2D(x * 0.31 + 2, z * 0.31 + 9, 29) - 0.5) * 0.16
  return a + b
}

/**
 * 归一化后的起伏：保证融合位点 (0,0) 处膜面恰好落在 y=0。
 * 这样病毒体、ACE2、融合孔等一系列锚点坐标就都能写成干净的常数。
 */
const RIPPLE_OFFSET = rawRipple(0, 0)

function baseRipple(x: number, z: number): number {
  return rawRipple(x, z) - RIPPLE_OFFSET
}

function applySite(site: DeformSite, x: number, z: number, out: Vector3): void {
  if (site.bulge === 0 && site.pore === 0) return
  let dx = x - site.x
  let dz = z - site.z
  let r = Math.hypot(dx, dz)

  // 1) 融合孔：把孔内顶点推到孔沿，并做一点外卷，形成有厚度的孔口
  if (site.pore > 0 && r < site.pore) {
    const safe = Math.max(r, 1e-5)
    const u = r / site.pore
    const target = site.pore * (1 + 0.09 * (1 - u))
    const k = target / safe
    dx *= k
    dz *= k
    out.x = site.x + dx
    out.z = site.z + dz
    r = target
    out.y += site.rim * (0.55 + 0.45 * (1 - u))
  }

  // 2) 朝病毒方向隆起（膜被受体-配体作用拉近）
  if (site.bulge !== 0) {
    const g = Math.exp(-(r * r) / (BULGE_SIGMA * BULGE_SIGMA))
    out.y += site.bulge * g
  }

  // 3) 孔沿的环形卷边
  if (site.pore > 0 && site.rim !== 0) {
    const d = r - site.pore
    out.y += site.rim * Math.exp(-(d * d) / (RIM_SIGMA * RIM_SIGMA))
  }
}

/** 形变场：把基准平面上的 (x0,z0) 映射到实际膜面点。 */
export function warpMembrane(x0: number, z0: number, state: MembraneState, out: Vector3): Vector3 {
  out.set(x0, baseRipple(x0, z0), z0)
  applySite(state.fusion, x0, z0, out)
  applySite(state.exo, x0, z0, out)
  return out
}

const _a = new Vector3()
const _b = new Vector3()
const _c = new Vector3()
const _ab = new Vector3()
const _ac = new Vector3()

/** 采样膜面：返回该处的实际位置与朝胞外的单位法线（用于把受体、磷脂、病毒“种”在膜上）。 */
export function sampleMembrane(
  x0: number,
  z0: number,
  state: MembraneState,
  outPos: Vector3,
  outNormal: Vector3,
  eps = 0.06,
): void {
  warpMembrane(x0, z0, state, _a)
  warpMembrane(x0 + eps, z0, state, _b)
  warpMembrane(x0, z0 + eps, state, _c)
  _ab.copy(_b).sub(_a)
  _ac.copy(_c).sub(_a)
  outNormal.copy(_ac).cross(_ab).normalize()
  if (outNormal.y < 0) outNormal.negate()
  outPos.copy(_a)
}

/** 非均匀坐标映射：把 [-1,1] 的均匀参数拉成“中心密、边缘疏”的世界坐标。 */
function gradeCoord(u: number, half: number, power: number): number {
  const s = Math.sign(u)
  return s * Math.pow(Math.abs(u), power) * half
}

export interface MembraneSheetOptions {
  size: number
  segments: number
  /** 中心加密指数，1 = 均匀 */
  gradePower?: number
  /** 双分子层厚度 */
  thickness?: number
}

/**
 * 三层膜片网格容器。
 * geometries.outer / core / inner 共享同一形变场，分别偏移 +T/2、0、-T/2。
 */
export class MembraneSheet {
  readonly outer: BufferGeometry
  readonly core: BufferGeometry
  readonly inner: BufferGeometry
  readonly size: number
  readonly segments: number
  private readonly thickness: number
  private readonly grid: Float32Array
  private readonly halfSize: number
  private readonly siteCache = new Map<string, Int32Array>()
  private activeIndices: Int32Array | null = null
  private lastKey = ''

  constructor(opts: MembraneSheetOptions) {
    const { size, segments, gradePower = 1.35, thickness = SCALE.bilayer } = opts
    this.size = size
    this.segments = segments
    this.thickness = thickness
    this.halfSize = size / 2

    const n = segments + 1
    const count = n * n
    this.grid = new Float32Array(count * 2)
    const uv = new Float32Array(count * 2)
    for (let j = 0; j < n; j++) {
      const v = (j / segments) * 2 - 1
      const z = gradeCoord(v, this.halfSize, gradePower)
      for (let i = 0; i < n; i++) {
        const u = (i / segments) * 2 - 1
        const x = gradeCoord(u, this.halfSize, gradePower)
        const k = j * n + i
        this.grid[k * 2] = x
        this.grid[k * 2 + 1] = z
        // uv 按**世界坐标**给，保证磷脂颗粒密度在中心加密区不被拉伸
        uv[k * 2] = x / this.size
        uv[k * 2 + 1] = z / this.size
      }
    }

    const indices = new Uint32Array(segments * segments * 6)
    let p = 0
    for (let j = 0; j < segments; j++) {
      for (let i = 0; i < segments; i++) {
        const a = j * n + i
        const b = a + 1
        const c = a + n
        const d = c + 1
        indices[p++] = a
        indices[p++] = c
        indices[p++] = b
        indices[p++] = b
        indices[p++] = c
        indices[p++] = d
      }
    }

    const make = () => {
      const g = new BufferGeometry()
      g.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3))
      g.setAttribute('normal', new BufferAttribute(new Float32Array(count * 3), 3))
      g.setAttribute('uv', new BufferAttribute(uv.slice(), 2))
      g.setIndex(new BufferAttribute(indices, 1))
      return g
    }
    this.outer = make()
    this.core = make()
    this.inner = make()

    // 烘焙静态基底
    const state = createMembraneState()
    this.writeVertices(state, null)
    this.outer.computeBoundingSphere()
    this.core.computeBoundingSphere()
    this.inner.computeBoundingSphere()
  }

  /** 计算受某位点影响的顶点索引集合（位点位置很少变化，结果缓存复用）。 */
  private indicesNear(site: DeformSite, radius: number): Int32Array {
    const key = `${site.x.toFixed(2)}|${site.z.toFixed(2)}|${radius.toFixed(2)}`
    const hit = this.siteCache.get(key)
    if (hit) return hit
    const list: number[] = []
    const n = this.segments + 1
    const r2 = radius * radius
    for (let k = 0; k < n * n; k++) {
      const dx = this.grid[k * 2] - site.x
      const dz = this.grid[k * 2 + 1] - site.z
      if (dx * dx + dz * dz <= r2) list.push(k)
    }
    const arr = new Int32Array(list)
    this.siteCache.set(key, arr)
    return arr
  }

  private writeVertices(state: MembraneState, indices: Int32Array | null): void {
    const pos = new Vector3()
    const nrm = new Vector3()
    const outerPos = this.outer.attributes.position.array as Float32Array
    const outerNrm = this.outer.attributes.normal.array as Float32Array
    const corePos = this.core.attributes.position.array as Float32Array
    const coreNrm = this.core.attributes.normal.array as Float32Array
    const innerPos = this.inner.attributes.position.array as Float32Array
    const innerNrm = this.inner.attributes.normal.array as Float32Array
    const half = this.thickness / 2
    const total = indices ? indices.length : (this.segments + 1) * (this.segments + 1)

    for (let idx = 0; idx < total; idx++) {
      const k = indices ? indices[idx] : idx
      const x0 = this.grid[k * 2]
      const z0 = this.grid[k * 2 + 1]
      // 采样步长随网格密度变化，保证法线在加密区依然准确
      const eps = Math.max(0.03, (Math.abs(x0) + Math.abs(z0)) * 0.02 + 0.03)
      sampleMembrane(x0, z0, state, pos, nrm, eps)
      const o = k * 3
      outerPos[o] = pos.x + nrm.x * half
      outerPos[o + 1] = pos.y + nrm.y * half
      outerPos[o + 2] = pos.z + nrm.z * half
      corePos[o] = pos.x
      corePos[o + 1] = pos.y
      corePos[o + 2] = pos.z
      innerPos[o] = pos.x - nrm.x * half
      innerPos[o + 1] = pos.y - nrm.y * half
      innerPos[o + 2] = pos.z - nrm.z * half
      outerNrm[o] = coreNrm[o] = innerNrm[o] = nrm.x
      outerNrm[o + 1] = coreNrm[o + 1] = innerNrm[o + 1] = nrm.y
      outerNrm[o + 2] = coreNrm[o + 2] = innerNrm[o + 2] = nrm.z
    }

    this.outer.attributes.position.needsUpdate = true
    this.outer.attributes.normal.needsUpdate = true
    this.core.attributes.position.needsUpdate = true
    this.core.attributes.normal.needsUpdate = true
    this.inner.attributes.position.needsUpdate = true
    this.inner.attributes.normal.needsUpdate = true
  }

  /** 每帧调用：只有形变位点活跃时才真正写顶点。 */
  update(state: MembraneState): void {
    const active: Int32Array[] = []
    const key = `${state.fusion.bulge.toFixed(3)}|${state.fusion.pore.toFixed(3)}|${state.fusion.rim.toFixed(3)}|${state.exo.bulge.toFixed(3)}|${state.exo.pore.toFixed(3)}|${state.exo.rim.toFixed(3)}`
    const fusionActive = state.fusion.bulge !== 0 || state.fusion.pore !== 0 || state.fusion.rim !== 0
    const exoActive = state.exo.bulge !== 0 || state.exo.pore !== 0 || state.exo.rim !== 0

    if (fusionActive) active.push(this.indicesNear(state.fusion, 3.2))
    if (exoActive) active.push(this.indicesNear(state.exo, 3.2))

    if (!fusionActive && !exoActive) {
      // 位点全部归零：如果上一帧还在形变，做一次收尾把顶点复位
      if (this.activeIndices) {
        this.writeVertices(state, this.activeIndices)
        this.activeIndices = null
        this.lastKey = key
      }
      return
    }
    if (key === this.lastKey) return
    this.lastKey = key

    const merged =
      active.length === 1
        ? active[0]
        : (() => {
            const set = new Set<number>()
            active.forEach((arr) => arr.forEach((v) => set.add(v)))
            return new Int32Array([...set])
          })()
    this.activeIndices = merged
    this.writeVertices(state, merged)
  }

  dispose(): void {
    this.outer.dispose()
    this.core.dispose()
    this.inner.dispose()
    this.siteCache.clear()
  }
}
