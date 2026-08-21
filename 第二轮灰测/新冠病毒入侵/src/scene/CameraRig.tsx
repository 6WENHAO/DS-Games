/**
 * 相机机架：自研轨道控制器。
 *
 * 为什么不用 OrbitControls：本片需要三种运动叠加在一起 ——
 *   ① 导演机位（每步的推移运镜）  ② 自动缓慢旋转  ③ 用户拖拽/缩放/平移，
 * OrbitControls 会与程序化设置的 camera.position 相互打架。这里改用
 * “球坐标目标值 + 指数阻尼跟随”的方案：
 *   · 目标值 = 导演机位 + 自动旋转累积量 + 用户偏移量；
 *   · 实际值每帧向目标值阻尼靠近，因此切步骤时是平滑飞行，步内推移则是无感跟随；
 *   · 用户拖拽时把增量同时写入“实际值”和“用户偏移量”，操作是 1:1 的即时手感；
 *   · 切步骤后短暂回收用户偏移，保证每一步都能正确取景。
 *
 * 交互：左键/单指拖拽 = 旋转；滚轮/双指捏合 = 缩放；右键/中键/双指拖动 = 平移。
 */

import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { PerspectiveCamera, Vector3 } from 'three'
import { clamp, damp, dampAngle, easeInOutCubic, lerp } from '../anim/ease'
import { stepIndexOf, stepProgressOf } from '../anim/playhead'
import { appState } from '../state/store'
import { POLAR_LIMITS, RADIUS_LIMITS, STEP_CAMERAS, type CameraKey } from './choreography'
import { inputState, markInteraction } from './input'
import { UPDATE_ORDER, useSceneUpdate } from './updateBus'

const first = STEP_CAMERAS[0].from

const rig = {
  target: new Vector3(...first.target),
  azimuth: first.azimuth,
  polar: first.polar,
  radius: first.radius,
  fov: first.fov,
  // 用户偏移
  userAz: 0,
  userPolar: 0,
  userZoom: 1,
  userPan: new Vector3(),
  // 自动旋转累积
  autoAz: 0,
  /** 切步骤后回收用户偏移的截止时间 */
  reclaimUntil: -1e9,
  lastStep: -1,
  initialized: false,
}

const _base = new Vector3()
const _offset = new Vector3()
const _right = new Vector3()
const _up = new Vector3()

function blendKey(a: CameraKey, b: CameraKey | undefined, t: number): void {
  const e = easeInOutCubic(t)
  const bx = b ?? a
  _base.set(lerp(a.target[0], bx.target[0], e), lerp(a.target[1], bx.target[1], e), lerp(a.target[2], bx.target[2], e))
  targetAz = lerp(a.azimuth, bx.azimuth, e)
  targetPolar = lerp(a.polar, bx.polar, e)
  targetRadius = lerp(a.radius, bx.radius, e)
  targetFov = lerp(a.fov, bx.fov, e)
}

let targetAz = first.azimuth
let targetPolar = first.polar
let targetRadius = first.radius
let targetFov = first.fov

/** 相机注视点（活的引用，后处理景深会跟随它对焦）。 */
export const rigTarget = rig.target

/** 复位视角（UI 的“复位”按钮调用）。 */
export function resetView(): void {
  rig.userAz = 0
  rig.userPolar = 0
  rig.userZoom = 1
  rig.userPan.set(0, 0, 0)
  rig.autoAz = 0
}

/** 供 UI 的缩放按钮使用。 */
export function nudgeZoom(factor: number): void {
  rig.userZoom = clamp(rig.userZoom * factor, 0.22, 4.2)
}

