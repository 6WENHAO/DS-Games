/**
 * 第 7 步：在 ERGIC 装配新病毒；第 8 步的子代病毒也由这里统一渲染。
 *
 * 分子事件：
 *  ① S、E、M 三种结构蛋白在**内质网**上合成并插入膜，沿分泌通路运到 **ERGIC**
 *     （内质网—高尔基体中间区室）——这是冠状病毒的装配位点；
 *  ② **M 蛋白是装配的总指挥**：它在 ERGIC 膜上形成晶格，并招募 S、E 以及
 *     N 蛋白包裹的基因组 RNA；
 *  ③ 核衣壳向 **ERGIC 腔内出芽**，把膜包裹成囊膜，芽颈断开后就是一颗完整的子代病毒；
 *  ④ 注意方向：M 的胞外域朝向 ERGIC 腔，出芽后这一面就变成病毒体的外表面。
 *
 * 另外，S 蛋白在经过高尔基体时会被 **furin** 在 S1/S2 位点预切割，
 * 使子代病毒“预激活”，更容易感染下一个细胞。
 */

import { useMemo, useRef } from 'react'
import { type Group, type InstancedMesh, Matrix4, type Mesh, Quaternion, Vector3 } from 'three'
import { clamp01, easeInOutCubic, easeOutCubic, lerp, remap, seg, smoothstep } from '../anim/ease'
import { buildProteinBlobGeometry } from '../three/geometry/machinery'
import {
  buildEnvelopeGeometry,
  buildMProteinGeometry,
  buildNProteinGeometry,
  buildSpikeGeometry,
  distributeOnEnvelope,
} from '../three/geometry/virion'
import { membraneMaterial, nucleicAcidMaterial, proteinMaterial } from '../three/materials'
import { COLORS, SCALE } from '../three/palette'
import { fibonacciSphere, mulberry32 } from '../three/rand'
import { Annotation, usePick, useStepIn } from './Annotation'
import { SEG, WORLD } from './choreography'
import { sceneState } from './sceneState'
import { UPDATE_ORDER, useSceneUpdate } from './updateBus'

const UP = new Vector3(0, 1, 0)
const R = SCALE.virionRadius
const ERGIC_SCALE = new Vector3(1.25, 0.78, 1)
const ERGIC_R = 1.9
/** 出芽位点在 ERGIC 内膜上的方向 */
const BUD_DIR = new Vector3(-0.55, 0.62, 0.56).normalize()

const _mat = new Matrix4()
const _pos = new Vector3()
const _quat = new Quaternion()
const _scale = new Vector3()
const _tmp = new Vector3()
const _dir = new Vector3()

/** 把 ERGIC 局部方向映射到它被拉伸后的实际膜面点。 */
function ergicSurface(dir: Vector3, radius: number, out: Vector3): Vector3 {
  return out.set(dir.x * radius * ERGIC_SCALE.x, dir.y * radius * ERGIC_SCALE.y, dir.z * radius * ERGIC_SCALE.z)
}

