/**
 * 核衣壳与基因组 RNA：从病毒体内部的盘绕状态 → 穿过融合孔 → 在细胞质中脱衣壳伸展。
 *
 * 科学要点：
 *  · 进入细胞质的是 N 蛋白包裹的 +ssRNA（核糖核蛋白复合体），呈“串珠状”而非双螺旋；
 *  · 脱衣壳后 N 蛋白逐步解离，裸露的 +ssRNA 带 5′ 帽与 3′ poly(A)，
 *    因此**可以直接**被宿主核糖体当成 mRNA 翻译；
 *  · 全过程在细胞质中完成，绝不进入细胞核。
 */

import { useMemo, useRef } from 'react'
import { type Group, type InstancedMesh, Matrix4, type Mesh, Quaternion, Vector3 } from 'three'
import { clamp01, easeInOutCubic, remap, seg, smoothstep } from '../anim/ease'
import { buildNProteinGeometry, buildNucleocapsid } from '../three/geometry/virion'
import { TubeRibbon } from '../three/geometry/tube'
import { glowMaterial, nucleicAcidMaterial, proteinMaterial } from '../three/materials'
import { COLORS, SCALE } from '../three/palette'
import { mulberry32 } from '../three/rand'
import { Annotation, usePick, useStepIn } from './Annotation'
import { SEG } from './choreography'
import { GENOME_PATH } from './rnaPath'
import { sceneState } from './sceneState'
import { UPDATE_ORDER, useSceneUpdate } from './updateBus'

const UP = new Vector3(0, 1, 0)
const _quat = new Quaternion()
const _mat = new Matrix4()
const _scale = new Vector3()
const _pos = new Vector3()
const _tangent = new Vector3()

/** 核衣壳内部半径：囊膜内腔 = 囊膜外半径 − 双分子层厚度，再留一点余量。 */
const INNER = SCALE.virionRadius - SCALE.bilayer - 0.06

