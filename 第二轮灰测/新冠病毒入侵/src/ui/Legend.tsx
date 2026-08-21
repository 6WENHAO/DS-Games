/** 右侧图例：按类别列出全部分子与结构，颜色与 3D 场景严格同源；点击可查看词条。 */

import { useMemo } from 'react'
import { MOLECULES } from '../data/molecules'
import { STEPS } from '../data/steps'
import { MOLECULE_IDS, type Molecule, type MoleculeCategory } from '../data/types'
import { useAppStore } from '../state/store'
import { MOLECULE_COLOR } from '../three/palette'

const CATEGORY_LABEL: Record<MoleculeCategory, string> = {
  'viral-structure': '病毒结构蛋白',
  'viral-genome': '病毒基因组',
  'viral-enzyme': '病毒酶与复制机器',
  'host-receptor': '宿主受体',
  'host-protease': '宿主蛋白酶',
  'host-machinery': '宿主翻译机器',
  'host-organelle': '细胞器与区室',
  process: '过程与事件',
}

const ORDER: MoleculeCategory[] = [
  'viral-structure',
  'viral-genome',
  'viral-enzyme',
  'host-receptor',
  'host-protease',
  'host-machinery',
  'host-organelle',
  'process',
]

export function Legend() {
  const open = useAppStore((s) => s.legendOpen)
  const selected = useAppStore((s) => s.selected)
  const select = useAppStore((s) => s.select)
  const stepIndex = useAppStore((s) => s.stepIndex)

  const groups = useMemo(() => {
    const map = new Map<MoleculeCategory, Molecule[]>()
    for (const id of MOLECULE_IDS) {
      const m = MOLECULES[id]
      if (!m) continue
      const list = map.get(m.category) ?? []
      list.push(m)
      map.set(m.category, list)
    }
    return ORDER.filter((c) => map.has(c)).map((c) => ({ category: c, items: map.get(c) ?? [] }))
  }, [])

  if (!open) return null
  const keys = new Set(STEPS[stepIndex].keyMolecules)

  return (
    <aside className="panel legend" aria-label="图例">
      <div className="panel-title">图例 · Legend</div>
      {groups.map((g) => (
        <div key={g.category}>
          <div className="legend-group">{CATEGORY_LABEL[g.category]}</div>
          <div className="legend-list">
            {g.items.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`legend-item ${selected === m.id ? 'is-active' : ''}`}
                style={{ ['--legend-color' as string]: MOLECULE_COLOR[m.id] }}
                onClick={() => select(selected === m.id ? null : m.id)}
                title={m.tagline}
              >
                <i />
                {m.name}
                {keys.has(m.id) && <small>本步</small>}
              </button>
            ))}
          </div>
        </div>
      ))}
    </aside>
  )
}
