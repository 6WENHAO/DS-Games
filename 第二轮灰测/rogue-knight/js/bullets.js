/* bullets.js — 弹幕 / 激光 / 近战挥击 / 爆炸 / 闪电链 / 毒池 / 黑洞 */
(function (K) {
  'use strict';
  var M = K.M, FX = K.FX, S = K.Snd, TS = K.TS;
  var bullets = [], swings = [], pools = [], MAXB = 460;

  function reset() { bullets.length = 0; swings.length = 0; pools.length = 0; }
  function solid(tx, ty) { return K.Game.solid(tx, ty); }
  function targets(team) { return team === 0 ? K.Game.enemies : (K.Game.player && K.Game.player.alive ? [K.Game.player] : []); }

  function spawn(o) {
    if (bullets.length >= MAXB) bullets.shift();
    o.t = 0; o.life = o.life || 60; o.r = o.r || 4; o.size = o.size || o.r;
    o.hit = []; o.pierce = o.pierce || 0; o.team = o.team || 0;
    o.rot = o.rot === undefined ? Math.atan2(o.vy, o.vx) : o.rot;
    o.z = o.style === 'grenade' ? 0 : 0; o.vz = o.style === 'grenade' ? 3.4 : 0;
    o.style = o.style || 'bullet'; o.col = o.col || '#ffe9a8';
    bullets.push(o); return o;
  }
  function swing(o) {
    o.t = 0; o.hit = []; swings.push(o);
    var a = o.ang;
    FX.spark(o.x + Math.cos(a) * o.r1 * .7, o.y + Math.sin(a) * o.r1 * .7, a, 4, o.col);
    return o;
  }
  function pool(o) { o.t = 0; o.life = o.life || 180; pools.push(o); return o; }

  /* ---------- 伤害入口 ---------- */
  function hurt(ent, dmg, o) {
    if (ent === K.Game.player) K.Game.hurtPlayer(dmg, o);
    else K.Game.hurtEnemy(ent, dmg, o);
  }
  /* ---------- 爆炸 ---------- */
  function explode(x, y, r, dmg, team, col, opt) {
    opt = opt || {};
    col = col || '#ff9a2e';
    var list = targets(team), i, e, d;
    for (i = 0; i < list.length; i++) {
      e = list[i]; if (!e.alive) continue;
      d = M.len(e.x - x, e.y - y);
      if (d < r + e.r) {
        var f = M.clamp(1 - (d - e.r) / r, .35, 1);
        var a = Math.atan2(e.y - y, e.x - x);
        hurt(e, dmg * f, { crit: opt.crit || 0, elem: opt.elem, knock: (opt.knock || 6) * f, dirX: Math.cos(a), dirY: Math.sin(a), noFX: 1 });
      }
    }
    if (K.Game.hitProps) K.Game.hitProps(x, y, r, dmg, team);
    FX.ring(x, y, r * .25, r * 1.05, col, 20, 5);
    FX.ring(x, y, r * .1, r * .7, '#ffffff', 12, 3);
    FX.burst(x, y, 20, { col: '#fff3c0', col2: col, speed: 8, size: 5, flareR: r * .5, flareLife: 9 });
    FX.smoke(x, y, 8, '#6a6272', 2.4);
    FX.light(x, y, r * 2.4, col, 14);
    FX.shake(Math.min(14, r * .1), 20);
    FX.flash(.09, col);
    S.play('explode', Math.min(1, .5 + r / 300), .05);
  }
  /* ---------- 闪电链 ---------- */
  function chainFrom(x, y, owner, dmg, n, range, team, crit, elem, col) {
    var list = targets(team || 0), done = [], cx = x, cy = y, i, best, bd, e, hops = 0;
    col = col || '#7fb0ff';
    while (hops < n) {
      best = null; bd = range * range;
      for (i = 0; i < list.length; i++) {
        e = list[i];
        if (!e.alive || done.indexOf(e) >= 0) continue;
        var d = M.dist2(cx, cy, e.x, e.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) break;
      FX.beam(cx, cy, best.x, best.y, col, 5 - hops * .6, 9);
      for (i = 0; i < 3; i++) FX.spark(M.lerp(cx, best.x, i / 3), M.lerp(cy, best.y, i / 3), M.rnd(M.TAU), 2, col);
      hurt(best, dmg * (1 - hops * .12), { crit: crit, elem: elem, knock: 1.2, dirX: 0, dirY: 0 });
      FX.light(best.x, best.y, 70, col, 8);
      done.push(best); cx = best.x; cy = best.y; hops++;
    }
    if (hops) S.play('tesla', .7, .04);
    return hops;
  }
  /* ---------- 激光束 ---------- */
  function beam(p, w, aim, dmg, crit, elem, mods) {
    var m = K.W.muzzlePos(p, aim, w);
    var maxD = 760 * (mods.rangeMul || 1);
    var r = K.Col.ray(m.x, m.y, Math.cos(aim), Math.sin(aim), maxD, solid);
    var bw = 7 + (w.rarity >= 5 ? 3 : 0);
    FX.beam(m.x, m.y, r.x, r.y, w.bcol, bw, 5);
    FX.light(r.x, r.y, 80, w.bcol, 6);
    if (r.hit) FX.spark(r.x, r.y, aim + Math.PI, 3, w.bcol);
    var list = targets(0), i, e;
    for (i = 0; i < list.length; i++) {
      e = list[i]; if (!e.alive) continue;
      var d = segDist(e.x, e.y, m.x, m.y, r.x, r.y);
      if (d < e.r + bw * .6) {
        hurt(e, dmg, { crit: crit, elem: elem, knock: .6, dirX: Math.cos(aim), dirY: Math.sin(aim), small: 1 });
        FX.spark(e.x, e.y, aim, 2, w.bcol);
      }
    }
  }
  function segDist(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
    var t = l2 > 0 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
    t = M.clamp(t, 0, 1);
    return M.len(px - (x1 + dx * t), py - (y1 + dy * t));
  }

  /* ---------------- 更新 ---------------- */
  function update() {
    var i, j, b, e, list;
    /* —— 子弹 —— */
    for (i = bullets.length - 1; i >= 0; i--) {
      b = bullets[i]; b.t++;
      if (b.t > b.life) { kill(b, i, b.explode ? 1 : 0); continue; }
      /* 行为 */
      if (b.style === 'blackhole') {
        b.vx *= .93; b.vy *= .93;
        var pr = 150;
        list = targets(b.team);
        for (j = 0; j < list.length; j++) {
          e = list[j]; if (!e.alive) continue;
          var dd = M.len(e.x - b.x, e.y - b.y);
          if (dd < pr) {
            var pull = (1 - dd / pr) * (e.boss ? .6 : 3.2);
            var aa = Math.atan2(b.y - e.y, b.x - e.x);
            e.x += Math.cos(aa) * pull; e.y += Math.sin(aa) * pull;
            if (b.t % 12 === 0) hurt(e, b.dmg, { elem: b.elem, knock: 0, small: 1, crit: b.crit });
          }
        }
        if (b.t % 3 === 0) { FX.ring(b.x, b.y, pr * .9, 8, '#c06aff', 22, 2); FX.trail(b.x + M.rnd(-30, 30), b.y + M.rnd(-30, 30), '#b06aff', 6, 12); }
        FX.light(b.x, b.y, 120, 'rgba(160,90,255,.8)', 3);
      } else if (b.homing) {
        var tg = nearest(b.x, b.y, b.team, 420, b.hit);
        if (tg) {
          var want = Math.atan2(tg.y - b.y, tg.x - b.x), cur = Math.atan2(b.vy, b.vx);
          var na = cur + M.clamp(M.angDiff(cur, want), -b.homing * 3, b.homing * 3);
          var sp = M.len(b.vx, b.vy);
          b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp; b.rot = na;
        }
      } else if (b.ret) {
        if (b.t < b.life * .38) { b.vx *= .965; b.vy *= .965; }
        else {
          var ow = b.owner, aa2 = Math.atan2(ow.y - b.y, ow.x - b.x), sp2 = Math.min(15, M.len(b.vx, b.vy) + .7);
          b.vx = M.lerp(b.vx, Math.cos(aa2) * sp2, .18); b.vy = M.lerp(b.vy, Math.sin(aa2) * sp2, .18);
          if (M.len(ow.x - b.x, ow.y - b.y) < 22 && b.t > b.life * .5) { bullets.splice(i, 1); continue; }
          if (b.t % 10 === 0) b.hit.length = 0;
        }
      } else if (b.style === 'grenade') {
        b.vx *= .975; b.vy *= .975;
        b.z += b.vz; b.vz -= .17;
        if (b.z < 0) { b.z = 0; b.vz *= -.42; if (Math.abs(b.vz) < .8) b.vz = 0; }
      } else if (b.style === 'flame') {
        b.vx *= .9; b.vy *= .9; b.size += .55; b.r = b.size * .8;
      }
      if (b.spin) b.rot += b.spin;
      /* 移动 + 墙体 */
      var nx = b.x + b.vx, ny = b.y + b.vy;
      if (b.style !== 'blackhole' && !b.noWall && solid(Math.floor(nx / TS), Math.floor(ny / TS))) {
        if (b.bounce > 0) {
          b.bounce--;
          if (solid(Math.floor(nx / TS), Math.floor(b.y / TS))) b.vx *= -1;
          else if (solid(Math.floor(b.x / TS), Math.floor(ny / TS))) b.vy *= -1;
          else { b.vx *= -1; b.vy *= -1; }
          b.rot = Math.atan2(b.vy, b.vx);
          FX.spark(b.x, b.y, b.rot, 3, b.col); S.play('hitWall', .3, .05);
        } else if (b.style === 'grenade' && b.z > 2) { b.x = nx; b.y = ny; }
        else { kill(b, i, 1, 1); continue; }
      } else { b.x = nx; b.y = ny; }
      /* 尾迹 */
      if (b.style === 'rocket') { FX.smoke(b.x - b.vx, b.y - b.vy, 1, '#8a8a96', .5); FX.trail(b.x, b.y, '#ff9a2e', b.size * .9, 8); FX.light(b.x, b.y, 60, 'rgba(255,150,60,.7)', 3); }
      else if (b.style === 'orb' || b.style === 'laserBolt') FX.light(b.x, b.y, 46, b.col, 3);
      else if (b.style === 'flame') { if (b.t % 2 === 0) FX.light(b.x, b.y, 50, 'rgba(255,140,40,.8)', 3); }
      /* 命中实体 */
      if (b.style !== 'blackhole') {
        list = targets(b.team);
        for (j = 0; j < list.length; j++) {
          e = list[j];
          if (!e.alive || b.hit.indexOf(e) >= 0) continue;
          if (e.invT > 0 && e === K.Game.player) continue;
          var rr = b.r + e.r;
          if (M.dist2(b.x, b.y, e.x, e.y) < rr * rr) {
            b.hit.push(e);
            var a = Math.atan2(b.vy, b.vx);
            hurt(e, b.dmg, { crit: b.crit, elem: b.elem, knock: b.knock, dirX: Math.cos(a), dirY: Math.sin(a) });
            if (b.pierce > 0) { b.pierce--; }
            else { kill(b, i, 1); break; }
          }
        }
      }
    }
    /* —— 近战挥击 —— */
    for (i = swings.length - 1; i >= 0; i--) {
      var w = swings[i]; w.t++;
      if (w.owner) { w.x = w.owner.x; w.y = w.owner.y; }
      if (w.t > w.frames) { swings.splice(i, 1); continue; }
      var k = w.t / w.frames;
      var cur = w.ang - w.half + k * w.half * 2;
      w.cur = cur;
      if (w.t <= w.frames * .8) {
        var x1 = w.x + Math.cos(cur) * w.r0, y1 = w.y + Math.sin(cur) * w.r0;
        var x2 = w.x + Math.cos(cur) * w.r1, y2 = w.y + Math.sin(cur) * w.r1;
        list = targets(w.team);
        for (j = 0; j < list.length; j++) {
          e = list[j];
          if (!e.alive || w.hit.indexOf(e) >= 0) continue;
          if (segDist(e.x, e.y, x1, y1, x2, y2) < e.r + 9) {
            w.hit.push(e);
            hurt(e, w.dmg, { crit: w.crit, elem: w.elem, knock: w.knock, dirX: Math.cos(cur), dirY: Math.sin(cur), melee: 1 });
            FX.spark(e.x, e.y, cur, 7, w.col);
            FX.hitstop(2);
            if (w.shock) explode(e.x, e.y, w.shock.r, w.shock.dmg, w.team, '#ffd15c');
            if (w.chainN) chainFrom(e.x, e.y, w.owner, w.dmg * .4, w.chainN, w.chainRange || 150, w.team, w.crit, 'shock', '#ffd15c');
          }
        }
      }
    }
    /* —— 地面池（毒/火） —— */
    for (i = pools.length - 1; i >= 0; i--) {
      var pl = pools[i]; pl.t++;
      if (pl.t > pl.life) { pools.splice(i, 1); continue; }
      if (pl.t % 5 === 0) FX.part({ type: 'smoke', x: pl.x + M.rnd(-pl.r * .6, pl.r * .6), y: pl.y + M.rnd(-pl.r * .5, pl.r * .5), vy: -.3, r: M.rnd(4, 9), life: 26, col: pl.col, drag: .96, grow: .2 });
      if (pl.t % 18 === 0) {
        list = targets(pl.team);
        for (j = 0; j < list.length; j++) {
          e = list[j];
          if (e.alive && M.len(e.x - pl.x, e.y - pl.y) < pl.r + e.r) hurt(e, pl.dmg, { elem: pl.elem, knock: 0, small: 1 });
        }
      }
    }
  }
  function kill(b, i, impact, wall) {
    if (b.explode) explode(b.x, b.y, b.explode.r, b.explode.dmg, b.team, b.col, { elem: b.elem, crit: b.crit });
    else if (impact) {
      FX.spark(b.x, b.y, Math.atan2(-b.vy, -b.vx), b.style === 'pellet' ? 3 : 5, b.col);
      if (wall) { FX.part({ type: 'flare', x: b.x, y: b.y, r: b.size * 1.4, life: 5, col: '#fff', col2: b.col }); S.play('hitWall', .35, .04); }
    }
    if (b.pool) pool({ x: b.x, y: b.y, r: b.pool.r, dmg: b.pool.dmg, life: b.pool.life, team: b.team, elem: b.elem, col: b.col });
    bullets.splice(i, 1);
  }
  function nearest(x, y, team, range, skip) {
    var list = targets(team), best = null, bd = range * range;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (!e.alive || (skip && skip.indexOf(e) >= 0)) continue;
      var d = M.dist2(x, y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  /* ---------------- 绘制 ---------------- */
  function drawUnder(ctx, V) {
    var i;
    for (i = 0; i < pools.length; i++) {
      var p = pools[i], a = Math.min(1, (p.life - p.t) / 40) * .5;
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = p.col;
      ctx.beginPath(); ctx.ellipse(V.tx(p.x), V.ty(p.y), p.r * V.z, p.r * .62 * V.z, 0, 0, M.TAU); ctx.fill();
      ctx.restore();
    }
    /* 榴弹的地面阴影 */
    for (i = 0; i < bullets.length; i++) {
      var b = bullets[i];
      if (b.style === 'grenade') K.Art.shadow(ctx, V.tx(b.x), V.ty(b.y), b.size * V.z, b.size * .55 * V.z, .28);
    }
  }
  function draw(ctx, V) {
    var i, b, x, y, z = V.z;
    /* 挥击 */
    for (i = 0; i < swings.length; i++) {
      var w = swings[i], k = w.t / w.frames, a = 1 - k * .5;
      var cx = V.tx(w.x), cy = V.ty(w.y);
      ctx.save(); ctx.translate(cx, cy); ctx.globalCompositeOperation = 'lighter';
      var g = ctx.createRadialGradient(0, 0, w.r0 * z, 0, 0, w.r1 * z);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.6, w.col); g.addColorStop(1, 'rgba(255,255,255,.05)');
      ctx.globalAlpha = .34 * a;
      ctx.beginPath(); ctx.arc(0, 0, w.r1 * z, w.ang - w.half, w.cur); ctx.arc(0, 0, w.r0 * z, w.cur, w.ang - w.half, true); ctx.closePath();
      ctx.fillStyle = g; ctx.fill();
      ctx.globalAlpha = .95 * a; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3.2 * z; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(Math.cos(w.cur) * w.r0 * z, Math.sin(w.cur) * w.r0 * z);
      ctx.lineTo(Math.cos(w.cur) * w.r1 * z, Math.sin(w.cur) * w.r1 * z);
      ctx.stroke();
      ctx.restore();
    }
    /* 子弹 */
    ctx.save();
    for (i = 0; i < bullets.length; i++) {
      b = bullets[i]; x = V.tx(b.x); y = V.ty(b.y - (b.z || 0));
      var s = b.size * z;
      switch (b.style) {
        case 'pellet': case 'bullet': case 'laserBolt': {
          ctx.globalCompositeOperation = 'lighter';
          var L = b.style === 'laserBolt' ? 3.2 : 2.1;
          ctx.save(); ctx.translate(x, y); ctx.rotate(b.rot);
          var gg = ctx.createLinearGradient(-s * L, 0, s * 1.4, 0);
          gg.addColorStop(0, 'rgba(255,255,255,0)'); gg.addColorStop(.55, b.col); gg.addColorStop(1, '#ffffff');
          ctx.fillStyle = gg;
          ctx.beginPath(); ctx.ellipse(0, 0, s * L, s * .78, 0, 0, M.TAU); ctx.fill();
          ctx.restore();
          break;
        }
        case 'arrow': {
          ctx.globalCompositeOperation = 'source-over';
          ctx.save(); ctx.translate(x, y); ctx.rotate(b.rot);
          ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 2.4 * z; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(-s * 3.4, 0); ctx.lineTo(s * 1.6, 0); ctx.stroke();
          ctx.fillStyle = b.col;
          ctx.beginPath(); ctx.moveTo(s * 3.2, 0); ctx.lineTo(s * .6, -s * .95); ctx.lineTo(s * .6, s * .95); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = b.col; ctx.lineWidth = 1.6 * z;
          ctx.beginPath(); ctx.moveTo(-s * 3.4, 0); ctx.lineTo(-s * 2.1, -s * .9); ctx.moveTo(-s * 3.4, 0); ctx.lineTo(-s * 2.1, s * .9); ctx.stroke();
          ctx.restore();
          break;
        }
        case 'orb': case 'blackhole': {
          ctx.globalCompositeOperation = 'lighter';
          var r2 = s * (b.style === 'blackhole' ? 2.2 + Math.sin(b.t * .2) * .3 : 1.9);
          var g2 = ctx.createRadialGradient(x, y, 0, x, y, r2);
          g2.addColorStop(0, '#fff'); g2.addColorStop(.34, b.col); g2.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(x, y, r2, 0, M.TAU); ctx.fill();
          if (b.style === 'blackhole') {
            ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#100818';
            ctx.beginPath(); ctx.arc(x, y, s * .9, 0, M.TAU); ctx.fill();
          }
          break;
        }
        case 'rocket': {
          ctx.globalCompositeOperation = 'source-over';
          ctx.save(); ctx.translate(x, y); ctx.rotate(b.rot);
          K.Art.rr(ctx, 0, 0, s * 3.4, s * 1.7, s * .7, '#cfd6e4', 1.8 * z);
          K.Art.poly(ctx, [s * 1.7, -s * .85, s * 2.9, 0, s * 1.7, s * .85], '#ff5a4a', 1.4 * z);
          ctx.restore();
          break;
        }
        case 'grenade': {
          ctx.globalCompositeOperation = 'source-over';
          K.Art.circle(ctx, x, y, s, b.col, 1.8 * z);
          ctx.fillStyle = '#fff'; ctx.globalAlpha = .5;
          ctx.beginPath(); ctx.arc(x - s * .3, y - s * .3, s * .3, 0, M.TAU); ctx.fill(); ctx.globalAlpha = 1;
          break;
        }
        case 'shuriken': {
          ctx.globalCompositeOperation = 'source-over';
          ctx.save(); ctx.translate(x, y); ctx.rotate(b.rot * 2);
          for (var q = 0; q < 4; q++) { ctx.rotate(M.TAU / 4); K.Art.poly(ctx, [0, -s * .5, s * 2.2, 0, 0, s * .5], b.col, 1.4 * z); }
          ctx.restore();
          break;
        }
        case 'boomerang': {
          ctx.globalCompositeOperation = 'source-over';
          ctx.save(); ctx.translate(x, y); ctx.rotate(b.t * .45);
          ctx.strokeStyle = b.col; ctx.lineWidth = 3.4 * z; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.arc(0, 0, s * 2, -1, 1.6); ctx.stroke();
          ctx.restore();
          break;
        }
        case 'flame': {
          ctx.globalCompositeOperation = 'lighter';
          var fr = s * 1.3, fg = ctx.createRadialGradient(x, y, 0, x, y, fr);
          var kk = b.t / b.life;
          fg.addColorStop(0, kk < .4 ? '#fff8d0' : '#ffb04a');
          fg.addColorStop(.5, '#ff7a2a'); fg.addColorStop(1, 'rgba(180,40,0,0)');
          ctx.globalAlpha = 1 - kk * .6;
          ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(x, y, fr, 0, M.TAU); ctx.fill(); ctx.globalAlpha = 1;
          break;
        }
        default: {
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = b.col; ctx.beginPath(); ctx.arc(x, y, s, 0, M.TAU); ctx.fill();
        }
      }
    }
    ctx.restore();
  }
  /* 调试判定 */
  function drawDebug(ctx, V) {
    ctx.save(); ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(255,90,90,.9)';
    for (var i = 0; i < bullets.length; i++) {
      var b = bullets[i];
      ctx.beginPath(); ctx.arc(V.tx(b.x), V.ty(b.y), b.r * V.z, 0, M.TAU); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,200,60,.95)';
    for (i = 0; i < swings.length; i++) {
      var w = swings[i];
      ctx.beginPath();
      ctx.moveTo(V.tx(w.x + Math.cos(w.cur) * w.r0), V.ty(w.y + Math.sin(w.cur) * w.r0));
      ctx.lineTo(V.tx(w.x + Math.cos(w.cur) * w.r1), V.ty(w.y + Math.sin(w.cur) * w.r1));
      ctx.stroke();
      ctx.beginPath(); ctx.arc(V.tx(w.x), V.ty(w.y), w.r1 * V.z, w.ang - w.half, w.ang + w.half); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(120,255,120,.7)';
    for (i = 0; i < pools.length; i++) { var p = pools[i]; ctx.beginPath(); ctx.arc(V.tx(p.x), V.ty(p.y), p.r * V.z, 0, M.TAU); ctx.stroke(); }
    ctx.restore();
  }
  K.B = { bullets: bullets, swings: swings, pools: pools, spawn: spawn, swing: swing, pool: pool,
    explode: explode, chainFrom: chainFrom, beam: beam, update: update, draw: draw, drawUnder: drawUnder,
    drawDebug: drawDebug, reset: reset, nearest: nearest, segDist: segDist,
    get count() { return bullets.length; } };
})(window.K);