export function Nucleocapsid() {
  // 盘绕路径与 N 蛋白串珠（确定性生成）
  const { path: coiled, beads } = useMemo(() => buildNucleocapsid(INNER, 5, GENOME_PATH.length), [])
  const nGeo = useMemo(() => buildNProteinGeometry(1), [])
  const nMat = useMemo(() => proteinMaterial(COLORS.nProtein, { emissive: 0.44, roughness: 0.4, clearcoat: 0.6 }), [])

  const ribbon = useMemo(
    // 半径 0.05 世界单位 = 2.5 nm：真实 ssRNA 直径约 1 nm，
    // 这里放粗约 2.5 倍，否则在能看清整个细胞质的镜头下会细到不足一个像素。
    () => new TubeRibbon({ segments: 150, radial: 7, radius: 0.05, beadFrequency: GENOME_PATH.length * 1.5, beadAmplitude: 0.22 }),
    [],
  )
  const rnaMat = useMemo(() => nucleicAcidMaterial(COLORS.rna, 0.8), [])
  const capMat = useMemo(() => proteinMaterial('#eaf6ff', { emissive: 0.45, roughness: 0.3 }), [])
  const polyAMat = useMemo(() => nucleicAcidMaterial('#b6ffd9', 0.7), [])
  // 内部柔光只是"提示有东西在里面"，不能盖住囊膜与刺突冠：半径与不透明度都压得很低
  const haloMat = useMemo(() => glowMaterial(COLORS.rna, 0.05), [])

  // 每帧混合“盘绕（局部坐标 + 病毒体位置）”与“伸展（世界坐标）”两套控制点
  const points = useMemo(() => coiled.map(() => new Vector3()), [coiled])
  // N 蛋白解离时的漂移方向
  const drift = useMemo(() => {
    const rng = mulberry32(7717)
    return beads.map(() => new Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize().multiplyScalar(0.55 + rng() * 0.8))
  }, [beads])

  const rnaRef = useRef<Mesh>(null)
  const beadRef = useRef<InstancedMesh>(null)
  const haloRef = useRef<Mesh>(null)
  const capRef = useRef<Mesh>(null)
  const polyARef = useRef<Mesh>(null)
  const lastKey = useRef('')

  const rnaPick = usePick('viral-rna')
  const nPick = usePick('n-protein')
  const showRnpLabels = useStepIn(1, 5)
  const showRnaLabels = useStepIn(5, 6)

  useSceneUpdate(UPDATE_ORDER.nucleocapsid, ({ p, elapsed }) => {
    const rnp = sceneState.rnp
    const uncoat = rnp.uncoat
    const active = p < 7.15
    if (rnaRef.current) rnaRef.current.visible = active
    if (haloRef.current) haloRef.current.visible = active && uncoat < 0.6
    if (!active) {
      if (beadRef.current) beadRef.current.visible = false
      return
    }

    const e = easeInOutCubic(uncoat)
    // 只有形态真正变化时才重建管道顶点，静止时省掉这份开销
    const key = `${rnp.pos.x.toFixed(3)}|${rnp.pos.y.toFixed(3)}|${rnp.pos.z.toFixed(3)}|${e.toFixed(4)}|${rnp.squeeze.toFixed(3)}`
    if (key !== lastKey.current) {
      lastKey.current = key
      for (let i = 0; i < points.length; i++) {
        const c = coiled[i]
        _pos.set(rnp.pos.x + c.x * rnp.squeeze, rnp.pos.y + c.y * rnp.squeeze, rnp.pos.z + c.z * rnp.squeeze)
        points[i].copy(_pos).lerp(GENOME_PATH[i], e)
      }
      ribbon.update(points)
    }

    if (haloRef.current) {
      haloRef.current.position.copy(rnp.pos)
      haloRef.current.scale.setScalar(INNER * (0.7 + 0.03 * Math.sin(elapsed * 2)))
      ;(haloRef.current.material as { opacity: number }).opacity = 0.05 * (1 - uncoat)
    }

    // N 蛋白串珠：沿链分布，脱衣壳时解离漂散
    if (beadRef.current) {
      const fade = 1 - smoothstep(remap(uncoat, 0.15, 0.95))
      beadRef.current.visible = fade > 0.02
      if (beadRef.current.visible) {
        for (let i = 0; i < beads.length; i++) {
          const idx = Math.min(points.length - 1, Math.round((i / beads.length) * points.length))
          const nextIdx = Math.min(points.length - 1, idx + 1)
          _pos.copy(points[idx])
          const dissociate = clamp01(remap(uncoat, 0.1 + (i / beads.length) * 0.35, 0.75))
          _pos.addScaledVector(drift[i], dissociate * 1.35)
          _tangent.copy(points[nextIdx]).sub(points[idx])
          if (_tangent.lengthSq() < 1e-8) _tangent.set(0, 1, 0)
          _quat.setFromUnitVectors(UP, _tangent.normalize())
          _scale.setScalar(fade * (1 - dissociate * 0.45))
          _mat.compose(_pos, _quat, _scale)
          beadRef.current.setMatrixAt(i, _mat)
        }
        beadRef.current.instanceMatrix.needsUpdate = true
      }
    }

    // 5′ 帽与 3′ poly(A)：脱衣壳后才点亮（此时 RNA 才作为 mRNA 被识别）
    const endsVisible = uncoat > 0.45
    if (capRef.current) {
      capRef.current.visible = endsVisible
      capRef.current.position.copy(points[0])
      capRef.current.scale.setScalar(0.055 * seg(p, [SEG.uncoat[0] + 0.2, SEG.uncoat[1]] as const, smoothstep))
    }
    if (polyARef.current) {
      polyARef.current.visible = endsVisible
      polyARef.current.position.copy(points[points.length - 1])
      polyARef.current.scale.setScalar(0.05 * seg(p, [SEG.uncoat[0] + 0.25, SEG.uncoat[1]] as const, smoothstep))
    }
  })

  return (
    <group>
      <mesh ref={rnaRef} geometry={ribbon.geometry} material={rnaMat} renderOrder={20} dispose={null} {...rnaPick} />
      <mesh ref={haloRef} material={haloMat} renderOrder={18} dispose={null}>
        <sphereGeometry args={[1, 16, 12]} />
      </mesh>
      <instancedMesh
        ref={beadRef}
        args={[nGeo, nMat, beads.length]}
        frustumCulled={false}
        renderOrder={21}
        dispose={null}
        {...nPick}
      />
      <mesh ref={capRef} material={capMat} renderOrder={22} dispose={null}>
        <sphereGeometry args={[1, 12, 10]} />
      </mesh>
      <mesh ref={polyARef} material={polyAMat} renderOrder={22} dispose={null}>
        <sphereGeometry args={[1, 12, 10]} />
      </mesh>

      <RnpLabels showRnp={showRnpLabels} showRna={showRnaLabels} />
    </group>
  )
}

/** 标签跟随核衣壳/RNA 移动。 */
function RnpLabels({ showRnp, showRna }: { showRnp: boolean; showRna: boolean }) {
  const ref = useRef<Group>(null)
  useSceneUpdate(UPDATE_ORDER.annotations, () => {
    if (ref.current) ref.current.position.copy(sceneState.rnp.pos)
  })
  return (
    <>
      <group ref={ref}>
        <Annotation id="n-protein" position={[0.42, 0.4, 0.2]} side="right" label="N 蛋白包裹的核衣壳" hidden={!showRnp} />
        <Annotation id="viral-rna" position={[-0.4, -0.34, -0.2]} side="left" label="+ssRNA 基因组（单链）" hidden={!showRnp} />
      </group>
      <Annotation
        id="viral-rna"
        position={[GENOME_PATH[6].x, GENOME_PATH[6].y + 0.5, GENOME_PATH[6].z]}
        side="right"
        label="正义单链 RNA · 约 29.9 kb · 5′帽 / 3′poly(A)"
        hidden={!showRna}
      />
    </>
  )
}
