// Terrain.js — procedural Golden Gate landmasses, Fort Point and a distant
// San Francisco skyline. Everything is generated from seeded value noise so the
// scene is byte-for-byte identical on every reload (no Math.random at build time).

import * as THREE from 'three';
import { WORLD, COLORS } from '../config.js';

// ---------------------------------------------------------------------------
// Seeded deterministic noise (2D value noise + fBm)
// ---------------------------------------------------------------------------

const SEED_MARIN = 0x51ab;
const SEED_SF = 0x9c41;
const SEED_CITY = 0x7e3f;

// 32-bit integer lattice hash -> [0,1). Math.imul keeps multiplication inside
// signed 32-bit arithmetic so results are defined and stable across platforms.
function hash2(ix, iz, seed) {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

// Bilinear value noise: hashed corners blended by smoothstep interpolation.
function valueNoise(x, z, seed) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

// Fractal Brownian motion: octaves at doubled frequency / halved amplitude,
// renormalised so the result stays within ~[0,1].
function fbm(x, z, seed, octaves) {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, z * freq, seed + i * 101);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

// Ridged noise: folding value noise around its midpoint turns smooth hills into
// sharp crest lines, which is what gives the Marin headlands their drama.
function ridged(x, z, seed, octaves) {
  return 1 - Math.abs(2 * fbm(x, z, seed, octaves) - 1);
}

function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// mulberry32: tiny deterministic PRNG for the skyline's per-building jitter.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Terrain field
// ---------------------------------------------------------------------------

const LAND_OUTER = WORLD.oceanSize / 2; // land reaches the ocean plane edge
const SHORE_FADE_MARIN = 180; // steep strait-facing cliff on the Marin side
const SHORE_FADE_SF = 420; // gentle beach-like ramp on the SF side
const OUTER_FADE = 600; // metres over which far world edges fade to sea level
const MARIN_MAX = 340; // Marin headlands peak altitude (m)
const SF_MAX = 170; // Presidio rolling-hill peak altitude (m)
const SEG = 200; // 200x200 segments per side (within the <=200x200 budget)

// Smooth land mask. It is exactly 0 on the strait shoreline (|x| = inner edge)
// and fades to 0 again at the world's outer edges, so terrain meets the ocean
// plane with no visible seam and no cliff at the map boundary. The shore ramp
// width is side-dependent: sharp for Marin's bluffs, soft for SF's hills.
function landMask(x, z) {
  const ax = Math.abs(x);
  if (ax <= WORLD.terrainInnerEdge) return 0;
  const fade = x < 0 ? SHORE_FADE_MARIN : SHORE_FADE_SF;
  const shore = smoothstep(0, fade, ax - WORLD.terrainInnerEdge);
  const outerX = 1 - smoothstep(LAND_OUTER - OUTER_FADE, LAND_OUTER, ax);
  const outerZ = 1 - smoothstep(LAND_OUTER - OUTER_FADE, LAND_OUTER, Math.abs(z));
  return shore * outerX * outerZ;
}

// Marin (-X): steep, rocky, dry. Ridges dominate, and the amplitude is already
// high at the shore so the sharp mask turns the coast into a near-vertical bluff.
function marinField(x, z) {
  const d = -x - WORLD.terrainInnerEdge;
  const crest = ridged(x * 0.0022, z * 0.0022, SEED_MARIN, 4);
  const fine = ridged(x * 0.006, z * 0.006, SEED_MARIN + 11, 3);
  const base = fbm(x * 0.0009, z * 0.0009, SEED_MARIN + 23, 3);
  const amp = 0.55 + 0.45 * smoothstep(0, 1800, d);
  return MARIN_MAX * amp * (0.5 * crest + 0.3 * fine + 0.2 * base);
}

// San Francisco / Presidio (+X): lower, softer, greener rolling hills.
function sfField(x, z) {
  const d = x - WORLD.terrainInnerEdge;
  const roll = fbm(x * 0.0016, z * 0.0016, SEED_SF, 4);
  const detail = fbm(x * 0.005, z * 0.005, SEED_SF + 17, 3);
  const base = fbm(x * 0.0007, z * 0.0007, SEED_SF + 31, 3);
  const amp = 0.3 + 0.7 * smoothstep(0, 2200, d);
  return SF_MAX * amp * (0.55 * roll + 0.25 * detail + 0.2 * base);
}

// The single analytic height field. Mesh displacement and getHeight() both call
// this, so queryable altitude and rendered geometry can never drift apart.
function heightAt(x, z) {
  const ax = Math.abs(x);
  if (ax <= WORLD.terrainInnerEdge) return WORLD.seaLevel;
  const mask = landMask(x, z);
  if (mask <= 0) return WORLD.seaLevel;
  return WORLD.seaLevel + (x < 0 ? marinField(x, z) : sfField(x, z)) * mask;
}

// ---------------------------------------------------------------------------
// Geometry builders
// ---------------------------------------------------------------------------

// Slope-aware vertex colours. Marin: dry grass base -> rock on steep faces ->
// green in low flat gullies. SF: green base -> dry on high ridges -> rock on
// any cliff faces. Slope comes straight from the computed vertex normal.
function colorTerrain(geo, side) {
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const count = pos.count;
  const colors = new Float32Array(count * 3);
  const c = new THREE.Color();
  const dry = new THREE.Color(COLORS.terrainDry);
  const green = new THREE.Color(COLORS.terrainGreen);
  const rock = new THREE.Color(COLORS.terrainRock);
  const maxH = side === 'marin' ? MARIN_MAX : SF_MAX;

  for (let i = 0; i < count; i++) {
    const hN = pos.getY(i) / maxH;
    const slope = 1 - nrm.getY(i); // 0 flat, approaches 1 on vertical faces
    if (side === 'marin') {
      const rockT = clamp01(slope * 1.8);
      const dryT = clamp01((hN - 0.28) * 2.0);
      const greenT = (1 - rockT) * (1 - dryT) * 0.85; // only in low, flat gullies
      c.copy(dry).lerp(rock, rockT).lerp(green, greenT);
    } else {
      const rockT = clamp01(slope * 2.2);
      const dryT = clamp01((hN - 0.5) * 2.6);
      c.copy(green).lerp(dry, dryT).lerp(rock, rockT);
    }
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

// One landmass: a PlaneGeometry rotated flat into XZ and displaced by heightAt.
function buildLandmass(centerX, side, mat, geos) {
  const sizeX = LAND_OUTER - WORLD.terrainInnerEdge;
  const geo = new THREE.PlaneGeometry(sizeX, WORLD.oceanSize, SEG, SEG);
  geos.push(geo);
  geo.rotateX(-Math.PI / 2); // lay flat; local Y is now world-up, local Z = width
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const wx = centerX + pos.getX(i);
    const wz = pos.getZ(i);
    pos.setY(i, heightAt(wx, wz));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  colorTerrain(geo, side);

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(centerX, 0, 0);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return mesh;
}

// Fort Point style masonry promontory on the +X shore: a few concrete boxes.
function buildFortPoint(unitBox, mat) {
  const fort = new THREE.Group();
  fort.name = 'FortPoint';
  const add = (w, h, d, x, y, z) => {
    const m = new THREE.Mesh(unitBox, mat);
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    fort.add(m);
  };
  add(96, 7, 72, 1525, 3.5, 0); // masonry platform at the water's edge
  add(88, 10, 6, 1525, 12, -32); // north wall
  add(88, 10, 6, 1525, 12, 32); // south wall
  add(6, 10, 70, 1568, 12, 0); // inland (east) wall
  add(6, 12, 70, 1488, 13, 0); // strait-facing (west) wall, juts over the water
  add(16, 16, 16, 1568, 15, -32); // corner bastion
  return fort;
}

// Distant SF skyline: one InstancedMesh of 34 boxes, dark with a faint warm
// window tint, clustered toward the downtown core and seated on the terrain.
function buildSkyline(unitBox, mat) {
  const COUNT = 34;
  const rnd = mulberry32(SEED_CITY);
  const mesh = new THREE.InstancedMesh(unitBox, mat, COUNT);
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const cx = 3400;
  const cz = -100;

  for (let i = 0; i < COUNT; i++) {
    // Averaging two uniforms gives a triangle distribution centred on the cluster.
    const x = 2600 + 1600 * (rnd() + rnd()) * 0.5;
    const z = -900 + 1600 * (rnd() + rnd()) * 0.5;
    const dx = (x - cx) / 800;
    const dz = (z - cz) / 800;
    const core = clamp01(1 - Math.sqrt(dx * dx + dz * dz)); // 1 downtown, 0 fringe
    const h = 60 + 200 * (0.35 * core + 0.65 * rnd()); // 60-260 m, taller at core
    const w = 40 + 60 * rnd();
    const d = 40 + 60 * rnd();
    const ground = heightAt(x, z);
    p.set(x, ground + h * 0.5, z);
    e.set(0, (rnd() - 0.5) * 0.12, 0); // small seeded yaw jitter
    q.setFromEuler(e);
    s.set(w, h, d);
    m4.compose(p, q, s);
    mesh.setMatrixAt(i, m4);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

// ---------------------------------------------------------------------------
// Terrain
// ---------------------------------------------------------------------------

export class Terrain {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'Terrain';
    this._geos = [];
    this._mats = [];

    const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      metalness: 0,
    });
    const concreteMat = new THREE.MeshStandardMaterial({
      color: COLORS.concrete,
      roughness: 0.9,
      metalness: 0,
    });
    const cityMat = new THREE.MeshStandardMaterial({
      color: 0x12161c,
      roughness: 0.85,
      metalness: 0,
      emissive: new THREE.Color(COLORS.cityWindow),
      emissiveIntensity: 0.16,
    });
    this._mats.push(terrainMat, concreteMat, cityMat);

    // Single unit box reused by Fort Point boxes and the skyline InstancedMesh.
    const unitBox = new THREE.BoxGeometry(1, 1, 1);
    this._geos.push(unitBox);

    const mid = (LAND_OUTER + WORLD.terrainInnerEdge) / 2; // 3750

    this.group.add(buildLandmass(-mid, 'marin', terrainMat, this._geos));
    this.group.add(buildLandmass(mid, 'sf', terrainMat, this._geos));
    this.group.add(buildFortPoint(unitBox, concreteMat));
    this.group.add(buildSkyline(unitBox, cityMat));

    scene.add(this.group);
  }

  getHeight(x, z) {
    return heightAt(x, z);
  }

  update(_dt) {
    // Static terrain: nothing to animate each frame.
  }

  dispose() {
    for (const g of this._geos) g.dispose();
    for (const m of this._mats) m.dispose();
    this._geos.length = 0;
    this._mats.length = 0;
    if (this.group.parent) this.group.parent.remove(this.group);
  }
}
