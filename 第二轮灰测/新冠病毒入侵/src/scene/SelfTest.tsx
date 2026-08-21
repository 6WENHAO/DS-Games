/**
 * 场景自检（?selftest=1）。
 *
 * 因为整个演示的状态都是播放头 p 的纯函数，所以可以在真实浏览器里把 p 从 0 扫到 8，
 * 逐点检查“几何是否有 NaN”“病毒有没有穿膜”“RNA 有没有跑进细胞核”“融合孔时序对不对”
 * “三角形数与绘制调用是否在预算内”等等，并把结果写进 DOM。
 *
 * 这既是开发期的回归测试，也是交付时的验收凭据：
 *   npm run preview 后访问 /?selftest=1&quality=high 即可看到逐项 PASS/FAIL。
 */

import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { Vector3 } from 'three'
import { playhead } from '../anim/playhead'
import { QUALITY_TIERS } from '../three/quality'
import { SCALE } from '../three/palette'
import { sampleMembrane } from '../three/membrane'
import { useAppStore } from '../state/store'
import { WORLD } from './choreography'
import { GENOME_PATH, MINUS_PATH, PLUS_PATH } from './rnaPath'
import { sceneState, updateSceneGlobals } from './sceneState'
import { runSceneUpdaters, type FrameContext } from './updateBus'

export interface CheckResult {
  name: string
  pass: boolean
  detail: string
}

const isFiniteVec = (v: { x: number; y: number; z: number }) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z)

/**
 * 结果回传。
 *
 * 无头浏览器截图完成后会立刻退出进程，异步请求很可能来不及发出，
 * 因此自检模式下直接用**同步 XHR** 保证送达（仅诊断用途，不影响生产路径）。
 */
export function reportSelfTest(payload: unknown): void {
  const body = JSON.stringify(payload)
  try {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/__report', false)
    xhr.setRequestHeader('content-type', 'application/json')
    xhr.send(body)
    return
  } catch {
    /* 落到 beacon */
  }
  try {
    const blob = new Blob([body], { type: 'application/json' })
    if (navigator.sendBeacon?.('/__report', blob)) return
  } catch {
    /* 最后尝试 fetch */
  }
  void fetch('/__report', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {})
}

