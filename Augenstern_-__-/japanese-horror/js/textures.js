// ============ PS1 风格程序化纹理 ============
const Tex = (() => {
  const cache = {};

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  function toTex(c, repeat = [1, 1]) {
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
    return t;
  }
  function rnd(seed) {
    let s = seed;
    return () => (s = (s * 16807 + 12345) % 2147483647) / 2147483647;
  }
  function noiseFill(ctx, w, h, base, vary, r) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const f = 1 - vary / 2 + r() * vary;
      ctx.fillStyle = shade(base, f);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, ((n >> 16) & 255) * f) | 0;
    const g = Math.min(255, ((n >> 8) & 255) * f) | 0;
    const b = Math.min(255, (n & 255) * f) | 0;
    return `rgb(${r},${g},${b})`;
  }
  function stains(ctx, w, h, color, count, r, maxR = 14) {
    for (let i = 0; i < count; i++) {
      const cx = r() * w, cy = r() * h, cr = 3 + r() * maxR;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
      grad.addColorStop(0, color);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(cx - cr, cy - cr, cr * 2, cr * 2);
    }
  }

  // ---------- 墙纸 (发霉/剥落) ----------
  function wallpaper() {
    const w = 64, h = 64, c = canvas(w, h), ctx = c.getContext('2d');
    const r = rnd(101);
    noiseFill(ctx, w, h, '#8a8272', 0.14, r);
    // 竖条纹图案
    for (let x = 0; x < w; x += 8) {
      ctx.fillStyle = 'rgba(110,102,86,0.5)';
      ctx.fillRect(x, 0, 1, h);
      ctx.fillStyle = 'rgba(150,142,120,0.3)';
      ctx.fillRect(x + 4, 0, 1, h);
    }
    // 小花纹
    for (let y = 4; y < h; y += 12) for (let x = 4; x < w; x += 8) {
      if (r() < 0.7) {
        ctx.fillStyle = 'rgba(122,112,92,0.55)';
        ctx.fillRect(x, y + ((r() * 3) | 0), 2, 2);
      }
    }
    // 霉斑
    stains(ctx, w, h, 'rgba(48,58,44,0.5)', 7, r);
    stains(ctx, w, h, 'rgba(30,34,28,0.55)', 4, r, 8);
    // 底部污渍
    const grad = ctx.createLinearGradient(0, h - 22, 0, h);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(1, 'rgba(40,42,34,0.65)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, h - 22, w, 22);
    return c;
  }

  // ---------- 剥落墙面 (露出灰泥) ----------
  function wallPeel() {
    const c = wallpaper(), ctx = c.getContext('2d');
    const r = rnd(202);
    for (let i = 0; i < 4; i++) {
      const px = r() * 40, py = r() * 34, pw = 8 + r() * 18, ph = 10 + r() * 22;
      ctx.fillStyle = shade('#6a6258', 0.9 + r() * 0.2);
      ctx.beginPath();
      ctx.moveTo(px + r() * 4, py);
      ctx.lineTo(px + pw, py + r() * 6);
      ctx.lineTo(px + pw - r() * 5, py + ph);
      ctx.lineTo(px, py + ph - r() * 4);
      ctx.closePath();
      ctx.fill();
      // 撕裂边缘
      ctx.strokeStyle = 'rgba(30,28,24,0.8)';
      ctx.stroke();
      // 灰泥噪点
      for (let j = 0; j < 40; j++) {
        ctx.fillStyle = `rgba(90,84,74,${0.3 + r() * 0.4})`;
        ctx.fillRect(px + r() * pw, py + r() * ph, 1, 1);
      }
    }
    return c;
  }

  // ---------- 木门 ----------
  function doorWood(seed = 301) {
    const w = 64, h = 128, c = canvas(w, h), ctx = c.getContext('2d');
    const r = rnd(seed);
    // 木纹底
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const grain = Math.sin(x * 0.6 + Math.sin(y * 0.05) * 3) * 0.06;
      ctx.fillStyle = shade('#5a4632', 0.86 + grain + r() * 0.12);
      ctx.fillRect(x, y, 1, 1);
    }
    // 门板凹槽
    ctx.strokeStyle = 'rgba(28,20,14,0.85)';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, w - 16, 46);
    ctx.strokeRect(8, 64, w - 16, 52);
    ctx.strokeStyle = 'rgba(120,98,72,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, w - 20, 42);
    ctx.strokeRect(10, 66, w - 20, 48);
    // 污渍
    stains(ctx, w, h, 'rgba(24,20,16,0.4)', 6, r, 10);
    return c;
  }

  // ---------- 门牌 ----------
  function doorPlate(text) {
    const c = canvas(32, 16), ctx = c.getContext('2d');
    ctx.fillStyle = '#b8b4a8';
    ctx.fillRect(0, 0, 32, 16);
    ctx.strokeStyle = '#6a665c';
    ctx.strokeRect(0.5, 0.5, 31, 15);
    ctx.fillStyle = '#3a362e';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 16, 9);
    return c;
  }

  // ---------- 地板 ----------
  function floorWood() {
    const w = 64, h = 64, c = canvas(w, h), ctx = c.getContext('2d');
    const r = rnd(303);
    for (let py = 0; py < h; py += 16) {
      const off = (py / 16) % 2 === 0 ? 0 : 32;
      for (let px = -32; px < w; px += 64) {
        const bx = px + off;
        for (let y = 0; y < 16; y++) for (let x = 0; x < 64; x++) {
          const gx = bx + x;
          if (gx < 0 || gx >= w) continue;
          const grain = Math.sin(gx * 0.4 + y * 0.08) * 0.05;
          ctx.fillStyle = shade('#4a3826', 0.8 + grain + r() * 0.16);
          ctx.fillRect(gx, py + y, 1, 1);
        }
        ctx.fillStyle = 'rgba(16,12,8,0.9)';
        ctx.fillRect(Math.max(0, bx), py, 1, 16);
      }
      ctx.fillStyle = 'rgba(16,12,8,0.9)';
      ctx.fillRect(0, py, w, 1);
    }
    stains(ctx, w, h, 'rgba(20,18,14,0.5)', 8, r, 12);
    // 潮湿反光点
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = 'rgba(140,150,140,0.12)';
      ctx.fillRect(r() * w, r() * h, 2, 1);
    }
    return c;
  }

  // ---------- 天花板 ----------
  function ceiling() {
    const w = 64, h = 64, c = canvas(w, h), ctx = c.getContext('2d');
    const r = rnd(404);
    noiseFill(ctx, w, h, '#5f5b52', 0.12, r);
    // 板材缝
    for (let y = 0; y < h; y += 21) {
      ctx.fillStyle = 'rgba(30,28,24,0.8)';
      ctx.fillRect(0, y, w, 1);
    }
    for (let x = 0; x < w; x += 21) {
      ctx.fillStyle = 'rgba(30,28,24,0.6)';
      ctx.fillRect(x, 0, 1, h);
    }
    stains(ctx, w, h, 'rgba(58,54,40,0.55)', 6, r);
    stains(ctx, w, h, 'rgba(30,32,26,0.5)', 3, r, 18);
    return c;
  }

  // ---------- 榻榻米 ----------
  function tatami() {
    const w = 64, h = 64, c = canvas(w, h), ctx = c.getContext('2d');
    const r = rnd(505);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const weave = (x % 2 === 0) ? 0.06 : -0.03;
      ctx.fillStyle = shade('#6e6a48', 0.85 + weave + r() * 0.1);
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.fillStyle = 'rgba(28,26,18,0.85)';
    ctx.fillRect(0, 30, w, 3);
    ctx.fillStyle = 'rgba(40,36,26,0.9)';
    ctx.fillRect(30, 0, 3, h);
    stains(ctx, w, h, 'rgba(40,38,26,0.45)', 6, r);
    return c;
  }

  // ---------- 封窗木板 ----------
  function boards() {
    const w = 64, h = 64, c = canvas(w, h), ctx = c.getContext('2d');
    const r = rnd(606);
    ctx.fillStyle = '#181a17';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 5; i++) {
      const y = i * 13 + r() * 3, ang = (r() - 0.5) * 0.12;
      ctx.save();
      ctx.translate(32, y + 5);
      ctx.rotate(ang);
      for (let x = -34; x < 34; x++) {
        ctx.fillStyle = shade('#4e3e2c', 0.8 + r() * 0.2 + Math.sin(x * 0.5) * 0.05);
        ctx.fillRect(x, -4, 1, 9);
      }
      ctx.fillStyle = '#22201a';
      ctx.fillRect(-30, -1, 2, 2);
      ctx.fillRect(28, -1, 2, 2);
      ctx.restore();
    }
    return c;
  }

  // ---------- 纸符 ----------
  function ofuda() {
    const c = canvas(16, 40), ctx = c.getContext('2d');
    const r = rnd(707);
    noiseFill(ctx, 16, 40, '#c8bea0', 0.1, r);
    ctx.strokeStyle = '#8a2020';
    ctx.lineWidth = 1;
    ctx.strokeRect(1.5, 1.5, 13, 37);
    // 抽象朱印纹样 (纵向笔画)
    ctx.fillStyle = '#7a1a1a';
    ctx.fillRect(7, 5, 2, 8);
    ctx.fillRect(4, 9, 8, 2);
    ctx.fillRect(6, 15, 4, 2);
    ctx.fillRect(7, 17, 2, 7);
    ctx.fillRect(4, 26, 8, 2);
    ctx.fillRect(5, 30, 2, 5);
    ctx.fillRect(9, 30, 2, 5);
    return c;
  }

  // ---------- 旧报纸 ----------
  function newspaper() {
    const c = canvas(32, 32), ctx = c.getContext('2d');
    const r = rnd(808);
    noiseFill(ctx, 32, 32, '#a89e88', 0.08, r);
    // 抽象文字行
    for (let y = 4; y < 30; y += 4) {
      for (let x = 3; x < 29; x += 2) {
        if (r() < 0.82) {
          ctx.fillStyle = `rgba(40,36,30,${0.4 + r() * 0.4})`;
          ctx.fillRect(x, y, 1, 2);
        }
      }
    }
    ctx.fillStyle = 'rgba(40,36,30,0.85)';
    ctx.fillRect(3, 0, 18, 3);
    return c;
  }

  // ---------- 混凝土 ----------
  function concrete() {
    const w = 64, h = 64, c = canvas(w, h), ctx = c.getContext('2d');
    const r = rnd(909);
    noiseFill(ctx, w, h, '#55534e', 0.16, r);
    stains(ctx, w, h, 'rgba(34,34,30,0.5)', 8, r);
    // 裂缝
    for (let i = 0; i < 3; i++) {
      let x = r() * w, y = 0;
      ctx.fillStyle = 'rgba(20,20,18,0.7)';
      while (y < h) {
        ctx.fillRect(x | 0, y | 0, 1, 2);
        x += (r() - 0.5) * 3;
        y += 1 + r() * 2;
      }
    }
    return c;
  }

  // ---------- 电梯金属 ----------
  function elevatorMetal() {
    const w = 64, h = 64, c = canvas(w, h), ctx = c.getContext('2d');
    const r = rnd(111);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = 0.8 + Math.sin(y * 0.8) * 0.04 + r() * 0.08;
      ctx.fillStyle = shade('#6a6e70', v);
      ctx.fillRect(x, y, 1, 1);
    }
    // 中缝
    ctx.fillStyle = '#1c1e1f';
    ctx.fillRect(31, 0, 2, h);
    // 锈迹
    stains(ctx, w, h, 'rgba(96,60,34,0.4)', 6, r, 8);
    stains(ctx, w, h, 'rgba(30,30,28,0.4)', 5, r);
    return c;
  }

  // ---------- 怪物皮肤 ----------
  function monsterSkin() {
    const w = 32, h = 32, c = canvas(w, h), ctx = c.getContext('2d');
    const r = rnd(666);
    noiseFill(ctx, w, h, '#9a9488', 0.12, r);
    stains(ctx, w, h, 'rgba(90,78,66,0.5)', 8, r, 6);
    stains(ctx, w, h, 'rgba(60,56,50,0.45)', 5, r, 4);
    return c;
  }
  function monsterFace() {
    const w = 32, h = 32, c = canvas(w, h), ctx = c.getContext('2d');
    const r = rnd(667);
    noiseFill(ctx, w, h, '#a29a8c', 0.1, r);
    // 空洞双眼 (模糊黑窝)
    [[10, 13], [22, 13]].forEach(([x, y]) => {
      const g = ctx.createRadialGradient(x, y, 0.5, x, y, 5);
      g.addColorStop(0, 'rgba(8,6,6,0.95)');
      g.addColorStop(0.6, 'rgba(20,16,14,0.7)');
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.fillRect(x - 5, y - 5, 10, 10);
    });
    // 无口 — 仅一道浅痕
    ctx.fillStyle = 'rgba(60,52,46,0.5)';
    ctx.fillRect(13, 24, 6, 1);
    return c;
  }

  // ---------- 海报 (褪色) ----------
  function poster(seed = 11) {
    const c = canvas(32, 48), ctx = c.getContext('2d');
    const r = rnd(seed);
    noiseFill(ctx, 32, 48, '#8a8474', 0.1, r);
    ctx.fillStyle = `rgba(${120 + r() * 60 | 0},${80 + r() * 40 | 0},${60 + r() * 30 | 0},0.6)`;
    ctx.fillRect(4, 6, 24, 22);
    ctx.fillStyle = 'rgba(50,46,40,0.7)';
    for (let y = 32; y < 44; y += 4) ctx.fillRect(5, y, 22, 2);
    stains(ctx, 32, 48, 'rgba(60,58,46,0.5)', 4, r, 8);
    return c;
  }

  // ---------- 电视静噪 ----------
  function tvStatic() {
    const c = canvas(32, 24), ctx = c.getContext('2d');
    const r = rnd((Math.random() * 9999) | 0);
    for (let y = 0; y < 24; y++) for (let x = 0; x < 32; x++) {
      const v = (r() * 210 + 20) | 0;
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, 1, 1);
    }
    return c;
  }

  const makers = {
    wallpaper, wallPeel, doorWood, floorWood, ceiling, tatami, boards,
    ofuda, newspaper, concrete, elevatorMetal, monsterSkin, monsterFace,
    poster, tvStatic, doorPlate,
  };

  function get(name, repeat, ...args) {
    const key = name + (args.length ? '_' + args.join('_') : '') + (repeat ? '_' + repeat.join('x') : '');
    if (!cache[key]) cache[key] = toTex(makers[name](...args), repeat);
    return cache[key];
  }
  function mat(name, opts = {}, repeat, ...args) {
    return new THREE.MeshLambertMaterial({ map: get(name, repeat, ...args), ...opts });
  }

  return { get, mat, toTex, makers };
})();
