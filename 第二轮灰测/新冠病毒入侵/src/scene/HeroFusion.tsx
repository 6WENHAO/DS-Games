/**
 * 主角分子的近景演出：ACE2 结合 → TMPRSS2 切割 S2′ → 融合肽插膜 → 六螺旋束把两膜拉近。
 *
 * 严格遵循“鱼叉模型”的真实顺序：
 *   ① RBD 从“下”构象抬起为“上”构象，暴露受体结合基序，与 ACE2 的肽酶结构域顶端结合；
 *   ② TMPRSS2 在 **S2′ 位点**切割（S1/S2 位点此前已由生产细胞中的 furin 预切割）；
 *   ③ S1 连同 ACE2 一起脱落，S2 伸展成“前发夹中间体”，把**融合肽**插进宿主细胞膜；
 *   ④ HR1/HR2 反平行折叠成**六螺旋束**，像拉链一样把病毒膜与细胞膜拉到一起；
 *   ⑤ 两膜先半融合、再打开融合孔。
 *
 * 已知的示意性处理（见 docs/SCIENCE.md）：TMPRSS2 催化结构域到 S2′ 位点尚有约 10 nm，
 * 真实体系依靠刺突柄部铰链的大幅摆动与膜的局部形变来完成接触；此处用“柔性茎伸出”
 * 来表达这一接触过程，以便观众看清切割事件本身。
 */

import { useMemo, useRef } from 'react'
import { type Group, type Mesh, Quaternion, Vector3 } from 'three'
import { clamp, easeInOutCubic, easeOutBack, easeOutCubic, lerp, pulse, remap, seg, sharpPulse, smoothstep } from '../anim/ease'
import {
  ACE2_LAYOUT,
  TMPRSS2_CATALYTIC_REST,
  buildAce2Geometry,
  buildTmprss2AnchorGeometry,
  buildTmprss2CatalyticGeometry,
} from '../three/geometry/hostSurface'
import { SPIKE_LAYOUT, spikeParts } from '../three/geometry/virion'
import { glowMaterial, proteinMaterial } from '../three/materials'
import { sampleMembrane } from '../three/membrane'
import { COLORS, SCALE } from '../three/palette'
import { Annotation, usePick, useStepIn } from './Annotation'
import { SEG, VIRION_BOTTOM_R, WORLD } from './choreography'
import { sceneState } from './sceneState'
import { UPDATE_ORDER, useSceneUpdate } from './updateBus'

const L = SPIKE_LAYOUT
const UP = new Vector3(0, 1, 0)
const DOWN_QUAT = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI)
const UP_QUAT = new Quaternion()

/** RBD 铰链：枢轴在 RBD 根部，抬起时向外上方翻出，暴露受体结合基序。 */
const RBD_PIVOT = new Vector3(0.05, 0.4, 0)
const RBD_OFFSET = new Vector3(-0.006, 0.05, 0)

const _pos = new Vector3()
const _nrm = new Vector3()
const _tmp = new Vector3()
const _tmp2 = new Vector3()
const _quat = new Quaternion()
const _dir = new Vector3()

/** 病毒体底部（南极）的囊膜半径 —— 主角刺突就长在这里。 */
const BOTTOM_R = VIRION_BOTTOM_R

