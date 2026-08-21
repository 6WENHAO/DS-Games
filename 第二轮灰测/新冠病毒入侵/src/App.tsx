/**
 * 应用外壳：一块全屏 Canvas + 一层不拦截鼠标的 UI。
 *
 * 关键点：
 *  · Canvas 只创建一次；画质切档只改 dpr 与后处理，不重建 WebGL 上下文；
 *  · UI 层用 pointer-events:none，只有面板/按钮本身可点，其余点击穿透给 3D 场景；
 *  · WebGL 不可用时给出可读的降级提示，而不是白屏。
 */

import { Canvas } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import { ACESFilmicToneMapping } from 'three'
import { Experience } from './scene/Experience'
import { nudgeZoom, resetView } from './scene/CameraRig'
import { reportSelfTest } from './scene/SelfTest'
import { useAppStore } from './state/store'
import { QUALITY_TIERS, isSoftwareRenderer } from './three/quality'
import { BottomDock } from './ui/BottomDock'
import { InfoPanel } from './ui/InfoPanel'
import { Legend } from './ui/Legend'
import { GlossaryModal, HelpModal } from './ui/Modals'
import { TopBar } from './ui/TopBar'

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

/** 键盘快捷键：科普展台上用键盘操作比鼠标可靠。 */
function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      const s = useAppStore.getState()
      switch (e.key) {
        case ' ':
          e.preventDefault()
          s.togglePlay()
          break
        case 'ArrowRight':
          s.next()
          break
        case 'ArrowLeft':
          s.prev()
          break
        case 'l':
        case 'L':
          s.toggleLabels()
          break
        case 'r':
        case 'R':
          s.toggleAutoRotate()
          break
        case 'e':
        case 'E':
          s.toggleLegend()
          break
        case 'g':
        case 'G':
          s.toggleGlossary()
          break
        case 'h':
        case 'H':
          s.toggleHelp()
          break
        case 'p':
        case 'P':
          s.togglePerf()
          break
        case 'q':
        case 'Q': {
          const order = ['low', 'medium', 'high'] as const
          const i = order.indexOf(s.quality)
          s.setQuality(order[(i + 1) % order.length], true)
          break
        }
        case '0':
          resetView()
          break
        case '=':
        case '+':
          nudgeZoom(0.85)
          break
        case '-':
        case '_':
          nudgeZoom(1.18)
          break
        case 'Escape':
          s.closeOverlays()
          break
        default:
          if (/^[1-8]$/.test(e.key)) s.goToStep(Number(e.key) - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

export default function App() {
  const quality = useAppStore((s) => s.quality)
  const ready = useAppStore((s) => s.ready)
  const setQuality = useAppStore((s) => s.setQuality)
  const [webgl] = useState(hasWebGL)
  const tier = QUALITY_TIERS[quality]

  useShortcuts()

  useEffect(() => {
    document.body.classList.toggle('app-ready', ready)
  }, [ready])

  if (!webgl) {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('selftest') === '1') {
      reportSelfTest({ verdict: 'ERROR', error: 'WebGL 不可用，3D 场景未启动', passed: 0, total: 0 })
    }
    return (
      <div className="fallback">
        <div>
          <h2>无法启动 3D 场景</h2>
          <p style={{ color: 'var(--dim)' }}>
            当前浏览器未启用 WebGL。请更新到较新版本的 Chrome / Edge / Firefox / Safari，
            或在浏览器设置中开启硬件加速后重新打开本页。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="canvas-holder">
        <Canvas
          dpr={tier.dpr}
          camera={{ fov: 40, near: 0.06, far: 320, position: [2.6, 8.2, 3.2] }}
          gl={{
            antialias: !tier.postprocessing,
            alpha: false,
            stencil: false,
            powerPreference: 'high-performance',
            preserveDrawingBuffer: false,
          }}
          onCreated={({ gl }) => {
            gl.toneMapping = ACESFilmicToneMapping
            gl.toneMappingExposure = 0.92
            // 软件渲染（SwiftShader 等）直接降到最低档，避免个位数帧率；
            // 但如果用户/URL 参数已手动指定画质，则尊重手动选择。
            if (useAppStore.getState().autoQuality && isSoftwareRenderer(gl.getContext())) setQuality('low')
          }}
        >
          <Experience />
        </Canvas>
      </div>

      <div className="ui-layer">
        <TopBar />
        <div className="ui-middle">
          <InfoPanel />
          <Legend />
        </div>
        <BottomDock />
      </div>

      <GlossaryModal />
      <HelpModal />
    </div>
  )
}
