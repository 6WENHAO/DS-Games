/**
 * Crates and goal marks.
 *
 * The crate is a chamfered low-poly cube carrying the hand-authored pixel-art
 * crate atlas; frame 0 is a loose crate and frame 1 is a crate settled on its
 * mark, so a solved crate reads differently without changing its silhouette.
 * Each crate registers as a grass actor, so it shoulders the meadow aside as it
 * slides.
 */
import * as THREE from 'three';
import { textures } from '../gfx/textures.js';
import { createToonMaterial } from '../gfx/toonMaterial.js';
import { makeChamferBox } from '../world/geoBuilder.js';
import { actors } from '../core/env.js';
import { clamp } from '../world/noise.js';

let crateGeometry = null;
function getCrateGeometry(size) {
  if (!crateGeometry) crateGeometry = makeChamferBox(size, size, size, size * 0.085);
  return crateGeometry;
}

export class Crate {
  constructor({ tileSize = 2.0, registerActor = true } = {}) {
    this.size = tileSize * 0.86;
    this.material = createToonMaterial({
      map: textures.crate,
      frames: 2,
      mapTexels: 16,
      rim: 0.2,
      specular: 0.12,
      specularSteps: 2.0,
      shadeFloor: 0.03,
      color: 0xffffff,
    });
    this.mesh = new THREE.Mesh(getCrateGeometry(this.size), this.material);
    this.mesh.name = 'crate';

    this.root = new THREE.Group();
    this.tilt = new THREE.Group();
    this.tilt.add(this.mesh);
    this.root.add(this.tilt);

    this.onGoal = false;
    this.actor = registerActor ? actors.register(tileSize * 1.15) : null;
    this.settle = 0;
  }

  setOnGoal(value) {
    if (this.onGoal === value) return;
    this.onGoal = value;
    this.material.uniforms.uFrame.value = value ? 1 : 0;
    if (value) this.settle = 1;
  }

  /**
   * @param {THREE.Vector3} pos tile-space world position of the crate's base
   * @param {number} slide 0..1 progress of the current slide, or null
   * @param {THREE.Vector3} dir push direction
   */
  place(pos, slide = null, dir = null) {
    const lift = this.size * 0.5;
    let y = pos.y + lift;
    let tiltX = 0;
    let tiltZ = 0;

    if (slide !== null && dir) {
      // A heavy crate rocks forward as it is shoved and rocks back on landing.
      const s = clamp(slide, 0, 1);
      const rock = Math.sin(s * Math.PI) * 0.11 - (s > 0.86 ? (s - 0.86) / 0.14 * 0.05 : 0);
      tiltX = dir.z * rock;
      tiltZ = -dir.x * rock;
      y += Math.sin(s * Math.PI) * 0.045;
    }
    if (this.settle > 0) {
      // Short settle bounce when it lands on its mark.
      const k = this.settle;
      y += Math.sin(k * Math.PI * 3.0) * 0.055 * k;
      this.settle = Math.max(0, this.settle - 0.045);
    }

    this.root.position.set(pos.x, y, pos.z);
    this.tilt.rotation.set(tiltX, 0, tiltZ);
    if (this.actor) this.actor.position.set(pos.x, pos.y, pos.z);
  }

  dispose() {
    if (this.actor) this.actor.release();
    this.material.dispose();
  }
}

/** Flat chalk ring laid on the mown plot marking a crate's destination. */
export class GoalMark {
  constructor({ tileSize = 2.0 } = {}) {
    this.material = createToonMaterial({
      map: textures.goal,
      frames: 1,
      mapTexels: 32,
      alphaTest: 0.5,
      rim: 0.0,
      shadeFloor: 0.18,
      side: THREE.DoubleSide,
      polygonOffset: -3,
      color: 0xffffff,
    });
    const geo = new THREE.PlaneGeometry(tileSize * 0.92, tileSize * 0.92);
    geo.rotateX(-Math.PI * 0.5);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.name = 'goal-mark';
  }

  place(pos) {
    this.mesh.position.set(pos.x, pos.y + 0.035, pos.z);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

/**
 * The crate that tumbles down the road behind the title screen.
 *
 * It rolls end over end along a window of the road spline that crosses the title
 * framing, wrapping round off-camera, and it holds a grass-actor slot so the
 * meadow parts around it as it passes.
 */
export class RollingCrate {
  constructor(road, terrain, { tileSize = 2.0, speed = 3.0 } = {}) {
    this.road = road;
    this.terrain = terrain;
    this.size = tileSize * 0.8;
    this.speed = speed;
    this.from = 0;
    this.to = road.length;
    this.distance = 0;

    this.material = createToonMaterial({
      map: textures.crate,
      frames: 2,
      mapTexels: 16,
      rim: 0.22,
      specular: 0.1,
      shadeFloor: 0.03,
    });
    this.mesh = new THREE.Mesh(makeChamferBox(this.size, this.size, this.size, this.size * 0.09), this.material);
    this.root = new THREE.Group();
    this.spin = new THREE.Group();
    this.spin.add(this.mesh);
    this.root.add(this.spin);
    this.actor = actors.register(tileSize * 1.1);

    this._pos = new THREE.Vector3();
    this._tan = new THREE.Vector3();
    this._axis = new THREE.Vector3();
    this.rollAngle = 0;
  }

  /** Restricts the loop to the stretch of road the title camera can see. */
  setWindow(from, to) {
    this.from = Math.max(0, Math.min(from, this.road.length - 8));
    this.to = Math.max(this.from + 8, Math.min(to, this.road.length));
    this.distance = this.from;
    this.rollAngle = 0;
  }

  update(dt) {
    const span = this.to - this.from;
    this.distance += this.speed * dt;
    if (this.distance > this.to) this.distance -= span;

    this.road.pointAtDistance(this.distance, this._pos);
    this.road.tangentAtDistance(this.distance, this._tan);

    const ground = this.terrain.sampleHeight(this._pos.x, this._pos.z);
    // A cube advances one edge length per quarter turn.
    const edge = this.size;
    this.rollAngle += ((this.speed * dt) / edge) * (Math.PI * 0.5);

    // Quantise the tumble to quarter turns with an eased snap between them, so
    // the crate reads as a rigid box flopping over rather than a spinning ball.
    const quarter = Math.PI * 0.5;
    const idx = Math.floor(this.rollAngle / quarter);
    const frac = this.rollAngle / quarter - idx;
    const eased = frac < 0.5
      ? 2 * frac * frac
      : 1 - ((-2 * frac + 2) ** 2) / 2;
    const angle = (idx + eased) * quarter;

    // Pivoting over an edge raises the centre from e/2 to e*sqrt(2)/2 at 45deg.
    const lift = Math.sin(frac * Math.PI) * edge * 0.207;

    this._axis.set(this._tan.z, 0, -this._tan.x).normalize();
    this.spin.quaternion.setFromAxisAngle(this._axis, angle);
    this.root.position.set(this._pos.x, ground + edge * 0.5 + lift, this._pos.z);
    this.actor.position.set(this._pos.x, ground, this._pos.z);
  }

  /** Parks the crate's grass-push slot while the title screen is hidden. */
  setActive(active) {
    this.actor.active = active;
    this.root.visible = active;
    if (!active) this.actor.position.set(0, -9999, 0);
  }

  dispose() {
    this.actor.release();
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
