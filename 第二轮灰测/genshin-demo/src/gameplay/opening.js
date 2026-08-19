// Prologue: studio card -> title vista (real world flythrough) -> Genshin-style opening
// cinematic (cloud sea / the Sustainer stops the twins / the long fall / waking on the shore)
// -> hands control to the player.
//
// Everything here is engine-driven: camera moves, staged characters, particles and subtitles.
import * as THREE from 'three';
import { ease, clamp, lerp, smoothstep } from '../core/utils.js';
import { height, WORLD, REGIONS, slopeAt } from '../world/heightfield.js';
import { makeGlowTexture } from '../core/textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const wait = (ms) => new Promise(r => setTimeout(r, ms));

/** Title-screen vista shots, authored around real landmarks. */
function buildVistaShots() {
  const R = id => REGIONS.find(r => r.id === id);
  const lake = R('lake'), tree = R('windrise'), town = R('mondstadt'), snow = R('dragonspine');
  const g = (x, z, up = 0) => V(x, height(x, z) + up, z);
  return [
    { from: g(lake.x + 210, lake.z + 230, 34), to: g(lake.x - 30, lake.z + 20, 16),
      lookFrom: g(lake.x, lake.z, 8), lookTo: g(lake.x - 170, lake.z - 140, 26),
      dur: 15, fovFrom: 42, fovTo: 50, ease: ease.inOutSine },
    { from: g(tree.x + 70, tree.z + 84, 6), to: g(tree.x + 22, tree.z + 30, 62),
      lookFrom: g(tree.x, tree.z, 18), lookTo: g(tree.x, tree.z, 36),
      dur: 14, fovFrom: 50, fovTo: 40, ease: ease.inOutCubic },
    { from: g(town.x + 132, town.z + 126, 52), to: g(town.x - 124, town.z + 104, 42),
      lookFrom: g(town.x, town.z, 14), lookTo: g(town.x, town.z, 16),
      dur: 16, fovFrom: 42, fovTo: 46, ease: ease.inOutSine },
    { from: g(snow.x + 330, snow.z + 350, 110), to: g(snow.x + 160, snow.z + 200, 170),
      lookFrom: g(snow.x, snow.z, 130), lookTo: g(snow.x, snow.z, 160),
      dur: 15, fovFrom: 46, fovTo: 38, ease: ease.inOutSine },
  ];
}

export class Opening {
  constructor(ctx) {
    this.ctx = ctx;
    this.active = false;
    this.stage = null;
    this.idx = 0;
  }

  // ---------------------------------------------------------------- title vista
  start() {
    const ctx = this.ctx;
    this.active = true;
    this.shots = buildVistaShots();
    this.idx = 0;
    this._prevTod = ctx.sky.timeOfDay;
    ctx.sky.setTimeOfDay(6.7);
    ctx.weather?.set('clear', 0.1);
    ctx.player.root.visible = false;
    if (ctx.player.paimon) ctx.player.paimon.root.visible = false;
    ctx.player.setControlEnabled(false);
    ctx.ui?.hud?.hide?.();
    ctx.audio?.music?.('title', { fade: 2.5 });
    this._nextVista();
  }

  _nextVista() {
    if (!this.active || this.prologueRunning) return;
    const s = this.shots[this.idx % this.shots.length];
    this.idx++;
    this.ctx.terrain?.preload(s.to.x, s.to.z, 2);
    this.ctx.camera3.playCinematic(s).then(() => this._nextVista());
  }

