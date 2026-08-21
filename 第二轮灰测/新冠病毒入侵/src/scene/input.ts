/** 交互状态：相机控制与 3D 拾取共享，用于区分“拖动视角”与“点击分子”。 */
export const inputState = {
  dragging: false,
  /** 本次按下累计移动的像素距离 */
  dragDistance: 0,
  /** 最近一次用户交互的时间戳（秒，页面时间） */
  lastInteraction: -1e9,
}

export function markInteraction(elapsed: number): void {
  inputState.lastInteraction = elapsed
}

/** 判定“这次抬起手指算点击而不是拖拽”。 */
export function wasClick(): boolean {
  return inputState.dragDistance < 7
}
