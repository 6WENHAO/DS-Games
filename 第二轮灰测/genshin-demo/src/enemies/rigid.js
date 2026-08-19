// Rigid-skinned monster rigs.
//
// Every monster type is code-generated ONCE into a small number of merged,
// GPU-skinned meshes (rigid skinning: 1 bone per vertex, weight 1). The inverted
// hull outline is baked into the same geometry with reversed winding and an
// aOut attribute, so body + outline cost a single draw call.
//
//   draws per monster = (1 body) + (1 glow, optional) + (1 jelly shell, slimes)
//
// Geometry, materials, clip tables and bone inverses are all module-level cached
// per type, so the second instance of a type costs nothing but Object3D nodes.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeToonRamp } from '../core/textures.js';
import { clamp, lerp, TAU } from '../core/utils.js';

export const ELEMENT_HEX = {
  physical: 0xd9d4cc, anemo: 0x74c8a8, pyro: 0xff7a55, hydro: 0x4fc3f7,
  electro: 0xc88bfa, cryo: 0x93e0ef, geo: 0xf0b93c, dendro: 0x9adb4a,
};
export const elementHex = (e) => ELEMENT_HEX[e] ?? ELEMENT_HEX.physical;

const IDENTITY = new THREE.Matrix4();

// ---------------------------------------------------------------- toon ramps
const _ramps = new Map();
export function toonRamp(kind = 'soft') {
  let t = _ramps.get(kind);
  if (t) return t;
  if (kind === 'hard') t = makeToonRamp([0, 0.5, 1.0], [0.48, 0.94, 1.0]);
  else if (kind === 'metal') t = makeToonRamp([0, 0.3, 0.52, 0.74, 1.0], [0.4, 0.58, 0.76, 0.94, 1.05]);
  else t = makeToonRamp([0, 0.42, 0.66, 1.0], [0.56, 0.78, 0.94, 1.0]);
  _ramps.set(kind, t);
  return t;
}

// ------------------------------------------------------------ shared materials
const _mats = new Map();

/**
 * Fresnel rim light + (optionally) the baked outline shell branch.
 * Both are injected in one pass so they never fight over the same include.
 */
function injectToonExtras(mat, o) {
  const u = {
    uRimColor: { value: new THREE.Color(o.rim) },
    uRimStrength: { value: o.rimStrength },
    uRimPower: { value: o.rimPower },
    uOutlineColor: { value: new THREE.Color(o.outlineBake || 0x241a14) },
  };
  mat.userData.rim = u;
  const bake = !!o.outlineBake;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    if (bake) {
      shader.vertexShader = shader.vertexShader.replace(
        'void main() {',
        'attribute float aOut;\nvarying float vOut;\nvoid main() {\n\tvOut = aOut;');
    }
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {',
        'uniform vec3 uRimColor;\nuniform float uRimStrength;\nuniform float uRimPower;\n'
        + 'uniform vec3 uOutlineColor;\n' + (bake ? 'varying float vOut;\n' : '')
        + 'void main() {')
      .replace('#include <opaque_fragment>',
        'float rimF = 1.0 - clamp( dot( normalize( normal ), normalize( vViewPosition ) ), 0.0, 1.0 );\n'
        + 'outgoingLight += uRimColor * pow( rimF, uRimPower ) * uRimStrength;\n'
        + (bake ? 'if ( vOut > 0.5 ) outgoingLight = uOutlineColor;\n' : '')
        + '#include <opaque_fragment>');
  };
  mat.customProgramCacheKey = () => (bake ? 'enemyToonRimOutline' : 'enemyToonRim');
}

/** Cached vertex-colour toon material (one per ramp/rim/outline combo, game wide). */
export function bodyMaterial(opts = {}) {
  const o = {
    ramp: opts.ramp ?? 'soft', rim: opts.rim ?? 0x9ed7ff,
    rimStrength: opts.rimStrength ?? 0.5, rimPower: opts.rimPower ?? 2.6,
    opacity: opts.opacity ?? 1, doubleSide: !!opts.doubleSide,
    outlineBake: opts.outlineBake ?? 0,
  };
  const key = 'toon|' + o.ramp + '|' + o.rim + '|' + o.rimStrength + '|' + o.rimPower + '|'
    + o.opacity + '|' + (o.doubleSide ? 1 : 0) + '|' + o.outlineBake;
  let m = _mats.get(key);
  if (m) return m;
  m = new THREE.MeshToonMaterial({
    color: 0xffffff, vertexColors: true, gradientMap: toonRamp(o.ramp),
    transparent: o.opacity < 1, opacity: o.opacity, depthWrite: o.opacity >= 1,
    side: o.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
  });
  injectToonExtras(m, o);
  _mats.set(key, m);
  return m;
}

