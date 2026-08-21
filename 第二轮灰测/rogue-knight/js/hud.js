/* hud.js — HUD / 小地图 / 菜单 / 天赋强化界面 */
(function (K) {
  'use strict';
  var M = K.M;
  function F(s, w) { return (w || 900) + ' ' + s + 'px "Arial Black",Impact,"Microsoft YaHei",sans-serif'; }
  function CN(s, w) { return (w || 700) + ' ' + s + 'px "Microsoft YaHei","PingFang SC",sans-serif'; }
  function txt(ctx, s, x, y, size, col, al, font, ol) {
    ctx.font = font || F(size); ctx.textAlign = al || 'center'; ctx.textBaseline = 'middle';
    if (ol !== 0) { ctx.lineWidth = Math.max(2, size * .2); ctx.strokeStyle = ol || '#0c0a12'; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
    ctx.fillStyle = col; ctx.fillText(s, x, y);
  }
  function bar(ctx, x, y, w, h, k, col, bg, ol) {
    ctx.fillStyle = bg || 'rgba(10,10,18,.8)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = col;
    ctx.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * M.clamp(k, 0, 1)), h - 2);
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * M.clamp(k, 0, 1)), (h - 2) * .4);
    if (ol !== 0) { ctx.strokeStyle = ol || 'rgba(180,195,225,.55)'; ctx.lineWidth = 1.4; ctx.strokeRect(x, y, w, h); }
  }
  function panel(ctx, x, y, w, h, a) {
    ctx.fillStyle = 'rgba(10,12,20,' + (a === undefined ? .72 : a) + ')';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(150,170,210,.35)'; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h);
  }
  function wIcon(ctx, x, y, s, w, sel) {
    panel(ctx, x, y, 62 * s, 46 * s, sel ? .85 : .55);
    if (sel) { ctx.strokeStyle = K.W.RCOL[w ? w.rarity - 1 : 0]; ctx.lineWidth = 2.4; ctx.strokeRect(x, y, 62 * s, 46 * s); }
    if (w) K.Art.weapon(ctx, x + 20 * s, y + 24 * s, -.32, .85 * s, w);
  }

  var HUD = {
    banner: null, bannerT: 0,
    say: function (main, sub, dur, col) { this.banner = { main: main, sub: sub, col: col || '#ffd15c', dur: dur || 110 }; this.bannerT = 0; },
    drawGame: function (ctx, W, H, G) {
      var p = G.player; if (!p) return;
      var i;
      /* 左上：头像 + 血条 */
      panel(ctx, 14, 12, 268, 78, .62);
      ctx.save(); ctx.beginPath(); ctx.rect(18, 16, 62, 70); ctx.clip();
      var pv = { z: 1.5, tx: function (x) { return 49 + x; }, ty: function (y) { return 74 + y; } };
      K.Art.hero(ctx, 49, 76, 1.45, { pal: p.ch.pal, aim: -.5, moveT: G.t * .6, moving: 0, weapon: null });
      ctx.restore();
      ctx.strokeStyle = 'rgba(150,170,210,.4)'; ctx.strokeRect(18, 16, 62, 70);
      txt(ctx, p.ch.name, 90, 27, 14, '#e8eefc', 'left', CN(14, 800));
      bar(ctx, 90, 38, 178, 14, p.hp / p.hpMax, p.hp / p.hpMax > .3 ? '#e04a5a' : '#ff7a4a');
      txt(ctx, Math.ceil(p.hp) + '/' + p.hpMax, 179, 45, 11, '#fff', 'center', CN(11, 800));
      bar(ctx, 90, 56, 178, 9, p.energy / p.energyMax, '#4ad0c0');
      /* 护甲格 */
      for (i = 0; i < p.armorMax; i++) {
        var ax = 90 + i * 15, on = i < Math.floor(p.armor);
        ctx.save();
        K.Art.poly(ctx, [ax + 6, 70, ax + 12, 73, ax + 12, 80, ax + 6, 84, ax, 80, ax, 73], on ? '#7fb0ff' : 'rgba(60,70,95,.75)', 1.4);
        ctx.restore();
      }
      /* 右上：楼层信息 + 小地图 */
      var mmW = 178, mmH = 118;
      K.D.drawMinimap(ctx, W - mmW - 20, 46, mmW, mmH, G.curRoom, p);
      txt(ctx, '第 ' + G.floor + ' 层 · ' + K.D.theme.name, W - 20, 26, 15, '#ffd15c', 'right', CN(15, 800));
      var cleared = 0, total = 0;
      for (i = 0; i < K.D.rooms.length; i++) { if (K.D.rooms[i].spawns.length) { total++; if (K.D.rooms[i].cleared) cleared++; } }
      txt(ctx, '房间 ' + cleared + '/' + total + '   击杀 ' + p.kills, W - 20, 182, 12, '#b8c4dc', 'right', CN(12, 700));
      /* 金币 / 宝石 */
      K.Art.item(ctx, W - 150, 206, 1.1, 'coin', G.t);
      txt(ctx, '' + p.coins, W - 138, 206, 15, '#ffcf3a', 'left', F(15));
      K.Art.item(ctx, W - 70, 206, 1.1, 'gem', G.t);
      txt(ctx, '' + p.gems, W - 58, 206, 15, '#7ad4ff', 'left', F(15));
      /* 遗物 */
      for (i = 0; i < p.relics.length; i++) {
        var rx = 20 + (i % 12) * 26, ry = H - 116 - Math.floor(i / 12) * 26;
        ctx.save(); ctx.translate(rx + 10, ry + 10);
        K.Art.poly(ctx, [0, -9, 8, 0, 0, 9, -8, 0], p.relics[i].icon, 1.6);
        ctx.restore();
      }
      /* 武器槽 */
      for (i = 0; i < 2; i++) {
        var w = p.weapons[i];
        wIcon(ctx, 18 + i * 74, H - 86, 1, w, i === p.slot);
        if (w) {
          txt(ctx, w.name, 18 + i * 74 + 31, H - 30, 11, i === p.slot ? K.W.RCOL[w.rarity - 1] : '#98a4bc', 'center', CN(11, 800));
        }
      }
      txt(ctx, '[Q] 换武器', 18, H - 12, 10, 'rgba(200,212,235,.6)', 'left', CN(10, 600));
      /* 技能 */
      var sk = p.ch.skill, sx = W - 108, sy = H - 86;
      panel(ctx, sx, sy, 88, 62, .62);
      txt(ctx, sk.name, sx + 44, sy + 16, 12, p.skillCd > 0 ? '#7a8398' : '#ffd15c', 'center', CN(12, 800));
      var kk = 1 - p.skillCd / Math.max(1, Math.round(sk.cd * p.mods.skillCdMul));
      bar(ctx, sx + 8, sy + 30, 72, 10, kk, p.skillCd > 0 ? '#5a6a8a' : '#ffc23a');
      txt(ctx, p.skillCd > 0 ? Math.ceil(p.skillCd / 60) + 's' : '[F] 就绪', sx + 44, sy + 50, 11, '#cfd8ea', 'center', CN(11, 700));
      /* 翻滚 */
      var dx = W - 150;
      bar(ctx, dx, H - 30, 34, 8, 1 - p.dashCd / Math.max(1, Math.round(46 * p.mods.dashCdMul)), '#9adfff');
      txt(ctx, '翻滚', dx - 6, H - 26, 10, '#9adfff', 'right', CN(10, 700));
      /* 自动瞄准 */
      txt(ctx, '[R] 自动瞄准: ' + (G.autoAim ? '开' : '关'), W - 20, H - 12, 10, G.autoAim ? '#8ad06a' : 'rgba(200,212,235,.5)', 'right', CN(10, 600));
      /* Boss 血条 */
      var boss = null;
      for (i = 0; i < G.enemies.length; i++) if (G.enemies[i].boss && G.enemies[i].alive) boss = G.enemies[i];
      if (boss) {
        var bw = 520, bx = W / 2 - bw / 2;
        panel(ctx, bx - 4, 94, bw + 8, 30, .6);
        bar(ctx, bx, 98, bw, 22, boss.hp / boss.hpMax, boss.phase >= 2 ? '#ff3a4a' : '#e0503a');
        txt(ctx, boss.name + (boss.phase >= 2 ? ' · 狂暴' : ''), W / 2, 109, 14, '#fff', 'center', CN(14, 800));
      }
      /* 互动提示 */
      var it = K.I.nearest(p), pr = it ? K.I.prompt(it, p) : null;
      if (pr && pr.txt) {
        var V = G.view();
        var ix = V.tx(it.x), iy = V.ty(it.y) - 46 * V.z;
        ctx.save();
        var tw = ctx.measureText ? 0 : 0;
        panel(ctx, ix - 120, iy - 14, 240, 26, .78);
        txt(ctx, pr.txt, ix, iy, 12, pr.col, 'center', CN(12, 800));
        ctx.restore();
      }
      /* 低血提示 */
      if (p.hp / p.hpMax < .3 && p.alive) {
        ctx.save();
        var a = .12 + Math.sin(G.t * .12) * .07;
        var g = ctx.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H * .78);
        g.addColorStop(0, 'rgba(255,0,30,0)'); g.addColorStop(1, 'rgba(255,0,30,' + a.toFixed(3) + ')');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
      }
      /* 公告 */
      if (this.banner) {
        this.bannerT++;
        var b = this.banner, k2 = this.bannerT / b.dur;
        var al = k2 > .75 ? (1 - k2) / .25 : Math.min(1, this.bannerT / 8);
        var sc = this.bannerT < 9 ? 1 + (9 - this.bannerT) * .06 : 1;
        ctx.save(); ctx.globalAlpha = M.clamp(al, 0, 1);
        ctx.translate(W / 2, H * .27); ctx.scale(sc, sc);
        txt(ctx, b.main, 0, 0, 44, b.col, 'center', CN(44, 900));
        if (b.sub) txt(ctx, b.sub, 0, 38, 17, '#e8eefc', 'center', CN(17, 700));
        ctx.restore();
        if (this.bannerT > b.dur) this.banner = null;
      }
    },
    /* ---------- 标题 ---------- */
    drawTitle: function (ctx, W, H, t, meta) {
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0a0a14'); g.addColorStop(.6, '#161028'); g.addColorStop(1, '#2a1430');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < 30; i++) {
        var a = (t * .3 + i * 137) % (H + 100);
        ctx.globalAlpha = .06 + (i % 5) * .012;
        ctx.fillStyle = i % 3 ? '#ffb45c' : '#9adfff';
        ctx.beginPath(); ctx.arc((i * 197 + 40) % W, H - a, 2 + (i % 4), 0, M.TAU); ctx.fill();
      }
      ctx.restore();
      var sc = 1 + Math.sin(t * .04) * .015;
      ctx.save(); ctx.translate(W / 2, H * .3); ctx.scale(sc, sc);
      txt(ctx, '地牢元气', 0, 0, 84, '#ffd15c', 'center', CN(84, 900));
      txt(ctx, 'ROGUE KNIGHT · 肉鸽动作射击', 0, 58, 22, '#e8eefc', 'center', CN(22, 800));
      ctx.restore();
      if (Math.floor(t / 28) % 2 === 0) txt(ctx, 'PRESS  ENTER', W / 2, H * .62, 30, '#fff', 'center', F(30));
      txt(ctx, '宝石 ' + (meta ? meta.gems : 0) + '  ·  历史最深 第 ' + (meta ? meta.stats.best : 1) + ' 层  ·  通关 ' + (meta ? meta.stats.wins : 0) + ' 次',
        W / 2, H * .74, 15, '#7ad4ff', 'center', CN(15, 700));
      txt(ctx, 'WASD 移动 / 鼠标瞄准射击 / 空格翻滚 / F 技能 / Q 换武器 / E 互动',
        W / 2, H * .84, 14, 'rgba(230,238,255,.6)', 'center', CN(14, 600));
      txt(ctx, '8 名英雄 · 48 把武器 · 22 件遗物 · 12 种怪物 · 3 个 Boss · 5 层地牢',
        W / 2, H * .89, 13, 'rgba(255,209,92,.65)', 'center', CN(13, 700));
    },
    /* ---------- 选人 ---------- */
    drawSelect: function (ctx, W, H, sel, meta, t) {
      ctx.fillStyle = 'rgba(8,8,14,.94)'; ctx.fillRect(0, 0, W, H);
      txt(ctx, '选择英雄', W / 2, 44, 34, '#ffd15c', 'center', CN(34, 900));
      var list = K.P.CHARS, n = list.length, cols = 4, cw = 150, ch = 168, gap = 16;
      var totalW = cols * cw + (cols - 1) * gap, x0 = W / 2 - totalW / 2, y0 = 84;
      for (var i = 0; i < n; i++) {
        var c = list[i], cx = x0 + (i % cols) * (cw + gap), cy = y0 + Math.floor(i / cols) * (ch + gap);
        var locked = meta.unlocked.indexOf(c.id) < 0, on = i === sel;
        ctx.save();
        ctx.fillStyle = on ? 'rgba(255,200,90,.14)' : 'rgba(255,255,255,.045)';
        ctx.fillRect(cx, cy, cw, ch);
        ctx.strokeStyle = on ? '#ffd15c' : 'rgba(170,185,215,.25)'; ctx.lineWidth = on ? 3 : 1.4;
        ctx.strokeRect(cx, cy, cw, ch);
        ctx.restore();
        ctx.save();
        if (locked) ctx.globalAlpha = .4;
        K.Art.hero(ctx, cx + cw / 2, cy + 104, 1.55, { pal: c.pal, aim: -.45, moveT: t + i * 13, moving: 0, weapon: K.W.BY[c.weapon] });
        ctx.restore();
        txt(ctx, c.name, cx + cw / 2, cy + 128, 15, locked ? '#7a8398' : '#fff', 'center', CN(15, 800));
        txt(ctx, c.title, cx + cw / 2, cy + 148, 11, locked ? '#5a6478' : '#ffd15c', 'center', CN(11, 700));
        if (locked) {
          panel(ctx, cx + 20, cy + 60, cw - 40, 30, .8);
          txt(ctx, '宝石 ' + c.unlock, cx + cw / 2, cy + 75, 13, meta.gems >= c.unlock ? '#7ad4ff' : '#ff6a6a', 'center', CN(13, 800));
        }
      }
      /* 详情 */
      var c2 = list[sel];
      var dy = y0 + 2 * (ch + gap) + 6;
      panel(ctx, W / 2 - 380, dy, 760, 132, .7);
      txt(ctx, c2.name + ' · ' + c2.title, W / 2 - 360, dy + 22, 18, '#ffd15c', 'left', CN(18, 900));
      txt(ctx, c2.desc, W / 2 - 360, dy + 46, 13, '#e8eefc', 'left', CN(13, 700));
      var stats = [['生命', c2.hp], ['护甲', c2.armor], ['能量', c2.energy], ['移速', c2.speed.toFixed(2)], ['暴击', c2.crit + '%']];
      for (var s = 0; s < stats.length; s++) {
        txt(ctx, stats[s][0] + ' ' + stats[s][1], W / 2 - 360 + s * 92, dy + 70, 12, '#9adfff', 'left', CN(12, 700));
      }
      txt(ctx, '技能：' + c2.skill.name + ' — ' + c2.skill.desc, W / 2 - 360, dy + 94, 13, '#c06aff', 'left', CN(13, 800));
      txt(ctx, '初始武器：' + K.W.BY[c2.weapon].name + '（' + K.W.BY[c2.weapon].desc + '）', W / 2 - 360, dy + 114, 12, '#8ad06a', 'left', CN(12, 700));
      txt(ctx, 'A/D 或 ←→ 选择 · Enter 开始 · U 天赋强化 · Esc 返回   宝石: ' + meta.gems,
        W / 2, H - 18, 14, 'rgba(230,238,255,.7)', 'center', CN(14, 700));
    },
    /* ---------- 天赋强化 ---------- */
    drawUpgrade: function (ctx, W, H, G, sel) {
      ctx.fillStyle = 'rgba(8,8,14,.95)'; ctx.fillRect(0, 0, W, H);
      txt(ctx, '天赋强化', W / 2, 46, 34, '#ffd15c', 'center', CN(34, 900));
      txt(ctx, '宝石是永久货币，每次冒险都会保留强化效果', W / 2, 78, 14, '#b8c4dc', 'center', CN(14, 700));
      txt(ctx, '宝石: ' + G.meta.gems, W / 2, 102, 20, '#7ad4ff', 'center', CN(20, 900));
      var U = G.UPGRADES, y0 = 132;
      for (var i = 0; i < U.length; i++) {
        var u = U[i], lv = G.meta.up[u.id] || 0, on = i === sel;
        var y = y0 + i * 56, x = W / 2 - 330;
        ctx.save();
        ctx.fillStyle = on ? 'rgba(255,200,90,.14)' : 'rgba(255,255,255,.04)';
        ctx.fillRect(x, y, 660, 48);
        ctx.strokeStyle = on ? '#ffd15c' : 'rgba(170,185,215,.2)'; ctx.lineWidth = on ? 2.4 : 1.2;
        ctx.strokeRect(x, y, 660, 48); ctx.restore();
        txt(ctx, u.name, x + 16, y + 18, 16, '#fff', 'left', CN(16, 900));
        txt(ctx, u.desc, x + 16, y + 36, 12, '#b8c4dc', 'left', CN(12, 700));
        for (var l = 0; l < u.max; l++) {
          ctx.fillStyle = l < lv ? '#ffc23a' : 'rgba(90,100,125,.6)';
          ctx.fillRect(x + 360 + l * 22, y + 18, 16, 12);
        }
        var cost = lv >= u.max ? null : u.cost[lv];
        txt(ctx, cost === null ? '已满级' : ('宝石 ' + cost),
          x + 640, y + 25, 14, cost === null ? '#8ad06a' : (G.meta.gems >= cost ? '#7ad4ff' : '#ff6a6a'), 'right', CN(14, 800));
      }
      txt(ctx, 'W/S 或 ↑↓ 选择 · Enter 购买 · Esc 返回', W / 2, H - 20, 14, 'rgba(230,238,255,.7)', 'center', CN(14, 700));
    },
    drawPause: function (ctx, W, H, G) {
      ctx.fillStyle = 'rgba(6,6,12,.75)'; ctx.fillRect(0, 0, W, H);
      txt(ctx, '暂停', W / 2, H * .3, 52, '#ffd15c', 'center', CN(52, 900));
      var p = G.player;
      if (p) {
        var lines = ['英雄: ' + p.ch.name, '楼层: 第 ' + G.floor + ' 层', '击杀: ' + p.kills, '金币: ' + p.coins + '   宝石: ' + p.gems,
          '武器: ' + p.weapons.map(function (w) { return w.name; }).join(' / '),
          '遗物: ' + (p.relics.length ? p.relics.map(function (r) { return r.name; }).join('、') : '无')];
        for (var i = 0; i < lines.length; i++) txt(ctx, lines[i], W / 2, H * .44 + i * 26, 15, '#e8eefc', 'center', CN(15, 700));
      }
      txt(ctx, 'P 继续 · R 放弃并重来 · Esc 回到标题', W / 2, H * .82, 16, 'rgba(230,238,255,.75)', 'center', CN(16, 700));
    },
    drawEnd: function (ctx, W, H, G, win) {
      ctx.fillStyle = win ? 'rgba(20,16,8,.86)' : 'rgba(14,6,10,.86)'; ctx.fillRect(0, 0, W, H);
      txt(ctx, win ? '通关！' : '你倒下了…', W / 2, H * .24, 60, win ? '#ffd15c' : '#ff5a5a', 'center', CN(60, 900));
      var p = G.player;
      var lines = [
        '到达: 第 ' + G.floor + ' 层',
        '击杀: ' + (p ? p.kills : 0) + ' 只怪物',
        '造成伤害: ' + Math.round(p ? p.dmgDealt : 0),
        '获得宝石: ' + (p ? p.gems : 0) + '  （已存入永久仓库）',
        '遗物: ' + (p && p.relics.length ? p.relics.map(function (r) { return r.name; }).join('、') : '无')
      ];
      for (var i = 0; i < lines.length; i++) txt(ctx, lines[i], W / 2, H * .42 + i * 30, 17, '#e8eefc', 'center', CN(17, 700));
      txt(ctx, 'Enter 回到标题 · R 立刻再来一局', W / 2, H * .82, 17, '#ffd15c', 'center', CN(17, 800));
    },
    drawHelp: function (ctx, W, H) {
      ctx.fillStyle = 'rgba(8,8,14,.95)'; ctx.fillRect(0, 0, W, H);
      txt(ctx, '玩法说明', W / 2, 44, 32, '#ffd15c', 'center', CN(32, 900));
      var L = [
        '● 目标：连续通过 5 层地牢，每层尽头都有 Boss；清空房间里的怪物才会开门。',
        '● 战斗：WASD 移动，鼠标瞄准 + 左键射击（R 可切换自动瞄准）；空格翻滚有无敌帧。',
        '● 武器：可携带 2 把，Q 切换；地上武器按 E 拾取（会替换当前槽）。能量类武器消耗蓝条。',
        '● 技能：F 或右键释放，每位英雄不同；消耗能量并有冷却。',
        '● 房间：宝箱房、商店（金币购买）、祭坛（30 金随机祝福）、Boss 房。',
        '● 遗物：永久强化本局的属性，可叠加，Boss 与宝箱必掉。',
        '● 护甲：蓝色格子会在不受伤一段时间后自动回复，是主要的容错资源。',
        '● 宝石：本局收集的宝石在死亡/通关后进入永久仓库，用于天赋强化与解锁英雄。',
        '● 元素：火（燃烧）、冰（减速）、毒（中毒）、电（连锁）、虚空（穿甲）。'
      ];
      for (var i = 0; i < L.length; i++) txt(ctx, L[i], 90, 110 + i * 44, 15, '#e8eefc', 'left', CN(15, 700));
      txt(ctx, 'Esc / Enter 返回', W / 2, H - 30, 16, '#ffd15c', 'center', CN(16, 800));
    },
    txt: txt, panel: panel, bar: bar, F: F, CN: CN
  };
  K.HUD = HUD;
})(window.K);
