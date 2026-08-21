import * as THREE from 'three';
import { clamp, damp } from './rng';

export interface ControlCallbacks {
  /** Left click / tap that was not a drag. */
  onTap: (ground: THREE.Vector3) => void;
  /** Pointer moved over the map (aiming reticle). */
  onHover: (ground: THREE.Vector3 | null) => void;
  /** Right click without drag, or Escape. */
  onCancel: () => void;
  /** Any interaction â€?used to unlock WebAudio. */
  onGesture: () => void;
}

const GROUND_Y = 0.02;
const TAP_SLOP = 7;
const TAP_TIME = 420;

interface Ptr {
  id: number;
  x: number;
  y: number;
  sx: number;
  sy: number;
  button: number;
  t: number;
  moved: boolean;
}

/**
 * Self-contained orbit / pan / zoom controller with reliable click-vs-drag
 * separation (left-drag orbits, left-click fires a disaster) plus a keyboard
 * axis used to steer sustained disasters.
 */
export class SandboxControls {
  target = new THREE.Vector3(0, 3, 0);
  azimuth = 0.72;
  elevation = 0.46;
  distance = 220;

  private gAz = 0.72;
  private gEl = 0.46;
  private gDist = 220;
  private gTarget = new THREE.Vector3(0, 3, 0);

  minDistance = 42;
  maxDistance = 460;
  minElevation = 0.06;
  maxElevation = 1.32;
  panLimit = 96;
  enabled = true;

