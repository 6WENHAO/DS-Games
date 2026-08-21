/**
 * 第 6 步：翻译与基因组复制。
 *
 * 分子事件（严格按真实顺序）：
 *  ① 宿主 80S 核糖体直接结合 +ssRNA 的 5′ 端，沿链翻译出多聚蛋白 pp1a；
 *     部分核糖体在滑移序列处发生 **−1 移码**，继续翻译 ORF1b，得到更长的 pp1ab；
 *  ② 多聚蛋白被病毒自身的 PLpro(nsp3) 与 3CLpro/Mpro(nsp5) 切成 **16 个非结构蛋白**；
 *  ③ nsp12（RdRp）+ nsp7/nsp8 组成聚合酶核心，与 nsp13 解旋酶等一起构成复制转录复合体（RTC）；
 *  ④ RTC 在由 nsp3/nsp4/nsp6 诱导形成的 **双膜囊泡（DMV）** 内工作：
 *     先以 +RNA 为模板合成 **−义 RNA 中间体**，再以 −RNA 为模板大量合成子代 +RNA；
 *  ⑤ 通过**不连续转录**产生一套嵌套的亚基因组 mRNA，输出到细胞质 / 内质网翻译结构蛋白。
 *
 * 画面上刻意做对的两件事：所有 RNA 都是**单链**；复制**全程在细胞质**的 DMV 内，与细胞核无关。
 */

import { useMemo, useRef } from 'react'
import { type Group, type InstancedMesh, Matrix4, type Mesh, Quaternion, Vector3 } from 'three'
import { clamp01, easeInOutCubic, easeOutCubic, lerp, remap, seg, smoothstep } from '../anim/ease'
import {
  buildDmvPoreGeometry,
  buildDmvShellGeometry,
  buildHelicaseGeometry,
  buildProteinBlobGeometry,
  buildRibosomeGeometry,
  buildRtcGeometry,
  nspFragmentLayout,
} from '../three/geometry/machinery'
import { TubeRibbon } from '../three/geometry/tube'
import { membraneMaterial, nucleicAcidMaterial, proteinMaterial } from '../three/materials'
import { COLORS } from '../three/palette'
import { mulberry32 } from '../three/rand'
import { Annotation, usePick, useStepIn } from './Annotation'
import { DMV_RADIUS, SEG, WORLD } from './choreography'
import { GENOME_CURVE, MINUS_PATH, PLUS_PATH, SG_PATHS, partialPath } from './rnaPath'
import { UPDATE_ORDER, useSceneUpdate } from './updateBus'

const UP = new Vector3(0, 1, 0)
const _mat = new Matrix4()
const _pos = new Vector3()
const _quat = new Quaternion()
const _scale = new Vector3()
const _tan = new Vector3()
const _tmp = new Vector3()

/** 多聚核糖体：沿基因组链行进的核糖体数量 */
const POLYSOME = 5
/** 每个核糖体后面拖着的新生肽链珠数 */
const CHAIN_BEADS = 9

