/**
 * 各条 RNA 链的空间路径。
 *
 * 全部为**单链**走向（自由弯曲的柔性长链），刻意避免任何双螺旋形态 ——
 * SARS-CoV-2 的遗传物质是正义单链 RNA（+ssRNA），不是 DNA 双螺旋。
 *
 * 各链的角色：
 *   genome —— 脱衣壳后进入细胞质、被核糖体直接翻译的基因组 +ssRNA（约 29.9 kb）
 *   minus  —— 复制中间体：负义 RNA 模板（−RNA），位于双膜囊泡内
 *   plus   —— 以 −RNA 为模板新合成的子代 +RNA
 *   sg     —— 不连续转录产生的嵌套亚基因组 mRNA，运到内质网翻译结构蛋白
 */

import { CatmullRomCurve3, Vector3 } from 'three'
import { mulberry32 } from '../three/rand'
import { DMV_RADIUS, WORLD } from './choreography'

/** 生成一条柔性单链的控制点：带方向偏好的随机游走，限制在一个椭球范围内。 */
function meander(
  center: Vector3,
  extent: [number, number, number],
  count: number,
  seed: number,
  bias: Vector3 = new Vector3(1, 0, 0),
): Vector3[] {
  const rng = mulberry32(seed)
  const pts: Vector3[] = []
  const dir = bias.clone().normalize()
  const cur = center.clone().addScaledVector(dir, -extent[0] * 0.45)
  const step = (extent[0] * 1.7) / count
  for (let i = 0; i < count; i++) {
    pts.push(cur.clone())
    dir
      .add(new Vector3((rng() - 0.5) * 0.9, (rng() - 0.5) * 1.35, (rng() - 0.5) * 1.1))
      .normalize()
      .lerp(bias.clone().normalize(), 0.34)
      .normalize()
    cur.addScaledVector(dir, step * (0.7 + rng() * 0.6))
    // 软约束回椭球内
    const d = cur.clone().sub(center)
    d.x /= extent[0]
    d.y /= extent[1]
    d.z /= extent[2]
    const len = d.length()
    if (len > 1) {
      d.multiplyScalar(1 / len)
      cur.set(center.x + d.x * extent[0], center.y + d.y * extent[1], center.z + d.z * extent[2])
    }
  }
  return pts
}

/** 基因组 +ssRNA 在细胞质中的伸展形态（也是核糖体翻译时行走的轨道）。 */
export const GENOME_PATH: Vector3[] = meander(WORLD.rnaZone, [2.8, 1.0, 1.9], 34, 20250501, new Vector3(1, -0.12, 0.35))

/** 复制中间体：DMV 内的 −义模板链。 */
export const MINUS_PATH: Vector3[] = meander(
  new Vector3(WORLD.dmv.x - 0.2, WORLD.dmv.y + 0.1, WORLD.dmv.z),
  [DMV_RADIUS * 0.62, DMV_RADIUS * 0.42, DMV_RADIUS * 0.5],
  22,
  20250502,
  new Vector3(1, 0.2, -0.4),
)

/** 新合成的子代 +RNA（与模板并排但**各自独立**，不是双螺旋）。 */
export const PLUS_PATH: Vector3[] = MINUS_PATH.map((p, i) =>
  p.clone().add(new Vector3(0.16, 0.2 + Math.sin(i * 0.7) * 0.05, 0.18)),
)

/** 两条亚基因组 mRNA：从 DMV 孔道输出，指向内质网方向。 */
export const SG_PATHS: Vector3[][] = [
  meander(new Vector3(WORLD.dmv.x + 1.9, WORLD.dmv.y - 0.7, WORLD.dmv.z + 0.9), [1.5, 0.5, 0.9], 14, 20250503, new Vector3(1, -0.35, 0.4)),
  meander(new Vector3(WORLD.dmv.x + 2.4, WORLD.dmv.y - 1.5, WORLD.dmv.z + 0.2), [1.3, 0.45, 0.8], 12, 20250504, new Vector3(1, -0.5, 0.2)),
]

export const GENOME_CURVE = new CatmullRomCurve3(GENOME_PATH, false, 'catmullrom', 0.5)

/**
 * 取一条链“长到 t 比例”的控制点集合（用于 RNA 边合成边变长的动画）。
 *
 * 末端点在两个控制点之间插值，因此增长是连续的、不会一节一节地跳。
 * 复用传入的 scratch 数组，避免每帧新建 Vector3。
 */
export function partialPath(path: Vector3[], t: number, scratch: Vector3[]): Vector3[] {
  const clamped = Math.max(0, Math.min(1, t))
  const total = path.length
  const exact = 1 + clamped * (total - 1)
  const n = Math.max(2, Math.floor(exact))
  const frac = Math.min(1, exact - n + 1)
  const out: Vector3[] = []
  for (let i = 0; i < n - 1; i++) {
    scratch[i].copy(path[i])
    out.push(scratch[i])
  }
  const last = Math.min(total - 1, n - 1)
  scratch[n - 1].copy(path[last - 1]).lerp(path[last], frac)
  out.push(scratch[n - 1])
  return out
}

/** 5′ 端（帽结构）与 3′ 端（poly(A) 尾）在基因组链上的位置。 */
export const GENOME_FIVE_PRIME = GENOME_PATH[0]
export const GENOME_THREE_PRIME = GENOME_PATH[GENOME_PATH.length - 1]
