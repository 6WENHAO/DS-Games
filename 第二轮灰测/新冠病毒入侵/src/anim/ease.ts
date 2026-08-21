/** 缓动与区间映射工具：整个演示的所有动画都由这些纯函数从播放头位置推导出来。 */

export const clamp = (x: number, a: number, b: number): number => (x < a ? a : x > b ? b : x)
export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
export const mix = lerp

/** 把 x 从 [a,b] 线性映射到 [0,1] 并截断。 */
export const remap = (x: number, a: number, b: number): number => (b === a ? (x >= b ? 1 : 0) : clamp01((x - a) / (b - a)))

export const smoothstep = (x: number): number => {
  const t = clamp01(x)
  return t * t * (3 - 2 * t)
}

export const smootherstep = (x: number): number => {
  const t = clamp01(x)
  return t * t * t * (t * (t * 6 - 15) + 10)
}

export const easeInQuad = (x: number): number => {
  const t = clamp01(x)
  return t * t
}

export const easeOutQuad = (x: number): number => {
  const t = clamp01(x)
  return 1 - (1 - t) * (1 - t)
}

export const easeOutCubic = (x: number): number => {
  const t = clamp01(x)
  return 1 - Math.pow(1 - t, 3)
}

export const easeInCubic = (x: number): number => {
  const t = clamp01(x)
  return t * t * t
}

export const easeInOutCubic = (x: number): number => {
  const t = clamp01(x)
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/** 轻微回弹：用于“RBD 抬起”“囊泡对接”这类带弹性的构象变化。 */
export const easeOutBack = (x: number, overshoot = 1.35): number => {
  const t = clamp01(x)
  const c3 = overshoot + 1
  return 1 + c3 * Math.pow(t - 1, 3) + overshoot * Math.pow(t - 1, 2)
}

/** 弹性衰减：蛋白酶“咬合”后的抖动。 */
export const easeOutElastic = (x: number): number => {
  const t = clamp01(x)
  if (t === 0 || t === 1) return t
  const c4 = (2 * Math.PI) / 3
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1
}

/** 单峰脉冲：0 → 1 → 0，用于闪光、切割瞬间的高亮。 */
export const pulse = (x: number): number => {
  const t = clamp01(x)
  return Math.sin(t * Math.PI)
}

/** 尖锐脉冲：能量释放瞬间（融合孔打开、切割）。 */
export const sharpPulse = (x: number, sharpness = 3): number => {
  const t = clamp01(x)
  return Math.pow(Math.sin(t * Math.PI), sharpness)
}

export type Easing = (x: number) => number

/** 播放头位于某个时间区间内的归一化进度（可选缓动）。这是全片动画的基本原语。 */
export function seg(p: number, range: readonly [number, number], easing: Easing = (x) => x): number {
  return easing(remap(p, range[0], range[1]))
}

/** 关键帧插值：keys 为 [位置, 值] 升序数组。 */
export function track(p: number, keys: readonly (readonly [number, number])[], easing: Easing = smoothstep): number {
  if (keys.length === 0) return 0
  if (p <= keys[0][0]) return keys[0][1]
  const last = keys[keys.length - 1]
  if (p >= last[0]) return last[1]
  for (let i = 0; i < keys.length - 1; i++) {
    const [p0, v0] = keys[i]
    const [p1, v1] = keys[i + 1]
    if (p >= p0 && p <= p1) return lerp(v0, v1, easing(remap(p, p0, p1)))
  }
  return last[1]
}

/** 指数趋近（与帧率无关的阻尼），用于相机与鼠标惯性。 */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt))
}

/** 角度阻尼：走最短弧线。 */
export function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  let delta = target - current
  while (delta > Math.PI) delta -= Math.PI * 2
  while (delta < -Math.PI) delta += Math.PI * 2
  return current + delta * (1 - Math.exp(-lambda * dt))
}
