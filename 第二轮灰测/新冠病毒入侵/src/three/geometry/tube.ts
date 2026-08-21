/**
 * 可实时形变的管状几何（RNA 链、多肽链、内质网小管）。
 *
 * 关键点：顶点缓冲只分配一次，之后每帧就地更新，避免每帧重建 TubeGeometry
 * 造成的 GC 抖动 —— 这是“RNA 从盘绕的核衣壳伸展成细胞质中长链”这段动画
 * 能稳定跑在 60fps 的原因。
 *
 * 走样处理：使用平行传输（parallel transport）帧而不是 Frenet 帧，
 * 曲线出现直线段或急弯时不会翻滚。
 */

import { BufferAttribute, BufferGeometry, CatmullRomCurve3, Vector3 } from 'three'

export interface TubeRibbonOptions {
  /** 沿轴向的分段数 */
  segments: number
  /** 截面圆周分段数 */
  radial: number
  /** 基础半径 */
  radius: number
  /**
   * 半径沿轴向的调制：用于让 RNA 呈现“核苷酸串珠”的颗粒感，
   * 从而在视觉上明确区别于 DNA 双螺旋。
   */
  beadFrequency?: number
  beadAmplitude?: number
}

export class TubeRibbon {
  readonly geometry: BufferGeometry
  private readonly segments: number
  private readonly radial: number
  private radius: number
  private readonly beadFrequency: number
  private readonly beadAmplitude: number
  private readonly positions: Float32Array
  private readonly normals: Float32Array
  private readonly samples: Vector3[]
  private readonly tangents: Vector3[]
  private readonly frameN: Vector3[]
  private readonly frameB: Vector3[]

  constructor(opts: TubeRibbonOptions) {
    this.segments = opts.segments
    this.radial = opts.radial
    this.radius = opts.radius
    this.beadFrequency = opts.beadFrequency ?? 0
    this.beadAmplitude = opts.beadAmplitude ?? 0

    const ringCount = this.segments + 1
    const vertexCount = ringCount * (this.radial + 1)
    this.positions = new Float32Array(vertexCount * 3)
    this.normals = new Float32Array(vertexCount * 3)
    const uvs = new Float32Array(vertexCount * 2)
    for (let i = 0; i < ringCount; i++) {
      for (let j = 0; j <= this.radial; j++) {
        const k = i * (this.radial + 1) + j
        uvs[k * 2] = i / this.segments
        uvs[k * 2 + 1] = j / this.radial
      }
    }

    const indices: number[] = []
    for (let i = 0; i < this.segments; i++) {
      for (let j = 0; j < this.radial; j++) {
        const a = i * (this.radial + 1) + j
        const b = a + this.radial + 1
        indices.push(a, b, a + 1, b, b + 1, a + 1)
      }
    }

    this.geometry = new BufferGeometry()
    this.geometry.setAttribute('position', new BufferAttribute(this.positions, 3))
    this.geometry.setAttribute('normal', new BufferAttribute(this.normals, 3))
    this.geometry.setAttribute('uv', new BufferAttribute(uvs, 2))
    this.geometry.setIndex(indices)

    this.samples = Array.from({ length: ringCount }, () => new Vector3())
    this.tangents = Array.from({ length: ringCount }, () => new Vector3())
    this.frameN = Array.from({ length: ringCount }, () => new Vector3())
    this.frameB = Array.from({ length: ringCount }, () => new Vector3())
  }

  setRadius(radius: number): void {
    this.radius = radius
  }

  /** 用一组控制点更新管道形状（控制点数量可与分段数不同）。 */
  update(controlPoints: Vector3[], radiusScale = 1): void {
    if (controlPoints.length < 2) return
    const curve = new CatmullRomCurve3(controlPoints, false, 'catmullrom', 0.5)
    const ringCount = this.segments + 1

    for (let i = 0; i < ringCount; i++) {
      const t = i / this.segments
      curve.getPoint(t, this.samples[i])
      curve.getTangent(t, this.tangents[i])
      if (this.tangents[i].lengthSq() < 1e-8) this.tangents[i].set(0, 1, 0)
      else this.tangents[i].normalize()
    }

    // 平行传输帧：第一个法线任选，其后逐段最小旋转传递
    const up = new Vector3(0, 1, 0)
    const t0 = this.tangents[0]
    const seed = Math.abs(t0.dot(up)) > 0.9 ? new Vector3(1, 0, 0) : up
    this.frameN[0].copy(seed).cross(t0).normalize()
    if (this.frameN[0].lengthSq() < 1e-8) this.frameN[0].set(1, 0, 0)
    this.frameB[0].copy(t0).cross(this.frameN[0]).normalize()

    const tmp = new Vector3()
    for (let i = 1; i < ringCount; i++) {
      const prevT = this.tangents[i - 1]
      const curT = this.tangents[i]
      this.frameN[i].copy(this.frameN[i - 1])
      tmp.copy(prevT).cross(curT)
      const sin = tmp.length()
      if (sin > 1e-6) {
        tmp.divideScalar(sin)
        const angle = Math.atan2(sin, prevT.dot(curT))
        this.frameN[i].applyAxisAngle(tmp, angle)
      }
      // 重新正交化，抑制累积误差
      this.frameN[i].sub(curT.clone().multiplyScalar(this.frameN[i].dot(curT))).normalize()
      this.frameB[i].copy(curT).cross(this.frameN[i]).normalize()
    }

    const pos = this.positions
    const nor = this.normals
    for (let i = 0; i < ringCount; i++) {
      const center = this.samples[i]
      const n = this.frameN[i]
      const b = this.frameB[i]
      const bead =
        this.beadAmplitude > 0 ? 1 + Math.sin((i / this.segments) * this.beadFrequency * Math.PI * 2) * this.beadAmplitude : 1
      const r = this.radius * radiusScale * bead
      for (let j = 0; j <= this.radial; j++) {
        const a = (j / this.radial) * Math.PI * 2
        const cx = Math.cos(a)
        const sy = Math.sin(a)
        const nx = n.x * cx + b.x * sy
        const ny = n.y * cx + b.y * sy
        const nz = n.z * cx + b.z * sy
        const k = (i * (this.radial + 1) + j) * 3
        pos[k] = center.x + nx * r
        pos[k + 1] = center.y + ny * r
        pos[k + 2] = center.z + nz * r
        nor[k] = nx
        nor[k + 1] = ny
        nor[k + 2] = nz
      }
    }

    this.geometry.attributes.position.needsUpdate = true
    this.geometry.attributes.normal.needsUpdate = true
    this.geometry.computeBoundingSphere()
  }

  dispose(): void {
    this.geometry.dispose()
  }
}
