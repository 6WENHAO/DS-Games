// Weather: presets with smooth transitions, rain streaks, snowfall, lightning,
// wind that drives vegetation, and per-region autoselection.
import * as THREE from 'three';
import { clamp, lerp, damp, smoothstep, makeRNG } from '../core/utils.js';
import { regionAt, height, WORLD } from './heightfield.js';
import { makeGlowTexture } from '../core/textures.js';

export const PRESETS = {
  clear:    { cover: 0.52, cloudOp: 0.85, sun: 1.00, fog: 1.00, particles: 'none',  rate: 0,    wind: 0.35, sat: 1.10, name: '晴朗' },
  cloudy:   { cover: 0.34, cloudOp: 1.00, sun: 0.86, fog: 1.25, particles: 'none',  rate: 0,    wind: 0.55, sat: 1.04, name: '多云' },
  overcast: { cover: 0.14, cloudOp: 1.00, sun: 0.60, fog: 1.60, particles: 'none',  rate: 0,    wind: 0.7,  sat: 0.94, name: '阴天' },
  rain:     { cover: 0.10, cloudOp: 1.00, sun: 0.44, fog: 2.00, particles: 'rain',  rate: 0.75, wind: 0.9,  sat: 0.90, name: '降雨' },
  storm:    { cover: 0.04, cloudOp: 1.00, sun: 0.34, fog: 2.45, particles: 'rain',  rate: 1.00, wind: 1.4,  sat: 0.84, name: '暴雨' },
  snow:     { cover: 0.20, cloudOp: 1.00, sun: 0.66, fog: 1.90, particles: 'snow',  rate: 0.7,  wind: 0.6,  sat: 0.92, name: '降雪' },
  blizzard: { cover: 0.06, cloudOp: 1.00, sun: 0.46, fog: 2.90, particles: 'snow',  rate: 1.0,  wind: 1.6,  sat: 0.82, name: '暴风雪' },
  mist:     { cover: 0.40, cloudOp: 0.9,  sun: 0.74, fog: 2.60, particles: 'none',  rate: 0,    wind: 0.2,  sat: 0.96, name: '薄雾' },
};

const RAIN_N = 1400, SNOW_N = 1600;

export class Weather {
  constructor(ctx) {
    this.ctx = ctx;
    this.rng = makeRNG(0x5EED);
    this.cur = { ...PRESETS.clear };
    this.target = { ...PRESETS.clear };
    this.name = 'clear';
    this.blend = 1;
    this.timer = 60 + this.rng() * 90;
    this.lightning = 0;
    this.lightningCd = 6;
    ctx.wind = { dir: new THREE.Vector2(0.72, 0.69), strength: 0.35, time: 0 };
    this._buildRain();
    this._buildSnow();
    this._v = new THREE.Vector3();
  }

  _buildRain() {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(RAIN_N * 2 * 3);
    this.rainP = new Float32Array(RAIN_N * 3);
    for (let i = 0; i < RAIN_N; i++) this._resetRain(i, true);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.rainGeo = g; this.rainPos = pos;
    this.rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({
      color: 0xbcd6ea, transparent: true, opacity: 0.0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    this.rain.frustumCulled = false; this.rain.visible = false;
    this.ctx.scene.add(this.rain);
  }
  _resetRain(i, init = false) {
    const c = this.ctx.camera.position;
    const i3 = i * 3;
    this.rainP[i3] = (this.rng() - 0.5) * 46 + (init ? 0 : c.x);
    this.rainP[i3 + 1] = c.y + (init ? this.rng() * 26 : 14 + this.rng() * 12);
    this.rainP[i3 + 2] = (this.rng() - 0.5) * 46 + (init ? 0 : c.z);
  }

  _buildSnow() {
    const g = new THREE.BufferGeometry();
    this.snowP = new Float32Array(SNOW_N * 3);
    const size = new Float32Array(SNOW_N);
    this.snowPhase = new Float32Array(SNOW_N);
    for (let i = 0; i < SNOW_N; i++) {
      this.snowP[i * 3] = (this.rng() - 0.5) * 44;
      this.snowP[i * 3 + 1] = this.rng() * 26;
      this.snowP[i * 3 + 2] = (this.rng() - 0.5) * 44;
      size[i] = 0.05 + this.rng() * 0.11;
      this.snowPhase[i] = this.rng() * 6.28;
    }
    g.setAttribute('position', new THREE.BufferAttribute(this.snowP, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.snowGeo = g;
    this.snow = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTex: { value: makeGlowTexture(32, 1.6) }, uOpacity: { value: 0 } },
      vertexShader: `attribute float aSize; varying float vS;
        void main(){ vS = aSize; vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = max(1.0, aSize * 620.0 / max(0.001, -mv.z));
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D uTex; uniform float uOpacity; varying float vS;
        void main(){ if (uOpacity <= 0.002) discard;
          gl_FragColor = vec4(0.93,0.96,1.0,1.0) * texture2D(uTex, gl_PointCoord).a * uOpacity; }`,
    }));
    this.snow.frustumCulled = false; this.snow.visible = false;
    this.ctx.scene.add(this.snow);
  }

