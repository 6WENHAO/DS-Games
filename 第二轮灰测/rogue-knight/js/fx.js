/* fx.js — 粒子 / 伤害数字 / 震屏 / 慢镜 / 光照 / 地面血迹 */
(function (K) {
  'use strict';
  var M = K.M, TAU = M.TAU;
  var parts = [], texts = [], lights = [], beams = [];
  var shX = 0, shY = 0, shT = 0, shMag = 0, shDur = 1, shA = 0;
  var flashA = 0, flashCol = '#fff', slowT = 0, slowK = 1, zoomK = 0, zoomT = 0, zoomD = 1, stopT = 0;
  var MAXP = 760;

  function reset() { parts.length = 0; texts.length = 0; lights.length = 0; beams.length = 0; shT = 0; flashA = 0; slowT = 0; zoomT = 0; stopT = 0; }
  function part(o) {
    if (parts.length >= MAXP) parts.shift();
    o.age = 0; o.life = o.life || 20;
    o.vx = o.vx || 0; o.vy = o.vy || 0; o.r = o.r || 3;
    o.drag = o.drag === undefined ? .92 : o.drag;
    o.rot = o.rot || 0; o.spin = o.spin || 0; o.z = o.z || 0; o.vz = o.vz || 0;
    parts.push(o); return o;
  }
  /* 通用爆点：n 个碎片 + 中心辉光 */
  function burst(x, y, n, o) {
    o = o || {};
    var col = o.col || '#ffe9a8', col2 = o.col2 || '#ff9a2e', sp = o.speed || 4, size = o.size || 3;
    if (o.flare !== 0) part({ type: 'flare', x: x, y: y, r: (o.flareR || 16), life: o.flareLife || 7, col: col, col2: col2 });
    for (var i = 0; i < n; i++) {
      var a = o.dir === undefined ? M.rnd(TAU) : o.dir + M.rnd(-(o.spread || 3.14), (o.spread || 3.14));
      var s = M.rnd(sp * .35, sp);
      part({ type: o.type || 'shard', x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        r: M.rnd(size * .5, size), life: M.rnd(10, 22), col: i % 3 ? col : col2, drag: .9 });
    }
  }
  function spark(x, y, dir, n, col) {
    for (var i = 0; i < (n || 6); i++) {
      var a = dir + M.rnd(-.8, .8), s = M.rnd(2, 7);
      part({ type: 'shard', x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: M.rnd(1.4, 3), life: M.rnd(8, 16), col: col || '#fff3c0', drag: .88 });
    }
  }
  function blood(x, y, dir, n, col) {
    col = col || '#c8203a';
    for (var i = 0; i < (n || 8); i++) {
      var a = dir + M.rnd(-1.1, 1.1), s = M.rnd(1.5, 6.5);
      part({ type: 'blood', x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: M.rnd(2, 4.6), life: M.rnd(14, 28), col: col, drag: .86, decal: 1 });
    }
  }
  function smoke(x, y, n, col, sp) {
    for (var i = 0; i < (n || 5); i++) {
      var a = M.rnd(TAU);
      part({ type: 'smoke', x: x, y: y, vx: Math.cos(a) * M.rnd(.2, sp || 1.4), vy: Math.sin(a) * M.rnd(.2, sp || 1.4) - .3,
        r: M.rnd(5, 13), life: M.rnd(18, 34), col: col || '#8d8a9a', drag: .93, grow: M.rnd(.25, .7) });
    }
  }
  function ring(x, y, r0, r1, col, life, lw) { part({ type: 'ring', x: x, y: y, r: r0, r2: r1, col: col || '#fff', life: life || 14, lw: lw || 3 }); }
  function muzzle(x, y, dir, size, col) {
    part({ type: 'muzzle', x: x, y: y, rot: dir, r: size || 13, life: 5, col: col || '#fff2b0' });
    for (var i = 0; i < 4; i++) {
      var a = dir + M.rnd(-.35, .35);
      part({ type: 'shard', x: x, y: y, vx: Math.cos(a) * M.rnd(3, 8), vy: Math.sin(a) * M.rnd(3, 8), r: M.rnd(1.2, 2.6), life: M.rnd(5, 11), col: col || '#ffd66a', drag: .87 });
    }
  }
  function shell(x, y, dir) {
    part({ type: 'shell', x: x, y: y, vx: Math.cos(dir + 1.9) * M.rnd(1.4, 3), vy: Math.sin(dir + 1.9) * M.rnd(1.4, 3) - 1.4,
      z: 8, vz: M.rnd(1.4, 2.6), r: 2.4, life: 60, drag: .96, col: '#e0b84a', spin: M.rnd(-.5, .5) });
  }
  function trail(x, y, col, r, life) { part({ type: 'glow', x: x, y: y, r: r || 5, life: life || 9, col: col || '#fff' }); }
  function light(x, y, r, col, life) { lights.push({ x: x, y: y, r: r, col: col, life: life || 8, age: 0 }); }
  function beam(x1, y1, x2, y2, col, w, life) { beams.push({ x1: x1, y1: y1, x2: x2, y2: y2, col: col || '#8fd0ff', w: w || 6, life: life || 8, age: 0 }); }
  function text(x, y, s, o) {
    o = o || {};
    texts.push({ x: x, y: y, s: s, col: o.col || '#fff', size: o.size || 15, life: o.life || 40, age: 0,
      vy: o.vy === undefined ? -1.1 : o.vy, vx: o.vx || 0, out: o.out || '#14101c', crit: o.crit || 0 });
  }
  function shake(mag, dur, dir) {
    if (mag < shMag * .55 && shT > 0) return;
    shMag = mag; shDur = dur || 14; shT = shDur; shA = dir === undefined ? M.rnd(TAU) : dir;
  }
  function flash(a, col) { flashA = Math.max(flashA, a); flashCol = col || '#fff'; }
  function slow(fr, k) { slowT = Math.max(slowT, fr); slowK = k || .3; }
  function hitstop(fr) { stopT = Math.max(stopT, fr); }
  function zoom(k, dur) { zoomK = k; zoomT = zoomD = dur || 12; }

  function update() {
    var i, p;
    for (i = parts.length - 1; i >= 0; i--) {
      p = parts[i]; p.age++;
      if (p.age >= p.life) {
        if (p.decal && K.FX.decal) K.FX.decal(p.x, p.y, p.r * 1.5, p.col);
        parts.splice(i, 1); continue;
      }
      p.x += p.vx; p.y += p.vy; p.vx *= p.drag; p.vy *= p.drag;
      if (p.vz !== undefined && (p.z > 0 || p.vz > 0)) { p.z += p.vz; p.vz -= .22; if (p.z < 0) { p.z = 0; p.vz *= -.4; p.vx *= .6; p.vy *= .6; } }
      p.rot += p.spin;
      if (p.grow) p.r += p.grow;
    }
    for (i = texts.length - 1; i >= 0; i--) {
      var t = texts[i]; t.age++; t.x += t.vx; t.y += t.vy; t.vy *= .93;
      if (t.age >= t.life) texts.splice(i, 1);
    }
    for (i = lights.length - 1; i >= 0; i--) { lights[i].age++; if (lights[i].age >= lights[i].life) lights.splice(i, 1); }
    for (i = beams.length - 1; i >= 0; i--) { beams[i].age++; if (beams[i].age >= beams[i].life) beams.splice(i, 1); }
    if (shT > 0) {
      shT--;
      var k = shT / shDur, amp = shMag * k * k;
      shX = Math.cos(shA + shT * 2.1) * amp; shY = Math.sin(shA * 1.3 + shT * 1.9) * amp * .8;
    } else { shX = shY = 0; shMag = 0; }
    if (flashA > 0) flashA = Math.max(0, flashA - .07);
    if (zoomT > 0) zoomT--;
  }
  function slowTick() { var k = slowT > 0 ? slowK : 1; if (slowT > 0) slowT--; if (stopT > 0) { stopT--; return 0; } return k; }
  function zoomOff() { return zoomT > 0 ? zoomK * Math.pow(zoomT / zoomD, 2) : 0; }

  /* —— 绘制 —— */
  function drawLights(ctx, V) {
    if (!lights.length) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < lights.length; i++) {
      var L = lights[i], a = 1 - L.age / L.life, x = V.tx(L.x), y = V.ty(L.y), r = L.r * V.z;
      var g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, L.col); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = a * .55; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  function drawParts(ctx, V, above) {
    ctx.save();
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i], k = p.age / p.life, a = 1 - k;
      var isAbove = p.type !== 'blood' && p.type !== 'smoke';
      if (!!above !== isAbove) continue;
      var x = V.tx(p.x), y = V.ty(p.y - (p.z || 0)), z = V.z;
      switch (p.type) {
        case 'flare':
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
          var rr = p.r * z * (1 + k * 1.6);
          var g = ctx.createRadialGradient(x, y, 0, x, y, rr);
          g.addColorStop(0, '#fff'); g.addColorStop(.4, p.col); g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill();
          break;
        case 'muzzle':
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
          ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot);
          var mr = p.r * z * (1 + (1 - a) * .5);
          ctx.fillStyle = p.col;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(mr * 1.7, -mr * .5); ctx.lineTo(mr * 2.3, 0); ctx.lineTo(mr * 1.7, mr * .5); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.arc(0, 0, mr * .55, 0, TAU); ctx.fill();
          ctx.restore();
          break;
        case 'ring':
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * .9;
          ctx.strokeStyle = p.col; ctx.lineWidth = Math.max(1, p.lw * z * a);
          ctx.beginPath(); ctx.arc(x, y, M.lerp(p.r, p.r2, M.easeOut(k)) * z, 0, TAU); ctx.stroke();
          break;
        case 'glow':
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * .8;
          ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(x, y, p.r * z * a, 0, TAU); ctx.fill();
          break;
        case 'blood':
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = Math.min(1, a * 1.6);
          ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(x, y, p.r * z, 0, TAU); ctx.fill();
          break;
        case 'smoke':
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a * .35;
          ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(x, y, p.r * z * (.7 + k), 0, TAU); ctx.fill();
          break;
        case 'shell':
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = Math.min(1, a * 2);
          ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot);
          ctx.fillStyle = p.col; ctx.fillRect(-2.6 * z, -1.3 * z, 5.2 * z, 2.6 * z); ctx.restore();
          break;
        default: /* shard */
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
          ctx.fillStyle = p.col;
          ctx.beginPath(); ctx.arc(x, y, Math.max(.7, p.r * z * a), 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }
  function drawBeams(ctx, V) {
    if (!beams.length) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (var i = 0; i < beams.length; i++) {
      var b = beams[i], a = 1 - b.age / b.life;
      ctx.globalAlpha = a * .85; ctx.strokeStyle = b.col;
      ctx.lineWidth = b.w * V.z * a;
      ctx.beginPath(); ctx.moveTo(V.tx(b.x1), V.ty(b.y1)); ctx.lineTo(V.tx(b.x2), V.ty(b.y2)); ctx.stroke();
      ctx.globalAlpha = a; ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, b.w * V.z * a * .35);
      ctx.beginPath(); ctx.moveTo(V.tx(b.x1), V.ty(b.y1)); ctx.lineTo(V.tx(b.x2), V.ty(b.y2)); ctx.stroke();
    }
    ctx.restore();
  }
  function drawTexts(ctx, V) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (var i = 0; i < texts.length; i++) {
      var t = texts[i], k = t.age / t.life, a = k > .65 ? (1 - k) / .35 : 1;
      var pop = t.age < 5 ? 1 + (5 - t.age) * .12 : 1;
      var s = t.size * V.z * pop;
      ctx.globalAlpha = a;
      ctx.font = '900 ' + s.toFixed(1) + 'px "Arial Black",Impact,sans-serif';
      ctx.lineWidth = Math.max(2, s * .18); ctx.strokeStyle = t.out; ctx.lineJoin = 'round';
      var x = V.tx(t.x), y = V.ty(t.y);
      ctx.strokeText(t.s, x, y); ctx.fillStyle = t.col; ctx.fillText(t.s, x, y);
    }
    ctx.restore();
  }
  function drawFlash(ctx, w, h) {
    if (flashA <= .002) return;
    ctx.save(); ctx.globalAlpha = Math.min(1, flashA); ctx.fillStyle = flashCol; ctx.fillRect(0, 0, w, h); ctx.restore();
  }
  K.FX = {
    reset: reset, part: part, burst: burst, spark: spark, blood: blood, smoke: smoke, ring: ring,
    muzzle: muzzle, shell: shell, trail: trail, light: light, beam: beam, text: text,
    shake: shake, flash: flash, slow: slow, hitstop: hitstop, zoom: zoom,
    update: update, slowTick: slowTick, zoomOff: zoomOff,
    drawLights: drawLights, drawParts: drawParts, drawBeams: drawBeams, drawTexts: drawTexts, drawFlash: drawFlash,
    decal: null,
    get shakeX() { return shX; }, get shakeY() { return shY; },
    get count() { return parts.length; }
  };
})(window.K);