  // ---------------------------------------------------------------- prologue stage
  /** A cloud sea high above the world, two travellers, a divine light and wind streaks. */
  _buildStage() {
    const ctx = this.ctx;
    const st = { group: new THREE.Group(), y: 1500, objs: [] };
    st.group.name = 'prologue-stage';
    ctx.scene.add(st.group);

    // --- cloud sea: reuse the sky's cloud shader, made dense and bright ---
    if (ctx.sky?.cloudMat) {
      const m = ctx.sky.cloudMat.clone();
      m.uniforms.uCover.value = 0.16;
      m.uniforms.uOpacity.value = 1.0;
      m.uniforms.uScale.value = 0.75;
      m.depthWrite = false;
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000, 1, 1), m);
      sea.rotation.x = -Math.PI / 2;
      sea.position.set(0, st.y - 90, 0);
      sea.frustumCulled = false;
      st.group.add(sea); st.objs.push(sea); st.seaMat = m;

      const m2 = ctx.sky.cloudMat.clone();
      m2.uniforms.uCover.value = 0.42;
      m2.uniforms.uOpacity.value = 0.75;
      m2.uniforms.uScale.value = 1.8;
      const sea2 = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000, 1, 1), m2);
      sea2.rotation.x = -Math.PI / 2;
      sea2.position.set(0, st.y + 120, 0);
      sea2.frustumCulled = false;
      st.group.add(sea2); st.objs.push(sea2); st.sea2Mat = m2;
    }

    // --- the twins ---
    const mk = (id) => {
      try { return ctx.characters?.createCharacter?.(ctx, id, {}); } catch { return null; }
    };
    st.lumine = mk('lumine');
    st.aether = mk('aether');
    for (const ch of [st.lumine, st.aether]) {
      if (!ch) continue;
      st.group.add(ch.root);
      ch.root.traverse(o => { if (o.isMesh || o.isSkinnedMesh) o.castShadow = false; });
      try { ch.anim.play('glide', { loop: true, fade: 0 }); } catch {}
    }
    if (st.lumine) { st.lumine.root.position.set(-1.5, st.y, 0); st.lumine.root.rotation.y = Math.PI * 0.92; }
    if (st.aether) { st.aether.root.position.set(1.5, st.y + 0.3, 0.6); st.aether.root.rotation.y = Math.PI * 1.08; }

    // --- divine light: a bright core + expanding golden ring ---
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 3),
      new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    core.position.set(0, st.y + 6, -46);
    st.group.add(core); st.core = core;

    const ringTex = makeGlowTexture(128, 2.2, '#ffe9a8');
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, color: 0xffe6a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    halo.position.copy(core.position);
    halo.scale.setScalar(30);
    st.group.add(halo); st.halo = halo;

    // --- golden lattice that seals the sibling ---
    const cage = new THREE.Group();
    const barMat = new THREE.MeshBasicMaterial({ color: 0xffd873, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 3.2, 0.05), barMat);
      bar.position.set(Math.cos(a) * 0.85, 0.9, Math.sin(a) * 0.85);
      cage.add(bar);
    }
    for (const yy of [0.05, 0.9, 1.75]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.025, 6, 24), barMat);
      ring.rotation.x = Math.PI / 2; ring.position.y = yy; cage.add(ring);
    }
    cage.visible = false;
    st.group.add(cage); st.cage = cage; st.cageMat = barMat;

    // --- wind streaks for the fall ---
    const N = 900;
    const pos = new Float32Array(N * 2 * 3);
    st.streakData = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 26;
      st.streakData[i * 3] = Math.cos(a) * r;
      st.streakData[i * 3 + 1] = (Math.random() - 0.5) * 90;
      st.streakData[i * 3 + 2] = Math.sin(a) * r;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    st.streaks = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({
      color: 0xdff0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    st.streaks.frustumCulled = false;
    st.streakPos = pos; st.streakN = N;
    ctx.scene.add(st.streaks);

    this.stage = st;
    return st;
  }

  _disposeStage() {
    const st = this.stage; if (!st) return;
    this.ctx.scene.remove(st.group);
    this.ctx.scene.remove(st.streaks);
    for (const ch of [st.lumine, st.aether]) { try { ch?.dispose?.(); } catch {} }
    st.group.traverse(o => { if (o.geometry) o.geometry.dispose?.(); });
    st.streaks.geometry.dispose();
    this.stage = null;
  }

  /** Per-frame stage animation, driven from the main loop while the prologue plays. */
  update(dt) {
    const st = this.stage; if (!st) return;
    const t = this.ctx.time.elapsed;
    if (st.seaMat) st.seaMat.uniforms.uTime.value += dt * 6;
    if (st.sea2Mat) st.sea2Mat.uniforms.uTime.value += dt * 9;
    for (const ch of [st.lumine, st.aether]) { try { ch?.update(dt); } catch {} }
    if (st.lumine) st.lumine.root.position.y = st.y + Math.sin(t * 0.9) * 0.22;
    if (st.aether && !st.aetherTaken) st.aether.root.position.y = st.y + 0.3 + Math.sin(t * 0.9 + 1.4) * 0.22;
    if (st.core.material.opacity > 0.001) {
      st.core.rotation.y += dt * 0.6;
      st.core.scale.setScalar(1 + Math.sin(t * 6) * 0.04);
    }
    if (st.cage.visible) st.cage.rotation.y += dt * 1.6;
    // wind streaks follow the camera and scroll upward fast
    if (st.streaks.material.opacity > 0.002) {
      const cam = this.ctx.camera.position;
      const sp = st.fallSpeed ?? 60;
      for (let i = 0; i < st.streakN; i++) {
        const i3 = i * 3;
        st.streakData[i3 + 1] += sp * dt;
        if (st.streakData[i3 + 1] > 45) st.streakData[i3 + 1] -= 90;
        const p6 = i * 6;
        const x = cam.x + st.streakData[i3], y = cam.y + st.streakData[i3 + 1], z = cam.z + st.streakData[i3 + 2];
        st.streakPos[p6] = x; st.streakPos[p6 + 1] = y; st.streakPos[p6 + 2] = z;
        st.streakPos[p6 + 3] = x; st.streakPos[p6 + 4] = y - 2.4 - sp * 0.05; st.streakPos[p6 + 5] = z;
      }
      st.streaks.geometry.attributes.position.needsUpdate = true;
    }
  }

  _tween(ms, fn, easing = ease.inOutSine) {
    return new Promise(resolve => {
      const t0 = performance.now();
      const step = () => {
        const k = clamp((performance.now() - t0) / ms, 0, 1);
        try { fn(easing(k), k); } catch (e) { console.warn('[prologue tween]', e); }
        if (k < 1) requestAnimationFrame(step); else resolve();
      };
      step();
    });
  }

  _say(text, ms = 3200) { this.ctx.ui?.subtitle?.(text, ms); }

  // ---------------------------------------------------------------- the cinematic
  async playPrologue() {
    const ctx = this.ctx;
    this.prologueRunning = true;
    const cam = ctx.camera3;
    const fx = ctx.fx;

    // white flash out of the title screen, then reveal the cloud sea
    fx.uFadeColor.value.setRGB(1, 1, 1);
    await this._tween(700, k => { fx.uFade.value = k; fx.uRadial.value = k * 1.6; }, ease.inCubic);

    const st = this._buildStage();
    ctx.ui?.cinematic?.(true);
    ctx.sky.setTimeOfDay(6.2);
    ctx.audio?.music?.('emotional', { fade: 2.0 });

    const Y = st.y;
    cam.mode = 'cinematic';
    cam.cinematic = null;
    ctx.camera.position.set(-14, Y + 6, 26);
    ctx.camera.lookAt(0, Y, 0);

    await this._tween(900, k => { fx.uFade.value = 1 - k; fx.uRadial.value = (1 - k) * 1.6; }, ease.outCubic);
    fx.uFade.value = 0; fx.uRadial.value = 0;

    // ---- shot 1: the twins above the clouds ----
    this._say('我们是从异世界来的旅行者。', 4200);
    await cam.playCinematic({
      from: V(-16, Y + 7, 30), to: V(-6.5, Y + 2.4, 12),
      lookFrom: V(0, Y + 0.6, 0), lookTo: V(0, Y + 0.9, -6),
      dur: 5.2, fovFrom: 46, fovTo: 40, ease: ease.inOutSine,
    });

    // ---- shot 2: something ahead ----
    this._say('就在即将离开这个世界的时候——', 3600);
    st.core.material.opacity = 0.0;
    cam.playCinematic({
      from: V(-6.5, Y + 2.4, 12), to: V(-2.2, Y + 1.8, 7.5),
      lookFrom: V(0, Y + 0.9, -6), lookTo: V(0, Y + 4.0, -40),
      dur: 4.0, fovFrom: 40, fovTo: 34, ease: ease.inOutCubic,
    });
    await this._tween(2600, k => {
      st.core.material.opacity = k * 0.95;
      st.halo.material.opacity = k * 0.55;
      st.core.scale.setScalar(1 + k * 7);
      st.halo.scale.setScalar(30 + k * 90);
    }, ease.inCubic);

    // ---- shot 3: the Sustainer seals the sibling ----
    this._say('一位陌生的神明，拦下了我们。', 3400);
    ctx.fx3d?.shake(1.2, 0.5);
    ctx.audio?.sfx?.('burst');
    await this._tween(420, k => { fx.uFade.value = k * 0.92; }, ease.inCubic);
    st.cage.visible = true;
    if (st.aether) st.cage.position.copy(st.aether.root.position);
    await this._tween(520, k => { fx.uFade.value = (1 - k) * 0.92; st.cageMat.opacity = k; }, ease.outCubic);
    fx.uFade.value = 0;

    this._say('我的同伴被夺走了。', 3000);
    st.aetherTaken = true;
    if (st.aether) { try { st.aether.anim.play('hit', { loop: false, fade: 0.1 }); } catch {} }
    await this._tween(1800, (k) => {
      const y = Y + 0.3 + k * 130;
      if (st.aether) { st.aether.root.position.y = y; st.aether.root.scale.setScalar(1 - k * 0.55); }
      st.cage.position.y = y; st.cageMat.opacity = 1 - k;
      st.core.material.opacity = 0.95 * (1 - k * 0.7);
      st.halo.material.opacity = 0.55 * (1 - k);
    }, ease.inCubic);
    if (st.aether) st.aether.root.visible = false;

    // ---- shot 4: the long fall ----
    this._say('而我，坠落在了提瓦特。', 3600);
    if (st.lumine) { try { st.lumine.anim.play('fall', { loop: true, fade: 0.25 }); } catch {} }
    st.streaks.material.opacity = 0.0;
    st.fallSpeed = 40;
    ctx.audio?.sfx?.('wind_gust', { vol: 0.9 });

    const fallDur = 5200;
    const camStart = ctx.camera.position.clone();
    await this._tween(fallDur, (kk, kRaw) => {
      const k = kRaw;
      st.fallSpeed = 40 + k * 190;
      st.streaks.material.opacity = smoothstep(0.05, 0.35, k) * 0.55 * (1 - smoothstep(0.85, 1, k));
      fx.uRadial.value = smoothstep(0.1, 0.7, k) * 2.0;
      const drop = ease.inCubic(k) * 1000;
      if (st.lumine) {
        st.lumine.root.position.y = Y - drop;
        st.lumine.root.rotation.y += 0.012;
        st.lumine.root.rotation.z = Math.sin(k * 9) * 0.22;
      }
      ctx.camera.position.set(
        camStart.x + Math.sin(k * 5.2) * 2.6,
        Y - drop + lerp(2.2, 0.6, k),
        camStart.z + lerp(6.5, 3.4, k) + Math.cos(k * 4.1) * 1.4);
      if (st.lumine) ctx.camera.lookAt(st.lumine.root.position.x, st.lumine.root.position.y + 0.9, st.lumine.root.position.z);
      ctx.camera.fov = lerp(40, 62, ease.inCubic(k));
      ctx.camera.updateProjectionMatrix();
      // the cloud sea rushes past
      if (st.seaMat) st.seaMat.uniforms.uTime.value += 0.05;
    }, k => k);

    // ---- impact: white out ----
    ctx.fx3d?.shake(1.6, 0.6);
    ctx.audio?.sfx?.('land', { vol: 1.2 });
    fx.uFadeColor.value.setRGB(1, 1, 1);
    await this._tween(420, k => { fx.uFade.value = k; fx.uRadial.value = 2.0 * (1 - k * 0.4); }, ease.inCubic);

    // ---- shot 5: waking up on the southern shore ----
    this._disposeStage();
    ctx.ui?.cinematic?.(true);
    const p = ctx.player;
    p.root.visible = true;
    if (p.paimon) p.paimon.root.visible = false;
    ctx.sky.setTimeOfDay(6.9);
    ctx.terrain?.preload(p.position.x, p.position.z, 3);
    ctx.tasks.run(80);
    try { p.character.anim.play('sit', { loop: false, fade: 0 }); } catch {}
    ctx.audio?.ambience?.('lake');

    const feet = p.position.clone();
    ctx.camera.position.set(feet.x + 1.4, feet.y + 0.35, feet.z + 2.2);
    ctx.camera.lookAt(feet.x, feet.y + 0.5, feet.z);
    ctx.camera.fov = 40; ctx.camera.updateProjectionMatrix();
    await this._tween(1500, k => { fx.uFade.value = 1 - k; fx.uRadial.value = (1 - k) * 0.8; }, ease.outCubic);
    fx.uFade.value = 0; fx.uRadial.value = 0;

    this._say('……七百年后。', 3000);
    await cam.playCinematic({
      from: V(feet.x + 1.4, feet.y + 0.35, feet.z + 2.2), to: V(feet.x + 2.6, feet.y + 2.6, feet.z + 4.6),
      lookFrom: V(feet.x, feet.y + 0.5, feet.z), lookTo: V(feet.x, feet.y + 1.1, feet.z),
      dur: 4.2, fovFrom: 40, fovTo: 46, ease: ease.inOutSine,
    });
    try { p.character.anim.play('idle', { loop: true, fade: 0.5 }); } catch {}
    this._say('这里是提瓦特 —— 而我要找回我的同伴。', 4000);
    await wait(1200);

    // ---- hand over control ----
    this.active = false;
    this.prologueRunning = false;
    cam.mode = 'follow';
    cam.cinematic = null;
    cam.yaw = Math.atan2(-p.position.x, -p.position.z);
    cam.focus.copy(p.position);
    cam.update(0.016, p);
    if (p.paimon) p.paimon.root.visible = true;
    p.setControlEnabled(true);
    ctx.ui?.cinematic?.(false);
    ctx.ui?.hud?.show?.();
    ctx.sky.setTimeOfDay(7.6);
    ctx.audio?.music?.('field_day', { fade: 3 });
    ctx.events.emit('opening:done');
  }

  /** Fallback used if the prologue is skipped or fails. */
  async finish() {
    const ctx = this.ctx;
    if (!this.active && !this.prologueRunning) return;
    try { await this.playPrologue(); }
    catch (e) {
      console.warn('[prologue]', e);
      this._disposeStage();
      this.active = false; this.prologueRunning = false;
      const p = ctx.player;
      ctx.camera3.mode = 'follow'; ctx.camera3.cinematic = null;
      p.root.visible = true; if (p.paimon) p.paimon.root.visible = true;
      p.setControlEnabled(true);
      ctx.fx.uFade.value = 0; ctx.fx.uRadial.value = 0;
      ctx.ui?.cinematic?.(false); ctx.ui?.hud?.show?.();
      ctx.sky.setTimeOfDay(7.6);
      ctx.events.emit('opening:done');
    }
  }
}
