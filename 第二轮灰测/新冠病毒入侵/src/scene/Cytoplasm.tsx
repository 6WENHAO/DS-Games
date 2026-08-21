/**
 * 细胞质舞台：细胞核、内质网、ERGIC、高尔基体、线粒体、游离核糖体。
 *
 * 空间关系遵循真实分泌途径的顺序：内质网 →（ERGIC）→ 高尔基体 → 分泌囊泡 → 质膜。
 * 内质网与核膜相连，因此把内质网网络安排在细胞核上方紧贴的位置。
 *
 * 细胞核在整片演示中始终可见，并在第 5 步打出“病毒 RNA 不进入细胞核”的醒目标注 ——
 * 这是本项目最重要的一条科学纠错。
 */

import { useMemo, useRef } from 'react'
import { type InstancedMesh, Matrix4, type Mesh, Quaternion, Vector3 } from 'three'
import { pulse, remap } from '../anim/ease'
import { buildRibosomeGeometry } from '../three/geometry/machinery'
import { buildNuclearPoreGeometry } from '../three/geometry/hostSurface'
import {
  buildChromatinGeometry,
  buildCisternaGeometry,
  buildErNetworkGeometry,
  buildErgicSacGeometry,
  buildMitochondrionGeometry,
  buildNucleusGeometry,
  ergicSatelliteLayout,
  golgiStackLayout,
} from '../three/geometry/organelles'
import { glowMaterial, membraneMaterial, organelleMaterial, proteinMaterial } from '../three/materials'
import { COLORS } from '../three/palette'
import { fibonacciSphere, mulberry32 } from '../three/rand'
import { Annotation, usePick, useStepIn } from './Annotation'
import { SEG, WORLD } from './choreography'
import { UPDATE_ORDER, useSceneUpdate } from './updateBus'

const UP = new Vector3(0, 1, 0)
const _mat = new Matrix4()
const _pos = new Vector3()
const _quat = new Quaternion()
const _scale = new Vector3()

