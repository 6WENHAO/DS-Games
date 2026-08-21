/**
 * 宿主细胞质膜：三层磷脂双分子层 + 融合孔 + 分子级磷脂特写。
 *
 * 层次自胞外向胞内依次是：
 *   outer  —— 胞外侧磷脂头部层（法线贴图给出颗粒感）
 *   core   —— 疏水尾部核心（深色条纹，双分子层的“夹心”）
 *   inner  —— 胞质侧磷脂头部层
 * 三层共享同一形变场（src/three/membrane.ts），所以融合孔是**真实的几何开孔**，
 * 孔沿有卷边，两片膜在此真正连通。
 *
 * 分子级细节采用“按需加密”策略：平时靠法线贴图表现磷脂头部，
 * 只有在融合位点附近才实例化真正的磷脂分子（含头部与两条尾链），
 * 既保住 60fps，也在观众最需要看清结构的时刻给出分子级证据。
 */

import { useMemo, useRef } from 'react'
import { type InstancedMesh, Matrix4, type Mesh, type MeshBasicMaterial, Quaternion, Vector3 } from 'three'
import { clamp01, remap, smoothstep } from '../anim/ease'
import { buildLipidGeometry, buildPoreRingGeometry } from '../three/geometry/hostSurface'
import { bilayerCoreMaterial, glowMaterial, membraneMaterial, proteinMaterial } from '../three/materials'
import { MembraneSheet, sampleMembrane } from '../three/membrane'
import { COLORS, SCALE } from '../three/palette'
import { Annotation, usePick, useStepIn } from './Annotation'
import { WORLD } from './choreography'
import { sceneState } from './sceneState'
import { UPDATE_ORDER, useSceneUpdate } from './updateBus'

/** 一个法线贴图 tile 对应的世界尺寸：8 个磷脂头部 ≈ 0.28 单位（14 nm）。 */
const LIPID_TILE = 0.28
const UP = new Vector3(0, 1, 0)

// 逐帧复用的临时量，避免在实例化循环里制造垃圾
const _pos = new Vector3()
const _nrm = new Vector3()
const _dir = new Vector3()
const _place = new Vector3()
const _quat = new Quaternion()
const _mat = new Matrix4()
const _scale = new Vector3()

/** 六方密排圆盘布点，按半径排序后截断，得到规整的圆形斑块。 */
function hexDisc(radius: number, spacing: number, max: number): Float32Array {
  const pts: [number, number, number][] = []
  const rowH = spacing * 0.866
  const rows = Math.ceil(radius / rowH) + 1
  const cols = Math.ceil(radius / spacing) + 1
  for (let j = -rows; j <= rows; j++) {
    const z = j * rowH
    const offset = (j & 1) === 0 ? 0 : spacing * 0.5
    for (let i = -cols; i <= cols; i++) {
      const x = i * spacing + offset
      const d2 = x * x + z * z
      if (d2 <= radius * radius) pts.push([x, z, d2])
    }
  }
  pts.sort((a, b) => a[2] - b[2])
  const n = Math.min(max, pts.length)
  const out = new Float32Array(n * 2)
  for (let i = 0; i < n; i++) {
    out[i * 2] = pts[i][0]
    out[i * 2 + 1] = pts[i][1]
  }
  return out
}

/** 环形布点：融合孔沿的磷脂，展示“两层膜在孔沿连通”。 */
function ringPoints(rings: number, perRing: number): Float32Array {
  const out = new Float32Array(rings * perRing * 3)
  let k = 0
  for (let r = 0; r < rings; r++) {
    for (let i = 0; i < perRing; i++) {
      const a = (i / perRing) * Math.PI * 2 + r * 0.13
      out[k++] = Math.cos(a)
      out[k++] = Math.sin(a)
      out[k++] = 1.02 + r * 0.19 // 相对孔半径的倍数
    }
  }
  return out
}

