/**
 * 灯光方案（电影级三点光 + 生物荧光感的局部光）。
 *
 * 设计意图：
 *  · 冷色主光从上方打下来，塑造细胞膜与细胞器的体积感；
 *  · 暖色轮廓光从病毒一侧打过来，把“入侵者”与“宿主”在色温上分开；
 *  · 融合位点与 RNA 各有一盏跟随的局部光，让关键分子自己会“发光”，
 *    配合后处理的泛光形成荧光标记的观感；
 *  · 用 drei 的 Environment + Lightformer 现场烘焙一张环境贴图（不依赖任何外部 HDR 文件），
 *    半透明膜与蛋白质表面才会有细腻的反射层次。
 */

import { Environment, Lightformer } from '@react-three/drei'
import { useRef } from 'react'
import type { PointLight } from 'three'
import { lerp, pulse, remap, seg, smoothstep } from '../anim/ease'
import { COLORS } from '../three/palette'
import { SEG, WORLD } from './choreography'
import { sceneState } from './sceneState'
import { UPDATE_ORDER, useSceneUpdate } from './updateBus'

export function Lighting() {
  const fusionLight = useRef<PointLight>(null)
  const rnaLight = useRef<PointLight>(null)
  const virionLight = useRef<PointLight>(null)

  useSceneUpdate(UPDATE_ORDER.effects, ({ p, elapsed }) => {
    // 结合与融合瞬间的青蓝闪光
    if (fusionLight.current) {
      const bind = pulse(remap(p, SEG.bindFlash[0], SEG.bindFlash[1]))
      const cut = pulse(remap(p, SEG.cleave[0], SEG.cleave[1]))
      const pore = sceneState.pore.glow
      const base = p > 2 && p < 5.2 ? 0.5 : 0
      fusionLight.current.intensity = base + bind * 4 + cut * 5 + pore * 6
      fusionLight.current.position.set(0, 0.35 + sceneState.membrane.fusion.bulge * 0.5, 0)
    }
    // RNA 的荧光绿跟随光源
    if (rnaLight.current) {
      const active = p > 4.05 && p < 7.1
      const target = active ? lerp(2.2, 5.5, seg(p, SEG.uncoat, smoothstep)) : 0
      rnaLight.current.intensity = target * (0.85 + 0.15 * Math.sin(elapsed * 2.1))
      if (p < 4.9) rnaLight.current.position.copy(sceneState.rnp.pos)
      else rnaLight.current.position.set(WORLD.rnaZone.x, WORLD.rnaZone.y, WORLD.rnaZone.z)
    }
    // 病毒体自身的暖色补光，随病毒移动
    if (virionLight.current) {
      virionLight.current.position.copy(sceneState.virion.pos)
      virionLight.current.intensity = sceneState.virion.visible ? 2.6 : 0
    }
  })

  return (
    <>
      {/*
        整体照度刻意压得很低：深色微观背景是需求的基调，
        画面的"亮"应该来自关键分子的自发光 + 泛光，而不是环境光把一切照白。
        （这一版的曝光是按截图像素统计调过的：平均亮度目标 0.12–0.22）
      */}
      <ambientLight intensity={0.13} color="#16283f" />
      <hemisphereLight args={['#0f2b49', '#03080f', 0.22]} />

      {/* 主光：冷白，自胞外上方打下 */}
      <directionalLight position={[7, 11, 6]} intensity={0.85} color="#d3e8ff" />
      {/* 轮廓光：暖色，来自病毒一侧 */}
      <directionalLight position={[-8, 4, -7]} intensity={0.48} color="#ff9d6b" />
      {/* 底部反射光：细胞质的幽蓝散射 */}
      <directionalLight position={[-2, -9, 3]} intensity={0.22} color="#2d7fa8" />

      {/* 细胞质整体氛围光 */}
      <pointLight position={[0.5, -4.5, 1]} intensity={9} distance={26} decay={1.7} color="#2a6fa8" />
      <pointLight position={[WORLD.ergic.x, WORLD.ergic.y + 1, WORLD.ergic.z]} intensity={5} distance={14} decay={1.8} color="#8f7fd6" />

      {/* 事件驱动的局部光 */}
      <pointLight ref={fusionLight} position={[0, 0.35, 0]} intensity={0} distance={7} decay={1.5} color={COLORS.accent} />
      <pointLight ref={rnaLight} position={[0, -1, 0]} intensity={0} distance={9} decay={1.6} color={COLORS.rna} />
      <pointLight ref={virionLight} position={[0, 7, 0]} intensity={0} distance={6} decay={1.8} color="#ffb184" />

      {/* 现场烘焙的环境反射（frames=1：只渲染一次，零持续开销） */}
      <Environment resolution={128} frames={1} background={false}>
        <Lightformer form="rect" intensity={0.95} color="#8fc4ff" scale={[18, 18, 1]} position={[0, 16, 0]} rotation={[-Math.PI / 2, 0, 0]} />
        <Lightformer form="rect" intensity={0.6} color="#ff9a5e" scale={[12, 12, 1]} position={[-14, 2, -10]} rotation={[0, Math.PI / 3, 0]} />
        <Lightformer form="rect" intensity={0.5} color="#22d3ee" scale={[12, 12, 1]} position={[14, 1, 8]} rotation={[0, -Math.PI / 3, 0]} />
        <Lightformer form="circle" intensity={0.3} color="#12304f" scale={[26, 26, 1]} position={[0, -18, 0]} rotation={[Math.PI / 2, 0, 0]} />
      </Environment>
    </>
  )
}
