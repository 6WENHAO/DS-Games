/* ============================================================
 * env.js — 三套与歌曲意境匹配的动态关卡环境
 *   neon  赛博霓虹之城（网格地面/霓虹楼宇/光环隧道/激光）
 *   ink   水墨夜山（明月/群山剪影/灯河/花瓣/雾霭）
 *   space 深空星云（星海/星云/行星/陨石/跃迁流光）
 * ============================================================ */
"use strict";

function canvasTex(w, h, fn) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  fn(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

class BaseEnv {
  constructor(scene, colorL, colorR) {
    this.scene = scene;
    this.colorL = colorL; this.colorR = colorR;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.pulse = 0;
  }
  onBeat(i) { this.pulse = 1; }
  update(dt, t) { this.pulse *= Math.exp(-dt * 4.5); }
  dispose() {
    this.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
      }
    });
    this.scene.remove(this.group);
  }
}

/* ================= 赛博霓虹 ================= */
class NeonEnv extends BaseEnv {
  constructor(scene, cl, cr) {
    super(scene, cl, cr);
    scene.background = new THREE.Color(0x030309);
    scene.fog = new THREE.Fog(0x05030f, 25, 190);

    // 网格地面
    this.gridTex = canvasTex(256, 256, (g) => {
      g.fillStyle = "#060310"; g.fillRect(0, 0, 256, 256);
      g.strokeStyle = "rgba(255,43,208,0.85)"; g.lineWidth = 3;
      for (let i = 0; i <= 4; i++) {
        g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 256); g.stroke();
        g.beginPath(); g.moveTo(0, i * 64); g.lineTo(256, i * 64); g.stroke();
      }
      g.strokeStyle = "rgba(0,229,255,0.5)"; g.lineWidth = 1;
      for (let i = 0; i <= 8; i++) {
        g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, 256); g.stroke();
        g.beginPath(); g.moveTo(0, i * 32); g.lineTo(256, i * 32); g.stroke();
      }
    });
    this.gridTex.wrapS = this.gridTex.wrapT = THREE.RepeatWrapping;
    this.gridTex.repeat.set(10, 40);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 500),
      new THREE.MeshBasicMaterial({ map: this.gridTex })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -180);
    this.group.add(floor);

    // 赛道光带
    this.strips = [];
    [[-1.6, cl], [1.6, cr]].forEach(([x, c]) => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.02, 400),
        new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      m.position.set(x, 0.02, -160);
      this.group.add(m); this.strips.push(m.material);
    });

    // 霓虹楼宇
    this.edges = [];
    const darkMat = new THREE.MeshBasicMaterial({ color: 0x05060d });
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 16; i++) {
        const w = 2 + Math.random() * 2.5, hgt = 5 + Math.random() * 13;
        const geo = new THREE.BoxGeometry(w, hgt, w);
        const box = new THREE.Mesh(geo, darkMat);
        box.position.set(side * (8 + Math.random() * 10), hgt / 2, -12 - i * 10 - Math.random() * 5);
        this.group.add(box);
        const c = (i % 2 === 0) ? cl : cr;
        const lm = new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.9 });
        const lines = new THREE.LineSegments(new THREE.EdgesGeometry(geo), lm);
        lines.position.copy(box.position);
        this.group.add(lines);
        this.edges.push({ m: lm, base: new THREE.Color(c) });
      }
    }

    // 光环隧道
    this.rings = [];
    for (let i = 0; i < 9; i++) {
      const c = i % 2 === 0 ? cl : cr;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(5.5, 0.09, 8, 48),
        new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      ring.position.set(0, 2.2, -12 - i * 14);
      this.group.add(ring); this.rings.push(ring);
    }

    // 合成波落日
    const sunTex = canvasTex(512, 512, (g) => {
      const gr = g.createLinearGradient(0, 60, 0, 460);
      gr.addColorStop(0, "#ffd76e"); gr.addColorStop(0.45, "#ff6ec7"); gr.addColorStop(1, "#7f2bff");
      g.fillStyle = gr;
      g.beginPath(); g.arc(256, 256, 200, 0, Math.PI * 2); g.fill();
      g.globalCompositeOperation = "destination-out";
      for (let i = 0; i < 7; i++) { g.fillRect(0, 280 + i * 26, 512, 6 + i * 2.2); }
    });
    const sun = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, depthWrite: false })
    );
    sun.position.set(0, 20, -186);
    this.group.add(sun);

    // 旋转激光
    this.lasers = [];
    for (let i = 0; i < 6; i++) {
      const c = i % 2 === 0 ? cl : cr;
      const l = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 70, 0.18),
        new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      l.position.set(-25 + i * 10, 0, -120 - (i % 3) * 15);
      this.group.add(l); this.lasers.push(l);
    }
  }
  update(dt, t) {
    super.update(dt, t);
    this.gridTex.offset.y -= dt * 1.35;
    this.rings.forEach((r, i) => {
      r.position.z += dt * 9;
      if (r.position.z > 3) r.position.z -= 126;
      r.rotation.z += dt * 0.25 * (i % 2 ? 1 : -1);
      const s = 1 + this.pulse * 0.13;
      r.scale.set(s, s, 1);
      r.material.opacity = 0.45 + this.pulse * 0.5;
    });
    this.lasers.forEach((l, i) => {
      l.rotation.z = Math.sin(t * 0.45 + i * 1.1) * 0.85;
      l.material.opacity = 0.3 + this.pulse * 0.45;
    });
    this.edges.forEach((e, i) => {
      const k = 0.55 + this.pulse * 0.45 + 0.1 * Math.sin(t * 2 + i);
      e.m.color.copy(e.base).multiplyScalar(k);
    });
    this.strips.forEach(m => m.opacity = 0.5 + this.pulse * 0.5);
  }
}

