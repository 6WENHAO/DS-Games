/**
 * 3D 标签（annotation）与点击拾取。
 *
 * 标签用 DOM（drei 的 Html）渲染而不是贴图文字：中文小字号在 canvas 里会糊，
 * DOM 渲染保证任何 dpr 下都清晰，并且天然支持点击、悬停、无障碍焦点。
 */

import { Html } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useMemo } from 'react'
import { MOLECULES } from '../data/molecules'
import type { MoleculeId } from '../data/types'
import { useAppStore } from '../state/store'
import { MOLECULE_COLOR } from '../three/palette'
import { wasClick } from './input'

/**
 * 标签的步骤门控：传入 1 基步骤号，返回当前是否应该显示。
 *
 * 之所以用 store 里的 stepIndex 而不是逐帧的播放头：标签是 DOM 元素，
 * 只应该在“步骤切换”这种低频事件上重渲染，不能每帧动。
 */
export function useStepIn(...steps: number[]): boolean {
  const stepIndex = useAppStore((s) => s.stepIndex)
  return steps.includes(stepIndex + 1)
}

export interface AnnotationProps {
  id: MoleculeId
  position: [number, number, number]
  /** 覆盖显示文字，默认取分子中文名 */
  label?: string
  /** 引线朝向 */
  side?: 'left' | 'right'
  /** 引线长度（像素） */
  lead?: number
  variant?: 'default' | 'warn' | 'accent'
  hidden?: boolean
}

/** 单个可点击标签：锚点圆点 + 引线 + 文字胶囊。 */
export function Annotation({ id, position, label, side = 'right', lead = 34, variant = 'default', hidden }: AnnotationProps) {
  const showLabels = useAppStore((s) => s.showLabels)
  const selected = useAppStore((s) => s.selected)
  const select = useAppStore((s) => s.select)
  const color = MOLECULE_COLOR[id]
  const text = label ?? MOLECULES[id]?.name ?? id

  if (!showLabels || hidden) return null

  return (
    <Html position={position} center zIndexRange={[40, 20]} pointerEvents="auto" wrapperClass="anno-wrapper">
      <div className={`anno anno-${side} anno-${variant} ${selected === id ? 'is-selected' : ''}`} style={{ ['--anno-color' as string]: color, ['--anno-lead' as string]: `${lead}px` }}>
        <span className="anno-dot" />
        <span className="anno-line" />
        <button
          type="button"
          className="anno-pill"
          onClick={(e) => {
            e.stopPropagation()
            select(id)
          }}
        >
          {text}
        </button>
      </div>
    </Html>
  )
}

/** 把点击/悬停行为挂到任意 mesh 上：拖拽视角不会误触发选中。 */export function usePick(id: MoleculeId) {
  const select = useAppStore((s) => s.select)
  return useMemo(
    () => ({
      onClick: (e: ThreeEvent<MouseEvent>) => {
        if (!wasClick()) return
        e.stopPropagation()
        select(id)
      },
      onPointerOver: (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation()
        document.body.style.cursor = 'pointer'
      },
      onPointerOut: () => {
        document.body.style.cursor = 'auto'
      },
    }),
    [id, select],
  )
}

/** 选中高亮环：套在被选结构外面的一圈脉冲光环。 */export function SelectionRing({
  id,
  position,
  radius,
  visible = true,
}: {
  id: MoleculeId
  position: [number, number, number]
  radius: number
  visible?: boolean
}) {
  const selected = useAppStore((s) => s.selected)
  if (!visible || selected !== id) return null
  return (
    <mesh position={position} renderOrder={900}>
      <torusGeometry args={[radius, radius * 0.035, 6, 48]} />
      <meshBasicMaterial color={MOLECULE_COLOR[id]} transparent opacity={0.85} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}
