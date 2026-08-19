import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CAMERA } from '../config.js';

/**
 * CinematicCamera — free orbit rig with smooth damping, stepless zoom from 10 m
 * to 3000 m, click-to-focus, and additive shake that does not fight the
 * controller.
 *
 * THE SHAKE FEEDBACK PROBLEM (and the fix)
 * ----------------------------------------
 * OrbitControls derives its spherical state from camera.position at the top of
 * every update(). So if you simply add a shake offset to camera.position after
 * update(), the controller reads that displaced position back next frame and
 * integrates the noise into its own orbit state — the camera slowly walks away
 * and the damping goes gritty.
 *
 * The rig therefore keeps an authoritative `_base` position:
 *   1. restore camera.position from _base
 *   2. controls.update()            (writes the clean orbit position)
 *   3. store the clean position back into _base
 *   4. add the shake offset + roll purely for rendering
 * The offset never survives into the controller's state.
 */
export class CinematicCamera {
  constructor(camera, domElement) {
    this.camera = camera;
    this.controls = new OrbitControls(camera, domElement);

    const c = this.controls;
    c.enableDamping = true;
    c.dampingFactor = CAMERA.dampingFactor;
    c.minDistance = CAMERA.minDistance;
    c.maxDistance = CAMERA.maxDistance;
    c.zoomToCursor = true;          // stepless zoom that homes on what you point at
    c.zoomSpeed = 0.85;
    c.rotateSpeed = 0.62;
    c.panSpeed = 0.8;
    c.screenSpacePanning = true;
    c.maxPolarAngle = Math.PI * 0.497;  // stop just above the waterline
    c.minPolarAngle = 0.04;

    // Initial establishing shot, expressed in spherical terms.
    const s = CAMERA.start;
    this._target = new THREE.Vector3(...s.target);
    c.target.copy(this._target);
    const sph = new THREE.Spherical(s.radius, s.phi, s.theta);
    camera.position.setFromSpherical(sph).add(this._target);
    c.update();

    this._base = camera.position.clone();
    this._shakeOffset = new THREE.Vector3();
    this._shakeRoll = 0;

    // Focus glide state
    this._focusTarget = null;
    this._focusDistance = null;

    // Auto-dolly (slow cinematic drift) — off by default
    this.autoDolly = false;
    this.autoDollySpeed = 0.012;

    this._raycaster = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();
    this._pickables = [];
    this._onPick = null;

    this._marker = this._buildFocusMarker();
    this._markerFade = 0;
  }

  /** A small ring drawn at the focus point so the user can see what they locked onto. */
  _buildFocusMarker() {
    const g = new THREE.RingGeometry(0.72, 1, 40);
    const m = new THREE.MeshBasicMaterial({
      color: 0x8ff0ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.renderOrder = 999;
    mesh.frustumCulled = false;
    return mesh;
  }

  /** Attach the marker to a scene once at startup. */
  attachMarker(scene) { scene.add(this._marker); }

  /**
   * Register the meshes that can be clicked to set the focus point, and the
   * canvas that receives the clicks.
   */
  enablePicking(domElement, pickables, onPick = null) {
    this._pickables = pickables;
    this._onPick = onPick;
    this._pickHandler = (ev) => {
      // Ignore the click that ends an orbit drag.
      if (this._dragMoved) return;
      const rect = domElement.getBoundingClientRect();
      this._ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      this._ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      this._raycaster.setFromCamera(this._ndc, this.camera);
      const hits = this._raycaster.intersectObjects(this._pickables, true);
      if (hits.length) {
        this.focusOn(hits[0].point);
        if (this._onPick) this._onPick(hits[0]);
      }
    };
    // Distinguish a click from a drag so orbiting never re-targets the camera.
    let downX = 0, downY = 0;
    domElement.addEventListener('pointerdown', (e) => {
      downX = e.clientX; downY = e.clientY; this._dragMoved = false;
    });
    domElement.addEventListener('pointermove', (e) => {
      if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 6) this._dragMoved = true;
    });
    domElement.addEventListener('pointerup', this._pickHandler);
  }

  /**
   * Glide the orbit centre to a world point. Distance is preserved unless one
   * is supplied, so clicking a cable at 40 m does not yank you to orbit range.
   */
  focusOn(point, distance = null) {
    this._focusTarget = point.clone();
    this._focusDistance = distance;
    this._markerFade = 1.6;
    this._marker.position.copy(point);
  }

  /** Frame the whole structure — the establishing shot. */
  frameAll() {
    this.focusOn(new THREE.Vector3(0, 90, 0), 1400);
  }

  /** Add trauma-driven shake. `offset` is a world-space vector, `roll` radians. */
  applyShake(offset, roll) {
    this._shakeOffset.copy(offset);
    this._shakeRoll = roll;
  }

  getState() {
    return {
      position: this._base.toArray(),
      target: this.controls.target.toArray(),
    };
  }

  setState(s) {
    this._base.fromArray(s.position);
    this.camera.position.copy(this._base);
    this.controls.target.fromArray(s.target);
    this.controls.update();
  }

  /**
   * @param realDt unscaled delta — camera damping must stay silky even in
   *               slow motion or while the simulation is paused.
   */
  update(realDt) {
    // 1. restore the clean, shake-free position
    this.camera.position.copy(this._base);

    // 2. focus glide (exponential approach, frame-rate independent)
    if (this._focusTarget) {
      const k = 1 - Math.pow(1 - CAMERA.focusLerp, realDt * 60);
      this.controls.target.lerp(this._focusTarget, k);
      if (this._focusDistance !== null) {
        const dir = this.camera.position.clone().sub(this.controls.target);
        const want = THREE.MathUtils.lerp(dir.length(), this._focusDistance, k);
        this.camera.position.copy(this.controls.target).add(dir.setLength(want));
      }
      if (this.controls.target.distanceTo(this._focusTarget) < 0.05) this._focusTarget = null;
    }

    if (this.autoDolly) {
      const off = this.camera.position.clone().sub(this.controls.target);
      const sph = new THREE.Spherical().setFromVector3(off);
      sph.theta += this.autoDollySpeed * realDt;
      this.camera.position.copy(this.controls.target).add(off.setFromSpherical(sph));
    }

    // 3. controller writes the authoritative orbit position
    this.controls.update();
    this._base.copy(this.camera.position);

    // 4. render-only shake
    if (this._shakeOffset.lengthSq() > 0 || this._shakeRoll !== 0) {
      this.camera.position.add(this._shakeOffset);
      this.camera.lookAt(this.controls.target);
      if (this._shakeRoll !== 0) {
        const fwd = this.controls.target.clone().sub(this.camera.position).normalize();
        this.camera.rotateOnWorldAxis(fwd, this._shakeRoll);
      }
    }

    // focus marker: fade out and keep a constant on-screen size
    if (this._markerFade > 0) {
      this._markerFade = Math.max(0, this._markerFade - realDt);
      const d = this.camera.position.distanceTo(this._marker.position);
      this._marker.scale.setScalar(Math.max(1.5, d * 0.022));
      this._marker.quaternion.copy(this.camera.quaternion);
      this._marker.material.opacity = Math.min(1, this._markerFade) * 0.8;
    } else if (this._marker.material.opacity !== 0) {
      this._marker.material.opacity = 0;
    }
  }

  dispose() {
    this.controls.dispose();
    this._marker.geometry.dispose();
    this._marker.material.dispose();
  }
}