/* ================= 水墨夜山 ================= */
class InkEnv extends BaseEnv {
  constructor(scene, cl, cr) {
    super(scene, cl, cr);
    scene.background = new THREE.Color(0x0b0f18);
    scene.fog = new THREE.Fog(0x0b0f18, 28, 185);

    // 明月与月晕
    const moon = new THREE.Mesh(
      new THREE.CircleGeometry(9, 48),
      new THREE.MeshBasicMaterial({ color: 0xf6e7c1 })
    );
    moon.position.set(-16, 18, -150);
    this.group.add(moon);
    const haloTex = canvasTex(256, 256, (g) => {
      const gr = g.createRadialGradient(128, 128, 20, 128, 128, 128);
      gr.addColorStop(0, "rgba(255,240,200,0.9)");
      gr.addColorStop(0.4, "rgba(255,235,190,0.25)");
      gr.addColorStop(1, "rgba(255,230,180,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    });
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: haloTex, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    this.halo.scale.set(46, 46, 1);
    this.halo.position.copy(moon.position);
    this.group.add(this.halo);

    // 群山剪影（三层视差）
    const mkMountain = (color, seed, jag) => canvasTex(1024, 256, (g) => {
      g.clearRect(0, 0, 1024, 256);
      g.fillStyle = color;
      g.beginPath(); g.moveTo(0, 256);
      let y = 150 + Math.sin(seed) * 30;
      for (let x = 0; x <= 1024; x += 16) {
        y += (Math.sin(x * 0.013 + seed * 7) + Math.sin(x * 0.037 + seed * 3)) * jag;
        y = Math.max(40, Math.min(220, y));
        g.lineTo(x, y);
      }
      g.lineTo(1024, 256); g.closePath(); g.fill();
    });
    this.mountains = [];
    [["#0d1320", -170, 90, 1, 8], ["#121a2a", -125, 70, 2, 10], ["#182238", -85, 52, 3, 12]].forEach(([col, z, h, seed, jag], i) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(360, h),
        new THREE.MeshBasicMaterial({ map: mkMountain(col, seed, jag), transparent: true, depthWrite: false })
      );
      m.position.set(0, h * 0.35, z);
      this.group.add(m);
      this.mountains.push({ m, phase: i * 2.1, amp: 3 + i * 2 });
    });

    // 水面与月光倒影
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(420, 260),
      new THREE.MeshBasicMaterial({ color: 0x080c13 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -0.01, -120);
    this.group.add(water);
    const glintTex = canvasTex(64, 512, (g) => {
      const gr = g.createLinearGradient(0, 0, 64, 0);
      gr.addColorStop(0, "rgba(246,231,193,0)");
      gr.addColorStop(0.5, "rgba(246,231,193,0.8)");
      gr.addColorStop(1, "rgba(246,231,193,0)");
      g.fillStyle = gr;
      for (let y = 0; y < 512; y += 14) g.fillRect(0, y, 64, 7);
    });
    this.glint = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 120),
      new THREE.MeshBasicMaterial({ map: glintTex, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.glint.rotation.x = -Math.PI / 2;
    this.glint.position.set(-16, 0.02, -85);
    this.group.add(this.glint);

    // 灯河（升空的孔明灯）
    this.lanterns = [];
    const glowTex = canvasTex(128, 128, (g) => {
      const gr = g.createRadialGradient(64, 64, 6, 64, 64, 64);
      gr.addColorStop(0, "rgba(255,180,90,0.95)");
      gr.addColorStop(0.5, "rgba(255,140,60,0.3)");
      gr.addColorStop(1, "rgba(255,120,40,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    });
    for (let i = 0; i < 26; i++) {
      const grp = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.46, 0.34),
        new THREE.MeshBasicMaterial({ color: 0xffb060 })
      );
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false
      }));
      glow.scale.set(2.2, 2.2, 1);
      grp.add(body); grp.add(glow);
      const bx = (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 22);
      grp.position.set(bx, Math.random() * 16, -15 - Math.random() * 110);
      this.group.add(grp);
      this.lanterns.push({ grp, glow: glow.material, baseX: bx, speed: 0.35 + Math.random() * 0.5, phase: Math.random() * 6.28 });
    }

    // 飘落花瓣
    const petalTex = canvasTex(64, 64, (g) => {
      const gr = g.createRadialGradient(32, 32, 4, 32, 32, 30);
      gr.addColorStop(0, "rgba(255,190,205,1)");
      gr.addColorStop(1, "rgba(255,160,190,0)");
      g.fillStyle = gr;
      g.beginPath(); g.ellipse(32, 32, 26, 15, 0.8, 0, Math.PI * 2); g.fill();
    });
    const N = 240;
    this.petalPos = new Float32Array(N * 3);
    this.petalPhase = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      this.petalPos[i * 3] = (Math.random() - 0.5) * 56;
      this.petalPos[i * 3 + 1] = Math.random() * 18;
      this.petalPos[i * 3 + 2] = -3 - Math.random() * 120;
      this.petalPhase[i] = Math.random() * 6.28;
    }
    this.petalGeo = new THREE.BufferGeometry();
    this.petalGeo.setAttribute("position", new THREE.BufferAttribute(this.petalPos, 3));
    const petals = new THREE.Points(this.petalGeo, new THREE.PointsMaterial({
      map: petalTex, size: 0.3, transparent: true, opacity: 0.85,
      color: 0xffc0cf, depthWrite: false
    }));
    this.group.add(petals);

    // 雾霭
    const mistTex = canvasTex(256, 64, (g) => {
      const gr = g.createRadialGradient(128, 32, 6, 128, 32, 128);
      gr.addColorStop(0, "rgba(200,215,235,0.5)");
      gr.addColorStop(1, "rgba(200,215,235,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 256, 64);
    });
    this.mists = [];
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(90, 16),
        new THREE.MeshBasicMaterial({ map: mistTex, transparent: true, opacity: 0.1, depthWrite: false })
      );
      m.position.set((Math.random() - 0.5) * 40, 2.5 + i * 1.2, -35 - i * 16);
      this.group.add(m);
      this.mists.push({ m, phase: i * 1.7 });
    }
  }
  update(dt, t) {
    super.update(dt, t);
    this.halo.material.opacity = 0.45 + this.pulse * 0.35 + 0.06 * Math.sin(t * 1.2);
    this.mountains.forEach(o => { o.m.position.x = Math.sin(t * 0.02 + o.phase) * o.amp; });
    this.glint.material.opacity = 0.22 + 0.08 * Math.sin(t * 2.6) + this.pulse * 0.2;
    this.lanterns.forEach(l => {
      l.grp.position.y += l.speed * dt;
      l.grp.position.x = l.baseX + Math.sin(t * 0.5 + l.phase) * 0.8;
      if (l.grp.position.y > 22) {
        l.grp.position.y = -1;
        l.baseX = (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 22);
        l.grp.position.z = -15 - Math.random() * 110;
      }
      l.glow.opacity = 0.5 + 0.25 * Math.sin(t * 2.2 + l.phase) + this.pulse * 0.3;
    });
    const p = this.petalPos;
    for (let i = 0; i < p.length / 3; i++) {
      p[i * 3 + 1] -= dt * (0.35 + 0.2 * Math.sin(this.petalPhase[i]));
      p[i * 3] += Math.sin(t * 0.9 + this.petalPhase[i]) * dt * 0.7;
      if (p[i * 3 + 1] < 0) p[i * 3 + 1] = 18;
    }
    this.petalGeo.attributes.position.needsUpdate = true;
    this.mists.forEach(o => {
      o.m.position.x += Math.sin(t * 0.05 + o.phase) * dt * 2;
      o.m.material.opacity = 0.07 + 0.04 * Math.sin(t * 0.4 + o.phase);
    });
  }
}

