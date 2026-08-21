/**
 * 播放头（playhead）——全片唯一的时间源。
 *
 * 核心设计：**场景中每一个物体的状态都是播放头位置 p 的纯函数**。
 * p ∈ [0, 8]，整数部分是步骤序号（0 基），小数部分是该步内的进度。
 *
 * 这样带来三个好处：
 *  1) 任意跳步、拖动进度条、倒放都能得到自洽的画面，不需要维护过渡状态机；
 *  2) 每帧只在 React 之外更新一个数字，不触发任何组件重渲染（60fps 的关键）；
 *  3) 自检与截图可以精确复现任意时刻的画面。
 */

import { STEPS } from '../data/steps'

export const STEP_COUNT = STEPS.length

export interface PlayheadState {
  /** 全局进度 p ∈ [0, STEP_COUNT] */
  p: number
  /** 页面累计时间（秒），供呼吸、布朗抖动等常驻动画使用；不受暂停影响 */
  elapsed: number
  /** 受播放速度影响的“戏剧时间”，暂停时不前进 */
  storyTime: number
}

export const playhead: PlayheadState = { p: 0, elapsed: 0, storyTime: 0 }

export const stepIndexOf = (p: number): number => Math.min(STEP_COUNT - 1, Math.max(0, Math.floor(p)))
export const stepProgressOf = (p: number): number => Math.min(1, Math.max(0, p - stepIndexOf(p)))

/** 直接跳到某一步的某个进度。 */
export function seek(stepIndex: number, t = 0): void {
  const i = Math.min(STEP_COUNT - 1, Math.max(0, stepIndex))
  playhead.p = i + Math.min(0.9999, Math.max(0, t))
}

/**
 * 按真实时间推进播放头。
 * 返回值：若跨越了步骤边界，返回新的步骤序号（供 UI 同步），否则返回 null。
 */
export function advance(dt: number, speed: number, loop: boolean): number | null {
  const before = stepIndexOf(playhead.p)
  const step = STEPS[before]
  const duration = Math.max(1, step.durationSec)
  playhead.p += (dt * speed) / duration

  if (playhead.p >= STEP_COUNT) {
    if (loop) playhead.p -= STEP_COUNT
    else playhead.p = STEP_COUNT - 0.0001
  }
  const after = stepIndexOf(playhead.p)
  return after === before ? null : after
}

/** 全片总时长（1x 速度，秒）。 */
export const totalDuration = STEPS.reduce((sum, s) => sum + s.durationSec, 0)

/** 已播放的绝对秒数（用于总进度条）。 */
export function absoluteSeconds(p: number): number {
  const i = stepIndexOf(p)
  let acc = 0
  for (let k = 0; k < i; k++) acc += STEPS[k].durationSec
  return acc + stepProgressOf(p) * STEPS[i].durationSec
}

/** 按绝对秒数定位（拖动总进度条时用）。返回落在哪一步。 */
export function seekAbsolute(seconds: number): number {
  let s = Math.max(0, Math.min(totalDuration - 0.001, seconds))
  for (let i = 0; i < STEP_COUNT; i++) {
    const d = STEPS[i].durationSec
    if (s < d) {
      playhead.p = i + s / d
      return i
    }
    s -= d
  }
  playhead.p = STEP_COUNT - 0.0001
  return STEP_COUNT - 1
}

/** 把秒数格式化成 m:ss。 */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
