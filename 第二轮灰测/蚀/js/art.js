/* ===================================================================
   art.js — 全程序化美术资源
   1) 纹理图集（512x512，64x64 一格）：石墙、血肉墙、骨墙、地板、血渍贴花、
      火焰、光点、传送门、抖动矩阵…全部用 Canvas2D 现场生成，无外部图片。
   2) 体素模型：敌人/巨剑/道具，由若干带颜色的盒子组成，
      死亡时逐盒炸成肢块 → 血肉横飞的关键。
   =================================================================== */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const U = G.U;

  const ATLAS = 512, TS = 64, COLS = ATLAS / TS;

  const Art = {
    atlas: null,
    T: {},              // name -> [u0,v0,u1,v1]
    ditherUV: [0, 0],
    _models: {},
  };

  /* ============================ 纹理工具 ============================ */
  function px(ctx, x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); }

  function noiseTile(ctx, ox, oy, rng, base, amp, density) {
    // 逐像素噪声（4x4 块，保持像素感）
    const step = 2;
    for (let y = 0; y < TS; y += step) {
      for (let x = 0; x < TS; x += step) {
        if (rng.next() > (density === undefined ? 1 : density)) continue;
        const f = 1 + rng.gauss() * amp;
        const r = U.clamp(base[0] * f, 0, 255) | 0;
        const g = U.clamp(base[1] * f, 0, 255) | 0;
        const b = U.clamp(base[2] * f, 0, 255) | 0;
        ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
        ctx.fillRect(ox + x, oy + y, step, step);
      }
    }
  }

  function speckle(ctx, ox, oy, rng, n, colFn, sizeMax) {
    for (let i = 0; i < n; i++) {
      const x = rng.int(TS), y = rng.int(TS), s = 1 + rng.int(sizeMax || 2);
      ctx.fillStyle = colFn(rng);
      ctx.fillRect(ox + x, oy + y, s, s);
    }
  }

  function crackLines(ctx, ox, oy, rng, n, col, len) {
    ctx.strokeStyle = col; ctx.lineWidth = 1;
    for (let i = 0; i < n; i++) {
      let x = rng.int(TS), y = rng.int(TS);
      ctx.beginPath(); ctx.moveTo(ox + x + .5, oy + y + .5);
      const steps = 3 + rng.int(len || 6);
      let a = rng.next() * U.TAU;
      for (let s = 0; s < steps; s++) {
        a += rng.gauss() * 0.7;
        x += Math.cos(a) * (2 + rng.int(4));
        y += Math.sin(a) * (2 + rng.int(4));
        ctx.lineTo(ox + (x % TS) + .5, oy + (y % TS) + .5);
      }
      ctx.stroke();
    }
  }

  function edgeDark(ctx, ox, oy, strength) {
    const g = ctx.createLinearGradient(ox, oy, ox, oy + TS);
    g.addColorStop(0, 'rgba(0,0,0,' + (strength * 0.55) + ')');
    g.addColorStop(0.35, 'rgba(0,0,0,0)');
    g.addColorStop(0.75, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,' + strength + ')');
    ctx.fillStyle = g; ctx.fillRect(ox, oy, TS, TS);
  }

  function bricks(ctx, ox, oy, rng, rows, mortar, light, dark) {
    const rh = TS / rows;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) ? rh * 0.9 : 0;
      let x = -off;
      while (x < TS) {
        const w = rh * (1.4 + rng.next() * 1.5);
        const y = r * rh;
        const f = 0.82 + rng.next() * 0.36;
        ctx.fillStyle = 'rgba(' + (light[0] * f | 0) + ',' + (light[1] * f | 0) + ',' + (light[2] * f | 0) + ',1)';
        ctx.fillRect(ox + Math.max(0, x) + 1, oy + y + 1, Math.min(w, TS - x) - 2, rh - 2);
        // 上缘高光 / 下缘阴影
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(ox + Math.max(0, x) + 1, oy + y + 1, Math.min(w, TS - x) - 2, 1);
        ctx.fillStyle = 'rgba(0,0,0,0.32)';
        ctx.fillRect(ox + Math.max(0, x) + 1, oy + y + rh - 2, Math.min(w, TS - x) - 2, 1);
        x += w;
      }
    }
  }

  function bloodSmear(ctx, ox, oy, rng, n, alphaMax) {
    for (let i = 0; i < n; i++) {
      const x = rng.int(TS), y = rng.int(TS * 0.7);
      const w = 2 + rng.int(7);
      const h = 6 + rng.int(26);
      const a = 0.18 + rng.next() * (alphaMax || 0.5);
      const g = ctx.createLinearGradient(ox + x, oy + y, ox + x, oy + y + h);
      g.addColorStop(0, 'rgba(96,8,10,' + a + ')');
      g.addColorStop(0.6, 'rgba(58,4,6,' + (a * 0.8) + ')');
      g.addColorStop(1, 'rgba(30,2,3,0)');
      ctx.fillStyle = g;
      ctx.fillRect(ox + x, oy + y, w, h);
      if (rng.chance(0.5)) { ctx.fillStyle = 'rgba(120,12,14,' + (a * 0.9) + ')'; ctx.fillRect(ox + x - 1, oy + y, w + 2, 2); }
    }
  }

  /* ============================ 各类砖块绘制 ============================ */
  const PAINTERS = {
    // 纯白（给无纹理的纯色几何用）
    white(ctx, ox, oy) { px(ctx, ox, oy, TS, TS, '#ffffff'); },

    // 4x4 Bayer 有序抖动矩阵（放在瓦片左上角 4x4 像素）
    dither(ctx, ox, oy) {
      px(ctx, ox, oy, TS, TS, '#808080');
      const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
      for (let i = 0; i < 16; i++) {
        const v = Math.round(B[i] / 15 * 255);
        ctx.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
        ctx.fillRect(ox + (i % 4), oy + ((i / 4) | 0), 1, 1);
      }
    },

    stone(ctx, ox, oy, rng) {
      px(ctx, ox, oy, TS, TS, '#2a2a2e');
      bricks(ctx, ox, oy, rng, 5, '#111', [66, 64, 68], [30, 29, 32]);
      noiseTile(ctx, ox, oy, rng, [58, 56, 60], 0.16, 0.35);
      crackLines(ctx, ox, oy, rng, 3, 'rgba(12,11,13,0.8)', 7);
      speckle(ctx, ox, oy, rng, 60, r => 'rgba(90,88,92,' + (0.1 + r.next() * 0.3) + ')');
      edgeDark(ctx, ox, oy, 0.45);
    },
    stoneBlood(ctx, ox, oy, rng) {
      PAINTERS.stone(ctx, ox, oy, rng);
      bloodSmear(ctx, ox, oy, rng, 7, 0.55);
    },
    stoneMoss(ctx, ox, oy, rng) {
      PAINTERS.stone(ctx, ox, oy, rng);
      for (let i = 0; i < 90; i++) {
        const x = rng.int(TS), y = rng.int(TS);
        const a = 0.06 + rng.next() * 0.2;
        ctx.fillStyle = 'rgba(' + (40 + rng.int(30)) + ',' + (56 + rng.int(40)) + ',' + (34 + rng.int(20)) + ',' + a + ')';
        ctx.fillRect(ox + x, oy + y, 1 + rng.int(3), 1 + rng.int(3));
      }
      edgeDark(ctx, ox, oy, 0.4);
    },
    brick(ctx, ox, oy, rng) {
      px(ctx, ox, oy, TS, TS, '#1e1414');
      bricks(ctx, ox, oy, rng, 7, '#0a0606', [78, 50, 42], [40, 24, 20]);
      noiseTile(ctx, ox, oy, rng, [70, 45, 38], 0.2, 0.3);
      edgeDark(ctx, ox, oy, 0.5);
    },
    // 肉壁：会抽动的血肉墙
    flesh(ctx, ox, oy, rng) {
      px(ctx, ox, oy, TS, TS, '#3a1214');
      noiseTile(ctx, ox, oy, rng, [82, 26, 28], 0.25, 0.9);
      // 血管
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        ctx.strokeStyle = 'rgba(' + (120 + rng.int(50)) + ',30,32,' + (0.25 + rng.next() * 0.4) + ')';
        let x = rng.int(TS), y = rng.int(TS), a = rng.next() * U.TAU;
        ctx.beginPath(); ctx.moveTo(ox + x, oy + y);
        for (let s = 0; s < 6; s++) {
          a += rng.gauss() * 0.8;
          x += Math.cos(a) * 7; y += Math.sin(a) * 7;
          ctx.lineTo(ox + (x + TS) % TS, oy + (y + TS) % TS);
        }
        ctx.stroke();
      }
      // 孔洞 / 湿润高光
      for (let i = 0; i < 16; i++) {
        const x = ox + rng.int(TS), y = oy + rng.int(TS), r = 2 + rng.int(5);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(20,2,4,0.9)');
        g.addColorStop(1, 'rgba(60,14,16,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, U.TAU); ctx.fill();
      }
      speckle(ctx, ox, oy, rng, 40, r => 'rgba(200,120,120,' + (0.05 + r.next() * 0.12) + ')');
      edgeDark(ctx, ox, oy, 0.55);
    },
    bone(ctx, ox, oy, rng) {
      px(ctx, ox, oy, TS, TS, '#3b3830');
      // 堆叠的骨头/头骨
      for (let i = 0; i < 26; i++) {
        const x = rng.int(TS), y = rng.int(TS), w = 5 + rng.int(16), h = 3 + rng.int(6);
        const f = 0.7 + rng.next() * 0.5;
        ctx.fillStyle = 'rgba(' + (176 * f | 0) + ',' + (166 * f | 0) + ',' + (140 * f | 0) + ',0.95)';
        ctx.fillRect(ox + x, oy + y, w, h);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(ox + x, oy + y + h - 1, w, 1);
      }
      for (let i = 0; i < 4; i++) {  // 眼窝
        const x = ox + 4 + rng.int(TS - 12), y = oy + 4 + rng.int(TS - 12);
        px(ctx, x, y, 4, 3, 'rgba(10,8,8,0.9)');
        px(ctx, x + 7, y, 4, 3, 'rgba(10,8,8,0.9)');
      }
      noiseTile(ctx, ox, oy, rng, [120, 114, 96], 0.14, 0.25);
      edgeDark(ctx, ox, oy, 0.5);
    },
    wood(ctx, ox, oy, rng) {
      px(ctx, ox, oy, TS, TS, '#2a1c11');
      for (let i = 0; i < 10; i++) {
        const w = TS / 10;
        const f = 0.75 + rng.next() * 0.5;
        ctx.fillStyle = 'rgba(' + (70 * f | 0) + ',' + (46 * f | 0) + ',' + (26 * f | 0) + ',1)';
        ctx.fillRect(ox + i * w, oy, w - 1, TS);
        for (let k = 0; k < 12; k++) {
          ctx.fillStyle = 'rgba(0,0,0,' + (0.05 + rng.next() * 0.14) + ')';
          ctx.fillRect(ox + i * w, oy + rng.int(TS), w - 1, 1 + rng.int(2));
        }
      }
      speckle(ctx, ox, oy, rng, 20, () => 'rgba(20,14,8,0.7)', 3);
      edgeDark(ctx, ox, oy, 0.45);
    },
    metal(ctx, ox, oy, rng) {
      px(ctx, ox, oy, TS, TS, '#2f3238');
      noiseTile(ctx, ox, oy, rng, [74, 78, 86], 0.13, 0.7);
      for (let i = 0; i < 6; i++) {   // 铆钉
        const x = ox + 6 + rng.int(TS - 12), y = oy + 6 + rng.int(TS - 12);
        px(ctx, x, y, 4, 4, '#8a8f98'); px(ctx, x + 1, y + 1, 2, 2, '#c3c8d0');
        px(ctx, x, y + 4, 4, 1, 'rgba(0,0,0,.5)');
      }
      // 锈迹
      for (let i = 0; i < 30; i++) {
        ctx.fillStyle = 'rgba(' + (90 + rng.int(50)) + ',' + (44 + rng.int(20)) + ',18,' + (0.06 + rng.next() * 0.22) + ')';
        ctx.fillRect(ox + rng.int(TS), oy + rng.int(TS), 2 + rng.int(8), 2 + rng.int(8));
      }
      edgeDark(ctx, ox, oy, 0.4);
    },
    rune(ctx, ox, oy, rng) {
      PAINTERS.stone(ctx, ox, oy, rng);
      ctx.strokeStyle = 'rgba(150,20,24,0.85)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ox + TS / 2, oy + TS / 2, 20, 0, U.TAU); ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = i * U.TAU * 2 / 5 - Math.PI / 2;
        const x = ox + TS / 2 + Math.cos(a) * 19, y = oy + TS / 2 + Math.sin(a) * 19;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.stroke();
      ctx.strokeStyle = 'rgba(230,60,40,0.35)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(ox + TS / 2, oy + TS / 2, 20, 0, U.TAU); ctx.stroke();
    },
    floor(ctx, ox, oy, rng) {
      px(ctx, ox, oy, TS, TS, '#232326');
      // 大块石板
      for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) {
        const f = 0.8 + rng.next() * 0.4;
        ctx.fillStyle = 'rgba(' + (52 * f | 0) + ',' + (51 * f | 0) + ',' + (54 * f | 0) + ',1)';
        ctx.fillRect(ox + tx * 32 + 1, oy + ty * 32 + 1, 30, 30);
      }
      noiseTile(ctx, ox, oy, rng, [48, 47, 50], 0.18, 0.5);
      crackLines(ctx, ox, oy, rng, 2, 'rgba(10,10,12,0.7)', 6);
      speckle(ctx, ox, oy, rng, 50, r => 'rgba(80,78,82,' + (0.08 + r.next() * 0.2) + ')');
    },
    floorDirt(ctx, ox, oy, rng) {
      px(ctx, ox, oy, TS, TS, '#241d18');
      noiseTile(ctx, ox, oy, rng, [56, 44, 34], 0.24, 0.95);
      speckle(ctx, ox, oy, rng, 90, r => 'rgba(' + (20 + r.int(30)) + ',' + (16 + r.int(20)) + ',12,' + (0.2 + r.next() * 0.4) + ')', 3);
    },
    floorBlood(ctx, ox, oy, rng) {
      PAINTERS.floor(ctx, ox, oy, rng);
      ctx.globalAlpha = 0.75;
      for (let i = 0; i < 14; i++) {
        const x = ox + rng.int(TS), y = oy + rng.int(TS), r = 4 + rng.int(16);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(78,4,6,0.95)');
        g.addColorStop(0.7, 'rgba(48,3,5,0.7)');
        g.addColorStop(1, 'rgba(30,2,3,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, U.TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
    ceil(ctx, ox, oy, rng) {
      px(ctx, ox, oy, TS, TS, '#141416');
      noiseTile(ctx, ox, oy, rng, [30, 29, 32], 0.22, 0.6);
      crackLines(ctx, ox, oy, rng, 4, 'rgba(6,6,8,0.9)', 8);
      edgeDark(ctx, ox, oy, 0.6);
    },
    grate(ctx, ox, oy, rng) {
      px(ctx, ox, oy, TS, TS, '#0a0a0c');
      ctx.fillStyle = '#3c3f45';
      for (let i = 0; i < 5; i++) { ctx.fillRect(ox + 2 + i * 13, oy, 5, TS); }
      for (let i = 0; i < 5; i++) { ctx.fillRect(ox, oy + 2 + i * 13, TS, 5); }
      speckle(ctx, ox, oy, rng, 40, r => 'rgba(100,50,20,' + (0.1 + r.next() * 0.3) + ')', 3);
      edgeDark(ctx, ox, oy, 0.5);
    },

    /* ---- 半透明贴花 / 粒子 ---- */
    blood1(ctx, ox, oy, rng) { splat(ctx, ox, oy, rng, 1.0, 8); },
    blood2(ctx, ox, oy, rng) { splat(ctx, ox, oy, rng, 0.8, 12); },
    blood3(ctx, ox, oy, rng) { splat(ctx, ox, oy, rng, 0.62, 16); },
    blood4(ctx, ox, oy, rng) { splat(ctx, ox, oy, rng, 0.45, 22); },
    gore(ctx, ox, oy, rng) {  // 肉块表面
      px(ctx, ox, oy, TS, TS, '#5c1013');
      noiseTile(ctx, ox, oy, rng, [110, 26, 28], 0.3, 1);
      speckle(ctx, ox, oy, rng, 50, r => 'rgba(' + (180 + r.int(60)) + ',' + (60 + r.int(40)) + ',60,' + (0.1 + r.next() * 0.3) + ')', 3);
      speckle(ctx, ox, oy, rng, 30, r => 'rgba(30,2,4,' + (0.2 + r.next() * 0.5) + ')', 4);
    },
    drop(ctx, ox, oy, rng) {   // 血滴粒子
      const cx = ox + TS / 2, cy = oy + TS / 2;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, TS / 2);
      g.addColorStop(0, 'rgba(190,26,26,1)');
      g.addColorStop(0.45, 'rgba(120,8,10,0.95)');
      g.addColorStop(0.8, 'rgba(60,4,6,0.5)');
      g.addColorStop(1, 'rgba(40,2,4,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, TS / 2, 0, U.TAU); ctx.fill();
    },
    glow(ctx, ox, oy) {
      const cx = ox + TS / 2, cy = oy + TS / 2;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, TS / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.25, 'rgba(255,255,255,0.65)');
      g.addColorStop(0.6, 'rgba(255,255,255,0.18)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, TS / 2, 0, U.TAU); ctx.fill();
    },
    flame(ctx, ox, oy, rng) {
      // 火焰：垂直渐变 + 撕裂边缘
      for (let y = 0; y < TS; y++) {
        const t = 1 - y / TS;
        const w = (TS * 0.46) * Math.pow(t, 0.65) * (0.75 + 0.25 * Math.sin(y * 0.4));
        const a = Math.pow(t, 0.7);
        for (let s = 0; s < 2; s++) {
          const ww = w * (s ? 0.5 : 1);
          const col = s ? 'rgba(255,240,190,' + (a * 0.95) + ')'
            : 'rgba(' + (235 + rng.int(20)) + ',' + (90 + rng.int(80)) + ',20,' + (a * 0.8) + ')';
          ctx.fillStyle = col;
          ctx.fillRect(ox + TS / 2 - ww, oy + y, ww * 2, 1);
        }
      }
      // 顶部撕裂
      for (let i = 0; i < 22; i++) {
        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.clearRect(ox + rng.int(TS), oy + rng.int(TS * 0.4), 2 + rng.int(4), 2 + rng.int(6));
      }
    },
    smoke(ctx, ox, oy, rng) {
      const cx = ox + TS / 2, cy = oy + TS / 2;
      for (let i = 0; i < 26; i++) {
        const a = rng.next() * U.TAU, d = rng.next() * TS * 0.42;
        const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d, r = 5 + rng.int(14);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(190,190,200,' + (0.1 + rng.next() * 0.2) + ')');
        g.addColorStop(1, 'rgba(140,140,150,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, U.TAU); ctx.fill();
      }
    },
    portal(ctx, ox, oy, rng) {
      px(ctx, ox, oy, TS, TS, 'rgba(0,0,0,0)');
      const cx = ox + TS / 2, cy = oy + TS / 2;
      for (let i = 0; i < 220; i++) {
        const t = i / 220;
        const a = t * U.TAU * 4 + rng.gauss() * 0.2;
        const r = 4 + t * 27;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        const al = 0.25 + (1 - t) * 0.7;
        ctx.fillStyle = 'rgba(' + (200 + rng.int(55)) + ',' + (30 + rng.int(60)) + ',' + (20 + rng.int(40)) + ',' + al + ')';
        ctx.fillRect(x, y, 2, 2);
      }
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30);
      g.addColorStop(0, 'rgba(255,220,190,0.95)');
      g.addColorStop(0.4, 'rgba(190,30,20,0.5)');
      g.addColorStop(1, 'rgba(60,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 30, 0, U.TAU); ctx.fill();
    },
    eye(ctx, ox, oy) {
      px(ctx, ox, oy, TS, TS, 'rgba(0,0,0,0)');
      const cx = ox + TS / 2, cy = oy + TS / 2;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 26);
      g.addColorStop(0, 'rgba(255,250,230,1)');
      g.addColorStop(0.2, 'rgba(255,140,40,0.9)');
      g.addColorStop(0.55, 'rgba(180,20,10,0.45)');
      g.addColorStop(1, 'rgba(80,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 26, 0, U.TAU); ctx.fill();
      px(ctx, cx - 2, cy - 9, 4, 18, 'rgba(20,0,0,0.75)');
    },
    brand(ctx, ox, oy, rng) {  // 猩红烙印
      px(ctx, ox, oy, TS, TS, 'rgba(0,0,0,0)');
      ctx.strokeStyle = 'rgba(255,70,50,0.95)'; ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(ox + 20, oy + 12); ctx.lineTo(ox + 44, oy + 12);
      ctx.moveTo(ox + 32, oy + 12); ctx.lineTo(ox + 32, oy + 52);
      ctx.moveTo(ox + 18, oy + 40); ctx.lineTo(ox + 32, oy + 26); ctx.lineTo(ox + 46, oy + 40);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,180,140,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    },
  };

  function splat(ctx, ox, oy, rng, scale, blobs) {
    px(ctx, ox, oy, TS, TS, 'rgba(0,0,0,0)');
    const cx = ox + TS / 2, cy = oy + TS / 2;
    for (let i = 0; i < blobs; i++) {
      const a = rng.next() * U.TAU;
      const d = Math.pow(rng.next(), 0.6) * TS * 0.42 * scale;
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
      const r = (3 + rng.next() * 13) * scale;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const al = 0.55 + rng.next() * 0.45;
      g.addColorStop(0, 'rgba(96,6,8,' + al + ')');
      g.addColorStop(0.65, 'rgba(64,4,6,' + (al * 0.85) + ')');
      g.addColorStop(1, 'rgba(40,2,4,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, U.TAU); ctx.fill();
    }
    // 溅射细点
    for (let i = 0; i < 30 * scale; i++) {
      const a = rng.next() * U.TAU, d = TS * 0.2 + rng.next() * TS * 0.3 * scale;
      ctx.fillStyle = 'rgba(80,4,6,' + (0.3 + rng.next() * 0.5) + ')';
      ctx.fillRect(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1 + rng.int(3), 1 + rng.int(3));
    }
  }

  /* ============================ 构建图集 ============================ */
  const TILE_ORDER = [
    'white', 'dither', 'stone', 'stoneBlood', 'stoneMoss', 'brick', 'flesh', 'bone',
    'wood', 'metal', 'rune', 'floor', 'floorDirt', 'floorBlood', 'ceil', 'grate',
    'blood1', 'blood2', 'blood3', 'blood4', 'gore', 'drop', 'glow', 'flame',
    'smoke', 'portal', 'eye', 'brand',
  ];

  Art.buildAtlas = function () {
    const cv = document.createElement('canvas');
    cv.width = ATLAS; cv.height = ATLAS;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, ATLAS, ATLAS);
    const rng = new U.Rng('eclipse-blade-atlas');

    TILE_ORDER.forEach((name, i) => {
      const tx = (i % COLS) * TS, ty = ((i / COLS) | 0) * TS;
      ctx.save();
      ctx.beginPath(); ctx.rect(tx, ty, TS, TS); ctx.clip();
      (PAINTERS[name] || PAINTERS.white)(ctx, tx, ty, rng);
      ctx.restore();
      // 取像素中心，避免最近邻采样越界串色
      Art.T[name] = [
        (tx + 0.5) / ATLAS, (ty + 0.5) / ATLAS,
        (tx + TS - 0.5) / ATLAS, (ty + TS - 0.5) / ATLAS,
      ];
      if (name === 'dither') Art.ditherUV = [(tx + 0.5) / ATLAS, (ty + 0.5) / ATLAS];
    });
    Art.atlas = cv;
    return cv;
  };

  /* ============================ 体素模型 ============================ */
  /* 模型 = { height, parts:{name:{pivot:[x,y,z], boxes:[[ox,oy,oz,hx,hy,hz,color,emis]] }}, order:[...] }
     盒子坐标在「部件枢轴」局部空间，便于旋转动画。 */

  function B(ox, oy, oz, hx, hy, hz, col, emis) { return [ox, oy, oz, hx, hy, hz, col, emis || 0]; }

  /* 统一朝向约定：模型「正面」指向局部 -Z（与 GL 摄像机一致）。
     模型是按 +Z 为正面写的，这里整体镜像 Z（只翻转盒子中心，
     每个盒子本身仍是正常的轴对齐盒，绕序不受影响）。 */
  function faceMinusZ(model) {
    for (const pn of model.order) {
      const p = model.parts[pn];
      p.pivot[2] = -p.pivot[2];
      for (const b of p.boxes) b[2] = -b[2];
    }
    return model;
  }

  // 人形骨架：躯干/头/双臂/双腿 + 可选配件
  function mkHumanoid(o) {
    const s = o.scale || 1;
    const skin = U.hex(o.skin), dark = U.mulc(skin, 0.62), cloth = U.hex(o.cloth || '#241c22');
    const bone = U.hex(o.bone || '#b8b09a'), eye = U.hex(o.eye || '#ff5a20');
    const H = o.height || 1.75;
    const torsoY = H * 0.56, headY = H * 0.86, hipY = H * 0.47, shoY = H * 0.72;
    const bw = (o.bulk || 1) * 0.17 * s;    // 半宽
    const parts = {}, order = [];
    const add = (n, pivot, boxes) => { parts[n] = { pivot: pivot, boxes: boxes }; order.push(n); };

    // 躯干
    const tb = [
      B(0, 0.02, 0, bw * 1.15, H * 0.16, bw * 0.72, skin),
      B(0, -0.16 * H * 0.5, 0, bw * 0.98, H * 0.10, bw * 0.62, dark),
    ];
    if (o.ribs) {   // 外露肋骨
      for (let i = 0; i < 3; i++) tb.push(B(0, 0.02 + i * 0.055 * s, bw * 0.66, bw * 0.9, 0.016 * s, 0.012 * s, bone));
    }
    if (o.armor) {  // 肩甲
      tb.push(B(-bw * 1.4, H * 0.13, 0, bw * 0.55, H * 0.055, bw * 0.8, U.hex('#3d3f45')));
      tb.push(B(bw * 1.4, H * 0.13, 0, bw * 0.55, H * 0.055, bw * 0.8, U.hex('#3d3f45')));
      tb.push(B(0, H * 0.02, bw * 0.75, bw * 1.0, H * 0.11, 0.03 * s, U.hex('#4a4d54')));
    }
    if (o.robe) {   // 长袍下摆
      tb.push(B(0, -H * 0.22, 0, bw * 1.25, H * 0.22, bw * 0.95, cloth));
      tb.push(B(0, -H * 0.40, 0, bw * 1.45, H * 0.12, bw * 1.1, U.mulc(cloth, 0.7)));
    }
    add('torso', [0, torsoY, 0], tb);

    // 头
    const hb = [B(0, 0, 0, bw * 0.66, bw * 0.68, bw * 0.62, skin)];
    if (o.jaw) hb.push(B(0, -bw * 0.55, bw * 0.2, bw * 0.42, bw * 0.22, bw * 0.4, dark));
    if (o.hood) {
      hb.push(B(0, bw * 0.14, -bw * 0.1, bw * 0.86, bw * 0.8, bw * 0.8, cloth));
      hb.push(B(0, 0, bw * 0.62, bw * 0.5, bw * 0.42, bw * 0.12, U.hex('#0a0709')));
    }
    if (o.horns) {
      for (const sx of [-1, 1]) {
        hb.push(B(sx * bw * 0.5, bw * 0.7, -bw * 0.1, bw * 0.13, bw * 0.34, bw * 0.13, bone));
        hb.push(B(sx * bw * 0.72, bw * 1.16, -bw * 0.3, bw * 0.1, bw * 0.26, bw * 0.1, bone));
      }
    }
    if (o.helm) {
      hb.push(B(0, bw * 0.36, 0, bw * 0.78, bw * 0.3, bw * 0.74, U.hex('#43464d')));
      hb.push(B(0, bw * 0.62, 0, bw * 0.14, bw * 0.2, bw * 0.66, U.hex('#5a5e66')));
    }
    // 发光眼
    hb.push(B(-bw * 0.28, bw * 0.1, bw * 0.6, bw * 0.14, bw * 0.09, bw * 0.06, eye, 1));
    hb.push(B(bw * 0.28, bw * 0.1, bw * 0.6, bw * 0.14, bw * 0.09, bw * 0.06, eye, 1));
    add('head', [0, headY, 0], hb);

    // 手臂（枢轴在肩）
    const armLen = H * (o.longArms ? 0.34 : 0.27);
    const mkArm = (sx, big) => {
      const w = bw * (big ? 0.42 : 0.26);
      const a = [
        B(0, -armLen * 0.45, 0, w, armLen * 0.45, w * 0.9, skin),
        B(0, -armLen * 0.95, 0, w * 0.9, armLen * 0.2, w * 0.85, dark),   // 手
      ];
      if (o.claws) for (let i = -1; i <= 1; i++)
        a.push(B(i * w * 0.5, -armLen * 1.2, w * 0.2, w * 0.14, armLen * 0.16, w * 0.14, bone));
      if (big) a.push(B(0, -armLen * 0.5, 0, w * 1.15, armLen * 0.2, w * 1.05, U.mulc(skin, 0.8)));
      return a;
    };
    add('armL', [-bw * 1.25, shoY, 0], mkArm(-1, o.bigArmL));
    add('armR', [bw * 1.25, shoY, 0], mkArm(1, o.bigArmR));

    // 腿（枢轴在髋）
    const legLen = hipY * 0.92;
    const mkLeg = () => [
      B(0, -legLen * 0.5, 0, bw * 0.34, legLen * 0.5, bw * 0.36, o.robe ? cloth : skin),
      B(0, -legLen * 0.98, bw * 0.1, bw * 0.34, legLen * 0.09, bw * 0.5, dark),
    ];
    if (!o.floating) {
      add('legL', [-bw * 0.6, hipY, 0], mkLeg());
      add('legR', [bw * 0.6, hipY, 0], mkLeg());
    }
    if (o.tatters) {  // 破布残片（漂浮怪）
      const tb2 = [];
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * U.TAU;
        tb2.push(B(Math.cos(a) * bw * 0.9, -H * (0.16 + (i % 3) * 0.07), Math.sin(a) * bw * 0.9,
          bw * 0.2, H * (0.12 + (i % 3) * 0.06), bw * 0.14, U.mulc(cloth, 0.8 + (i % 2) * 0.3)));
      }
      add('tatter', [0, torsoY - H * 0.1, 0], tb2);
    }
    return faceMinusZ({
      height: H, radius: bw * 1.6, parts: parts, order: order,
      gait: o.floating ? 'float' : 'walk',
      legs: o.floating ? [] : ['legL', 'legR'], arms: ['armL', 'armR'],
    });
  }

  // 四足猎犬
  function mkQuadruped(o) {
    const s = o.scale || 1, skin = U.hex(o.skin), dark = U.mulc(skin, 0.6);
    const bone = U.hex(o.bone || '#c2b9a2'), eye = U.hex(o.eye || '#ff3c14');
    const H = o.height || 0.95, L = o.length || 1.5;
    const parts = {}, order = [];
    const add = (n, p, b) => { parts[n] = { pivot: p, boxes: b }; order.push(n); };
    const bw = 0.17 * s;

    const body = [
      B(0, 0, 0, bw * 1.05, bw * 1.0, L * 0.36, skin),
      B(0, bw * 0.6, -L * 0.05, bw * 0.7, bw * 0.5, L * 0.3, dark),
    ];
    for (let i = 0; i < 5; i++)  // 脊刺
      body.push(B(0, bw * 1.2, -L * 0.28 + i * L * 0.14, bw * 0.09, bw * (0.3 - i * 0.03), bw * 0.14, bone));
    add('torso', [0, H * 0.62, 0], body);

    const head = [
      B(0, 0, 0, bw * 0.62, bw * 0.58, bw * 0.7, skin),
      B(0, -bw * 0.18, bw * 1.0, bw * 0.4, bw * 0.3, bw * 0.5, dark),      // 吻
      B(0, -bw * 0.42, bw * 1.1, bw * 0.36, bw * 0.1, bw * 0.44, U.hex('#4a1418')),  // 下颌
    ];
    for (let i = -1; i <= 1; i += 2) {
      head.push(B(i * bw * 0.22, -bw * 0.3, bw * 1.42, bw * 0.07, bw * 0.14, bw * 0.07, bone));  // 獠牙
      head.push(B(i * bw * 0.42, bw * 0.52, -bw * 0.1, bw * 0.13, bw * 0.24, bw * 0.1, dark));   // 耳
      head.push(B(i * bw * 0.3, bw * 0.12, bw * 0.62, bw * 0.12, bw * 0.09, bw * 0.06, eye, 1));
    }
    add('head', [0, H * 0.78, L * 0.36], head);

    const legLen = H * 0.6;
    const mkLeg = () => [
      B(0, -legLen * 0.5, 0, bw * 0.22, legLen * 0.5, bw * 0.22, skin),
      B(0, -legLen * 0.96, bw * 0.08, bw * 0.24, legLen * 0.1, bw * 0.32, dark),
    ];
    add('legL', [-bw * 0.85, H * 0.6, L * 0.24], mkLeg());
    add('legR', [bw * 0.85, H * 0.6, L * 0.24], mkLeg());
    add('legL2', [-bw * 0.85, H * 0.6, -L * 0.26], mkLeg());
    add('legR2', [bw * 0.85, H * 0.6, -L * 0.26], mkLeg());
    add('tail', [0, H * 0.66, -L * 0.36], [
      B(0, 0, -L * 0.14, bw * 0.13, bw * 0.13, L * 0.16, dark),
      B(0, 0, -L * 0.3, bw * 0.08, bw * 0.08, L * 0.1, bone),
    ]);
    return faceMinusZ({
      height: H, radius: bw * 1.5, parts: parts, order: order, gait: 'quad',
      legs: ['legL', 'legR', 'legL2', 'legR2'], arms: [],
    });
  }

  /* ---------- 具体敌人模型 ---------- */
  const MODEL_DEFS = {
    ghoul: () => mkHumanoid({
      height: 1.72, skin: '#6b6f5c', cloth: '#2a2622', eye: '#ff6a20',
      bulk: 0.95, ribs: true, jaw: true, longArms: true, claws: true,
    }),
    cultist: () => mkHumanoid({
      height: 1.76, skin: '#8d8f86', cloth: '#241a2e', eye: '#c04bff',
      bulk: 1.0, robe: true, hood: true,
    }),
    brute: () => mkHumanoid({
      height: 2.45, skin: '#7a5f52', cloth: '#2b2320', eye: '#ffb020',
      bulk: 1.85, armor: true, helm: true, bigArmR: true, jaw: true,
    }),
    wraith: () => mkHumanoid({
      height: 1.9, skin: '#4a4f63', cloth: '#171a26', eye: '#8ad8ff',
      bulk: 0.85, floating: true, tatters: true, hood: true, claws: true, longArms: true,
    }),
    hound: () => mkQuadruped({ height: 0.98, length: 1.55, skin: '#5a3a34', eye: '#ff3c14' }),
    // Boss：巨大化 + 独臂巨刃
    apostle: () => mkHumanoid({
      height: 3.9, skin: '#8a4a44', cloth: '#301a1a', eye: '#ff2a10',
      bulk: 2.5, horns: true, jaw: true, ribs: true, bigArmR: true, bigArmL: true, claws: true,
    }),
    bishop: () => mkHumanoid({
      height: 3.3, skin: '#6d6a52', cloth: '#1d2430', eye: '#7cff9a',
      bulk: 2.1, floating: true, tatters: true, robe: true, hood: true, longArms: true, claws: true,
    }),
    lord: () => mkHumanoid({
      height: 4.8, skin: '#4d4a5c', cloth: '#0f0d16', eye: '#ff1e0a',
      bulk: 3.0, horns: true, armor: true, bigArmR: true, bigArmL: true, claws: true, ribs: true,
    }),
  };

  Art.getModel = function (name) {
    if (!Art._models[name]) {
      const f = MODEL_DEFS[name] || MODEL_DEFS.ghoul;
      Art._models[name] = f();
      Art._models[name].name = name;
    }
    return Art._models[name];
  };

  /* ---------- 巨剑（第一人称手持模型） ---------- */
  // 局部空间：剑柄尾端在原点，刃沿 -Z（朝前）延伸；厚度沿 X
  Art.buildSword = function () {
    const steel = U.hex('#5a5f68'), steelD = U.hex('#3a3e45'), edge = U.hex('#9aa2ad');
    const rust = U.hex('#4b3226'), grip = U.hex('#241a14'), gold = U.hex('#8d7130');
    const boxes = [];
    const L = 2.15;           // 全长
    const bw = 0.115;         // 刃半宽（很夸张的一大块铁）
    const th = 0.028;         // 半厚
    // 柄
    boxes.push(B(0, 0, 0.10, th * 1.5, th * 1.5, 0.20, grip));
    boxes.push(B(0, 0, 0.24, th * 2.2, th * 2.2, 0.05, gold));      // 缠绳环
    boxes.push(B(0, 0, -0.02, th * 2.6, th * 2.6, 0.05, rust));     // 尾锤
    // 护手
    boxes.push(B(0, 0, -0.30, th * 1.2, 0.052, 0.055, steelD));
    boxes.push(B(0, 0.075, -0.30, th * 1.0, 0.03, 0.04, gold));
    // 剑身：分段轻微收窄
    const segs = 7;
    for (let i = 0; i < segs; i++) {
      const t = i / (segs - 1);
      const z = -0.42 - t * (L - 0.6);
      const w = bw * (1.0 - t * 0.30);
      const hh = 0.5 * (L - 0.6) / segs + 0.01;
      const c = i % 2 ? steel : U.mulc(steel, 0.93);
      boxes.push(B(0, 0, z - hh, th, w, hh, c));
      // 刃口高光（上下两侧）
      boxes.push(B(th * 0.85, 0, z - hh, th * 0.3, w * 1.02, hh, edge));
      boxes.push(B(-th * 0.85, 0, z - hh, th * 0.3, w * 1.02, hh, U.mulc(edge, 0.72)));
    }
    // 剑尖
    boxes.push(B(0, 0, -L - 0.03, th * 0.9, bw * 0.5, 0.075, steel));
    // 缺口与锈斑（视觉细节）
    boxes.push(B(0, bw * 0.62, -1.02, th * 1.1, 0.022, 0.05, U.hex('#231a16')));
    boxes.push(B(0, -bw * 0.5, -1.55, th * 1.1, 0.02, 0.045, U.hex('#2a1e18')));
    return {
      name: 'sword', length: L, halfW: bw,
      parts: { blade: { pivot: [0, 0, 0], boxes: boxes } },
      order: ['blade'],
    };
  };

  /* ---------- 道具模型 ---------- */
  Art.buildItem = function (kind) {
    const key = 'item_' + kind;
    if (Art._models[key]) return Art._models[key];
    let boxes = [];
    if (kind === 'heart') {
      const c = U.hex('#b01820'), c2 = U.hex('#e4343c');
      boxes = [
        B(0, 0, 0, 0.09, 0.08, 0.07, c),
        B(-0.055, 0.075, 0, 0.05, 0.045, 0.055, c2),
        B(0.055, 0.075, 0, 0.05, 0.045, 0.055, c2),
        B(0, -0.09, 0, 0.045, 0.05, 0.04, U.hex('#701014')),
        B(0, 0.02, 0.075, 0.03, 0.03, 0.02, U.hex('#ff6a6a'), 0.6),
      ];
    } else if (kind === 'soul') {
      const c = U.hex('#ffd070');
      boxes = [
        B(0, 0, 0, 0.045, 0.075, 0.045, c, 1),
        B(0, 0.09, 0, 0.025, 0.03, 0.025, U.hex('#fff0c0'), 1),
      ];
    } else if (kind === 'brand') {
      const c = U.hex('#ff3820');
      boxes = [
        B(0, 0.02, 0, 0.1, 0.014, 0.014, c, 1),
        B(0, -0.03, 0, 0.014, 0.075, 0.014, c, 1),
        B(-0.05, -0.05, 0, 0.05, 0.014, 0.014, c, 1),
        B(0.05, -0.05, 0, 0.05, 0.014, 0.014, c, 1),
      ];
    } else if (kind === 'relic') {
      boxes = [
        B(0, 0, 0, 0.075, 0.075, 0.075, U.hex('#2a2230')),
        B(0, 0.085, 0, 0.045, 0.03, 0.045, U.hex('#c8a44c'), 0.5),
        B(0, 0.13, 0, 0.028, 0.03, 0.028, U.hex('#ff5030'), 1),
      ];
    } else { // shard 默认
      boxes = [B(0, 0, 0, 0.05, 0.06, 0.05, U.hex('#d0d8e0'), 0.8)];
    }
    const m = { name: key, parts: { body: { pivot: [0, 0, 0], boxes: boxes } }, order: ['body'], height: 0.3 };
    Art._models[key] = m;
    return m;
  };

  /* ---------- 把模型写入动态网格 ---------- */
  // mats: {partName: mat4}，缺省用单位；base = 整体矩阵已合并进 mats
  Art.emitPart = function (mb, part, mat, tileUV, light, colMul, emisAdd, alphaSkip) {
    const boxes = part.boxes;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      const c = b[6];
      const col = colMul ? [c[0] * colMul[0], c[1] * colMul[1], c[2] * colMul[2]] : c;
      mb.boxM(mat, b[0], b[1], b[2], b[3], b[4], b[5], tileUV, col, light, Math.min(1, (b[7] || 0) + (emisAdd || 0)));
    }
  };

  Art.TS = TS; Art.ATLAS = ATLAS;
  G.Art = Art;
})();
