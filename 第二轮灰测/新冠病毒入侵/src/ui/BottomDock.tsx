/**
 * 底部控制区：8 步时间轴 + 播放控制 + 总进度条。
 *
 * 进度条与时间轴的填充宽度不走 React 状态，而是每帧直接写 DOM style，
 * 这样 60fps 更新进度也不会引起任何组件重渲染。
 */

import { useRef } from 'react'
import { absoluteSeconds, formatTime, playhead, seekAbsolute, stepIndexOf, stepProgressOf, totalDuration } from '../anim/playhead'
import { STEPS } from '../data/steps'
import { useAppStore } from '../state/store'
import { IconLoop, IconNext, IconPause, IconPlay, IconPrev } from './icons'
import { useRafTick } from './useRaf'

export function BottomDock() {
  const stepIndex = useAppStore((s) => s.stepIndex)
  const playing = useAppStore((s) => s.playing)
  const speed = useAppStore((s) => s.speed)
  const loop = useAppStore((s) => s.loop)
  const goToStep = useAppStore((s) => s.goToStep)
  const next = useAppStore((s) => s.next)
  const prev = useAppStore((s) => s.prev)
  const togglePlay = useAppStore((s) => s.togglePlay)
  const cycleSpeed = useAppStore((s) => s.cycleSpeed)
  const toggleLoop = useAppStore((s) => s.toggleLoop)

  const fillRefs = useRef<(HTMLElement | null)[]>([])
  const scrubFill = useRef<HTMLDivElement>(null)
  const timeRef = useRef<HTMLDivElement>(null)
  const scrubBox = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  useRafTick(() => {
    const p = playhead.p
    const current = stepIndexOf(p)
    const t = stepProgressOf(p)
    for (let i = 0; i < STEPS.length; i++) {
      const el = fillRefs.current[i]
      if (!el) continue
      const w = i < current ? 1 : i === current ? t : 0
      el.style.width = `${(w * 100).toFixed(2)}%`
    }
    const seconds = absoluteSeconds(p)
    if (scrubFill.current) scrubFill.current.style.width = `${((seconds / totalDuration) * 100).toFixed(3)}%`
    if (timeRef.current) timeRef.current.textContent = `${formatTime(seconds)} / ${formatTime(totalDuration)}`
  })

  const scrubTo = (clientX: number) => {
    const box = scrubBox.current
    if (!box) return
    const rect = box.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const idx = seekAbsolute(ratio * totalDuration)
    useAppStore.setState({ stepIndex: idx, selected: null })
  }

  return (
    <footer className="bottom-dock">
      <nav className="timeline" aria-label="感染流程步骤">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={`tl-step ${i === stepIndex ? 'is-current' : ''} ${i < stepIndex ? 'is-done' : ''}`}
            onClick={() => goToStep(i)}
            title={`${s.title} · ${s.subtitle}`}
          >
            <span className="idx">
              {String(s.index).padStart(2, '0')} · {s.titleEn}
            </span>
            <span className="name">{s.title}</span>
            <i
              className="tl-fill"
              ref={(el) => {
                fillRefs.current[i] = el
              }}
            />
          </button>
        ))}
      </nav>

      <div className="panel playbar">
        <div className="pb-group">
          <button type="button" className="pb-btn" onClick={prev} title="上一步（←）">
            <IconPrev />
          </button>
          <button type="button" className="pb-btn primary" onClick={togglePlay} title="播放 / 暂停（空格）">
            {playing ? <IconPause size={20} /> : <IconPlay size={20} />}
          </button>
          <button type="button" className="pb-btn" onClick={next} title="下一步（→）">
            <IconNext />
          </button>
        </div>

        <div
          className="scrub"
          ref={scrubBox}
          role="slider"
          aria-label="播放进度"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round((absoluteSeconds(playhead.p) / totalDuration) * 100)}
          tabIndex={0}
          onPointerDown={(e) => {
            dragging.current = true
            e.currentTarget.setPointerCapture(e.pointerId)
            scrubTo(e.clientX)
          }}
          onPointerMove={(e) => {
            if (dragging.current) scrubTo(e.clientX)
          }}
          onPointerUp={() => {
            dragging.current = false
          }}
          onPointerCancel={() => {
            dragging.current = false
          }}
        >
          <div className="scrub-track">
            <div className="scrub-fill" ref={scrubFill} />
            <div className="scrub-marks">
              {STEPS.map((s) => (
                <i key={s.id} style={{ flexGrow: s.durationSec }} />
              ))}
            </div>
          </div>
        </div>

        <div className="time-code" ref={timeRef}>
          0:00 / {formatTime(totalDuration)}
        </div>

        <button type="button" className="speed-btn" onClick={cycleSpeed} title="播放速度（0.5× / 1× / 1.5× / 2×）">
          {speed % 1 === 0 ? speed.toFixed(0) : speed.toFixed(1)}×
        </button>
        <button type="button" className={`pb-btn ${loop ? 'is-on' : ''}`} onClick={toggleLoop} title="循环播放">
          <IconLoop />
        </button>
      </div>
    </footer>
  )
}
