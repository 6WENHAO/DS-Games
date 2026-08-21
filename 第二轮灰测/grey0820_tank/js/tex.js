/*
 * tex.js — procedural texture generator for a WW2-era tank simulator.
 * Pure Canvas 2D, no assets, no network, no dependencies. All returned
 * canvases are power-of-two so they upload cleanly as WebGL1 textures.
 *
 * Exposes window.TS.Tex = { gauge, label, panel, metal, camo, rivetPlate,
 * tread, radial, reticle, screen, warn, wood, canvasFabric, get }.
 */
(function () {
  'use strict';

  window.TS = window.TS || {};
  var TS = window.TS;
  TS.Tex = TS.Tex || {};

  /* =====================================================================
   * Small deterministic PRNG (mulberry32). Every texture is reproducible.
   * ===================================================================== */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeRng(opts) {
    var seed = (opts && typeof opts.seed === 'number') ? opts.seed : 0x51A7C0DE;
    return mulberry32(seed);
  }

  /* =====================================================================
   * Canvas + colour helpers.
   * ===================================================================== */
  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function g2d(c) { return c.getContext('2d'); }

  function gopt(o, k, d) {
    return (o && o[k] !== undefined && o[k] !== null) ? o[k] : d;
  }

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function rand(rng, a, b) {
    if (b === undefined) { b = a; a = 0; }
    return a + rng() * (b - a);
  }

  function irand(rng, a, b) { return Math.floor(rand(rng, a, b + 1)); }

  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

  function hexToRgb(hex) {
    var h = String(hex || '#ffffff').replace('#', '');
    if (h.length === 3) { h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2); }
    var n = parseInt(h, 16);
    if (isNaN(n)) { n = 0xffffff; }
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgbStr(r, g, b, a) {
    if (a === undefined) { a = 1; }
    return 'rgba(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ',' + a + ')';
  }

  function rgba(hex, a) {
    var c = hexToRgb(hex);
    return rgbStr(c[0], c[1], c[2], a);
  }

  function shade(hex, f) {
    var c = hexToRgb(hex);
    return rgbStr(clamp(Math.round(c[0] * f), 0, 255),
                  clamp(Math.round(c[1] * f), 0, 255),
                  clamp(Math.round(c[2] * f), 0, 255), 1);
  }

  function fmtNum(v) {
    if (Math.abs(v - Math.round(v)) < 1e-6) { return String(Math.round(v)); }
    return String(Math.round(v * 10) / 10);
  }

  /* Math-convention angle helpers. 0 = east, positive = counter-clockwise
   * (y-up). We convert to canvas space (y-down) by negating. */
  function anglePoint(cx, cy, r, deg) {
    var a = deg * Math.PI / 180;
    return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
  }

  /* Add an arc path from a0deg to a1deg (math convention), sweeping in the
   * short direction implied by the numeric order. */
  function drawArc(ctx, cx, cy, r, a0deg, a1deg) {
    var a0 = -a0deg * Math.PI / 180;
    var a1 = -a1deg * Math.PI / 180;
    ctx.arc(cx, cy, r, a0, a1, a1deg > a0deg);
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* Shrink a bold font until text fits maxW; returns the final px size. */
  function fitText(ctx, text, startSize, family, maxW) {
    var s = Math.max(6, Math.floor(startSize));
    ctx.font = 'bold ' + s + 'px ' + family;
    while (s > 6 && ctx.measureText(text).width > maxW) {
      s--;
      ctx.font = 'bold ' + s + 'px ' + family;
    }
    return s;
  }

  /* Layered-scratch helper used by several materials. */
  function scratches(ctx, rng, n, x0, y0, w, h, style, aMax) {
    ctx.lineCap = 'round';
    for (var i = 0; i < n; i++) {
      var x = x0 + rand(rng, 0, w);
      var y = y0 + rand(rng, 0, h);
      var len = rand(rng, 6, 45);
      var ang = rand(rng, 0, Math.PI * 2);
      ctx.strokeStyle = style;
      ctx.globalAlpha = aMax * rand(rng, 0.15, 1);
      ctx.lineWidth = rand(rng, 0.4, 1.1);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* Soft organic blob built from overlapping radial-gradient circles. */
  function softBlob(ctx, rng, x, y, R, col, alpha) {
    var n = irand(rng, 3, 5);
    for (var i = 0; i < n; i++) {
      var rr = R * rand(rng, 0.5, 0.9);
      var px = x + rand(rng, -R, R) * 0.5;
      var py = y + rand(rng, -R, R) * 0.5;
      var g = ctx.createRadialGradient(px, py, 0, px, py, rr);
      g.addColorStop(0, rgba(col, alpha));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, rr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* Large soft irregular camo blotch (many overlapping soft circles). */
  function paintBlob(ctx, rng, x, y, R, col) {
    var n = irand(rng, 6, 11);
    for (var i = 0; i < n; i++) {
      var rr = R * rand(rng, 0.35, 0.75);
      var px = x + rand(rng, -R, R) * 0.7;
      var py = y + rand(rng, -R, R) * 0.5;
      var g = ctx.createRadialGradient(px, py, 0, px, py, rr);
      g.addColorStop(0, rgba(col, 0.9));
      g.addColorStop(0.7, rgba(col, 0.75));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, rr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* Irregular paint chip revealing bare metal. */
  function paintChip(ctx, rng, x, y, w, h, metal, dark) {
    var n = irand(rng, 3, 6);
    ctx.beginPath();
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      var rr = rng() * 0.5 + 0.5;
      var px = x + Math.cos(a) * w * rr;
      var py = y + Math.sin(a) * h * rr;
      if (i === 0) { ctx.moveTo(px, py); } else { ctx.lineTo(px, py); }
    }
    ctx.closePath();
    ctx.fillStyle = metal;
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /* =====================================================================
   * 1. gauge — 256x256 analog instrument dial face (no needle).
   * ===================================================================== */
  TS.Tex.gauge = function (opts) {
    opts = opts || {};
    var S = 256;
    var c = makeCanvas(S, S);
    var ctx = g2d(c);
    var rng = makeRng(opts);
    var cx = S / 2, cy = S / 2;

    var title = String(gopt(opts, 'title', 'RPM'));
    var unit = String(gopt(opts, 'unit', 'x100'));
    var min = gopt(opts, 'min', 0);
    var max = gopt(opts, 'max', 30);
    var ticks = Math.max(1, gopt(opts, 'ticks', 6));
    var minorPerTick = Math.max(0, gopt(opts, 'minorPerTick', 5));
    var redFrom = gopt(opts, 'redFrom', 24);
    var startAngle = gopt(opts, 'startAngle', -225);
    var endAngle = gopt(opts, 'endAngle', -315);
    var dark = gopt(opts, 'dark', true);
    var color = gopt(opts, 'color', '#e8e2cf');

    var range = (max - min) || 1;
    var sweep = endAngle - startAngle;

    var faceHi, faceLo, ink;
    if (dark) { faceHi = '#3a3830'; faceLo = '#151513'; ink = color; }
    else { faceHi = '#f2ecda'; faceLo = '#c6bea6'; ink = '#2b2a24'; }

    // Bakelite face with radial vignette.
    var fg = ctx.createRadialGradient(cx - 18, cy - 18, 20, cx, cy, S * 0.75);
    fg.addColorStop(0, faceHi);
    fg.addColorStop(1, faceLo);
    ctx.fillStyle = fg;
    ctx.fillRect(0, 0, S, S);

    // Fine bakelite grain.
    ctx.globalAlpha = 0.06;
    for (var n = 0; n < 900; n++) {
      ctx.fillStyle = (rng() < 0.5) ? '#ffffff' : '#000000';
      ctx.fillRect(rand(rng, 0, S), rand(rng, 0, S), rand(rng, 1, 2), rand(rng, 1, 2));
    }
    ctx.globalAlpha = 1;

    // Outer chrome-ish ring.
    var ring = 122, ringW = 13;
    var cg = ctx.createLinearGradient(cx - ring, cy - ring, cx + ring, cy + ring);
    cg.addColorStop(0, '#f4f4ee');
    cg.addColorStop(0.4, '#9a9a92');
    cg.addColorStop(0.6, '#6f6f68');
    cg.addColorStop(1, '#e4e4dc');
    ctx.lineWidth = ringW;
    ctx.strokeStyle = cg;
    ctx.beginPath();
    ctx.arc(cx, cy, ring - ringW / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.arc(cx, cy, ring + ringW / 2 - 1, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.arc(cx, cy, ring - ringW / 2 + 1, 0, Math.PI * 2); ctx.stroke();

    // Optional red danger arc.
    if (redFrom > min && redFrom < max) {
      var aRed0 = startAngle + sweep * ((redFrom - min) / range);
      ctx.lineWidth = 9;
      ctx.strokeStyle = 'rgba(192,40,28,0.9)';
      ctx.beginPath();
      drawArc(ctx, cx, cy, 95, aRed0, endAngle);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,120,90,0.5)';
      ctx.beginPath();
      drawArc(ctx, cx, cy, 99.5, aRed0, endAngle);
      ctx.stroke();
    }

    // Tick geometry.
    var rOut = 108, rMaj = 94, rMin = 101, rLab = 78;
    ctx.lineCap = 'round';

    // Minor ticks.
    ctx.strokeStyle = ink;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1;
    for (var i = 0; i < ticks; i++) {
      for (var k = 1; k <= minorPerTick; k++) {
        var t = (i + k / (minorPerTick + 1)) / ticks;
        var a = startAngle + sweep * t;
        var p1 = anglePoint(cx, cy, rMin, a);
        var p2 = anglePoint(cx, cy, rOut, a);
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // Major ticks + numeric labels (drawn upright).
    ctx.font = '700 12px "Arial Narrow", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var m = 0; m <= ticks; m++) {
      var tm = m / ticks;
      var am = startAngle + sweep * tm;
      var mp1 = anglePoint(cx, cy, rMaj, am);
      var mp2 = anglePoint(cx, cy, rOut, am);
      ctx.lineWidth = 3;
      ctx.strokeStyle = ink;
      ctx.beginPath(); ctx.moveTo(mp1.x, mp1.y); ctx.lineTo(mp2.x, mp2.y); ctx.stroke();
      var lp = anglePoint(cx, cy, rLab, am);
      ctx.fillStyle = ink;
      ctx.fillText(fmtNum(min + (max - min) * tm), lp.x, lp.y);
    }

    // Title in the lower third.
    ctx.fillStyle = ink;
    var ts = fitText(ctx, title.toUpperCase(), 22, '"Arial Narrow", Arial, sans-serif', 120);
    ctx.font = '700 ' + ts + 'px "Arial Narrow", Arial, sans-serif';
    ctx.fillText(title.toUpperCase(), cx, cy + 86);
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 1;
    ctx.strokeStyle = ink;
    ctx.beginPath(); ctx.moveTo(cx - 40, cy + 98); ctx.lineTo(cx + 40, cy + 98); ctx.stroke();
    ctx.globalAlpha = 1;

    // Unit (small caps) under the centre hub.
    ctx.fillStyle = ink;
    ctx.font = '10px "Arial Narrow", Arial, sans-serif';
    ctx.globalAlpha = 0.85;
    ctx.fillText(unit.toUpperCase(), cx, cy + 26);
    ctx.globalAlpha = 1;

    // Centre hub circle (needle hides behind this).
    var hg = ctx.createRadialGradient(cx - 5, cy - 5, 2, cx, cy, 24);
    hg.addColorStop(0, '#4c4a42');
    hg.addColorStop(1, '#1a1a17');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(cx, cy, 23, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#7d7b70';
    ctx.beginPath(); ctx.arc(cx, cy, 23, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#0c0c0a';
    ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();

    // Faint glass glare in the upper-left.
    var gg = ctx.createRadialGradient(cx - 40, cy - 40, 5, cx - 40, cy - 40, 120);
    gg.addColorStop(0, 'rgba(255,255,255,0.14)');
    gg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.arc(cx - 40, cy - 40, 120, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx - 130, cy - 70);
    ctx.lineTo(cx - 30, cy - 110);
    ctx.lineTo(cx + 10, cy - 130);
    ctx.lineTo(cx - 60, cy - 50);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    return c;
  };

  /* =====================================================================
   * 2. label — stenciled / engraved metal data plate.
   * ===================================================================== */
  TS.Tex.label = function (text, opts) {
    opts = opts || {};
    var w = gopt(opts, 'w', 256);
    var h = gopt(opts, 'h', 64);
    var c = makeCanvas(w, h);
    var ctx = g2d(c);
    makeRng(opts);
    var bg = gopt(opts, 'bg', '#3a4038');
    var color = gopt(opts, 'color', '#d9d4c2');
    var sub = gopt(opts, 'sub', '');
    var transparent = gopt(opts, 'transparent', false);
    var txt = String(text || '').toUpperCase();

    if (!transparent) {
      // Plate background with a slight vertical sheen.
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, shade(bg, 1.15));
      g.addColorStop(0.5, bg);
      g.addColorStop(1, shade(bg, 0.8));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // Bevel + 1px inner border.
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
      ctx.lineWidth = 1;
      ctx.strokeStyle = shade(bg, 0.55);
      ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.strokeRect(3.5, 3.5, w - 7, h - 7);
    }

    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var mainY = sub ? h * 0.38 : h / 2;
    var ts = fitText(ctx, txt, Math.round(h * 0.5), '"Arial Narrow", Arial, sans-serif', w - 16);
    ctx.font = '700 ' + ts + 'px "Arial Narrow", Arial, sans-serif';
    ctx.fillText(txt, w / 2, mainY);

    if (sub) {
      var subTxt = String(sub).toUpperCase();
      ctx.fillStyle = rgba(color, 0.8);
      var ss = fitText(ctx, subTxt, Math.round(h * 0.28), '"Arial Narrow", Arial, sans-serif', w - 16);
      ctx.font = ss + 'px "Arial Narrow", Arial, sans-serif';
      ctx.fillText(subTxt, w / 2, h * 0.68);
    }

    return c;
  };

  /* =====================================================================
   * 3. panel — 512x512 painted sheet-metal instrument panel.
   * ===================================================================== */
  TS.Tex.panel = function (opts) {
    opts = opts || {};
    var S = 512;
    var c = makeCanvas(S, S);
    var ctx = g2d(c);
    var rng = makeRng(opts);
    var base = gopt(opts, 'color', '#4a5245');

    var g = ctx.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, shade(base, 1.08));
    g.addColorStop(0.5, base);
    g.addColorStop(1, shade(base, 0.88));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);

    // Fine brushed noise.
    for (var i = 0; i < 4000; i++) {
      ctx.fillStyle = (rng() < 0.5)
        ? 'rgba(255,255,255,' + rand(rng, 0.01, 0.04) + ')'
        : 'rgba(0,0,0,' + rand(rng, 0.01, 0.05) + ')';
      ctx.fillRect(rand(rng, 0, S), rand(rng, 0, S), rand(rng, 1, 3), 1);
    }

    // Scattered paint chips revealing bare metal.
    var metal = '#7c817c', metalDark = '#565b56';
    for (var c1 = 0; c1 < 90; c1++) {
      paintChip(ctx, rng, rand(rng, 5, S - 5), rand(rng, 5, S - 5),
        rand(rng, 2, 7), rand(rng, 2, 7), metal, metalDark);
    }
    // A few larger chips down to lighter primer.
    for (var c2 = 0; c2 < 25; c2++) {
      paintChip(ctx, rng, rand(rng, 10, S - 10), rand(rng, 10, S - 10),
        rand(rng, 4, 14), rand(rng, 4, 10), shade(base, 1.6), shade(base, 0.6));
    }

    // Faint vertical grime streaks.
    ctx.globalAlpha = 0.12;
    for (var s = 0; s < 30; s++) {
      var x = rand(rng, 0, S);
      var len = rand(rng, 60, S);
      var y = rand(rng, -len, S);
      var sg = ctx.createLinearGradient(x, y, x, y + len);
      sg.addColorStop(0, 'rgba(0,0,0,0)');
      sg.addColorStop(0.5, 'rgba(0,0,0,0.7)');
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(x - 2, y, 4, len);
    }
    ctx.globalAlpha = 1;

    // Darkened bolt holes near the edges.
    var bolts = [
      [26, 26], [S - 26, 26], [26, S - 26], [S - 26, S - 26],
      [S / 2, 26], [S / 2, S - 26], [26, S / 2], [S - 26, S / 2]
    ];
    for (var b = 0; b < bolts.length; b++) {
      drawBolt(ctx, bolts[b][0], bolts[b][1], 12);
    }

    return c;
  };

  function drawBolt(ctx, x, y, r) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.arc(x, y, r + 2, 0, Math.PI * 2); ctx.fill();
    var g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
    g.addColorStop(0, '#6a6e6a');
    g.addColorStop(1, '#1c1e1c');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, r - 1, Math.PI * 1.1, Math.PI * 1.7); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.beginPath(); ctx.moveTo(x - r * 0.5, y); ctx.lineTo(x + r * 0.5, y); ctx.stroke();
  }

  /* =====================================================================
   * 4. metal — 256x256 worn steel.
   * ===================================================================== */
  TS.Tex.metal = function (opts) {
    opts = opts || {};
    var S = 256;
    var c = makeCanvas(S, S);
    var ctx = g2d(c);
    var rng = makeRng(opts);
    var base = gopt(opts, 'color', '#7d8280');
    var rust = clamp(gopt(opts, 'rust', 0.25), 0, 1);

    var g = ctx.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, shade(base, 1.1));
    g.addColorStop(0.5, base);
    g.addColorStop(1, shade(base, 0.86));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);

    // Horizontal brushed streaks.
    for (var i = 0; i < 400; i++) {
      var y = rand(rng, 0, S);
      var w = rand(rng, 30, S);
      var x = rand(rng, 0, S - w);
      ctx.fillStyle = (rng() < 0.5)
        ? 'rgba(255,255,255,' + rand(rng, 0.01, 0.05) + ')'
        : 'rgba(0,0,0,' + rand(rng, 0.01, 0.06) + ')';
      ctx.fillRect(x, y, w, 1);
    }

    // Scratches.
    scratches(ctx, rng, 60, 0, 0, S, S, 'rgba(255,255,255,0.25)', 1);
    scratches(ctx, rng, 60, 0, 0, S, S, 'rgba(0,0,0,0.30)', 1);

    // Rust spots, amount controlled by opts.rust.
    var rustCount = Math.round(rust * 40);
    var rustCols = ['#8a4a28', '#7a3a1c', '#a05a30', '#6e3418'];
    for (var r = 0; r < rustCount; r++) {
      softBlob(ctx, rng, rand(rng, 10, S - 10), rand(rng, 10, S - 10),
        rand(rng, 4, 18), pick(rng, rustCols), 0.5);
    }

    // Edge vignette.
    var v = ctx.createRadialGradient(S / 2, S / 2, S * 0.25, S / 2, S / 2, S * 0.7);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, S, S);

    return c;
  };

  /* =====================================================================
   * 5. camo — 512x512 olive-drab vehicle exterior.
   * ===================================================================== */
  TS.Tex.camo = function (opts) {
    opts = opts || {};
    var S = 512;
    var c = makeCanvas(S, S);
    var ctx = g2d(c);
    var rng = makeRng(opts);
    var base = gopt(opts, 'base', '#5d6348');
    var blotch = gopt(opts, 'blotch', '#4a4433');

    var g = ctx.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, shade(base, 1.06));
    g.addColorStop(1, shade(base, 0.92));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);

    // Fine base noise.
    for (var i = 0; i < 4000; i++) {
      ctx.fillStyle = (rng() < 0.5)
        ? 'rgba(255,255,255,' + rand(rng, 0.01, 0.035) + ')'
        : 'rgba(0,0,0,' + rand(rng, 0.01, 0.04) + ')';
      ctx.fillRect(rand(rng, 0, S), rand(rng, 0, S), rand(rng, 1, 3), 1);
    }

    // Large soft irregular blotches.
    for (var b = 0; b < 16; b++) {
      paintBlob(ctx, rng, rand(rng, 40, S - 40), rand(rng, 30, S - 30),
        rand(rng, 60, 130), blotch);
    }
    // Secondary darker blotches for depth.
    for (var b2 = 0; b2 < 10; b2++) {
      paintBlob(ctx, rng, rand(rng, 30, S - 30), rand(rng, 30, S - 30),
        rand(rng, 40, 90), shade(blotch, 0.82));
    }
    // A few lighter mottles.
    for (var b3 = 0; b3 < 8; b3++) {
      paintBlob(ctx, rng, rand(rng, 30, S - 30), rand(rng, 30, S - 30),
        rand(rng, 30, 70), shade(base, 1.15));
    }

    // Dust accumulation gradient toward the bottom.
    var dg = ctx.createLinearGradient(0, 0, 0, S);
    dg.addColorStop(0, 'rgba(0,0,0,0)');
    dg.addColorStop(0.55, 'rgba(0,0,0,0)');
    dg.addColorStop(1, 'rgba(150,140,110,0.28)');
    ctx.fillStyle = dg;
    ctx.fillRect(0, 0, S, S);

    // Mild dirt streaks.
    ctx.globalAlpha = 0.1;
    for (var ds = 0; ds < 25; ds++) {
      var sx = rand(rng, 0, S);
      var len = rand(rng, 40, 160);
      var sy = rand(rng, S * 0.3, S - len);
      var sg = ctx.createLinearGradient(sx, sy, sx, sy + len);
      sg.addColorStop(0, 'rgba(30,24,16,0)');
      sg.addColorStop(0.5, 'rgba(30,24,16,0.9)');
      sg.addColorStop(1, 'rgba(30,24,16,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(sx - 2, sy, 4, len);
    }
    ctx.globalAlpha = 1;

    // Scratches and chipping.
    scratches(ctx, rng, 70, 0, 0, S, S, 'rgba(255,255,255,0.18)', 1);
    scratches(ctx, rng, 70, 0, 0, S, S, 'rgba(20,20,16,0.30)', 1);
    for (var ch = 0; ch < 40; ch++) {
      paintChip(ctx, rng, rand(rng, 5, S - 5), rand(rng, 5, S - 5),
        rand(rng, 1, 4), rand(rng, 1, 4), '#6c7066', '#3c3e38');
    }

    return c;
  };

  /* =====================================================================
   * 6. rivetPlate — 256x256 steel plate with a grid of shaded rivets.
   * ===================================================================== */
  TS.Tex.rivetPlate = function (opts) {
    opts = opts || {};
    var S = 256;
    var c = makeCanvas(S, S);
    var ctx = g2d(c);
    var rng = makeRng(opts);
    var cols = Math.max(1, gopt(opts, 'cols', 4));
    var rows = Math.max(1, gopt(opts, 'rows', 4));

    // Steel plate base.
    var g = ctx.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, '#8a8e89');
    g.addColorStop(0.5, '#6f7470');
    g.addColorStop(1, '#565b57');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);

    // Brushed streaks.
    for (var i = 0; i < 260; i++) {
      var y = rand(rng, 0, S);
      var w = rand(rng, 30, S);
      var x = rand(rng, 0, S - w);
      ctx.fillStyle = (rng() < 0.5)
        ? 'rgba(255,255,255,' + rand(rng, 0.01, 0.04) + ')'
        : 'rgba(0,0,0,' + rand(rng, 0.01, 0.05) + ')';
      ctx.fillRect(x, y, w, 1);
    }
    scratches(ctx, rng, 40, 0, 0, S, S, 'rgba(0,0,0,0.25)', 1);

    // Rivet grid.
    var sx = S / cols, sy = S / rows;
    var r = Math.min(sx, sy) * 0.22;
    for (var j = 0; j < rows; j++) {
      for (var i2 = 0; i2 < cols; i2++) {
        drawRivet(ctx, (i2 + 0.5) * sx, (j + 0.5) * sy, r);
      }
    }

    // Edge shading.
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, S - 6, S - 6);

    return c;
  };

  function drawRivet(ctx, x, y, r) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.arc(x + 1.5, y + 1.5, r, 0, Math.PI * 2); ctx.fill();
    var g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, '#e8e6df');
    g.addColorStop(0.5, '#9aa09c');
    g.addColorStop(1, '#565b58');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    // Highlight top-left, shadow bottom-right.
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, r - 2, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.arc(x, y, r - 2, Math.PI * 0.1, Math.PI * 0.6); ctx.stroke();
  }

  /* =====================================================================
   * 7. tread — 256x256 tank track link pattern, tiles vertically.
   * ===================================================================== */
  TS.Tex.tread = function (opts) {
    opts = opts || {};
    var S = 256;
    var c = makeCanvas(S, S);
    var ctx = g2d(c);
    var rng = makeRng(opts);
    var links = Math.max(1, gopt(opts, 'links', 4));
    var band = S / links;

    ctx.fillStyle = '#151614';
    ctx.fillRect(0, 0, S, S);

    // Identical link per band => periodic => seamless vertical tiling.
    for (var L = 0; L < links; L++) {
      drawTrackLink(ctx, rng, L * band, band, S);
    }

    // Greasy sheen.
    var sheen = ctx.createLinearGradient(0, 0, S, S);
    sheen.addColorStop(0, 'rgba(120,130,120,0.10)');
    sheen.addColorStop(0.5, 'rgba(0,0,0,0.10)');
    sheen.addColorStop(1, 'rgba(150,160,140,0.12)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, S, S);

    return c;
  };

  function drawTrackLink(ctx, rng, y0, band, S) {
    var pad = 3;
    var top = y0 + pad;
    var h = band - pad * 2;

    ctx.fillStyle = '#101210';
    ctx.fillRect(0, y0, S, band);

    var g = ctx.createLinearGradient(0, top, 0, top + h);
    g.addColorStop(0, '#575b57');
    g.addColorStop(0.45, '#3c3f3b');
    g.addColorStop(1, '#232522');
    ctx.fillStyle = g;
    ctx.fillRect(0, top, S, h);

    // End plates with pin holes.
    var padW = S * 0.2;
    var eg = ctx.createLinearGradient(0, top, 0, top + h);
    eg.addColorStop(0, '#61655f');
    eg.addColorStop(1, '#2e312d');
    ctx.fillStyle = eg;
    ctx.fillRect(0, top, padW, h);
    ctx.fillRect(S - padW, top, padW, h);
    drawPin(ctx, padW * 0.3, top + h / 2, h * 0.18);
    drawPin(ctx, padW * 0.7, top + h / 2, h * 0.18);
    drawPin(ctx, S - padW * 0.3, top + h / 2, h * 0.18);
    drawPin(ctx, S - padW * 0.7, top + h / 2, h * 0.18);

    // Centre grouser ridge.
    var ridge = S * 0.5;
    var rg = ctx.createLinearGradient(0, top + 2, 0, top + h - 2);
    rg.addColorStop(0, '#6f746d');
    rg.addColorStop(0.5, '#2f322e');
    rg.addColorStop(1, '#555a54');
    ctx.fillStyle = rg;
    ctx.fillRect(S * 0.5 - ridge / 2, top + 2, ridge, h - 4);

    // Cross ribs.
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1.5;
    for (var k = 0; k < 4; k++) {
      var x = S * (k + 0.5) / 4;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, top + h);
      ctx.stroke();
    }

    // Wear scratches.
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    for (var s = 0; s < 8; s++) {
      var sx = rand(rng, 0, S);
      ctx.beginPath();
      ctx.moveTo(sx, top + 1);
      ctx.lineTo(sx + rand(rng, -20, 20), top + h - 1);
      ctx.stroke();
    }
  }

  function drawPin(ctx, x, y, r) {
    ctx.fillStyle = '#050605';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(160,170,160,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, r - 1, 0, Math.PI * 2); ctx.stroke();
  }

  /* =====================================================================
   * 8. radial — 128x128 soft particle sprite.
   * ===================================================================== */
  TS.Tex.radial = function (opts) {
    opts = opts || {};
    var S = 128;
    var c = makeCanvas(S, S);
    var ctx = g2d(c);
    var col = gopt(opts, 'color', '#ffffff');
    var hardness = clamp(gopt(opts, 'hardness', 0.35), 0.03, 1);
    var cx = S / 2;

    var g = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
    g.addColorStop(0, rgba(col, 1));
    if (hardness > 0.001 && hardness < 0.999) {
      g.addColorStop(hardness, rgba(col, 1));
    }
    g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);

    return c;
  };

  /* =====================================================================
   * 9. reticle — 512x512 gunner's sight (black on transparent).
   * ===================================================================== */
  TS.Tex.reticle = function (opts) {
    opts = opts || {};
    var S = 512;
    var c = makeCanvas(S, S);
    var ctx = g2d(c);
    makeRng(opts);
    var cx = S / 2, cy = S / 2;
    var R = Math.round(0.3 * S);
    var gap = 8;

    ctx.strokeStyle = '#000000';
    ctx.fillStyle = '#000000';
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.5;

    // Fine aiming circle.
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();

    // Short ticks on the circle at cardinal points.
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy - R - 8); ctx.lineTo(cx, cy - R + 6);
    ctx.moveTo(cx, cy + R - 6); ctx.lineTo(cx, cy + R + 8);
    ctx.moveTo(cx - R - 8, cy); ctx.lineTo(cx - R + 6, cy);
    ctx.moveTo(cx + R - 6, cy); ctx.lineTo(cx + R + 8, cy);
    ctx.stroke();

    // Central cross with a gap.
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - gap - R, cy); ctx.lineTo(cx - gap, cy);
    ctx.moveTo(cx + gap, cy); ctx.lineTo(cx + gap + R, cy);
    ctx.moveTo(cx, cy - gap - R); ctx.lineTo(cx, cy - gap);
    ctx.moveTo(cx, cy + gap); ctx.lineTo(cx, cy + gap + R);
    ctx.stroke();

    // Stadiametric range ladder (vertical, below centre).
    ctx.font = '12px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 1.2;
    var labels = [4, 8, 12, 16, 20];
    var yStep = 34;
    var ladderTop = cy + 60;
    for (var i = 0; i < labels.length; i++) {
      var y = ladderTop + i * yStep;
      ctx.beginPath();
      ctx.moveTo(cx - 14, y); ctx.lineTo(cx + 24, y);
      ctx.stroke();
      ctx.fillText(String(labels[i]), cx + 30, y);
    }
    // Ladder baseline.
    ctx.beginPath();
    ctx.moveTo(cx, cy + 48);
    ctx.lineTo(cx, ladderTop + labels.length * yStep - 10);
    ctx.stroke();

    // Horizontal mil-lead marks with numbers.
    var mils = [10, 20, 30, 40];
    var xStep = 44;
    ctx.lineWidth = 1.2;
    for (var j = 0; j < mils.length; j++) {
      var xr = cx + 70 + j * xStep;
      var xl = cx - 70 - j * xStep;
      ctx.beginPath();
      ctx.moveTo(xr, cy - 8); ctx.lineTo(xr, cy + 8);
      ctx.moveTo(xl, cy - 8); ctx.lineTo(xl, cy + 8);
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(String(mils[j]), xr, cy + 12);
      ctx.fillText(String(mils[j]), xl, cy + 12);
    }

    return c;
  };

  /* =====================================================================
   * 10. screen — 256x256 radio set dial face.
   * ===================================================================== */
  TS.Tex.screen = function (opts) {
    opts = opts || {};
    var S = 256;
    var c = makeCanvas(S, S);
    var ctx = g2d(c);
    var rng = makeRng(opts);
    var cx = S / 2, cy = S / 2 + 8;

    // Warm amber illuminated backing.
    var g = ctx.createRadialGradient(cx, cy, 15, cx, cy, 150);
    g.addColorStop(0, '#f0b04a');
    g.addColorStop(0.45, '#c8791f');
    g.addColorStop(0.8, '#6b3a0c');
    g.addColorStop(1, '#241204');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);

    // Subtle bakelite grain.
    ctx.globalAlpha = 0.05;
    for (var i = 0; i < 500; i++) {
      ctx.fillStyle = (rng() < 0.5) ? '#000000' : '#ffffff';
      ctx.fillRect(rand(rng, 0, S), rand(rng, 0, S), 1, 1);
    }
    ctx.globalAlpha = 1;

    var ink = '#3a1c04';
    var a0 = -205, a1 = -335;

    // Frequency scale band.
    ctx.lineWidth = 26;
    ctx.strokeStyle = 'rgba(30,12,2,0.55)';
    ctx.beginPath(); drawArc(ctx, cx, cy, 92, a0, a1); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(20,8,2,0.8)';
    ctx.beginPath(); drawArc(ctx, cx, cy, 79, a0, a1); ctx.stroke();
    ctx.beginPath(); drawArc(ctx, cx, cy, 105, a0, a1); ctx.stroke();

    // Frequency ticks and numbers.
    var freqs = [1.5, 2, 3, 4, 5, 6, 8, 10, 12];
    var fmin = 1.5, fmax = 12;
    ctx.fillStyle = ink;
    ctx.strokeStyle = ink;
    ctx.font = '11px "Arial Narrow", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var f = 0; f < freqs.length; f++) {
      var t = (freqs[f] - fmin) / (fmax - fmin);
      var a = a0 + (a1 - a0) * t;
      var pIn = anglePoint(cx, cy, 92, a);
      var pOut = anglePoint(cx, cy, 104, a);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(pIn.x, pIn.y); ctx.lineTo(pOut.x, pOut.y); ctx.stroke();
      var pLab = anglePoint(cx, cy, 66, a);
      ctx.fillText(fmtNum(freqs[f]), pLab.x, pLab.y);
    }

    // RADIO title + MHz.
    var ts = fitText(ctx, 'RADIO', 30, '"Arial Narrow", Arial, sans-serif', 120);
    ctx.font = '700 ' + ts + 'px "Arial Narrow", Arial, sans-serif';
    ctx.fillStyle = '#f6d9a0';
    ctx.fillText('RADIO', cx, cy + 46);
    ctx.font = '12px "Arial Narrow", Arial, sans-serif';
    ctx.fillStyle = '#f0b04a';
    ctx.fillText('MHz', cx, cy + 68);

    // Glass reflection.
    var gl = ctx.createLinearGradient(0, 0, S, S);
    gl.addColorStop(0, 'rgba(255,255,255,0.18)');
    gl.addColorStop(0.25, 'rgba(255,255,255,0.03)');
    gl.addColorStop(0.6, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(S * 0.55, 0);
    ctx.lineTo(S * 0.2, S);
    ctx.lineTo(0, S);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 3;
    ctx.beginPath(); drawArc(ctx, cx, cy, 120, -235, -305); ctx.stroke();

    return c;
  };

  /* =====================================================================
   * 11. warn — 256x64 warning lamp lens face.
   * ===================================================================== */
  TS.Tex.warn = function (text, opts) {
    opts = opts || {};
    var S = 256, H = 64;
    var c = makeCanvas(S, H);
    var ctx = g2d(c);
    makeRng(opts);
    var col = gopt(opts, 'color', '#c02020');
    var txt = String(text || '').toUpperCase();

    // Translucent lens with centre bulb glow.
    var g = ctx.createRadialGradient(S / 2, H / 2, 4, S / 2, H / 2, S / 2);
    g.addColorStop(0, shade(col, 1.6));
    g.addColorStop(0.4, col);
    g.addColorStop(1, shade(col, 0.5));
    roundRectPath(ctx, 2, 2, S - 4, H - 4, 12);
    ctx.fillStyle = g;
    ctx.fill();

    // Bevel border.
    ctx.strokeStyle = shade(col, 0.35);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    roundRectPath(ctx, 4, 4, S - 8, H - 8, 10);
    ctx.stroke();

    // Extra soft bulb glow.
    var glow = ctx.createRadialGradient(S / 2, H / 2, 2, S / 2, H / 2, S * 0.5);
    glow.addColorStop(0, 'rgba(255,220,180,0.5)');
    glow.addColorStop(1, 'rgba(255,220,180,0)');
    roundRectPath(ctx, 2, 2, S - 4, H - 4, 12);
    ctx.fillStyle = glow;
    ctx.fill();

    // Dark stencil text.
    ctx.fillStyle = 'rgba(30,8,6,0.85)';
    var ts = fitText(ctx, txt, 30, '"Arial Narrow", Arial, sans-serif', S - 30);
    ctx.font = '700 ' + ts + 'px "Arial Narrow", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, S / 2, H / 2 + 1);

    // Glass highlight upper-left.
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.ellipse(S * 0.28, H * 0.3, S * 0.16, H * 0.12, -0.4, 0, Math.PI * 2);
    ctx.fill();

    return c;
  };

  /* =====================================================================
   * 12. wood — 256x256 ammo-rack wooden batten / crate wood.
   * ===================================================================== */
  TS.Tex.wood = function (opts) {
    opts = opts || {};
    var S = 256;
    var c = makeCanvas(S, S);
    var ctx = g2d(c);
    var rng = makeRng(opts);
    var base = gopt(opts, 'color', '#8a6b43');

    var g = ctx.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, shade(base, 1.08));
    g.addColorStop(1, shade(base, 0.9));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);

    // Wavy grain lines.
    var shades = [shade(base, 0.7), shade(base, 0.82), shade(base, 1.15), shade(base, 1.05)];
    for (var i = 0; i < 70; i++) {
      var y = rand(rng, 0, S);
      var amp = rand(rng, 1, 5);
      ctx.strokeStyle = rgba(pick(rng, shades), rand(rng, 0.15, 0.4));
      ctx.lineWidth = rand(rng, 0.5, 1.5);
      ctx.beginPath();
      var px = 0, py = y;
      ctx.moveTo(px, py);
      var segs = irand(rng, 4, 8);
      var segW = S / segs;
      for (var sIdx = 1; sIdx <= segs; sIdx++) {
        var nx = sIdx * segW;
        var ny = y + rand(rng, -amp, amp);
        ctx.quadraticCurveTo((px + nx) / 2, py + rand(rng, -amp, amp), nx, ny);
        px = nx; py = ny;
      }
      ctx.stroke();
    }

    // Knots.
    for (var k = 0; k < 3; k++) {
      var kx = rand(rng, 30, S - 30), ky = rand(rng, 30, S - 30);
      var kr = rand(rng, 5, 12);
      for (var ring = 3; ring >= 1; ring--) {
        ctx.strokeStyle = rgba(shade(base, ring === 3 ? 0.6 : 0.75), 0.5);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(kx, ky, kr * ring / 3, kr * ring / 3 * 0.6, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = rgba(shade(base, 0.5), 0.5);
      ctx.beginPath(); ctx.ellipse(kx, ky, 2, 3, 0, 0, Math.PI * 2); ctx.fill();
    }

    // Subtle dirt.
    for (var d = 0; d < 12; d++) {
      softBlob(ctx, rng, rand(rng, 0, S), rand(rng, 0, S),
        rand(rng, 6, 20), '#4a3a28', 0.25);
    }

    return c;
  };

  /* =====================================================================
   * 13. canvasFabric — 256x256 woven canvas / webbing strap.
   * ===================================================================== */
  TS.Tex.canvasFabric = function (opts) {
    opts = opts || {};
    var S = 256;
    var c = makeCanvas(S, S);
    var ctx = g2d(c);
    var rng = makeRng(opts);
    var base = gopt(opts, 'color', '#7a6b4f');

    ctx.fillStyle = base;
    ctx.fillRect(0, 0, S, S);

    var pitch = 8;

    // Over-under weave shading.
    for (var gy = 0; gy < S; gy += pitch) {
      for (var gx = 0; gx < S; gx += pitch) {
        var cell = ((gx / pitch) + (gy / pitch)) % 2;
        ctx.fillStyle = cell ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
        ctx.fillRect(gx, gy, pitch, pitch);
      }
    }

    // Horizontal threads.
    for (var y = 0; y <= S; y += pitch) {
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(0, y, S, 1.5);
      ctx.fillStyle = 'rgba(0,0,0,0.14)';
      ctx.fillRect(0, y + 1.5, S, 1);
    }
    // Vertical threads.
    for (var x = 0; x <= S; x += pitch) {
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      ctx.fillRect(x, 0, 1.5, S);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(x + 1.5, 0, 1, S);
    }

    // Thread speckle.
    for (var s = 0; s < 2000; s++) {
      ctx.fillStyle = (rng() < 0.5) ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
      ctx.fillRect(rand(rng, 0, S), rand(rng, 0, S), 1, 1);
    }

    // Dirt.
    for (var d = 0; d < 25; d++) {
      softBlob(ctx, rng, rand(rng, 0, S), rand(rng, 0, S),
        rand(rng, 4, 16), '#4a3a28', 0.35);
    }

    return c;
  };

  /* =====================================================================
   * 14. get — keyed cache.
   * ===================================================================== */
  var _cache = {};

  TS.Tex.get = function (key, factoryFn) {
    key = (key === undefined || key === null) ? '__default' : String(key);
    if (!Object.prototype.hasOwnProperty.call(_cache, key)) {
      var fn = (typeof factoryFn === 'function') ? factoryFn : function () { return makeCanvas(2, 2); };
      _cache[key] = fn();
    }
    return _cache[key];
  };

  /* =====================================================================
   * Public surface.
   * ===================================================================== */
  TS.Tex = {
    gauge: TS.Tex.gauge,
    label: TS.Tex.label,
    panel: TS.Tex.panel,
    metal: TS.Tex.metal,
    camo: TS.Tex.camo,
    rivetPlate: TS.Tex.rivetPlate,
    tread: TS.Tex.tread,
    radial: TS.Tex.radial,
    reticle: TS.Tex.reticle,
    screen: TS.Tex.screen,
    warn: TS.Tex.warn,
    wood: TS.Tex.wood,
    canvasFabric: TS.Tex.canvasFabric,
    get: TS.Tex.get
  };
})();
