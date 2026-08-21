/**
 * 宿主细胞表面的受体“森林”：ACE2 与 TMPRSS2 的实例化布场。
 *
 * 科学说明：真实气道上皮细胞表面 ACE2 的密度并不高，且与 TMPRSS2 常在同一膜微区
 * 共定位（这正是质膜融合途径高效的原因）。画面里的数量是示意性的（大幅简化），
 * 但两者的空间关系、朝向（胞外域朝上、跨膜段插进双分子层）都是准确的。
 *
 * 所有受体都跟随膜的形变场：膜隆起时它们被一起抬起，融合孔打开时孔内的受体被推向孔沿。
 */

import { useMemo, useRef } from 'react'
import { type InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three'
import { buildAce2Geometry, buildTmprss2Geometry } from '../three/geometry/hostSurface'
import { proteinMaterial } from '../three/materials'
import { sampleMembrane } from '../three/membrane'
import { COLORS } from '../three/palette'
import { mulberry32, valueNoise1D } from '../three/rand'
import { Annotation, usePick, useStepIn } from './Annotation'
import { WORLD } from './choreography'
import { sceneState } from './sceneState'
import { UPDATE_ORDER, useSceneUpdate } from './updateBus'

const UP = new Vector3(0, 1, 0)
const _pos = new Vector3()
const _nrm = new Vector3()
const _quat = new Quaternion()
const _tilt = new Quaternion()
const _mat = new Matrix4()
const _scale = new Vector3()
const _axis = new Vector3()

/** 在膜面上撒点：中心留出主角区域，密度随半径衰减（近处看得清、远处不喧闹）。 */
function scatter(count: number, seed: number, innerHole: number, outerRadius: number): Float32Array {
  const rng = mulberry32(seed)
  const out = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    // sqrt 分布让点在圆面上均匀；再叠一次 pow 让中心稍密
    const r = innerHole + Math.pow(rng(), 0.62) * (outerRadius - innerHole)
    const a = rng() * Math.PI * 2
    out[i * 3] = Math.cos(a) * r
    out[i * 3 + 1] = Math.sin(a) * r
    out[i * 3 + 2] = rng() * Math.PI * 2 // 自转相位
  }
  return out
}

export function ReceptorField({ detail }: { detail: number }) {
  const ace2Geo = useMemo(() => buildAce2Geometry(detail), [detail])
  const tmprssGeo = useMemo(() => buildTmprss2Geometry(detail), [detail])
  const ace2Mat = useMemo(() => proteinMaterial(COLORS.ace2, { emissive: 0.46, roughness: 0.38, clearcoat: 0.7, vertexColors: true }), [])
  const tmprssMat = useMemo(
    () => proteinMaterial(COLORS.tmprss2, { emissive: 0.44, roughness: 0.4, clearcoat: 0.65, vertexColors: true }),
    [],
  )

  const ace2Count = 24
  const tmprssCount = 15
  const ace2Layout = useMemo(() => scatter(ace2Count, 20250401, 0.62, 6.4), [])
  const tmprssLayout = useMemo(() => scatter(tmprssCount, 20250402, 0.75, 5.8), [])

  const ace2Ref = useRef<InstancedMesh>(null)
  const tmprssRef = useRef<InstancedMesh>(null)
  const ace2Pick = usePick('ace2')
  const tmprssPick = usePick('tmprss2')

  useSceneUpdate(UPDATE_ORDER.receptors, ({ elapsed }) => {
    const state = sceneState.membrane
    const place = (mesh: InstancedMesh, layout: Float32Array, count: number, sway: number) => {
      for (let i = 0; i < count; i++) {
        const x = layout[i * 3]
        const z = layout[i * 3 + 1]
        const phase = layout[i * 3 + 2]
        sampleMembrane(x, z, state, _pos, _nrm, 0.07)
        _quat.setFromUnitVectors(UP, _nrm)
        // 热运动：胞外域在水相中轻微摆动
        const wob = (valueNoise1D(elapsed * 0.35 + phase, 5) - 0.5) * sway
        _axis.set(Math.cos(phase), 0, Math.sin(phase)).normalize()
        _tilt.setFromAxisAngle(_axis, wob)
        _quat.multiply(_tilt)
        _scale.setScalar(1)
        _mat.compose(_pos, _quat, _scale)
        mesh.setMatrixAt(i, _mat)
      }
      mesh.instanceMatrix.needsUpdate = true
    }
    if (ace2Ref.current) place(ace2Ref.current, ace2Layout, ace2Count, 0.28)
    if (tmprssRef.current) place(tmprssRef.current, tmprssLayout, tmprssCount, 0.34)
  })

  const showLabels = useStepIn(2, 3, 4)
  const showFurin = useStepIn(7)

  return (
    <group>
      <instancedMesh
        ref={ace2Ref}
        args={[ace2Geo, ace2Mat, ace2Count]}
        frustumCulled={false}
        renderOrder={10}
        dispose={null}
        {...ace2Pick}
      />
      <instancedMesh
        ref={tmprssRef}
        args={[tmprssGeo, tmprssMat, tmprssCount]}
        frustumCulled={false}
        renderOrder={10}
        dispose={null}
        {...tmprssPick}
      />
      <Annotation id="ace2" position={[-1.55, 0.5, 1.15]} side="left" label="ACE2 受体（细胞的“门锁”）" hidden={!showLabels} />
      <Annotation id="tmprss2" position={[1.75, 0.42, -1.0]} side="right" label="TMPRSS2 蛋白酶" hidden={!showLabels} />
      <Annotation
        id="furin"
        position={[WORLD.exo.x + 1.4, 0.3, WORLD.exo.z + 1.5]}
        side="right"
        label="furin：在生产细胞中预切割 S1/S2"
        hidden={!showFurin}
      />
    </group>
  )
}
