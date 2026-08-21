/** 顶栏：标题、显示开关、画质、图例/术语表/帮助入口、实时帧率。 */

import { STEPS } from '../data/steps'
import { useAppStore } from '../state/store'
import { QUALITY_TIERS, type Quality } from '../three/quality'
import { resetView } from '../scene/CameraRig'
import { IconBook, IconGauge, IconHelp, IconLabel, IconLayers, IconRotate, IconTarget } from './icons'

const QUALITY_ORDER: Quality[] = ['low', 'medium', 'high']

export function TopBar() {
  const stepIndex = useAppStore((s) => s.stepIndex)
  const showLabels = useAppStore((s) => s.showLabels)
  const autoRotate = useAppStore((s) => s.autoRotate)
  const legendOpen = useAppStore((s) => s.legendOpen)
  const quality = useAppStore((s) => s.quality)
  const autoQuality = useAppStore((s) => s.autoQuality)
  const fps = useAppStore((s) => s.fps)
  const showPerf = useAppStore((s) => s.showPerf)
  const toggleLabels = useAppStore((s) => s.toggleLabels)
  const toggleAutoRotate = useAppStore((s) => s.toggleAutoRotate)
  const toggleLegend = useAppStore((s) => s.toggleLegend)
  const toggleGlossary = useAppStore((s) => s.toggleGlossary)
  const toggleHelp = useAppStore((s) => s.toggleHelp)
  const setQuality = useAppStore((s) => s.setQuality)

  const step = STEPS[stepIndex]

  const cycleQuality = () => {
    const i = QUALITY_ORDER.indexOf(quality)
    setQuality(QUALITY_ORDER[(i + 1) % QUALITY_ORDER.length], true)
  }

  return (
    <header className="topbar">
      <div className="brand">
        <h1>新冠病毒入侵人体细胞</h1>
        <span className="brand-en">SARS-CoV-2 · Cell Entry &amp; Replication</span>
      </div>
      <div className="topbar-spacer" />

      {showPerf && (
        <div className={`fps-chip ${fps < 30 ? 'is-low' : ''}`}>
          <b>{fps}</b> fps · 第 {step.index}/{STEPS.length} 步
        </div>
      )}

      <div className="tool-group">
        <button type="button" className={`tool-btn ${showLabels ? 'is-on' : ''}`} onClick={toggleLabels} title="显示/隐藏分子标签（L）">
          <IconLabel />
          <span className="label">标签</span>
        </button>
        <button type="button" className={`tool-btn ${autoRotate ? 'is-on' : ''}`} onClick={toggleAutoRotate} title="自动缓慢旋转（R）">
          <IconRotate />
          <span className="label">自转</span>
        </button>
        <button type="button" className="tool-btn" onClick={resetView} title="复位视角（0）">
          <IconTarget />
          <span className="label">复位</span>
        </button>
        <button type="button" className={`tool-btn ${legendOpen ? 'is-on' : ''}`} onClick={toggleLegend} title="图例（E）">
          <IconLayers />
          <span className="label">图例</span>
        </button>
        <button type="button" className="tool-btn" onClick={toggleGlossary} title="术语表与参考文献（G）">
          <IconBook />
          <span className="label">术语</span>
        </button>
        <button type="button" className="tool-btn" onClick={cycleQuality} title={`画质：${QUALITY_TIERS[quality].label}${autoQuality ? '（自动）' : '（手动）'}`}>
          <IconGauge />
          <span className="label">{QUALITY_TIERS[quality].label}</span>
        </button>
        <button type="button" className="tool-btn" onClick={toggleHelp} title="使用说明（H）">
          <IconHelp />
        </button>
      </div>
    </header>
  )
}
