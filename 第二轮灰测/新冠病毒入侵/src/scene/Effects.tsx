/**
 * 后处理：泛光（让荧光标记的分子真正“发光”）+ 暗角 + 高画质下的景深。
 *
 * 泛光阈值调得较高，只有自发光的关键分子（RNA、结合位点闪光、融合孔）会溢出光晕，
 * 细胞器与膜不会糊成一片 —— 这是“科学可视化”而不是“霓虹灯”的分界线。
 */

import { Bloom, DepthOfField, EffectComposer, Vignette } from '@react-three/postprocessing'
import type { ReactElement } from 'react'
import type { QualityTier } from '../three/quality'
import { rigTarget } from './CameraRig'

export function Effects({ tier }: { tier: QualityTier }) {
  if (!tier.postprocessing) return null

  const effects: ReactElement[] = [
    <Bloom key="bloom" mipmapBlur luminanceThreshold={0.52} luminanceSmoothing={0.28} intensity={1.05} radius={0.72} />,
  ]
  if (tier.depthOfField) {
    effects.push(<DepthOfField key="dof" target={rigTarget} focalLength={0.02} bokehScale={2.2} height={480} />)
  }
  effects.push(<Vignette key="vignette" offset={0.28} darkness={0.7} />)

  return (
    <EffectComposer multisampling={tier.multisampling} enableNormalPass={false}>
      {effects}
    </EffectComposer>
  )
}
