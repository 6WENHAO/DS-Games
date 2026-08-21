/** 术语表 / 参考文献弹层与使用说明弹层。 */

import type { ReactNode } from 'react'
import { GLOSSARY } from '../data/glossary'
import { MOLECULES } from '../data/molecules'
import { REFERENCES } from '../data/references'
import { useAppStore } from '../state/store'
import { MOLECULE_COLOR } from '../three/palette'

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-mask" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel modal" role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <h2>{title}</h2>
          <button type="button" className="close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function GlossaryModal() {
  const open = useAppStore((s) => s.glossaryOpen)
  const toggle = useAppStore((s) => s.toggleGlossary)
  const select = useAppStore((s) => s.select)
  if (!open) return null

  return (
    <Modal title={`术语表与参考文献 · ${GLOSSARY.length} 条术语`} onClose={toggle}>
      <div className="glossary-grid">
        {GLOSSARY.map((g) => (
          <div className="glossary-item" key={g.term}>
            <h4>{g.term}</h4>
            <span className="en">{g.termEn}</span>
            <p>{g.definition}</p>
            {g.related && g.related.length > 0 && (
              <div className="related">
                {g.related.map((id) =>
                  MOLECULES[id] ? (
                    <button
                      key={id}
                      type="button"
                      className="mini-chip"
                      style={{ ['--chip-color' as string]: MOLECULE_COLOR[id] }}
                      onClick={() => {
                        select(id)
                        toggle()
                      }}
                    >
                      <i />
                      {MOLECULES[id].name}
                    </button>
                  ) : null,
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="panel-title" style={{ marginTop: 22 }}>
        参考文献 · References
      </div>
      <ol className="refs">
        {REFERENCES.map((r) => (
          <li key={r.label}>
            <strong style={{ color: 'var(--dim)' }}>{r.label}</strong>　{r.citation}
          </li>
        ))}
      </ol>
      <p className="note">
        本演示的分子形态为<strong>示意性重建</strong>：几何由程序按已发表的结构特征（尺寸、对称性、结构域组成）生成，
        并非原子坐标级的结构模型。分子数量、磷脂与受体尺寸、时间尺度均为便于观察而作了简化或夸张，
        具体取舍见项目文档 docs/SCIENCE.md。
      </p>
    </Modal>
  )
}

export function HelpModal() {
  const open = useAppStore((s) => s.helpOpen)
  const toggle = useAppStore((s) => s.toggleHelp)
  if (!open) return null

  return (
    <Modal title="使用说明" onClose={toggle}>
      <div className="help-sections">
        <section>
          <h4>视角操作</h4>
          <ul className="kbd-list">
            <li>拖动 —— 旋转视角（单指拖动同样有效）</li>
            <li>滚轮 / 双指捏合 —— 缩放</li>
            <li>右键拖动 / <kbd>Shift</kbd> + 拖动 / 双指拖动 —— 平移</li>
            <li>场景默认缓慢自转，操作后 2 秒恢复</li>
          </ul>
        </section>
        <section>
          <h4>播放控制</h4>
          <ul className="kbd-list">
            <li>
              <kbd>空格</kbd> 播放 / 暂停
            </li>
            <li>
              <kbd>←</kbd> <kbd>→</kbd> 上一步 / 下一步
            </li>
            <li>
              <kbd>1</kbd>–<kbd>8</kbd> 跳到指定步骤
            </li>
            <li>点击底部进度条可任意拖动到某一时刻</li>
            <li>右下角按钮切换 0.5× / 1× / 1.5× / 2× 速度</li>
          </ul>
        </section>
        <section>
          <h4>快捷键</h4>
          <ul className="kbd-list">
            <li>
              <kbd>L</kbd> 分子标签　<kbd>R</kbd> 自动旋转
            </li>
            <li>
              <kbd>E</kbd> 图例　<kbd>G</kbd> 术语表
            </li>
            <li>
              <kbd>Q</kbd> 切换画质　<kbd>P</kbd> 帧率显示
            </li>
            <li>
              <kbd>0</kbd> 复位视角　<kbd>H</kbd> 本说明
            </li>
          </ul>
        </section>
        <section>
          <h4>探索方式</h4>
          <ul className="kbd-list">
            <li>点击任意分子 / 结构 —— 查看名称与功能</li>
            <li>点击标签胶囊或图例条目 —— 同样可打开词条</li>
            <li>信息面板底部「深入阅读」展开机制细节</li>
          </ul>
        </section>
      </div>
      <p className="note">
        画质会根据实时帧率自动升降（桌面目标 60fps、移动端 30fps 以上）。若手动切换过画质，则自动调节关闭；
        刷新页面即可恢复自动模式。
      </p>
    </Modal>
  )
}