/* ================= 深空星云 ================= */
class SpaceEnv extends BaseEnv {
  constructor(scene, cl, cr) {
    super(scene, cl, cr);
    scene.background = new THREE.Color(0x02020a);
    scene.fog = null;

    // 星海
    const N = 2200;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 70 + Math.random() * 280;
      const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 2 - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = Math.abs(r * Math.cos(ph)) * 0.7 - 10;
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th) - 40;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({
      color: 0xffffff, size: 0.8, transparent: true, opacity: 0.9, depthWrite: false
    }));
    this.group.add(this.stars);

    // 星云
    const mkNebula = (r, g2, b) => canvasTex(256, 256, (g) => {
      for (let i = 0; i < 3; i++) {
        const x = 80 + Math.random() * 96, y = 80 + Math.random() * 96;
        const gr = g.createRadialGradient(x, y, 10, x, y, 120);
        gr.addColorStop(0, `rgba(${r},${g2},${b},0.55)`);
        gr.addColorStop(1, `rgba(${r},${g2},${b},0)`);
        g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
      }
    });
    this.nebulas = [];
    [[112, 64, 255], [0, 184, 255], [255, 79, 216], [64, 255, 208]].forEach((c, i) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: mkNebula(c[0], c[1], c[2]), transparent: true, opacity: 0.3,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      const sc = 130 + Math.random() * 110;
      sp.scale.set(sc, sc, 1);
      sp.position.set(-140 + i * 95, 20 + Math.random() * 60, -300 - i * 25);
      this.group.add(sp);
      this.nebulas.push({ sp, phase: i * 1.9 });
    });

    // 带环行星
    const planetTex = canvasTex(256, 128, (g) => {
      const cols = ["#3a5db0", "#4a72cc", "#5d86d8", "#3d5292", "#6b96e0", "#334a85"];
      for (let y = 0; y < 128; y += 8) {
        g.fillStyle = cols[(y / 8) % cols.length | 0];
        g.fillRect(0, y, 256, 8);
      }
      g.fillStyle = "rgba(255,255,255,0.08)";
      for (let i = 0; i < 14; i++) g.fillRect(Math.random() * 256, Math.random() * 128, 40 + Math.random() * 60, 3);
    });
    this.planet = new THREE.Mesh(
      new THREE.SphereGeometry(15, 48, 32),
      new THREE.MeshBasicMaterial({ map: planetTex })
    );
    this.planet.position.set(30, 18, -170);
    this.group.add(this.planet);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(19, 30, 64),
      new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.3, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    ring.position.copy(this.planet.position);
    ring.rotation.x = 1.35; ring.rotation.y = -0.3;
    this.group.add(ring);

    // 漂浮陨石
    this.asteroids = [];
    for (let i = 0; i < 16; i++) {
      const a = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.5 + Math.random() * 1.3, 0),
        new THREE.MeshLambertMaterial({ color: 0x3a3a48 })
      );
      a.position.set(
        (Math.random() < 0.5 ? -1 : 1) * (7 + Math.random() * 24),
        1 + Math.random() * 14,
        -20 - Math.random() * 140
      );
      a.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      this.group.add(a);
      this.asteroids.push({ a, rs: (Math.random() - 0.5) * 1.2 });
    }

    // 跃迁流光
    this.streaks = [];
    for (let i = 0; i < 42; i++) {
      const c = [cl, cr, 0xffffff][i % 3];
      const len = 5 + Math.random() * 9;
      const s = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.05, len),
        new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      const ang = Math.random() * Math.PI * 2, rad = 5 + Math.random() * 13;
      s.position.set(Math.cos(ang) * rad, Math.sin(ang) * rad * 0.7 + 4, -Math.random() * 200);
      this.group.add(s);
      this.streaks.push(s);
    }

    // 赛道光带
    this.strips = [];
    [[-1.6, cl], [1.6, cr]].forEach(([x, c]) => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.02, 400),
        new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      m.position.set(x, 0.02, -160);
      this.group.add(m); this.strips.push(m.material);
    });
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 460),
      new THREE.MeshBasicMaterial({ color: 0x05050f, transparent: true, opacity: 0.85 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.02, -160);
    this.group.add(floor);

    // 彗星
    const cometTex = canvasTex(128, 128, (g) => {
      const gr = g.createRadialGradient(64, 64, 2, 64, 64, 60);
      gr.addColorStop(0, "rgba(255,255,255,1)");
      gr.addColorStop(0.3, "rgba(180,220,255,0.5)");
      gr.addColorStop(1, "rgba(150,200,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    });
    this.comet = new THREE.Sprite(new THREE.SpriteMaterial({
      map: cometTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    this.comet.scale.set(4, 4, 1);
    this.group.add(this.comet);
    this.cometT = 4;
  }
  update(dt, t) {
    super.update(dt, t);
    this.stars.rotation.y += dt * 0.006;
    this.stars.rotation.z += dt * 0.003;
    this.nebulas.forEach(o => {
      o.sp.material.rotation += dt * 0.02;
      o.sp.material.opacity = 0.24 + 0.08 * Math.sin(t * 0.3 + o.phase) + this.pulse * 0.12;
    });
    this.planet.rotation.y += dt * 0.04;
    this.asteroids.forEach(o => {
      o.a.rotation.x += dt * o.rs; o.a.rotation.y += dt * o.rs * 0.7;
      o.a.position.z += dt * 2.2;
      if (o.a.position.z > 6) o.a.position.z = -160;
    });
    const spd = 26 + this.pulse * 85;
    this.streaks.forEach(s => {
      s.position.z += spd * dt;
      if (s.position.z > 6) {
        const ang = Math.random() * Math.PI * 2, rad = 5 + Math.random() * 13;
        s.position.set(Math.cos(ang) * rad, Math.sin(ang) * rad * 0.7 + 4, -200);
      }
      s.material.opacity = 0.35 + this.pulse * 0.55;
    });
    this.strips.forEach(m => m.opacity = 0.45 + this.pulse * 0.5);
    // 彗星掠过
    this.cometT -= dt;
    if (this.cometT < 0) {
      this.cometT = 6 + Math.random() * 6;
      this.cometStart = { x: -80 + Math.random() * 40, y: 50 + Math.random() * 30 };
      this.cometLife = 2.2;
    }
    if (this.cometLife > 0) {
      this.cometLife -= dt;
      const k = 1 - this.cometLife / 2.2;
      this.comet.position.set(this.cometStart.x + k * 150, this.cometStart.y - k * 35, -220);
      this.comet.material.opacity = Math.sin(k * Math.PI) * 0.9;
    } else this.comet.material.opacity = 0;
  }
}

function createEnv(id, scene, colorL, colorR) {
  switch (id) {
    case "neon": return new NeonEnv(scene, colorL, colorR);
    case "ink": return new InkEnv(scene, colorL, colorR);
    case "space": return new SpaceEnv(scene, colorL, colorR);
  }
}
