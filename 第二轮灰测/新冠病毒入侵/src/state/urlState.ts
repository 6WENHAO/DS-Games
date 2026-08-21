/**
 * URL 参数覆盖：用于深链接、教学预设与自动化截图。
 *
 *   ?step=4          直接从第 4 步开始（1–8）
 *   &t=0.55          该步内的进度（0–1）
 *   &paused=1        载入后暂停（便于讲解或截图）
 *   &quality=high    强制画质 low | medium | high（同时关闭自动升降档）
 *   &labels=0        关闭 3D 标签
 *   &rotate=0        关闭自动旋转
 *   &panel=0         收起信息面板
 *   &legend=0        收起图例
 *   &perf=1          显示帧率
 *
 * 例：?step=4&t=0.6&paused=1&quality=high —— 定格在“融合孔打开”的瞬间。
 */

import { seek } from '../anim/playhead'
import { STEPS } from '../data/steps'
import type { Quality } from '../three/quality'
import { useAppStore } from './store'

const QUALITIES: Quality[] = ['low', 'medium', 'high']

function bool(value: string | null, fallback: boolean): boolean {
  if (value === null) return fallback
  return value !== '0' && value !== 'false' && value !== 'off'
}

export function applyUrlOverrides(search: string = window.location.search): void {
  const params = new URLSearchParams(search)
  if ([...params.keys()].length === 0) return

  const store = useAppStore.getState()

  const stepRaw = Number(params.get('step'))
  const tRaw = Number(params.get('t'))
  const stepIndex = Number.isFinite(stepRaw) && stepRaw >= 1 ? Math.min(STEPS.length, Math.floor(stepRaw)) - 1 : 0
  const t = Number.isFinite(tRaw) ? Math.max(0, Math.min(0.999, tRaw)) : 0
  if (params.has('step') || params.has('t')) {
    seek(stepIndex, t)
    useAppStore.setState({ stepIndex })
  }

  if (params.has('paused')) useAppStore.setState({ playing: !bool(params.get('paused'), false) })
  if (params.has('quality')) {
    const q = params.get('quality') as Quality | null
    if (q && QUALITIES.includes(q)) store.setQuality(q, true)
  }
  if (params.has('labels')) useAppStore.setState({ showLabels: bool(params.get('labels'), true) })
  if (params.has('rotate')) useAppStore.setState({ autoRotate: bool(params.get('rotate'), true) })
  if (params.has('panel')) useAppStore.setState({ panelOpen: bool(params.get('panel'), true) })
  if (params.has('legend')) useAppStore.setState({ legendOpen: bool(params.get('legend'), true) })
  if (params.has('perf')) useAppStore.setState({ showPerf: bool(params.get('perf'), false) })
}
