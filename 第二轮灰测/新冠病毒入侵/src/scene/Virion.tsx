/**
 * 病毒体（virion）：囊膜三层 + 刺突冠 + M/E 蛋白。
 *
 * 三个必须做对的地方：
 *  1) **不是光滑球体**：囊膜由噪声位移过的二十面体细分球构成，外形不规则；
 *  2) **刺突冠**：30 个三聚体（真实 24–40）铺在囊膜上，每个都有 S1 头部与 S2 柄部，
 *     并随水相热运动轻微摆动（柄部是柔性铰链）；
 *  3) **膜融合后刺突留在宿主质膜上**：囊膜并入细胞膜时，刺突并不消失，
 *     而是随膜“铺开”插进宿主质膜 —— 这是真实发生的事，也是画面上最有说服力的细节。
 *
 * 因此刺突场用世界坐标独立驱动（不是囊膜的子节点），才能在融合时脱离病毒体、留在膜上。
 */

import { useMemo, useRef } from 'react'
import { type Group, type InstancedMesh, Matrix4, type Mesh, type MeshPhysicalMaterial, Quaternion, Vector3 } from 'three'
import { clamp01, easeInOutCubic, lerp, remap, seg, smoothstep } from '../anim/ease'
import {
  buildEProteinGeometry,
  buildEnvelopeGeometry,
  buildMProteinGeometry,
  buildSpikeGeometry,
  distributeOnEnvelope,
} from '../three/geometry/virion'
import { bilayerCoreMaterial, membraneMaterial, proteinMaterial, virionEnvelopeMaterial } from '../three/materials'
import { sampleMembrane } from '../three/membrane'
import { COLORS, SCALE } from '../three/palette'
import { valueNoise1D } from '../three/rand'
import { Annotation, usePick, useStepIn } from './Annotation'
import { SEG } from './choreography'
import { sceneState } from './sceneState'
import { UPDATE_ORDER, useSceneUpdate } from './updateBus'

const UP = new Vector3(0, 1, 0)
const R = SCALE.virionRadius

const _local = new Vector3()
const _world = new Vector3()
const _normal = new Vector3()
const _quat = new Quaternion()
const _quatB = new Quaternion()
const _spin = new Quaternion()
const _mat = new Matrix4()
const _scale = new Vector3()
const _mPos = new Vector3()
const _mNrm = new Vector3()
const _axis = new Vector3()

interface SurfaceSite {
  position: Vector3
  normal: Vector3
  /** 融合后该刺突在宿主质膜上的落点（相对融合位点的 xz 偏移） */
  spreadX: number
  spreadZ: number
  /** 摆动相位 */
  phase: number
}

function toSites(raw: ReturnType<typeof distributeOnEnvelope>): SurfaceSite[] {
  return raw.map((s, i) => {
    const dir = s.normal
    const angle = Math.abs(dir.x) + Math.abs(dir.z) > 1e-4 ? Math.atan2(dir.z, dir.x) : i * 2.39996
    // 底部的刺突落在孔沿附近，顶部的铺得更远 —— 相当于把球面“摊开”成平面
    const spread = lerp(0.42, 2.05, clamp01(dir.y * 0.5 + 0.5))
    return {
      position: s.position,
      normal: dir,
      spreadX: Math.cos(angle) * spread,
      spreadZ: Math.sin(angle) * spread,
      phase: i * 1.7,
    }
  })
}

