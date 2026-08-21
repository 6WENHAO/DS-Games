/** 每帧回调（用于进度条这类需要 60fps 更新、但绝对不能触发 React 重渲染的 UI）。 */

import { useEffect, useRef } from 'react'

export function useRafTick(callback: () => void): void {
  const latest = useRef(callback)
  latest.current = callback
  useEffect(() => {
    let id = 0
    const loop = () => {
      latest.current()
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [])
}
