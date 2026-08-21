/**
 * 左侧信息面板：当前步骤解说 + 要点 + 关键分子 + 误区纠正 + 深入阅读，
 * 以及点击分子后弹出的分子卡片。
 */

import { MOLECULES } from '../data/molecules'
import { STEPS } from '../data/steps'
import type { MoleculeId } from '../data/types'
import { useAppStore } from '../state/store'
import { MOLECULE_COLOR } from '../three/palette'
import { IconChevron, IconChevronDown } from './icons'

function MoleculeChip({ id }: { id: MoleculeId }) {
  const selected = useAppStore((s) => s.selected)
  const select = useAppStore((s) => s.select)
  const m = MOLECULES[id]
  if (!m) return null
  return (
    <button
      type="button"
      className={`chip ${selected === id ? 'is-active' : ''}`}
      style={{ ['--chip-color' as string]: MOLECULE_COLOR[id], color: selected === id ? MOLECULE_COLOR[id] : undefined }}
      onClick={() => select(selected === id ? null : id)}
      title={m.tagline}
    >
      <i />
      {m.abbr ?? m.name}
    </button>
  )
}

function MoleculeCard() {
  const selected = useAppStore((s) => s.selected)
  const select = useAppStore((s) => s.select)
  if (!selected) return null
  const m = MOLECULES[selected]
  if (!m) return null
  const color = MOLECULE_COLOR[selected]

  return (
    <div className="molecule-card" style={{ ['--card-color' as string]: color }}>
      <header>
        <span className="swatch" />
        <div style={{ minWidth: 0 }}>
          <h3>
            {m.name}
            {m.abbr && m.abbr !== m.name ? <span style={{ color: 'var(--dimmer)', fontWeight: 400 }}>（{m.abbr}）</span> : null}
          </h3>
          <p className="en">{m.nameEn}</p>
        </div>
        <button type="button" className="close" onClick={() => select(null)} aria-label="关闭分子卡片">
          ×
        </button>
      </header>
      <span className="origin">{m.origin === 'virus' ? '病毒来源' : '宿主来源'}</span>
      <p className="role">{m.role}</p>
      {m.facts && m.facts.length > 0 && (
        <dl className="facts">
          {m.facts.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="deep-read">
        {m.detail.map((d, i) => (
          <section key={i}>
            <p>{d}</p>
          </section>
        ))}
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--dimmer)' }}>出现于步骤 {m.appearsIn.join('、')}</p>
    </div>
  )
}

export function InfoPanel() {
  const stepIndex = useAppStore((s) => s.stepIndex)
  const deepOpen = useAppStore((s) => s.deepReadOpen)
  const toggleDeep = useAppStore((s) => s.toggleDeepRead)
  const panelOpen = useAppStore((s) => s.panelOpen)
  const setPanelOpen = useAppStore((s) => s.setPanelOpen)
  const step = STEPS[stepIndex]

  return (
    <aside className={`panel info-panel ${panelOpen ? '' : 'is-collapsed'}`}>
      <button type="button" className="panel-toggle" onClick={() => setPanelOpen(!panelOpen)}>
        <span>
          第 {step.index} 步 · {step.title}
        </span>
        <i>
          <IconChevronDown />
        </i>
      </button>

      <div className="info-scroll">
        <div className="step-badge">
          <span>STEP {String(step.index).padStart(2, '0')}</span>
          {step.titleEn}
        </div>
        <h2>{step.title}</h2>
        <p className="info-sub">{step.subtitle}</p>
        <p className="narration">{step.narration}</p>

        <ul className="bullets">
          {step.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>

        <div className="panel-title">本步关键分子</div>
        <div className="chips">
          {step.keyMolecules.map((id) => (
            <MoleculeChip key={id} id={id} />
          ))}
        </div>

        {step.misconception && (
          <div className="misconception">
            <div className="wrong">
              <span className="tag">常见误区</span>
              <span>{step.misconception.wrong}</span>
            </div>
            <div className="right">
              <span className="tag">正确理解</span>
              <span>{step.misconception.right}</span>
            </div>
          </div>
        )}

        <button type="button" className={`disclose ${deepOpen ? 'is-open' : ''}`} onClick={toggleDeep}>
          深入阅读 · {step.deepRead.length} 则
          <i>
            <IconChevron />
          </i>
        </button>
        {deepOpen && (
          <div className="deep-read">
            {step.deepRead.map((d) => (
              <section key={d.heading}>
                <h4>{d.heading}</h4>
                <p>{d.body}</p>
              </section>
            ))}
          </div>
        )}

        <MoleculeCard />
      </div>
    </aside>
  )
}