export function Replication({ detail }: { detail: number }) {
  const riboGeo = useMemo(() => buildRibosomeGeometry(detail), [detail])
  const riboMat = useMemo(() => proteinMaterial('#ffffff', { vertexColors: true, emissive: 0.16, roughness: 0.5 }), [])
  const chainGeo = useMemo(() => buildProteinBlobGeometry(0.028, COLORS.polyprotein, 3, 1), [])
  const chainMat = useMemo(() => proteinMaterial(COLORS.polyprotein, { emissive: 0.3, roughness: 0.42, vertexColors: true }), [])
  const nspGeos = useMemo(() => nspFragmentLayout(7), [])
  const nspGeo = useMemo(() => buildProteinBlobGeometry(0.038, COLORS.polyprotein, 11, 1), [])
  const rtcGeo = useMemo(() => buildRtcGeometry(detail), [detail])
  const rtcMat = useMemo(() => proteinMaterial(COLORS.rdrp, { emissive: 0.48, roughness: 0.36, clearcoat: 0.6, vertexColors: true }), [])
  const helicaseGeo = useMemo(() => buildHelicaseGeometry(Math.max(1, detail - 1)), [detail])

  const dmvOuterGeo = useMemo(() => buildDmvShellGeometry(DMV_RADIUS, Math.min(3, detail + 1), 311), [detail])
  const dmvInnerGeo = useMemo(() => buildDmvShellGeometry(DMV_RADIUS - 0.13, Math.min(3, detail + 1), 313), [detail])
  const dmvPoreGeo = useMemo(() => buildDmvPoreGeometry(detail), [detail])
  const dmvMat = useMemo(
    () => membraneMaterial(COLORS.dmv, { opacity: 0.34, repeat: 22, repeatY: 11, normalScale: 0.5, emissive: 0.06, sheenColor: '#8fb4e8' }),
    [],
  )
  const dmvInnerMat = useMemo(
    () => membraneMaterial('#3c5c88', { opacity: 0.3, repeat: 20, repeatY: 10, normalScale: 0.45, emissive: 0.05, sheenColor: '#7fa8dd' }),
    [],
  )
  const dmvPoreMat = useMemo(() => proteinMaterial('#9dc3f0', { emissive: 0.24, roughness: 0.45, vertexColors: true }), [])

  // —— 三条 RNA：−义模板、子代 +RNA、亚基因组 mRNA（半径同样按可读性放粗约 2.5 倍）——
  const minusRibbon = useMemo(() => new TubeRibbon({ segments: 90, radial: 6, radius: 0.042, beadFrequency: 30, beadAmplitude: 0.2 }), [])
  const plusRibbon = useMemo(() => new TubeRibbon({ segments: 90, radial: 6, radius: 0.046, beadFrequency: 30, beadAmplitude: 0.2 }), [])
  const sgRibbons = useMemo(
    () => SG_PATHS.map(() => new TubeRibbon({ segments: 54, radial: 6, radius: 0.038, beadFrequency: 18, beadAmplitude: 0.18 })),
    [],
  )
  const minusMat = useMemo(() => nucleicAcidMaterial(COLORS.rnaMinus, 0.7), [])
  const plusMat = useMemo(() => nucleicAcidMaterial(COLORS.rna, 0.95), [])
  const sgMat = useMemo(() => nucleicAcidMaterial(COLORS.sgRna, 0.8), [])

  const scratch = useMemo(
    () => ({
      minus: MINUS_PATH.map(() => new Vector3()),
      plus: PLUS_PATH.map(() => new Vector3()),
      sg: SG_PATHS.map((p) => p.map(() => new Vector3())),
    }),
    [],
  )

  /** nsp 碎块的漂移方向 */
  const nspDrift = useMemo(() => {
    const rng = mulberry32(9137)
    return nspGeos.map(() => new Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize().multiplyScalar(0.6 + rng() * 0.9))
  }, [nspGeos])

  const riboRef = useRef<InstancedMesh>(null)
  const chainRef = useRef<InstancedMesh>(null)
  const nspRef = useRef<InstancedMesh>(null)
  const rtcRef = useRef<Group>(null)
  const minusRef = useRef<Mesh>(null)
  const plusRef = useRef<Mesh>(null)
  const sgRefs = useRef<(Mesh | null)[]>([])
  const dmvRef = useRef<Group>(null)

  const riboPick = usePick('ribosome')
  const chainPick = usePick('pp1ab')
  const rtcPick = usePick('nsp12-rdrp')
  const dmvPick = usePick('dmv')

  const showTranslation = useStepIn(6)
  const showReplication = useStepIn(6, 7)

  useSceneUpdate(UPDATE_ORDER.replication, ({ p, elapsed }) => {
    const bind = seg(p, SEG.ribosomeBind, smoothstep)
    const translate = seg(p, SEG.translate, easeInOutCubic)
    const cut = seg(p, SEG.polyproteinCut, smoothstep)
    const assemble = seg(p, SEG.rtcAssemble, easeOutCubic)
    const minusT = seg(p, SEG.minusStrand, easeInOutCubic)
    const plusT = seg(p, SEG.plusStrand, easeInOutCubic)
    const sgT = seg(p, SEG.sgRna, easeInOutCubic)
    const active = p > 4.9 && p < 7.3

    // —— 多聚核糖体沿 +ssRNA 行进 ——
    if (riboRef.current) {
      riboRef.current.visible = active && bind > 0.02
      if (riboRef.current.visible) {
        for (let i = 0; i < POLYSOME; i++) {
          const offset = 0.05 + i * 0.135
          const u = clamp01(offset + translate * 0.5)
          GENOME_CURVE.getPoint(u, _pos)
          GENOME_CURVE.getTangent(u, _tan).normalize()
          _quat.setFromUnitVectors(UP, _tan)
          // 结合阶段：核糖体从周围“游”到链上
          const appear = clamp01(remap(bind, i * 0.12, i * 0.12 + 0.5))
          _tmp.set(Math.sin(i * 2.1) * 1.4, 0.9 + i * 0.15, Math.cos(i * 1.7) * 1.2).add(_pos)
          _pos.lerp(_tmp, 1 - appear)
          _scale.setScalar(0.9 * appear * (1 - cut * 0.55))
          _mat.compose(_pos, _quat, _scale)
          riboRef.current.setMatrixAt(i, _mat)
        }
        riboRef.current.instanceMatrix.needsUpdate = true
      }
    }

    // —— 新生多肽链（pp1a / pp1ab）：从核糖体出口通道挤出 ——
    if (chainRef.current) {
      chainRef.current.visible = active && translate > 0.02 && cut < 0.85
      if (chainRef.current.visible) {
        for (let i = 0; i < POLYSOME; i++) {
          const u = clamp01(0.05 + i * 0.135 + translate * 0.5)
          GENOME_CURVE.getPoint(u, _pos)
          const grown = clamp01(remap(translate, i * 0.08, 1)) * CHAIN_BEADS
          for (let b = 0; b < CHAIN_BEADS; b++) {
            const idx = i * CHAIN_BEADS + b
            const on = b < grown
            const a = b * 0.9 + elapsed * 0.6 + i
            // 新生链盘绕着垂下去，越往后越松散
            _tmp.set(
              _pos.x + Math.cos(a) * (0.07 + b * 0.014),
              _pos.y - 0.16 - b * 0.045,
              _pos.z + Math.sin(a) * (0.07 + b * 0.014),
            )
            _quat.identity()
            _scale.setScalar(on ? 1 - cut : 0)
            _mat.compose(_tmp, _quat, _scale)
            chainRef.current.setMatrixAt(idx, _mat)
          }
        }
        chainRef.current.instanceMatrix.needsUpdate = true
      }
    }

    // —— 切割成 16 个 nsp：散开，其中一部分奔向 DMV 组装成 RTC ——
    if (nspRef.current) {
      nspRef.current.visible = active && cut > 0.02
      if (nspRef.current.visible) {
        for (let i = 0; i < nspGeos.length; i++) {
          const frag = nspGeos[i]
          const isCore = i >= 11 && i <= 14
          _pos.set(
            WORLD.translationZone.x + frag.offset[0],
            WORLD.translationZone.y + frag.offset[1] - 0.4,
            WORLD.translationZone.z + frag.offset[2],
          )
          _pos.addScaledVector(nspDrift[i], cut * 0.5 + Math.sin(elapsed * 0.4 + i) * 0.04)
          if (isCore) {
            // 聚合酶核心组分迁移进 DMV
            _tmp.set(WORLD.dmv.x + (i - 12.5) * 0.16, WORLD.dmv.y + 0.35, WORLD.dmv.z + 0.2)
            _pos.lerp(_tmp, assemble)
          }
          _quat.setFromAxisAngle(nspDrift[i], elapsed * 0.4 + i)
          _scale.setScalar((frag.radius / 0.038) * cut * (isCore ? 1 - assemble * 0.9 : 1))
          _mat.compose(_pos, _quat, _scale)
          nspRef.current.setMatrixAt(i, _mat)
        }
        nspRef.current.instanceMatrix.needsUpdate = true
      }
    }

    // —— RTC：在 DMV 内沿 −RNA 模板滑动 ——
    if (rtcRef.current) {
      rtcRef.current.visible = active && assemble > 0.05
      const u = clamp01(0.1 + Math.max(minusT, plusT) * 0.75)
      const idx = Math.min(MINUS_PATH.length - 2, Math.floor(u * (MINUS_PATH.length - 1)))
      _pos.copy(MINUS_PATH[idx])
      _tan.copy(MINUS_PATH[idx + 1]).sub(MINUS_PATH[idx]).normalize()
      rtcRef.current.position.copy(_pos)
      rtcRef.current.quaternion.setFromUnitVectors(UP, _tan)
      rtcRef.current.scale.setScalar(assemble)
    }

    // —— 三类 RNA 的合成过程 ——
    if (minusRef.current) {
      minusRef.current.visible = active && minusT > 0.01
      if (minusRef.current.visible) minusRibbon.update(partialPath(MINUS_PATH, minusT, scratch.minus))
    }
    if (plusRef.current) {
      plusRef.current.visible = active && plusT > 0.01
      if (plusRef.current.visible) plusRibbon.update(partialPath(PLUS_PATH, plusT, scratch.plus))
    }
    SG_PATHS.forEach((path, i) => {
      const mesh = sgRefs.current[i]
      if (!mesh) return
      const t = clamp01(remap(sgT, i * 0.25, 1))
      mesh.visible = active && t > 0.01
      if (mesh.visible) sgRibbons[i].update(partialPath(path, t, scratch.sg[i]))
    })

    // DMV 轻微呼吸
    if (dmvRef.current) {
      dmvRef.current.visible = p > 5.3 && p < 7.4
      const s = 1 + Math.sin(elapsed * 0.7) * 0.012
      dmvRef.current.scale.setScalar(s * lerp(0.7, 1, seg(p, [5.3, 5.7] as const, smoothstep)))
    }
  })

  return (
    <group>
      {/* —— 多聚核糖体与新生多肽链 —— */}
      <instancedMesh ref={riboRef} args={[riboGeo, riboMat, POLYSOME]} frustumCulled={false} renderOrder={22} dispose={null} {...riboPick} />
      <instancedMesh
        ref={chainRef}
        args={[chainGeo, chainMat, POLYSOME * CHAIN_BEADS]}
        frustumCulled={false}
        renderOrder={22}
        dispose={null}
        {...chainPick}
      />
      <instancedMesh ref={nspRef} args={[nspGeo, chainMat, nspGeos.length]} frustumCulled={false} renderOrder={22} dispose={null} />

      {/* —— 双膜囊泡：复制的“无菌工作台” —— */}
      <group ref={dmvRef} position={WORLD.dmv}>
        <mesh geometry={dmvInnerGeo} material={dmvInnerMat} renderOrder={14} dispose={null} />
        <mesh geometry={dmvOuterGeo} material={dmvMat} renderOrder={15} dispose={null} {...dmvPick} />
        <mesh geometry={dmvPoreGeo} material={dmvPoreMat} position={[0.35, DMV_RADIUS - 0.02, 0.2]} renderOrder={16} dispose={null} />
      </group>

      {/* —— RTC：nsp12(RdRp) + nsp7/nsp8 + nsp13 解旋酶 —— */}
      <group ref={rtcRef}>
        <mesh geometry={rtcGeo} material={rtcMat} renderOrder={23} dispose={null} {...rtcPick} />
        <mesh geometry={helicaseGeo} material={rtcMat} position={[0.1, 0.12, -0.06]} renderOrder={23} dispose={null} />
      </group>

      {/* —— RNA 链 —— */}
      <mesh ref={minusRef} geometry={minusRibbon.geometry} material={minusMat} renderOrder={24} dispose={null} />
      <mesh ref={plusRef} geometry={plusRibbon.geometry} material={plusMat} renderOrder={24} dispose={null} />
      {SG_PATHS.map((_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            sgRefs.current[i] = m
          }}
          geometry={sgRibbons[i].geometry}
          material={sgMat}
          renderOrder={24}
          dispose={null}
        />
      ))}

      <Annotation
        id="ribosome"
        position={[WORLD.translationZone.x - 0.6, WORLD.translationZone.y + 0.85, WORLD.translationZone.z + 0.5]}
        side="left"
        label="宿主 80S 核糖体（多聚核糖体）"
        hidden={!showTranslation}
      />
      <Annotation
        id="pp1ab"
        position={[WORLD.translationZone.x + 1.0, WORLD.translationZone.y - 0.7, WORLD.translationZone.z]}
        side="right"
        label="多聚蛋白 pp1a / pp1ab → 16 个 nsp"
        hidden={!showTranslation}
      />
      <Annotation
        id="dmv"
        position={[WORLD.dmv.x - 0.4, WORLD.dmv.y + DMV_RADIUS + 0.45, WORLD.dmv.z]}
        side="left"
        label="双膜囊泡 DMV（复制细胞器）"
        hidden={!showReplication}
        lead={38}
      />
      <Annotation
        id="nsp12-rdrp"
        position={[WORLD.dmv.x + 1.15, WORLD.dmv.y + 0.5, WORLD.dmv.z + 0.6]}
        side="right"
        label="RdRp（nsp12）复制转录复合体"
        hidden={!showReplication}
      />
      <Annotation
        id="minus-rna"
        position={[MINUS_PATH[10].x, MINUS_PATH[10].y - 0.55, MINUS_PATH[10].z]}
        side="left"
        label="−义 RNA 中间体（模板）"
        hidden={!showReplication}
        lead={26}
      />
      <Annotation
        id="sgrna"
        position={[SG_PATHS[0][8].x + 0.3, SG_PATHS[0][8].y + 0.4, SG_PATHS[0][8].z]}
        side="right"
        label="亚基因组 mRNA（不连续转录）"
        hidden={!showReplication}
      />
    </group>
  )
}