  set(name, transition = 12) {
    if (!PRESETS[name] || name === this.name) return;
    this.name = name;
    this.from = { ...this.cur };
    this.target = { ...PRESETS[name] };
    this.blend = 0;
    this.transition = Math.max(0.5, transition);
    this.ctx.events.emit('weather:change', { name, label: PRESETS[name].name });
  }

  _autoPick() {
    const p = this.ctx.player?.position ?? new THREE.Vector3();
    const reg = regionAt(p.x, p.z);
    const snowy = reg?.id === 'dragonspine' || p.y > 155;
    const r = this.rng();
    if (snowy) return r < 0.42 ? 'snow' : r < 0.62 ? 'blizzard' : r < 0.8 ? 'overcast' : 'clear';
    if (reg?.id === 'stormbearer') return r < 0.3 ? 'mist' : r < 0.55 ? 'overcast' : r < 0.75 ? 'rain' : 'cloudy';
    if (reg?.id === 'lake') return r < 0.45 ? 'clear' : r < 0.7 ? 'cloudy' : r < 0.85 ? 'mist' : 'rain';
    return r < 0.44 ? 'clear' : r < 0.66 ? 'cloudy' : r < 0.80 ? 'overcast' : r < 0.92 ? 'rain' : 'storm';
  }

  update(dt) {
    const ctx = this.ctx;
    const sky = ctx.sky;
    if (!sky) return;

    // ---- auto weather ----
    this.timer -= dt;
    if (this.timer <= 0) { this.timer = 100 + this.rng() * 140; this.set(this._autoPick(), 14); }
    // force snow high up
    const p = ctx.player?.position;
    if (p && p.y > 165 && this.name !== 'snow' && this.name !== 'blizzard') this.set('snow', 8);

    if (this.blend < 1) {
      this.blend = Math.min(1, this.blend + dt / this.transition);
      const k = this.blend * this.blend * (3 - 2 * this.blend);
      for (const key of ['cover', 'cloudOp', 'sun', 'fog', 'rate', 'wind', 'sat'])
        this.cur[key] = lerp(this.from[key], this.target[key], k);
      this.cur.particles = this.blend > 0.5 ? this.target.particles : this.from.particles;
    }

    // ---- apply to the sky / lighting (runs after SkySystem.update) ----
    // Overcast skies dim the sun but act as a huge area light: compensate with ambient,
    // otherwise bad weather reads as "night at noon".
    const dim = 1 - this.cur.sun;
    sky.sun.intensity *= this.cur.sun;
    sky.hemi.intensity *= lerp(1.0, 2.05, dim);
    sky.ambient.intensity *= lerp(1.0, 2.2, dim);
    ctx.scene.environmentIntensity *= lerp(1.0, 1.45, dim);
    ctx.scene.fog.density *= this.cur.fog;
    if (this.cur.fog > 1.4) ctx.scene.fog.color.lerp(new THREE.Color(0x9aa6b4), clamp((this.cur.fog - 1.4) * 0.32, 0, 0.55));
    for (const m of [sky.cloudMat, sky.cloudMat2]) {
      if (!m) continue;
      m.uniforms.uCover.value = this.cur.cover + (m === sky.cloudMat2 ? 0.14 : 0);
      m.uniforms.uOpacity.value = this.cur.cloudOp * (m === sky.cloudMat2 ? 0.62 : 1);
    }
    if (ctx.fx) ctx.fx.uSat.value = lerp(ctx.fx.uSat.value, this.cur.sat * 0.90, dt * 1.5);

    // ---- wind ----
    const w = ctx.wind;
    w.time += dt;
    w.strength = damp(w.strength, this.cur.wind, 1.2, dt);
    const ang = Math.sin(w.time * 0.05) * 0.7 + 0.8;
    w.dir.set(Math.cos(ang), Math.sin(ang));

    // ---- lightning during storms ----
    if (this.name === 'storm') {
      this.lightningCd -= dt;
      if (this.lightningCd <= 0) {
        this.lightningCd = 4 + this.rng() * 11;
        this.lightning = 1;
        ctx.audio?.sfx?.('dragon_roar', { vol: 0.25, rate: 0.6 });
      }
    }
    if (this.lightning > 0) {
      this.lightning = Math.max(0, this.lightning - dt * 3.2);
      const f = this.lightning * (0.5 + 0.5 * Math.sin(this.lightning * 40));
      sky.sun.intensity += f * 4.5;
      sky.hemi.intensity += f * 1.4;
    }

    this._updateParticles(dt);
  }