export function HeroFusion({ detail }: { detail: number }) {
  const parts = useMemo(() => spikeParts(detail), [detail])
  const ace2Geo = useMemo(() => buildAce2Geometry(detail), [detail])
  const anchorGeo = useMemo(() => buildTmprss2AnchorGeometry(detail), [detail])
  const catalyticGeo = useMemo(() => buildTmprss2CatalyticGeometry(detail), [detail])

  // 主角材质单独克隆：需要逐帧改透明度 / 自发光
  const spikeMat = useMemo(
    () => proteinMaterial('#ffffff', { vertexColors: true, emissive: 0.46, roughness: 0.38, clearcoat: 0.65 }).clone(),
    [],
  )
  const s1Mat = useMemo(() => {
    const m = proteinMaterial('#ffffff', { vertexColors: true, emissive: 0.46, roughness: 0.38, clearcoat: 0.65 }).clone()
    m.transparent = true
    return m
  }, [])
  const ace2Mat = useMemo(() => {
    const m = proteinMaterial(COLORS.ace2, { vertexColors: true, emissive: 0.5, roughness: 0.36, clearcoat: 0.7 }).clone()
    m.transparent = true
    return m
  }, [])
  const tmprssMat = useMemo(
    () => proteinMaterial(COLORS.tmprss2, { vertexColors: true, emissive: 0.46, roughness: 0.4, clearcoat: 0.65 }).clone(),
    [],
  )
  const flashMat = useMemo(() => glowMaterial('#ffffff', 0).clone(), [])
  const bindGlowMat = useMemo(() => glowMaterial(COLORS.accent, 0).clone(), [])

  const spikeGroup = useRef<Group>(null)
  const s1Group = useRef<Group>(null)
  const rbdHinges = [useRef<Group>(null), useRef<Group>(null), useRef<Group>(null)]
  const cleaveRing = useRef<Mesh>(null)
  const prehairpin = useRef<Mesh>(null)
  const bundle = useRef<Mesh>(null)
  const fusionPeptide = useRef<Mesh>(null)
  const flash = useRef<Mesh>(null)
  const bindGlow = useRef<Mesh>(null)
  const ace2Group = useRef<Group>(null)
  const anchorGroup = useRef<Group>(null)
  const catalyticGroup = useRef<Group>(null)
  const linker = useRef<Mesh>(null)

  /** S1 脱落瞬间冻结的世界变换 */
  const shedFrozen = useRef({ captured: false, pos: new Vector3(), quat: new Quaternion() })

  const spikePick = usePick('spike')
  const rbdPick = usePick('rbd')
  const ace2Pick = usePick('ace2')
  const tmprssPick = usePick('tmprss2')

  const showBindLabels = useStepIn(3)
  const showFusionLabels = useStepIn(4)
  const showPeptideLabel = useStepIn(4, 5)

  useSceneUpdate(UPDATE_ORDER.heroBinding, ({ p, elapsed }) => {
    const v = sceneState.virion
    const state = sceneState.membrane
    const merge = v.merge

    // —— 膜面采样：主角受体与融合孔都锚在这里 ——
    sampleMembrane(WORLD.fusion.x, WORLD.fusion.z, state, _pos, _nrm, 0.05)
    const membraneCenterY = _pos.y
    const membraneOuterY = membraneCenterY + SCALE.bilayer / 2

    // —— 主角刺突的基座：贴在病毒体底部；融合后落到质膜上 ——
    const baseY = lerp(v.pos.y - BOTTOM_R, membraneOuterY, merge)
    if (spikeGroup.current) {
      spikeGroup.current.position.set(lerp(v.pos.x, 0.02, merge), baseY, lerp(v.pos.z, 0.02, merge))
      // 融合完成后刺突留在宿主质膜里，胞外域朝外（朝上）
      _quat.copy(DOWN_QUAT).slerp(UP_QUAT, smoothstep(remap(merge, 0.25, 1)))
      spikeGroup.current.quaternion.copy(_quat)
      spikeGroup.current.visible = p > 1.55
    }

    // —— RBD 抬起：只有 0 号 protomer 完全抬起（真实病毒上多为“一上二下”）——
    const up = seg(p, SEG.rbdUp, easeOutBack)
    rbdHinges.forEach((ref, i) => {
      if (!ref.current) return
      const amount = i === 0 ? up : up * 0.12
      ref.current.rotation.z = -L.rbdUpAngle * amount
      ref.current.position.set(RBD_PIVOT.x, RBD_PIVOT.y + 0.02 * amount, RBD_PIVOT.z)
    })

    // —— S1 脱落：切割后 S1 连同 ACE2 一起离开，S2 独自完成融合 ——
    const shed = seg(p, [SEG.fpInsert[0], SEG.fpInsert[0] + 0.16] as const, smoothstep)
    const shedFade = 1 - smoothstep(remap(p, SEG.fpInsert[0] + 0.04, SEG.zipper[0] + 0.12))
    if (s1Group.current && spikeGroup.current) {
      if (shed <= 0.001) {
        s1Group.current.position.copy(spikeGroup.current.position)
        s1Group.current.quaternion.copy(spikeGroup.current.quaternion)
        shedFrozen.current.captured = false
      } else if (!shedFrozen.current.captured) {
        shedFrozen.current.captured = true
        shedFrozen.current.pos.copy(s1Group.current.position)
        shedFrozen.current.quat.copy(s1Group.current.quaternion)
      }
      if (shedFrozen.current.captured) {
        // 冻结在结合位点，随后缓慢漂离并淡出
        s1Group.current.position.copy(shedFrozen.current.pos).addScaledVector(_tmp.set(0.35, 0.12, 0.1), shed * 0.35)
        s1Group.current.quaternion.copy(shedFrozen.current.quat)
      }
      s1Group.current.visible = shedFade > 0.02 && p > 1.55
      s1Mat.opacity = shedFade
    }

    // —— S2′ 切割位点：切割瞬间闪光 ——
    const cleaveT = remap(p, SEG.cleave[0], SEG.cleave[1])
    if (cleaveRing.current) {
      const near = seg(p, SEG.tmprss2Move, smoothstep) * (1 - smoothstep(remap(p, SEG.zipper[0], SEG.zipper[1])))
      cleaveRing.current.visible = near > 0.03
      cleaveRing.current.position.set(0, L.s2PrimeY, 0)
      cleaveRing.current.scale.setScalar(1 + sharpPulse(cleaveT, 2) * 0.8)
    }
    if (flash.current) {
      const f = sharpPulse(cleaveT, 2)
      flash.current.visible = f > 0.02
      flash.current.scale.setScalar(0.05 + f * 0.32)
      flashMat.opacity = f * 0.85
      // 闪光放在 S2′ 位点的世界坐标处
      if (spikeGroup.current) {
        _tmp.set(0, L.s2PrimeY, 0).applyQuaternion(spikeGroup.current.quaternion).add(spikeGroup.current.position)
        flash.current.position.copy(_tmp)
      }
    }

    // —— 前发夹中间体 / 六螺旋束：长度始终等于两膜之间的间距 ——
    const insert = seg(p, SEG.fpInsert, easeOutCubic)
    const zip = seg(p, SEG.zipper, easeInOutCubic)
    const gap = clamp(baseY - membraneOuterY, 0.16, 0.72)
    const rodLen = insert <= 0 ? 0 : gap
    if (prehairpin.current) {
      prehairpin.current.visible = rodLen > 0.01 && zip < 0.85
      prehairpin.current.scale.set(1, rodLen * insert, 1)
      prehairpin.current.position.set(0, (rodLen * insert) / 2 + 0.02, 0)
    }
    if (bundle.current) {
      bundle.current.visible = zip > 0.12
      const l = Math.max(0.16, rodLen)
      bundle.current.scale.set(1, l / 0.3, 1)
      bundle.current.position.set(0, 0.02, 0)
    }
    if (fusionPeptide.current) {
      fusionPeptide.current.visible = insert > 0.05
      // 融合肽始终停在宿主膜面上（插进去一点）
      fusionPeptide.current.position.set(0, rodLen * insert - 0.02, 0)
      fusionPeptide.current.scale.setScalar(lerp(0.4, 1, insert))
    }

    // —— 主角 ACE2 ——
    if (ace2Group.current) {
      sampleMembrane(WORLD.heroAce2.x, WORLD.heroAce2.z, state, _pos, _nrm, 0.05)
      ace2Group.current.position.copy(_pos)
      _quat.setFromUnitVectors(UP, _nrm)
      ace2Group.current.quaternion.copy(_quat)
      // 结合后被 RBD 轻微拉扯而倾斜；随 S1 一起脱离后淡出
      const bound = seg(p, SEG.dock, smoothstep)
      ace2Group.current.rotateZ(0.1 * bound)
      ace2Mat.opacity = 1 - smoothstep(remap(p, SEG.zipper[0], SEG.zipper[1] + 0.1)) * 0.85
      ace2Mat.emissiveIntensity = 0.34 + pulse(remap(p, SEG.bindFlash[0], SEG.bindFlash[1])) * 0.9
    }
    if (bindGlow.current) {
      const g = pulse(remap(p, SEG.bindFlash[0], SEG.bindFlash[1]))
      bindGlow.current.visible = g > 0.02
      bindGlow.current.position.set(WORLD.heroAce2.x + ACE2_LAYOUT.bindingPoint.x, membraneCenterY + ACE2_LAYOUT.bindingPoint.y, WORLD.heroAce2.z)
      bindGlow.current.scale.setScalar(0.06 + g * 0.16)
      bindGlowMat.opacity = g * 0.9
    }

    // —— 主角 TMPRSS2：锚点固定在膜上，催化结构域伸向 S2′ 位点 ——
    if (anchorGroup.current && catalyticGroup.current) {
      sampleMembrane(WORLD.heroTmprss2.x, WORLD.heroTmprss2.z, state, _pos, _nrm, 0.05)
      anchorGroup.current.position.copy(_pos)
      _quat.setFromUnitVectors(UP, _nrm)
      anchorGroup.current.quaternion.copy(_quat)

      // 静止位置
      _tmp.copy(TMPRSS2_CATALYTIC_REST).applyQuaternion(_quat).add(_pos)
      // 目标：S2′ 位点旁
      if (spikeGroup.current) {
        _tmp2.set(0.055, L.s2PrimeY, 0.02).applyQuaternion(spikeGroup.current.quaternion).add(spikeGroup.current.position)
      } else {
        _tmp2.copy(_tmp)
      }
      const reach = seg(p, SEG.tmprss2Move, easeInOutCubic) * (1 - smoothstep(remap(p, SEG.zipper[0], SEG.zipper[1])))
      const jab = sharpPulse(cleaveT, 2) * 0.035
      catalyticGroup.current.position.copy(_tmp).lerp(_tmp2, reach)
      if (reach > 0.001) catalyticGroup.current.position.addScaledVector(_dir.copy(_tmp2).sub(_tmp).normalize(), jab)
      catalyticGroup.current.quaternion.copy(_quat)
      catalyticGroup.current.scale.setScalar(1 + sharpPulse(cleaveT, 3) * 0.22)
      catalyticGroup.current.visible = p > 2.6 && p < 4.4

      // 柔性茎：从 SRCR 顶端连到催化结构域
      if (linker.current) {
        _tmp.set(-0.008, 0.151, 0.004).applyQuaternion(anchorGroup.current.quaternion).add(anchorGroup.current.position)
        _dir.copy(catalyticGroup.current.position).sub(_tmp)
        const len = _dir.length()
        linker.current.visible = catalyticGroup.current.visible && len > 0.02
        linker.current.position.copy(_tmp).addScaledVector(_dir, 0.5)
        linker.current.scale.set(1, Math.max(0.001, len), 1)
        linker.current.quaternion.setFromUnitVectors(UP, _dir.normalize())
      }
      anchorGroup.current.visible = p > 1.55 && p < 5.4
    }

    // 呼吸感：主角刺突的自发光随事件起伏
    spikeMat.emissiveIntensity = 0.26 + pulse(remap(p, SEG.cleave[0], SEG.cleave[1])) * 0.5 + 0.05 * Math.sin(elapsed * 1.7)
  })

  return (
    <group>
      {/* —— 主角刺突：S2 部分（含柄部、中央螺旋、前发夹/六螺旋束、融合肽）—— */}
      <group ref={spikeGroup}>
        <mesh geometry={parts.stem} material={spikeMat} dispose={null} {...spikePick} />
        <mesh geometry={parts.core} material={spikeMat} position={[0, L.coreY, 0]} dispose={null} />
        <mesh ref={cleaveRing} geometry={parts.cleavageRing} material={tmprssMat} dispose={null} />
        <mesh ref={prehairpin} material={spikeMat} dispose={null}>
          <capsuleGeometry args={[0.015, 1, 3, 8]} />
        </mesh>
        <mesh ref={bundle} geometry={parts.sixHelixBundle} material={spikeMat} dispose={null} />
        <mesh ref={fusionPeptide} geometry={parts.fusionPeptide} material={spikeMat} dispose={null} />
        <Annotation id="spike" position={[0.16, 0.12, 0]} side="right" label="S2 六螺旋束（拉近两膜）" hidden={!showFusionLabels} lead={30} />
        <Annotation id="fusion-pore" position={[0.02, L.s2PrimeY + 0.06, 0.1]} side="left" label="S2′ 切割位点" hidden={!showFusionLabels} lead={26} />
      </group>

      {/* —— S1 头部：3 个 protomer，其中 0 号的 RBD 抬起并结合 ACE2 —— */}
      <group ref={s1Group}>
        {[0, 1, 2].map((k) => (
          <group key={k} rotation={[0, (k * Math.PI * 2) / 3, 0]}>
            <mesh
              geometry={parts.ntd}
              material={s1Mat}
              position={[L.ntdDist, L.ntdY, 0]}
              dispose={null}
            />
            <group ref={rbdHinges[k]} position={[RBD_PIVOT.x, RBD_PIVOT.y, RBD_PIVOT.z]}>
              <mesh geometry={parts.rbd} material={s1Mat} position={[RBD_OFFSET.x, RBD_OFFSET.y, RBD_OFFSET.z]} dispose={null} {...rbdPick} />
            </group>
            <mesh geometry={parts.apex} material={s1Mat} position={[0.012, L.apexY, 0]} dispose={null} />
          </group>
        ))}
        <Annotation id="rbd" position={[0.14, 0.5, 0.06]} side="right" label="RBD（“上”构象）" hidden={!showBindLabels} lead={28} />
      </group>

      {/* —— 主角 ACE2 —— */}
      <group ref={ace2Group}>
        <mesh geometry={ace2Geo} material={ace2Mat} dispose={null} {...ace2Pick} />
        <Annotation
          id="ace2"
          position={[-0.12, 0.3, 0.1]}
          side="left"
          label="ACE2 肽酶结构域"
          hidden={!showBindLabels}
          lead={30}
        />
      </group>

      {/* —— 主角 TMPRSS2：膜锚 + 柔性茎 + 催化结构域 —— */}
      <group ref={anchorGroup}>
        <mesh geometry={anchorGeo} material={tmprssMat} dispose={null} {...tmprssPick} />
      </group>
      <mesh ref={linker} material={tmprssMat} dispose={null}>
        <capsuleGeometry args={[0.011, 1, 2, 6]} />
      </mesh>
      <group ref={catalyticGroup}>
        <mesh geometry={catalyticGeo} material={tmprssMat} dispose={null} {...tmprssPick} />
        <Annotation id="tmprss2" position={[0.06, 0.08, 0.06]} side="right" label="TMPRSS2 催化结构域" hidden={!showFusionLabels} lead={26} />
      </group>

      {/* 事件闪光 */}
      <mesh ref={flash} material={flashMat} dispose={null}>
        <sphereGeometry args={[1, 14, 10]} />
      </mesh>
      <mesh ref={bindGlow} material={bindGlowMat} dispose={null}>
        <sphereGeometry args={[1, 14, 10]} />
      </mesh>

      <Annotation
        id="fusion-pore"
        position={[0.5, 0.16, 0.4]}
        side="right"
        label="融合肽插入宿主细胞膜"
        hidden={!showPeptideLabel}
        lead={34}
      />
    </group>
  )
}
