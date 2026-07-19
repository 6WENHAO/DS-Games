// ============ 程序化 MC 风格 16x16 像素纹理图集 ============
const Textures = (() => {
  const TILE = 16, COLS = 4, ROWS = 4;
  let atlasCanvas, atlasTexture;
  const itemIconCache = {};

  function rngFor(seed) { return Noise.makeRng(seed); }

  function px(g, x, y, c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); }

  function shade(hex, f) {
    const r = Math.min(255, Math.max(0, Math.round(parseInt(hex.slice(1, 3), 16) * f)));
    const g = Math.min(255, Math.max(0, Math.round(parseInt(hex.slice(3, 5), 16) * f)));
    const b = Math.min(255, Math.max(0, Math.round(parseInt(hex.slice(5, 7), 16) * f)));
    return `rgb(${r},${g},${b})`;
  }

  function noisyFill(g, base, seed, variance = 0.18) {
    const rng = rngFor(seed);
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++)
        px(g, x, y, shade(base, 1 - variance / 2 + rng() * variance));
  }

  function speckle(g, color, seed, count, size = 1) {
    const rng = rngFor(seed);
    for (let i = 0; i < count; i++) {
      const x = Math.floor(rng() * TILE), y = Math.floor(rng() * TILE);
      g.fillStyle = color; g.fillRect(x, y, size, size);
    }
  }

  const painters = {
    // 0 草顶 (画成灰白, 用顶点色染色)
    0(g) { noisyFill(g, '#b8b8b8', 11, 0.3); speckle(g, 'rgba(255,255,255,.35)', 12, 14); },
    // 1 草侧
    1(g) {
      noisyFill(g, '#8f6b4d', 21, 0.22);
      const rng = rngFor(22);
      for (let x = 0; x < TILE; x++) {
        const h = 3 + Math.floor(rng() * 3);
        for (let y = 0; y < h; y++) px(g, x, y, shade('#b0b0b0', 0.8 + rng() * 0.45));
      }
    },
    // 2 泥土
    2(g) { noisyFill(g, '#8f6b4d', 31, 0.24); speckle(g, '#6b4c33', 32, 12, 2); speckle(g, '#a58261', 33, 10); },
    // 3 岩石
    3(g) { noisyFill(g, '#8a8f94', 41, 0.16); speckle(g, '#70757a', 42, 10, 2); speckle(g, '#9fa5ab', 43, 8); },
    // 4 磁化矿 (岩石+橙金块斑)
    4(g) {
      painters[3](g);
      const rng = rngFor(51);
      for (let i = 0; i < 5; i++) {
        const x = 1 + Math.floor(rng() * 12), y = 1 + Math.floor(rng() * 12);
        g.fillStyle = '#e0913a'; g.fillRect(x, y, 2, 2);
        g.fillStyle = '#ffc06a'; g.fillRect(x, y, 1, 1);
      }
    },
    // 5 铜矿
    5(g) {
      painters[3](g);
      const rng = rngFor(61);
      for (let i = 0; i < 5; i++) {
        const x = 1 + Math.floor(rng() * 12), y = 1 + Math.floor(rng() * 12);
        g.fillStyle = '#3fc9a0'; g.fillRect(x, y, 2, 2);
        g.fillStyle = '#8affd8'; g.fillRect(x + 1, y, 1, 1);
      }
    },
    // 6 木干侧
    6(g) {
      const rng = rngFor(71);
      for (let x = 0; x < TILE; x++) {
        const c = shade('#5d4630', 0.85 + (x % 4 === 0 ? -0.2 : rng() * 0.3));
        for (let y = 0; y < TILE; y++) px(g, x, y, shade('#5d4630', 0.8 + ((x + 2) % 5 === 0 ? -0.15 : 0) + rng() * 0.25));
      }
      for (let x = 0; x < TILE; x += 5) for (let y = 0; y < TILE; y++) px(g, x, y, '#3e2e1e');
    },
    // 7 木干顶 (年轮)
    7(g) {
      noisyFill(g, '#8a6a44', 81, 0.15);
      g.strokeStyle = '#5d4630';
      for (let r = 2; r <= 7; r += 2.5) { g.beginPath(); g.arc(8, 8, r, 0, 7); g.stroke(); }
    },
    // 8 树叶 (灰白, 顶点色染色, 带透明孔)
    8(g) {
      const rng = rngFor(91);
      for (let y = 0; y < TILE; y++)
        for (let x = 0; x < TILE; x++) {
          if (rng() < 0.16) continue; // 透明孔
          px(g, x, y, shade('#a8a8a8', 0.65 + rng() * 0.6));
        }
    },
    // 9 砂砾
    9(g) { noisyFill(g, '#d9c88f', 101, 0.14); speckle(g, '#b8a469', 102, 12); speckle(g, '#efe2b0', 103, 10); },
    // 10 钠花 (交叉面片: 黄色发光植物)
    10(g) {
      const rng = rngFor(111);
      g.clearRect(0, 0, TILE, TILE);
      // 茎
      for (let y = 8; y < 16; y++) px(g, 7 + (y % 2 ? 1 : 0), y, '#4a6b35');
      // 花球
      for (let i = 0; i < 26; i++) {
        const a = rng() * Math.PI * 2, r = rng() * 3.6;
        px(g, Math.round(8 + Math.cos(a) * r), Math.round(5 + Math.sin(a) * r * 0.9), rng() < 0.4 ? '#ffe066' : '#ffb830');
      }
      px(g, 8, 5, '#fff6c0'); px(g, 7, 4, '#fff6c0');
    },
    // 11 二氢晶体 (蓝色晶簇)
    11(g) {
      g.clearRect(0, 0, TILE, TILE);
      const rng = rngFor(121);
      const spikes = [[3, 15, 5, 6], [8, 15, 3, 3], [12, 15, 4, 8], [6, 15, 2, 10]];
      spikes.forEach(([cx, base, w, h]) => {
        for (let y = 0; y <= h; y++) {
          const ww = Math.max(1, Math.round(w * (1 - y / h)));
          for (let x = -ww; x <= ww; x++) {
            const c = x === 0 ? '#bfeaff' : (x < 0 ? '#5fb8e8' : '#2f88c8');
            px(g, cx + x, base - y, c);
          }
        }
        px(g, cx, base - h, '#ffffff');
      });
    },
    // 12 产氧红花
    12(g) {
      const rng = rngFor(131);
      g.clearRect(0, 0, TILE, TILE);
      for (let y = 7; y < 16; y++) px(g, 8, y, '#3f6b30');
      px(g, 6, 10, '#3f6b30'); px(g, 10, 11, '#3f6b30');
      const petals = [[8, 4], [6, 5], [10, 5], [7, 3], [9, 3], [8, 6], [6, 3], [10, 3]];
      petals.forEach(([x, y]) => { px(g, x, y, '#e84a3a'); });
      px(g, 8, 4, '#ffd0a0');
      speckle(g, '#ff7a60', 132, 5);
    },
    // 13 风化石 (异星红岩)
    13(g) { noisyFill(g, '#b06a4a', 141, 0.2); speckle(g, '#8a4a30', 142, 12, 2); speckle(g, '#d08a60', 143, 8); },
    // 14 地形方块 (玩家放置, 科技感)
    14(g) {
      noisyFill(g, '#6a7a82', 151, 0.08);
      g.strokeStyle = '#4a565c'; g.strokeRect(0.5, 0.5, 15, 15);
      g.fillStyle = '#8fd8e8'; g.fillRect(7, 7, 2, 2);
    },
    // 15 钴蓝晶簇
    15(g) {
      noisyFill(g, '#2a3a6a', 161, 0.25);
      const rng = rngFor(162);
      for (let i = 0; i < 6; i++) {
        const x = 1 + Math.floor(rng() * 13), y = 1 + Math.floor(rng() * 13);
        g.fillStyle = '#5a7aff'; g.fillRect(x, y, 2, 2);
        g.fillStyle = '#b0c8ff'; g.fillRect(x, y, 1, 1);
      }
    },
  };

  function buildAtlas() {
    atlasCanvas = document.createElement('canvas');
    atlasCanvas.width = TILE * COLS; atlasCanvas.height = TILE * ROWS;
    const g = atlasCanvas.getContext('2d');
    g.clearRect(0, 0, atlasCanvas.width, atlasCanvas.height);
    for (let i = 0; i < COLS * ROWS; i++) {
      if (!painters[i]) continue;
      const tx = (i % COLS) * TILE, ty = Math.floor(i / COLS) * TILE;
      g.save(); g.translate(tx, ty);
      const sub = document.createElement('canvas');
      sub.width = TILE; sub.height = TILE;
      painters[i](sub.getContext('2d'));
      g.drawImage(sub, 0, 0);
      g.restore();
    }
    atlasTexture = new THREE.CanvasTexture(atlasCanvas);
    atlasTexture.magFilter = THREE.NearestFilter;
    atlasTexture.minFilter = THREE.NearestFilter;
    atlasTexture.generateMipmaps = false;
    return atlasTexture;
  }

  function uvFor(tileIdx) {
    const u0 = (tileIdx % COLS) / COLS, v0 = 1 - (Math.floor(tileIdx / COLS) + 1) / ROWS;
    return [u0, v0, u0 + 1 / COLS, v0 + 1 / ROWS];
  }

  // 物品图标: 32x32 像素风
  const iconPainters = {
    carbon(g) { drawCrystalIcon(g, '#3a3a3a', '#6a6a6a', '#1a1a1a'); },
    ferrite(g) { drawDustIcon(g, '#b0855a', '#8a6540'); },
    magferrite(g) { drawDustIcon(g, '#e0913a', '#a86a20'); },
    copper(g) { drawNuggetIcon(g, '#3fc9a0', '#1f9a70'); },
    sodium(g) { drawDustIcon(g, '#ffd040', '#d0a020'); },
    dihydrogen(g) { drawCrystalIcon(g, '#4fa8e8', '#bfeaff', '#2f6898'); },
    oxygen(g) { drawOrbIcon(g, '#ff5a4a', '#ffd0c0'); },
    cobalt(g) { drawCrystalIcon(g, '#3a5aff', '#b0c8ff', '#1a2a8a'); },
    metalplate(g) {
      g.fillStyle = '#9aa5ad'; g.fillRect(6, 8, 20, 16);
      g.fillStyle = '#c8d2d8'; g.fillRect(6, 8, 20, 4);
      g.fillStyle = '#6a757d'; g.fillRect(6, 20, 20, 4);
      g.fillStyle = '#3a454d'; [9, 23].forEach(x => [11, 21].forEach(y => g.fillRect(x, y, 2, 2)));
    },
    dihygel(g) {
      g.fillStyle = '#2f6898'; g.fillRect(10, 6, 12, 22);
      g.fillStyle = '#4fa8e8'; g.fillRect(12, 8, 8, 18);
      g.fillStyle = '#bfeaff'; g.fillRect(13, 10, 3, 8);
      g.fillStyle = '#888'; g.fillRect(12, 4, 8, 3);
    },
    nanotube(g) {
      g.strokeStyle = '#555'; g.lineWidth = 2;
      for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(6 + i * 7, 26); g.lineTo(12 + i * 7, 6); g.stroke(); }
      g.strokeStyle = '#999';
      for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(7 + i * 7, 26); g.lineTo(13 + i * 7, 6); g.stroke(); }
    },
    terrain(g) {
      g.fillStyle = '#6a7a82'; g.fillRect(6, 6, 20, 20);
      g.strokeStyle = '#4a565c'; g.strokeRect(6.5, 6.5, 19, 19);
      g.fillStyle = '#8fd8e8'; g.fillRect(14, 14, 4, 4);
    },
  };
  function drawDustIcon(g, c1, c2) {
    const rng = rngFor(999);
    g.fillStyle = c2; g.beginPath(); g.ellipse(16, 22, 11, 6, 0, 0, 7); g.fill();
    g.fillStyle = c1; g.beginPath(); g.ellipse(16, 20, 10, 6, 0, 0, 7); g.fill();
    for (let i = 0; i < 14; i++) { g.fillStyle = i % 2 ? c2 : '#fff3'; g.fillRect(7 + rng() * 18, 15 + rng() * 8, 2, 2); }
  }
  function drawCrystalIcon(g, c1, hi, dk) {
    g.fillStyle = dk; g.beginPath(); g.moveTo(16, 2); g.lineTo(26, 12); g.lineTo(22, 28); g.lineTo(10, 28); g.lineTo(6, 12); g.closePath(); g.fill();
    g.fillStyle = c1; g.beginPath(); g.moveTo(16, 4); g.lineTo(23, 12); g.lineTo(20, 26); g.lineTo(12, 26); g.lineTo(9, 12); g.closePath(); g.fill();
    g.fillStyle = hi; g.beginPath(); g.moveTo(16, 4); g.lineTo(12, 26); g.lineTo(9, 12); g.closePath(); g.fill();
  }
  function drawNuggetIcon(g, c1, c2) {
    [[8, 18, 8], [18, 14, 7], [14, 22, 6]].forEach(([x, y, s]) => {
      g.fillStyle = c2; g.fillRect(x, y, s, s);
      g.fillStyle = c1; g.fillRect(x + 1, y + 1, s - 2, s - 2);
      g.fillStyle = '#fff5'; g.fillRect(x + 1, y + 1, 2, 2);
    });
  }
  function drawOrbIcon(g, c1, hi) {
    g.fillStyle = c1; g.beginPath(); g.arc(16, 16, 10, 0, 7); g.fill();
    g.fillStyle = hi; g.beginPath(); g.arc(12, 12, 3.5, 0, 7); g.fill();
    g.strokeStyle = '#fff4'; g.beginPath(); g.arc(16, 16, 10, 0, 7); g.stroke();
  }

  function itemIcon(id) {
    if (itemIconCache[id]) return itemIconCache[id];
    const c = document.createElement('canvas'); c.width = 32; c.height = 32;
    const g = c.getContext('2d');
    (iconPainters[id] || drawDustIcon.bind(null, g))(g);
    const url = c.toDataURL();
    itemIconCache[id] = url;
    return url;
  }

  return { buildAtlas, uvFor, itemIcon, get atlas() { return atlasTexture; }, TILE, COLS, ROWS };
})();