  _updateParticles(dt) {
    const ctx = this.ctx, cam = ctx.camera.position;
    const wind = ctx.wind;
    const type = this.cur.particles, rate = this.cur.rate;

    // rain
    const rainOn = type === 'rain' && rate > 0.02;
    this.rain.visible = rainOn;
    if (rainOn) {
      this.rain.material.opacity = 0.42 * rate;
      const active = Math.floor(RAIN_N * clamp(rate, 0.1, 1));
      const vx = wind.dir.x * wind.strength * 7, vz = wind.dir.y * wind.strength * 7;
      for (let i = 0; i < active; i++) {
        const i3 = i * 3;
        this.rainP[i3] += vx * dt;
        this.rainP[i3 + 1] -= 34 * dt;
        this.rainP[i3 + 2] += vz * dt;
        if (this.rainP[i3 + 1] < cam.y - 12 ||
            Math.abs(this.rainP[i3] - cam.x) > 26 || Math.abs(this.rainP[i3 + 2] - cam.z) > 26) this._resetRain(i);
        const p6 = i * 6;
        this.rainPos[p6] = this.rainP[i3]; this.rainPos[p6 + 1] = this.rainP[i3 + 1]; this.rainPos[p6 + 2] = this.rainP[i3 + 2];
        this.rainPos[p6 + 3] = this.rainP[i3] + vx * 0.028;
        this.rainPos[p6 + 4] = this.rainP[i3 + 1] - 0.95;
        this.rainPos[p6 + 5] = this.rainP[i3 + 2] + vz * 0.028;
      }
      this.rainGeo.setDrawRange(0, active * 2);
      this.rainGeo.attributes.position.needsUpdate = true;
    }

    // snow
    const snowOn = type === 'snow' && rate > 0.02;
    this.snow.visible = snowOn;
    if (snowOn) {
      this.snow.material.uniforms.uOpacity.value = 0.85 * rate;
      const active = Math.floor(SNOW_N * clamp(rate, 0.1, 1));
      const t = ctx.time.elapsed;
      for (let i = 0; i < active; i++) {
        const i3 = i * 3;
        this.snowP[i3] += (wind.dir.x * wind.strength * 3.2 + Math.sin(t * 1.4 + this.snowPhase[i]) * 0.8) * dt;
        this.snowP[i3 + 1] -= (1.6 + wind.strength * 1.4) * dt;
        this.snowP[i3 + 2] += (wind.dir.y * wind.strength * 3.2 + Math.cos(t * 1.1 + this.snowPhase[i]) * 0.8) * dt;
        if (this.snowP[i3 + 1] < cam.y - 14) this.snowP[i3 + 1] = cam.y + 20;
        if (Math.abs(this.snowP[i3] - cam.x) > 24) this.snowP[i3] = cam.x + (this.snowP[i3] > cam.x ? -24 : 24);
        if (Math.abs(this.snowP[i3 + 2] - cam.z) > 24) this.snowP[i3 + 2] = cam.z + (this.snowP[i3 + 2] > cam.z ? -24 : 24);
      }
      this.snowGeo.setDrawRange(0, active);
      this.snowGeo.attributes.position.needsUpdate = true;
    }
  }
}
