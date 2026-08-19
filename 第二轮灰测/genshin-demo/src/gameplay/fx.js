// Pooled 3D combat/world effects: particles, slashes, shockwaves, beams, trails,
// screen-space damage numbers and camera shake.
import * as THREE from 'three';
import { makeGlowTexture } from '../core/textures.js';
import { clamp, lerp, ease } from '../core/utils.js';

export const ELEMENT_COLORS = {
  physical: 0xf2f0e6, anemo: 0x74c8a8, pyro: 0xff7a55, hydro: 0x4fc3f7,
  electro: 0xc88bfa, cryo: 0x93e0ef, geo: 0xf0b93c, dendro: 0x9adb4a, heal: 0x8de07a,
};

const MAX_P = 1400;

function arcGeometry(inner = 0.55, outer = 1.0, arc = 2.3, seg = 26) {
  const pos = [], uvs = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, a = (t - 0.5) * arc;
    const taper = Math.sin(t * Math.PI);
    const ri = lerp(outer, inner, 0.35 + taper * 0.55), ro = outer + taper * 0.12;
    pos.push(Math.cos(a) * ri, 0, Math.sin(a) * ri); uvs.push(t, 0);
    pos.push(Math.cos(a) * ro, 0, Math.sin(a) * ro); uvs.push(t, 1);
  }
  for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  return g;
}

function slashTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 32;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 128, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.28, 'rgba(255,255,255,.85)');
  g.addColorStop(.55, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 32);
  const g2 = x.createLinearGradient(0, 0, 0, 32);
  g2.addColorStop(0, 'rgba(0,0,0,1)'); g2.addColorStop(.5, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,1)');
  x.globalCompositeOperation = 'destination-out'; x.fillStyle = g2; x.fillRect(0, 0, 128, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function ringTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 30, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.72, 'rgba(255,255,255,.9)');
  g.addColorStop(.88, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class FX {
  constructor(ctx) {
    this.ctx = ctx;
    this.group = new THREE.Group(); this.group.name = 'fx'; ctx.scene.add(this.group);
    this.shakeAmp = 0; this.shakeTime = 0; this.shakeSeed = Math.random() * 100;

    // ---------- particles ----------
    const g = new THREE.BufferGeometry();
    this.pPos = new Float32Array(MAX_P * 3);
    this.pCol = new Float32Array(MAX_P * 3);
    this.pSize = new Float32Array(MAX_P);
    this.pAlpha = new Float32Array(MAX_P);
    this.pVel = new Float32Array(MAX_P * 3);
    this.pLife = new Float32Array(MAX_P);
    this.pMax = new Float32Array(MAX_P);
    this.pDrag = new Float32Array(MAX_P);
    this.pGrav = new Float32Array(MAX_P);
    this.pS0 = new Float32Array(MAX_P);
    g.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.pCol, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.pSize, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.pAlpha, 1));
    g.setDrawRange(0, MAX_P);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.pMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTex: { value: makeGlowTexture(64, 2.0) } },
      vertexShader: `attribute vec3 aColor; attribute float aSize; attribute float aAlpha;
        varying vec3 vC; varying float vA;
        void main(){ vC = aColor; vA = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = max(1.0, aSize * 420.0 / max(0.001, -mv.z));
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D uTex; varying vec3 vC; varying float vA;
        void main(){ if (vA <= 0.001) discard; vec4 t = texture2D(uTex, gl_PointCoord);
          gl_FragColor = vec4(vC, 1.0) * t.a * vA; }`,
    });
    this.points = new THREE.Points(g, this.pMat);
    this.points.frustumCulled = false; this.points.renderOrder = 5;
    this.group.add(this.points);
    this.pHead = 0;

    // ---------- slashes ----------
    const slashMat = new THREE.MeshBasicMaterial({ map: slashTexture(), transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: true });
    this.slashGeo = arcGeometry();
    this.slashes = [];
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(this.slashGeo, slashMat.clone());
      m.visible = false; m.renderOrder = 6; this.group.add(m);
      this.slashes.push({ mesh: m, t: 0, life: 0 });
    }

    // ---------- ground rings ----------
    const ringMat = new THREE.MeshBasicMaterial({ map: ringTexture(), transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.ringGeo = new THREE.PlaneGeometry(1, 1);
    this.rings = [];
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(this.ringGeo, ringMat.clone());
      m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 4; this.group.add(m);
      this.rings.push({ mesh: m, t: 0, life: 0, r0: 1, r1: 4 });
    }

    // ---------- flashes ----------
    this.flashes = [];
    const flashGeo = new THREE.IcosahedronGeometry(1, 2);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(flashGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.visible = false; this.group.add(m);
      this.flashes.push({ mesh: m, t: 0, life: 0, r: 1 });
    }

    // ---------- beams ----------
    this.beams = [];
    const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
    beamGeo.translate(0, 0.5, 0);
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      m.visible = false; this.group.add(m);
      this.beams.push({ mesh: m, t: 0, life: 0 });
    }

    // ---------- damage numbers (DOM) ----------
    this.dmgLayer = document.createElement('div');
    this.dmgLayer.id = 'dmg-layer';
    this.dmgLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden';
    (document.getElementById('ui-root') || document.body).appendChild(this.dmgLayer);
    this.dmgPool = [];
    for (let i = 0; i < 26; i++) {
      const el = document.createElement('div');
      el.style.cssText = 'position:absolute;left:0;top:0;will-change:transform,opacity;opacity:0;font-weight:800;' +
        'text-shadow:0 2px 6px rgba(0,0,0,.75),0 0 14px rgba(255,255,255,.35);white-space:nowrap;transform-origin:50% 50%';
      this.dmgLayer.appendChild(el);
      this.dmgPool.push({ el, life: 0, maxLife: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3(), scale: 1 });
    }
    this.trails = [];
    this._v = new THREE.Vector3(); this._q = new THREE.Quaternion();
  }

  // ============ particles ============
  spawnParticle(x, y, z, vx, vy, vz, color, size, life, grav = -6, drag = 2.2) {
    const i = this.pHead = (this.pHead + 1) % MAX_P;
    const i3 = i * 3;
    this.pPos[i3] = x; this.pPos[i3 + 1] = y; this.pPos[i3 + 2] = z;
    this.pVel[i3] = vx; this.pVel[i3 + 1] = vy; this.pVel[i3 + 2] = vz;
    const c = new THREE.Color(color);
    this.pCol[i3] = c.r; this.pCol[i3 + 1] = c.g; this.pCol[i3 + 2] = c.b;
    this.pSize[i] = size; this.pS0[i] = size; this.pAlpha[i] = 1;
    this.pLife[i] = life; this.pMax[i] = life; this.pGrav[i] = grav; this.pDrag[i] = drag;
  }

  hitSpark(pos, color = 0xffe9b0, scale = 1) {
    const n = Math.round(10 * scale);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI - Math.PI / 2;
      const s = (3.5 + Math.random() * 6) * scale;
      this.spawnParticle(pos.x, pos.y, pos.z,
        Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + 2, Math.sin(a) * Math.cos(e) * s,
        color, (0.09 + Math.random() * 0.13) * scale, 0.22 + Math.random() * 0.24, -9, 4.5);
    }
    this.flash(pos, color, 0.55 * scale, 0.13);
  }

  dust(pos, count = 8, color = 0xd9cfbc) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, s = 0.7 + Math.random() * 2.1;
      this.spawnParticle(pos.x, pos.y + 0.06, pos.z, Math.cos(a) * s, 0.7 + Math.random() * 1.3, Math.sin(a) * s,
        color, 0.16 + Math.random() * 0.2, 0.5 + Math.random() * 0.45, -1.2, 1.9);
    }
  }

  burst(pos, element = 'anemo', scale = 1) {
    const color = ELEMENT_COLORS[element] ?? 0xffffff;
    for (let i = 0; i < Math.round(34 * scale); i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 1.4 - 0.2;
      const s = (5 + Math.random() * 9) * scale;
      this.spawnParticle(pos.x, pos.y + 0.5, pos.z,
        Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + 3, Math.sin(a) * Math.cos(e) * s,
        color, (0.14 + Math.random() * 0.2) * scale, 0.5 + Math.random() * 0.55, -5, 2.0);
    }
    this.ring(pos, color, 4.2 * scale, 0.55);
    this.flash(pos, color, 1.6 * scale, 0.22);
  }

  elementTrail(pos, element, count = 3) {
    const color = ELEMENT_COLORS[element] ?? 0xffffff;
    for (let i = 0; i < count; i++)
      this.spawnParticle(pos.x + (Math.random() - .5) * .4, pos.y + Math.random() * .5, pos.z + (Math.random() - .5) * .4,
        (Math.random() - .5) * .8, 0.6 + Math.random(), (Math.random() - .5) * .8, color, 0.1 + Math.random() * .1, 0.4, -0.6, 1.4);
  }

  // ============ meshes ============
  slash(pos, quat, opts = {}) {
    const s = this.slashes.find(x => x.life <= 0) ?? this.slashes[0];
    s.life = opts.life ?? 0.24; s.t = 0;
    s.mesh.visible = true;
    s.mesh.position.copy(pos);
    s.mesh.quaternion.copy(quat);
    s.scale0 = (opts.radius ?? 2.0);
    s.mesh.material.color.set(opts.color ?? 0xffffff);
    s.mesh.material.opacity = 1;
    s.spin = opts.spin ?? 0;
    return s;
  }

  ring(pos, color = 0xffffff, radius = 3, life = 0.5) {
    const r = this.rings.find(x => x.life <= 0) ?? this.rings[0];
    r.life = life; r.t = 0; r.r0 = radius * 0.22; r.r1 = radius;
    r.mesh.visible = true;
    r.mesh.position.set(pos.x, pos.y + 0.09, pos.z);
    r.mesh.material.color.set(color);
    r.mesh.material.opacity = 0.95;
    r.mesh.scale.setScalar(r.r0);
    return r;
  }

  flash(pos, color = 0xffffff, radius = 1, life = 0.18) {
    const f = this.flashes.find(x => x.life <= 0) ?? this.flashes[0];
    f.life = life; f.t = 0; f.r = radius;
    f.mesh.visible = true; f.mesh.position.copy(pos);
    f.mesh.material.color.set(color); f.mesh.material.opacity = 0.9;
    f.mesh.scale.setScalar(radius * 0.35);
    return f;
  }

  beam(from, to, color = 0xffffff, life = 0.22, width = 0.16) {
    const b = this.beams.find(x => x.life <= 0) ?? this.beams[0];
    b.life = life; b.t = 0; b.mesh.visible = true;
    const dir = this._v.copy(to).sub(from);
    const len = dir.length();
    b.mesh.position.copy(from);
    b.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    b.mesh.scale.set(width, len, width);
    b.mesh.material.color.set(color); b.mesh.material.opacity = 1;
    return b;
  }

  damageNumber(pos, amount, opts = {}) {
    const d = this.dmgPool.find(x => x.life <= 0);
    if (!d) return;
    const crit = !!opts.crit, heal = !!opts.heal;
    const el = opts.element && ELEMENT_COLORS[opts.element] ? opts.element : (heal ? 'heal' : 'physical');
    const col = '#' + new THREE.Color(ELEMENT_COLORS[el]).getHexString();
    d.el.textContent = (heal ? '+' : '') + Math.round(amount) + (crit ? '' : '');
    d.el.style.color = col;
    d.el.style.fontSize = (crit ? 34 : 24) + 'px';
    d.el.style.fontFamily = 'var(--ui-font)';
    d.el.style.letterSpacing = crit ? '1px' : '0';
    d.life = d.maxLife = crit ? 1.15 : 0.95;
    d.crit = crit;
    d.pos.copy(pos);
    d.vel.set((Math.random() - 0.5) * 1.2, 3.4 + Math.random() * 0.8, (Math.random() - 0.5) * 1.2);
    d.scale = crit ? 1.5 : 1.1;
    if (crit) this.hitSpark(pos, ELEMENT_COLORS[el], 1.35);
  }

  reactionText(pos, text, color = '#ffd777') {
    const d = this.dmgPool.find(x => x.life <= 0);
    if (!d) return;
    d.el.textContent = text;
    d.el.style.color = color;
    d.el.style.fontSize = '20px';
    d.el.style.fontFamily = 'var(--ui-font)';
    d.life = d.maxLife = 1.0;
    d.crit = false; d.scale = 1.0;
    d.pos.copy(pos); d.vel.set(0, 2.2, 0);
  }

  shake(strength = 1, time = 0.25) {
    this.shakeAmp = Math.max(this.shakeAmp, strength);
    this.shakeTime = Math.max(this.shakeTime, time);
    this._shakeTotal = this.shakeTime;
  }

  /** Ribbon trail attached to an object (sword swings). */
  trail(object3D, opts = {}) {
    const segs = opts.segments ?? 14;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(segs * 2 * 3);
    const alpha = new Float32Array(segs * 2);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
    const idx = [];
    for (let i = 0; i < segs - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    geo.setIndex(idx);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Color(opts.color ?? 0xbfe9ff) } },
      vertexShader: 'attribute float aAlpha; varying float vA; void main(){ vA = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uColor; varying float vA; void main(){ if(vA<=0.002) discard; gl_FragColor = vec4(uColor, vA); }',
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false; mesh.renderOrder = 7;
    this.group.add(mesh);
    const t = {
      mesh, geo, pos, alpha, segs, object: object3D, width: opts.width ?? 0.26,
      life: opts.life ?? Infinity, age: 0, head: 0, filled: 0, active: true,
      stop: () => { t.active = false; t.life = Math.min(t.life, 0.25); },
      dispose: () => { this.group.remove(mesh); geo.dispose(); mat.dispose(); const i = this.trails.indexOf(t); if (i >= 0) this.trails.splice(i, 1); },
    };
    this.trails.push(t);
    return t;
  }

  update(dt, camera) {
    // particles
    let anyAlive = false;
    for (let i = 0; i < MAX_P; i++) {
      if (this.pLife[i] <= 0) { if (this.pAlpha[i] !== 0) this.pAlpha[i] = 0; continue; }
      anyAlive = true;
      this.pLife[i] -= dt;
      const i3 = i * 3;
      const d = Math.exp(-this.pDrag[i] * dt);
      this.pVel[i3] *= d; this.pVel[i3 + 2] *= d;
      this.pVel[i3 + 1] = this.pVel[i3 + 1] * d + this.pGrav[i] * dt;
      this.pPos[i3] += this.pVel[i3] * dt;
      this.pPos[i3 + 1] += this.pVel[i3 + 1] * dt;
      this.pPos[i3 + 2] += this.pVel[i3 + 2] * dt;
      const t = clamp(this.pLife[i] / this.pMax[i], 0, 1);
      this.pAlpha[i] = t * t;
      this.pSize[i] = this.pS0[i] * (0.35 + 0.65 * t);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.aColor.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true; g.attributes.aAlpha.needsUpdate = true;
    this.points.visible = anyAlive;

    for (const s of this.slashes) {
      if (s.life <= 0) { if (s.mesh.visible) s.mesh.visible = false; continue; }
      s.t += dt; s.life -= dt;
      const k = clamp(s.t / (s.t + s.life), 0, 1);
      const sc = s.scale0 * (0.55 + ease.outQuint(k) * 0.75);
      s.mesh.scale.setScalar(sc);
      s.mesh.material.opacity = (1 - k) * (1 - k) * 1.1;
      if (s.spin) s.mesh.rotateY(s.spin * dt);
    }
    for (const r of this.rings) {
      if (r.life <= 0) { if (r.mesh.visible) r.mesh.visible = false; continue; }
      const total = r.life + r.t; r.t += dt; r.life -= dt;
      const k = clamp(r.t / total, 0, 1);
      r.mesh.scale.setScalar(lerp(r.r0, r.r1, ease.outQuint(k)) * 2);
      r.mesh.material.opacity = (1 - k) * 0.95;
    }
    for (const f of this.flashes) {
      if (f.life <= 0) { if (f.mesh.visible) f.mesh.visible = false; continue; }
      const total = f.life + f.t; f.t += dt; f.life -= dt;
      const k = clamp(f.t / total, 0, 1);
      f.mesh.scale.setScalar(f.r * (0.3 + ease.outCubic(k) * 1.15));
      f.mesh.material.opacity = (1 - k) * 0.85;
    }
    for (const b of this.beams) {
      if (b.life <= 0) { if (b.mesh.visible) b.mesh.visible = false; continue; }
      const total = b.life + b.t; b.t += dt; b.life -= dt;
      const k = clamp(b.t / total, 0, 1);
      b.mesh.material.opacity = (1 - k);
      b.mesh.scale.x = b.mesh.scale.z = (1 - k * 0.6) * (b.mesh.scale.x > 0 ? b.mesh.scale.x : 0.16);
    }

    // trails
    for (const t of this.trails.slice()) {
      t.age += dt;
      if (t.active) {
        t.object.updateWorldMatrix(true, false);
        const m = t.object.matrixWorld;
        const p = this._v.set(0, 0, 0).applyMatrix4(m);
        const up = new THREE.Vector3(0, 1, 0).transformDirection(m).multiplyScalar(t.width);
        // shift buffer
        for (let i = t.segs - 1; i > 0; i--) {
          const s = (i - 1) * 6, d2 = i * 6;
          for (let k = 0; k < 6; k++) t.pos[d2 + k] = t.pos[s + k];
        }
        t.pos[0] = p.x - up.x; t.pos[1] = p.y - up.y; t.pos[2] = p.z - up.z;
        t.pos[3] = p.x + up.x; t.pos[4] = p.y + up.y; t.pos[5] = p.z + up.z;
        t.filled = Math.min(t.segs, t.filled + 1);
        for (let i = 0; i < t.segs; i++) {
          const a = i < t.filled ? Math.pow(1 - i / t.segs, 1.6) : 0;
          t.alpha[i * 2] = a; t.alpha[i * 2 + 1] = a;
        }
      } else {
        for (let i = 0; i < t.segs * 2; i++) t.alpha[i] *= Math.exp(-7 * dt);
      }
      t.geo.attributes.position.needsUpdate = true;
      t.geo.attributes.aAlpha.needsUpdate = true;
      if (!t.active && t.age > 0 && t.alpha[0] < 0.01 && t.alpha[t.segs * 2 - 1] < 0.01) t.dispose();
    }

    // damage numbers
    for (const d of this.dmgPool) {
      if (d.life <= 0) { if (d.el.style.opacity !== '0') d.el.style.opacity = '0'; continue; }
      d.life -= dt;
      const k = 1 - clamp(d.life / d.maxLife, 0, 1);
      d.vel.y -= 6.4 * dt;
      d.pos.addScaledVector(d.vel, dt);
      this._v.copy(d.pos).project(camera);
      if (this._v.z > 1) { d.el.style.opacity = '0'; continue; }
      const x = (this._v.x * 0.5 + 0.5) * innerWidth, y = (-this._v.y * 0.5 + 0.5) * innerHeight;
      const pop = d.crit ? 1 + ease.outBack(Math.min(1, k * 4)) * 0.35 : 1 + ease.outCubic(Math.min(1, k * 5)) * 0.18;
      d.el.style.transform = `translate(-50%,-50%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${(d.scale * pop).toFixed(3)})`;
      d.el.style.opacity = String(clamp((1 - k) * 2.2, 0, 1));
    }

    // camera shake decay
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      if (this.shakeTime <= 0) { this.shakeAmp = 0; this.shakeTime = 0; }
    }
  }

  /** Offset to apply to the camera this frame. */
  shakeOffset(out, t) {
    if (this.shakeTime <= 0) { out.set(0, 0, 0); return out; }
    const k = this.shakeAmp * Math.min(1, this.shakeTime / 0.18);
    const s = this.shakeSeed;
    out.set(Math.sin(t * 61 + s) * 0.5 + Math.sin(t * 137 + s) * 0.5,
            Math.sin(t * 73 + s * 2) * 0.5 + Math.sin(t * 151 + s) * 0.5,
            Math.sin(t * 89 + s * 3) * 0.5 + Math.sin(t * 113 + s) * 0.5).multiplyScalar(k * 0.16);
    return out;
  }
}
