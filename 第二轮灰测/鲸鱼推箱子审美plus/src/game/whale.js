/**
 * The whale that pushes the crates.
 *
 * Built in code from the same low-poly kit as the trees: a faceted tube whose
 * radius profile gives the body its blunt head and tapered tail, plus flat
 * flukes, pectoral fins, a blowhole and two eyes. Flat-shaded, vertex-coloured,
 * one draw call.
 *
 * Motion is a hop: an arc between tiles with squash on the crouch and the
 * landing, and a stretch through the top of the arc. Pose (rotation, squash,
 * tail swing) is quantised to the same 12 fps stop-motion clock as the wind,
 * while translation stays continuous so pushing feels responsive.
 */
import * as THREE from 'three';
import { PALETTE, WIND } from '../core/config.js';
import { Rng, clamp, lerp } from '../world/noise.js';
import { MeshAccumulator, makeTube, makeBlob } from '../world/geoBuilder.js';
import { createToonMaterial } from '../gfx/toonMaterial.js';
import { actors } from '../core/env.js';

const BODY_LENGTH = 1.62;
const BODY_PROFILE = [0.05, 0.17, 0.33, 0.44, 0.5, 0.5, 0.45, 0.33, 0.17, 0.07];

function buildWhaleGeometry() {
  const rng = new Rng(0x5ea1);
  const acc = new MeshAccumulator({ sway: false, vertexColors: true });

  const dark = PALETTE.whaleBody.clone().multiplyScalar(0.62);
  const mid = PALETTE.whaleBody;
  const light = PALETTE.whaleBody.clone().lerp(PALETTE.whaleBelly, 0.42);
  const belly = PALETTE.whaleBelly;
  const fin = PALETTE.whaleFin;

  /** Top facets read light, the underside reads as pale belly. */
  const skin = (normal) => {
    if (normal.y < -0.22) return belly.clone().lerp(light, 0.25);
    const up = clamp(normal.y * 0.5 + 0.5, 0, 1);
    const t = clamp(up * 0.78 + rng.next() * 0.22, 0, 1);
    if (t < 0.34) return dark;
    if (t < 0.68) return mid;
    return light;
  };

  /* ---- body: spine along +Z, head at +Z ---- */
  const spine = [];
  const radii = [];
  const n = BODY_PROFILE.length;
  for (let i = 0; i < n; i += 1) {
    const t = i / (n - 1);
    const z = lerp(-BODY_LENGTH * 0.5, BODY_LENGTH * 0.5, t);
    // The back arches slightly and the belly stays flat.
    const y = Math.sin(t * Math.PI) * 0.07;
    spine.push(new THREE.Vector3(0, y, z));
    radii.push(BODY_PROFILE[i]);
  }
  const body = makeTube(spine, radii, 7);
  // Flatten the cross-section: wider than tall, like a real cetacean.
  body.scale(1.06, 0.86, 1.0);
  acc.add(body, new THREE.Matrix4(), { color: skin });

  /* ---- tail flukes: two flat wedges swept back from the tail tip ---- */
  const flukeShape = () => {
    const verts = [];
    const pts = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.52, 0.05, -0.30),
      new THREE.Vector3(0.30, 0.02, -0.52),
    ];
    const thick = 0.045;
    const push = (a, b, c) => verts.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    const up = pts.map((p) => p.clone().add(new THREE.Vector3(0, thick, 0)));
    const dn = pts.map((p) => p.clone().add(new THREE.Vector3(0, -thick, 0)));
    push(up[0], up[1], up[2]);
    push(dn[0], dn[2], dn[1]);
    for (let i = 0; i < 3; i += 1) {
      const j = (i + 1) % 3;
      push(up[i], dn[i], dn[j]);
      push(up[i], dn[j], up[j]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.computeVertexNormals();
    return geo;
  };
  for (const sign of [1, -1]) {
    const m = new THREE.Matrix4().makeScale(sign, 1, 1);
    m.setPosition(0, 0.02, -BODY_LENGTH * 0.5 + 0.02);
    acc.add(flukeShape(), m, { color: () => fin });
  }

  /* ---- pectoral fins ---- */
  for (const sign of [1, -1]) {
    const m = new THREE.Matrix4()
      .makeRotationZ(sign * -0.42)
      .premultiply(new THREE.Matrix4().makeScale(sign, 1, 1));
    m.setPosition(sign * 0.34, -0.1, 0.16);
    const finGeo = makeBlob(0.2, { jitter: 0.12, squash: 0.34, rng });
    finGeo.scale(1.0, 1.0, 1.7);
    acc.add(finGeo, m, { color: () => fin });
  }

  /* ---- blowhole ---- */
  {
    const m = new THREE.Matrix4().makeTranslation(0, 0.36, 0.30);
    const hole = makeBlob(0.08, { jitter: 0.1, squash: 0.4, rng });
    acc.add(hole, m, { color: () => dark.clone().multiplyScalar(0.5) });
  }

  /* ---- eyes ---- */
  for (const sign of [1, -1]) {
    const m = new THREE.Matrix4().makeTranslation(sign * 0.29, 0.09, 0.52);
    const eye = makeBlob(0.075, { jitter: 0.05, squash: 1, rng });
    acc.add(eye, m, { color: () => new THREE.Color('#1a2230') });
    const m2 = new THREE.Matrix4().makeTranslation(sign * 0.315, 0.12, 0.555);
    const glint = makeBlob(0.03, { jitter: 0.05, squash: 1, rng });
    acc.add(glint, m2, { color: () => new THREE.Color('#f4f8ff') });
  }

  /* ---- mouth line: a shallow pale wedge under the head ---- */
  {
    const m = new THREE.Matrix4().makeTranslation(0, -0.2, 0.42);
    const mouth = makeBlob(0.2, { jitter: 0.1, squash: 0.22, rng });
    mouth.scale(1.15, 1.0, 0.7);
    acc.add(mouth, m, { color: () => belly.clone().lerp(fin, 0.35) });
  }

  return acc;
}