export function CellMembrane({ segments, lipidCount }: { segments: number; lipidCount: number }) {
  const sheet = useMemo(() => new MembraneSheet({ size: WORLD.membraneSize, segments, thickness: SCALE.bilayer }), [segments])

  const repeat = WORLD.membraneSize / LIPID_TILE
  const outerMat = useMemo(
    () => membraneMaterial(COLORS.hostMembrane, { opacity: 0.74, repeat, normalScale: 0.9, emissive: 0.05, sheenColor: '#bfe6ff' }),
    [repeat],
  )
  const innerMat = useMemo(
    () => membraneMaterial('#5f88b8', { opacity: 0.68, repeat, normalScale: 0.8, emissive: 0.04, sheenColor: '#8fd8ff' }),
    [repeat],
  )
  const coreMat = useMemo(() => bilayerCoreMaterial(COLORS.hostMembraneCore, 0.62, repeat * 0.5), [repeat])

  const lipidGeo = useMemo(() => buildLipidGeometry(COLORS.hostMembrane, COLORS.hostMembraneCore, 1), [])
  const lipidMat = useMemo(() => proteinMaterial('#ffffff', { vertexColors: true, roughness: 0.32, clearcoat: 0.8, emissive: 0.06 }), [])
  const poreRingGeo = useMemo(() => buildPoreRingGeometry(1, 0.028), [])
  const poreMat = useMemo(() => glowMaterial(COLORS.accent, 0.55), [])

  // —— 磷脂特写：中心斑块（结合与切割阶段）+ 孔沿环（融合孔阶段）——
  const patchLayout = useMemo(() => {
    if (lipidCount <= 0) return new Float32Array(0)
    const spacing = SCALE.lipidHead * 2.4
    return hexDisc(0.66, spacing, Math.floor(lipidCount * 0.7))
  }, [lipidCount])
  const rimLayout = useMemo(
    () => (lipidCount <= 0 ? new Float32Array(0) : ringPoints(3, Math.max(12, Math.floor(Math.min(44, lipidCount * 0.1))))),
    [lipidCount],
  )

  const patchRef = useRef<InstancedMesh>(null)
  const rimRef = useRef<InstancedMesh>(null)
  const fusionRingRef = useRef<Mesh>(null)
  const exoRingRef = useRef<Mesh>(null)
  const pick = usePick('host-membrane')

  const patchCount = patchLayout.length / 2
  const rimCount = rimLayout.length / 3

  const showPoreLabel = useStepIn(4, 5)
  const showMembraneLabel = useStepIn(2, 3, 4, 5, 8)

  useSceneUpdate(UPDATE_ORDER.membrane, ({ p }) => {
    const state = sceneState.membrane
    sheet.update(state)
    const half = SCALE.bilayer / 2

    // 中心磷脂斑块：结合/切割阶段淡入，孔打开后淡出（交给孔沿环接手）
    if (patchRef.current && patchCount > 0) {
      const visible = clamp01(smoothstep(remap(p, 2.86, 3.12)) - smoothstep(remap(p, 3.88, 4.08))) * (p > 2.8 && p < 4.3 ? 1 : 0)
      patchRef.current.visible = visible > 0.01
      if (patchRef.current.visible) {
        for (let i = 0; i < patchCount; i++) {
          const x = patchLayout[i * 2]
          const z = patchLayout[i * 2 + 1]
          const edge = 1 - smoothstep(remap(Math.hypot(x, z), 0.44, 0.66))
          sampleMembrane(x + state.fusion.x, z + state.fusion.z, state, _pos, _nrm, 0.035)
          const layer = (i & 1) === 0 ? 1 : -1
          _dir.copy(_nrm).multiplyScalar(layer)
          _quat.setFromUnitVectors(UP, _dir)
          _scale.setScalar(visible * edge * 0.95)
          _place.copy(_pos).addScaledVector(_nrm, half * layer)
          _mat.compose(_place, _quat, _scale)
          patchRef.current.setMatrixAt(i, _mat)
        }
        patchRef.current.instanceMatrix.needsUpdate = true
      }
    }

    // 孔沿磷脂环：只在融合孔存在时出现，展示两层膜在孔沿连通
    if (rimRef.current && rimCount > 0) {
      const poreR = state.fusion.pore
      const show = poreR > 0.06
      rimRef.current.visible = show
      if (show) {
        for (let i = 0; i < rimCount; i++) {
          const rr = poreR * rimLayout[i * 3 + 2]
          const x = state.fusion.x + rimLayout[i * 3] * rr
          const z = state.fusion.z + rimLayout[i * 3 + 1] * rr
          sampleMembrane(x, z, state, _pos, _nrm, 0.03)
          const layer = (i & 1) === 0 ? 1 : -1
          _dir.copy(_nrm).multiplyScalar(layer)
          _quat.setFromUnitVectors(UP, _dir)
          _scale.setScalar(1)
          _place.copy(_pos).addScaledVector(_nrm, half * layer)
          _mat.compose(_place, _quat, _scale)
          rimRef.current.setMatrixAt(i, _mat)
        }
        rimRef.current.instanceMatrix.needsUpdate = true
      }
    }

    // 融合孔与胞吐孔的高亮环
    if (fusionRingRef.current) {
      const r = state.fusion.pore
      fusionRingRef.current.visible = r > 0.02
      fusionRingRef.current.scale.setScalar(Math.max(0.001, r))
      sampleMembrane(state.fusion.x, state.fusion.z, state, _pos, _nrm, 0.05)
      fusionRingRef.current.position.set(state.fusion.x, _pos.y + 0.012, state.fusion.z)
      ;(fusionRingRef.current.material as MeshBasicMaterial).opacity = 0.25 + sceneState.pore.glow * 0.55
    }
    if (exoRingRef.current) {
      const r = state.exo.pore
      exoRingRef.current.visible = r > 0.02
      exoRingRef.current.scale.setScalar(Math.max(0.001, r))
      sampleMembrane(state.exo.x, state.exo.z, state, _pos, _nrm, 0.05)
      exoRingRef.current.position.set(state.exo.x, _pos.y + 0.012, state.exo.z)
    }
  })

  return (
    <group>
      {/* 三层膜片。renderOrder 保证半透明层由内向外依次绘制 */}
      <mesh geometry={sheet.inner} material={innerMat} renderOrder={4} dispose={null} />
      <mesh geometry={sheet.core} material={coreMat} renderOrder={5} dispose={null} />
      <mesh geometry={sheet.outer} material={outerMat} renderOrder={6} dispose={null} />

      {/* 仅用于拾取的简化面片：不写颜色也不写深度，避免对 1.6 万顶点做射线检测 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} {...pick}>
        <planeGeometry args={[WORLD.membraneSize, WORLD.membraneSize]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>

      {patchCount > 0 && (
        <instancedMesh ref={patchRef} args={[lipidGeo, lipidMat, patchCount]} frustumCulled={false} renderOrder={7} dispose={null} />
      )}
      {rimCount > 0 && (
        <instancedMesh ref={rimRef} args={[lipidGeo, lipidMat, rimCount]} frustumCulled={false} renderOrder={7} dispose={null} />
      )}

      <mesh ref={fusionRingRef} geometry={poreRingGeo} material={poreMat} renderOrder={800} dispose={null} />
      <mesh ref={exoRingRef} geometry={poreRingGeo} material={poreMat} renderOrder={800} dispose={null} />

      <Annotation
        id="host-membrane"
        position={[-2.6, 0.3, 2.1]}
        side="left"
        label="宿主细胞质膜 · 磷脂双分子层"
        hidden={!showMembraneLabel}
      />
      <Annotation id="fusion-pore" position={[0.02, 0.34, 0.02]} side="right" label="融合孔" hidden={!showPoreLabel} />
    </group>
  )
}