/** Unlit vertex-colour material for glowing bits (eyes, cores, runes). */
export function glowMaterial(opts = {}) {
  const opacity = opts.opacity ?? 1;
  const key = 'glow|' + opacity + '|' + (opts.additive ? 1 : 0);
  let m = _mats.get(key);
  if (m) return m;
  m = new THREE.MeshBasicMaterial({
    color: 0xffffff, vertexColors: true,
    transparent: opacity < 1 || !!opts.additive, opacity,
    depthWrite: opacity >= 1 && !opts.additive,
    blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  _mats.set(key, m);
  return m;
}

/** Jelly (slime) body: toon + translucent, no depth write so the core shows through. */
export function jellyMaterial(opacity = 0.55) {
  const key = 'jelly|' + opacity;
  let m = _mats.get(key);
  if (m) return m;
  m = new THREE.MeshToonMaterial({
    color: 0xffffff, vertexColors: true, gradientMap: toonRamp('hard'),
    transparent: true, opacity, depthWrite: false,
  });
  injectToonExtras(m, { rim: 0xffffff, rimStrength: 0.9, rimPower: 1.9, outlineBake: 0 });
  _mats.set(key, m);
  return m;
}

/** Inverted-hull outline shell material (only used where baking is impossible). */
export function outlineMaterial(color = 0x241a14) {
  const key = 'outline|' + color;
  let m = _mats.get(key);
  if (m) return m;
  m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  _mats.set(key, m);
  return m;
}

const OPAQUE_GROUPS = { body: 1, metal: 1 };
function materialForGroup(group, opts) {
  const bake = opts.outline > 0 && OPAQUE_GROUPS[group] ? (opts.outlineColor ?? 0x241a14) : 0;
  switch (group) {
    case 'glow': return glowMaterial({ opacity: 1 });
    case 'glowAdd': return glowMaterial({ additive: true, opacity: 0.85 });
    case 'jelly': return jellyMaterial(opts.jellyOpacity ?? 0.55);
    case 'metal': return bodyMaterial({ ramp: 'metal', rim: opts.rim ?? 0xbcd8ff, rimStrength: 0.8, rimPower: 2.2, outlineBake: bake });
    case 'membrane': return bodyMaterial({ ramp: 'hard', rim: 0xa8d8ff, rimStrength: 0.7, opacity: opts.membraneOpacity ?? 0.9, doubleSide: true });
    default: return bodyMaterial({ ramp: opts.ramp ?? 'soft', rim: opts.rim ?? 0x9ed7ff, rimStrength: opts.rimStrength ?? 0.5, outlineBake: bake });
  }
}

// ------------------------------------------------------------ geometry cache
const _geos = new Map();
function cached(key, make) { let g = _geos.get(key); if (!g) { g = make(); _geos.set(key, g); } return g; }

export const boxGeo = (w, h, d) => cached('b|' + w + '|' + h + '|' + d, () => new THREE.BoxGeometry(w, h, d));
export const sphereGeo = (r, ws = 14, hs = 10) => cached('s|' + r + '|' + ws + '|' + hs, () => new THREE.SphereGeometry(r, ws, hs));
export const cylGeo = (rt, rb, h, seg = 12) => cached('c|' + rt + '|' + rb + '|' + h + '|' + seg, () => new THREE.CylinderGeometry(rt, rb, h, seg));
export const coneGeo = (r, h, seg = 12) => cached('k|' + r + '|' + h + '|' + seg, () => new THREE.ConeGeometry(r, h, seg));
export const capsuleGeo = (r, len, cs = 5, rs = 12) => cached('p|' + r + '|' + len + '|' + cs + '|' + rs, () => new THREE.CapsuleGeometry(r, len, cs, rs));
export const torusGeo = (r, tube, rs = 8, ts = 16, arc = TAU) => cached('t|' + r + '|' + tube + '|' + rs + '|' + ts + '|' + arc, () => new THREE.TorusGeometry(r, tube, rs, ts, arc));
export const quadGeo = (w = 1, h = 1) => cached('q|' + w + '|' + h, () => new THREE.PlaneGeometry(w, h));

/** Unit-radius ground sector in the XZ plane, centred on +Z. Used by attack telegraphs. */
export function sectorGeometry(angleDeg = 90, radialSeg = 10, arcSeg = 32) {
  return cached('sect|' + angleDeg + '|' + radialSeg + '|' + arcSeg, () => {
    const arc = angleDeg * Math.PI / 180, half = arc * 0.5;
    const seg = Math.max(4, Math.round(arcSeg * Math.min(1, angleDeg / 140)));
    const pos = [], rad = [], idx = [];
    for (let i = 0; i <= radialSeg; i++) {
      const r = i / radialSeg;
      for (let j = 0; j <= seg; j++) {
        const t = j / seg, a = -half + arc * t;
        pos.push(Math.sin(a) * r, 0, Math.cos(a) * r);
        rad.push(r, t);
      }
    }
    const row = seg + 1;
    for (let i = 0; i < radialSeg; i++) for (let j = 0; j < seg; j++) {
      const a = i * row + j, b = a + 1, c = a + row, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aRad', new THREE.Float32BufferAttribute(rad, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  });
}

const TELE_VERT = `
attribute vec2 aRad;
varying vec2 vR;
void main(){ vR = aRad; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }
`;
const TELE_FRAG = `
uniform float uFill, uAlpha, uTime, uSide;
uniform vec3 uColor;
varying vec2 vR;
void main(){
  float r = vR.x;
  float inside = step( r, uFill );
  float lead = smoothstep( 0.075, 0.0, abs( r - uFill ) ) * step( uFill, 0.995 );
  float ring = smoothstep( 0.90, 1.0, r );
  float sideEdge = ( 1.0 - smoothstep( 0.0, 0.04, min( vR.y, 1.0 - vR.y ) ) ) * uSide;
  float pulse = 0.72 + 0.28 * sin( uTime * 11.0 );
  float a = uAlpha * ( 0.10 + inside * 0.34 * pulse + lead * 0.95 + ring * 0.45 + sideEdge * 0.32 );
  a *= smoothstep( 0.0, 0.05, r );
  gl_FragColor = vec4( uColor * ( 0.55 + inside * 0.45 + lead * 1.35 ), a );
}
`;

/** Per-enemy telegraph material (uniform driven; only a handful ever exist). */
export function makeTelegraphMaterial(colorHex = 0xff4a3a) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uFill: { value: 0 }, uAlpha: { value: 1 }, uTime: { value: 0 },
      uSide: { value: 1 }, uColor: { value: new THREE.Color(colorHex) },
    },
    vertexShader: TELE_VERT, fragmentShader: TELE_FRAG,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

// ------------------------------------------------------------ canvas marks
const _marks = new Map();
/** Procedural "!" / "?" alert mark (Canvas2D, no external assets). */
export function markTexture(char = '!', color = '#ffd24a') {
  const key = char + color;
  let t = _marks.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 64, 64);
  g.font = 'bold 54px system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 10; g.strokeStyle = 'rgba(28,18,12,0.95)';
  g.strokeText(char, 32, 34);
  g.fillStyle = color; g.fillText(char, 32, 34);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  _marks.set(key, t);
  return t;
}

// ------------------------------------------------------------ rig definition
const _rigDefs = new Map();
const _tmpM = new THREE.Matrix4();
const _tmpM2 = new THREE.Matrix4();
const _tmpQ = new THREE.Quaternion();
const _tmpE = new THREE.Euler();
const _tmpV = new THREE.Vector3();
const _tmpC = new THREE.Color();

class RigBuilder {
  constructor(opts) { this.opts = opts; this.bones = []; this.parts = []; }

  /** Declare a bone. Rest transform = pos/rot/scale, nested by parent name. */
  bone(name, parent = null, pos = [0, 0, 0], rot = [0, 0, 0], scale = 1) {
    this.bones.push({ name, parent, pos, rot, scale });
    return name;
  }

  part(bone, geometry, o = {}) {
    this.parts.push({
      bone, geometry,
      color: o.color ?? 0xffffff, glow: o.glow ?? 1,
      pos: o.pos ?? [0, 0, 0], rot: o.rot ?? [0, 0, 0], scale: o.scale ?? 1,
      group: o.group ?? 'body', outline: o.outline !== false,
    });
  }
  box(bone, w, h, d, o) { this.part(bone, boxGeo(w, h, d), o); }
  sphere(bone, r, o = {}) { this.part(bone, sphereGeo(r, o.ws ?? 14, o.hs ?? 10), o); }
  cyl(bone, rt, rb, h, o = {}) { this.part(bone, cylGeo(rt, rb, h, o.seg ?? 12), o); }
  cone(bone, r, h, o = {}) { this.part(bone, coneGeo(r, h, o.seg ?? 12), o); }
  capsule(bone, r, len, o = {}) { this.part(bone, capsuleGeo(r, len, o.cs ?? 5, o.rs ?? 12), o); }
  torus(bone, r, tube, o = {}) { this.part(bone, torusGeo(r, tube, o.rs ?? 8, o.ts ?? 16, o.arc ?? TAU), o); }

  compile() {
    const opts = this.opts;
    // ---- bone rest matrices relative to the rig root (used for baking + skinning)
    const index = new Map();
    const rest = [];
    this.bones.forEach((b, i) => index.set(b.name, i));
    for (const b of this.bones) {
      _tmpE.set(b.rot[0], b.rot[1], b.rot[2]);
      _tmpQ.setFromEuler(_tmpE);
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(b.pos[0], b.pos[1], b.pos[2]), _tmpQ, _tmpV.setScalar(b.scale));
      if (b.parent != null) {
        const pi = index.get(b.parent);
        if (pi != null) m.premultiply(rest[pi]);
      }
      rest.push(m);
    }
    const boneInverses = rest.map((m) => new THREE.Matrix4().copy(m).invert());

    // ---- bake every part into rig-root space, tagged with its bone
    const buckets = new Map();
    for (const p of this.parts) {
      const bi = index.get(p.bone);
      if (bi == null) { console.warn('[rig] unknown bone', p.bone); continue; }
      const g = p.geometry.clone();
      for (const name of Object.keys(g.attributes)) {
        if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
      }
      const s = Array.isArray(p.scale) ? _tmpV.set(p.scale[0], p.scale[1], p.scale[2]) : _tmpV.setScalar(p.scale);
      _tmpE.set(p.rot[0], p.rot[1], p.rot[2]);
      _tmpQ.setFromEuler(_tmpE);
      _tmpM.compose(new THREE.Vector3(p.pos[0], p.pos[1], p.pos[2]), _tmpQ, s);
      _tmpM2.multiplyMatrices(rest[bi], _tmpM);
      g.applyMatrix4(_tmpM2);

      const n = g.attributes.position.count;
      const col = new Float32Array(n * 3);
      _tmpC.set(p.color);
      const gl = p.glow;
      for (let i = 0; i < n; i++) { col[i * 3] = _tmpC.r * gl; col[i * 3 + 1] = _tmpC.g * gl; col[i * 3 + 2] = _tmpC.b * gl; }
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
      const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { si[i * 4] = bi; sw[i * 4] = 1; }
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
      g.setAttribute('aOut', new THREE.Float32BufferAttribute(new Float32Array(n), 1));
      if (!g.index) g.setIndex(Array.from({ length: n }, (_, i) => i));

      const key = p.group + '|' + (p.outline ? 1 : 0);
      let bucket = buckets.get(key);
      if (!bucket) { bucket = { group: p.group, outline: p.outline, list: [] }; buckets.set(key, bucket); }
      bucket.list.push(g);
    }

    // ---- one merged (skinned) mesh per material group
    const groups = [];
    const outlineOff = opts.outline ?? 0;
    for (const b of buckets.values()) {
      const merged = mergeGeometries(b.list, false);
      for (const g of b.list) g.dispose();
      if (!merged) continue;
      pad(merged);
      const entry = {
        group: b.group, material: materialForGroup(b.group, opts),
        geo: merged, geoPlain: merged, outlineGeo: null, outlineMaterial: null,
        castShadow: b.group !== 'glow' && b.group !== 'glowAdd',
      };
      if (b.outline && outlineOff > 0 && b.group !== 'glow' && b.group !== 'glowAdd') {
        if (OPAQUE_GROUPS[b.group]) {
          // bake the inverted hull into the same geometry (reversed winding)
          const shell = shellGeometry(merged, outlineOff, true);
          const full = mergeGeometries([merged, shell], false);
          shell.dispose();
          if (full) { pad(full); entry.geo = full; }
        } else {
          // translucent groups keep a separate opaque shell (still skinned)
          entry.outlineGeo = shellGeometry(merged, outlineOff, false);
          pad(entry.outlineGeo);
          entry.outlineMaterial = outlineMaterial(opts.outlineColor ?? 0x241a14);
        }
      }
      groups.push(entry);
    }
    return {
      bones: this.bones, groups, boneInverses, clips: {},
      outlineColor: opts.outlineColor ?? 0x241a14, opts,
      meshCount: groups.length + groups.filter((g) => g.outlineGeo).length,
    };
  }
}

function pad(geo) {
  geo.computeBoundingSphere();
  if (geo.boundingSphere) geo.boundingSphere.radius *= 1.6;   // animation head-room
}

/** Inflate along normals; optionally reverse the winding and flag verts as outline. */
function shellGeometry(geo, offset, reverse) {
  const g = new THREE.BufferGeometry();
  const src = geo.attributes.position, nor = geo.attributes.normal;
  const n = src.count;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = src.getX(i) + nor.getX(i) * offset;
    pos[i * 3 + 1] = src.getY(i) + nor.getY(i) * offset;
    pos[i * 3 + 2] = src.getZ(i) + nor.getZ(i) * offset;
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  for (const name of ['normal', 'uv', 'color', 'skinIndex', 'skinWeight']) {
    const a = geo.attributes[name];
    if (a) g.setAttribute(name, a.clone());
  }
  const flag = new Float32Array(n);
  if (reverse) flag.fill(1);
  g.setAttribute('aOut', new THREE.Float32BufferAttribute(flag, 1));
  const idx = geo.index;
  if (idx) {
    const out = new Uint32Array(idx.count);
    for (let i = 0; i < idx.count; i += 3) {
      if (reverse) { out[i] = idx.getX(i + 2); out[i + 1] = idx.getX(i + 1); out[i + 2] = idx.getX(i); }
      else { out[i] = idx.getX(i); out[i + 1] = idx.getX(i + 1); out[i + 2] = idx.getX(i + 2); }
    }
    g.setIndex(new THREE.BufferAttribute(out, 1));
  }
  return g;
}

/**
 * Define (and cache) a monster rig. Heavy work runs once per type.
 *   defineRig('hilichurl', { outline: 0.013 }, (b) => {...}, () => clipSpec)
 */
export function defineRig(key, opts, build, clipSpec) {
  let def = _rigDefs.get(key);
  if (def) return def;
  const b = new RigBuilder({ outline: 0.014, ...opts });
  build(b);
  def = b.compile();
  def.clips = clipSpec ? makeClips(typeof clipSpec === 'function' ? clipSpec() : clipSpec) : {};
  def.key = key;
  _rigDefs.set(key, def);
  return def;
}

/** Instantiate a rig definition: fresh bones + shared skinned geometry/materials. */
export function buildRig(def, opts = {}) {
  const root = new THREE.Group();
  const bones = new Map();
  const boneArr = [];
  for (const b of def.bones) {
    const o = new THREE.Bone();
    o.name = b.name;
    o.position.set(b.pos[0], b.pos[1], b.pos[2]);
    o.rotation.set(b.rot[0], b.rot[1], b.rot[2]);
    if (b.scale !== 1) o.scale.setScalar(b.scale);
    (b.parent != null && bones.has(b.parent) ? bones.get(b.parent) : root).add(o);
    bones.set(b.name, o);
    boneArr.push(o);
  }
  const skeleton = new THREE.Skeleton(boneArr, def.boneInverses);
  const meshes = [], outlines = [];
  const wantOutline = opts.outline !== false;
  for (const g of def.groups) {
    const mesh = new THREE.SkinnedMesh(wantOutline ? g.geo : g.geoPlain, g.material);
    mesh.bind(skeleton, IDENTITY);
    mesh.castShadow = g.castShadow;
    mesh.receiveShadow = !!opts.selfShadow && g.castShadow;
    mesh.userData.group = g.group;
    mesh.userData.def = g;
    root.add(mesh);
    meshes.push(mesh);
    if (g.outlineGeo && wantOutline) {
      const o = new THREE.SkinnedMesh(g.outlineGeo, g.outlineMaterial);
      o.bind(skeleton, IDENTITY);
      o.renderOrder = -1;
      root.add(o);
      outlines.push(o);
    }
  }
  const inst = {
    root, bones, meshes, outlines, skeleton,
    rig: new RigidRig(bones, def.clips),
    /** LOD: swap between outlined and plain geometry (same draw count, less work). */
    setOutline(on) {
      for (const m of meshes) {
        const d = m.userData.def;
        if (d) m.geometry = on ? d.geo : d.geoPlain;
      }
      for (const o of outlines) o.visible = on;
    },
  };
  return inst;
}

// ------------------------------------------------------------ clips
const POSE_KEYS = ['px', 'py', 'pz', 'rx', 'ry', 'rz', 'sx', 'sy', 'sz'];
const defPose = () => ({ px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 });
function fillPose(v) { const p = defPose(); if (v) for (const k in v) if (k in p) p[k] = v[k]; return p; }
function copyPose(a, b) { for (let i = 0; i < 9; i++) b[POSE_KEYS[i]] = a[POSE_KEYS[i]]; }
function resetPose(p) { p.px = p.py = p.pz = p.rx = p.ry = p.rz = 0; p.sx = p.sy = p.sz = 1; }

/**
 * Compile a clip spec into sampled tracks. Keyframe times are normalised 0..1.
 *   { walk: { dur: .9, loop: true, tracks: { hip: [[0,{py:0}], [.5,{py:.05}], [1,{py:0}]] } } }
 * Channels: px py pz (offset from rest), rx ry rz (radians added to rest), sx sy sz (scale mul).
 */
export function makeClips(spec) {
  const out = {};
  for (const name of Object.keys(spec)) {
    const c = spec[name];
    const tracks = {};
    for (const bone of Object.keys(c.tracks ?? {})) {
      tracks[bone] = c.tracks[bone]
        .map((k) => ({ t: k[0], v: fillPose(k[1]) }))
        .sort((a, b) => a.t - b.t);
    }
    out[name] = { dur: c.dur ?? 1, loop: c.loop ?? true, speed: c.speed ?? 1, linear: !!c.linear, tracks };
  }
  return out;
}

function sampleTrack(keys, u, out, linear) {
  const n = keys.length;
  if (!n) { resetPose(out); return; }
  if (u <= keys[0].t) { copyPose(keys[0].v, out); return; }
  if (u >= keys[n - 1].t) { copyPose(keys[n - 1].v, out); return; }
  let i = 0;
  while (i < n - 1 && keys[i + 1].t <= u) i++;
  const a = keys[i], b = keys[i + 1];
  let f = (u - a.t) / Math.max(1e-6, b.t - a.t);
  if (!linear) f = f * f * (3 - 2 * f);
  for (let k = 0; k < 9; k++) { const key = POSE_KEYS[k]; out[key] = a.v[key] + (b.v[key] - a.v[key]) * f; }
}

/** Pose-blending animator over a bone map. One tiny instance per monster. */
export class RigidRig {
  constructor(bones, clipDefs = {}) {
    this.bones = bones;
    this.clipDefs = clipDefs;
    this.rest = new Map();
    this.out = new Map();
    this.snap = new Map();
    this.tmp = defPose();
    for (const [n, o] of bones) {
      this.rest.set(n, {
        px: o.position.x, py: o.position.y, pz: o.position.z,
        rx: o.rotation.x, ry: o.rotation.y, rz: o.rotation.z,
        sx: o.scale.x, sy: o.scale.y, sz: o.scale.z,
      });
      this.out.set(n, defPose());
      this.snap.set(n, defPose());
    }
    this.name = null; this.clip = null;
    this.t = 0; this.speed = 1; this.blendT = 1; this.blendDur = 0;
    this.finished = false; this.onEnd = null;
  }

  has(name) { return !!this.clipDefs[name]; }
  isPlaying(name) { return this.name === name; }
  get time() { return this.t; }
  get normalized() { return this.clip ? clamp(this.t / this.clip.dur, 0, 1) : 0; }
  setSpeed(s) { this.speed = s; }

  /** Skinned rigs cannot hide bones, so parts are removed by collapsing their rest scale. */
  setBoneRestScale(name, s) {
    const r = this.rest.get(name);
    if (r) { r.sx = r.sy = r.sz = s; }
  }

  play(name, o = {}) {
    let clip = this.clipDefs[name];
    if (!clip) { clip = this.clipDefs.idle; name = clip ? 'idle' : null; }
    if (!clip) return false;
    if (this.name === name && !o.restart && clip.loop && o.loop !== false) {
      if (o.speed != null) this.speed = o.speed;
      return true;
    }
    for (const [n, p] of this.out) copyPose(p, this.snap.get(n));
    this.name = name;
    this.clip = (o.loop === false && clip.loop) ? { ...clip, loop: false }
      : (o.loop === true && !clip.loop) ? { ...clip, loop: true } : clip;
    this.t = 0;
    this.speed = o.speed ?? 1;
    this.blendDur = o.fade ?? 0.14;
    this.blendT = this.blendDur > 0 ? 0 : 1;
    this.finished = false;
    this.onEnd = o.onEnd ?? null;
    return true;
  }

  update(dt) {
    const c = this.clip;
    if (!c) return;
    this.t += dt * this.speed * c.speed;
    if (c.loop) { if (this.t >= c.dur) this.t %= c.dur; }
    else if (this.t >= c.dur) {
      this.t = c.dur;
      if (!this.finished) { this.finished = true; const f = this.onEnd; this.onEnd = null; if (f) f(); }
    }
    const u = c.dur > 0 ? this.t / c.dur : 0;
    if (this.blendT < 1) this.blendT = Math.min(1, this.blendT + dt / Math.max(1e-4, this.blendDur));
    const w = this.blendT < 1 ? this.blendT * this.blendT * (3 - 2 * this.blendT) : 1;
    const tmp = this.tmp;
    for (const [name, bone] of this.bones) {
      const rest = this.rest.get(name), out = this.out.get(name);
      const trk = c.tracks[name];
      if (trk) sampleTrack(trk, u, tmp, c.linear); else resetPose(tmp);
      if (w < 1) {
        const s = this.snap.get(name);
        for (let i = 0; i < 9; i++) { const k = POSE_KEYS[i]; out[k] = lerp(s[k], tmp[k], w); }
      } else {
        for (let i = 0; i < 9; i++) { const k = POSE_KEYS[i]; out[k] = tmp[k]; }
      }
      bone.position.set(rest.px + out.px, rest.py + out.py, rest.pz + out.pz);
      bone.rotation.set(rest.rx + out.rx, rest.ry + out.ry, rest.rz + out.rz);
      bone.scale.set(rest.sx * out.sx, rest.sy * out.sy, rest.sz * out.sz);
    }
  }
}

/** Small verlet chain for dragon tails / dangling parts (world space). */
export class VerletChain {
  constructor(count, segLen, opts = {}) {
    this.n = count; this.segLen = segLen;
    this.p = []; this.prev = [];
    for (let i = 0; i < count; i++) { this.p.push(new THREE.Vector3()); this.prev.push(new THREE.Vector3()); }
    this.gravity = opts.gravity ?? -6.0;
    this.damp = opts.damp ?? 0.9;
    this.restPull = opts.restPull ?? 0;
    this.sag = opts.sag ?? 0;
    this.inited = false;
  }
  reset(anchor, dir) {
    for (let i = 0; i < this.n; i++) {
      this.p[i].copy(anchor).addScaledVector(dir, this.segLen * i);
      this.prev[i].copy(this.p[i]);
    }
    this.inited = true;
  }
  update(dt, anchor, dir) {
    if (!this.inited) { this.reset(anchor, dir); return; }
    dt = Math.min(dt, 1 / 30);
    const v = _tmpV;
    for (let i = 1; i < this.n; i++) {
      const p = this.p[i], pr = this.prev[i];
      v.copy(p).sub(pr).multiplyScalar(this.damp);
      pr.copy(p);
      p.add(v);
      p.y += this.gravity * dt * dt * 30;
    }
    this.p[0].copy(anchor);
    this.prev[0].copy(anchor);
    for (let k = 0; k < 3; k++) {
      v.copy(anchor).addScaledVector(dir, this.segLen);
      this.p[1].lerp(v, 0.45);
      for (let i = 1; i < this.n; i++) {
        const a = this.p[i - 1], b = this.p[i];
        v.copy(b).sub(a);
        const d = v.length() || 1e-5;
        v.multiplyScalar((d - this.segLen) / d);
        b.sub(v);
      }
    }
    if (this.restPull > 0) {
      for (let i = 1; i < this.n; i++) {
        v.copy(anchor).addScaledVector(dir, this.segLen * i);
        v.y += this.sag * i;
        this.p[i].lerp(v, this.restPull * (0.35 + 0.65 * i / this.n));
      }
    }
  }
}