export function Assembly({ detail, progenyCount }: { detail: number; progenyCount: number }) {
  // —— 结构蛋白运输 ——
  const sBlob = useMemo(() => buildProteinBlobGeometry(0.05, COLORS.spike, 21, 1), [])
  const mBlob = useMemo(() => buildProteinBlobGeometry(0.038, COLORS.mProtein, 23, 1), [])
  const eBlob = useMemo(() => buildProteinBlobGeometry(0.028, COLORS.eProtein, 25, 1), [])
  const cargoMat = useMemo(() => proteinMaterial('#ffffff', { vertexColors: true, emissive: 0.42, roughness: 0.42 }), [])

  const transport = useMemo(() => {
    const rng = mulberry32(31337)
    return Array.from({ length: 18 }, (_, i) => ({
      kind: i % 3,
      delay: rng() * 0.55,
      wobble: rng() * 6.28,
      lateral: (rng() - 0.5) * 1.5,
    }))
  }, [])

  // —— M 蛋白晶格：ERGIC 内膜上出芽位点周围的一片 ——
  const mGeo = useMemo(() => buildMProteinGeometry(Math.max(1, detail - 1)), [detail])
  const latticeDirs = useMemo(() => {
    const pts = fibonacciSphere(260)
      .map(([x, y, z]) => new Vector3(x, y, z))
      .filter((d) => d.dot(BUD_DIR) > 0.72)
    return pts.slice(0, 54)
  }, [])

  // —— 子代病毒：一套实例化的囊膜 + 刺突，供第 7、8 步共用 ——
  const progenyEnvGeo = useMemo(() => buildEnvelopeGeometry(R, Math.max(2, detail - 1), 3), [detail])
  // 子代病毒是"远景群像"，不需要像主角那样做剖切透视：
  // 用更高的不透明度和更强的自发光，才能在拉远的收尾镜头里读成一颗颗温暖的病毒体。
  const progenyEnvMat = useMemo(
    () =>
      membraneMaterial(COLORS.envelope, {
        opacity: 0.88,
        repeat: 20,
        repeatY: 10,
        normalScale: 0.9,
        emissive: 0.2,
        sheenColor: '#ffd2b0',
        depthWrite: true,
      }),
    [],
  )
  // 子代病毒往往同时出现七八颗，刺突实例数量是三角形预算的大头：
  // 这里保持“每颗 24 个刺突”（真实区间 24–40 的下限）以维持结构正确，但改用低细分几何。
  const progenySpikeGeo = useMemo(() => buildSpikeGeometry(1), [])
  const progenySpikeMat = useMemo(() => proteinMaterial('#ffffff', { vertexColors: true, emissive: 0.46, roughness: 0.4 }), [])
  const SPIKES_PER_PROGENY = 24
  const progenySites = useMemo(() => distributeOnEnvelope(SPIKES_PER_PROGENY, R, 3, 0.6), [])

  // —— 出芽中的核衣壳（N + RNA）——
  const nGeo = useMemo(() => buildNProteinGeometry(1), [])
  const nMat = useMemo(() => proteinMaterial(COLORS.nProtein, { emissive: 0.44, roughness: 0.42 }), [])
  const rnaBallMat = useMemo(() => nucleicAcidMaterial(COLORS.rna, 0.8), [])
  const neckMat = useMemo(
    () => membraneMaterial(COLORS.ergic, { opacity: 0.5, repeat: 8, normalScale: 0.5, emissive: 0.1, sheenColor: '#cbb8ff' }),
    [],
  )

  const transportRef = useRef<InstancedMesh>(null)
  const transportMRef = useRef<InstancedMesh>(null)
  const transportERef = useRef<InstancedMesh>(null)
  const latticeRef = useRef<InstancedMesh>(null)
  const envRef = useRef<InstancedMesh>(null)
  const spikeRef = useRef<InstancedMesh>(null)
  const cargoRef = useRef<Group>(null)
  const neckRef = useRef<Mesh>(null)

  const mPick = usePick('m-protein')
  const ergicPick = usePick('ergic')
  const progenyPick = usePick('progeny-virion')

  const showAssemblyLabels = useStepIn(7)
  const showProgenyLabel = useStepIn(7, 8)

  /** 子代病毒的状态（位置 / 缩放）在这里集中计算，第 7、8 步共用一套实例。 */
  const progenyState = useMemo(
    () => Array.from({ length: Math.max(1, progenyCount) }, () => ({ pos: new Vector3(), scale: 0, spin: 0 })),
    [progenyCount],
  )
  const releaseDirs = useMemo(() => {
    const rng = mulberry32(515)
    return Array.from({ length: Math.max(1, progenyCount) }, (_, i) => {
      const a = (i / Math.max(1, progenyCount)) * Math.PI * 2 + rng() * 0.6
      return new Vector3(Math.cos(a) * 0.55, 0.75 + rng() * 0.4, Math.sin(a) * 0.55).normalize()
    })
  }, [progenyCount])

  useSceneUpdate(UPDATE_ORDER.assembly, ({ p, elapsed }) => {
    const synth = seg(p, SEG.structuralSynth, smoothstep)
    const toErgic = seg(p, SEG.toErgic, easeInOutCubic)
    const lattice = seg(p, SEG.mLattice, smoothstep)
    const bud = seg(p, SEG.budIn, easeInOutCubic)
    const complete = seg(p, SEG.virionComplete, easeOutCubic)
    const load = seg(p, SEG.vesicleLoad, smoothstep)
    const travel = seg(p, SEG.vesicleTravel, easeInOutCubic)
    const fuse = seg(p, SEG.exoFuse, smoothstep)
    const release = sceneState.release
    const active = p > 5.9

    // —— 结构蛋白从内质网运到 ERGIC ——
    const placeTransport = (mesh: InstancedMesh | null, kind: number) => {
      if (!mesh) return
      mesh.visible = active && synth > 0.02 && toErgic < 0.99
      if (!mesh.visible) return
      let n = 0
      for (let i = 0; i < transport.length; i++) {
        const t = transport[i]
        if (t.kind !== kind) continue
        const prog = clamp01(remap(toErgic, t.delay * 0.5, 0.7 + t.delay * 0.3))
        _pos.copy(WORLD.er).lerp(WORLD.ergic, prog)
        // 分泌通路不是直线：加一点横向摆动
        _pos.x += Math.sin(prog * Math.PI) * t.lateral
        _pos.y += Math.sin(prog * Math.PI) * 0.5 + Math.sin(elapsed * 0.8 + t.wobble) * 0.06
        _quat.setFromAxisAngle(UP, elapsed * 0.5 + t.wobble)
        _scale.setScalar(clamp01(remap(synth, t.delay * 0.6, t.delay * 0.6 + 0.35)) * (1 - clamp01(remap(prog, 0.92, 1))))
        _mat.compose(_pos, _quat, _scale)
        mesh.setMatrixAt(n++, _mat)
      }
      mesh.count = n
      mesh.instanceMatrix.needsUpdate = true
    }
    placeTransport(transportRef.current, 0)
    placeTransport(transportMRef.current, 1)
    placeTransport(transportERef.current, 2)

    // —— M 蛋白晶格在 ERGIC 内膜聚集 ——
    if (latticeRef.current) {
      latticeRef.current.visible = active && lattice > 0.02 && complete < 0.98
      if (latticeRef.current.visible) {
        for (let i = 0; i < latticeDirs.length; i++) {
          const d = latticeDirs[i]
          ergicSurface(d, ERGIC_R - 0.1, _pos).add(WORLD.ergic)
          // M 的胞外域朝向 ERGIC 腔（即朝内），出芽后这一面成为病毒体外表面
          _dir.copy(d).negate()
          _quat.setFromUnitVectors(UP, _dir)
          const appear = clamp01(remap(lattice, (i / latticeDirs.length) * 0.6, 0.75))
          _scale.setScalar(appear * (1 - complete * 0.85))
          _mat.compose(_pos, _quat, _scale)
          latticeRef.current.setMatrixAt(i, _mat)
        }
        latticeRef.current.instanceMatrix.needsUpdate = true
      }
    }

    // —— 出芽的核衣壳：从内膜面推进腔内 ——
    if (cargoRef.current) {
      ergicSurface(BUD_DIR, ERGIC_R - 0.35, _tmp).add(WORLD.ergic)
      _pos.copy(_tmp).lerp(WORLD.ergic, bud)
      cargoRef.current.position.copy(_pos)
      cargoRef.current.scale.setScalar(lerp(0.35, 1, bud) * (1 - complete))
      cargoRef.current.visible = active && bud > 0.02 && complete < 0.95
      cargoRef.current.rotation.y = elapsed * 0.2
    }
    if (neckRef.current) {
      const neck = clamp01(bud) * (1 - clamp01(remap(bud, 0.75, 1)))
      ergicSurface(BUD_DIR, ERGIC_R - 0.12, _pos).add(WORLD.ergic)
      neckRef.current.position.copy(_pos)
      _dir.copy(BUD_DIR).negate()
      neckRef.current.quaternion.setFromUnitVectors(UP, _dir)
      neckRef.current.scale.set(0.3 + neck * 0.5, 0.4 * neck + 0.05, 0.3 + neck * 0.5)
      neckRef.current.visible = active && neck > 0.03
    }

    // —— 子代病毒状态 ——
    for (let i = 0; i < progenyState.length; i++) {
      const st = progenyState[i]
      st.spin = elapsed * 0.12 + i
      if (i === 0) {
        // 第一颗：在 ERGIC 腔内成形 → 装入囊泡 → 随囊泡运输 → 从融合孔释出
        st.scale = complete
        _pos.copy(WORLD.ergic)
        if (load > 0.01) _pos.lerp(sceneState.vesicle.pos, load)
        if (travel > 0.01) _pos.copy(sceneState.vesicle.pos)
        if (fuse > 0.4) {
          _tmp.copy(WORLD.exo).setY(0.35).addScaledVector(releaseDirs[0], release * 2.2)
          _pos.lerp(_tmp, clamp01(remap(fuse, 0.4, 1)))
        }
        st.pos.copy(_pos)
      } else {
        // 其余子代：胞吐时接连被释放，向胞外散去（散开距离刻意收敛，保证一眼能看清"一群病毒"）
        const delay = (i - 1) * 0.13
        const t = clamp01(remap(release, delay, delay + 0.55))
        st.scale = t > 0.02 ? 1 : 0
        _pos.copy(WORLD.exo).setY(0.15)
        _pos.addScaledVector(releaseDirs[i], t * (1.1 + i * 0.35))
        _pos.y += Math.sin(elapsed * 0.5 + i) * 0.12
        st.pos.copy(_pos)
      }
    }

    // 写入实例矩阵
    if (envRef.current && spikeRef.current) {
      let visibleCount = 0
      for (let i = 0; i < progenyState.length; i++) {
        const st = progenyState[i]
        _quat.setFromAxisAngle(UP, st.spin)
        _scale.setScalar(st.scale)
        _mat.compose(st.pos, _quat, _scale)
        envRef.current.setMatrixAt(i, _mat)
        for (let s = 0; s < progenySites.length; s++) {
          const site = progenySites[s]
          _pos.copy(site.position).applyQuaternion(_quat).multiplyScalar(st.scale).add(st.pos)
          _dir.copy(site.normal).applyQuaternion(_quat)
          const q = _quatFromUp(_dir)
          _scale.setScalar(st.scale)
          _mat.compose(_pos, q, _scale)
          spikeRef.current.setMatrixAt(i * progenySites.length + s, _mat)
        }
        if (st.scale > 0.01) visibleCount++
      }
      envRef.current.instanceMatrix.needsUpdate = true
      spikeRef.current.instanceMatrix.needsUpdate = true
      const show = active && visibleCount > 0
      envRef.current.visible = show
      spikeRef.current.visible = show
    }
  })

  return (
    <group>
      <instancedMesh ref={transportRef} args={[sBlob, cargoMat, 6]} frustumCulled={false} renderOrder={22} dispose={null} />
      <instancedMesh ref={transportMRef} args={[mBlob, cargoMat, 6]} frustumCulled={false} renderOrder={22} dispose={null} {...mPick} />
      <instancedMesh ref={transportERef} args={[eBlob, cargoMat, 6]} frustumCulled={false} renderOrder={22} dispose={null} />

      <instancedMesh ref={latticeRef} args={[mGeo, cargoMat, latticeDirs.length]} frustumCulled={false} renderOrder={17} dispose={null} {...mPick} />

      {/* 出芽中的核衣壳：N 蛋白包裹的 RNA 团 */}
      <group ref={cargoRef}>
        <mesh material={rnaBallMat} renderOrder={19} dispose={null}>
          <sphereGeometry args={[R * 0.62, 14, 12]} />
        </mesh>
        {fibonacciSphere(14).map(([x, y, z], i) => (
          <mesh key={i} geometry={nGeo} material={nMat} position={[x * R * 0.66, y * R * 0.66, z * R * 0.66]} renderOrder={19} dispose={null} />
        ))}
      </group>
      {/* 芽颈：出芽完成后收紧断开 */}
      <mesh ref={neckRef} material={neckMat} renderOrder={18} dispose={null} {...ergicPick}>
        <cylinderGeometry args={[R * 0.55, R * 0.8, 1, 14, 1, true]} />
      </mesh>

      {/* 子代病毒（囊膜 + 刺突），第 7、8 步共用 */}
      <instancedMesh
        ref={envRef}
        args={[progenyEnvGeo, progenyEnvMat, progenyState.length]}
        frustumCulled={false}
        renderOrder={20}
        dispose={null}
        {...progenyPick}
      />
      <instancedMesh
        ref={spikeRef}
        args={[progenySpikeGeo, progenySpikeMat, progenyState.length * progenySites.length]}
        frustumCulled={false}
        renderOrder={21}
        dispose={null}
        {...progenyPick}
      />

      <Annotation
        id="ergic"
        position={[WORLD.ergic.x - 1.4, WORLD.ergic.y + 1.7, WORLD.ergic.z + 0.8]}
        side="left"
        label="ERGIC · 冠状病毒的装配车间"
        hidden={!showAssemblyLabels}
        lead={36}
      />
      <Annotation
        id="m-protein"
        position={[WORLD.ergic.x - 1.1, WORLD.ergic.y + 0.9, WORLD.ergic.z + 1.0]}
        side="left"
        label="M 蛋白晶格（装配总指挥）"
        hidden={!showAssemblyLabels}
      />
      <Annotation
        id="progeny-virion"
        position={[WORLD.ergic.x + 1.2, WORLD.ergic.y + 0.5, WORLD.ergic.z]}
        side="right"
        label="新装配的子代病毒"
        hidden={!showProgenyLabel}
      />
      <Annotation
        id="e-protein"
        position={[WORLD.ergic.x + 0.4, WORLD.ergic.y - 1.5, WORLD.ergic.z + 0.6]}
        side="right"
        label="E 蛋白参与成熟与释放"
        hidden={!showAssemblyLabels}
      />
    </group>
  )
}

/** 复用一个四元数对象，把 +Y 对到给定方向。 */
const _upQuat = new Quaternion()
function _quatFromUp(dir: Vector3): Quaternion {
  return _upQuat.setFromUnitVectors(UP, dir)
}
