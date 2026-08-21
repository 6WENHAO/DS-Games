/**
 * Orthographic camera rig.
 *
 * A fixed isometric framing with eased transitions between the title view and
 * the puzzle view. The projection is deliberately orthographic: it is what the
 * grass shader's flatten compensation is derived for, and it keeps the pixel grid
 * uniform across the frame.
 */
import * as THREE from 'three';

const DEG = Math.PI / 180;

/**
 * Ground-plane basis for a given yaw, matching what the camera actually shows.
 *
 * The rig places the camera at `target + (sin y, ., cos y) * distance` and calls
 * lookAt, and three's Matrix4.lookAt builds `z = normalize(eye - target)` then
 * `x = normalize(cross(up, z))`. Substituting gives screen right = (cos y, 0,
 * -sin y). `depth` is the horizontal component of the view direction, which runs
 * away from the camera and therefore up the screen.
 */
export function groundFrame(yawDeg) {
  const y = yawDeg * DEG;
  return {
    right: new THREE.Vector3(Math.cos(y), 0, -Math.sin(y)),
    depth: new THREE.Vector3(-Math.sin(y), 0, -Math.cos(y)),
  };
}

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);

export class CameraRig {
  constructor(aspect = 16 / 9) {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 900);
    this.aspect = aspect;
    this.state = {
      target: new THREE.Vector3(),
      yaw: 45,
      pitch: 30,
      distance: 120,
      frustumHeight: 30,
    };
    this.from = null;
    this.to = null;
    this.tween = { time: 0, duration: 0 };
    this.shake = 0;
    this.shakeSeed = 0;
  }

  setAspect(aspect) {
    this.aspect = aspect;
    this.apply();
  }

  set(config) {
    this.state.target.copy(config.target);
    this.state.yaw = config.yaw;
    this.state.pitch = config.pitch;
    this.state.distance = config.distance;
    this.state.frustumHeight = config.frustumHeight;
    this.from = null;
    this.to = null;
    this.apply();
  }

  /** Eased move to a new framing. */
  goTo(config, duration = 1.5) {
    this.from = {
      target: this.state.target.clone(),
      yaw: this.state.yaw,
      pitch: this.state.pitch,
      distance: this.state.distance,
      frustumHeight: this.state.frustumHeight,
    };
    this.to = {
      target: config.target.clone(),
      yaw: config.yaw,
      pitch: config.pitch,
      distance: config.distance,
      frustumHeight: config.frustumHeight,
    };
    this.tween.time = 0;
    this.tween.duration = Math.max(0.001, duration);
  }

  get moving() {
    return this.to !== null;
  }

  /** Nudges the framing target without cancelling a tween. */
  nudgeTarget(target, rate, dt) {
    if (this.to) return;
    const k = 1 - Math.exp(-rate * dt);
    this.state.target.lerp(target, k);
  }

  pulse(amount = 0.35) {
    this.shake = Math.max(this.shake, amount);
    this.shakeSeed = Math.random() * 1000;
  }

  update(dt) {
    if (this.to) {
      this.tween.time += dt;
      const t = Math.min(1, this.tween.time / this.tween.duration);
      const e = easeInOut(t);
      this.state.target.lerpVectors(this.from.target, this.to.target, e);
      this.state.yaw = this.from.yaw + (this.to.yaw - this.from.yaw) * e;
      this.state.pitch = this.from.pitch + (this.to.pitch - this.from.pitch) * e;
      this.state.distance = this.from.distance + (this.to.distance - this.from.distance) * e;
      this.state.frustumHeight = this.from.frustumHeight
        + (this.to.frustumHeight - this.from.frustumHeight) * e;
      if (t >= 1) {
        this.from = null;
        this.to = null;
      }
    }
    if (this.shake > 0.0001) this.shake *= Math.exp(-dt * 7.5);
    else this.shake = 0;
    this.apply();
  }

  apply() {
    const { target, yaw, pitch, distance, frustumHeight } = this.state;
    const cam = this.camera;
    const h = frustumHeight * 0.5;
    const w = h * this.aspect;
    cam.left = -w;
    cam.right = w;
    cam.top = h;
    cam.bottom = -h;
    cam.near = 1;
    cam.far = distance * 2 + 420;
    cam.updateProjectionMatrix();

    const y = yaw * DEG;
    const p = pitch * DEG;
    const cp = Math.cos(p);
    cam.position.set(
      target.x + Math.sin(y) * cp * distance,
      target.y + Math.sin(p) * distance,
      target.z + Math.cos(y) * cp * distance,
    );
    if (this.shake > 0.0001) {
      const s = this.shake;
      cam.position.x += Math.sin(this.shakeSeed + performance.now() * 0.05) * s * 0.35;
      cam.position.y += Math.sin(this.shakeSeed * 1.7 + performance.now() * 0.062) * s * 0.3;
    }
    cam.up.set(0, 1, 0);
    cam.lookAt(target);
    cam.updateMatrixWorld(true);
  }

  get focus() {
    return this.state.target;
  }
}