export class Whale {
  constructor({ tileSize = 2.0 } = {}) {
    const acc = buildWhaleGeometry();
    this.material = createToonMaterial({
      vertexColors: true,
      rim: 0.3,
      specular: 0.42,
      specularSteps: 3.0,
      translucency: 0.06,
      shadeFloor: 0.04,
    });
    const mesh = acc.build(this.material, 'whale');
    mesh.matrixAutoUpdate = true;

    // pivot group -> facing group -> squash group -> mesh
    this.root = new THREE.Group();
    this.root.name = 'whale-root';
    this.facing = new THREE.Group();
    this.squash = new THREE.Group();
    this.squash.add(mesh);
    this.facing.add(this.squash);
    this.root.add(this.facing);
    this.mesh = mesh;

    const scale = tileSize * 0.62;
    this.squash.scale.setScalar(1);
    this.facing.scale.setScalar(scale);

    this.actor = actors.register(tileSize * 1.35);
    this.time = 0;
    this.heading = 0;        // radians, 0 = facing +Z
    this.targetHeading = 0;
    this.hopParity = 1;      // flips each hop so the tail swishes both ways
    this.celebrate = 0;
  }

  dispose() {
    this.actor.release();
    this.mesh.geometry.dispose();
    this.material.dispose();
  }

  /** Stop-motion pose clock: the pose updates 12 times a second. */
  poseTime() {
    const fps = WIND.stopFps;
    return Math.floor(this.time * fps) / fps;
  }

  setHeadingFromDelta(dx, dz) {
    if (dx === 0 && dz === 0) return;
    this.targetHeading = Math.atan2(dx, dz);
  }

  startHop() {
    this.hopParity = -this.hopParity;
  }

  /**
   * @param {number} dt seconds
   * @param {THREE.Vector3} groundPos where the whale stands
   * @param {number} hopProgress 0..1 when moving, null when idle
   */
  update(dt, groundPos, hopProgress = null) {
    this.time += dt;
    const pt = this.poseTime();

    // Shortest-arc turn towards the travel direction.
    let diff = this.targetHeading - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.heading += diff * clamp(dt * 14, 0, 1);

    const moving = hopProgress !== null;
    const t = moving ? clamp(hopProgress, 0, 1) : 0;

    // Hop arc: fast rise, slower settle, with a small overshoot on landing.
    const arc = moving ? Math.sin(Math.PI * t) : 0;
    const lift = arc * 0.42;

    // Squash and stretch, quantised to the pose clock.
    const qt = moving ? clamp(Math.floor(t * 12) / 12, 0, 1) : 0;
    let sx = 1;
    let sy = 1;
    if (moving) {
      if (qt < 0.2) { sy = lerp(1, 0.78, qt / 0.2); sx = lerp(1, 1.16, qt / 0.2); }
      else if (qt < 0.72) { sy = lerp(0.78, 1.16, (qt - 0.2) / 0.52); sx = lerp(1.16, 0.9, (qt - 0.2) / 0.52); }
      else { sy = lerp(1.16, 1.0, (qt - 0.72) / 0.28); sx = lerp(0.9, 1.0, (qt - 0.72) / 0.28); }
    } else {
      // Idle breathing, also on the stop-motion clock.
      const b = Math.sin(pt * 2.1) * 0.5 + 0.5;
      sy = lerp(0.975, 1.025, b);
      sx = lerp(1.02, 0.985, b);
    }
    if (this.celebrate > 0) {
      const c = Math.sin(pt * 16.0) * 0.5 + 0.5;
      sy *= lerp(0.9, 1.14, c);
      sx *= lerp(1.08, 0.94, c);
    }
    this.squash.scale.set(sx, sy, sx);

    // Tail-driven pitch: nose down on take-off, nose up over the apex.
    const pitch = moving ? Math.sin(t * Math.PI * 1.0) * -0.34 + (t < 0.15 ? 0.2 : 0) : Math.sin(pt * 1.6) * 0.035;
    const roll = moving
      ? Math.sin(pt * 22.0) * 0.06 * this.hopParity
      : Math.sin(pt * 1.1) * 0.02;

    this.facing.rotation.set(pitch, this.heading, roll);

    const bob = moving ? 0 : Math.sin(pt * 2.1) * 0.035;
    // 0.48 seats the belly a few centimetres into the turf.
    this.root.position.set(groundPos.x, groundPos.y + lift + bob + 0.48, groundPos.z);

    this.actor.position.set(this.root.position.x, groundPos.y, this.root.position.z);

    if (this.celebrate > 0) this.celebrate = Math.max(0, this.celebrate - dt);
  }

  cheer(seconds = 2.4) {
    this.celebrate = seconds;
  }
}
