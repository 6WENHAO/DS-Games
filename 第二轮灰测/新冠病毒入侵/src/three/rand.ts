/** 确定性伪随机数：保证每次加载的病毒体刺突分布、细胞器摆放完全一致（便于截图核对与教学复现）。 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 斐波那契球面分布：把 n 个点近似均匀铺在单位球面上（用于刺突三聚体、M/E 蛋白布点）。 */
export function fibonacciSphere(n: number, out?: [number, number, number][]): [number, number, number][] {
  const points = out ?? []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / Math.max(1, n - 1)) * 2
    const radius = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * i
    points.push([Math.cos(theta) * radius, y, Math.sin(theta) * radius])
  }
  return points
}

/** 平滑的一维值噪声（周期性），用于布朗抖动与膜起伏。 */
export function valueNoise1D(x: number, seed = 0): number {
  const i = Math.floor(x)
  const f = x - i
  const s = f * f * (3 - 2 * f)
  const h = (n: number) => {
    let t = (n * 374761393 + seed * 668265263) >>> 0
    t = (t ^ (t >>> 13)) >>> 0
    t = Math.imul(t, 1274126177) >>> 0
    return ((t ^ (t >>> 16)) >>> 0) / 4294967296
  }
  return h(i) * (1 - s) + h(i + 1) * s
}

/** 二维平滑噪声，用于膜表面的低频起伏（细胞膜不是理想平面）。 */
export function valueNoise2D(x: number, y: number, seed = 0): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const h = (a: number, b: number) => {
    let t = (a * 1597334677 + b * 3812015801 + seed * 2246822519) >>> 0
    t = (t ^ (t >>> 15)) >>> 0
    t = Math.imul(t, 2654435761) >>> 0
    return ((t ^ (t >>> 13)) >>> 0) / 4294967296
  }
  const n00 = h(xi, yi)
  const n10 = h(xi + 1, yi)
  const n01 = h(xi, yi + 1)
  const n11 = h(xi + 1, yi + 1)
  return (n00 * (1 - u) + n10 * u) * (1 - v) + (n01 * (1 - u) + n11 * u) * v
}