export function CameraRig() {
  const camera = useThree((s) => s.camera)
  const domElement = useThree((s) => s.gl.domElement)

  useEffect(() => {
    const el = domElement
    const pointers = new Map<number, { x: number; y: number }>()
    let pinchDistance = 0
    let mode: 'orbit' | 'pan' | 'pinch' | null = null

    const now = () => performance.now() / 1000

    const onPointerDown = (e: PointerEvent) => {
      el.setPointerCapture?.(e.pointerId)
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      inputState.dragging = true
      inputState.dragDistance = 0
      markInteraction(now())
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        pinchDistance = Math.hypot(a.x - b.x, a.y - b.y)
        mode = 'pinch'
      } else {
        mode = e.button === 2 || e.button === 1 || e.shiftKey ? 'pan' : 'orbit'
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId)
      if (!prev) return
      const dx = e.clientX - prev.x
      const dy = e.clientY - prev.y
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      inputState.dragDistance += Math.hypot(dx, dy)
      markInteraction(now())

      if (mode === 'pinch' && pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (pinchDistance > 0) nudgeZoom(pinchDistance / Math.max(1, d))
        pinchDistance = d
        // 双指同向拖动 = 平移
        panBy(dx * 0.5, dy * 0.5)
        return
      }

      const rect = el.getBoundingClientRect()
      const scale = 2.6 / Math.max(320, rect.height)
      if (mode === 'pan') {
        panBy(dx, dy)
      } else {
        rig.userAz -= dx * scale
        rig.azimuth -= dx * scale
        const p = clamp(rig.userPolar - dy * scale, -1.4, 1.4)
        rig.userPolar = p
        rig.polar = clamp(rig.polar - dy * scale, POLAR_LIMITS[0], POLAR_LIMITS[1])
      }
    }

    const panBy = (dx: number, dy: number) => {
      const cam = camera as PerspectiveCamera
      const rect = el.getBoundingClientRect()
      const worldPerPixel = (2 * Math.tan(((cam.fov ?? 45) * Math.PI) / 360) * rig.radius) / Math.max(1, rect.height)
      _right.setFromMatrixColumn(cam.matrix, 0)
      _up.setFromMatrixColumn(cam.matrix, 1)
      rig.userPan.addScaledVector(_right, -dx * worldPerPixel)
      rig.userPan.addScaledVector(_up, dy * worldPerPixel)
      if (rig.userPan.length() > 7) rig.userPan.setLength(7)
    }

    const endPointer = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      if (pointers.size === 0) {
        inputState.dragging = false
        mode = null
        markInteraction(now())
      } else if (pointers.size === 1) {
        mode = 'orbit'
      }
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      markInteraction(now())
      nudgeZoom(Math.exp(e.deltaY * 0.0011))
    }

    const onContextMenu = (e: Event) => e.preventDefault()

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', endPointer)
    el.addEventListener('pointercancel', endPointer)
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('contextmenu', onContextMenu)
    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', endPointer)
      el.removeEventListener('pointercancel', endPointer)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('contextmenu', onContextMenu)
    }
  }, [camera, domElement])

  useSceneUpdate(UPDATE_ORDER.camera, ({ p, dt, elapsed, camera: cam }) => {
    const stepIndex = stepIndexOf(p)
    const t = stepProgressOf(p)
    const key = STEP_CAMERAS[stepIndex]
    blendKey(key.from, key.to, t)

    // 切步骤：短暂回收用户偏移，保证新一步的构图正确
    if (rig.lastStep !== stepIndex) {
      rig.lastStep = stepIndex
      rig.reclaimUntil = elapsed + 1.5
    }
    if (elapsed < rig.reclaimUntil) {
      rig.userAz = damp(rig.userAz, 0, 2.6, dt)
      rig.userPolar = damp(rig.userPolar, 0, 2.6, dt)
      rig.userZoom = damp(rig.userZoom, 1, 2.6, dt)
      rig.userPan.lerp(_offset.set(0, 0, 0), 1 - Math.exp(-2.6 * dt))
    }

    // 自动缓慢旋转：拖拽中与刚交互过的 2 秒内暂停。
    // 速度经实机核对：0.05 rad/s ≈ 两分钟一圈，既有"活着"的感觉又不会把观众转晕，
    // 也不会在一个 20 秒的步骤里把导演机位转到别处去。
    const { autoRotate } = appState()
    if (autoRotate && !inputState.dragging && elapsed - inputState.lastInteraction > 2) {
      rig.autoAz += dt * 0.05
    }

    const wantAz = targetAz + rig.autoAz + rig.userAz
    const wantPolar = clamp(targetPolar + rig.userPolar, POLAR_LIMITS[0], POLAR_LIMITS[1])
    const wantRadius = clamp(targetRadius * rig.userZoom, RADIUS_LIMITS[0], RADIUS_LIMITS[1])
    const wantTarget = _base.add(rig.userPan)

    if (!rig.initialized) {
      rig.initialized = true
      rig.azimuth = wantAz
      rig.polar = wantPolar
      rig.radius = wantRadius
      rig.target.copy(wantTarget)
      rig.fov = targetFov
    }

    // 拖拽时几乎不阻尼（1:1 手感），松手后平滑归位
    const lambda = inputState.dragging ? 22 : 4.2
    rig.azimuth = dampAngle(rig.azimuth, wantAz, lambda, dt)
    rig.polar = damp(rig.polar, wantPolar, lambda, dt)
    rig.radius = damp(rig.radius, wantRadius, inputState.dragging ? 16 : 3.6, dt)
    rig.target.lerp(wantTarget, 1 - Math.exp(-3.6 * dt))
    rig.fov = damp(rig.fov, targetFov, 2.4, dt)

    const sinPolar = Math.sin(rig.polar)
    _offset.set(sinPolar * Math.cos(rig.azimuth), Math.cos(rig.polar), sinPolar * Math.sin(rig.azimuth)).multiplyScalar(rig.radius)
    cam.position.copy(rig.target).add(_offset)
    cam.lookAt(rig.target)

    const perspective = cam as PerspectiveCamera
    if (Math.abs(perspective.fov - rig.fov) > 0.01) {
      perspective.fov = rig.fov
      perspective.updateProjectionMatrix()
    }
  })

  return null
}
