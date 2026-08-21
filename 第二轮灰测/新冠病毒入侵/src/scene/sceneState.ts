/**
 * 场景共享可变状态。
 *
 * 由 order=globals 的更新器每帧从播放头重算，其余组件只读。
 * 所有值都是播放头 p 的纯函数（唯一例外是布朗抖动，它额外依赖真实时间），
 * 因此拖动进度条或跳步都不会出现状态错乱。
 */

import { Vector3 } from 'three'
import { clamp01, easeInOutCubic, easeOutCubic, lerp, remap, seg, sharpPulse, smoothstep } from '../anim/ease'
import { createMembraneState, type MembraneState } from '../three/membrane'
import { valueNoise1D } from '../three/rand'
import { SEG, WORLD } from './choreography'
import type { FrameContext } from './updateBus'

export interface SceneState {
  membrane: MembraneState
  virion: {
    pos: Vector3
    visible: boolean
    /** 囊膜不透明度（第 1 步剖切、融合时消融都靠它） */
    envelopeOpacity: number
    /** 剖切程度：1 = 完全看见内部核衣壳 */
    cutaway: number
    /** 融合进度：1 = 囊膜已完全并入细胞质膜 */
    merge: number
    /** 病毒体被拉扁的程度（半融合时底部贴膜） */
    flatten: number
  }
  rnp: {
    pos: Vector3
    visible: boolean
    /** 脱衣壳进度：N 蛋白解离、RNA 伸展 */
    uncoat: number
    /** 整体缩放（进入时略微挤压过孔） */
    squeeze: number
  }
  vesicle: {
    pos: Vector3
    visible: boolean
    scale: number
  }
  pore: {
    radius: number
    glow: number
  }
  /** 子代病毒释放进度 */
  release: number
  /** 当前是否处于胞内视角（用于把胞外雾气切换成胞质雾气） */
  insideCell: boolean
}

export const sceneState: SceneState = {
  membrane: createMembraneState(),
  virion: { pos: new Vector3().copy(WORLD.virionFar), visible: true, envelopeOpacity: 1, cutaway: 0, merge: 0, flatten: 0 },
  rnp: { pos: new Vector3(), visible: false, uncoat: 0, squeeze: 1 },
  vesicle: { pos: new Vector3().copy(WORLD.ergic), visible: false, scale: 1 },
  pore: { radius: 0, glow: 0 },
  release: 0,
  insideCell: false,
}

const _tmp = new Vector3()

/** 布朗运动式漂浮：越靠近受体，随机抖动越小（受体-配体作用逐步束缚住病毒）。 */
function brownian(out: Vector3, time: number, amplitude: number, seed = 0): Vector3 {
  out.set(
    (valueNoise1D(time * 0.53 + seed, 11) - 0.5) * 2,
    (valueNoise1D(time * 0.47 + seed + 5, 23) - 0.5) * 2,
    (valueNoise1D(time * 0.61 + seed + 9, 37) - 0.5) * 2,
  )
  return out.multiplyScalar(amplitude)
}

/** 病毒体中心位置：远处 → 悬停 → 对接 → 被拉向膜面 → 融合消失。 */
function updateVirion(p: number, elapsed: number): void {
  const v = sceneState.virion
  const approach = seg(p, SEG.approach, easeInOutCubic)
  const dock = seg(p, SEG.dock, easeInOutCubic)
  const pull = seg(p, SEG.membranePull, easeInOutCubic)
  const merge = seg(p, SEG.envelopeMerge, smoothstep)

  v.pos.copy(WORLD.virionFar).lerp(WORLD.virionHover, approach)
  v.pos.lerp(WORLD.virionDock, dock)
  v.pos.lerp(WORLD.virionFused, pull)

  // 抖动幅度：自由扩散时明显，结合后几乎静止
  const freedom = (1 - dock) * (1 - pull)
  const amp = lerp(0.012, 0.14, freedom)
  v.pos.add(brownian(_tmp, elapsed, amp))

  v.cutaway = seg(p, SEG.cutaway, smoothstep) * (p < 1.05 ? 1 : Math.max(0, 1 - remap(p, 1.0, 1.25)))
  v.merge = merge
  v.flatten = seg(p, [SEG.membranePull[0], SEG.hemifusion[1]] as const, smoothstep) * (1 - merge * 0.4)
  v.envelopeOpacity = (1 - merge) * lerp(1, 0.55, v.cutaway)
  v.visible = merge < 0.995 && p < 4.4
}

