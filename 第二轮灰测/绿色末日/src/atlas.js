/* =========================================================================
 * GREENFALL · atlas.js —— 程序化贴图图集
 * 16x16 格 × 32px = 512×512，全部由代码绘制，不依赖任何外部资源。
 * ======================================================================= */
(function (GF) {
  'use strict';

  const TILE = 32, COLS = 16, ROWS = 16;
  const defs = [];                          // {name, fn}
  const index = Object.create(null);

  function T(name, fn) { index[name] = defs.length; defs.push({ name, fn }); }

  /* ------------------------------------------------------ 绘制小工具 */
  function makePainter(ctx, ox, oy, rnd) {
    const S = TILE;
    const P = {
      S, rnd,
      clear() { ctx.clearRect(ox, oy, S, S); },
      px(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(ox + x, oy + y, w, h); },
      bg(c) { this.px(0, 0, S, S, c); },
      // 垂直渐变
      grad(c1, c2) {
        const g = ctx.createLinearGradient(ox, oy, ox, oy + S);
        g.addColorStop(0, c1); g.addColorStop(1, c2);
        ctx.fillStyle = g; ctx.fillRect(ox, oy, S, S);
      },
      // 随机噪点
      speckle(colors, density, size) {
        const n = Math.floor(S * S * density);
        for (let i = 0; i < n; i++) {
          const x = Math.floor(rnd() * S), y = Math.floor(rnd() * S);
          const sz = size || 1;
          this.px(x, y, sz, sz, colors[Math.floor(rnd() * colors.length)]);
        }
      },
      // 大块斑点（苔藓、污渍、锈迹）
      blobs(color, count, rmin, rmax, alpha) {
        ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.fillStyle = color;
        for (let i = 0; i < count; i++) {
          const cx = rnd() * S, cy = rnd() * S, r = rmin + rnd() * (rmax - rmin);
          ctx.beginPath(); ctx.arc(ox + cx, oy + cy, r, 0, 6.2832); ctx.fill();
        }
        ctx.restore();
      },
      // 顶部苔化（模拟从上往下长的绿植）
      mossTop(amount, color) {
        ctx.save(); ctx.fillStyle = color || '#4d7a34';
        for (let x = 0; x < S; x++) {
          const h = Math.floor((0.5 + rnd() * 0.5) * amount * S * 0.5);
          if (h > 0) ctx.fillRect(ox + x, oy, 1, h);
        }
        ctx.globalAlpha = 0.75;
        for (let i = 0; i < amount * 16; i++) {
          const cx = rnd() * S, cy = rnd() * S * 0.8, r = 1 + rnd() * 3;
          ctx.beginPath(); ctx.arc(ox + cx, oy + cy, r, 0, 6.2832); ctx.fill();
        }
        ctx.restore();
      },
      // 砖缝
      brick(bw, bh, mortar, faces) {
        this.bg(mortar);
        let row = 0;
        for (let y = 0; y < S; y += bh) {
          const off = (row % 2) * Math.floor(bw / 2);
          for (let x = -bw; x < S; x += bw) {
            const c = faces[Math.floor(rnd() * faces.length)];
            this.px(x + off + 1, y + 1, bw - 1, bh - 1, c);
          }
          row++;
        }
      },
      // 木板条纹
      planks(dir, colors, lineC, n) {
        const w = S / n;
        for (let i = 0; i < n; i++) {
          const c = colors[Math.floor(rnd() * colors.length)];
          if (dir === 'v') this.px(i * w, 0, w, S, c); else this.px(0, i * w, S, w, c);
          // 木纹
          for (let k = 0; k < 6; k++) {
            const t = rnd();
            ctx.save(); ctx.globalAlpha = 0.16; ctx.fillStyle = '#000';
            if (dir === 'v') ctx.fillRect(ox + i * w + t * w, oy, 1, S);
            else ctx.fillRect(ox, oy + i * w + t * w, S, 1);
            ctx.restore();
          }
          if (dir === 'v') this.px(i * w, 0, 1, S, lineC); else this.px(0, i * w, S, 1, lineC);
        }
      },
      // 方格瓷砖
      tiles(n, c1, c2, grout) {
        this.bg(grout);
        const w = S / n;
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
          this.px(x * w + 1, y * w + 1, w - 1, w - 1, rnd() < 0.5 ? c1 : c2);
        }
      },
      // 裂纹
      cracks(n, color) {
        ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1;
        for (let i = 0; i < n; i++) {
          let x = rnd() * S, y = rnd() * S;
          ctx.beginPath(); ctx.moveTo(ox + x, oy + y);
          for (let k = 0; k < 5; k++) {
            x += (rnd() - 0.5) * 10; y += (rnd() - 0.5) * 10;
            ctx.lineTo(ox + x, oy + y);
          }
          ctx.stroke();
        }
        ctx.restore();
      },
      // 边框（描边）
      frame(c, w) { const t = w || 1; this.px(0, 0, S, t, c); this.px(0, S - t, S, t, c); this.px(0, 0, t, S, c); this.px(S - t, 0, t, S, c); },
      // 水平锈迹条纹
      streaks(color, n, alpha) {
        ctx.save(); ctx.globalAlpha = alpha || 0.35; ctx.fillStyle = color;
        for (let i = 0; i < n; i++) {
          const x = Math.floor(rnd() * S), h = 4 + rnd() * (S - 4), y = Math.floor(rnd() * (S - h));
          ctx.fillRect(ox + x, oy + y, 1 + Math.floor(rnd() * 2), h);
        }
        ctx.restore();
      },
      /* ---- 十字植物（透明底） ---- */
      plant(o) {
        this.clear();
        const stem = o.stem || '#3f6b2c', leaf = o.leaf || '#5b9440', leaf2 = o.leaf2 || '#77b055';
        const h = o.h || 26, blades = o.blades || 7, base = S - 1;
        for (let i = 0; i < blades; i++) {
          const x = 3 + Math.floor(rnd() * (S - 6));
          const hh = h * (0.55 + rnd() * 0.45);
          const bend = (rnd() - 0.5) * 6;
          ctx.save();
          ctx.strokeStyle = rnd() < 0.5 ? leaf : leaf2;
          ctx.lineWidth = o.thick || 1.5;
          ctx.beginPath(); ctx.moveTo(ox + x, oy + base);
          ctx.quadraticCurveTo(ox + x + bend, oy + base - hh * 0.6, ox + x + bend * 2, oy + base - hh);
          ctx.stroke(); ctx.restore();
        }
        if (o.stemUp) { this.px(S / 2 - 1, S - h, 2, h, stem); }
        if (o.berries) {
          for (let i = 0; i < o.berries; i++) {
            const x = 4 + rnd() * (S - 8), y = 6 + rnd() * (S - 14);
            ctx.fillStyle = o.berryC || '#8e2b3d';
            ctx.beginPath(); ctx.arc(ox + x, oy + y, 1.8, 0, 6.2832); ctx.fill();
          }
        }
        if (o.flower) {
          for (let i = 0; i < (o.flowers || 4); i++) {
            const x = 4 + rnd() * (S - 8), y = 3 + rnd() * 12;
            ctx.fillStyle = o.flower;
            ctx.beginPath(); ctx.arc(ox + x, oy + y, 2.2, 0, 6.2832); ctx.fill();
            ctx.fillStyle = '#e8d36a';
            ctx.fillRect(ox + x - 0.5, oy + y - 0.5, 1, 1);
          }
        }
        if (o.cap) {  // 蘑菇
          ctx.fillStyle = o.stem || '#d8cfae';
          ctx.fillRect(ox + S / 2 - 2, oy + S - 12, 4, 12);
          ctx.fillStyle = o.cap;
          ctx.beginPath(); ctx.arc(ox + S / 2, oy + S - 13, 7, Math.PI, 0); ctx.fill();
          if (o.spots) { ctx.fillStyle = '#f2ead2'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(ox + S / 2 + (rnd() - 0.5) * 10, oy + S - 15 - rnd() * 4, 1.3, 0, 6.2832); ctx.fill(); } }
        }
      },
      /* ---- 垂挂藤蔓 ---- */
      hangVine(o) {
        this.clear();
        const c = o.c || '#4f7f38', c2 = o.c2 || '#3d6b2b';
        const n = o.n || 4;
        for (let i = 0; i < n; i++) {
          let x = 2 + Math.floor(rnd() * (S - 4));
          const len = S * (0.6 + rnd() * 0.4);
          ctx.save(); ctx.strokeStyle = rnd() < 0.5 ? c : c2; ctx.lineWidth = o.thick || 2;
          ctx.beginPath(); ctx.moveTo(ox + x, oy);
          for (let y = 0; y < len; y += 4) { x += (rnd() - 0.5) * 3; ctx.lineTo(ox + x, oy + y); }
          ctx.stroke();
          // 叶片
          ctx.fillStyle = c; ctx.globalAlpha = 0.9;
          for (let k = 0; k < 5; k++) {
            const ly = rnd() * len, lx = x + (rnd() - 0.5) * 8;
            ctx.beginPath(); ctx.ellipse(ox + lx, oy + ly, 2.6, 1.6, rnd() * 3, 0, 6.2832); ctx.fill();
          }
          ctx.restore();
        }
      },
      /* ---- 作物（4 阶段） ---- */
      cropStage(stage, o) {
        this.clear();
        const t = (stage + 1) / 4;
        const h = 8 + t * 20;
        for (let i = 0; i < 4 + stage * 2; i++) {
          const x = 4 + Math.floor(rnd() * (S - 8));
          ctx.save(); ctx.strokeStyle = o.leaf; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(ox + x, oy + S - 1);
          ctx.lineTo(ox + x + (rnd() - 0.5) * 6, oy + S - h * (0.6 + rnd() * 0.4));
          ctx.stroke(); ctx.restore();
        }
        if (stage >= 2 && o.fruit) {
          const n = stage === 3 ? (o.n || 3) : 1;
          for (let i = 0; i < n; i++) {
            const x = 6 + rnd() * (S - 12), y = S - h * (0.5 + rnd() * 0.5);
            ctx.fillStyle = o.fruit;
            ctx.beginPath(); ctx.arc(ox + x, oy + Math.max(4, y), stage === 3 ? 3.2 : 2, 0, 6.2832); ctx.fill();
          }
        }
        if (stage === 3 && o.ear) {  // 麦穗
          for (let i = 0; i < 5; i++) {
            const x = 5 + rnd() * (S - 10);
            ctx.fillStyle = o.ear; ctx.fillRect(ox + x, oy + 2 + rnd() * 6, 2, 8);
          }
        }
      },
    };
    return P;
  }

  /* ================================================= 各方块贴图定义 */
  // ---- 基础地形 ----
  T('air', (P) => P.clear());
  T('bedrock', (P) => { P.bg('#2b2b30'); P.speckle(['#191920', '#3d3d46', '#4a4a55'], 0.35); P.cracks(3, '#141418'); });
  T('stone', (P) => { P.bg('#7d8285'); P.speckle(['#6d7275', '#8b9093', '#93989b', '#666b6e'], 0.5); P.cracks(2, '#5d6265'); });
  T('granite', (P) => { P.bg('#8d7d78'); P.speckle(['#7a6a66', '#a1918c', '#6b5d59', '#b0a09a'], 0.55); });
  T('limestone', (P) => { P.bg('#b8b3a2'); P.speckle(['#a8a392', '#c8c3b2', '#9a9585'], 0.45); P.cracks(2, '#8f8a7a'); });
  T('cobblestone', (P) => {
    P.bg('#5f6467');
    for (let i = 0; i < 14; i++) {
      const x = rnd_(P) * 26, y = rnd_(P) * 26, w = 5 + rnd_(P) * 7, h = 4 + rnd_(P) * 6;
      P.px(x, y, w, h, ['#7a7f82', '#888d90', '#6c7174', '#93989b'][Math.floor(rnd_(P) * 4)]);
    }
    P.speckle(['#555a5d'], 0.12);
  });
  T('moss_stone', (P) => {
    P.bg('#5f6467');
    for (let i = 0; i < 14; i++) { const x = rnd_(P) * 26, y = rnd_(P) * 26; P.px(x, y, 6 + rnd_(P) * 6, 5 + rnd_(P) * 5, ['#7a7f82', '#888d90', '#6c7174'][Math.floor(rnd_(P) * 3)]); }
    P.blobs('#4a7331', 10, 2, 6, 0.85); P.blobs('#5d8c3e', 6, 1, 3, 0.7);
  });
  T('gravel', (P) => { P.bg('#6e6b68'); for (let i = 0; i < 60; i++) { P.px(rnd_(P) * 30, rnd_(P) * 30, 2 + rnd_(P) * 3, 2 + rnd_(P) * 3, ['#8a8783', '#5c5956', '#9b9894', '#77746f'][Math.floor(rnd_(P) * 4)]); } });
  T('dirt', (P) => { P.bg('#6b4f34'); P.speckle(['#5b4129', '#7d5f40', '#4e3722', '#8a6b47'], 0.6); });
  T('rich_soil', (P) => { P.bg('#463322'); P.speckle(['#372718', '#55402c', '#2d2015', '#634c33'], 0.6); P.blobs('#2c3b1e', 4, 1, 3, 0.5); });
  T('grass_top', (P) => { P.bg('#4f7f34'); P.speckle(['#3f6b28', '#5f9440', '#6ba348', '#365d22'], 0.7); P.blobs('#7ab355', 6, 2, 4, 0.4); });
  T('grass_side', (P) => {
    P.bg('#6b4f34'); P.speckle(['#5b4129', '#7d5f40'], 0.5);
    P.mossTop(0.9, '#4f7f34');
    for (let x = 0; x < 32; x++) { const h = 3 + Math.floor(rnd_(P) * 7); P.px(x, 0, 1, h, rnd_(P) < 0.5 ? '#4f7f34' : '#5f9440'); }
  });
  T('moss_top', (P) => { P.bg('#3f6b2b'); P.speckle(['#325723', '#4d7f36', '#588f3e'], 0.75); P.blobs('#2b4a1d', 5, 2, 5, 0.5); });
  T('moss_side', (P) => { P.bg('#6b4f34'); P.speckle(['#5b4129'], 0.4); P.mossTop(1.5, '#3f6b2b'); });
  T('farmland', (P) => { P.bg('#5d4530'); for (let i = 0; i < 5; i++) P.px(0, i * 7 + 2, 32, 3, '#4a3624'); P.speckle(['#6d5540', '#3f2e1e'], 0.35); });
  T('farmland_wet', (P) => { P.bg('#43301f'); for (let i = 0; i < 5; i++) P.px(0, i * 7 + 2, 32, 3, '#332416'); P.speckle(['#53402d'], 0.3); P.blobs('#2a3d2a', 3, 2, 4, 0.3); });
  T('sand', (P) => { P.bg('#cdbd8e'); P.speckle(['#bdad7e', '#ddcd9e', '#b3a374'], 0.55); });
  T('clay', (P) => { P.bg('#9a9088'); P.speckle(['#8a8078', '#aaa098'], 0.4); });
  T('mud', (P) => { P.bg('#3f3428'); P.speckle(['#2f261c', '#4d4033', '#554738'], 0.5); P.blobs('#2a231a', 4, 2, 5, 0.5); });
  T('peat', (P) => { P.bg('#2f2418'); P.speckle(['#241b11', '#3d3020', '#463724'], 0.55); });
  T('ash', (P) => { P.bg('#8a8580'); P.speckle(['#787370', '#9d9893', '#6b6663'], 0.6); });
  T('blight_soil', (P) => { P.bg('#4a4a2c'); P.speckle(['#3b3b22', '#5d5d38'], 0.5); P.blobs('#7d9b3a', 7, 2, 5, 0.55); P.blobs('#a8c24a', 4, 1, 2, 0.5); });

  // ---- 矿脉 ----
  const ore = (spots, extra) => (P) => {
    P.bg('#7d8285'); P.speckle(['#6d7275', '#8b9093'], 0.45);
    for (let i = 0; i < 9; i++) {
      const x = 3 + rnd_(P) * 24, y = 3 + rnd_(P) * 24, r = 2 + rnd_(P) * 2.5;
      P.px(x - r, y - r, r * 2, r * 2, spots[Math.floor(rnd_(P) * spots.length)]);
    }
    if (extra) extra(P);
  };
  T('coal_ore', ore(['#26262a', '#141417', '#33333a']));
  T('iron_ore', ore(['#b08b6a', '#96755a', '#c79c78']));
  T('copper_ore', ore(['#3f9b7a', '#5cba95', '#2f7a60']));
  T('lead_ore', ore(['#5a5f70', '#767c8e', '#474c5c']));
  T('sulfur_ore', ore(['#d8c33a', '#c0ad2a', '#efe066']));
  T('niter_ore', ore(['#e8e4d0', '#cfcab4', '#f6f3e6']));
  T('quartz_vein', ore(['#e6e9ee', '#c9ccd3', '#f4f6fa']));

  // ---- 树木 ----
  T('log_top', (P) => {
    P.bg('#8a6b43');
    for (let r = 14; r > 0; r -= 2.5) { ctxCircle(P, 16, 16, r, r % 5 < 2.5 ? '#a5814f' : '#75593a'); }
  });
  T('log_oak', (P) => { P.bg('#6b5232'); P.planks('v', ['#6b5232', '#7a5f3c', '#5c4629'], '#4b3822', 5); P.streaks('#3f2f1c', 8, 0.3); });
  T('log_pine', (P) => { P.bg('#5c4630'); P.planks('v', ['#5c4630', '#6d543a', '#4d3a27'], '#3d2d1e', 6); P.streaks('#33261a', 10, 0.35); });
  T('log_birch', (P) => { P.bg('#d8d3c4'); P.planks('v', ['#d8d3c4', '#e5e0d2', '#cbc6b7'], '#b9b4a5', 4); for (let i = 0; i < 7; i++) P.px(rnd_(P) * 28, rnd_(P) * 28, 3 + rnd_(P) * 6, 2, '#3a3630'); });
  T('log_giant', (P) => { P.bg('#5a3f28'); P.planks('v', ['#5a3f28', '#6b4d33', '#48321f'], '#372515', 4); P.blobs('#4a7331', 6, 1, 4, 0.5); P.streaks('#2e1f12', 10, 0.4); });
  T('log_giant_top', (P) => { P.bg('#7a5b39'); for (let r = 15; r > 0; r -= 2) ctxCircle(P, 16, 16, r, r % 4 < 2 ? '#96714a' : '#67492e'); });
  T('log_dead', (P) => { P.bg('#6a6155'); P.planks('v', ['#6a6155', '#7a7165', '#585045'], '#453e35', 5); P.cracks(4, '#332d26'); });
  const leafT = (c1, c2, c3) => (P) => {
    P.clear();
    for (let i = 0; i < 130; i++) {
      const x = rnd_(P) * 32, y = rnd_(P) * 32;
      if (rnd_(P) < 0.14) continue;                   // 叶隙透光
      P.px(x, y, 2 + rnd_(P) * 2, 2 + rnd_(P) * 2, [c1, c2, c3][Math.floor(rnd_(P) * 3)]);
    }
  };
  T('leaves_oak', leafT('#3f7a2e', '#4f9139', '#2f5f22'));
  T('leaves_pine', leafT('#2b5c33', '#376f3e', '#1f4526'));
  T('leaves_birch', leafT('#5f9c40', '#74b352', '#4a7f2f'));
  T('leaves_giant', leafT('#2f6b2a', '#3d8235', '#245020'));
  T('leaves_dead', leafT('#6d5f3a', '#7f7048', '#57492c'));

  // ---- 植被（十字） ----
  T('vine', (P) => P.hangVine({ n: 4, c: '#4f7f38', c2: '#3d6b2b' }));
  T('thick_vine', (P) => P.hangVine({ n: 3, c: '#436d2f', c2: '#33551f', thick: 4 }));
  T('moss_carpet', (P) => { P.clear(); for (let i = 0; i < 70; i++) P.px(rnd_(P) * 31, 22 + rnd_(P) * 10, 2, 2, ['#3f6b2b', '#4d7f36', '#588f3e'][Math.floor(rnd_(P) * 3)]); });
  T('grass_tall', (P) => P.plant({ h: 27, blades: 9, leaf: '#5f9440', leaf2: '#7ab355' }));
  T('fern', (P) => P.plant({ h: 22, blades: 8, leaf: '#3f7a3a', leaf2: '#529650', thick: 2.2 }));
  T('reeds', (P) => P.plant({ h: 30, blades: 6, leaf: '#7d9440', leaf2: '#93a855', thick: 2 }));
  T('cattail', (P) => { P.plant({ h: 30, blades: 5, leaf: '#6d8a3a', leaf2: '#82a04a', thick: 2 }); P.px(15, 3, 3, 9, '#5a4326'); });
  T('bush_berry', (P) => P.plant({ h: 20, blades: 11, leaf: '#39682c', leaf2: '#4c8339', berries: 7, berryC: '#8e2b4d' }));
  T('bush_dead', (P) => P.plant({ h: 22, blades: 10, leaf: '#6b6250', leaf2: '#7d7460', thick: 1.2 }));
  T('flower_white', (P) => P.plant({ h: 18, blades: 5, leaf: '#4f8438', flower: '#eef2e6', flowers: 5 }));
  T('flower_red', (P) => P.plant({ h: 18, blades: 5, leaf: '#4f8438', flower: '#b5384a', flowers: 5 }));
  T('herb_yarrow', (P) => P.plant({ h: 20, blades: 7, leaf: '#5f8c4a', flower: '#e4e8d8', flowers: 6 }));
  T('herb_mint', (P) => P.plant({ h: 18, blades: 8, leaf: '#4a8f5f', leaf2: '#5fa872' }));
  T('herb_willow', (P) => P.plant({ h: 26, blades: 7, leaf: '#7f9a5a', leaf2: '#94ad6d', thick: 1.2 }));
  T('mushroom_brown', (P) => P.plant({ cap: '#8a6a45', stem: '#d8cfae' }));
  T('mushroom_toxic', (P) => P.plant({ cap: '#a83a4a', stem: '#e6dcc0', spots: true }));
  T('spore_stalk', (P) => { P.plant({ h: 24, blades: 3, leaf: '#8fa83a', thick: 3 }); ctxCircle(P, 16, 8, 5, '#c4d84a'); ctxCircle(P, 16, 8, 3, '#e2f06a'); });
  T('glow_moss', (P) => { P.clear(); for (let i = 0; i < 60; i++) P.px(rnd_(P) * 31, 18 + rnd_(P) * 14, 2, 2, ['#5ad8a8', '#8ff0c8', '#3fae86'][Math.floor(rnd_(P) * 3)]); });
  T('sapling_oak', (P) => { P.plant({ h: 14, blades: 5, leaf: '#4f9139', leaf2: '#61a84a' }); P.px(15, 18, 2, 14, '#5c4629'); });
  T('sapling_pine', (P) => { P.plant({ h: 14, blades: 6, leaf: '#2b5c33', leaf2: '#376f3e' }); P.px(15, 18, 2, 14, '#4d3a27'); });

  // ---- 作物 4 阶段 ----
  const CROPS = {
    crop_wheat: { leaf: '#8ba34a', ear: '#d8c063' },
    crop_corn: { leaf: '#5f9440', fruit: '#e2c44a', n: 2 },
    crop_potato: { leaf: '#4f8438', fruit: '#c8a06a', n: 3 },
    crop_carrot: { leaf: '#5f9c4a', fruit: '#d87c33', n: 3 },
    crop_tomato: { leaf: '#4a8f4a', fruit: '#c8382f', n: 4 },
    crop_pumpkin: { leaf: '#4f8438', fruit: '#d8802a', n: 1 },
    crop_bean: { leaf: '#5a9a52', fruit: '#8fb03a', n: 4 },
    crop_cabbage: { leaf: '#6ba05f', fruit: '#8fc27a', n: 1 },
  };
  for (const key of Object.keys(CROPS)) {
    for (let s = 0; s < 4; s++) {
      const o = CROPS[key], st = s;
      T(key + '_' + s, (P) => P.cropStage(st, o));
    }
  }

  // ---- 液体 ----
  T('water', (P) => { P.bg('#2f6d8a'); P.speckle(['#3a7d9c', '#27607a', '#4a8daa'], 0.5); P.blobs('#5aa0bd', 3, 3, 7, 0.2); });
  T('water_dirty', (P) => { P.bg('#4a5c3a'); P.speckle(['#3d4d2f', '#5a6d47'], 0.5); P.blobs('#6b7d4a', 4, 2, 6, 0.35); });

  // ---- 建材 ----
  T('planks', (P) => P.planks('h', ['#9a7548', '#a8825a', '#8a6840'], '#6d5030', 5));
  T('plank_floor', (P) => P.planks('v', ['#8a6b45', '#7a5d3a', '#96764e'], '#5f4830', 4));
  T('beam', (P) => { P.planks('v', ['#7a5c3a', '#6b5030'], '#4d3a22', 3); P.px(0, 14, 32, 4, '#5a4228'); });
  T('beam_top', (P) => { P.bg('#8a6b43'); for (let r = 13; r > 0; r -= 3) ctxCircle(P, 16, 16, r, r % 6 < 3 ? '#a5814f' : '#75593a'); });
  T('asphalt', (P) => { P.bg('#3d3f42'); P.speckle(['#33353a', '#4a4d52', '#282a2e'], 0.6); P.cracks(3, '#22242a'); P.blobs('#4a6b33', 3, 1, 3, 0.35); });
  T('road_line', (P) => { P.bg('#3d3f42'); P.speckle(['#33353a', '#4a4d52'], 0.5); P.px(0, 12, 32, 8, '#c8b84a'); P.speckle(['#3d3f42'], 0.15); });
  T('concrete', (P) => { P.bg('#9a9a95'); P.speckle(['#8a8a85', '#a8a8a3', '#7d7d78'], 0.4); });
  T('concrete_cracked', (P) => { P.bg('#8f8f8a'); P.speckle(['#7f7f7a', '#9d9d98'], 0.4); P.cracks(6, '#66665f'); });
  T('concrete_mossy', (P) => { P.bg('#8f8f8a'); P.speckle(['#7f7f7a'], 0.35); P.cracks(3, '#66665f'); P.blobs('#4a7331', 9, 2, 6, 0.75); P.mossTop(0.5, '#3f6b2b'); });
  T('rebar_concrete', (P) => { P.bg('#8a8a86'); P.speckle(['#7a7a76', '#9a9a96'], 0.4); for (let i = 0; i < 3; i++) { P.px(0, 6 + i * 10, 32, 2, '#8a5a3a'); P.px(6 + i * 10, 0, 2, 32, '#8a5a3a'); } });
  T('brick', (P) => { P.brick(16, 8, '#a89a8a', ['#8f4a3a', '#9c5442', '#7d4030', '#a35c46']); });
  T('brick_mossy', (P) => { P.brick(16, 8, '#988a7a', ['#7d4030', '#8a4a38', '#6d3828']); P.blobs('#4a7331', 8, 2, 5, 0.7); P.mossTop(0.6, '#3f6b2b'); });
  T('cinderblock', (P) => { P.brick(32, 11, '#8a8a85', ['#a3a39c', '#9a9a93']); P.px(6, 2, 8, 7, '#6d6d68'); P.px(18, 2, 8, 7, '#6d6d68'); P.px(6, 13, 8, 7, '#6d6d68'); P.px(18, 13, 8, 7, '#6d6d68'); P.px(6, 24, 8, 6, '#6d6d68'); P.px(18, 24, 8, 6, '#6d6d68'); });
  T('plaster', (P) => { P.bg('#cfc8b8'); P.speckle(['#c0b9a9', '#dcd5c5'], 0.3); });
  T('plaster_broken', (P) => { P.bg('#cfc8b8'); P.speckle(['#c0b9a9'], 0.3); for (let i = 0; i < 4; i++) P.px(rnd_(P) * 24, rnd_(P) * 24, 5 + rnd_(P) * 7, 5 + rnd_(P) * 7, '#5a5044'); P.cracks(5, '#8a8272'); for (let i = 0; i < 3; i++) P.px(rnd_(P) * 30, rnd_(P) * 30, 2, 12, '#7a5c3a'); });
  T('wallpaper', (P) => { P.bg('#b8a894'); for (let i = 0; i < 8; i++) P.px(i * 4, 0, 2, 32, '#a89880'); P.blobs('#8a7a62', 5, 3, 7, 0.4); P.streaks('#6d5f4a', 6, 0.3); });
  T('tile_white', (P) => P.tiles(4, '#dfe4e2', '#d2d7d5', '#a8adab'));
  T('tile_dirty', (P) => { P.tiles(4, '#b8bdb2', '#a8ada2', '#7d827a'); P.blobs('#6b6b4a', 6, 2, 5, 0.4); P.blobs('#4a6b33', 3, 1, 3, 0.35); });
  T('carpet_old', (P) => { P.bg('#6b4a4a'); P.speckle(['#5c3d3d', '#7d5a5a', '#4d3232'], 0.6); P.blobs('#3d3326', 6, 3, 7, 0.4); });
  T('shingles', (P) => { P.bg('#3a3a3d'); for (let y = 0; y < 32; y += 8) for (let x = (y / 8 % 2) * 8; x < 32; x += 16) P.px(x, y, 15, 7, ['#4a4a4d', '#42424a', '#37373a'][Math.floor(rnd_(P) * 3)]); P.blobs('#4a6b33', 3, 1, 3, 0.3); });
  T('sheet_roof', (P) => { P.bg('#6b7075'); for (let x = 0; x < 32; x += 5) { P.px(x, 0, 2, 32, '#7d8287'); P.px(x + 3, 0, 1, 32, '#5a5f64'); } P.streaks('#8a5a3a', 8, 0.3); });
  T('metal_panel', (P) => { P.bg('#75797e'); P.frame('#5f6368', 2); P.speckle(['#82868b', '#696d72'], 0.25); for (let i = 0; i < 4; i++) ctxCircle(P, 5 + (i % 2) * 22, 5 + Math.floor(i / 2) * 22, 1.6, '#4a4e53'); });
  T('rusty_metal', (P) => { P.bg('#6d5a4a'); P.speckle(['#5c4a3d', '#7d6a58'], 0.4); P.streaks('#8a4a26', 14, 0.45); P.blobs('#a35c2a', 6, 2, 5, 0.4); });
  T('metal_grate', (P) => { P.clear(); for (let x = 0; x < 32; x += 6) P.px(x, 0, 3, 32, '#6d7176'); for (let y = 0; y < 32; y += 12) P.px(0, y, 32, 3, '#7d8186'); });
  T('chainlink', (P) => {
    P.clear(); ctxLineSet(P, '#9a9ea3');
  });
  T('barbed_wire', (P) => { P.clear(); P.px(0, 12, 32, 2, '#8a8e93'); P.px(0, 20, 32, 2, '#8a8e93'); for (let x = 2; x < 32; x += 7) { P.px(x, 9, 2, 8, '#b0b4b9'); P.px(x + 3, 17, 2, 8, '#b0b4b9'); } });
  T('glass', (P) => { P.clear(); P.px(0, 0, 32, 32, 'rgba(180,210,220,0.20)'); P.frame('rgba(220,240,245,0.55)', 2); P.px(4, 4, 10, 2, 'rgba(255,255,255,0.35)'); });
  T('glass_dirty', (P) => { P.clear(); P.px(0, 0, 32, 32, 'rgba(140,160,140,0.34)'); P.frame('rgba(190,200,180,0.5)', 2); P.blobs('#5a6b4a', 6, 2, 6, 0.3); });
  T('glass_green', (P) => { P.clear(); P.px(0, 0, 32, 32, 'rgba(150,210,170,0.28)'); P.frame('rgba(210,240,220,0.6)', 2); P.blobs('#4a8f5f', 4, 2, 5, 0.25); });
  T('glass_broken', (P) => { P.clear(); P.frame('rgba(220,240,245,0.55)', 2); for (let i = 0; i < 5; i++) { const x = rnd_(P) * 26, y = rnd_(P) * 26; P.px(x, y, 3 + rnd_(P) * 4, 3 + rnd_(P) * 4, 'rgba(200,225,232,0.35)'); } });
  T('rubble', (P) => { P.bg('#7a7770'); for (let i = 0; i < 30; i++) P.px(rnd_(P) * 28, rnd_(P) * 28, 3 + rnd_(P) * 5, 3 + rnd_(P) * 4, ['#8f8c85', '#66635c', '#9d9a93', '#57544d'][Math.floor(rnd_(P) * 4)]); for (let i = 0; i < 3; i++) P.px(rnd_(P) * 28, rnd_(P) * 28, 2, 8, '#8a5a3a'); });
  T('trash_pile', (P) => { P.bg('#5a564a'); for (let i = 0; i < 26; i++) P.px(rnd_(P) * 28, rnd_(P) * 28, 3 + rnd_(P) * 5, 3 + rnd_(P) * 4, ['#8a8270', '#6b4a4a', '#4a6b6b', '#8a7a3a', '#6d6d75'][Math.floor(rnd_(P) * 5)]); });
  T('wreck_metal', (P) => { P.bg('#5a5f6b'); P.speckle(['#4a4f5a', '#6b7078'], 0.35); P.streaks('#8a4a26', 12, 0.5); P.cracks(4, '#2e3238'); P.blobs('#3d6b2b', 3, 1, 3, 0.35); });
  T('tire_stack', (P) => { P.bg('#2a2a2d'); for (let y = 0; y < 32; y += 11) { P.px(0, y, 32, 9, '#33333a'); for (let x = 0; x < 32; x += 4) P.px(x, y + 2, 2, 5, '#26262b'); } });
  T('tarp', (P) => { P.bg('#3d5a4a'); P.speckle(['#334d3f', '#4a6b58'], 0.3); for (let i = 0; i < 4; i++) P.px(0, i * 8, 32, 1, '#2b4033'); });
  T('sandbag', (P) => { P.bg('#a89870'); for (let y = 0; y < 32; y += 11) for (let x = (y / 11 % 2) * 8; x < 32; x += 16) { P.px(x, y, 15, 10, ['#b0a078', '#9a8a64', '#a89870'][Math.floor(rnd_(P) * 3)]); P.px(x, y + 4, 15, 1, '#8a7a56'); } });
  T('bookshelf', (P) => { P.planks('h', ['#6b5030', '#7a5c3a'], '#4d3a22', 2); for (let i = 0; i < 8; i++) P.px(2 + i * 3.6, rnd_(P) < 0.5 ? 3 : 18, 3, 11, ['#8a3a3a', '#3a5a8a', '#3a8a5a', '#8a7a3a', '#6b3a8a'][Math.floor(rnd_(P) * 5)]); P.px(0, 15, 32, 2, '#4d3a22'); });
  T('hay_bale', (P) => { P.bg('#b8a354'); P.speckle(['#c8b364', '#a89344', '#d8c374'], 0.7); P.px(0, 10, 32, 2, '#6b5a2a'); P.px(0, 21, 32, 2, '#6b5a2a'); });
  T('bone_pile', (P) => { P.bg('#6b6558'); for (let i = 0; i < 14; i++) { const x = rnd_(P) * 26, y = rnd_(P) * 28; P.px(x, y, 7 + rnd_(P) * 5, 3, '#d8d2be'); P.px(x, y, 3, 3, '#e8e2ce'); } });
  T('fungal_wall', (P) => { P.bg('#4a4436'); P.blobs('#7d8f3a', 10, 3, 7, 0.75); P.blobs('#a3b84a', 6, 1, 3, 0.6); P.speckle(['#c8d86a'], 0.06); });

  // ---- 门/家具/功能 ----
  T('door_wood', (P) => { P.planks('v', ['#7a5c3a', '#8a6b45'], '#5a4228', 4); P.frame('#4d3a22', 2); ctxCircle(P, 26, 16, 2, '#c8b06a'); P.px(4, 4, 24, 10, '#6b5030'); });
  T('door_metal', (P) => { P.bg('#6d7176'); P.frame('#4a4e53', 3); P.px(5, 5, 22, 9, '#7d8186'); P.px(5, 18, 22, 9, '#7d8186'); ctxCircle(P, 26, 16, 2, '#b8bcc1'); P.streaks('#8a4a26', 5, 0.25); });
  T('door_locked', (P) => { P.bg('#5f6368'); P.frame('#3f4348', 3); P.px(4, 4, 24, 24, '#6d7176'); ctxCircle(P, 16, 16, 5, '#c8a83a'); ctxCircle(P, 16, 16, 2, '#3a3a3a'); P.px(15, 16, 2, 6, '#3a3a3a'); });
  T('fence_wood', (P) => { P.clear(); P.px(4, 0, 4, 32, '#7a5c3a'); P.px(24, 0, 4, 32, '#7a5c3a'); P.px(0, 8, 32, 4, '#8a6b45'); P.px(0, 20, 32, 4, '#8a6b45'); });
  T('ladder', (P) => { P.clear(); P.px(4, 0, 4, 32, '#8a6b45'); P.px(24, 0, 4, 32, '#8a6b45'); for (let y = 3; y < 32; y += 8) P.px(4, y, 24, 3, '#9a7b52'); });
  T('workbench_top', (P) => { P.planks('h', ['#8a6b45', '#7a5c3a'], '#5a4228', 4); P.blobs('#4a3a2a', 5, 2, 4, 0.4); P.px(3, 3, 9, 3, '#6d7176'); P.px(20, 22, 8, 4, '#5f6368'); });
  T('workbench_side', (P) => { P.planks('v', ['#7a5c3a', '#6b5030'], '#4d3a22', 4); P.px(0, 0, 32, 4, '#8a6b45'); P.px(2, 12, 28, 3, '#5a4228'); });
  T('furnace_top', (P) => { P.bg('#6b6560'); P.speckle(['#5c5651', '#7a746f'], 0.4); ctxCircle(P, 16, 16, 8, '#2a2622'); ctxCircle(P, 16, 16, 5, '#8a4a1a'); ctxCircle(P, 16, 16, 3, '#d88a2a'); });
  T('furnace_side', (P) => { P.brick(11, 8, '#8a8378', ['#7d5040', '#8a5a48', '#6d4535']); P.px(10, 16, 12, 12, '#2a2622'); P.px(12, 20, 8, 7, '#8a4a1a'); P.px(13, 23, 6, 4, '#e0a03a'); });
  T('forge_top', (P) => { P.bg('#4a4e53'); P.speckle(['#3f4348', '#5a5e63'], 0.4); ctxCircle(P, 16, 16, 9, '#1a1614'); ctxCircle(P, 16, 16, 6, '#c8501a'); ctxCircle(P, 16, 16, 3, '#ffc040'); });
  T('forge_side', (P) => { P.bg('#5a5045'); P.brick(11, 9, '#4a443a', ['#6b5a4a', '#5c4d3f']); P.px(9, 14, 14, 14, '#1a1614'); P.px(11, 18, 10, 9, '#c8501a'); P.px(13, 21, 6, 5, '#ffc040'); P.px(0, 0, 32, 3, '#4a4e53'); });
  T('chem_top', (P) => { P.bg('#c8ccc8'); P.speckle(['#b8bcb8', '#d8dcd8'], 0.25); P.px(4, 4, 6, 8, 'rgba(120,200,160,0.7)'); P.px(14, 6, 5, 6, 'rgba(200,160,120,0.7)'); P.px(22, 3, 7, 10, 'rgba(160,180,220,0.7)'); P.px(2, 20, 28, 3, '#8a8e8a'); });
  T('chem_side', (P) => { P.bg('#a8aca8'); P.frame('#8a8e8a', 2); P.px(3, 5, 26, 10, '#b8bcb8'); P.px(3, 18, 26, 10, '#b8bcb8'); ctxCircle(P, 16, 10, 2, '#6d7176'); });
  T('campfire_top', (P) => { P.clear(); for (let i = 0; i < 10; i++) { const a = i * 0.63; P.px(16 + Math.cos(a) * 11 - 2, 16 + Math.sin(a) * 11 - 2, 5, 5, '#6b6560'); } P.px(9, 9, 14, 14, '#2a2018'); ctxCircle(P, 16, 16, 6, '#d8641a'); ctxCircle(P, 16, 16, 3.5, '#ffb03a'); ctxCircle(P, 16, 16, 1.5, '#fff0b0'); });
  T('campfire_side', (P) => { P.clear(); P.px(2, 22, 28, 8, '#6b6560'); P.px(6, 14, 20, 9, '#4a3a2a'); ctxCircle(P, 16, 16, 6, '#d8641a'); ctxCircle(P, 16, 14, 3, '#ffb03a'); });
  T('stove_top', (P) => { P.bg('#3f4348'); P.speckle(['#4a4e53'], 0.2); ctxCircle(P, 9, 9, 5, '#26292e'); ctxCircle(P, 23, 9, 5, '#26292e'); ctxCircle(P, 9, 23, 5, '#26292e'); ctxCircle(P, 23, 23, 5, '#26292e'); ctxCircle(P, 9, 9, 2, '#3a6bc8'); });
  T('stove_side', (P) => { P.bg('#b8bcc1'); P.frame('#8a8e93', 2); P.px(4, 12, 24, 14, '#3a3d42'); P.px(6, 14, 20, 10, 'rgba(120,80,40,0.5)'); P.px(4, 5, 24, 4, '#9a9ea3'); });
  T('drying_rack', (P) => { P.clear(); P.px(2, 2, 3, 28, '#8a6b45'); P.px(27, 2, 3, 28, '#8a6b45'); for (let y = 6; y < 30; y += 8) P.px(2, y, 28, 2, '#9a7b52'); P.px(8, 8, 5, 12, '#8a4a3a'); P.px(18, 8, 5, 10, '#8a4a3a'); });
  T('collector_top', (P) => { P.bg('#4a5f6b'); ctxCircle(P, 16, 16, 13, '#2f6d8a'); ctxCircle(P, 16, 16, 10, '#3a7d9c'); P.frame('#6d7176', 2); });
  T('collector_side', (P) => { P.bg('#6d7176'); for (let y = 0; y < 32; y += 8) P.px(0, y, 32, 2, '#5a5e63'); P.px(0, 0, 32, 3, '#8a8e93'); P.streaks('#8a4a26', 4, 0.25); });
  T('planter_top', (P) => { P.bg('#7a5c3a'); P.frame('#5a4228', 3); P.px(4, 4, 24, 24, '#463322'); P.speckle(['#372718', '#55402c'], 0.5); P.blobs('#4a7331', 3, 2, 3, 0.5); });
  T('planter_side', (P) => { P.planks('h', ['#8a6b45', '#7a5c3a'], '#5a4228', 3); P.px(0, 0, 32, 3, '#463322'); });
  T('bed_top', (P) => { P.bg('#8a3a3a'); P.speckle(['#7a2f2f', '#9a4a4a'], 0.3); P.px(2, 2, 28, 10, '#d8d2c4'); P.blobs('#5a4a3a', 4, 2, 5, 0.3); });
  T('bed_side', (P) => { P.bg('#7a5c3a'); P.px(0, 0, 32, 12, '#8a3a3a'); P.px(0, 12, 32, 3, '#5a4228'); P.px(2, 24, 4, 8, '#6b5030'); P.px(26, 24, 4, 8, '#6b5030'); });
  T('chest_top', (P) => { P.planks('h', ['#8a6b45', '#7a5c3a'], '#5a4228', 4); P.frame('#5f6368', 2); P.px(13, 0, 6, 8, '#8a8e93'); });
  T('chest_side', (P) => { P.planks('h', ['#7a5c3a', '#6b5030'], '#4d3a22', 4); P.px(0, 12, 32, 4, '#5f6368'); P.px(13, 11, 6, 8, '#b8bcc1'); ctxCircle(P, 16, 15, 1.6, '#3a3a3a'); });
  T('lamp_off', (P) => { P.clear(); P.px(12, 0, 8, 8, '#5f6368'); ctxCircle(P, 16, 18, 9, 'rgba(200,205,200,0.5)'); ctxCircle(P, 16, 18, 6, 'rgba(160,165,160,0.4)'); });
  T('lamp_on', (P) => { P.clear(); P.px(12, 0, 8, 8, '#5f6368'); ctxCircle(P, 16, 18, 10, 'rgba(255,240,190,0.75)'); ctxCircle(P, 16, 18, 6, '#fff6d0'); });
  T('solar_top', (P) => { P.bg('#1f2a3a'); for (let y = 0; y < 32; y += 8) for (let x = 0; x < 32; x += 8) P.px(x + 1, y + 1, 6, 6, ['#26354a', '#2f4058', '#1f2a3a'][Math.floor(rnd_(P) * 3)]); P.frame('#8a8e93', 2); });
  T('gen_top', (P) => { P.bg('#5a5f4a'); P.frame('#4a4e3f', 2); ctxCircle(P, 10, 10, 4, '#3a3d33'); P.px(18, 5, 10, 12, '#6b7058'); P.px(4, 20, 24, 8, '#4a4e3f'); });
  T('gen_side', (P) => { P.bg('#5a5f4a'); P.frame('#4a4e3f', 2); for (let x = 4; x < 28; x += 4) P.px(x, 6, 2, 14, '#3a3d33'); P.px(4, 22, 24, 6, '#6b7058'); P.streaks('#8a4a26', 4, 0.25); });
  T('radio_top', (P) => { P.bg('#4a4e53'); P.frame('#3a3d42', 2); P.px(4, 4, 12, 10, '#26292e'); P.px(5, 5, 10, 8, '#2a5a3a'); ctxCircle(P, 22, 9, 3, '#8a8e93'); ctxCircle(P, 22, 22, 3, '#8a8e93'); P.px(4, 18, 12, 10, '#3a3d42'); });
  T('radio_side', (P) => { P.bg('#4a4e53'); P.frame('#3a3d42', 2); for (let y = 5; y < 28; y += 5) P.px(4, y, 24, 2, '#33363b'); ctxCircle(P, 24, 24, 2, '#c8503a'); });
  T('sign_post', (P) => { P.clear(); P.px(14, 12, 4, 20, '#7a5c3a'); P.px(2, 4, 28, 12, '#8a7a5a'); P.px(4, 6, 24, 8, '#a89870'); P.px(7, 9, 18, 2, '#5a4a3a'); P.px(7, 12, 12, 1, '#5a4a3a'); });
  T('torch', (P) => { P.clear(); P.px(14, 12, 4, 20, '#7a5c3a'); ctxCircle(P, 16, 9, 5, '#d8641a'); ctxCircle(P, 16, 8, 3, '#ffb03a'); ctxCircle(P, 16, 7, 1.5, '#fff0b0'); });

  // ---- 战利品容器 ----
  T('crate_top', (P) => { P.planks('h', ['#a8834a', '#96754a'], '#75593a', 4); P.frame('#75593a', 2); P.px(6, 12, 20, 8, '#8a6b45'); });
  T('crate_side', (P) => { P.planks('v', ['#96754a', '#8a6b45'], '#6d5030', 4); P.frame('#6d5030', 2); P.px(0, 14, 32, 4, '#75593a'); P.px(8, 6, 16, 6, '#3a5a2a'); });
  T('locker_top', (P) => { P.bg('#4a6b7a'); P.frame('#3a5a68', 2); P.speckle(['#3f5f6d'], 0.2); });
  T('locker_side', (P) => { P.bg('#4a6b7a'); P.frame('#3a5a68', 2); P.px(2, 2, 13, 28, '#527585'); P.px(17, 2, 13, 28, '#527585'); for (let y = 5; y < 12; y += 2) { P.px(4, y, 9, 1, '#3a5a68'); P.px(19, y, 9, 1, '#3a5a68'); } ctxCircle(P, 13, 18, 1.5, '#c8ccc8'); });
  T('cabinet_top', (P) => { P.bg('#8a8578'); P.frame('#6d6860', 2); });
  T('cabinet_side', (P) => { P.bg('#8a8578'); P.frame('#6d6860', 2); for (let i = 0; i < 3; i++) { P.px(3, 3 + i * 9, 26, 8, '#96917f'); P.px(12, 6 + i * 9, 8, 2, '#5f5a52'); } });
  T('fridge_top', (P) => { P.bg('#c8ccc8'); P.frame('#a8aca8', 2); P.blobs('#8a9a7a', 3, 2, 5, 0.3); });
  T('fridge_side', (P) => { P.bg('#c0c4c0'); P.frame('#9a9e9a', 2); P.px(3, 3, 26, 12, '#cdd1cd'); P.px(3, 17, 26, 12, '#cdd1cd'); P.px(24, 6, 3, 6, '#8a8e8a'); P.blobs('#7a8a6a', 5, 2, 5, 0.35); });
  T('vending_top', (P) => { P.bg('#8a3a3a'); P.frame('#6b2f2f', 2); });
  T('vending_side', (P) => { P.bg('#8a3a3a'); P.frame('#6b2f2f', 2); P.px(3, 3, 20, 24, 'rgba(120,160,180,0.5)'); for (let y = 5; y < 26; y += 6) for (let x = 5; x < 21; x += 5) P.px(x, y, 4, 5, ['#d8c84a', '#4a8ad8', '#d84a6b'][Math.floor(rnd_(P) * 3)]); P.px(25, 5, 4, 10, '#3a3a3a'); });
  T('shelf_top', (P) => { P.planks('h', ['#9a9e9a', '#8a8e8a'], '#6d716d', 3); });
  T('shelf_side', (P) => { P.clear(); P.px(0, 0, 3, 32, '#8a8e93'); P.px(29, 0, 3, 32, '#8a8e93'); for (let y = 4; y < 32; y += 10) { P.px(0, y, 32, 3, '#9a9ea3'); for (let x = 4; x < 28; x += 6) if (rnd_(P) < 0.7) P.px(x, y - 6, 5, 6, ['#d8c84a', '#8a4a3a', '#4a8a6b', '#c8c8c8'][Math.floor(rnd_(P) * 4)]); } });
  T('medbox_top', (P) => { P.bg('#e8e4dc'); P.frame('#c8c4bc', 2); P.px(13, 6, 6, 20, '#c8302a'); P.px(6, 13, 20, 6, '#c8302a'); });
  T('medbox_side', (P) => { P.bg('#e0dcd4'); P.frame('#b8b4ac', 2); P.px(13, 8, 6, 16, '#c8302a'); P.px(8, 13, 16, 6, '#c8302a'); });
  T('ammo_top', (P) => { P.bg('#4a5f3a'); P.frame('#3a4d2d', 2); P.px(8, 8, 16, 16, '#54693f'); P.px(12, 12, 8, 8, '#3a4d2d'); });
  T('ammo_side', (P) => { P.bg('#4a5f3a'); P.frame('#3a4d2d', 2); P.px(4, 10, 24, 3, '#d8c84a'); P.px(4, 16, 14, 3, '#d8c84a'); P.streaks('#2d3a22', 6, 0.3); });
  T('toolbox_top', (P) => { P.bg('#c8562a'); P.frame('#a3441f', 2); P.px(10, 2, 12, 5, '#8a8e93'); });
  T('toolbox_side', (P) => { P.bg('#c8562a'); P.frame('#a3441f', 2); P.px(2, 14, 28, 3, '#8a8e93'); P.px(12, 6, 8, 4, '#5f6368'); P.streaks('#8a3a1a', 5, 0.25); });
  T('safe_top', (P) => { P.bg('#3a3d42'); P.frame('#26292e', 3); P.speckle(['#4a4e53'], 0.15); });
  T('safe_side', (P) => { P.bg('#3a3d42'); P.frame('#26292e', 3); ctxCircle(P, 16, 16, 8, '#4a4e53'); ctxCircle(P, 16, 16, 5, '#8a8e93'); ctxCircle(P, 16, 16, 2, '#c8a83a'); P.px(6, 6, 4, 2, '#c8a83a'); });
  T('suitcase_top', (P) => { P.bg('#5a3f2a'); P.frame('#42301f', 2); P.px(12, 0, 8, 4, '#8a8e93'); P.px(2, 14, 28, 3, '#42301f'); });
  T('suitcase_side', (P) => { P.bg('#5a3f2a'); P.frame('#42301f', 2); P.px(0, 12, 32, 3, '#42301f'); P.px(8, 10, 5, 7, '#c8a83a'); P.px(20, 10, 5, 7, '#c8a83a'); });
  T('pack_top', (P) => { P.bg('#3d4a33'); P.frame('#2d3826', 2); P.px(10, 6, 12, 20, '#47563b'); });
  T('pack_side', (P) => { P.bg('#3d4a33'); P.frame('#2d3826', 2); P.px(4, 6, 24, 12, '#47563b'); P.px(4, 20, 24, 8, '#47563b'); for (let y = 6; y < 28; y += 6) P.px(14, y, 4, 2, '#8a7a4a'); });
  T('register_top', (P) => { P.bg('#5f6368'); P.frame('#4a4e53', 2); P.px(6, 6, 20, 10, '#33363b'); P.px(8, 8, 16, 6, '#4a8a6b'); });
  T('register_side', (P) => { P.bg('#5f6368'); P.frame('#4a4e53', 2); P.px(4, 6, 24, 10, '#33363b'); for (let y = 20; y < 28; y += 4) for (let x = 5; x < 28; x += 4) P.px(x, y, 3, 3, '#8a8e93'); });
  T('seedbox_top', (P) => { P.planks('h', ['#8a6b45', '#7a5c3a'], '#5a4228', 3); for (let i = 0; i < 6; i++) ctxCircle(P, 6 + (i % 3) * 10, 10 + Math.floor(i / 3) * 12, 3, ['#8ba34a', '#d8c063', '#c8a06a'][i % 3]); });
  T('seedbox_side', (P) => { P.planks('v', ['#7a5c3a', '#6b5030'], '#4d3a22', 3); P.px(6, 10, 20, 12, '#a89870'); P.px(8, 12, 16, 8, '#8ba34a'); });

  // ---- 实体与特效 ----
  T('white', (P) => P.bg('#ffffff'));
  T('shadow', (P) => { P.clear(); ctxCircle(P, 16, 16, 14, 'rgba(0,0,0,0.35)'); });
  T('zombie_skin', (P) => { P.bg('#7a8f5a'); P.speckle(['#6b7f4d', '#8a9f68', '#5c6d42'], 0.5); P.blobs('#4a5c33', 5, 2, 5, 0.5); P.blobs('#8a3a3a', 2, 1, 3, 0.4); });
  T('zombie_cloth', (P) => { P.bg('#4a4a52'); P.speckle(['#3d3d45', '#5a5a62'], 0.4); P.blobs('#2a2a30', 4, 2, 6, 0.4); P.blobs('#5c3a2a', 3, 1, 3, 0.35); });
  T('zombie_moss', (P) => { P.bg('#5f7a42'); P.blobs('#3f6b2b', 9, 2, 6, 0.75); P.speckle(['#7ab355', '#2f5220'], 0.3); });
  T('fur_brown', (P) => { P.bg('#6b4a2f'); for (let i = 0; i < 90; i++) P.px(rnd_(P) * 31, rnd_(P) * 31, 1, 3, ['#5c3d26', '#7d5a3a', '#4d3220'][Math.floor(rnd_(P) * 3)]); });
  T('fur_grey', (P) => { P.bg('#6b6b70'); for (let i = 0; i < 90; i++) P.px(rnd_(P) * 31, rnd_(P) * 31, 1, 3, ['#5c5c60', '#7d7d82', '#4d4d52'][Math.floor(rnd_(P) * 3)]); });
  T('hide_deer', (P) => { P.bg('#9a7a52'); P.speckle(['#8a6a45', '#a88a62'], 0.4); for (let i = 0; i < 8; i++) ctxCircle(P, rnd_(P) * 30, rnd_(P) * 30, 2, '#e0d0b0'); });
  T('feather_black', (P) => { P.bg('#26262b'); P.speckle(['#1a1a1f', '#33333a', '#3d3d45'], 0.5); });
  T('spore_cloud', (P) => { P.clear(); for (let i = 0; i < 26; i++) { ctxCircle(P, rnd_(P) * 32, rnd_(P) * 32, 3 + rnd_(P) * 6, 'rgba(150,190,70,0.22)'); } });
  T('skin_human', (P) => { P.bg('#c89a72'); P.speckle(['#b88a62', '#d8aa82'], 0.3); });
  T('cloth_player', (P) => { P.bg('#3f5a4a'); P.speckle(['#334d3f', '#4a6b58'], 0.35); });

  /* --------------------------------- 辅助（依赖闭包内 ctx 的画法） */
  let _ctx = null, _ox = 0, _oy = 0, _rnd = Math.random;
  function ctxCircle(P, x, y, r, color) {
    _ctx.save(); _ctx.fillStyle = color;
    _ctx.beginPath(); _ctx.arc(_ox + x, _oy + y, r, 0, 6.2832); _ctx.fill(); _ctx.restore();
  }
  function ctxLineSet(P) {
    _ctx.save(); _ctx.strokeStyle = '#9a9ea3'; _ctx.lineWidth = 1.5;
    for (let i = -32; i < 32; i += 8) {
      _ctx.beginPath(); _ctx.moveTo(_ox + i, _oy); _ctx.lineTo(_ox + i + 32, _oy + 32); _ctx.stroke();
      _ctx.beginPath(); _ctx.moveTo(_ox + i, _oy + 32); _ctx.lineTo(_ox + i + 32, _oy); _ctx.stroke();
    }
    _ctx.restore();
  }
  function rnd_() { return _rnd(); }

  /* ------------------------------------------------------------ 构建 */
  let built = null;
  function build() {
    if (built) return built;
    const size = TILE * COLS;
    const canvas = (typeof document !== 'undefined')
      ? Object.assign(document.createElement('canvas'), { width: size, height: size })
      : null;
    if (!canvas) return { canvas: null, size, tile: TILE, cols: COLS, index, uv: uvOf };
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    _ctx = ctx;
    for (let i = 0; i < defs.length; i++) {
      const cx = (i % COLS) * TILE, cy = Math.floor(i / COLS) * TILE;
      _ox = cx; _oy = cy;
      _rnd = GF.util.mulberry32(0x9e3779b9 ^ (i * 2654435761));
      const P = makePainter(ctx, cx, cy, _rnd);
      try { defs[i].fn(P); } catch (e) { P.bg('#ff00ff'); console.warn('atlas tile fail', defs[i].name, e); }
    }
    built = { canvas, size, tile: TILE, cols: COLS, index, uv: uvOf, count: defs.length };
    return built;
  }

  // 返回 [u0, v0, du, dv]，内缩半像素避免相邻格渗色
  const uvCache = Object.create(null);
  function uvOf(name) {
    if (uvCache[name]) return uvCache[name];
    let i = index[name];
    if (i === undefined) { i = index['white'] !== undefined ? index['white'] : 0; }
    const px = 1 / (TILE * COLS);
    const u0 = (i % COLS) * TILE * px + px * 0.5;
    const v0 = Math.floor(i / COLS) * TILE * px + px * 0.5;
    const d = TILE * px - px;
    return (uvCache[name] = [u0, v0, d, d]);
  }

  GF.Atlas = {
    build, uvOf, index, TILE, COLS, ROWS,
    tileCount: () => defs.length,
    names: () => defs.map((d) => d.name),
    /** MOD 接口：注册新贴图格（在 GF.boot() 之前调用）
     *  fn(P) 里可用 P.bg / P.px / P.speckle / P.blobs / P.brick / P.planks /
     *  P.tiles / P.cracks / P.frame / P.streaks / P.plant / P.hangVine 等画法 */
    addTile(name, fn) {
      if (built) throw new Error('图集已构建，无法再添加贴图');
      if (defs.length >= COLS * ROWS) throw new Error('图集已满（' + COLS * ROWS + ' 格）');
      T(name, fn);
      return name;
    },
    freeSlots: () => COLS * ROWS - defs.length,
  };
})(globalThis.GF = globalThis.GF || {});