export function Cytoplasm({ ribosomeCount, detail }: { ribosomeCount: number; detail: number }) {
  const nucleusR = WORLD.nucleusRadius

  const nucleusGeo = useMemo(() => buildNucleusGeometry(nucleusR, Math.min(3, detail + 1), 801), [nucleusR, detail])
  const nucleusInnerGeo = useMemo(() => buildNucleusGeometry(nucleusR - 0.16, Math.min(3, detail + 1), 803), [nucleusR, detail])
  const chromatinGeo = useMemo(() => buildChromatinGeometry(nucleusR * 0.86, 7, 811, detail), [nucleusR, detail])
  const poreGeo = useMemo(() => buildNuclearPoreGeometry(detail), [detail])
  const erGeo = useMemo(() => buildErNetworkGeometry(501, 7, detail), [detail])
  const ergicGeo = useMemo(() => buildErgicSacGeometry(1.9, Math.min(3, detail + 1), 601), [detail])
  const mitoGeo = useMemo(() => buildMitochondrionGeometry(detail, 901), [detail])
  const riboGeo = useMemo(() => buildRibosomeGeometry(Math.max(1, detail)), [detail])

  const nucleusMat = useMemo(
    () => membraneMaterial(COLORS.nucleus, { opacity: 0.42, repeat: 42, repeatY: 21, normalScale: 0.5, emissive: 0.05, sheenColor: '#7fb0e0' }),
    [],
  )
  const nucleusInnerMat = useMemo(() => organelleMaterial('#24405c', { opacity: 0.35, emissive: 0.03, roughness: 0.7 }), [])
  const chromatinMat = useMemo(() => proteinMaterial('#5a7ba8', { emissive: 0.1, roughness: 0.65, vertexColors: true }), [])
  const poreMat = useMemo(() => proteinMaterial(COLORS.nucleusEnvelope, { emissive: 0.14, roughness: 0.5, vertexColors: true }), [])
  const erMat = useMemo(
    () => membraneMaterial(COLORS.er, { opacity: 0.5, repeat: 26, normalScale: 0.55, emissive: 0.05, sheenColor: '#8fc4e8', vertexColors: true }),
    [],
  )
  const ergicMat = useMemo(
    () => membraneMaterial(COLORS.ergic, { opacity: 0.46, repeat: 16, repeatY: 8, normalScale: 0.6, emissive: 0.1, sheenColor: '#cbb8ff' }),
    [],
  )
  const golgiMat = useMemo(() => organelleMaterial(COLORS.golgi, { opacity: 0.48, emissive: 0.07 }), [])
  const mitoMat = useMemo(() => organelleMaterial(COLORS.mitochondria, { opacity: 0.62, emissive: 0.05, roughness: 0.72 }), [])
  const riboMat = useMemo(() => proteinMaterial('#ffffff', { vertexColors: true, emissive: 0.12, roughness: 0.55, clearcoat: 0.3 }), [])
  const warnMat = useMemo(() => glowMaterial(COLORS.danger, 0.5).clone(), [])

  const golgi = useMemo(() => golgiStackLayout(5), [])
  const golgiGeos = useMemo(
    () => golgi.map((c, i) => buildCisternaGeometry(c.radius, c.thickness, c.bend, Math.min(3, detail + 1), 401 + i)),
    [golgi, detail],
  )
  const satellites = useMemo(() => ergicSatelliteLayout(611, 9), [])

  // 核孔：只铺在朝向观众/朝上的那一侧，避免无谓的绘制
  const poreSites = useMemo(() => {
    const dirs = fibonacciSphere(64)
    return dirs
      .map(([x, y, z]) => new Vector3(x, y, z))
      .filter((d) => d.y > 0.05)
      .slice(0, 30)
  }, [])

  // 游离核糖体 + 粗面内质网上的核糖体
  const riboLayout = useMemo(() => {
    const rng = mulberry32(4242)
    return Array.from({ length: ribosomeCount }, (_, i) => {
      const onEr = i % 3 === 0
      const center = onEr ? WORLD.er : WORLD.translationZone
      const spread = onEr ? 3.2 : 4.6
      return {
        pos: new Vector3(
          center.x + (rng() - 0.5) * spread * 1.6,
          center.y + (rng() - 0.5) * spread * 0.75,
          center.z + (rng() - 0.5) * spread * 1.4,
        ),
        axis: new Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize(),
        angle: rng() * Math.PI * 2,
        phase: rng() * 10,
        scale: 0.8 + rng() * 0.4,
      }
    })
  }, [ribosomeCount])

  const poreRef = useRef<InstancedMesh>(null)
  const riboRef = useRef<InstancedMesh>(null)
  const warnRef = useRef<Mesh>(null)

  const nucleusPick = usePick('nucleus')
  const erPick = usePick('er')
  const ergicPick = usePick('ergic')
  const golgiPick = usePick('golgi')
  const riboPick = usePick('ribosome')

  const showNucleusWarning = useStepIn(5, 6)
  const showOrganelleLabels = useStepIn(6, 7, 8)

  useSceneUpdate(UPDATE_ORDER.organelles, ({ p, elapsed }) => {
    if (poreRef.current) {
      for (let i = 0; i < poreSites.length; i++) {
        const d = poreSites[i]
        _pos.copy(d).multiplyScalar(nucleusR).add(WORLD.nucleus)
        _quat.setFromUnitVectors(UP, d)
        _scale.setScalar(1)
        _mat.compose(_pos, _quat, _scale)
        poreRef.current.setMatrixAt(i, _mat)
      }
      poreRef.current.instanceMatrix.needsUpdate = true
    }
    if (riboRef.current) {
      for (let i = 0; i < riboLayout.length; i++) {
        const r = riboLayout[i]
        // 缓慢的布朗漂移，让细胞质显得“活着”
        _pos.set(
          r.pos.x + Math.sin(elapsed * 0.21 + r.phase) * 0.1,
          r.pos.y + Math.cos(elapsed * 0.17 + r.phase) * 0.08,
          r.pos.z + Math.sin(elapsed * 0.13 + r.phase * 1.3) * 0.1,
        )
        _quat.setFromAxisAngle(r.axis, r.angle + elapsed * 0.05)
        _scale.setScalar(r.scale)
        _mat.compose(_pos, _quat, _scale)
        riboRef.current.setMatrixAt(i, _mat)
      }
      riboRef.current.instanceMatrix.needsUpdate = true
    }
    if (warnRef.current) {
      const w = pulse(remap(p, SEG.nucleusWarning[0], SEG.nucleusWarning[1]))
      const on = p > SEG.nucleusWarning[0] - 0.1 && p < 6.1
      warnRef.current.visible = on
      warnMat.opacity = on ? 0.22 + w * 0.45 : 0
      warnRef.current.scale.setScalar(1 + w * 0.04)
    }
  })

  return (
    <group>
      {/* —— 细胞核：核膜 + 内膜 + 染色质 + 核孔 —— */}
      <group position={WORLD.nucleus}>
        <mesh geometry={nucleusGeo} material={nucleusMat} renderOrder={2} dispose={null} {...nucleusPick} />
        <mesh geometry={nucleusInnerGeo} material={nucleusInnerMat} renderOrder={1} dispose={null} />
        <mesh geometry={chromatinGeo} material={chromatinMat} renderOrder={0} dispose={null} />
        {/* 禁区提示环：贴在核膜上方 */}
        <mesh ref={warnRef} material={warnMat} position={[0.6, nucleusR * 0.88, 0.4]} rotation={[Math.PI / 2, 0, 0]} renderOrder={860}>
          <torusGeometry args={[1.5, 0.05, 6, 48]} />
        </mesh>
      </group>
      <instancedMesh ref={poreRef} args={[poreGeo, poreMat, poreSites.length]} frustumCulled={false} renderOrder={3} dispose={null} />

      {/* —— 内质网（与核膜相连）—— */}
      <group position={WORLD.er}>
        <mesh geometry={erGeo} material={erMat} renderOrder={8} dispose={null} {...erPick} />
      </group>

      {/* —— ERGIC：装配位点 —— */}
      <group position={WORLD.ergic}>
        <mesh geometry={ergicGeo} material={ergicMat} renderOrder={9} dispose={null} {...ergicPick} />
        {satellites.map((s, i) => (
          <mesh key={i} position={s.pos} material={ergicMat} renderOrder={9} dispose={null}>
            <sphereGeometry args={[s.r, 12, 10]} />
          </mesh>
        ))}
      </group>

      {/* —— 高尔基体 —— */}
      <group position={WORLD.golgi} rotation={[0.12, 0.5, -0.08]}>
        {golgiGeos.map((g, i) => (
          <mesh key={i} geometry={g} material={golgiMat} position={[0, golgi[i].y, 0]} renderOrder={9} dispose={null} {...golgiPick} />
        ))}
      </group>

      {/* —— 线粒体（布景）—— */}
      {WORLD.mitochondria.map((m, i) => (
        <mesh key={i} geometry={mitoGeo} material={mitoMat} position={m} rotation={[0.2, i * 1.7, 0.4]} renderOrder={8} dispose={null} />
      ))}

      {/* —— 游离核糖体与粗面内质网核糖体 —— */}
      <instancedMesh
        ref={riboRef}
        args={[riboGeo, riboMat, riboLayout.length]}
        frustumCulled={false}
        renderOrder={11}
        dispose={null}
        {...riboPick}
      />

      <Annotation
        id="nucleus"
        position={[WORLD.nucleus.x + 1.2, WORLD.nucleus.y + nucleusR + 0.5, WORLD.nucleus.z + 0.6]}
        side="right"
        variant="warn"
        label="宿主细胞核 · 病毒 RNA 不进入这里"
        hidden={!showNucleusWarning}
        lead={40}
      />
      <Annotation id="er" position={[WORLD.er.x - 1.6, WORLD.er.y + 1.3, WORLD.er.z + 1.2]} side="left" label="内质网（合成 S/E/M）" hidden={!showOrganelleLabels} />
      <Annotation id="golgi" position={[WORLD.golgi.x + 1.2, WORLD.golgi.y + 1.1, WORLD.golgi.z]} side="right" label="高尔基体" hidden={!showOrganelleLabels} />
    </group>
  )
}
