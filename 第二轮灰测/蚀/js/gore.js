/* ===================================================================
   gore.js — 血肉破碎系统
   · chunk : 体素肢块（真 3D 旋转刚体，落地留血、可堆积）
   · drop  : 血滴（落地生成地面血迹贴花）
   · mist  : 血雾 / 烟 / 火星 公告板
   · decal : 地面血迹（累积、持久，形成血泊）
   · screen: 屏幕血污（画在 2D 叠加层）
   · bloodGrid : 每格血量（供「踩血回复」等遗物查询）
   =================================================================== */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const U = G.U, M4 = G.M4;

  const GRAV = 17.5;
  const CAP = { chunk: 300, drop: 620, mist: 240, decal: 520 };

  const Gore = {
    chunks: [], drops: [], mists: [], decals: [], screen: [],
    bloodGrid: null, gw: 0, gh: 0,
    map: null,
    quality: 1,          // 0.5 = 低配, 1 = 正常, 1.5 = 血肉狂欢
    totalGibs: 0,
    _m: M4.create(),
  };

  /* --------------------------- 生命周期 --------------------------- */
  Gore.bind = function (map) {
    Gore.map = map;
    Gore.gw = map.w; Gore.gh = map.h;
    Gore.bloodGrid = new Float32Array(map.w * map.h);
    Gore.clear();
  };
  Gore.clear = function () {
    Gore.chunks.length = 0; Gore.drops.length = 0;
    Gore.mists.length = 0; Gore.decals.length = 0; Gore.screen.length = 0;
    if (Gore.bloodGrid) Gore.bloodGrid.fill(0);
  };

  function slot(arr, cap, factory) {
    for (let i = 0; i < arr.length; i++) if (!arr[i].alive) return arr[i];
    if (arr.length < cap) { const o = factory(); arr.push(o); return o; }
    // 满了：抢最老的（生命值最低的）
    let worst = arr[0], wl = 1e9;
    for (let i = 0; i < arr.length; i++) {
      const t = arr[i].life / (arr[i].maxLife || 1);
      if (t < wl) { wl = t; worst = arr[i]; }
    }
    return worst;
  }

  /* --------------------------- 血迹贴花 --------------------------- */
  Gore.addDecal = function (x, z, size, dark, kind) {
    const map = Gore.map; if (!map) return;
    if (map.isSolidAt(x, z)) return;
    const d = slot(Gore.decals, CAP.decal, () => ({ alive: false }));
    d.alive = true;
    d.x = x; d.z = z;
    d.y = map.floorAt(x, z) + 0.014 + Math.random() * 0.004;
    d.size = size; d.ang = Math.random() * U.TAU;
    d.tile = kind || (1 + ((Math.random() * 4) | 0));
    d.dark = dark === undefined ? (0.75 + Math.random() * 0.25) : dark;
    d.life = 1; d.maxLife = 1;
    // 累积血量
    const i = Math.floor(x), j = Math.floor(z);
    if (i >= 0 && j >= 0 && i < Gore.gw && j < Gore.gh) {
      const k = j * Gore.gw + i;
      Gore.bloodGrid[k] = Math.min(2.5, Gore.bloodGrid[k] + size * 0.5);
    }
    return d;
  };
  Gore.bloodAt = function (x, z) {
    if (!Gore.bloodGrid) return 0;
    const i = Math.floor(x), j = Math.floor(z);
    if (i < 0 || j < 0 || i >= Gore.gw || j >= Gore.gh) return 0;
    return Gore.bloodGrid[j * Gore.gw + i];
  };
  Gore.drainBlood = function (x, z, amt) {
    if (!Gore.bloodGrid) return 0;
    const i = Math.floor(x), j = Math.floor(z);
    if (i < 0 || j < 0 || i >= Gore.gw || j >= Gore.gh) return 0;
    const k = j * Gore.gw + i;
    const got = Math.min(Gore.bloodGrid[k], amt);
    Gore.bloodGrid[k] -= got;
    return got;
  };

  /* --------------------------- 血滴 --------------------------- */
  Gore.drop = function (x, y, z, vx, vy, vz, size, kind) {
    const d = slot(Gore.drops, CAP.drop, () => ({ alive: false }));
    d.alive = true;
    d.x = x; d.y = y; d.z = z;
    d.vx = vx; d.vy = vy; d.vz = vz;
    d.size = size || 0.055;
    d.life = d.maxLife = 1.4 + Math.random() * 1.2;
    d.kind = kind || 'blood';     // blood | spark | ember | bone
    d.stuck = 0;
    return d;
  };

  Gore.mist = function (x, y, z, size, life, kind, vy) {
    const m = slot(Gore.mists, CAP.mist, () => ({ alive: false }));
    m.alive = true;
    m.x = x; m.y = y; m.z = z;
    m.size = size; m.size0 = size;
    m.life = m.maxLife = life;
    m.kind = kind || 'blood';
    m.vy = vy === undefined ? 0.35 : vy;
    m.vx = (Math.random() - 0.5) * 0.4;
    m.vz = (Math.random() - 0.5) * 0.4;
    m.spin = (Math.random() - 0.5) * 3;
    m.ang = Math.random() * U.TAU;
    return m;
  };

  /* --------------------------- 体素肢块 --------------------------- */
  Gore.chunk = function (x, y, z, hx, hy, hz, col, vx, vy, vz, kind) {
    const c = slot(Gore.chunks, CAP.chunk, () => ({ alive: false, m: M4.create() }));
    c.alive = true;
    c.x = x; c.y = y; c.z = z;
    c.hx = hx; c.hy = hy; c.hz = hz;
    c.col = col;
    c.vx = vx; c.vy = vy; c.vz = vz;
    c.rx = Math.random() * U.TAU; c.ry = Math.random() * U.TAU; c.rz = Math.random() * U.TAU;
    c.wx = (Math.random() - 0.5) * 22; c.wy = (Math.random() - 0.5) * 22; c.wz = (Math.random() - 0.5) * 22;
    c.life = c.maxLife = 9 + Math.random() * 6;
    c.rest = 0;
    c.bleed = kind === 'bone' ? 0.25 : 1;
    c.kind = kind || 'flesh';
    c.trail = 0;
    Gore.totalGibs++;
    return c;
  };

  /* --------------------------- 高层特效 --------------------------- */
  // 命中喷血：dir 为喷射主方向（通常是攻击方向的反向 + 上扬）
  Gore.spray = function (x, y, z, dx, dy, dz, amount, power) {
    const q = Gore.quality;
    const n = Math.round(amount * q);
    for (let i = 0; i < n; i++) {
      const sp = (0.5 + Math.random() * 1.3) * power;
      const jx = dx + (Math.random() - 0.5) * 1.1;
      const jy = dy + Math.random() * 0.9;
      const jz = dz + (Math.random() - 0.5) * 1.1;
      Gore.drop(x, y, z, jx * sp, jy * sp + 1.2, jz * sp, 0.04 + Math.random() * 0.055);
    }
    const nm = Math.max(1, Math.round(amount * 0.3 * q));
    for (let i = 0; i < nm; i++)
      Gore.mist(x + (Math.random() - 0.5) * 0.3, y + (Math.random() - 0.5) * 0.3, z + (Math.random() - 0.5) * 0.3,
        0.35 + Math.random() * 0.5, 0.35 + Math.random() * 0.4, 'blood', 0.5);
  };

  Gore.sparks = function (x, y, z, dx, dy, dz, n) {
    for (let i = 0; i < n; i++) {
      const sp = 2 + Math.random() * 5;
      Gore.drop(x, y, z,
        (dx + (Math.random() - 0.5) * 1.4) * sp,
        (dy + Math.random() * 1.2) * sp,
        (dz + (Math.random() - 0.5) * 1.4) * sp,
        0.03 + Math.random() * 0.03, 'spark');
    }
    Gore.mist(x, y, z, 0.3, 0.16, 'spark', 0.2);
  };

  Gore.dust = function (x, y, z, n, size) {
    for (let i = 0; i < n; i++)
      Gore.mist(x + (Math.random() - 0.5) * 0.6, y + Math.random() * 0.3, z + (Math.random() - 0.5) * 0.6,
        (size || 0.5) * (0.6 + Math.random()), 0.5 + Math.random() * 0.6, 'dust', 0.25);
  };

  Gore.embers = function (x, y, z, n) {
    for (let i = 0; i < n; i++)
      Gore.drop(x + (Math.random() - 0.5) * 0.2, y, z + (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 0.5, 0.6 + Math.random() * 0.9, (Math.random() - 0.5) * 0.5,
        0.03 + Math.random() * 0.03, 'ember');
    }

  /* 把敌人的体素模型炸成肢块 —— 核心爽点
     ent: 需要 .x,.y,.z,.yaw,.model,.scale,.height
     dirX/dirZ: 冲击方向；power: 爆散力度 */
  Gore.gibEntity = function (ent, dirX, dirZ, power, focusY) {
    const model = ent.model;
    if (!model) return;
    const q = Gore.quality;
    const m = Gore._m;
    const s = ent.scale || 1;
    const cy = focusY === undefined ? (ent.y + ent.height * 0.55) : focusY;
    let count = 0;

    for (const pn of model.order) {
      const part = model.parts[pn];
      const pv = part.pivot;
      // 部件世界矩阵（与渲染同一套约定：模型正面 = 局部 -Z，故 ry = -yaw）
      M4.compose(m, ent.x, ent.y, ent.z, -(ent.yaw || 0), 0, 0, s, s, s);

      for (const b of part.boxes) {
        const lx = pv[0] + b[0], ly = pv[1] + b[1], lz = pv[2] + b[2];
        const wx = m[0] * lx + m[4] * ly + m[8] * lz + m[12];
        const wy = m[1] * lx + m[5] * ly + m[9] * lz + m[13];
        const wz = m[2] * lx + m[6] * ly + m[10] * lz + m[14];

        if (q < 1 && (count % 2) === 1) { count++; continue; }   // 低配跳一半

        // 爆散速度：以冲击点为中心向外 + 冲击方向偏置
        const ox = wx - ent.x, oy = wy - cy, oz = wz - ent.z;
        const d = Math.sqrt(ox * ox + oy * oy + oz * oz) + 0.001;
        const spread = power * (0.6 + Math.random() * 0.9);
        const vx = (ox / d) * spread * 2.2 + dirX * power * 1.5 + (Math.random() - 0.5) * 2;
        const vy = (oy / d) * spread * 1.6 + 2.6 + Math.random() * 3.4;
        const vz = (oz / d) * spread * 2.2 + dirZ * power * 1.5 + (Math.random() - 0.5) * 2;

        const isBone = b[7] > 0 ? false : (Math.random() < 0.18);
        Gore.chunk(wx, wy, wz, b[3] * s, b[4] * s, b[5] * s,
          b[6], vx, vy, vz, b[7] > 0 ? 'glow' : (isBone ? 'bone' : 'flesh'));
        count++;
      }
    }
    // 血雨 + 血雾 + 地面血泊
    Gore.spray(ent.x, cy, ent.z, dirX * 0.4, 0.7, dirZ * 0.4, 34 * q, 3.2);
    for (let i = 0; i < 8 * q; i++) {
      const a = Math.random() * U.TAU, r = Math.random() * ent.height * 0.6;
      Gore.mist(ent.x + Math.cos(a) * r, ent.y + Math.random() * ent.height, ent.z + Math.sin(a) * r,
        0.6 + Math.random() * 0.9, 0.5 + Math.random() * 0.5, 'blood', 0.7);
    }
    const pool = 1.1 + ent.height * 0.35;
    Gore.addDecal(ent.x, ent.z, pool, 0.95, 1);
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * U.TAU, r = Math.random() * pool * 0.9;
      Gore.addDecal(ent.x + Math.cos(a) * r, ent.z + Math.sin(a) * r, pool * (0.4 + Math.random() * 0.5), 0.9);
    }
    return count;
  };

  /* --------------------------- 更新 --------------------------- */
  Gore.update = function (dt, map) {
    map = map || Gore.map;
    if (!map) return;

    /* 肢块：3D 刚体 + 落地 */
    const chunks = Gore.chunks;
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i]; if (!c.alive) continue;
      c.life -= dt;
      if (c.life <= 0) { c.alive = false; continue; }
      if (c.rest > 0) { c.rest -= dt; continue; }  // 已静止：保留为地面装饰

      c.vy -= GRAV * dt;
      const nx = c.x + c.vx * dt, nz = c.z + c.vz * dt;
      // 墙壁反弹
      if (map.isSolidAt(nx, c.z)) { c.vx *= -0.42; c.wy *= 0.6; splatWall(c, 1, 0); }
      else c.x = nx;
      if (map.isSolidAt(c.x, nz)) { c.vz *= -0.42; c.wy *= 0.6; splatWall(c, 0, 1); }
      else c.z = nz;

      c.y += c.vy * dt;
      const fl = map.floorAt(c.x, c.z) + Math.max(c.hy, 0.02);
      if (c.y <= fl) {
        c.y = fl;
        if (Math.abs(c.vy) > 1.1) {
          c.vy *= -0.32; c.vx *= 0.62; c.vz *= 0.62;
          c.wx *= 0.5; c.wy *= 0.5; c.wz *= 0.5;
          if (c.bleed > 0.5) Gore.addDecal(c.x, c.z, 0.35 + Math.random() * 0.4, 0.85);
        } else {
          // 静止：贴地、随机躺平角度
          c.vy = 0; c.vx *= 0.2; c.vz *= 0.2;
          c.wx *= 0.1; c.wy *= 0.1; c.wz *= 0.1;
          if (Math.abs(c.vx) + Math.abs(c.vz) < 0.25) {
            c.rest = c.life;
            if (c.bleed > 0.5) Gore.addDecal(c.x, c.z, 0.4 + Math.random() * 0.5, 0.9);
          }
        }
      }
      c.rx += c.wx * dt; c.ry += c.wy * dt; c.rz += c.wz * dt;
      // 飞行拖血
      if (c.bleed > 0.5) {
        c.trail -= dt;
        if (c.trail <= 0 && (Math.abs(c.vx) + Math.abs(c.vy) + Math.abs(c.vz)) > 3) {
          c.trail = 0.035 + Math.random() * 0.05;
          Gore.drop(c.x, c.y, c.z, c.vx * 0.15, c.vy * 0.1, c.vz * 0.15, 0.035);
        }
      }
    }

    /* 血滴 */
    const drops = Gore.drops;
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i]; if (!d.alive) continue;
      d.life -= dt;
      if (d.life <= 0) { d.alive = false; continue; }
      const g = d.kind === 'ember' ? -3.2 : (d.kind === 'spark' ? GRAV * 0.55 : GRAV);
      d.vy -= g * dt;
      if (d.kind === 'ember') { d.vx *= 0.98; d.vz *= 0.98; }
      const nx = d.x + d.vx * dt, ny = d.y + d.vy * dt, nz = d.z + d.vz * dt;
      if (map.isSolidAt(nx, nz)) {
        // 溅到墙上
        if (d.kind === 'blood') Gore.addDecal(d.x, d.z, 0.3, 0.8);
        d.alive = false; continue;
      }
      const fl = map.floorAt(nx, nz);
      if (ny <= fl + 0.01) {
        if (d.kind === 'blood') Gore.addDecal(nx, nz, 0.28 + Math.random() * 0.34, 0.8);
        else if (d.kind === 'spark') { /* 火花直接消失 */ }
        d.alive = false; continue;
      }
      d.x = nx; d.y = ny; d.z = nz;
    }

    /* 血雾 / 烟 */
    const mists = Gore.mists;
    for (let i = 0; i < mists.length; i++) {
      const m = mists[i]; if (!m.alive) continue;
      m.life -= dt;
      if (m.life <= 0) { m.alive = false; continue; }
      m.x += m.vx * dt; m.y += m.vy * dt; m.z += m.vz * dt;
      m.vx *= 0.94; m.vz *= 0.94; m.vy *= 0.96;
      m.ang += m.spin * dt;
      const t = 1 - m.life / m.maxLife;
      m.size = m.size0 * (1 + t * (m.kind === 'dust' ? 1.6 : 1.1));
    }

    /* 屏幕血污 */
    const scr = Gore.screen;
    for (let i = scr.length - 1; i >= 0; i--) {
      const s = scr[i];
      s.life -= dt;
      s.y += s.vy * dt; s.vy += 4 * dt;
      if (s.life <= 0) scr.splice(i, 1);
    }
  };

  function splatWall(c, ax, az) {
    if (c.bleed < 0.5) return;
    Gore.addDecal(c.x, c.z, 0.3 + Math.random() * 0.3, 0.85);
  }

  /* --------------------------- 屏幕血污 --------------------------- */
  Gore.screenSplat = function (n, scale) {
    for (let i = 0; i < n; i++) {
      Gore.screen.push({
        x: Math.random(), y: Math.random() * 0.9,
        r: (0.02 + Math.random() * 0.07) * (scale || 1),
        life: 2.4 + Math.random() * 3.2, maxLife: 5.6,
        vy: 0.005 + Math.random() * 0.02,
        a: 0.5 + Math.random() * 0.5,
        tile: (Math.random() * 4) | 0,
      });
    }
    if (Gore.screen.length > 90) Gore.screen.splice(0, Gore.screen.length - 90);
  };

  /* --------------------------- 渲染数据构建 --------------------------- */
  // 肢块（不透明，写深度）
  Gore.emitChunks = function (mb, T, lightFn) {
    const m = Gore._m, chunks = Gore.chunks;
    const gore = T.gore, bone = T.bone, white = T.white;
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i]; if (!c.alive) continue;
      const fade = c.life < 1.5 ? c.life / 1.5 : 1;
      M4.compose(m, c.x, c.y, c.z, c.ry, c.rx, c.rz, 1, 1, 1);
      const tile = c.kind === 'bone' ? bone : (c.kind === 'glow' ? white : gore);
      const l = lightFn(c.x, c.z) * fade;
      const col = c.col;
      mb.boxM(m, 0, 0, 0, c.hx, c.hy, c.hz, tile, col, l, c.kind === 'glow' ? 0.9 * fade : 0);
    }
  };

  // 血滴 / 火星（公告板，半透明）
  Gore.emitDrops = function (mb, T, rx, ry, rz, ux, uy, uz, lightFn) {
    const drops = Gore.drops;
    const drop = T.drop, glow = T.glow;
    const cBlood = [1, 0.28, 0.26], cSpark = [1, 0.85, 0.5], cEmber = [1, 0.45, 0.12];
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i]; if (!d.alive) continue;
      const isB = d.kind === 'blood';
      const col = isB ? cBlood : (d.kind === 'spark' ? cSpark : cEmber);
      const l = isB ? U.clamp(lightFn(d.x, d.z) * 1.5, 0.25, 1.6) : 1.6;
      const sz = d.size * (isB ? 1 : 0.8);
      // 血滴按速度拉长 → 更有喷溅感
      const stretch = isB ? U.clamp(Math.sqrt(d.vx * d.vx + d.vy * d.vy + d.vz * d.vz) * 0.055, 1, 3.2) : 1;
      mb.billboard(d.x, d.y, d.z, sz, sz * stretch, rx, ry, rz, ux, uy, uz,
        isB ? drop : glow, col, l, isB ? 0.15 : 1);
    }
  };

  Gore.emitMists = function (mb, T, rx, ry, rz, ux, uy, uz, lightFn) {
    const mists = Gore.mists;
    for (let i = 0; i < mists.length; i++) {
      const m = mists[i]; if (!m.alive) continue;
      const t = m.life / m.maxLife;
      let tile, col, l, e;
      if (m.kind === 'blood') { tile = T.drop; col = [0.62, 0.05, 0.06]; l = U.clamp(lightFn(m.x, m.z) * 1.2, 0.2, 1.4) * t; e = 0; }
      else if (m.kind === 'dust') { tile = T.smoke; col = [0.5, 0.48, 0.46]; l = U.clamp(lightFn(m.x, m.z), 0.15, 1.2) * t; e = 0; }
      else if (m.kind === 'spark') { tile = T.glow; col = [1, 0.8, 0.4]; l = 1.6 * t; e = 1; }
      else { tile = T.glow; col = [1, 0.4, 0.15]; l = 1.5 * t; e = 1; }
      mb.billboard(m.x, m.y, m.z, m.size, m.size, rx, ry, rz, ux, uy, uz, tile, col, l, e);
    }
  };

  // 地面血迹
  Gore.emitDecals = function (mb, T, lightFn, camX, camZ, maxD) {
    const decals = Gore.decals;
    const tiles = [T.blood1, T.blood1, T.blood2, T.blood3, T.blood4];
    const d2max = maxD * maxD;
    for (let i = 0; i < decals.length; i++) {
      const d = decals[i]; if (!d.alive) continue;
      if (U.dist2(d.x, d.z, camX, camZ) > d2max) continue;
      const l = U.clamp(lightFn(d.x, d.z) * 1.15, 0.12, 1.4);
      const c = d.dark;
      mb.decal(d.x, d.y, d.z, d.size, d.ang, tiles[d.tile % tiles.length], [c, c * 0.92, c * 0.92], l, 0);
    }
  };

  Gore.counts = function () {
    let a = 0, b = 0, c = 0;
    for (const x of Gore.chunks) if (x.alive) a++;
    for (const x of Gore.drops) if (x.alive) b++;
    for (const x of Gore.mists) if (x.alive) c++;
    return { chunks: a, drops: b, mists: c, decals: Gore.decals.filter(d => d.alive).length };
  };

  G.Gore = Gore;
})();
