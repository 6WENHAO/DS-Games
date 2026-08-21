/**
 * 场景总装 + 全片唯一的 useFrame。
 *
 * 每帧的执行顺序被严格固定（见 src/scene/updateBus.ts）：
 *   推进播放头 → 计算全局状态（膜形变、病毒体位置…）→ 各组件按 order 更新 → 相机 → 渲染。
 * 这样“把受体种在膜面上”“相机跟住本帧刚移动的物体”这类依赖关系才不会错一帧。
 */

import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { advance, playhead } from '../anim/playhead'
import { appState, useAppStore } from '../state/store'
import { QUALITY_TIERS, type Quality } from '../three/quality'
import { Assembly } from './Assembly'
import { Background } from './Background'
import { CameraRig } from './CameraRig'
import { CellMembrane } from './Membrane'
import { Cytoplasm } from './Cytoplasm'
import { Effects } from './Effects'
import { Egress } from './Egress'
import { HeroFusion } from './HeroFusion'
import { Lighting } from './Lighting'
import { Nucleocapsid } from './Nucleocapsid'
import { ReceptorField } from './Receptors'
import { Replication } from './Replication'
import { SelfTest } from './SelfTest'
import { Virion } from './Virion'
import { sceneState, updateSceneGlobals } from './sceneState'
import { runSceneUpdaters, type FrameContext } from './updateBus'

const ORDER: Quality[] = ['low', 'medium', 'high']

/** 自检模式：?selftest=1 */
const SELFTEST = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('selftest') === '1'

export function Experience() {
  const quality = useAppStore((s) => s.quality)
  const tier = QUALITY_TIERS[quality]

  // —— 帧率统计与自动画质调节 ——
  const perf = useRef({ frames: 0, accum: 0, slowSeconds: 0, fastSeconds: 0 })
  const ctxRef = useRef<FrameContext | null>(null)

  useEffect(() => {
    // 首帧之后淡出加载屏
    const id = requestAnimationFrame(() => useAppStore.getState().setReady())
    return () => cancelAnimationFrame(id)
  }, [])

  useFrame((state, delta) => {
    // 限幅：切到后台再回来时 delta 会非常大，不能让动画瞬间跳过好几步
    const dt = Math.min(0.05, Math.max(0.0005, delta))
    playhead.elapsed += dt

    const { playing, speed, loop } = appState()
    if (playing) {
      playhead.storyTime += dt * speed
      const changed = advance(dt, speed, loop)
      if (changed !== null) useAppStore.setState({ stepIndex: changed })
    }

    const ctx: FrameContext = {
      p: playhead.p,
      dt,
      elapsed: playhead.elapsed,
      storyTime: playhead.storyTime,
      playing,
      quality: tier,
      camera: state.camera,
      gl: state.gl,
    }
    ctxRef.current = ctx

    updateSceneGlobals(ctx)
    runSceneUpdaters(ctx)

    // —— 帧率采样（每秒一次写入 store，避免高频重渲染）——
    const m = perf.current
    m.frames++
    m.accum += dt
    if (m.accum >= 1) {
      const fps = Math.round(m.frames / m.accum)
      m.frames = 0
      m.accum = 0
      const store = useAppStore.getState()
      store.setFps(fps)
      if (store.autoQuality) {
        const idx = ORDER.indexOf(store.quality)
        if (fps < 26) {
          m.slowSeconds++
          m.fastSeconds = 0
          if (m.slowSeconds >= 3 && idx > 0) {
            store.setQuality(ORDER[idx - 1])
            m.slowSeconds = 0
          }
        } else if (fps >= 57) {
          m.fastSeconds++
          m.slowSeconds = 0
          if (m.fastSeconds >= 8 && idx < ORDER.length - 1) {
            store.setQuality(ORDER[idx + 1])
            m.fastSeconds = 0
          }
        } else {
          m.slowSeconds = 0
          m.fastSeconds = 0
        }
      }
    }
  })

  return (
    <>
      <Lighting />
      <CameraRig />
      <Background dustCount={tier.dustCount} />

      <CellMembrane segments={tier.membraneSegments} lipidCount={tier.lipidCount} />
      {/* 受体森林是实例化的“群演”：细分度比主角低一级，节省出来的三角形留给特写 */}
      <ReceptorField detail={tier.spikeDetail} />
      <Cytoplasm ribosomeCount={tier.ribosomeCount} detail={tier.spikeDetail} />

      <Virion envelopeDetail={tier.envelopeDetail} spikeDetail={tier.spikeDetail} transmission={tier.transmission} />
      <HeroFusion detail={tier.spikeDetail + 1} />
      <Nucleocapsid />

      <Replication detail={tier.spikeDetail} />
      <Assembly detail={tier.spikeDetail + 1} progenyCount={tier.progenyCount} />
      <Egress detail={tier.spikeDetail} />

      <Effects tier={tier} />
      {SELFTEST && <SelfTest />}
    </>
  )
}

/** 供 UI 读取当前场景状态（例如调试面板）。 */
export { sceneState }