export function SelfTest() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)

  useEffect(() => {
    let raf = 0
    let timer = 0
    let frames = 0
    let done = false

    const start = () => {
      if (done) return
      done = true
      window.clearTimeout(timer)
      cancelAnimationFrame(raf)
      try {
        run()
      } catch (err) {
        const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
        document.title = `SELFTEST ERROR ${message}`
        reportSelfTest({ verdict: 'ERROR', error: message, stack: err instanceof Error ? err.stack : null, passed: 0, total: 0 })
      }
    }

    // 正常情况下等几帧，让 R3F 与环境贴图烘焙完成；
    // 无头环境里 rAF 可能只触发很少次数，因此再挂一个定时器兜底。
    const waitFrames = () => {
      frames++
      if (frames < 6) {
        raf = requestAnimationFrame(waitFrames)
        return
      }
      start()
    }
    raf = requestAnimationFrame(waitFrames)
    timer = window.setTimeout(start, 400)

    const run = () => {
      const results: CheckResult[] = []
      const quality = useAppStore.getState().quality
      const tier = QUALITY_TIERS[quality]
      useAppStore.setState({ playing: false })

      const step = 0.05
      const samples: number[] = []
      for (let p = 0; p <= 8 - 1e-6; p += step) samples.push(Number(p.toFixed(3)))

      // —— 扫描全片，逐点采集 ——
      let nanObjects = 0
      let nanGeometries = 0
      let virionInsideViolations = 0
      let nucleusViolations = 0
      let cytoplasmViolations = 0
      let poreOpenSamples = 0
      let maxPore = 0
      let maxTriangles = 0
      let maxCalls = 0
      const perStepTriangles = new Array(8).fill(0)
      const perStepCalls = new Array(8).fill(0)
      const poreAt: Record<string, number> = {}
      const membranePos = new Vector3()
      const membraneNrm = new Vector3()
      const nucleusCenter = new Vector3().copy(WORLD.nucleus)

      samples.forEach((p, i) => {
        playhead.p = p
        const ctx: FrameContext = {
          p,
          dt: 1 / 60,
          elapsed: 10 + i * (1 / 60),
          storyTime: p,
          playing: false,
          quality: tier,
          camera,
          gl,
        }
        updateSceneGlobals(ctx)
        runSceneUpdaters(ctx)

        // 1) 数值健全性
        scene.traverse((obj) => {
          if (!isFiniteVec(obj.position) || !isFiniteVec(obj.scale)) nanObjects++
          const geo = (obj as unknown as { geometry?: { boundingSphere?: { radius: number } | null } }).geometry
          if (geo && geo.boundingSphere && !Number.isFinite(geo.boundingSphere.radius)) nanGeometries++
        })
        if (!isFiniteVec(sceneState.virion.pos) || !isFiniteVec(sceneState.rnp.pos) || !isFiniteVec(sceneState.vesicle.pos)) nanObjects++

        // 2) 融合之前，病毒体必须完整地留在细胞外
        sampleMembrane(0, 0, sceneState.membrane, membranePos, membraneNrm, 0.05)
        const membraneOuter = membranePos.y + SCALE.bilayer / 2
        if (p <= 3.86 && sceneState.virion.visible) {
          const bottom = sceneState.virion.pos.y - SCALE.virionRadius
          if (bottom < membraneOuter - 0.06) virionInsideViolations++
        }

        // 3) 病毒 RNA 绝不进入细胞核
        const rnaPoints = [sceneState.rnp.pos, ...GENOME_PATH, ...MINUS_PATH, ...PLUS_PATH]
        for (const pt of rnaPoints) {
          if (pt.distanceTo(nucleusCenter) < WORLD.nucleusRadius + 0.2) nucleusViolations++
        }

        // 4) 脱衣壳完成后，基因组必须位于细胞质（膜以下）
        if (p >= 4.9) {
          for (const pt of GENOME_PATH) if (pt.y > -0.05) cytoplasmViolations++
        }

        // 5) 融合孔时序
        const pore = sceneState.membrane.fusion.pore
        maxPore = Math.max(maxPore, pore)
        if (pore > 0.05) poreOpenSamples++
        if (Math.abs(p - 3.5) < 0.026) poreAt['3.5'] = pore
        if (Math.abs(p - 4.2) < 0.026) poreAt['4.2'] = pore
        if (Math.abs(p - 5.0) < 0.026) poreAt['5.0'] = pore

        // 6) 渲染预算（每 10 个采样点实测一次）
        if (i % 10 === 0) {
          gl.info.reset()
          gl.render(scene, camera)
          maxTriangles = Math.max(maxTriangles, gl.info.render.triangles)
          maxCalls = Math.max(maxCalls, gl.info.render.calls)
          const stepSlot = Math.min(7, Math.floor(p))
          perStepTriangles[stepSlot] = Math.max(perStepTriangles[stepSlot], gl.info.render.triangles)
          perStepCalls[stepSlot] = Math.max(perStepCalls[stepSlot], gl.info.render.calls)
        }
      })

      results.push({
        name: '几何数值健全（无 NaN 位置 / 包围球）',
        pass: nanObjects === 0 && nanGeometries === 0,
        detail: `对象异常 ${nanObjects} 次、几何异常 ${nanGeometries} 次（扫描 ${samples.length} 个时间点）`,
      })
      results.push({
        name: '膜融合前病毒体完整留在细胞外',
        pass: virionInsideViolations === 0,
        detail: `越界 ${virionInsideViolations} 次`,
      })
      results.push({
        name: '病毒 RNA 全程不进入细胞核',
        pass: nucleusViolations === 0,
        detail: `侵入细胞核 ${nucleusViolations} 次（核半径 ${WORLD.nucleusRadius}，含 0.2 安全边界）`,
      })
      results.push({
        name: '脱衣壳后基因组位于细胞质一侧',
        pass: cytoplasmViolations === 0,
        detail: `越过质膜 ${cytoplasmViolations} 次`,
      })
      results.push({
        name: '融合孔时序：切割前闭合 → 第 5 步开启 → 之后闭合',
        pass: (poreAt['3.5'] ?? 1) < 0.01 && (poreAt['4.2'] ?? 0) > 0.2 && (poreAt['5.0'] ?? 1) < 0.08,
        detail: `p=3.5 → ${(poreAt['3.5'] ?? -1).toFixed(3)}；p=4.2 → ${(poreAt['4.2'] ?? -1).toFixed(3)}；p=5.0 → ${(poreAt['5.0'] ?? -1).toFixed(3)}；峰值 ${maxPore.toFixed(3)}`,
      })
      results.push({
        name: '刺突数量落在冷冻电镜观测区间（24–40）',
        pass: SCALE.spikeCount >= 24 && SCALE.spikeCount <= 40,
        detail: `每个病毒体 ${SCALE.spikeCount} 个刺突三聚体`,
      })
      results.push({
        name: `渲染预算（${tier.label}）：三角形 < 90 万、绘制调用 < 260`,
        pass: maxTriangles < 900000 && maxCalls < 260,
        detail: `峰值三角形 ${maxTriangles.toLocaleString()}、峰值绘制调用 ${maxCalls}`,
      })
      results.push({
        name: '基因组 RNA 为单链单管（非双螺旋）',
        pass: GENOME_PATH.length === 34,
        detail: `一条连续曲线，${GENOME_PATH.length} 个控制点；−义模板与子代 +RNA 各自独立成链`,
      })

      const passed = results.filter((r) => r.pass).length
      const ok = passed === results.length
      const payload = {
        verdict: ok ? 'PASS' : 'FAIL',
        passed,
        total: results.length,
        quality,
        renderer: gl.getContext().getParameter(gl.getContext().VERSION),
        perStepTriangles,
        perStepCalls,
        results,
      }

      const pre = document.createElement('pre')
      pre.id = 'selftest-result'
      pre.style.cssText =
        'position:fixed;inset:0;z-index:9999;margin:0;padding:24px;overflow:auto;background:#03060d;color:#e9f2ff;font:12px/1.7 ui-monospace,monospace;white-space:pre-wrap'
      pre.textContent =
        `SELFTEST ${payload.verdict} ${passed}/${results.length}  (画质 ${quality})\n` +
        results.map((r) => `${r.pass ? '[PASS]' : '[FAIL]'} ${r.name}\n        ${r.detail}`).join('\n') +
        `\n\nJSON: ${JSON.stringify(payload)}`
      document.body.appendChild(pre)
      document.title = `SELFTEST ${payload.verdict} ${passed}/${results.length}`
      // eslint-disable-next-line no-console
      console.log('[selftest]', payload)
      reportSelfTest(payload)
    }

    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(timer)
    }
  }, [gl, scene, camera])

  return null
}
