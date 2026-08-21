/* =========================================================================
 * GREENFALL · ui.js —— 物品图标生成 / HUD / 背包 / 合成 / 地图 / 日志
 * 全部 DOM + Canvas 手写，不依赖任何 UI 框架
 * ======================================================================= */
(function (GF) {
  'use strict';

  const U = GF.util;
  const ICON = 40, ICOLS = 20;

  /* ==================================================== 物品图标生成 */
  const IconSheet = {
    canvas: null, url: null, pos: Object.create(null), errors: [],
    build() {
      if (this.canvas) return this;
      const keys = GF.Items.order;
      const rows = Math.ceil(keys.length / ICOLS);
      const cv = document.createElement('canvas');
      cv.width = ICOLS * ICON; cv.height = rows * ICON;
      const g = cv.getContext('2d');
      const atlas = GF.Atlas.build();
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const x = (i % ICOLS) * ICON, y = Math.floor(i / ICOLS) * ICON;
        this.pos[k] = [x, y];
        g.save();
        g.translate(x, y);
        try { drawIcon(g, GF.Items.get(k), k, atlas); }
        catch (e) { this.errors.push(k + ': ' + e.message); g.fillStyle = '#a33'; g.fillRect(6, 6, 28, 28); }
        g.restore();
      }
      this.canvas = cv;
      this.url = cv.toDataURL();
      return this;
    },
    style(key) {
      const p = this.pos[key];
      if (!p) return '';
      return `background-image:url(${this.url});background-position:-${p[0]}px -${p[1]}px;`;
    },
  };

  function hue(key, base) {
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
    return (Math.abs(h) % 60) - 30 + (base || 0);
  }
  function shade(c, amt) {
    const n = parseInt(c.slice(1), 16);
    const r = U.clamp(((n >> 16) & 255) + amt, 0, 255), gg = U.clamp(((n >> 8) & 255) + amt, 0, 255), b = U.clamp((n & 255) + amt, 0, 255);
    return `rgb(${r},${gg},${b})`;
  }

  function drawIcon(g, def, key, atlas) {
    const S = ICON, C = S / 2;
    g.imageSmoothingEnabled = false;
    // 可放置方块 -> 画等轴立方体
    if (def.place && GF.Blocks.byKey[def.place]) {
      const b = GF.Blocks.byKey[def.place];
      const topT = b.tex.top || b.tex.all || b.tex.side;
      const sideT = b.tex.side || b.tex.all || b.tex.top;
      const ti = GF.Atlas.index[topT] || 0, si = GF.Atlas.index[sideT] || 0;
      const tx = (ti % GF.Atlas.COLS) * GF.Atlas.TILE, ty = Math.floor(ti / GF.Atlas.COLS) * GF.Atlas.TILE;
      const sx = (si % GF.Atlas.COLS) * GF.Atlas.TILE, sy = Math.floor(si / GF.Atlas.COLS) * GF.Atlas.TILE;
      const T = GF.Atlas.TILE, w = 15, h = 9;
      // 顶面（菱形）
      g.save();
      g.beginPath(); g.moveTo(C, 5); g.lineTo(C + w, 5 + h); g.lineTo(C, 5 + h * 2); g.lineTo(C - w, 5 + h); g.closePath();
      g.clip();
      g.drawImage(atlas.canvas, tx, ty, T, T, C - w, 3, w * 2, h * 2 + 4);
      g.restore();
      // 左右侧面
      g.save();
      g.beginPath(); g.moveTo(C - w, 5 + h); g.lineTo(C, 5 + h * 2); g.lineTo(C, 5 + h * 2 + 13); g.lineTo(C - w, 5 + h + 13); g.closePath();
      g.clip(); g.drawImage(atlas.canvas, sx, sy, T, T, C - w, 5 + h, w, 26);
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(C - w, 5 + h, w, 26);
      g.restore();
      g.save();
      g.beginPath(); g.moveTo(C, 5 + h * 2); g.lineTo(C + w, 5 + h); g.lineTo(C + w, 5 + h + 13); g.lineTo(C, 5 + h * 2 + 13); g.closePath();
      g.clip(); g.drawImage(atlas.canvas, sx, sy, T, T, C, 5 + h, w, 26);
      g.fillStyle = 'rgba(0,0,0,0.40)'; g.fillRect(C, 5 + h, w, 26);
      g.restore();
      return;
    }

    const hv = hue(key);
    const rr = (x, y, w, h, c, r) => {
      g.fillStyle = c; g.beginPath();
      const rad = r == null ? 2 : r;
      g.moveTo(x + rad, y); g.arcTo(x + w, y, x + w, y + h, rad); g.arcTo(x + w, y + h, x, y + h, rad);
      g.arcTo(x, y + h, x, y, rad); g.arcTo(x, y, x + w, y, rad); g.fill();
    };
    const circle = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill(); };

    switch (def.cat) {
      case 'tool': {
        const tier = def.tool ? def.tool.tier : 1;
        const metal = ['#8a7a5a', '#9a9a95', '#c8ccd2', '#e0e4ea'][U.clamp(tier, 0, 3)];
        g.save(); g.translate(C, C); g.rotate(-0.6);
        rr(-2, -14, 4, 26, '#7a5c3a', 2);                    // 柄
        const t = def.tool ? def.tool.type : 'pry';
        if (t === 'axe') { g.fillStyle = metal; g.beginPath(); g.moveTo(1, -14); g.lineTo(13, -10); g.lineTo(13, -1); g.lineTo(1, -3); g.closePath(); g.fill(); }
        else if (t === 'pick') { g.fillStyle = metal; g.beginPath(); g.moveTo(-13, -9); g.quadraticCurveTo(0, -18, 13, -9); g.lineTo(11, -5); g.quadraticCurveTo(0, -13, -11, -5); g.closePath(); g.fill(); }
        else if (t === 'shovel') { g.fillStyle = metal; g.beginPath(); g.moveTo(-6, -16); g.lineTo(6, -16); g.lineTo(5, -5); g.lineTo(-5, -5); g.closePath(); g.fill(); }
        else if (t === 'cut') { g.fillStyle = metal; g.beginPath(); g.moveTo(-2, -16); g.lineTo(4, -18); g.lineTo(3, 0); g.lineTo(-2, 0); g.closePath(); g.fill(); }
        else if (t === 'saw') { g.fillStyle = metal; g.fillRect(-2, -16, 14, 5); g.fillStyle = shade('#999999', -40); for (let i = 0; i < 7; i++) g.fillRect(-1 + i * 2, -11, 1, 2); }
        else if (t === 'hammer') { rr(-8, -17, 16, 7, metal, 2); }
        else { rr(-3, -17, 6, 30, metal, 2); g.fillStyle = metal; g.fillRect(-8, 10, 12, 4); }
        g.restore();
        if (def.tool && def.tool.tier >= 3) { circle(31, 9, 4, 'rgba(120,220,255,0.5)'); }
        break;
      }
      case 'weap': {
        if (def.gun && def.gun.kind === 'gun') {
          rr(4, 18, 28, 6, '#4a4a4e', 2); rr(6, 22, 8, 12, '#5a4634', 2);
          rr(24, 12, 5, 8, '#3d3d42', 1); rr(12, 15, 14, 4, '#5a5a60', 1);
        } else if (def.gun) {
          g.strokeStyle = '#8a6b45'; g.lineWidth = 3; g.beginPath(); g.arc(26, C, 16, 2.2, 4.1); g.stroke();
          g.strokeStyle = '#d8d2be'; g.lineWidth = 1; g.beginPath(); g.moveTo(14, 8); g.lineTo(14, 32); g.stroke();
        } else if (def.throwable) {
          circle(C, C + 3, 9, hv > 0 ? '#7a3a2a' : '#4a5a3a'); rr(C - 3, 6, 6, 8, '#8a8a90', 2);
        } else {
          g.save(); g.translate(C, C); g.rotate(-0.7);
          rr(-3, -16, 6, 30, '#6b5030', 2);
          if (key.indexOf('spear') >= 0) { g.fillStyle = '#c8ccd2'; g.beginPath(); g.moveTo(0, -22); g.lineTo(4, -14); g.lineTo(-4, -14); g.closePath(); g.fill(); }
          else if (key.indexOf('nailed') >= 0) { rr(-5, -16, 10, 14, '#7a5c3a', 2); g.fillStyle = '#c8ccd2'; for (let i = 0; i < 6; i++) g.fillRect(-7 + (i % 2) * 12, -15 + i * 2, 4, 1); }
          else rr(-5, -16, 10, 16, '#8a6b45', 2);
          g.restore();
        }
        break;
      }
      case 'ammo': {
        for (let i = 0; i < 3; i++) {
          const x = 9 + i * 8;
          rr(x, 16, 5, 14, '#c8a83a', 1);
          g.fillStyle = '#8a5a3a'; g.beginPath(); g.moveTo(x, 16); g.lineTo(x + 2.5, 9); g.lineTo(x + 5, 16); g.closePath(); g.fill();
        }
        break;
      }
      case 'armor': {
        const slot = def.armor ? def.armor.slot : 'chest';
        const col = shade('#5a6b52', hv);
        if (slot === 'head') { g.fillStyle = col; g.beginPath(); g.arc(C, C + 3, 12, Math.PI, 0); g.fill(); g.fillRect(C - 12, C + 2, 24, 4); }
        else if (slot === 'face') { rr(9, 12, 22, 18, col, 6); circle(16, 20, 4, '#2a2a2e'); circle(25, 20, 4, '#2a2a2e'); rr(15, 28, 11, 7, '#3a3a40', 3); }
        else if (slot === 'feet') { rr(7, 22, 26, 10, col, 3); rr(9, 14, 12, 10, shade(col, -18), 2); }
        else if (slot === 'hands') { rr(11, 14, 18, 16, col, 4); for (let i = 0; i < 3; i++) rr(12 + i * 6, 8, 4, 8, col, 2); }
        else if (slot === 'legs') { rr(11, 8, 8, 26, col, 2); rr(21, 8, 8, 26, col, 2); rr(11, 8, 18, 8, shade(col, 12), 2); }
        else if (slot === 'back') { rr(11, 10, 18, 22, col, 4); rr(14, 14, 12, 8, shade(col, -20), 2); rr(9, 12, 3, 16, shade(col, -30), 2); rr(28, 12, 3, 16, shade(col, -30), 2); }
        else { rr(10, 10, 20, 24, col, 3); rr(6, 12, 6, 12, col, 2); rr(28, 12, 6, 12, col, 2); rr(17, 10, 6, 12, shade(col, -22), 1); }
        break;
      }
      case 'food': {
        if (key.indexOf('can_') === 0) { rr(12, 10, 16, 22, '#b0b4ba', 2); rr(12, 14, 16, 12, shade('#a05a3a', hv), 0); g.fillStyle = '#8a8e94'; g.fillRect(12, 10, 16, 3); }
        else if (key === 'bread') { g.fillStyle = '#c89a56'; g.beginPath(); g.ellipse(C, C + 2, 14, 9, 0, 0, 6.28); g.fill(); g.strokeStyle = '#8a6a34'; g.lineWidth = 1; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(12 + i * 6, C - 4); g.lineTo(14 + i * 6, C + 6); g.stroke(); } }
        else if (key.indexOf('meat') >= 0 || key === 'jerky') { g.fillStyle = key === 'meat_raw' ? '#b05a5a' : '#8a5230'; g.beginPath(); g.ellipse(C, C + 2, 13, 9, 0.3, 0, 6.28); g.fill(); g.fillStyle = '#e8dcc0'; circle(C + 9, C + 6, 3, '#e8dcc0'); }
        else if (key.indexOf('fish') >= 0) { g.fillStyle = key === 'fish_raw' ? '#7a9ab0' : '#b08a5a'; g.beginPath(); g.ellipse(C - 2, C, 12, 7, 0, 0, 6.28); g.fill(); g.beginPath(); g.moveTo(C + 9, C); g.lineTo(C + 16, C - 5); g.lineTo(C + 16, C + 5); g.closePath(); g.fill(); }
        else if (key.indexOf('stew') >= 0 || key.indexOf('soup') >= 0 || key === 'bone_broth') { rr(8, 16, 24, 14, '#6d7176', 3); g.fillStyle = shade('#a06a32', hv); g.fillRect(10, 17, 20, 5); }
        else if (key.indexOf('mushroom') >= 0) { rr(17, 20, 6, 12, '#e0d8c0', 2); g.fillStyle = key === 'mushroom_toxic' ? '#a83a4a' : '#8a6a45'; g.beginPath(); g.arc(C, 20, 11, Math.PI, 0); g.fill(); }
        else if (key.indexOf('seed') === 0) { rr(10, 10, 20, 22, '#c8b98a', 2); }
        else { circle(C, C + 1, 11, shade('#7aa03a', hv)); g.fillStyle = '#4a6b22'; g.fillRect(C - 1, C - 13, 2, 5); }
        break;
      }
      case 'drink': {
        rr(15, 6, 10, 6, '#6d7176', 2);
        rr(12, 11, 16, 22, 'rgba(200,220,230,0.55)', 3);
        const liq = key.indexOf('dirty') >= 0 ? '#5a6b3a' : key === 'booze' ? '#8a5a2a' : key === 'coffee' ? '#3a2a1a' :
          key === 'soda' ? '#8a3a3a' : key === 'energy_drink' ? '#c8c83a' : key === 'tea_herb' ? '#7a9a4a' : '#4a8ab0';
        g.fillStyle = liq; g.fillRect(13, 18, 14, 14);
        break;
      }
      case 'med': {
        if (key.indexOf('bandage') >= 0 || key.indexOf('rag') >= 0 || key === 'moss_dressing') {
          rr(8, 14, 24, 12, '#e8e4d8', 3); g.fillStyle = key === 'moss_dressing' ? '#5a8a3a' : '#c8c4b8'; g.fillRect(16, 14, 8, 12);
        } else if (key.indexOf('herb') >= 0 || key === 'willow_bark') {
          g.strokeStyle = '#5a8a3a'; g.lineWidth = 2; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(C, 32); g.quadraticCurveTo(C - 8 + i * 5, 20, C - 10 + i * 7, 9); g.stroke(); }
        } else if (key.indexOf('serum') >= 0 || key.indexOf('vaccine') >= 0 || key === 'adrenaline') {
          rr(16, 8, 8, 20, 'rgba(220,235,240,0.7)', 2); g.fillStyle = key.indexOf('serum') >= 0 ? '#7ac84a' : '#c84a6a'; g.fillRect(17, 14, 6, 13);
          g.fillStyle = '#b0b4ba'; g.fillRect(19, 28, 2, 7);
        } else if (key === 'suture_kit' || key === 'splint' || key === 'tourniquet') {
          rr(8, 12, 24, 16, '#8a7a5a', 3); g.fillStyle = '#c8ccd2'; g.fillRect(12, 18, 16, 2);
        } else {
          rr(9, 11, 22, 18, '#e8e4dc', 3); g.fillStyle = '#c8302a'; g.fillRect(18, 14, 4, 12); g.fillRect(14, 18, 12, 4);
        }
        break;
      }
      case 'seed': {
        rr(10, 8, 20, 26, shade('#b8a878', hv), 2);
        g.fillStyle = '#5a8a3a'; circle(16, 18, 3, '#5a8a3a'); circle(24, 22, 3, '#5a8a3a'); circle(20, 27, 3, '#7aa84a');
        break;
      }
      case 'key': {
        if (key.indexOf('keycard') >= 0) {
          const col = key.indexOf('red') >= 0 ? '#c8402a' : key.indexOf('yellow') >= 0 ? '#d8c03a' : '#3a7ac8';
          rr(7, 13, 26, 16, col, 2); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(10, 16, 8, 6); g.fillStyle = '#2a2a2e'; g.fillRect(10, 25, 18, 2);
        } else if (key.indexOf('schem') === 0) {
          rr(8, 8, 24, 26, '#2a4a6a', 2); g.strokeStyle = '#8ac8e8'; g.lineWidth = 1;
          g.strokeRect(12, 12, 16, 10); g.beginPath(); g.moveTo(12, 26); g.lineTo(28, 26); g.stroke();
        } else if (key.indexOf('note_') === 0) {
          rr(9, 7, 22, 27, '#e8e2cc', 1); g.strokeStyle = '#8a8272'; g.lineWidth = 1;
          for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(12, 13 + i * 4); g.lineTo(27 - (i % 2) * 5, 13 + i * 4); g.stroke(); }
        } else if (key.indexOf('radio_part') === 0) {
          rr(9, 12, 22, 18, '#3a4a3a', 2); g.fillStyle = '#c8a83a'; for (let i = 0; i < 4; i++) g.fillRect(12 + i * 5, 16, 3, 10);
        } else {
          rr(10, 10, 20, 22, '#8a8a90', 3); g.fillStyle = '#c8a83a'; circle(20, 17, 4, '#c8a83a');
        }
        break;
      }
      case 'part': {
        if (key === 'gear') { g.fillStyle = '#8a8e94'; circle(C, C, 12, '#8a8e94'); for (let i = 0; i < 8; i++) { const a = i * 0.785; g.fillRect(C + Math.cos(a) * 12 - 2, C + Math.sin(a) * 12 - 2, 4, 4); } circle(C, C, 4, '#3a3a40'); }
        else if (key === 'battery' || key === 'battery_dead') { rr(13, 8, 14, 24, key === 'battery' ? '#3a7a3a' : '#5a5a4a', 2); rr(17, 5, 6, 4, '#c8c8c8', 1); }
        else if (key === 'wire') { g.strokeStyle = '#c86a3a'; g.lineWidth = 3; g.beginPath(); for (let i = 0; i <= 20; i++) g.lineTo(9 + i, C + Math.sin(i * 0.9) * 8); g.stroke(); }
        else if (key === 'electronics') { rr(8, 12, 24, 16, '#2a5a3a', 2); g.fillStyle = '#c8a83a'; for (let i = 0; i < 5; i++) g.fillRect(11 + i * 4, 16, 2, 8); }
        else { rr(10, 12, 20, 16, '#7a7e84', 2); g.fillStyle = '#5a5e64'; g.fillRect(13, 15, 14, 3); }
        break;
      }
      default: {
        // 原料：条 / 块 / 粉 / 团
        if (key.indexOf('ingot') >= 0) {
          const c = key.indexOf('steel') >= 0 ? '#c8ccd8' : key.indexOf('copper') >= 0 ? '#c87a3a' : key.indexOf('lead') >= 0 ? '#6a6a78' : '#b0b4ba';
          g.fillStyle = c; g.beginPath(); g.moveTo(9, 24); g.lineTo(13, 16); g.lineTo(29, 16); g.lineTo(33, 24); g.closePath(); g.fill();
          g.fillStyle = shade('#ffffff', -60); g.fillRect(13, 16, 16, 2);
        } else if (key.indexOf('ore') >= 0) {
          circle(C, C, 12, '#7d8285');
          const c = key.indexOf('iron') >= 0 ? '#b08b6a' : key.indexOf('copper') >= 0 ? '#3f9b7a' : key.indexOf('lead') >= 0 ? '#5a5f70' : '#33333a';
          circle(15, 17, 4, c); circle(25, 22, 4, c); circle(20, 27, 3, c);
        } else if (key === 'fiber' || key === 'cord' || key === 'rope' || key === 'sinew') {
          g.strokeStyle = key === 'rope' ? '#b09858' : '#8aa858'; g.lineWidth = 3;
          for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(9, 14 + i * 6); g.quadraticCurveTo(C, 8 + i * 6, 31, 14 + i * 6); g.stroke(); }
        } else if (key === 'log' || key === 'branch' || key === 'stick' || key === 'plank' || key === 'beam_item' || key === 'scrap_wood') {
          const w = key === 'log' ? 12 : key === 'plank' ? 8 : 5;
          g.save(); g.translate(C, C); g.rotate(-0.5);
          rr(-w / 2, -15, w, 30, '#8a6b45', 2); g.fillStyle = '#a5814f'; g.fillRect(-w / 2, -15, w, 3);
          g.restore();
        } else if (key.indexOf('cloth') >= 0 || key === 'leather' || key === 'leather_raw') {
          rr(8, 12, 24, 18, key.indexOf('leather') >= 0 ? '#8a5a34' : shade('#a8a89a', hv), 3);
          g.strokeStyle = 'rgba(0,0,0,0.2)'; g.strokeRect(11, 15, 18, 12);
        } else if (key === 'coal' || key === 'charcoal') { g.fillStyle = key === 'coal' ? '#26262a' : '#3a3a3a'; circle(16, 20, 8, g.fillStyle); circle(25, 24, 6, g.fillStyle); }
        else if (key.indexOf('glass') >= 0) { g.fillStyle = 'rgba(190,220,225,0.6)'; g.beginPath(); g.moveTo(10, 28); g.lineTo(18, 10); g.lineTo(26, 26); g.lineTo(32, 14); g.lineTo(30, 30); g.closePath(); g.fill(); }
        else if (key === 'flint' || key.indexOf('stone') >= 0 || key === 'cobblestone' || key === 'gravel' || key === 'concrete_rubble' || key === 'brick_item') {
          g.fillStyle = key === 'brick_item' ? '#8f4a3a' : key === 'flint' ? '#4a4a52' : '#8a8a85';
          g.beginPath(); g.moveTo(10, 26); g.lineTo(14, 14); g.lineTo(27, 12); g.lineTo(31, 24); g.lineTo(22, 31); g.closePath(); g.fill();
        } else if (key.indexOf('powder') >= 0 || key === 'gunpowder' || key === 'sulfur' || key === 'niter' || key === 'lime' || key === 'flour' || key === 'ash_pile' || key === 'salt') {
          const c = key === 'gunpowder' ? '#3a3a42' : key === 'sulfur' ? '#d8c33a' : key === 'flour' || key === 'salt' ? '#eae6dc' : '#c8c4b4';
          g.fillStyle = c; g.beginPath(); g.moveTo(9, 30); g.quadraticCurveTo(C, 12, 31, 30); g.closePath(); g.fill();
        } else if (key === 'moss' || key === 'leaf_litter' || key === 'straw' || key === 'fungal_fiber' || key === 'glow_moss_clump') {
          const c = key === 'straw' ? '#c8b364' : key === 'glow_moss_clump' ? '#5ad8a8' : '#4d7f36';
          for (let i = 0; i < 12; i++) { const a = i * 0.52; circle(C + Math.cos(a) * (4 + i % 3 * 4), C + Math.sin(a) * (4 + i % 4 * 3), 3, shade(c === '#4d7f36' ? '#4d7f36' : c, (i % 3) * 12)); }
        } else if (key === 'spore_sample') { circle(C, C, 10, 'rgba(150,200,60,0.55)'); circle(C - 4, C - 3, 4, '#c8e84a'); circle(C + 4, C + 3, 3, '#a8d83a'); }
        else if (key === 'bone') { g.fillStyle = '#e0dcc8'; rr(12, 18, 16, 5, '#e0dcc8', 2); circle(12, 17, 4, '#e0dcc8'); circle(12, 24, 4, '#e0dcc8'); circle(28, 17, 4, '#e0dcc8'); circle(28, 24, 4, '#e0dcc8'); }
        else if (key === 'feather') { g.strokeStyle = '#c8ccd2'; g.lineWidth = 2; g.beginPath(); g.moveTo(12, 31); g.quadraticCurveTo(24, 20, 28, 8); g.stroke(); g.fillStyle = 'rgba(200,205,210,0.6)'; g.beginPath(); g.ellipse(22, 18, 7, 4, -0.7, 0, 6.28); g.fill(); }
        else if (key === 'paper' || key === 'book') { rr(10, 8, 21, 26, key === 'book' ? '#7a3a3a' : '#e8e4d4', 2); if (key === 'book') rr(13, 11, 16, 20, '#e8e4d4', 1); }
        else if (key === 'fuel_can' || key === 'diesel_jug' || key === 'alcohol' || key === 'tar' || key === 'resin') {
          rr(11, 10, 18, 24, key === 'fuel_can' ? '#c8302a' : key === 'diesel_jug' ? '#d8b83a' : '#8a6a3a', 3);
          rr(17, 5, 6, 6, '#5a5a5e', 2); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(14, 20, 12, 5);
        } else {
          const c = shade('#8a8a7a', hv);
          g.fillStyle = c; g.beginPath(); g.moveTo(10, 27); g.lineTo(13, 14); g.lineTo(28, 13); g.lineTo(31, 26); g.lineTo(20, 32); g.closePath(); g.fill();
        }
      }
    }
  }

  /* ============================================================== UI */
  class UI {
    constructor(game) {
      this.g = game;
      this.panel = null;
      this.container = null;         // {pos, data}
      this.drag = null;
      this.toasts = [];
      this.el = {};
      this.craftFilter = '';
      this.craftStation = 'hand';
      this.mapZoom = 2;
      this.tipTarget = null;
    }

    /* ------------------------------------------------------- 构建 */
    build() {
      IconSheet.build();
      const root = document.getElementById('ui');
      root.innerHTML = `
      <div id="crosshair"></div>
      <div id="hitmark"></div>
      <div id="vig"></div>
      <div id="topbar">
        <div id="clockbox"><span id="clock">--:--</span><span id="dayn">第 1 天</span><span id="weather">晴</span></div>
        <div id="compass"><div id="compass-strip"></div><div id="compass-mark"></div></div>
        <div id="locbox"><span id="place">荒野</span><span id="coords">0, 0, 0</span></div>
      </div>
      <div id="questtrack"></div>
      <div id="effects"></div>
      <div id="targetinfo"></div>
      <div id="progwrap"><div id="prog"></div></div>
      <div id="statusbars"></div>
      <div id="hotbar"></div>
      <div id="toasts"></div>
      <div id="modal"></div>
      <div id="tooltip"></div>
      <div id="hint">WASD 移动 · 鼠标左键采集 · 右键使用/放置 · E 背包 · C 合成 · M 地图 · J 日志 · Esc 菜单</div>
      `;
      this.el.root = root;
      for (const id of ['crosshair', 'hitmark', 'vig', 'clock', 'dayn', 'weather', 'compass-strip', 'place', 'coords',
        'questtrack', 'effects', 'targetinfo', 'progwrap', 'prog', 'statusbars', 'hotbar', 'toasts', 'modal', 'tooltip', 'hint']) {
        this.el[id] = document.getElementById(id);
      }
      this.buildStatusBars();
      this.buildHotbar();
      this.bindGlobal();
      setTimeout(() => { this.el.hint.style.opacity = '0'; }, 12000);
    }

    buildStatusBars() {
      const defs = [
        ['hp', '生命', '#c8483c'], ['hunger', '饱食', '#c8903c'], ['thirst', '水分', '#3c96c8'],
        ['stamina', '体力', '#8ac83c'],
      ];
      this.el.statusbars.innerHTML = defs.map(([k, n, c]) =>
        `<div class="bar" data-k="${k}"><div class="barfill" style="background:${c}"></div><span class="barlbl">${n}</span><span class="barval"></span></div>`).join('')
        + `<div id="minor"></div>`;
      this.el.minor = document.getElementById('minor');
    }

    buildHotbar() {
      let h = '';
      for (let i = 0; i < 9; i++) h += `<div class="slot hb" data-slot="${i}"><span class="key">${i + 1}</span><div class="icon"></div><span class="cnt"></span><div class="dur"></div></div>`;
      this.el.hotbar.innerHTML = h;
    }

    bindGlobal() {
      document.addEventListener('mousemove', (e) => {
        if (this.drag) {
          const d = document.getElementById('dragghost');
          if (d) { d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; }
        }
        const tt = this.el.tooltip;
        if (tt.style.display === 'block') {
          tt.style.left = Math.min(window.innerWidth - 320, e.clientX + 16) + 'px';
          tt.style.top = Math.min(window.innerHeight - 200, e.clientY + 16) + 'px';
        }
      });
      document.addEventListener('mouseup', () => { if (this.drag) this.endDrag(null); });
    }

    /* ------------------------------------------------------- 提示 */
    toast(text, kind) {
      const d = document.createElement('div');
      d.className = 'toast ' + (kind || '');
      d.textContent = text;
      this.el.toasts.appendChild(d);
      setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 600); }, 3600);
      while (this.el.toasts.children.length > 6) this.el.toasts.firstChild.remove();
    }

    showTip(html) { const t = this.el.tooltip; t.innerHTML = html; t.style.display = 'block'; }
    hideTip() { this.el.tooltip.style.display = 'none'; }

    itemTip(stack) {
      if (!stack) return '';
      const d = GF.Items.get(stack.item);
      if (!d) return stack.item;
      const cat = GF.Items.CATS[d.cat] || d.cat;
      let s = `<div class="tt-name">${d.name}</div><div class="tt-cat">${cat} · ${d.w.toFixed(2)}kg${stack.n > 1 ? ' ×' + stack.n : ''}</div>`;
      if (d.desc) s += `<div class="tt-desc">${d.desc}</div>`;
      const rows = [];
      if (d.tool) rows.push(`工具：${GF.Blocks.NEED_TOOL_NAME[d.tool.type] || d.tool.type} · ${GF.Blocks.TIER_NAME[d.tool.tier]} · 效率 ${d.tool.speed}× · 伤害 ${d.tool.dmg}`);
      if (d.gun) rows.push(`弹药：${GF.Items.nameOf(d.gun.ammo)} · 伤害 ${d.gun.dmg}${d.gun.pellets ? '×' + d.gun.pellets : ''} · 弹容 ${d.gun.mag} · 噪音 ${d.gun.noise}`);
      if (d.armor) rows.push(`护甲 ${d.armor.def} · 保暖 ${d.armor.warm} · 防雨 ${d.armor.rain} · 部位 ${GF.EQUIP_NAME[d.armor.slot]}`);
      if (d.slots) rows.push(`容量 +${d.slots} 格${d.carry ? ' · 负重 +' + d.carry + 'kg' : ''}`);
      if (d.food) rows.push(`饱食 +${d.food.cal} · 水分 ${d.food.water >= 0 ? '+' : ''}${d.food.water}${d.food.sick ? ' · 生病风险 ' + Math.round(d.food.sick * 100) + '%' : ''}${d.food.spoil ? ' · 可存 ' + d.food.spoil + 'h' : ''}`);
      if (d.drink) rows.push(`水分 +${d.drink.water}${d.drink.sick ? ' · 生病风险 ' + Math.round(d.drink.sick * 100) + '%' : ''}`);
      if (d.med) {
        const m = d.med, p = [];
        if (m.heal) p.push('治疗 +' + m.heal); if (m.bleed) p.push('止血 ' + m.bleed);
        if (m.infect) p.push('感染 ' + (m.infect > 0 ? '+' : '') + Math.round(m.infect * 100));
        if (m.sick) p.push('疾病 ' + Math.round(m.sick * 100)); if (m.pain) p.push('镇痛 ' + m.pain);
        rows.push(p.join(' · '));
      }
      if (d.fuel) rows.push(`燃料 ${d.fuel}s`);
      if (d.place) rows.push(`可放置：${GF.Blocks.byKey[d.place] ? GF.Blocks.byKey[d.place].name : d.place}`);
      if (d.schematic) rows.push(`使用后解锁：${GF.Recipes.UNLOCKS[d.schematic]} 配方`);
      if (d.seed) rows.push('可在耕地/育苗箱播种');
      if (stack.dur != null) {
        const md = GF.Items.maxDur(stack.item);
        rows.push(`耐久 ${Math.max(0, Math.round(stack.dur))} / ${md}`);
      }
      if (stack.fresh !== undefined && d.food && d.food.spoil) {
        rows.push(`新鲜度 ${Math.round(stack.fresh * 100)}%${stack.fresh <= 0.25 ? '（已变质）' : ''}`);
      }
      if (rows.length) s += '<div class="tt-stats">' + rows.map((r) => `<div>${r}</div>`).join('') + '</div>';
      // 用途提示
      const uses = GF.Recipes.all.filter((r) => r.ins.some(([k]) => k === stack.item)).slice(0, 4);
      if (uses.length) s += `<div class="tt-use">可用于：${uses.map((r) => GF.Items.nameOf(r.out)).join('、')}${uses.length >= 4 ? '…' : ''}</div>`;
      return s;
    }

    /* ------------------------------------------------- 每帧刷新 HUD */
    update(dt) {
      const g = this.g, s = g.sv, p = g.player, w = g.world;
      // 状态条（每帧，只改 style，开销很小）
      const vals = { hp: p.hp / p.maxHp, hunger: s.hunger / 100, thirst: s.thirst / 100, stamina: s.stamina / 100 };
      const raws = { hp: Math.round(p.hp), hunger: Math.round(s.hunger), thirst: Math.round(s.thirst), stamina: Math.round(s.stamina) };
      if (!this._bars) this._bars = Array.from(this.el.statusbars.querySelectorAll('.bar'));
      for (const bar of this._bars) {
        const k = bar.dataset.k;
        bar.querySelector('.barfill').style.width = (U.clamp(vals[k], 0, 1) * 100) + '%';
        bar.querySelector('.barval').textContent = raws[k];
        bar.classList.toggle('low', vals[k] < 0.25);
      }
      // 快捷栏选中高亮（每帧）
      const hb = this.el.hotbar.children;
      for (let i = 0; i < 9; i++) hb[i].classList.toggle('sel', g.inv.sel === i);
      // 受伤暗角（每帧，只改 style）
      const hurt = 1 - p.hp / p.maxHp;
      this.el.vig.style.opacity = String(U.clamp(hurt * 0.85 + (s.infection / 100) * 0.35 + (s.fatigue > 70 ? (s.fatigue - 70) / 90 : 0), 0, 0.92));
      this.el.vig.style.background = s.infection > 45
        ? 'radial-gradient(ellipse at center, transparent 45%, rgba(60,110,40,0.85) 100%)'
        : 'radial-gradient(ellipse at center, transparent 45%, rgba(120,10,10,0.85) 100%)';

      // 其余部分 8Hz 刷新即可（避免每帧重建 innerHTML）
      this._slowT = (this._slowT || 0) - dt;
      if (this._slowT > 0) return;
      this._slowT = 0.12;

      // 次要状态
      const minor = [];
      const tc = s.temp < 35.4 ? 'bad' : s.temp > 38.6 ? 'bad' : s.temp < 36.2 || s.temp > 37.8 ? 'warn' : '';
      minor.push(`<span class="mi ${tc}" title="核心体温">🌡 ${s.temp.toFixed(1)}℃</span>`);
      if (s.wet > 6) minor.push(`<span class="mi ${s.wet > 55 ? 'warn' : ''}" title="潮湿">💧 ${Math.round(s.wet)}%</span>`);
      if (s.infection > 0.5) minor.push(`<span class="mi ${s.infection > 40 ? 'bad' : 'warn'}" title="感染度">☣ ${Math.round(s.infection)}%</span>`);
      if (s.bleed > 0.02) minor.push(`<span class="mi bad" title="流血">🩸 ${s.bleed.toFixed(1)}</span>`);
      if (s.sick > 2) minor.push(`<span class="mi ${s.sick > 45 ? 'bad' : 'warn'}" title="疾病">🤢 ${Math.round(s.sick)}</span>`);
      if (s.fatigue > 40) minor.push(`<span class="mi ${s.fatigue > 80 ? 'bad' : 'warn'}" title="疲劳">😴 ${Math.round(s.fatigue)}</span>`);
      const wt = g.inv.weight(), mw = g.inv.maxWeight();
      minor.push(`<span class="mi ${wt > mw ? 'bad' : wt > mw * 0.85 ? 'warn' : ''}" title="负重">🎒 ${wt.toFixed(1)}/${mw}kg</span>`);
      const mh = minor.join('');
      if (mh !== this._lastMinor) { this.el.minor.innerHTML = mh; this._lastMinor = mh; }

      // 效果图标
      const eh = s.effects.map((e) =>
        `<div class="eff" title="${e.name} ${Math.ceil(e.t)}s">${e.icon}<span>${Math.ceil(e.t)}</span></div>`).join('');
      if (eh !== this._lastEff) { this.el.effects.innerHTML = eh; this._lastEff = eh; }

      // 时钟 / 天气 / 坐标
      const showClock = g.inv.grants('clock') || g.inv.grants('gps');
      this.el.clock.textContent = showClock ? U.fmtClock(w.time) : (w.isNight() ? '夜' : w.time < 0.35 ? '清晨' : w.time < 0.55 ? '正午' : w.time < 0.75 ? '午后' : '黄昏');
      this.el.dayn.textContent = '第 ' + w.day + ' 天';
      const wn = { clear: '☀ 晴', overcast: '☁ 阴', fog: '🌫 雾', rain: '🌧 雨', storm: '⛈ 暴雨' };
      this.el.weather.textContent = wn[w.weather.kind] || w.weather.kind;
      const gps = g.inv.grants('gps');
      this.el.coords.textContent = gps ? `${Math.round(p.x)}, ${Math.round(p.y)}, ${Math.round(p.z)}`
        : `${Math.round(p.x / 16) * 16}, ~, ${Math.round(p.z / 16) * 16}`;
      const near = GF.Landmarks.nearest(p.x, p.z);
      const bio = s.env.biome;
      this.el.place.textContent = (near.d < (near.l.r + 30) ? near.l.name : (bio ? bio.name : '荒野'))
        + (near.d < near.l.r + 30 ? '' : ` · ${near.l.name} ${Math.round(near.d)}m`);

      // 指南针
      if (g.inv.grants('compass') || gps) {
        this.el['compass-strip'].style.display = 'block';
        const deg = ((-p.yaw * 180 / Math.PI) % 360 + 360) % 360;
        this.el['compass-strip'].style.transform = `translateX(${-deg * 2 + 180}px)`;
      } else this.el['compass-strip'].style.display = 'none';

      // 快捷栏内容
      this.refreshHotbar();

      // 任务追踪
      const q = g.quests.activeMain();
      const qh = q ? (`<div class="qt-name">◈ ${q.def.name}</div><div class="qt-desc">${q.def.desc}</div>`
        + (q.st.max > 1 ? `<div class="qt-bar"><i style="width:${q.st.cur / q.st.max * 100}%"></i></div><div class="qt-num">${q.st.cur}/${q.st.max}</div>` : '')) : '';
      if (qh !== this._lastQuest) { this.el.questtrack.innerHTML = qh; this._lastQuest = qh; }
    }

    refreshHotbar() {
      const inv = this.g.inv;
      const slots = this.el.hotbar.children;
      for (let i = 0; i < 9; i++) {
        const el = slots[i], st = inv.slots[i];
        el.classList.toggle('sel', inv.sel === i);
        const ic = el.querySelector('.icon'), cnt = el.querySelector('.cnt'), dur = el.querySelector('.dur');
        if (!st) { ic.style.cssText = ''; ic.className = 'icon'; cnt.textContent = ''; dur.style.display = 'none'; el.title = ''; continue; }
        ic.style.cssText = IconSheet.style(st.item);
        cnt.textContent = st.n > 1 ? st.n : '';
        el.title = GF.Items.nameOf(st.item);
        const md = GF.Items.maxDur(st.item);
        if (st.dur != null && md > 0) {
          dur.style.display = 'block';
          const r = U.clamp(st.dur / md, 0, 1);
          dur.firstChild ? null : dur.appendChild(document.createElement('i'));
          dur.firstChild.style.width = (r * 100) + '%';
          dur.firstChild.style.background = r > 0.5 ? '#7ac84a' : r > 0.22 ? '#d8b83a' : '#c8483c';
        } else dur.style.display = 'none';
      }
    }

    setTarget(info) {
      const el = this.el.targetinfo;
      if (!info) {
        if (this._lastTarget !== null) { el.innerHTML = ''; el.classList.remove('show'); this._lastTarget = null; }
        return;
      }
      let s = `<b>${info.name}</b>`;
      if (info.action) s += `<span class="ta">${info.action}</span>`;
      if (info.warn) s += `<span class="tw">${info.warn}</span>`;
      if (info.sub) s += `<span class="ts">${info.sub}</span>`;
      if (s === this._lastTarget) return;
      this._lastTarget = s;
      el.classList.add('show');
      el.innerHTML = s;
    }
    setProgress(v) {
      if (v == null || v <= 0) { this.el.progwrap.style.opacity = '0'; return; }
      this.el.progwrap.style.opacity = '1';
      this.el.prog.style.width = (U.clamp(v, 0, 1) * 100) + '%';
    }
    hitMark() {
      const h = this.el.hitmark;
      h.style.opacity = '1'; h.style.transform = 'scale(1.5)';
      setTimeout(() => { h.style.opacity = '0'; h.style.transform = 'scale(1)'; }, 130);
    }

    /* ==================================================== 面板系统 */
    isModal() { return !!this.panel; }
    closePanel() {
      this.panel = null; this.container = null;
      this.el.modal.innerHTML = ''; this.el.modal.classList.remove('show');
      this.hideTip();
      GF.bus.emit('ui:close');
    }
    togglePanel(name, arg) {
      if (this.panel === name) { this.closePanel(); return; }
      this.openPanel(name, arg);
    }
    openPanel(name, arg) {
      this.panel = name;
      this.el.modal.classList.add('show');
      this.hideTip();
      if (name === 'inventory') this.renderInventory();
      else if (name === 'craft') this.renderCraft();
      else if (name === 'map') this.renderMap();
      else if (name === 'journal') this.renderJournal();
      else if (name === 'settings') this.renderSettings();
      else if (name === 'container') this.renderInventory(arg);
      else if (name === 'death') this.renderDeath(arg);
      else if (name === 'sleep') this.renderSleep(arg);
      else if (name === 'radio') this.renderRadio(arg);
      else if (name === 'note') this.renderNote(arg);
      GF.bus.emit('ui:open', name);
    }

    frame(title, body, cls, noClose) {
      return `<div class="panel ${cls || ''}"><div class="ph"><span>${title}</span>${noClose ? '' : '<button class="pclose">✕</button>'}</div><div class="pb">${body}</div></div>`;
    }
    afterRender() {
      const c = this.el.modal.querySelector('.pclose');
      if (c) c.onclick = () => { this.g.audio.ui(); this.closePanel(); };
    }

    /* --------------------------------------------------- 背包面板 */
    slotHTML(st, kind, i, extra) {
      const md = st ? GF.Items.maxDur(st.item) : 0;
      const durBar = (st && st.dur != null && md > 0)
        ? `<div class="dur"><i style="width:${U.clamp(st.dur / md, 0, 1) * 100}%;background:${st.dur / md > 0.5 ? '#7ac84a' : st.dur / md > 0.22 ? '#d8b83a' : '#c8483c'}"></i></div>` : '';
      const spoil = (st && st.fresh !== undefined && st.fresh <= 0.25) ? '<span class="spoil">腐</span>' : '';
      return `<div class="slot ${kind} ${st ? '' : 'empty'} ${extra || ''}" data-kind="${kind}" data-i="${i}">
        ${st ? `<div class="icon" style="${IconSheet.style(st.item)}"></div><span class="cnt">${st.n > 1 ? st.n : ''}</span>${durBar}${spoil}` : ''}
      </div>`;
    }

    renderInventory(containerPos) {
      const g = this.g, inv = g.inv;
      inv.ensureSize();
      let cont = null;
      if (containerPos) {
        cont = g.world.containerAt(containerPos.x, containerPos.y, containerPos.z);
        this.container = { pos: containerPos, data: cont };
      } else if (this.container) { cont = this.container.data; }

      const eq = GF.EQUIP_SLOTS.map((k) =>
        `<div class="eqrow"><span>${GF.EQUIP_NAME[k]}</span>${this.slotHTML(inv.equip[k], 'equip', k)}</div>`).join('');
      const main = inv.slots.map((st, i) => this.slotHTML(st, 'inv', i, i < 9 ? 'isHot' : '')).join('');
      const contHTML = cont ? `<div class="col"><h4>${GF.Blocks.list[g.world.getBlock(containerPos ? containerPos.x : this.container.pos.x, containerPos ? containerPos.y : this.container.pos.y, containerPos ? containerPos.z : this.container.pos.z)].name}
        <button class="mini" id="takeall">全部取出</button></h4>
        <div class="grid cont">${(cont.items || []).map((st, i) => this.slotHTML(st, 'cont', i)).join('')}
        ${Array.from({ length: Math.max(0, 30 - (cont.items || []).length) }, (_, i) => this.slotHTML(null, 'cont', (cont.items || []).length + i)).join('')}</div></div>` : '';

      const body = `<div class="invwrap">
        <div class="col eqcol"><h4>装备</h4>${eq}
          <div class="statbox">
            <div>护甲 <b>${inv.defense().toFixed(1)}</b></div>
            <div>保暖 <b>${inv.warmth()}</b></div>
            <div>防雨 <b>${inv.rainProof()}</b></div>
            <div>防孢 <b>${Math.round(inv.sporeProof() * 100)}%</b></div>
            <div>负重 <b>${inv.weight().toFixed(1)}/${inv.maxWeight()}kg</b></div>
            <div>格数 <b>${inv.slots.length}</b></div>
          </div>
        </div>
        <div class="col"><h4>背包<span class="hintsm">左键拖动 · 右键使用/装备 · Shift+左键 快速转移</span></h4><div class="grid">${main}</div></div>
        ${contHTML}
      </div>`;
      this.el.modal.innerHTML = this.frame('背包与装备', body, 'wide');
      this.afterRender();
      this.bindSlots();
      const ta = document.getElementById('takeall');
      if (ta) ta.onclick = () => { g.takeAll(); this.renderInventory(); };
    }

    bindSlots() {
      const g = this.g;
      for (const el of this.el.modal.querySelectorAll('.slot')) {
        el.onmousedown = (ev) => {
          ev.preventDefault();
          const kind = el.dataset.kind, i = el.dataset.i;
          if (ev.button === 2) return;
          const st = this.getStack(kind, i);
          if (!st) return;
          if (ev.shiftKey) { this.quickMove(kind, i); return; }
          this.startDrag(kind, i, ev);
        };
        el.oncontextmenu = (ev) => {
          ev.preventDefault();
          const kind = el.dataset.kind, i = el.dataset.i;
          const st = this.getStack(kind, i);
          if (!st) return;
          if (kind === 'equip') { g.inv.unequip(i); }
          else if (kind === 'cont') { this.quickMove(kind, i); }
          else g.useItemSlot(parseInt(i, 10));
          this.rerender();
        };
        el.onmouseenter = () => {
          const st = this.getStack(el.dataset.kind, el.dataset.i);
          if (st) this.showTip(this.itemTip(st)); else this.hideTip();
        };
        el.onmouseleave = () => this.hideTip();
        el.onmouseup = (ev) => { if (this.drag) { ev.stopPropagation(); this.endDrag({ kind: el.dataset.kind, i: el.dataset.i }); } };
      }
    }

    getStack(kind, i) {
      const g = this.g;
      if (kind === 'inv') return g.inv.slots[parseInt(i, 10)] || null;
      if (kind === 'equip') return g.inv.equip[i] || null;
      if (kind === 'cont') return (this.container && this.container.data.items[parseInt(i, 10)]) || null;
      return null;
    }
    setStack(kind, i, st) {
      const g = this.g;
      if (kind === 'inv') g.inv.slots[parseInt(i, 10)] = st;
      else if (kind === 'equip') g.inv.equip[i] = st;
      else if (kind === 'cont') {
        const arr = this.container.data.items;
        const idx = parseInt(i, 10);
        while (arr.length <= idx) arr.push(null);
        arr[idx] = st;
      }
    }

    startDrag(kind, i, ev) {
      const st = this.getStack(kind, i);
      if (!st) return;
      this.drag = { kind, i, st };
      const d = document.createElement('div');
      d.id = 'dragghost';
      d.innerHTML = `<div class="icon" style="${IconSheet.style(st.item)}"></div><span>${st.n > 1 ? st.n : ''}</span>`;
      d.style.left = ev.clientX + 'px'; d.style.top = ev.clientY + 'px';
      document.body.appendChild(d);
    }
    endDrag(dst) {
      const gh = document.getElementById('dragghost');
      if (gh) gh.remove();
      const src = this.drag;
      this.drag = null;
      if (!src || !dst) return;
      if (src.kind === dst.kind && String(src.i) === String(dst.i)) return;
      const g = this.g;
      const a = this.getStack(src.kind, src.i), b = this.getStack(dst.kind, dst.i);
      if (!a) return;
      // 装备槽校验
      if (dst.kind === 'equip') {
        const d = GF.Items.get(a.item);
        if (!d || !d.armor || d.armor.slot !== dst.i) { this.g.audio.error(); return; }
      }
      if (src.kind === 'equip' && dst.kind !== 'equip') {
        // 卸下
        this.setStack(src.kind, src.i, b);
        this.setStack(dst.kind, dst.i, a);
        g.inv.ensureSize();
        this.rerender(); return;
      }
      // 同物品堆叠
      if (b && b.item === a.item) {
        const cap = GF.Items.stackOf(a.item);
        const move = Math.min(cap - b.n, a.n);
        if (move > 0) {
          b.n += move; a.n -= move;
          if (a.n <= 0) this.setStack(src.kind, src.i, null);
          this.g.audio.ui(); this.rerender(); return;
        }
      }
      this.setStack(src.kind, src.i, b);
      this.setStack(dst.kind, dst.i, a);
      g.inv.ensureSize();
      this.g.audio.ui();
      this.rerender();
    }

    quickMove(kind, i) {
      const g = this.g;
      const st = this.getStack(kind, i);
      if (!st) return;
      if (kind === 'cont') {
        const left = g.inv.add(st.item, st.n, st.dur);
        if (left === 0) this.setStack('cont', i, null); else st.n = left;
      } else if (kind === 'inv' && this.container) {
        const arr = this.container.data.items;
        let placed = false;
        for (const s2 of arr) {
          if (s2 && s2.item === st.item && s2.n < GF.Items.stackOf(st.item)) {
            const cap = GF.Items.stackOf(st.item), move = Math.min(cap - s2.n, st.n);
            s2.n += move; st.n -= move;
            if (st.n <= 0) { this.setStack('inv', i, null); placed = true; break; }
          }
        }
        if (!placed && st.n > 0) {
          let slot = arr.findIndex((x) => !x);
          if (slot < 0 && arr.length < 30) { arr.push(null); slot = arr.length - 1; }
          if (slot >= 0) { arr[slot] = st; this.setStack('inv', i, null); }
          else { this.toast('容器满了。', 'warn'); }
        }
      } else if (kind === 'inv') {
        const d = GF.Items.get(st.item);
        if (d && d.armor) { g.inv.equipFrom(parseInt(i, 10)); }
        else {
          // 快捷栏 <-> 背包 互换
          const ii = parseInt(i, 10);
          if (ii < 9) {
            for (let k = 9; k < g.inv.slots.length; k++) if (!g.inv.slots[k]) { g.inv.swap(ii, k); break; }
          } else {
            for (let k = 0; k < 9; k++) if (!g.inv.slots[k]) { g.inv.swap(ii, k); break; }
          }
        }
      } else if (kind === 'equip') {
        g.inv.unequip(i);
      }
      this.g.audio.ui();
      this.rerender();
    }

    rerender() {
      if (this.panel === 'inventory' || this.panel === 'container') this.renderInventory(this.container ? this.container.pos : null);
      else if (this.panel === 'craft') this.renderCraft();
      this.refreshHotbar();
    }

    /* --------------------------------------------------- 合成面板 */
    renderCraft() {
      const g = this.g, inv = g.inv;
      const near = g.nearbyStations();
      const stations = ['hand'].concat(Object.keys(GF.Recipes.STATIONS).filter((k) => k !== 'hand' && near[k]));
      if (!stations.includes(this.craftStation)) this.craftStation = 'hand';
      const tabs = Object.keys(GF.Recipes.STATIONS).map((k) => {
        const ok = k === 'hand' || near[k];
        return `<button class="tab ${this.craftStation === k ? 'on' : ''} ${ok ? '' : 'dis'}" data-st="${k}">${GF.Recipes.STATIONS[k].icon} ${GF.Recipes.STATIONS[k].name}</button>`;
      }).join('');

      const list = GF.Recipes.forStation(this.craftStation, g.unlocks)
        .filter((r) => !this.craftFilter || GF.Items.nameOf(r.out).includes(this.craftFilter) || r.out.includes(this.craftFilter));
      const rows = list.map((r) => {
        const canMats = inv.hasAll(r.ins);
        const needTool = r.need ? inv.hasToolType(r.need) : true;
        const needItem = r.needItem ? inv.hasItem(r.needItem) : true;
        const ok = canMats && needTool && needItem;
        const ing = r.ins.map(([k, c]) => {
          const have = inv.count(k);
          const n = Math.ceil(c);
          return `<span class="ing ${have >= n ? 'ok' : 'no'}"><i style="${IconSheet.style(k)}"></i>${GF.Items.nameOf(k)} ${have}/${n}</span>`;
        }).join('');
        const extra = [];
        if (r.need && !needTool) extra.push(`需要${GF.Blocks.NEED_TOOL_NAME[r.need] || r.need}类工具`);
        if (r.needItem && !needItem) extra.push(`需要 ${GF.Items.nameOf(r.needItem)}`);
        if (r.fuel) extra.push('消耗燃料');
        return `<div class="recipe ${ok ? '' : 'locked'}" data-rid="${r.id}">
          <div class="ricon" style="${IconSheet.style(r.out)}"></div>
          <div class="rmain"><div class="rname">${GF.Items.nameOf(r.out)}${r.n > 1 ? ' ×' + r.n : ''}<span class="rtime">${r.time}s</span></div>
          <div class="rings">${ing}</div>${extra.length ? `<div class="rwarn">${extra.join(' · ')}</div>` : ''}</div>
          <button class="cbtn" ${ok ? '' : 'disabled'} data-rid="${r.id}">制作</button>
        </div>`;
      }).join('') || '<div class="nothing">这个工作站还没有可用配方。<br>找到图纸能解锁更多。</div>';

      const unlocked = Object.keys(GF.Recipes.UNLOCKS).map((k) =>
        `<span class="ul ${g.unlocks[k] ? 'on' : ''}">${GF.Recipes.UNLOCKS[k]}</span>`).join('');

      const body = `<div class="crafttabs">${tabs}</div>
        <input id="cfilter" placeholder="搜索配方…" value="${this.craftFilter}">
        <div class="unlocks">已掌握技术：${unlocked}</div>
        <div class="recipes">${rows}</div>`;
      this.el.modal.innerHTML = this.frame('制作', body, 'wide');
      this.afterRender();
      for (const t of this.el.modal.querySelectorAll('.tab')) {
        t.onclick = () => {
          if (t.classList.contains('dis')) { this.toast('附近没有' + GF.Recipes.STATIONS[t.dataset.st].name + '。', 'warn'); this.g.audio.error(); return; }
          this.craftStation = t.dataset.st; this.g.audio.ui(); this.renderCraft();
        };
      }
      const f = document.getElementById('cfilter');
      f.oninput = () => { this.craftFilter = f.value.trim(); this.renderCraft(); document.getElementById('cfilter').focus(); };
      for (const b of this.el.modal.querySelectorAll('.cbtn')) {
        b.onclick = () => { g.craft(parseInt(b.dataset.rid, 10)); this.renderCraft(); };
      }
      for (const r of this.el.modal.querySelectorAll('.recipe')) {
        r.onmouseenter = () => {
          const rid = parseInt(r.dataset.rid, 10);
          const rec = GF.Recipes.all[rid];
          this.showTip(this.itemTip({ item: rec.out, n: rec.n }));
        };
        r.onmouseleave = () => this.hideTip();
      }
    }

    /* ----------------------------------------------------- 地图 */
    renderMap() {
      const g = this.g;
      const body = `<div class="maptools">
          <button class="mini" id="zin">＋</button><button class="mini" id="zout">－</button>
          <span class="hintsm">已探索 ${g.world.mapTiles.size} 区块 · 已发现 ${g.discovered.size} / ${GF.Landmarks.list.length} 处地标</span>
        </div>
        <canvas id="mapcv" width="860" height="600"></canvas>
        <div id="maplegend"></div>`;
      this.el.modal.innerHTML = this.frame('地图', body, 'wide');
      this.afterRender();
      const cv = document.getElementById('mapcv');
      const draw = () => this.drawMap(cv);
      draw();
      document.getElementById('zin').onclick = () => { this.mapZoom = Math.min(8, this.mapZoom + 1); draw(); };
      document.getElementById('zout').onclick = () => { this.mapZoom = Math.max(1, this.mapZoom - 1); draw(); };
      cv.onmousemove = (ev) => {
        const r = cv.getBoundingClientRect();
        const mx = (ev.clientX - r.left) * (cv.width / r.width), my = (ev.clientY - r.top) * (cv.height / r.height);
        const ppb = this.mapZoom / 16;
        const wx = Math.round(this.g.player.x + (mx - cv.width / 2) / ppb);
        const wz = Math.round(this.g.player.z + (my - cv.height / 2) / ppb);
        const l = GF.Landmarks.list.find((L) => this.g.discovered.has(L.key) && Math.hypot(L.x - wx, L.z - wz) < 14 / ppb);
        document.getElementById('maplegend').innerHTML = l
          ? `<b>${l.icon} ${l.name}</b> (${l.x}, ${l.z}) — ${l.desc || ''}`
          : `坐标 ${wx}, ${wz}`;
      };
    }

    drawMap(cv) {
      const g = this.g, w = g.world, z = this.mapZoom;
      const ctx = cv.getContext('2d');
      const W = cv.width, H = cv.height;
      const ppb = z / 16;                     // 每方块像素
      const bs = Math.max(1, 16 * ppb);       // 每区块像素
      ctx.fillStyle = '#0d1110'; ctx.fillRect(0, 0, W, H);
      const px = g.player.x, pz = g.player.z;
      for (const [k, v] of w.mapTiles) {
        const p = k.split(',');
        const cx = parseInt(p[0], 10), cz = parseInt(p[1], 10);
        const bx = W / 2 + (cx * 16 - px) * ppb;
        const bz = H / 2 + (cz * 16 - pz) * ppb;
        if (bx < -bs || bx > W || bz < -bs || bz > H) continue;
        const bio = GF.Biomes.list[v.b] || GF.Biomes.list[0];
        ctx.fillStyle = bio.map;
        ctx.fillRect(bx | 0, bz | 0, Math.ceil(bs), Math.ceil(bs));
        const sh = U.clamp((v.h - 28) / 50, 0, 1);
        ctx.fillStyle = sh > 0.5 ? `rgba(255,255,255,${(sh - 0.5) * 0.55})` : `rgba(0,0,0,${(0.5 - sh) * 0.55})`;
        ctx.fillRect(bx | 0, bz | 0, Math.ceil(bs), Math.ceil(bs));
        if (v.h <= GF.SEA) {
          ctx.fillStyle = 'rgba(40,90,120,0.72)';
          ctx.fillRect(bx | 0, bz | 0, Math.ceil(bs), Math.ceil(bs));
        }
      }
      // 地标
      for (const l of GF.Landmarks.list) {
        const known = g.discovered.has(l.key);
        const bx = W / 2 + (l.x - px) * ppb;
        const bz = H / 2 + (l.z - pz) * ppb;
        if (bx < -30 || bx > W + 30 || bz < -30 || bz > H + 30) continue;
        if (!known && !g.inv.grants('gps')) continue;
        ctx.font = '16px system-ui';
        ctx.textAlign = 'center';
        ctx.globalAlpha = known ? 1 : 0.4;
        ctx.fillStyle = '#fff';
        ctx.fillText(l.icon, bx, bz + 5);
        if (z >= 4) {
          ctx.fillStyle = '#e8e4d0'; ctx.font = '11px system-ui';
          ctx.fillText(l.name, bx, bz - 10);
        }
      }
      ctx.globalAlpha = 1;
      // 玩家箭头
      ctx.save();
      ctx.translate(W / 2, H / 2); ctx.rotate(-g.player.yaw + Math.PI);
      ctx.fillStyle = '#ffd45a'; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill();
      ctx.restore();
      // 比例尺
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(8, H - 26, 140, 18);
      ctx.fillStyle = '#cfe0c8'; ctx.font = '11px system-ui'; ctx.textAlign = 'left';
      ctx.fillText(`1px ≈ ${(1 / ppb).toFixed(1)}m　缩放 ${z}×`, 14, H - 13);
    }

    /* ----------------------------------------------------- 日志 */
    renderJournal() {
      const g = this.g;
      const qs = g.quests.list();
      const quests = qs.map(({ def, st }) => `<div class="jq ${st.done ? 'done' : ''}">
        <div class="jqh">${st.done ? '✔' : (def.main ? '◈' : '◇')} ${def.name}${def.main ? '<span class="tagm">主线</span>' : ''}</div>
        <div class="jqd">${def.desc}</div>
        ${st.max > 1 ? `<div class="qt-bar"><i style="width:${st.cur / st.max * 100}%"></i></div><span class="jqn">${st.cur}/${st.max}</span>` : ''}
        ${def.hint && !st.done ? `<div class="jqhint">💡 ${def.hint}</div>` : ''}</div>`).join('');
      const notes = Array.from(g.notes).sort((a, b) => a - b).map((n) => {
        const N = GF.NOTES[n];
        return `<div class="jn"><div class="jnh">📄 ${N.title}</div><div class="jnt">${N.text.replace(/\n/g, '<br>')}</div></div>`;
      }).join('') || '<div class="nothing">还没有找到任何笔记。搜刮行李箱、背包与文件柜。</div>';
      const lm = GF.Landmarks.list.map((l) => g.discovered.has(l.key)
        ? `<div class="jl"><b>${l.icon} ${l.name}</b><span>(${l.x}, ${l.z})</span><div>${l.desc || ''}</div></div>`
        : `<div class="jl unk"><b>？？？</b></div>`).join('');
      const s = g.sv.stats;
      const stats = `<div class="jstats">
        <div>存活时长 <b>${Math.floor(g.sv.timeAlive / 60)} 分钟</b></div>
        <div>天数 <b>${g.world.day}</b></div>
        <div>挖掘方块 <b>${s.blocksMined}</b></div>
        <div>制作次数 <b>${s.itemsCrafted}</b></div>
        <div>击杀 <b>${s.kills}</b></div>
        <div>行走距离 <b>${Math.round(s.distance)}m</b></div>
        <div>死亡次数 <b>${s.deaths}</b></div>
        <div>已探索区块 <b>${g.world.mapTiles.size}</b></div>
      </div>`;
      const body = `<div class="jtabs"><button class="tab on" data-j="q">任务</button><button class="tab" data-j="n">笔记 (${g.notes.size})</button><button class="tab" data-j="l">地标 (${g.discovered.size})</button><button class="tab" data-j="s">统计</button></div>
        <div class="jbody" id="jq">${quests}</div>
        <div class="jbody" id="jn" style="display:none">${notes}</div>
        <div class="jbody" id="jl" style="display:none">${lm}</div>
        <div class="jbody" id="js" style="display:none">${stats}</div>`;
      this.el.modal.innerHTML = this.frame('日志', body, 'wide');
      this.afterRender();
      for (const t of this.el.modal.querySelectorAll('.jtabs .tab')) {
        t.onclick = () => {
          for (const x of this.el.modal.querySelectorAll('.jtabs .tab')) x.classList.remove('on');
          t.classList.add('on');
          for (const id of ['jq', 'jn', 'jl', 'js']) document.getElementById(id).style.display = 'none';
          document.getElementById('j' + t.dataset.j).style.display = 'block';
        };
      }
    }

    /* ----------------------------------------------------- 设置 */
    renderSettings() {
      const g = this.g;
      const body = `<div class="settings">
        <label>视野距离 <input type="range" id="s_rd" min="3" max="14" value="${g.renderer.renderDist}"><span id="v_rd">${g.renderer.renderDist}</span> 区块</label>
        <label>视场角 FOV <input type="range" id="s_fov" min="55" max="100" value="${g.renderer.fov}"><span id="v_fov">${g.renderer.fov}</span></label>
        <label>鼠标灵敏度 <input type="range" id="s_sens" min="1" max="30" value="${Math.round(g.sensitivity * 1000)}"><span id="v_sens">${(g.sensitivity * 1000).toFixed(0)}</span></label>
        <label>音量 <input type="range" id="s_vol" min="0" max="100" value="${Math.round(g.audio.volume * 100)}"><span id="v_vol">${Math.round(g.audio.volume * 100)}</span></label>
        <label>僵尸密度 <input type="range" id="s_zm" min="0" max="200" value="${Math.round(g.ents.zombieMul * 100)}"><span id="v_zm">${Math.round(g.ents.zombieMul * 100)}</span>%</label>
        <label>野生动物密度 <input type="range" id="s_am" min="0" max="200" value="${Math.round(g.ents.animalMul * 100)}"><span id="v_am">${Math.round(g.ents.animalMul * 100)}</span>%</label>
        <label>一天时长 <input type="range" id="s_day" min="300" max="2400" step="60" value="${g.dayLength}"><span id="v_day">${Math.round(g.dayLength / 60)}</span> 分钟</label>
        <div class="setrow">
          <button class="btn" id="b_save">保存游戏</button>
          <button class="btn" id="b_load">读取存档</button>
          <button class="btn danger" id="b_new">新游戏（换种子）</button>
        </div>
        <div class="setrow"><button class="btn" id="b_help">操作说明</button><span class="hintsm">种子：${g.world.seed}</span></div>
      </div>`;
      this.el.modal.innerHTML = this.frame('设置', body, '');
      this.afterRender();
      const bind = (id, vid, fn, fmt) => {
        const el = document.getElementById(id);
        el.oninput = () => {
          const v = parseFloat(el.value);
          document.getElementById(vid).textContent = fmt ? fmt(v) : v;
          fn(v);
        };
      };
      bind('s_rd', 'v_rd', (v) => { g.renderer.renderDist = v; });
      bind('s_fov', 'v_fov', (v) => { g.renderer.fov = v; });
      bind('s_sens', 'v_sens', (v) => { g.sensitivity = v / 1000; });
      bind('s_vol', 'v_vol', (v) => { g.audio.setVolume(v / 100); });
      bind('s_zm', 'v_zm', (v) => { g.ents.zombieMul = v / 100; });
      bind('s_am', 'v_am', (v) => { g.ents.animalMul = v / 100; });
      bind('s_day', 'v_day', (v) => { g.dayLength = v; }, (v) => Math.round(v / 60));
      document.getElementById('b_save').onclick = () => { g.save(); this.toast('已保存。', 'good'); };
      document.getElementById('b_load').onclick = () => { if (g.load()) { this.closePanel(); this.toast('存档已载入。', 'good'); } else this.toast('没有找到存档。', 'warn'); };
      document.getElementById('b_new').onclick = () => { if (confirm('放弃当前进度，用新种子重新开始？')) g.newGame(); };
      document.getElementById('b_help').onclick = () => this.openPanel('help');
    }

    renderHelp() {
      const rows = [
        ['W A S D', '移动'], ['Shift', '奔跑（消耗体力）'], ['Ctrl', '潜行（更安静）'], ['空格', '跳跃 / 游泳上浮'],
        ['鼠标左键', '挖掘 / 攻击（长按）'], ['鼠标右键', '使用手持物 / 放置 / 交互'], ['鼠标滚轮 / 1-9', '切换快捷栏'],
        ['E', '背包与装备'], ['C', '制作'], ['M', '地图'], ['J', '日志（任务/笔记/地标/统计）'],
        ['F', '手电筒 / 光源开关'], ['R', '装填弹药'], ['Q', '丢弃一个'], ['G', '与看向的方块交互（同右键）'],
        ['Tab', '快速查看目标信息'], ['F5', '保存'], ['F9', '读取'], ['Esc', '菜单 / 关闭面板'],
      ];
      const body = `<div class="help"><table>${rows.map(([k, v]) => `<tr><td class="kk">${k}</td><td>${v}</td></tr>`).join('')}</table>
        <h4>生存要点</h4>
        <ul>
          <li><b>徒手做不了什么</b>：只能采草、藤、浆果和松散杂物。先在砂砾里敲燧石 → 搓纤维绳 → 做石斧。</li>
          <li><b>水必须处理</b>：直接喝河水/污水有 60% 概率生病。用锅在火上煮，或做手压净水器。</li>
          <li><b>体温与潮湿</b>：下雨会持续降温，湿透后夜间容易失温。雨衣、篝火和屋顶都有用。</li>
          <li><b>感染</b>：被咬会累积感染度，到 100 就结束了。碘伏 → 抗生素 → 抗孢血清，越早越好。</li>
          <li><b>噪音</b>：奔跑、挖掘、枪声都会吸引游荡者。夜里在城区尤其危险。铺木地板走路更安静。</li>
          <li><b>负重</b>：超重会大幅拖慢移动并疯狂消耗体力。背包能扩容也能提高负重上限。</li>
          <li><b>图纸</b>：搜刮得到的图纸能解锁炼钢、供电、制药、复合护甲等整条科技线。</li>
        </ul></div>`;
      this.el.modal.innerHTML = this.frame('操作与生存指南', body, 'wide');
      this.afterRender();
    }

    /* ------------------------------------------------ 死亡 / 睡眠 */
    renderDeath(info) {
      const g = this.g;
      const body = `<div class="death">
        <h2>你死了</h2>
        <p class="cause">死因：${info.cause}</p>
        <p class="sub">存活 ${g.world.day} 天 · ${Math.floor(g.sv.timeAlive / 60)} 分钟 · 击杀 ${g.sv.stats.kills}</p>
        <p class="sub2">物品掉落在原地。绿蚀不会记得你，但地图会。</p>
        <button class="btn big" id="respawn">在重生点复活</button>
      </div>`;
      this.el.modal.innerHTML = this.frame('　', body, 'center', true);
      const b = document.getElementById('respawn');
      b.onclick = () => { this.closePanel(); g.respawn(); };
    }

    renderSleep() {
      const g = this.g;
      const body = `<div class="sleep">
        <p>你要睡多久？（疲劳 ${Math.round(g.sv.fatigue)}）</p>
        <div class="setrow">
          ${[2, 4, 6, 8].map((h) => `<button class="btn" data-h="${h}">${h} 小时</button>`).join('')}
        </div>
        <p class="hintsm">睡眠恢复疲劳与生命，但会消耗食物和水。如果感染中，睡觉会让它加重。</p>
      </div>`;
      this.el.modal.innerHTML = this.frame('休息', body, 'center');
      this.afterRender();
      for (const b of this.el.modal.querySelectorAll('[data-h]')) {
        b.onclick = () => { const h = parseInt(b.dataset.h, 10); this.closePanel(); g.doSleep(h); };
      }
    }

    renderRadio() {
      const g = this.g;
      const parts = [['radio_part_tube', '功放电子管'], ['radio_part_board', '调谐主板'], ['radio_part_ant', '定向天线'], ['radio_part_gen', '稳压模块']];
      const rows = parts.map(([k, n]) => {
        const inst = g.flags['installed_' + k];
        const have = g.inv.count(k) > 0;
        return `<div class="rrow ${inst ? 'on' : ''}"><span>${inst ? '✔' : '○'} ${n}</span>${inst ? '<i>已安装</i>' : (have ? `<button class="mini" data-p="${k}">安装</button>` : '<i class="miss">未找到</i>')}</div>`;
      }).join('');
      const all = parts.every(([k]) => g.flags['installed_' + k]);
      const powered = g.radioPowered();
      const body = `<div class="radio">
        <p class="mono">>> 长波通讯终端 · 状态：${all ? (powered ? '就绪' : '缺少电力') : '缺少部件'}</p>
        ${rows}
        <div class="setrow">
          <button class="btn big" id="send" ${all && powered ? '' : 'disabled'}>发送求救信号</button>
        </div>
        <p class="hintsm">电力来自旁边的柴油发电机（需要柴油壶或汽油桶），或接入太阳能板。</p>
      </div>`;
      this.el.modal.innerHTML = this.frame('无线电台', body, 'center');
      this.afterRender();
      for (const b of this.el.modal.querySelectorAll('[data-p]')) {
        b.onclick = () => { g.installRadioPart(b.dataset.p); this.renderRadio(); };
      }
      const s = document.getElementById('send');
      if (s) s.onclick = () => { this.closePanel(); g.sendSignal(); };
    }

    renderNote(n) {
      const N = GF.NOTES[n] || { title: '空白纸片', text: '什么都没写。' };
      const body = `<div class="note"><h3>${N.title}</h3><p>${N.text.replace(/\n/g, '<br>')}</p>
        <p class="hintsm">已收进日志（J）。</p></div>`;
      this.el.modal.innerHTML = this.frame('手写笔记', body, 'center');
      this.afterRender();
    }

    /* --------------------------------------- 开场 / 加载界面 */
    showLoading(text, pct) {
      let el = document.getElementById('loading');
      if (!el) {
        el = document.createElement('div');
        el.id = 'loading';
        el.innerHTML = `<div class="lwrap"><h1>GREENFALL<span>绿 蚀 纪 元</span></h1>
          <div class="lbar"><i></i></div><p id="ltext"></p></div>`;
        document.body.appendChild(el);
      }
      document.getElementById('ltext').textContent = text;
      el.querySelector('.lbar i').style.width = (pct * 100) + '%';
      el.style.display = 'flex';
    }
    hideLoading() {
      const el = document.getElementById('loading');
      if (el) { el.style.opacity = '0'; setTimeout(() => el.remove(), 700); }
    }
  }

  // 补一个 help 面板入口
  const _open = UI.prototype.openPanel;
  UI.prototype.openPanel = function (name, arg) {
    if (name === 'help') { this.panel = name; this.el.modal.classList.add('show'); this.renderHelp(); return; }
    return _open.call(this, name, arg);
  };

  GF.UI = UI;
  GF.IconSheet = IconSheet;
})(globalThis.GF = globalThis.GF || {});