  private pointers = new Map<number, Ptr>();
  private pinchDist = 0;
  private pinchMid = new THREE.Vector2();
  private keys = new Set<string>();
  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -GROUND_Y);
  private ndc = new THREE.Vector2();
  private hit = new THREE.Vector3();
  private disposers: Array<() => void> = [];

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly dom: HTMLElement,
    private readonly cb: ControlCallbacks,
  ) {
    this.bind();
    this.apply(0.0001);
  }

  private bind(): void {
    const add = <K extends keyof HTMLElementEventMap>(
      el: HTMLElement | Window,
      type: K | string,
      fn: (ev: Event) => void,
      opts?: AddEventListenerOptions,
    ): void => {
      el.addEventListener(type, fn as EventListener, opts);
      this.disposers.push(() => el.removeEventListener(type, fn as EventListener, opts));
    };

    add(this.dom, 'pointerdown', (e) => this.onDown(e as PointerEvent));
    add(this.dom, 'pointermove', (e) => this.onMove(e as PointerEvent));
    add(this.dom, 'pointerup', (e) => this.onUp(e as PointerEvent));
    add(this.dom, 'pointercancel', (e) => this.onUp(e as PointerEvent));
    add(this.dom, 'pointerleave', () => {
      if (this.pointers.size === 0) this.cb.onHover(null);
    });
    add(this.dom, 'wheel', (e) => this.onWheel(e as WheelEvent), { passive: false });
    add(this.dom, 'contextmenu', (e) => e.preventDefault());
    add(window, 'keydown', (e) => this.onKey(e as KeyboardEvent, true));
    add(window, 'keyup', (e) => this.onKey(e as KeyboardEvent, false));
    add(window, 'blur', () => this.keys.clear());
  }

  dispose(): void {
    for (const d of this.disposers) d();
    this.disposers.length = 0;
    this.pointers.clear();
    this.keys.clear();
  }

  // ------------------------------------------------------------------ input
  private onKey(e: KeyboardEvent, down: boolean): void {
    const code = e.code;
    if (code === 'Escape') {
      if (down) this.cb.onCancel();
      return;
    }
    if (
      code === 'KeyW' ||
      code === 'KeyA' ||
      code === 'KeyS' ||
      code === 'KeyD' ||
      code === 'ArrowUp' ||
      code === 'ArrowDown' ||
      code === 'ArrowLeft' ||
      code === 'ArrowRight'
    ) {
      if (down) this.keys.add(code);
      else this.keys.delete(code);
      if (code.startsWith('Arrow')) e.preventDefault();
    }
  }

  private onDown(e: PointerEvent): void {
    if (!this.enabled) return;
    this.cb.onGesture();
    (this.dom as HTMLElement).setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      sx: e.clientX,
      sy: e.clientY,
      button: e.button,
      t: performance.now(),
      moved: false,
    });
    if (this.pointers.size === 2) this.beginPinch();
  }

  private beginPinch(): void {
    const [a, b] = [...this.pointers.values()];
    this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
    this.pinchMid.set((a.x + b.x) / 2, (a.y + b.y) / 2);
    for (const p of this.pointers.values()) p.moved = true;
  }

  private onMove(e: PointerEvent): void {
    if (!this.enabled) return;
    const p = this.pointers.get(e.pointerId);
    if (!p) {
      if (e.pointerType !== 'touch') this.emitHover(e);
      return;
    }
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > TAP_SLOP) p.moved = true;

    if (this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      if (this.pinchDist > 0) this.zoom((this.pinchDist - d) * 9);
      this.pan(mx - this.pinchMid.x, my - this.pinchMid.y);
      this.pinchDist = d;
      this.pinchMid.set(mx, my);
      return;
    }

    if (p.button === 2 || p.button === 1) this.pan(dx, dy);
    else this.orbit(dx, dy);
    if (e.pointerType !== 'touch') this.emitHover(e);
  }

  private onUp(e: PointerEvent): void {
    const p = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinchDist = 0;
    if (!p || !this.enabled) return;
    const quick = performance.now() - p.t < TAP_TIME;
    if (!p.moved && quick) {
      if (p.button === 2) {
        this.cb.onCancel();
      } else if (p.button === 0) {
        if (this.groundAt(e.clientX, e.clientY)) this.cb.onTap(this.hit.clone());
      }
    }
    if (e.pointerType === 'touch') this.cb.onHover(null);
  }

  private onWheel(e: WheelEvent): void {
    if (!this.enabled) return;
    e.preventDefault();
    this.cb.onGesture();
    this.zoom(e.deltaMode === 1 ? e.deltaY * 18 : e.deltaY);
  }

  private emitHover(e: PointerEvent): void {
    this.cb.onHover(this.groundAt(e.clientX, e.clientY) ? this.hit.clone() : null);
  }

  // ------------------------------------------------------------------ camera
  private orbit(dx: number, dy: number): void {
    const k = 0.0045;
    this.gAz -= dx * k;
    this.gEl = clamp(this.gEl + dy * k, this.minElevation, this.maxElevation);
  }

  private pan(dx: number, dy: number): void {
    // Screen-space drag converted to a ground-plane translation.
    const scale = (this.gDist * 0.0016) / Math.max(0.3, Math.cos(this.gEl));
    const sa = Math.sin(this.gAz);
    const ca = Math.cos(this.gAz);
    // camera right vector on the ground plane
    const rx = ca;
    const rz = -sa;
    // camera forward projected on the ground plane
    const fx = sa;
    const fz = ca;
    this.gTarget.x += (-dx * rx + dy * fx) * scale;
    this.gTarget.z += (-dx * rz + dy * fz) * scale;
    this.gTarget.x = clamp(this.gTarget.x, -this.panLimit, this.panLimit);
    this.gTarget.z = clamp(this.gTarget.z, -this.panLimit, this.panLimit);
  }

  private zoom(delta: number): void {
    this.gDist = clamp(this.gDist * Math.exp(delta * 0.0011), this.minDistance, this.maxDistance);
  }

  /** Camera-relative keyboard axis on the ground plane; length <= 1. */
  steerVector(out: THREE.Vector2): THREE.Vector2 {
    let f = 0;
    let s = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) f += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) f -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) s += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) s -= 1;
    if (f === 0 && s === 0) return out.set(0, 0);
    const sa = Math.sin(this.azimuth);
    const ca = Math.cos(this.azimuth);
    // forward = -(camera->target horizontal dir)
    const x = -f * sa + s * ca;
    const z = -f * ca - s * sa;
    return out.set(x, z).normalize();
  }

  get steering(): boolean {
    return this.keys.size > 0;
  }

  /** Intersect a screen position with the ground plane; result in `this.hit`. */
  groundAt(clientX: number, clientY: number): boolean {
    const r = this.dom.getBoundingClientRect();
    this.ndc.set(
      ((clientX - r.left) / r.width) * 2 - 1,
      -(((clientY - r.top) / r.height) * 2 - 1),
    );
    this.ray.setFromCamera(this.ndc, this.camera);
    const p = this.ray.ray.intersectPlane(this.plane, this.hit);
    if (!p) return false;
    const lim = 260;
    return Math.abs(this.hit.x) < lim && Math.abs(this.hit.z) < lim;
  }

  update(dt: number): void {
    this.apply(dt);
  }

  private apply(dt: number): void {
    const l = 14;
    this.azimuth = damp(this.azimuth, this.gAz, l, dt);
    this.elevation = damp(this.elevation, this.gEl, l, dt);
    this.distance = damp(this.distance, this.gDist, l, dt);
    this.target.x = damp(this.target.x, this.gTarget.x, l, dt);
    this.target.y = damp(this.target.y, this.gTarget.y, l, dt);
    this.target.z = damp(this.target.z, this.gTarget.z, l, dt);

    const ce = Math.cos(this.elevation);
    const se = Math.sin(this.elevation);
    this.camera.position.set(
      this.target.x + this.distance * ce * Math.sin(this.azimuth),
      this.target.y + this.distance * se,
      this.target.z + this.distance * ce * Math.cos(this.azimuth),
    );
    this.camera.lookAt(this.target);
  }

  reset(): void {
    this.gAz = 0.72;
    this.gEl = 0.46;
    this.gDist = 220;
    this.gTarget.set(0, 3, 0);
  }
}