export function Virion({ envelopeDetail, spikeDetail, transmission }: { envelopeDetail: number; spikeDetail: number; transmission: boolean }) {
  const half = SCALE.bilayer / 2

  const outerGeo = useMemo(() => buildEnvelopeGeometry(R, envelopeDetail, 3), [envelopeDetail])
  const coreGeo = useMemo(() => buildEnvelopeGeometry(R - half, envelopeDetail, 3), [envelopeDetail, half])
  const innerGeo = useMemo(() => buildEnvelopeGeometry(R - SCALE.bilayer, envelopeDetail, 3), [envelopeDetail])

  // 囊膜材质需要逐帧改透明度，因此克隆一份专属实例（贴图仍与全局共享）
  const outerMat = useMemo(() => virionEnvelopeMaterial(transmission).clone(), [transmission])
  const innerMat = useMemo(
    () => membraneMaterial('#d99b74', { opacity: 0.5, repeat: 20, repeatY: 10, normalScale: 0.8, emissive: 0.08, sheenColor: '#ffd2b0' }).clone(),
    [],
  )
  const coreMat = useMemo(() => bilayerCoreMaterial(COLORS.envelopeCore, 0.6, 22).clone(), [])

  const spikeGeo = useMemo(() => buildSpikeGeometry(spikeDetail), [spikeDetail])
  const spikeMat = useMemo(() => proteinMaterial('#ffffff', { vertexColors: true, emissive: 0.44, roughness: 0.4, clearcoat: 0.6 }), [])
  const mGeo = useMemo(() => buildMProteinGeometry(spikeDetail), [spikeDetail])
  const mMat = useMemo(() => proteinMaterial('#ffffff', { vertexColors: true, emissive: 0.34, roughness: 0.45 }), [])
  const eGeo = useMemo(() => buildEProteinGeometry(spikeDetail), [spikeDetail])

  const spikeSites = useMemo(() => toSites(distributeOnEnvelope(SCALE.spikeCount, R, 3, 0.5)), [])
  const mSites = useMemo(() => toSites(distributeOnEnvelope(58, R - 0.055, 3, 1.1)), [])
  const eSites = useMemo(() => toSites(distributeOnEnvelope(12, R - 0.05, 17, 1.4)), [])

  const groupRef = useRef<Group>(null)
  const spinRef = useRef<Group>(null)
  const spikeRef = useRef<InstancedMesh>(null)
  const mRef = useRef<InstancedMesh>(null)
  const eRef = useRef<InstancedMesh>(null)
  const outerRef = useRef<Mesh>(null)

  const spikePick = usePick('spike')
  const envelopePick = usePick('envelope')
  const mPick = usePick('m-protein')

  const showStructureLabels = useStepIn(1)
  const showSpikeLabel = useStepIn(1, 2, 3, 4)

  /** 自转角度必须自行累加：直接用 elapsed 乘衰减系数会在减速时“倒转”。 */
  const spinAngle = useRef(0)

  useSceneUpdate(UPDATE_ORDER.virion, ({ p, dt, elapsed }) => {
    const v = sceneState.virion
    const merge = v.merge
    const flattenY = 1 - v.flatten * 0.1

    if (groupRef.current) {
      groupRef.current.visible = v.visible
      groupRef.current.position.copy(v.pos)
      groupRef.current.scale.set(1, flattenY, 1)
    }
    // 第 1 步缓慢自转以展示全部结构，进入第 2 步平滑停下
    const spinRate = 0.24 * (1 - smoothstep(remap(p, 0.9, 1.18)))
    spinAngle.current += dt * spinRate
    if (spinRef.current) spinRef.current.rotation.y = spinAngle.current
    _spin.setFromAxisAngle(UP, spinAngle.current)

    // 囊膜透明度：第 1 步剖切、融合时消融
    const opacity = v.envelopeOpacity
    ;(outerMat as MeshPhysicalMaterial).opacity = 0.56 * opacity
    ;(innerMat as MeshPhysicalMaterial).opacity = 0.5 * opacity
    coreMat.opacity = 0.6 * opacity * (1 - v.cutaway * 0.75)

    // —— 表面蛋白：世界坐标驱动，融合时铺进宿主质膜 ——
    const state = sceneState.membrane
    const place = (mesh: InstancedMesh | null, sites: SurfaceSite[], sway: number, embed: number, fadeWithMerge: boolean) => {
      if (!mesh) return
      const count = sites.length
      for (let i = 0; i < count; i++) {
        const site = sites[i]
        _local.copy(site.position).applyQuaternion(_spin)
        _normal.copy(site.normal).applyQuaternion(_spin)
        _local.y *= flattenY
        _world.copy(v.pos).add(_local)
        _quat.setFromUnitVectors(UP, _normal)

        // 柄部柔性：随水相热运动轻微摆动
        if (sway > 0) {
          const wob = (valueNoise1D(elapsed * 0.6 + site.phase, 9) - 0.5) * sway
          _axis.set(Math.cos(site.phase), 0, Math.sin(site.phase)).normalize()
          _quatB.setFromAxisAngle(_axis, wob)
          _quat.multiply(_quatB)
        }

        let scale = 1
        if (merge > 0.001) {
          // 目标：宿主质膜上的一点，朝向膜外法线
          sampleMembrane(state.fusion.x + site.spreadX, state.fusion.z + site.spreadZ, state, _mPos, _mNrm, 0.08)
          _mPos.addScaledVector(_mNrm, embed)
          _world.lerp(_mPos, merge)
          _quatB.setFromUnitVectors(UP, _mNrm)
          _quat.slerp(_quatB, merge)
          if (fadeWithMerge) scale = 1 - merge * 0.9
        }
        _scale.setScalar(scale)
        _mat.compose(_world, _quat, _scale)
        mesh.setMatrixAt(i, _mat)
      }
      mesh.instanceMatrix.needsUpdate = true
      // 融合完成后刺突留在宿主膜上；M/E 则淡出（它们大多留在膜内，画面上不再强调）
      mesh.visible = fadeWithMerge ? merge < 0.9 : p < 6.05
    }

    place(spikeRef.current, spikeSites, 0.16, 0, false)
    place(mRef.current, mSites, 0.05, -0.02, true)
    place(eRef.current, eSites, 0.05, -0.02, true)
  })

  // 第 1 步的“剖切”提示环：把注意力引到内部核衣壳
  const cutRingRef = useRef<Mesh>(null)
  useSceneUpdate(UPDATE_ORDER.virion + 1, ({ p, elapsed }) => {
    if (!cutRingRef.current) return
    const show = seg(p, SEG.cutaway, easeInOutCubic) * (1 - smoothstep(remap(p, 0.96, 1.1)))
    cutRingRef.current.visible = show > 0.02
    cutRingRef.current.scale.setScalar(R * (1.02 + 0.02 * Math.sin(elapsed * 1.6)))
    cutRingRef.current.rotation.y = elapsed * 0.25
  })

  return (
    <group>
      <group ref={groupRef}>
        <group ref={spinRef}>
          <mesh geometry={innerGeo} material={innerMat} renderOrder={12} dispose={null} />
          <mesh geometry={coreGeo} material={coreMat} renderOrder={13} dispose={null} />
          <mesh ref={outerRef} geometry={outerGeo} material={outerMat} renderOrder={14} dispose={null} {...envelopePick} />
        </group>
        <mesh ref={cutRingRef} rotation={[Math.PI / 2, 0, 0]} renderOrder={820}>
          <torusGeometry args={[1, 0.012, 5, 64]} />
          <meshBasicMaterial color={COLORS.accent} transparent opacity={0.5} depthWrite={false} toneMapped={false} />
        </mesh>

        <Annotation id="envelope" position={[-0.72, 0.55, 0.42]} side="left" label="脂质囊膜（来自宿主细胞）" hidden={!showStructureLabels} />
        <Annotation id="m-protein" position={[0.78, -0.34, 0.42]} side="right" label="M 蛋白（膜蛋白，最丰富）" hidden={!showStructureLabels} />
        <Annotation id="e-protein" position={[0.3, 0.82, -0.55]} side="right" label="E 蛋白（包膜蛋白，五聚体）" hidden={!showStructureLabels} />
      </group>

      {/* 刺突 / M / E：世界坐标独立驱动 */}
      <instancedMesh
        ref={spikeRef}
        args={[spikeGeo, spikeMat, spikeSites.length]}
        frustumCulled={false}
        renderOrder={16}
        dispose={null}
        {...spikePick}
      />
      <instancedMesh ref={mRef} args={[mGeo, mMat, mSites.length]} frustumCulled={false} renderOrder={16} dispose={null} {...mPick} />
      <instancedMesh ref={eRef} args={[eGeo, mMat, eSites.length]} frustumCulled={false} renderOrder={16} dispose={null} />

      <SpikeCrownLabel hidden={!showSpikeLabel} />
    </group>
  )
}

/** 刺突标签单独抽出来：它要跟着病毒体移动，但不能被自转带着转。 */
function SpikeCrownLabel({ hidden }: { hidden: boolean }) {
  const ref = useRef<Group>(null)
  useSceneUpdate(UPDATE_ORDER.annotations, () => {
    if (ref.current) ref.current.position.copy(sceneState.virion.pos)
  })
  return (
    <group ref={ref}>
      <Annotation id="spike" position={[0.55, 1.05, 0.3]} side="right" label="刺突蛋白 S（三聚体）" hidden={hidden} />
      <Annotation id="rbd" position={[-0.62, 0.95, -0.45]} side="left" label="受体结合域 RBD" hidden={hidden} lead={28} />
    </group>
  )
}
