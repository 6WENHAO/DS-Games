/**
 * 第 8 步：胞吐释放。
 *
 * 分子事件：装配好的子代病毒被包进**分泌囊泡**，沿细胞骨架（微管）运到细胞质膜，
 * 囊泡膜与质膜融合、打开一个孔，把病毒释放到胞外 —— 这是“出胞”，不是“撑破细胞”。
 *
 * 前沿说明：近年有证据显示 β 冠状病毒还可借**去酸化的溶酶体**途径外排；
 * 本演示以经典的分泌囊泡胞吐为主线，替代路线在信息面板的“深入阅读”中标注证据强度。
 */

import { useMemo, useRef } from 'react'
import { CatmullRomCurve3, type Mesh, type MeshPhysicalMaterial, TubeGeometry, Vector3 } from 'three'
import { easeInOutCubic, lerp, remap, seg, smoothstep } from '../anim/ease'
import { buildVesicleGeometry } from '../three/geometry/organelles'
import { membraneMaterial, organelleMaterial } from '../three/materials'
import { COLORS } from '../three/palette'
import { Annotation, usePick, useStepIn } from './Annotation'
import { SEG, WORLD } from './choreography'
import { sceneState } from './sceneState'
import { UPDATE_ORDER, useSceneUpdate } from './updateBus'

export function Egress({ detail }: { detail: number }) {
  const vesicleGeo = useMemo(() => buildVesicleGeometry(1.35, Math.min(3, detail + 1), 701), [detail])
  const vesicleMat = useMemo(
    () =>
      membraneMaterial(COLORS.vesicle, {
        opacity: 0.34,
        repeat: 16,
        repeatY: 8,
        normalScale: 0.55,
        emissive: 0.08,
        sheenColor: '#bfe0ff',
      }).clone(),
    [],
  )
  const microtubuleMat = useMemo(() => organelleMaterial('#54708f', { opacity: 0.4, emissive: 0.04, roughness: 0.8 }), [])

  // 微管轨道：从装配区通向质膜出胞位点
  const microtubules = useMemo(() => {
    const make = (offset: Vector3) =>
      new TubeGeometry(
        new CatmullRomCurve3(
          [
            new Vector3(WORLD.ergic.x - 1.2, WORLD.ergic.y - 0.6, WORLD.ergic.z + 0.4).add(offset),
            new Vector3(WORLD.exo.x + 1.4, WORLD.ergic.y * 0.5, WORLD.exo.z - 0.6).add(offset),
            new Vector3(WORLD.exo.x + 0.3, -0.9, WORLD.exo.z - 0.2).add(offset),
          ],
          false,
          'catmullrom',
          0.5,
        ),
        26,
        0.035,
        6,
        false,
      )
    return [make(new Vector3(0, 0, 0)), make(new Vector3(0.55, -0.35, 0.75))]
  }, [])

  const vesicleRef = useRef<Mesh>(null)
  const vesiclePick = usePick('secretory-vesicle')
  const showEgressLabels = useStepIn(8)

  useSceneUpdate(UPDATE_ORDER.egress, ({ p, elapsed }) => {
    if (!vesicleRef.current) return
    const v = sceneState.vesicle
    vesicleRef.current.visible = v.visible
    vesicleRef.current.position.copy(v.pos)
    // 融合瞬间被摊平并并入质膜
    const fuse = seg(p, SEG.exoFuse, easeInOutCubic)
    const flat = lerp(1, 0.35, fuse)
    vesicleRef.current.scale.set(v.scale * lerp(1, 1.3, fuse), v.scale * flat, v.scale * lerp(1, 1.3, fuse))
    vesicleRef.current.rotation.y = elapsed * 0.15
    ;(vesicleRef.current.material as MeshPhysicalMaterial).opacity = 0.34 * (1 - smoothstep(remap(fuse, 0.55, 1)))
  })

  return (
    <group>
      {microtubules.map((g, i) => (
        <mesh key={i} geometry={g} material={microtubuleMat} renderOrder={8} dispose={null} />
      ))}
      <mesh ref={vesicleRef} geometry={vesicleGeo} material={vesicleMat} renderOrder={19} dispose={null} {...vesiclePick} />

      <Annotation
        id="secretory-vesicle"
        position={[WORLD.exo.x + 1.5, -1.4, WORLD.exo.z - 1.0]}
        side="right"
        label="分泌囊泡（沿微管运输）"
        hidden={!showEgressLabels}
        lead={34}
      />
      <Annotation
        id="progeny-virion"
        position={[WORLD.exo.x - 0.4, 1.5, WORLD.exo.z + 0.6]}
        side="left"
        label="子代病毒被释放，去感染下一个细胞"
        hidden={!showEgressLabels}
        lead={40}
      />
    </group>
  )
}
