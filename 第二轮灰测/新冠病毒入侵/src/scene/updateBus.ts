/**
 * 逐帧更新总线。
 *
 * 为什么不直接在每个组件里写 useFrame：
 *  1) **顺序确定**。膜的形变必须先算好，受体、磷脂、病毒体才能“贴”在正确的膜面上；
 *     相机必须最后更新，才能跟上本帧刚移动的物体。用一个显式 order 排序比依赖
 *     组件挂载顺序可靠得多。
 *  2) 只有一个 useFrame 订阅，减少每帧的回调与闭包开销。
 */

import { useEffect, useRef } from 'react'
import type { Camera, WebGLRenderer } from 'three'
import type { QualityTier } from '../three/quality'

export interface FrameContext {
  /** 播放头位置 p ∈ [0, 8] */
  p: number
  /** 帧间隔（秒），已限幅，避免切页面回来时炸掉动画 */
  dt: number
  /** 页面累计时间（秒） */
  elapsed: number
  /** 受播放速度影响的戏剧时间 */
  storyTime: number
  playing: boolean
  quality: QualityTier
  camera: Camera
  gl: WebGLRenderer
}

export type SceneUpdater = (ctx: FrameContext) => void

interface Entry {
  order: number
  fn: SceneUpdater
  id: number
}

let nextId = 1
let entries: Entry[] = []
let dirty = false

export const UPDATE_ORDER = {
  globals: 10,
  membrane: 20,
  receptors: 25,
  virion: 30,
  heroBinding: 40,
  nucleocapsid: 45,
  replication: 50,
  assembly: 60,
  egress: 70,
  organelles: 75,
  annotations: 85,
  camera: 90,
  effects: 95,
} as const

/**
 * 注册一个逐帧更新器（组件卸载时自动注销）。
 *
 * 用 ref 转发最新的回调：这样更新器里读到的永远是最新一次渲染的闭包，
 * 不会出现“订阅时捕获了旧 props / 旧 store 值”的经典 bug，调用方也无需声明依赖。
 */
export function useSceneUpdate(order: number, fn: SceneUpdater): void {
  const latest = useRef(fn)
  latest.current = fn
  useEffect(() => {
    const entry: Entry = { order, fn: (ctx) => latest.current(ctx), id: nextId++ }
    entries.push(entry)
    dirty = true
    return () => {
      entries = entries.filter((e) => e.id !== entry.id)
      dirty = true
    }
  }, [order])
}

/** 由 Experience 的单一 useFrame 调用。 */
export function runSceneUpdaters(ctx: FrameContext): void {
  if (dirty) {
    entries.sort((a, b) => a.order - b.order || a.id - b.id)
    dirty = false
  }
  for (let i = 0; i < entries.length; i++) entries[i].fn(ctx)
}