/** 细胞质膜的两处形变：进入位点的融合孔、出胞位点的胞吐孔。 */
function updateMembrane(p: number): void {
  const m = sceneState.membrane

  // —— 进入位点 ——
  const pull = seg(p, SEG.membranePull, easeInOutCubic)
  const hemi = seg(p, SEG.hemifusion, smoothstep)
  const open = seg(p, SEG.poreOpen, easeOutCubic)
  const close = seg(p, SEG.poreClose, smoothstep)
  m.fusion.x = WORLD.fusion.x
  m.fusion.z = WORLD.fusion.z
  // 膜先被拉向病毒（正值 = 朝胞外隆起），融合后隆起回落。
  // 峰值 0.22 与 WORLD.virionFused 的高度互补：病毒体底面此刻正好落在隆起顶端。
  m.fusion.bulge = (0.16 * pull + 0.06 * hemi) * (1 - close * 0.9)
  m.fusion.pore = 0.56 * open * (1 - close)
  m.fusion.rim = 0.075 * open * (1 - close)

  // —— 出胞位点 ——
  const exoPush = seg(p, [SEG.exoFuse[0], SEG.exoFuse[0] + 0.12] as const, easeInOutCubic)
  const exoOpen = seg(p, [SEG.exoFuse[0] + 0.08, SEG.release[0] + 0.08] as const, easeOutCubic)
  const exoClose = seg(p, [SEG.release[1] - 0.06, 8.0] as const, smoothstep)
  m.exo.x = WORLD.exo.x
  m.exo.z = WORLD.exo.z
  m.exo.bulge = 0.34 * exoPush * (1 - exoClose)
  m.exo.pore = 0.46 * exoOpen * (1 - exoClose)
  m.exo.rim = 0.06 * exoOpen * (1 - exoClose)

  sceneState.pore.radius = m.fusion.pore
  sceneState.pore.glow = sharpPulse(remap(p, SEG.poreOpen[0], SEG.poreOpen[1]), 2) * 0.9 + 0.25 * open * (1 - close)
}

/** 核衣壳：先在病毒体内部，穿过融合孔进入细胞质，随后脱衣壳。 */
function updateRnp(p: number): void {
  const r = sceneState.rnp
  const enter = seg(p, SEG.rnpEnter, easeInOutCubic)
  r.uncoat = seg(p, SEG.uncoat, smoothstep)

  if (enter <= 0) {
    // 还在病毒体内部：跟随病毒体中心（透过半透明囊膜可见）
    r.pos.copy(sceneState.virion.pos)
    r.squeeze = 1
    r.visible = true
    return
  }

  // 起点：病毒体内部；中途穿过孔（0,0,0）；终点：细胞质停留点
  if (enter < 0.5) {
    const k = enter / 0.5
    r.pos.copy(WORLD.virionFused).lerp(WORLD.fusion, easeOutCubic(k))
  } else {
    const k = (enter - 0.5) / 0.5
    r.pos.copy(WORLD.fusion).lerp(WORLD.rnpCytoplasm, easeInOutCubic(k))
  }
  // 过孔时被轻微挤压
  const squeeze = Math.sin(clamp01(remap(p, SEG.rnpEnter[0] + 0.06, SEG.rnpEnter[0] + 0.22)) * Math.PI)
  r.squeeze = 1 - squeeze * 0.24
  r.visible = r.uncoat < 0.995
}

/** 分泌囊泡：从 ERGIC 沿分泌途径运到质膜。 */
function updateVesicle(p: number): void {
  const v = sceneState.vesicle
  const load = seg(p, SEG.vesicleLoad, smoothstep)
  const travel = seg(p, SEG.vesicleTravel, easeInOutCubic)
  const fuse = seg(p, SEG.exoFuse, smoothstep)

  // 路径：ERGIC → 中途上行（略微绕过细胞器）→ 质膜出胞位点内侧
  const mid = _tmp.set(WORLD.exo.x + 0.9, WORLD.ergic.y * 0.45, WORLD.exo.z - 0.7)
  if (travel < 0.55) {
    const k = travel / 0.55
    v.pos.copy(WORLD.ergic).lerp(mid, easeInOutCubic(k))
  } else {
    const k = (travel - 0.55) / 0.45
    v.pos.copy(mid).lerp(WORLD.exo.clone().setY(-0.62), easeInOutCubic(k))
  }
  v.scale = lerp(0.2, 1, load) * lerp(1, 0.35, fuse)
  v.visible = load > 0.02 && fuse < 0.98
  sceneState.release = seg(p, SEG.release, easeOutCubic)
}

/** 全局状态更新（order = globals，必须最先执行）。 */
export function updateSceneGlobals(ctx: FrameContext): void {
  const { p, elapsed } = ctx
  updateVirion(p, elapsed)
  updateMembrane(p)
  updateRnp(p)
  updateVesicle(p)
  sceneState.insideCell = ctx.camera.position.y < 0.05
}
