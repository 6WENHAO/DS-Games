/* ===================================================================
   render.js — 每帧渲染编排
   顺序：不透明（关卡 → 敌人/肢块/道具）→ 混合（血迹/血雾/火焰/剑光）
        → 第一人称巨剑（关闭深度测试，永远在最前）→ 2D 叠加层
   =================================================================== */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const U = G.U, M4 = G.M4;

  const Render = {
    proj: M4.create(), view: M4.create(), vp: M4.create(),
    mbOpaque: null, mbBlend: null, mbSword: null,
    fx: null, fxc: null,
    lights: [],
    pops: [],          // 浮动伤害数字
    camX: 0, camY: 0, camZ: 0,
    right: [1, 0, 0], up: [0, 1, 0], fwd: [0, 0, -1],
    _v4: new Float32Array(4),
  };

  Render.init = function (fxCanvas) {
    Render.mbOpaque = new G.MeshB(90000);
    Render.mbBlend = new G.MeshB(60000);
    Render.mbSword = new G.MeshB(4000);
    Render.fx = fxCanvas;
    Render.fxc = fxCanvas.getContext('2d');
    Render.resizeFx();
  };

  Render.resizeFx = function () {
    const c = Render.fx;
    if (!c) return;
    const w = Math.max(320, c.clientWidth | 0), h = Math.max(200, c.clientHeight | 0);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  };

  /* --------------------------- 浮动文字 --------------------------- */
  Render.pop = function (x, y, z, text, kind) {
    Render.pops.push({
      x: x, y: y, z: z, text: text, kind: kind || 'dmg',
      life: kind === 'kill' ? 1.1 : 0.85, max: kind === 'kill' ? 1.1 : 0.85,
      vy: 1.5 + Math.random() * 0.7,
      ox: (Math.random() - 0.5) * 0.35,
    });
    if (Render.pops.length > 60) Render.pops.shift();
  };
  Render.updatePops = function (dt) {
    for (let i = Render.pops.length - 1; i >= 0; i--) {
      const p = Render.pops[i];
      p.life -= dt; p.y += p.vy * dt; p.vy -= 3.2 * dt;
      if (p.life <= 0) Render.pops.splice(i, 1);
    }
  };

  /* --------------------------- 主渲染 --------------------------- */
  Render.frame = function (st) {
    const GL = G.GL, Art = G.Art, Gore = G.Gore, Ent = G.Entities, P = G.Player;
    const map = st.map;
    if (!GL.ok || !map) return;
    const T = Art.T;

    /* --- 摄像机 --- */
    const shakeX = st.shakeX || 0, shakeY = st.shakeY || 0, shakeR = st.shakeR || 0;
    const camX = P.x + shakeX * 0.11;
    const camY = P.eyeY() + shakeY * 0.11;
    const camZ = P.z + shakeX * 0.07;
    const yaw = P.yaw + P.camKickX + shakeX * 0.012;
    const pitch = U.clamp(P.pitch + P.camKickY + shakeY * 0.012, -1.45, 1.45);
    const roll = P.camRoll + shakeR;
    Render.camX = camX; Render.camY = camY; Render.camZ = camZ;

    M4.perspective(Render.proj, P.fov * U.DEG, GL.aspect(), 0.045, 160);
    M4.view(Render.view, camX, camY, camZ, yaw, pitch, roll);
    M4.mul(Render.vp, Render.proj, Render.view);

    // 基向量（公告板用）
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const fx = U.fwdX(yaw) * cp, fy = sp, fz = U.fwdZ(yaw) * cp;
    const cr = Math.cos(roll), sr = Math.sin(roll);
    let rx = Math.cos(yaw), ry = 0, rz = Math.sin(yaw);
    let ux = (-fy) * rz - (-fz) * ry, uy = (-fz) * rx - (-fx) * rz, uz = (-fx) * ry - (-fy) * rx;
    if (roll !== 0) {   // 绕视线滚转
      const r2x = rx * cr + ux * sr, r2y = ry * cr + uy * sr, r2z = rz * cr + uz * sr;
      const u2x = ux * cr - rx * sr, u2y = uy * cr - ry * sr, u2z = uz * cr - rz * sr;
      rx = r2x; ry = r2y; rz = r2z; ux = u2x; uy = u2y; uz = u2z;
    }
    Render.right = [rx, ry, rz]; Render.up = [ux, uy, uz]; Render.fwd = [fx, fy, fz];

    /* --- 全局着色参数 --- */
    const th = map.theme;
    const berserk = P.berserk > 0 ? U.clamp(P.berserk / 1.5, 0, 1) : 0;
    const hurt = U.clamp01(P.hurtFlash);
    GL.beginFrame(th.fogCol);
    GL.setCamera(Render.vp, camX, camY, camZ);
    GL.setFog(th.fogCol, th.fog * (1 + berserk * 0.15));
    const torchBase = 1.42 + (P.wState === 'hvWind' ? P.charge * 0.45 : 0) + berserk * 0.30;
    GL.setTorch(torchBase * (1 + st.flash * 2.2), 0.058, th.ambient);
    GL.setGrade(hurt, berserk, 1 + st.flash * 0.5);

    /* --- 动态光源：取最近的 N 个 --- */
    const L = Render.lights; L.length = 0;
    const t = st.time;
    for (const ml of map.lights) {
      const d2 = U.dist2(ml.x, ml.z, camX, camZ);
      if (d2 > 400) continue;
      const fl = 0.80 + 0.20 * Math.sin(t * 8.3 + ml.flicker) + 0.08 * Math.sin(t * 21 + ml.flicker * 3);
      L.push({ x: ml.x, y: ml.y, z: ml.z, r: ml.r, g: ml.g, b: ml.b, i: ml.i * fl, d2: d2 });
    }
    // 传送门光
    if (map.exit.open) {
      const px = map.exit.x, pz = map.exit.z;
      L.push({
        x: px, y: map.floorAt(px, pz) + 1.3, z: pz, r: 1, g: 0.35, b: 0.2,
        i: 1.5 + Math.sin(t * 4) * 0.3, d2: U.dist2(px, pz, camX, camZ),
      });
    }
    // 投射物
    for (const b of Ent.bolts) {
      if (!b.alive) continue;
      L.push({ x: b.x, y: b.y, z: b.z, r: b.col[0], g: b.col[1], b: b.col[2], i: 0.7, d2: U.dist2(b.x, b.z, camX, camZ) });
    }
    // 蓄力 / 狂气：剑身自发光
    if (P.wState === 'hvWind' && P.charge > 0.1)
      L.push({ x: P.midX, y: P.midY, z: P.midZ, r: 1, g: 0.3, b: 0.15, i: P.charge * 1.6, d2: 0 });
    if (berserk > 0)
      L.push({ x: camX, y: camY, z: camZ, r: 1, g: 0.15, b: 0.1, i: 0.55 * berserk, d2: 0 });
    // 精英 / Boss 的眼光
    for (const e of Ent.list) {
      if (e.removeMe || !e.alive) continue;
      if (!e.elite && !e.boss) continue;
      L.push({
        x: e.x, y: e.y + e.height * 0.85, z: e.z, r: 1, g: 0.25, b: 0.12,
        i: e.boss ? 0.9 : 0.5, d2: U.dist2(e.x, e.z, camX, camZ),
      });
    }
    L.sort((a, b) => a.d2 - b.d2);
    L.length = Math.min(L.length, GL.MAXL);
    GL.setLights(L);

    /* --- 1) 静态关卡 --- */
    GL.blend(false);
    GL.depthWrite(true);
    GL.cull(true);
    if (st.levelMesh) GL.draw(st.levelMesh, null);

    /* --- 2) 不透明动态物 --- */
    const mb = Render.mbOpaque; mb.reset();
    const lightFn = (x, z) => map.lightAt(x, z);
    Ent.emit(mb, T, lightFn, camX, camZ, 46);
    Ent.emitItems(mb, T, lightFn);
    Gore.emitChunks(mb, T, lightFn);
    Ent.emitBolts(mb, T, rx, ry, rz, ux, uy, uz);
    if (mb.n) { GL.identity(); GL.drawDynamic(mb, null); }

    /* --- 3) 混合层 --- */
    const bb = Render.mbBlend; bb.reset();
    // 地面血迹
    Gore.emitDecals(bb, T, lightFn, camX, camZ, 30);
    if (bb.n) {
      GL.blend(true, false);
      GL.depthWrite(false);
      GL.cull(false);
      GL.drawDynamic(bb, null);
    }

    // 发光/加色：血雾、血滴、火焰、剑光、道具光
    bb.reset();
    Gore.emitDrops(bb, T, rx, ry, rz, ux, uy, uz, lightFn);
    Gore.emitMists(bb, T, rx, ry, rz, ux, uy, uz, lightFn);
    Ent.emitItemGlow(bb, T, rx, ry, rz, ux, uy, uz);
    emitFlames(bb, T, map, t, rx, ry, rz, ux, uy, uz);
    emitPortal(bb, T, map, t, rx, ry, rz, ux, uy, uz);
    P.emitTrail(bb, T);
    if (bb.n) {
      GL.blend(true, true);
      GL.depthWrite(false);
      GL.cull(false);
      GL.drawDynamic(bb, null);
    }

    /* --- 4) 第一人称巨剑 --- */
    const sw = Render.mbSword; sw.reset();
    P.emitSword(sw, T);
    if (sw.n) {
      GL.blend(false);
      GL.depthWrite(true);
      GL.cull(true);
      GL.depthTest(false);
      GL.setFog(th.fogCol, 0.004);
      GL.drawDynamic(sw, null);
      GL.depthTest(true);
      GL.setFog(th.fogCol, th.fog);
    }

    /* --- 5) 2D 叠加 --- */
    drawFx(st, P);
  };

  /* --------------------------- 火焰 / 传送门 --------------------------- */
  function emitFlames(mb, T, map, t, rx, ry, rz, ux, uy, uz) {
    const cx = Render.camX, cz = Render.camZ;
    for (const p of map.props) {
      if (p.kind !== 'brazier' && p.kind !== 'shrine') continue;
      const d2 = U.dist2(p.x, p.z, cx, cz);
      if (d2 > 620) continue;
      const isShrine = p.kind === 'shrine';
      const baseY = p.y + (isShrine ? 0.95 : 1.05);
      const n = isShrine ? 3 : 5;
      for (let i = 0; i < n; i++) {
        const ph = t * (3.4 + i * 0.7) + i * 2.1 + p.x;
        const sway = Math.sin(ph) * 0.055;
        const h = (isShrine ? 0.34 : 0.52) * (0.72 + 0.28 * Math.abs(Math.sin(ph * 1.7)));
        const y = baseY + i * (isShrine ? 0.1 : 0.14);
        const sz = (isShrine ? 0.3 : 0.42) * (1 - i / (n + 2));
        const col = isShrine ? [1.0, 0.25, 0.85] : [1.0, 0.55 + 0.2 * Math.sin(ph), 0.16];
        mb.billboard(p.x + sway, y + h * 0.5, p.z + Math.cos(ph * 0.8) * 0.04,
          sz, sz * 1.5, rx, ry, rz, ux, uy, uz, T.flame, col, 1.7, 1);
      }
      // 偶发火星
      if (Math.random() < 0.14) G.Gore.embers(p.x, baseY + 0.2, p.z, 1);
    }
  }

  function emitPortal(mb, T, map, t, rx, ry, rz, ux, uy, uz) {
    if (!map.exit.open) return;
    const x = map.exit.x, z = map.exit.z;
    const y = map.floorAt(x, z) + 1.3;
    const pulse = 1 + Math.sin(t * 3.1) * 0.06;
    for (let i = 0; i < 3; i++) {
      const s = (2.0 - i * 0.42) * pulse;
      mb.billboard(x, y, z, s, s, rx, ry, rz, ux, uy, uz, T.portal,
        [1, 0.42 - i * 0.08, 0.24], 1.5, 1);
    }
    mb.billboard(x, y, z, 1.1 * pulse, 1.1 * pulse, rx, ry, rz, ux, uy, uz, T.glow, [1, 0.6, 0.4], 1.6, 1);
    if (Math.random() < 0.5) G.Gore.embers(x + (Math.random() - 0.5), y - 1, z + (Math.random() - 0.5), 1);
  }

  /* --------------------------- 2D 叠加层 --------------------------- */
  function project(out, vp, x, y, z) {
    const w = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
    if (w <= 0.02) return false;
    const cx = vp[0] * x + vp[4] * y + vp[8] * z + vp[12];
    const cy = vp[1] * x + vp[5] * y + vp[9] * z + vp[13];
    out[0] = (cx / w * 0.5 + 0.5);
    out[1] = (1 - (cy / w * 0.5 + 0.5));
    out[2] = w;
    return true;
  }

  function drawFx(st, P) {
    const c = Render.fxc; if (!c) return;
    const W = Render.fx.width, H = Render.fx.height;
    c.clearRect(0, 0, W, H);

    /* 屏幕血污 */
    if (st.optBlood !== false) {
      const scr = G.Gore.screen;
      for (const s of scr) {
        const a = U.clamp01(s.life / s.maxLife) * s.a;
        const px = s.x * W, py = s.y * H, r = s.r * H;
        const g = c.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, 'rgba(96,4,6,' + (a * 0.92) + ')');
        g.addColorStop(0.55, 'rgba(64,2,4,' + (a * 0.7) + ')');
        g.addColorStop(1, 'rgba(40,0,2,0)');
        c.fillStyle = g;
        c.beginPath(); c.arc(px, py, r, 0, U.TAU); c.fill();
        // 拉丝
        c.fillStyle = 'rgba(70,2,4,' + (a * 0.5) + ')';
        c.fillRect(px - r * 0.16, py, r * 0.32, r * (1.2 + s.tile * 0.4));
      }
    }

    /* 受伤红闪 */
    if (P.hurtFlash > 0) {
      const a = U.clamp01(P.hurtFlash) * 0.42;
      const g = c.createRadialGradient(W / 2, H / 2, H * 0.22, W / 2, H / 2, H * 0.85);
      g.addColorStop(0, 'rgba(150,0,0,0)');
      g.addColorStop(1, 'rgba(150,0,0,' + a + ')');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    }

    /* 低血心跳暗角 */
    const hpFrac = P.hp / P.maxHp;
    if (hpFrac < 0.34 && !P.dead) {
      const pulse = 0.5 + 0.5 * Math.sin(st.time * 6.2);
      const a = (0.34 - hpFrac) * (0.55 + pulse * 0.45);
      const g = c.createRadialGradient(W / 2, H / 2, H * 0.16, W / 2, H / 2, H * 0.8);
      g.addColorStop(0, 'rgba(120,0,0,0)');
      g.addColorStop(1, 'rgba(120,0,0,' + U.clamp(a, 0, 0.7) + ')');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    }

    /* 狂气：血色边框 + 抖动线 */
    if (P.berserk > 0) {
      const a = 0.18 + 0.12 * Math.sin(st.time * 9);
      c.strokeStyle = 'rgba(190,20,10,' + a + ')';
      c.lineWidth = Math.max(6, H * 0.02);
      c.strokeRect(0, 0, W, H);
    }

    /* 浮动伤害数字 */
    const v = Render._v4;
    c.textAlign = 'center';
    for (const p of Render.pops) {
      if (!project(v, Render.vp, p.x + p.ox, p.y, p.z)) continue;
      const sx = v[0] * W, sy = v[1] * H;
      const fade = U.clamp01(p.life / p.max);
      const dist = v[2];
      const base = p.kind === 'kill' ? 30 : (p.kind === 'crit' ? 26 : 19);
      const size = U.clamp(base * (14 / (dist + 8)) * 1.5, 9, 42);
      c.font = 'bold ' + size.toFixed(0) + 'px "Zpix",SimSun,monospace';
      c.globalAlpha = fade;
      c.lineWidth = Math.max(2, size * 0.14);
      c.strokeStyle = 'rgba(0,0,0,0.85)';
      c.fillStyle = p.kind === 'kill' ? '#ff8a5a' : (p.kind === 'crit' ? '#ffd25a' : '#e9d8c0');
      c.strokeText(p.text, sx, sy);
      c.fillText(p.text, sx, sy);
      c.globalAlpha = 1;
    }

    /* Boss / 目标指示箭头 */
    if (st.marker) {
      const m = st.marker;
      if (project(v, Render.vp, m.x, m.y, m.z)) {
        const sx = U.clamp(v[0] * W, 24, W - 24), sy = U.clamp(v[1] * H, 24, H - 24);
        c.strokeStyle = 'rgba(220,60,40,0.75)';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(sx, sy - 14); c.lineTo(sx + 8, sy - 26); c.lineTo(sx - 8, sy - 26); c.closePath();
        c.stroke();
      } else {
        // 在屏幕边缘提示方向
        const dx = m.x - Render.camX, dz = m.z - Render.camZ;
        const ang = U.angleDiff(P.yaw, U.yawOf(dx, dz));
        const side = ang > 0 ? W - 26 : 26;
        c.fillStyle = 'rgba(200,50,35,0.6)';
        c.beginPath();
        c.moveTo(side, H / 2 - 14); c.lineTo(side + (ang > 0 ? -14 : 14), H / 2); c.lineTo(side, H / 2 + 14);
        c.closePath(); c.fill();
      }
    }
  }

  G.Render = Render;
})();
