/**
 * UI 状态（zustand）。
 *
 * 注意分工：**逐帧动画状态不进这里**（那些放在 src/anim/playhead.ts 的可变对象里），
 * 这里只保存会引起界面重渲染的低频状态，避免 60fps 下疯狂 re-render。
 */

import { create } from 'zustand'
import { seek } from '../anim/playhead'
import { STEPS } from '../data/steps'
import type { MoleculeId } from '../data/types'
import { detectQuality, type Quality } from '../three/quality'

export const SPEED_OPTIONS = [0.5, 1, 1.5, 2] as const
export type SpeedOption = (typeof SPEED_OPTIONS)[number]

export interface AppState {
  /** 当前步骤（0 基） */
  stepIndex: number
  playing: boolean
  speed: SpeedOption
  loop: boolean

  quality: Quality
  /** 是否允许根据实时帧率自动升降画质 */
  autoQuality: boolean
  fps: number
  showPerf: boolean

  /** 3D 标签总开关 */
  showLabels: boolean
  autoRotate: boolean
  /** 首帧渲染完成（用于淡出加载屏） */
  ready: boolean

  /** 当前选中的分子（点击 3D 结构或图例） */
  selected: MoleculeId | null
  /** 侧边信息面板展开状态（移动端默认收起） */
  panelOpen: boolean
  legendOpen: boolean
  glossaryOpen: boolean
  deepReadOpen: boolean
  helpOpen: boolean

  goToStep: (index: number, opts?: { keepPlaying?: boolean }) => void
  next: () => void
  prev: () => void
  togglePlay: () => void
  setPlaying: (playing: boolean) => void
  setSpeed: (speed: SpeedOption) => void
  cycleSpeed: () => void
  toggleLoop: () => void
  setQuality: (quality: Quality, manual?: boolean) => void
  setFps: (fps: number) => void
  togglePerf: () => void
  toggleLabels: () => void
  toggleAutoRotate: () => void
  setReady: () => void
  select: (id: MoleculeId | null) => void
  setPanelOpen: (open: boolean) => void
  toggleLegend: () => void
  toggleGlossary: () => void
  toggleDeepRead: () => void
  toggleHelp: () => void
  closeOverlays: () => void
}

const initialQuality = detectQuality()
const isNarrow = typeof window !== 'undefined' && window.innerWidth < 900

export const useAppStore = create<AppState>((set, get) => ({
  stepIndex: 0,
  playing: true,
  speed: 1,
  loop: true,

  quality: initialQuality,
  autoQuality: true,
  fps: 60,
  showPerf: false,

  showLabels: true,
  autoRotate: true,
  ready: false,

  selected: null,
  panelOpen: !isNarrow,
  legendOpen: !isNarrow,
  glossaryOpen: false,
  deepReadOpen: false,
  helpOpen: false,

  goToStep: (index, opts) => {
    const clamped = Math.min(STEPS.length - 1, Math.max(0, index))
    seek(clamped, 0)
    set({ stepIndex: clamped, selected: null, deepReadOpen: false })
    if (!opts?.keepPlaying) set({ playing: true })
  },
  next: () => {
    const { stepIndex, loop } = get()
    const last = STEPS.length - 1
    if (stepIndex >= last) {
      if (loop) get().goToStep(0)
      return
    }
    get().goToStep(stepIndex + 1)
  },
  prev: () => {
    const { stepIndex, loop } = get()
    if (stepIndex <= 0) {
      if (loop) get().goToStep(STEPS.length - 1)
      return
    }
    get().goToStep(stepIndex - 1)
  },
  togglePlay: () => set((s) => ({ playing: !s.playing })),
  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed }),
  cycleSpeed: () =>
    set((s) => {
      const i = SPEED_OPTIONS.indexOf(s.speed)
      return { speed: SPEED_OPTIONS[(i + 1) % SPEED_OPTIONS.length] }
    }),
  toggleLoop: () => set((s) => ({ loop: !s.loop })),
  setQuality: (quality, manual = false) => set(manual ? { quality, autoQuality: false } : { quality }),
  setFps: (fps) => set({ fps }),
  togglePerf: () => set((s) => ({ showPerf: !s.showPerf })),
  toggleLabels: () => set((s) => ({ showLabels: !s.showLabels })),
  toggleAutoRotate: () => set((s) => ({ autoRotate: !s.autoRotate })),
  setReady: () => set({ ready: true }),
  select: (id) => set((s) => ({ selected: id, panelOpen: id ? true : s.panelOpen, deepReadOpen: false })),
  setPanelOpen: (open) => set({ panelOpen: open }),
  toggleLegend: () => set((s) => ({ legendOpen: !s.legendOpen })),
  toggleGlossary: () => set((s) => ({ glossaryOpen: !s.glossaryOpen, helpOpen: false })),
  toggleDeepRead: () => set((s) => ({ deepReadOpen: !s.deepReadOpen })),
  toggleHelp: () => set((s) => ({ helpOpen: !s.helpOpen, glossaryOpen: false })),
  closeOverlays: () => set({ glossaryOpen: false, helpOpen: false }),
}))

/** 非 React 环境（逐帧代码）里读取状态的快捷方式。 */
export const appState = () => useAppStore.getState()
