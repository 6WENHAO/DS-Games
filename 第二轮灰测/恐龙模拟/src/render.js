/* ============ 渲染：地形 / 恐龙 / 特效 / 天气 / 昼夜 ============ */
(function (D) {
  "use strict";
  var U = D.util;
  var TAU = U.TAU;

  /* ---------------- 粒子系统 ---------------- */
  function FX() { this.list = []; this.cap = 420; }
  var F = FX.prototype;

  F.add = function (p) { if (this.list.length < this.cap) this.list.push(p); };
  F.clear = function () { this.list.length = 0; };

  F.spray = function (x, y, n, opt) {
    for (var i = 0; i < n; i++) {
      var a = opt.ang != null ? opt.ang + (Math.random() - 0.5) * (opt.spread || TAU) : Math.random() * TAU;
      var s = (opt.sp || 60) * (0.4 + Math.random() * 0.9);
      this.add({
        t: "dot", x: x, y: y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - (opt.up || 0),
        g: opt.g == null ? 220 : opt.g,
        r: (opt.r || 3) * (0.6 + Math.random() * 0.8),
        life: (opt.life || 0.5) * (0.6 + Math.random() * 0.8),
        max: 1, col: opt.col || "#fff", fade: opt.fade !== false, shrink: opt.shrink !== false
      });
      var p = this.list[this.list.length - 1];
      if (p) p.max = p.life;
    }
  };

  F.blood = function (x, y, r, n) { this.spray(x, y, n || 8, { col: "#b6262a", r: r * 0.1 + 1.5, sp: 90, up: 40, life: 0.5 }); };
  F.dust = function (x, y, r) { this.spray(x, y, 3, { col: "rgba(214,200,164,0.75)", r: r * 0.12 + 2, sp: 26, up: 6, g: 30, life: 0.5 }); };
  F.leaf = function (x, y) { this.spray(x, y, 3, { col: "#6fae4a", r: 2.5, sp: 40, up: 30, g: 90, life: 0.7 }); };
  F.splash = function (x, y, r) { this.spray(x, y, 5, { col: "rgba(180,225,245,0.9)", r: r * 0.1 + 2, sp: 60, up: 55, g: 260, life: 0.4 }); };
  F.spark = function (x, y, n, col) { this.spray(x, y, n || 8, { col: col || "#ffd257", r: 2.4, sp: 150, up: 60, g: 160, life: 0.5 }); };
  F.ember = function (x, y) { this.spray(x, y, 1, { col: "#ff9e3d", r: 3, sp: 18, up: 46, g: -30, life: 0.9 }); };

  F.text = function (x, y, str, col) {
    this.add({ t: "text", x: x, y: y, vx: (Math.random() - 0.5) * 12, vy: -46, g: 26, str: str, col: col || "#fff", life: 0.85, max: 0.85, r: 0 });
  };
  F.ring = function (x, y, r0, r1, col, life) {
    this.add({ t: "ring", x: x, y: y, vx: 0, vy: 0, g: 0, r: r0, r1: r1, col: col || "rgba(255,255,255,0.5)", life: life || 0.6, max: life || 0.6 });
  };
  F.slash = function (x, y, ang, r, col) {
    this.add({ t: "slash", x: x, y: y, ang: ang, r: r, col: col || "rgba(255,255,255,0.55)", vx: 0, vy: 0, g: 0, life: 0.22, max: 0.22 });
  };

  F.update = function (dt) {
    var l = this.list, j = 0;
    for (var i = 0; i < l.length; i++) {
      var p = l[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += p.g * dt;
      if (p.t === "dot") { p.vx *= 0.985; }
      l[j++] = p;
    }
    l.length = j;
  };

  F.draw = function (ctx, zoom) {
    var l = this.list;
    for (var i = 0; i < l.length; i++) {
      var p = l[i], k = Math.max(0, p.life / p.max);
      if (p.t === "dot") {
        ctx.globalAlpha = p.fade === false ? 1 : k;
        ctx.fillStyle = p.col;
        var r = p.shrink === false ? p.r : p.r * (0.35 + k * 0.65);
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
      } else if (p.t === "text") {
        ctx.globalAlpha = Math.min(1, k * 1.6);
        ctx.fillStyle = p.col;
        ctx.font = "700 " + Math.round(13 / zoom) + "px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(p.str, p.x, p.y);
      } else if (p.t === "ring") {
        ctx.globalAlpha = k * 0.8;
        ctx.strokeStyle = p.col;
        ctx.lineWidth = 3 / zoom + 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, U.lerp(p.r1, p.r, k), 0, TAU); ctx.stroke();
      } else if (p.t === "slash") {
        ctx.globalAlpha = k;
        ctx.strokeStyle = p.col;
        ctx.lineWidth = 4 + 3 * k;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, p.ang - 0.75, p.ang + 0.75);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  };

  /* ---------------- 恐龙绘制 ---------------- */
  function limb(ctx, x, y, a1, l1, a2, l2, w, col, footCol) {
    var kx = x + Math.cos(a1) * l1, ky = y + Math.sin(a1) * l1;
    var fx = kx + Math.cos(a2) * l2, fy = ky + Math.sin(a2) * l2;
    ctx.strokeStyle = col;
    ctx.lineCap = "round";
    ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(kx, ky); ctx.stroke();
    ctx.lineWidth = w * 0.78;
    ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
    ctx.fillStyle = footCol || col;
    ctx.beginPath(); ctx.ellipse(fx + w * 0.22, fy, w * 0.62, w * 0.34, 0, 0, TAU); ctx.fill();
    return { fx: fx, fy: fy };
  }

  function tailShape(ctx, R, len, wag, col, art) {
    var segs = 5, w0 = R * 0.62;
    var px = -R * 0.85, py = -R * 0.05;
    ctx.strokeStyle = col;
    ctx.lineCap = "round";
    for (var i = 0; i < segs; i++) {
      var t = i / segs;
      var a = Math.PI + Math.sin(wag + i * 0.5) * 0.2 + t * 0.12;
      var seg = R * 0.5 * len;
      var nx = px + Math.cos(a) * seg, ny = py + Math.sin(a) * seg - t * R * 0.08;
      ctx.lineWidth = w0 * (1 - t * 0.82);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.stroke();
      px = nx; py = ny;
    }
    if (art.spikeTail) {
      ctx.fillStyle = "#efe6cf";
      for (var s = 0; s < 2; s++) {
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px - R * 0.5, py - R * (0.42 + s * 0.3));
        ctx.lineTo(px + R * 0.1, py - R * 0.12);
        ctx.closePath(); ctx.fill();
      }
    }
    if (art.clubTail) {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(px - R * 0.1, py, R * 0.34, 0, TAU); ctx.fill();
      ctx.fillStyle = "#efe6cf";
      ctx.beginPath(); ctx.arc(px - R * 0.3, py - R * 0.15, R * 0.09, 0, TAU); ctx.fill();
    }
    return { x: px, y: py };
  }

  function head(ctx, R, col, art, jaw, dead) {
    var big = art.bigHead || 1;
    var L = R * 0.92 * (art.headLong || 1) * big;
    var H = R * 0.46 * big;

    // 上颌 + 头骨
    ctx.fillStyle = col.body;
    ctx.beginPath();
    ctx.moveTo(-H * 0.7, -H * 0.45);
    ctx.quadraticCurveTo(L * 0.45, -H * 1.05, L, -H * 0.1);
    ctx.quadraticCurveTo(L * 0.98, H * 0.2, L * 0.55, H * 0.22);
    ctx.quadraticCurveTo(0, H * 0.6, -H * 0.7, H * 0.6);
    ctx.closePath(); ctx.fill();

    if (art.teeth) {
      ctx.fillStyle = "#fff6e2";
      for (var i = 0; i < 3; i++) {
        var tx = L * (0.42 + i * 0.19);
        ctx.beginPath();
        ctx.moveTo(tx, H * 0.16);
        ctx.lineTo(tx + H * 0.14, H * 0.16);
        ctx.lineTo(tx + H * 0.06, H * 0.16 + H * 0.32);
        ctx.closePath(); ctx.fill();
      }
    }

    // 下颌
    ctx.save();
    ctx.translate(-H * 0.3, H * 0.15);
    ctx.rotate(jaw * 0.55);
    ctx.fillStyle = col.accent;
    ctx.beginPath();
    ctx.moveTo(0, -H * 0.05);
    ctx.quadraticCurveTo(L * 0.7, H * 0.02, L * 0.95, H * 0.16);
    ctx.quadraticCurveTo(L * 0.4, H * 0.5, 0, H * 0.42);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    if (art.crest) {
      ctx.fillStyle = col.accent;
      ctx.beginPath();
      ctx.moveTo(-H * 0.2, -H * 0.5);
      ctx.quadraticCurveTo(-L * 0.9, -H * 1.9, -L * 1.35, -H * 1.1);
      ctx.quadraticCurveTo(-L * 0.7, -H * 0.85, -H * 0.4, -H * 0.2);
      ctx.closePath(); ctx.fill();
    }
    if (art.horns) {
      ctx.fillStyle = "#f0e6cd";
      ctx.beginPath();
      ctx.moveTo(L * 0.3, -H * 0.75);
      ctx.lineTo(L * 1.15, -H * 1.6);
      ctx.lineTo(L * 0.5, -H * 0.35);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(L * 0.62, -H * 0.35);
      ctx.lineTo(L * 1.3, -H * 0.55);
      ctx.lineTo(L * 0.7, -H * 0.02);
      ctx.closePath(); ctx.fill();
    }

    // 眼睛
    var ex = L * 0.3, ey = -H * 0.45;
    ctx.fillStyle = dead ? "#3b3b3b" : col.eye;
    ctx.beginPath(); ctx.arc(ex, ey, H * 0.24, 0, TAU); ctx.fill();
    if (!dead) {
      ctx.fillStyle = "#1a1208";
      ctx.beginPath(); ctx.arc(ex + H * 0.06, ey, H * 0.12, 0, TAU); ctx.fill();
    } else {
      ctx.strokeStyle = "#1a1208"; ctx.lineWidth = H * 0.1;
      ctx.beginPath();
      ctx.moveTo(ex - H * 0.16, ey - H * 0.16); ctx.lineTo(ex + H * 0.16, ey + H * 0.16);
      ctx.moveTo(ex + H * 0.16, ey - H * 0.16); ctx.lineTo(ex - H * 0.16, ey + H * 0.16);
      ctx.stroke();
    }
    // 鼻孔
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath(); ctx.arc(L * 0.82, -H * 0.3, H * 0.07, 0, TAU); ctx.fill();
  }

  function dino(ctx, c, time) {
    var d = c.def, art = d.art || {}, col = d.colors;
    var R = c.radius;
    var quad = (art.legs || 2) === 4;
    var flip = Math.cos(c.face) < 0 ? -1 : 1;
    var fore = 0.74 + 0.26 * Math.abs(Math.cos(c.face));
    var spd = Math.min(1, c.speedNow / Math.max(50, c.speed * 0.9));
    var ph = c.phase * 2.5;
    var bob = c.dead ? 0 : Math.abs(Math.sin(ph)) * R * 0.06 * spd;
    var lunge = c.atkAnim > 0 ? Math.sin((1 - c.atkAnim / 0.3) * Math.PI) : 0;
    var jaw = c.dead ? 0.35 : Math.max(lunge * 0.9, c.eatT > 0 ? 0.35 + Math.sin(time * 22) * 0.25 : 0, c.roarT > 0 ? 0.8 : 0);

    // 影子
    ctx.globalAlpha = c.dead ? 0.18 : 0.28;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(0, R * 0.62, R * 1.5 * fore, R * 0.42, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.scale(flip * fore, 1);
    ctx.translate(lunge * R * 0.3, -bob);
    if (c.dead) {
      ctx.translate(0, R * 0.45);
      ctx.rotate(1.15);
      ctx.globalAlpha = Math.max(0.25, Math.min(1, c.decay / 22));
    }
    if (!quad) ctx.rotate(-0.1 - lunge * 0.12);

    var bodyTop = col.body, bodyLow = col.accent;
    var legCol = U.shade(col.accent, -14);

    // 尾巴
    tailShape(ctx, R, art.tail || 1, c.phase * 2.2 * (0.4 + spd), bodyLow, art);

    // 后腿（远侧）
    var hipX = quad ? -R * 0.55 : -R * 0.18, hipY = R * 0.18;
    var sw = Math.sin(ph) * 0.7 * spd, sw2 = Math.sin(ph + Math.PI) * 0.7 * spd;
    var legLen = R * (quad ? 0.52 : 0.62);
    limb(ctx, hipX - R * 0.1, hipY, 1.5 + sw2 * 0.6, legLen, 1.55 - sw2 * 0.5, legLen * 0.95, R * 0.24, legCol);
    if (quad) limb(ctx, R * 0.5, hipY, 1.55 + sw * 0.55, legLen * 0.92, 1.6 - sw * 0.45, legLen * 0.85, R * 0.2, legCol);

    // 躯干
    var grad = ctx.createLinearGradient(0, -R * 0.9, 0, R * 0.7);
    grad.addColorStop(0, bodyTop);
    grad.addColorStop(1, col.belly);
    ctx.fillStyle = grad;
    ctx.beginPath();
    if (quad) ctx.ellipse(0, 0, R * 1.24, R * 0.72, 0, 0, TAU);
    else ctx.ellipse(0, 0, R * 1.05, R * 0.78, -0.12, 0, TAU);
    ctx.fill();

    if (art.scutes || art.armor) {
      ctx.fillStyle = "rgba(0,0,0,0.16)";
      for (var s = 0; s < 5; s++) {
        var sx = -R * 0.8 + s * R * 0.42;
        ctx.beginPath(); ctx.ellipse(sx, -R * (quad ? 0.55 : 0.6) + Math.abs(s - 2) * R * 0.05, R * 0.16, R * 0.1, 0, 0, TAU); ctx.fill();
      }
    }
    if (art.stripes) {
      ctx.strokeStyle = "rgba(0,0,0,0.2)";
      ctx.lineWidth = R * 0.13;
      for (var st = 0; st < 3; st++) {
        ctx.beginPath();
        ctx.arc(-R * 0.5 + st * R * 0.48, -R * 0.1, R * 0.55, -1.9, -0.6);
        ctx.stroke();
      }
    }
    if (art.plates) {
      ctx.fillStyle = U.shade(col.accent, 40);
      for (var pl = 0; pl < 6; pl++) {
        var t = pl / 5;
        var px = -R * 0.95 + t * R * 1.9;
        var hgt = R * (0.36 + Math.sin(t * Math.PI) * 0.46);
        ctx.beginPath();
        ctx.moveTo(px - R * 0.16, -R * 0.6);
        ctx.quadraticCurveTo(px, -R * 0.6 - hgt, px + R * 0.16, -R * 0.6);
        ctx.closePath(); ctx.fill();
      }
    }
    if (art.sail) {
      ctx.fillStyle = U.shade(col.accent, 26);
      ctx.beginPath();
      ctx.moveTo(-R * 1.0, -R * 0.5);
      ctx.quadraticCurveTo(-R * 0.2, -R * 2.5, R * 0.85, -R * 0.45);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.22)"; ctx.lineWidth = R * 0.05;
      for (var q = 0; q < 5; q++) {
        var qx = -R * 0.8 + q * R * 0.38;
        ctx.beginPath(); ctx.moveTo(qx, -R * 0.5); ctx.lineTo(qx * 0.55, -R * (1.05 + Math.sin(q / 4 * Math.PI) * 0.9)); ctx.stroke();
      }
    }
    if (art.feathers) {
      ctx.strokeStyle = U.shade(col.body, 34);
      ctx.lineWidth = R * 0.09;
      for (var fe = 0; fe < 4; fe++) {
        var fx0 = -R * 0.7 + fe * R * 0.4;
        ctx.beginPath();
        ctx.moveTo(fx0, -R * 0.55);
        ctx.lineTo(fx0 - R * 0.26, -R * (0.95 + 0.12 * Math.sin(time * 3 + fe)));
        ctx.stroke();
      }
    }

    if (art.lava) {
      ctx.strokeStyle = "rgba(255,140,40,0.85)";
      ctx.lineWidth = R * 0.1;
      for (var lv = 0; lv < 4; lv++) {
        var lx = -R * 0.8 + lv * R * 0.5;
        ctx.beginPath();
        ctx.moveTo(lx, -R * 0.5);
        ctx.lineTo(lx + R * 0.16, -R * 0.05 + Math.sin(time * 4 + lv) * R * 0.05);
        ctx.lineTo(lx - R * 0.1, R * 0.42);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(255,110,20,0.25)";
      ctx.beginPath(); ctx.ellipse(0, 0, R * 1.15, R * 0.85, 0, 0, TAU); ctx.fill();
    }
    if (art.ghost) {
      ctx.fillStyle = "rgba(170,200,255,0.3)";
      ctx.beginPath(); ctx.ellipse(0, 0, R * 1.2, R * 0.9, 0, 0, TAU); ctx.fill();
    }

    // 脖子与头
    var neckX = quad ? R * 1.0 : R * 0.72;
    var neckY = quad ? -R * 0.32 : -R * 0.5;
    var nl = R * (art.neckLong || 1) * (quad ? 0.62 : 0.55);
    var headX = neckX + nl * (quad ? 0.85 : 0.6);
    var headY = neckY - nl * (quad ? 0.5 : 0.85) - lunge * R * 0.05;

    ctx.strokeStyle = bodyTop;
    ctx.lineCap = "round";
    ctx.lineWidth = R * 0.44;
    ctx.beginPath();
    ctx.moveTo(neckX - R * 0.2, neckY + R * 0.28);
    ctx.quadraticCurveTo(neckX + nl * 0.3, neckY - nl * 0.2, headX, headY);
    ctx.stroke();

    if (art.frill) {
      ctx.fillStyle = U.shade(col.body, -22);
      ctx.beginPath();
      ctx.ellipse(headX - R * 0.28, headY + R * 0.05, R * 0.5, R * 0.62, -0.25, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.18)"; ctx.lineWidth = R * 0.05;
      ctx.beginPath(); ctx.ellipse(headX - R * 0.28, headY + R * 0.05, R * 0.34, R * 0.44, -0.25, 0, TAU); ctx.stroke();
    }

    ctx.save();
    ctx.translate(headX, headY);
    ctx.rotate(quad ? 0.24 : 0.1 + lunge * 0.1);
    head(ctx, R, col, art, jaw, c.dead);
    ctx.restore();

    // 前肢
    if (!quad) {
      if (art.arms === "tiny") {
        ctx.strokeStyle = legCol; ctx.lineWidth = R * 0.11;
        ctx.beginPath();
        ctx.moveTo(R * 0.55, -R * 0.05);
        ctx.lineTo(R * 0.85, R * 0.18);
        ctx.stroke();
      } else if (art.arms) {
        ctx.strokeStyle = legCol; ctx.lineWidth = R * 0.14;
        ctx.beginPath();
        ctx.moveTo(R * 0.5, -R * 0.02);
        ctx.lineTo(R * 0.78, R * 0.2 + Math.sin(ph) * R * 0.1);
        ctx.lineTo(R * 1.0, R * 0.1 + Math.sin(ph) * R * 0.1);
        ctx.stroke();
      }
    } else {
      limb(ctx, R * 0.72, hipY, 1.5 + sw * 0.5, legLen * 0.9, 1.55 - sw * 0.4, legLen * 0.8, R * 0.21, U.shade(col.accent, 6));
    }

    // 近侧后腿
    limb(ctx, hipX + R * 0.12, hipY, 1.5 + sw * 0.7, legLen, 1.5 - sw * 0.55, legLen, R * 0.27, col.accent);

    // 受击闪白
    if (c.hurtT > 0) {
      ctx.globalAlpha = Math.min(0.7, c.hurtT * 2.2);
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.ellipse(0, 0, R * 1.35, R * 0.95, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  /* ---------------- 场景道具 ---------------- */
  function prop(ctx, p, time, light) {
    var sway = Math.sin(time * 0.9 + p.seed) * (p.kind === "tree" ? 2.2 : 1.2);
    if (p.kind === "tree") {
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = "#000";
      ctx.beginPath(); ctx.ellipse(p.x + 3, p.y + p.r * 0.18, p.r * 0.8, p.r * 0.26, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#5a4126"; ctx.lineWidth = p.r * 0.2; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + sway * 0.4, p.y - p.r * 0.9); ctx.stroke();
      if (p.kindOf === "conifer") {
        ctx.fillStyle = "#1f5c33";
        for (var i = 0; i < 3; i++) {
          var w = p.r * (0.95 - i * 0.22), yy = p.y - p.r * (0.75 + i * 0.55);
          ctx.beginPath();
          ctx.moveTo(p.x + sway * 0.6 - w, yy);
          ctx.lineTo(p.x + sway * 0.6, yy - p.r * 0.95);
          ctx.lineTo(p.x + sway * 0.6 + w, yy);
          ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = "rgba(120,190,120,0.25)";
        ctx.beginPath(); ctx.arc(p.x + sway * 0.6 - p.r * 0.2, p.y - p.r * 1.7, p.r * 0.3, 0, TAU); ctx.fill();
      } else {
        var cx = p.x + sway, cy = p.y - p.r * 1.15;
        ctx.fillStyle = "#2c6b34";
        ctx.beginPath(); ctx.arc(cx - p.r * 0.42, cy + p.r * 0.16, p.r * 0.6, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + p.r * 0.44, cy + p.r * 0.1, p.r * 0.56, 0, TAU); ctx.fill();
        ctx.fillStyle = "#3d8a42";
        ctx.beginPath(); ctx.arc(cx, cy - p.r * 0.22, p.r * 0.72, 0, TAU); ctx.fill();
        ctx.fillStyle = "rgba(150,210,140,0.32)";
        ctx.beginPath(); ctx.arc(cx - p.r * 0.24, cy - p.r * 0.44, p.r * 0.34, 0, TAU); ctx.fill();
      }
    } else if (p.kind === "fern") {
      var k = Math.max(0.25, p.food / p.max);
      ctx.strokeStyle = k > 0.5 ? "#57a83f" : "#7c8a3a";
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(1.4, p.r * 0.14);
      for (var f = 0; f < 5; f++) {
        var a = -Math.PI / 2 + (f - 2) * 0.4 + sway * 0.02;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.quadraticCurveTo(
          p.x + Math.cos(a) * p.r * 0.5, p.y + Math.sin(a) * p.r * 0.8 * k,
          p.x + Math.cos(a) * p.r * 1.1, p.y + Math.sin(a) * p.r * 1.15 * k
        );
        ctx.stroke();
      }
    } else if (p.kind === "bush") {
      var kb = Math.max(0.3, p.food / p.max);
      ctx.fillStyle = "#2f6b38";
      ctx.beginPath(); ctx.arc(p.x - p.r * 0.3, p.y - p.r * 0.15 * kb, p.r * 0.5 * kb, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(p.x + p.r * 0.28, p.y - p.r * 0.1 * kb, p.r * 0.46 * kb, 0, TAU); ctx.fill();
      ctx.fillStyle = "#3f8a45";
      ctx.beginPath(); ctx.arc(p.x, p.y - p.r * 0.42 * kb, p.r * 0.52 * kb, 0, TAU); ctx.fill();
      if (kb > 0.7) {
        ctx.fillStyle = "#e05a6a";
        ctx.beginPath(); ctx.arc(p.x + p.r * 0.2, p.y - p.r * 0.5 * kb, p.r * 0.1, 0, TAU); ctx.fill();
      }
    } else if (p.kind === "rock") {
      ctx.fillStyle = "#7c7a80";
      ctx.beginPath();
      ctx.moveTo(p.x - p.r, p.y + p.r * 0.3);
      ctx.lineTo(p.x - p.r * 0.4, p.y - p.r * 0.7);
      ctx.lineTo(p.x + p.r * 0.5, p.y - p.r * 0.55);
      ctx.lineTo(p.x + p.r, p.y + p.r * 0.32);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.beginPath();
      ctx.moveTo(p.x - p.r * 0.4, p.y - p.r * 0.7);
      ctx.lineTo(p.x + p.r * 0.5, p.y - p.r * 0.55);
      ctx.lineTo(p.x + p.r * 0.1, p.y - p.r * 0.15);
      ctx.closePath(); ctx.fill();
    } else if (p.kind === "wood") {
      ctx.strokeStyle = "#8a7458"; ctx.lineWidth = p.r * 0.28; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(p.x - p.r * 0.8, p.y); ctx.lineTo(p.x + p.r * 0.8, p.y - p.r * 0.16); ctx.stroke();
    } else if (p.kind === "tuft") {
      ctx.strokeStyle = "rgba(60,110,50,0.65)";
      ctx.lineWidth = Math.max(1, p.r * 0.2);
      for (var g = 0; g < 3; g++) {
        ctx.beginPath();
        ctx.moveTo(p.x + (g - 1) * p.r * 0.3, p.y);
        ctx.lineTo(p.x + (g - 1) * p.r * 0.3 + sway * 0.5, p.y - p.r);
        ctx.stroke();
      }
    } else if (p.kind === "tent") {
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.beginPath(); ctx.ellipse(p.x, p.y + p.r * 0.16, p.r * 1.0, p.r * 0.3, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "#a98156";
      ctx.beginPath();
      ctx.moveTo(p.x - p.r, p.y);
      ctx.lineTo(p.x, p.y - p.r * 1.5);
      ctx.lineTo(p.x + p.r, p.y);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.beginPath();
      ctx.moveTo(p.x + p.r * 0.1, p.y);
      ctx.lineTo(p.x, p.y - p.r * 1.5);
      ctx.lineTo(p.x + p.r, p.y);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#3a2a18";
      ctx.beginPath();
      ctx.moveTo(p.x - p.r * 0.3, p.y);
      ctx.quadraticCurveTo(p.x - p.r * 0.05, p.y - p.r * 0.95, p.x + p.r * 0.2, p.y);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#6b4a2a"; ctx.lineWidth = Math.max(1.4, p.r * 0.1);
      ctx.beginPath();
      ctx.moveTo(p.x - p.r * 0.15, p.y - p.r * 1.42);
      ctx.lineTo(p.x + p.r * 0.35, p.y - p.r * 1.78);
      ctx.stroke();
    } else if (p.kind === "campfire") {
      ctx.fillStyle = "#4a4038";
      for (var s2 = 0; s2 < 6; s2++) {
        var sa2 = s2 / 6 * TAU;
        ctx.beginPath();
        ctx.ellipse(p.x + Math.cos(sa2) * p.r, p.y + Math.sin(sa2) * p.r * 0.55, p.r * 0.26, p.r * 0.18, 0, 0, TAU);
        ctx.fill();
      }
      ctx.strokeStyle = "#5a3f22"; ctx.lineWidth = p.r * 0.2; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(p.x - p.r * 0.5, p.y + p.r * 0.1); ctx.lineTo(p.x + p.r * 0.5, p.y - p.r * 0.15);
      ctx.moveTo(p.x - p.r * 0.4, p.y - p.r * 0.2); ctx.lineTo(p.x + p.r * 0.45, p.y + p.r * 0.15);
      ctx.stroke();
      var fl = 0.6 + 0.4 * Math.sin(time * 9 + p.seed);
      var gg = ctx.createRadialGradient(p.x, p.y - p.r * 0.3, 2, p.x, p.y - p.r * 0.3, p.r * 2.4);
      gg.addColorStop(0, "rgba(255,190,90,0.55)");
      gg.addColorStop(1, "rgba(255,110,20,0)");
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.arc(p.x, p.y - p.r * 0.3, p.r * 2.4, 0, TAU); ctx.fill();
      ctx.fillStyle = "#ff8a2a";
      ctx.beginPath();
      ctx.moveTo(p.x - p.r * 0.4, p.y - p.r * 0.1);
      ctx.quadraticCurveTo(p.x, p.y - p.r * (1.5 + fl * 0.7), p.x + p.r * 0.4, p.y - p.r * 0.1);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ffe066";
      ctx.beginPath();
      ctx.moveTo(p.x - p.r * 0.2, p.y - p.r * 0.15);
      ctx.quadraticCurveTo(p.x, p.y - p.r * (0.95 + fl * 0.5), p.x + p.r * 0.2, p.y - p.r * 0.15);
      ctx.closePath(); ctx.fill();
    } else if (p.kind === "stake") {
      ctx.strokeStyle = "#6b4a2a"; ctx.lineWidth = p.r * 0.26; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + sway * 0.3, p.y - p.r * 1.5);
      ctx.stroke();
      ctx.fillStyle = "#8a6a42";
      ctx.beginPath();
      ctx.moveTo(p.x + sway * 0.3 - p.r * 0.2, p.y - p.r * 1.5);
      ctx.lineTo(p.x + sway * 0.3, p.y - p.r * 1.85);
      ctx.lineTo(p.x + sway * 0.3 + p.r * 0.2, p.y - p.r * 1.5);
      ctx.closePath(); ctx.fill();
      if (p.seed % 3 < 1) {
        ctx.fillStyle = "#e8e0cf";
        ctx.beginPath(); ctx.arc(p.x + sway * 0.3, p.y - p.r * 1.15, p.r * 0.34, 0, TAU); ctx.fill();
        ctx.fillStyle = "#3a2a18";
        ctx.beginPath(); ctx.arc(p.x + sway * 0.3 - p.r * 0.12, p.y - p.r * 1.2, p.r * 0.08, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(p.x + sway * 0.3 + p.r * 0.12, p.y - p.r * 1.2, p.r * 0.08, 0, TAU); ctx.fill();
      }
    } else if (p.kind === "bones") {
      ctx.strokeStyle = "#ddd6c2"; ctx.lineWidth = p.r * 0.2; ctx.lineCap = "round";
      for (var bb = 0; bb < 3; bb++) {
        ctx.beginPath();
        ctx.moveTo(p.x - p.r * 0.7, p.y + (bb - 1) * p.r * 0.32);
        ctx.quadraticCurveTo(p.x, p.y + (bb - 1) * p.r * 0.32 - p.r * 0.4, p.x + p.r * 0.7, p.y + (bb - 1) * p.r * 0.32);
        ctx.stroke();
      }
      ctx.fillStyle = "#e8e0cf";
      ctx.beginPath(); ctx.ellipse(p.x - p.r * 0.95, p.y, p.r * 0.34, p.r * 0.26, 0, 0, TAU); ctx.fill();
    } else if (p.kind === "crystal") {
      var fy = Math.sin(time * 1.6 + p.seed) * p.r * 0.14;
      var glow = 0.55 + 0.3 * Math.sin(time * 2.4 + p.seed);
      var g2 = ctx.createRadialGradient(p.x, p.y - p.r * 0.8 + fy, 2, p.x, p.y - p.r * 0.8 + fy, p.r * 3);
      g2.addColorStop(0, "rgba(150,240,255," + (0.4 * glow) + ")");
      g2.addColorStop(1, "rgba(90,180,255,0)");
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.arc(p.x, p.y - p.r * 0.8 + fy, p.r * 3, 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.beginPath(); ctx.ellipse(p.x, p.y + p.r * 0.1, p.r * 0.7, p.r * 0.24, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "#7fd8ff";
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - p.r * 1.9 + fy);
      ctx.lineTo(p.x + p.r * 0.52, p.y - p.r * 0.75 + fy);
      ctx.lineTo(p.x, p.y + fy);
      ctx.lineTo(p.x - p.r * 0.52, p.y - p.r * 0.75 + fy);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - p.r * 1.9 + fy);
      ctx.lineTo(p.x + p.r * 0.52, p.y - p.r * 0.75 + fy);
      ctx.lineTo(p.x, p.y - p.r * 0.55 + fy);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#c9f4ff";
      for (var sh = 0; sh < 2; sh++) {
        var sa3 = time * (1.1 + sh * 0.5) + sh * 3;
        ctx.beginPath();
        ctx.arc(p.x + Math.cos(sa3) * p.r * 1.1, p.y - p.r * 0.8 + Math.sin(sa3) * p.r * 0.5, p.r * 0.12, 0, TAU);
        ctx.fill();
      }
    } else if (p.kind === "rune") {
      var ready = !p.cd || p.cd <= 0;
      var pulse = 0.4 + 0.3 * Math.sin(time * 2 + p.seed);
      ctx.globalAlpha = ready ? pulse + 0.25 : 0.16;
      ctx.strokeStyle = "#c9a0ff";
      ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 0.5, 0, 0, TAU); ctx.stroke();
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r * 0.66, p.r * 0.33, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = "rgba(180,130,255,0.18)";
      ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r * 0.95, p.r * 0.47, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = "#e0c8ff";
      ctx.lineWidth = 2.6;
      for (var rr2 = 0; rr2 < 6; rr2++) {
        var ra = rr2 / 6 * TAU + time * 0.25;
        var rx = p.x + Math.cos(ra) * p.r * 0.82, ry = p.y + Math.sin(ra) * p.r * 0.41;
        ctx.beginPath();
        ctx.moveTo(rx - 4, ry - 5); ctx.lineTo(rx + 4, ry - 1); ctx.lineTo(rx - 3, ry + 5);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  /* ---------------- 人类 / 图腾 / 状态光环 / 吐息 / 投射物 ---------------- */
  function human(ctx, c, time) {
    var d = c.def, col = d.colors, art = d.art || {}, role = art.role || "hunter";
    var R = c.radius;
    var H = R * 3.2;
    var flip = Math.cos(c.face) < 0 ? -1 : 1;
    var spd = Math.min(1, c.speedNow / Math.max(40, c.speed * 0.9));
    var ph = c.phase * 2.8;
    var sw = Math.sin(ph) * 0.55 * spd;
    var atk = c.atkAnim > 0 ? Math.sin((1 - c.atkAnim / 0.32) * Math.PI) : 0;

    ctx.fillStyle = "rgba(0,0,0,0.26)";
    ctx.beginPath(); ctx.ellipse(0, 2, R * 1.1, R * 0.4, 0, 0, TAU); ctx.fill();

    if (c.dead) { ctx.translate(0, -R * 0.2); ctx.rotate(1.35); }

    ctx.save();
    ctx.scale(flip, 1);
    var skin = col.belly;
    var cloth = role === "shaman" ? "#4d2a5c" : (role === "chief" ? "#b03a2a" : "#8c5a2a");

    ctx.strokeStyle = skin; ctx.lineCap = "round"; ctx.lineWidth = R * 0.34;
    ctx.beginPath();
    ctx.moveTo(-R * 0.12, -H * 0.42);
    ctx.lineTo(-R * 0.12 + sw * R * 0.9, -R * 0.05);
    ctx.moveTo(R * 0.12, -H * 0.42);
    ctx.lineTo(R * 0.12 - sw * R * 0.9, -R * 0.05);
    ctx.stroke();

    ctx.fillStyle = cloth;
    ctx.beginPath();
    ctx.moveTo(-R * 0.52, -H * 0.52); ctx.lineTo(R * 0.52, -H * 0.52);
    ctx.lineTo(R * 0.44, -H * 0.3); ctx.lineTo(-R * 0.44, -H * 0.3);
    ctx.closePath(); ctx.fill();

    if (role === "chief") {
      ctx.fillStyle = "rgba(150,40,30,0.9)";
      ctx.beginPath();
      ctx.moveTo(-R * 0.4, -H * 0.8);
      ctx.quadraticCurveTo(-R * 1.6, -H * 0.5, -R * 0.7, -H * 0.04);
      ctx.lineTo(-R * 0.15, -H * 0.22);
      ctx.closePath(); ctx.fill();
    }

    ctx.fillStyle = col.body;
    ctx.beginPath(); ctx.ellipse(0, -H * 0.62, R * 0.52, R * 0.72, 0, 0, TAU); ctx.fill();
    if (role === "spear" || role === "chief") {
      ctx.strokeStyle = "rgba(200,60,40,0.85)"; ctx.lineWidth = R * 0.13;
      ctx.beginPath();
      ctx.moveTo(-R * 0.34, -H * 0.74); ctx.lineTo(R * 0.3, -H * 0.52);
      ctx.stroke();
    }

    var armY = -H * 0.66;
    ctx.strokeStyle = skin; ctx.lineWidth = R * 0.26;
    if (role === "shaman") {
      ctx.beginPath(); ctx.moveTo(0, armY); ctx.lineTo(R * 0.72, armY + R * 0.2 - atk * R * 0.5); ctx.stroke();
      ctx.strokeStyle = "#6b4a2a"; ctx.lineWidth = R * 0.16;
      ctx.beginPath(); ctx.moveTo(R * 0.7, armY + R * 1.15); ctx.lineTo(R * 0.86, armY - R * 0.95); ctx.stroke();
      var gl2 = 0.5 + 0.5 * Math.sin(time * 6 + c.id);
      ctx.fillStyle = "rgba(255,150,60," + (0.45 + gl2 * 0.5) + ")";
      ctx.beginPath(); ctx.arc(R * 0.88, armY - R * 1.06, R * 0.3 + gl2 * R * 0.1, 0, TAU); ctx.fill();
    } else {
      var spearAng = role === "spear" ? -0.22 : (-0.95 + atk * 1.5);
      ctx.beginPath(); ctx.moveTo(0, armY); ctx.lineTo(R * 0.68, armY + R * 0.1); ctx.stroke();
      ctx.save();
      ctx.translate(R * 0.68, armY + R * 0.1);
      ctx.rotate(spearAng);
      ctx.strokeStyle = "#a5793f"; ctx.lineWidth = R * 0.15;
      ctx.beginPath(); ctx.moveTo(-R * 1.1, 0); ctx.lineTo(R * 1.95, 0); ctx.stroke();
      ctx.fillStyle = "#ece5d3";
      ctx.beginPath();
      ctx.moveTo(R * 1.95, 0); ctx.lineTo(R * 1.5, -R * 0.24); ctx.lineTo(R * 1.5, R * 0.24);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(R * 0.06, -H * 0.98, R * 0.46, 0, TAU); ctx.fill();
    ctx.fillStyle = "#231508";
    ctx.beginPath(); ctx.arc(R * 0.3, -H * 1.0, R * 0.08, 0, TAU); ctx.fill();

    if (role === "shaman") {
      ctx.fillStyle = "#efe6d2";
      ctx.beginPath(); ctx.ellipse(R * 0.18, -H * 0.98, R * 0.4, R * 0.33, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "#3a2140";
      ctx.beginPath(); ctx.arc(R * 0.06, -H * 1.06, R * 0.5, Math.PI, TAU); ctx.fill();
      ctx.strokeStyle = "#c9a0ff"; ctx.lineWidth = R * 0.1;
      ctx.beginPath(); ctx.moveTo(-R * 0.3, -H * 1.3); ctx.lineTo(-R * 0.62, -H * 1.6); ctx.stroke();
    } else if (role === "chief") {
      ctx.fillStyle = "#efe6d2";
      ctx.beginPath();
      ctx.moveTo(-R * 0.52, -H * 1.1); ctx.lineTo(R * 0.74, -H * 1.2);
      ctx.lineTo(R * 0.52, -H * 0.88); ctx.lineTo(-R * 0.42, -H * 0.92);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#2a1a0e";
      ctx.beginPath(); ctx.arc(R * 0.34, -H * 1.03, R * 0.09, 0, TAU); ctx.fill();
      ctx.strokeStyle = "#ffd257"; ctx.lineWidth = R * 0.1;
      ctx.beginPath(); ctx.moveTo(-R * 0.3, -H * 1.16); ctx.lineTo(-R * 0.7, -H * 1.5); ctx.stroke();
    } else {
      ctx.fillStyle = "#2a1a0e";
      ctx.beginPath(); ctx.arc(0, -H * 1.04, R * 0.44, Math.PI * 0.95, TAU * 1.02); ctx.fill();
      ctx.strokeStyle = role === "spear" ? "#c04a3a" : "#d8c070";
      ctx.lineWidth = R * 0.1;
      ctx.beginPath(); ctx.moveTo(-R * 0.24, -H * 1.12); ctx.lineTo(-R * 0.6, -H * 1.42); ctx.stroke();
    }
    ctx.restore();

    if (c.hurtT > 0) {
      ctx.globalAlpha = Math.min(0.6, c.hurtT * 2.2);
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.ellipse(0, -H * 0.6, R * 0.8, R * 1.2, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function totemArt(ctx, c, time) {
    var R = c.radius, col = c.def.colors;
    var k = Math.max(0, c.hp / c.maxHp);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath(); ctx.ellipse(0, 4, R * 1.15, R * 0.4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#7a7068";
    ctx.beginPath(); ctx.ellipse(0, 0, R * 0.95, R * 0.34, 0, 0, TAU); ctx.fill();
    var w = R * 0.8, top = -R * 3.1;
    if (c.dead) { ctx.rotate(0.9); }
    ctx.fillStyle = col.body;
    ctx.fillRect(-w / 2, top, w, -top);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(w * 0.14, top, w * 0.36, -top);
    for (var i = 0; i < 3; i++) {
      var y0 = top + R * 0.34 + i * R * 0.94;
      ctx.fillStyle = i === 1 ? col.accent : "#6d5230";
      ctx.fillRect(-w * 0.45, y0, w * 0.9, R * 0.74);
      ctx.fillStyle = (i < Math.ceil(k * 3)) ? col.eye : "#4a3a20";
      ctx.beginPath(); ctx.arc(-w * 0.18, y0 + R * 0.26, R * 0.12, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(w * 0.18, y0 + R * 0.26, R * 0.12, 0, TAU); ctx.fill();
      ctx.fillStyle = "#2a1c0c";
      ctx.fillRect(-w * 0.26, y0 + R * 0.5, w * 0.52, R * 0.1);
    }
    ctx.strokeStyle = "#efe6d2"; ctx.lineWidth = R * 0.14; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-w * 0.95, top + R * 0.12); ctx.lineTo(w * 0.95, top - R * 0.1);
    ctx.stroke();
    ctx.strokeStyle = "#c04a3a"; ctx.lineWidth = R * 0.1;
    for (var f = 0; f < 3; f++) {
      var fa = -0.6 + f * 0.6;
      ctx.beginPath();
      ctx.moveTo(0, top);
      ctx.lineTo(Math.sin(fa) * R * 0.95, top - R * 0.85 - Math.cos(fa) * R * 0.2);
      ctx.stroke();
    }
    if (!c.dead) {
      ctx.globalAlpha = (0.3 + 0.25 * Math.sin(time * 2.2)) * k;
      ctx.strokeStyle = "#ffce54"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(0, -R * 1.5, R * 1.3, R * 0.52, 0, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (c.hurtT > 0) {
      ctx.globalAlpha = Math.min(0.6, c.hurtT * 2);
      ctx.fillStyle = "#fff";
      ctx.fillRect(-w / 2, top, w, -top);
      ctx.globalAlpha = 1;
    }
  }

  function auras(ctx, c, time) {
    var R = c.radius;
    if (c.def.boss && !c.dead) {
      ctx.globalAlpha = 0.4 + 0.15 * Math.sin(time * 3);
      var g = ctx.createRadialGradient(0, 0, R * 0.4, 0, 0, R * 2.4);
      g.addColorStop(0, "rgba(255,90,30,0.45)");
      g.addColorStop(1, "rgba(255,60,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, R * 2.4, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (c.dead) return;
    if (c.shield > 0) {
      ctx.strokeStyle = "rgba(140,220,255," + (0.35 + 0.3 * Math.sin(time * 8)) + ")";
      ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.ellipse(0, -R * 0.3, R * 1.5, R * 1.7, 0, 0, TAU); ctx.stroke();
    }
    if (c.chill > 0) {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = "#9fdcff";
      ctx.beginPath(); ctx.ellipse(0, -R * 0.2, R * 1.3, R * 1.0, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (c.burn > 0) {
      for (var i = 0; i < 3; i++) {
        var bx = (i - 1) * R * 0.5, by = -R * (0.55 + 0.28 * Math.sin(time * 9 + i * 2));
        ctx.fillStyle = i % 2 ? "#ffb347" : "#ff6a2a";
        ctx.beginPath();
        ctx.moveTo(bx - R * 0.17, by);
        ctx.quadraticCurveTo(bx, by - R * 0.72, bx + R * 0.17, by);
        ctx.closePath(); ctx.fill();
      }
    }
    if (c.stun > 0) {
      ctx.fillStyle = "#ffe066";
      for (var s = 0; s < 3; s++) {
        var sa = time * 6 + s * 2.1;
        ctx.beginPath();
        ctx.arc(Math.cos(sa) * R * 0.85, -R * 1.9 + Math.sin(sa) * R * 0.22, R * 0.15, 0, TAU);
        ctx.fill();
      }
    }
    if (c.bless) {
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = c.bless.col || "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, R * 0.5, R * 1.35, R * 0.5, 0, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function breathFx(ctx, c, game) {
    if (!c.breathT || c.breathT <= 0 || !D.Magic) return;
    var B = D.Magic.BREATHS[c.breathKind];
    if (!B) return;
    var k = Math.max(0, Math.min(1, c.breathT / 0.42));
    var ang = c.breathAng;
    var mx = c.x + Math.cos(ang) * c.radius * 0.95;
    var my = c.y + Math.sin(ang) * c.radius * 0.95 - c.radius * 0.45;
    ctx.save();
    if (B.kind === "cone") {
      var range = B.range * (0.75 + 0.35 * c.scale) * (1.08 - k * 0.2);
      var g = ctx.createRadialGradient(mx, my, 3, mx, my, range);
      g.addColorStop(0, B.col2);
      g.addColorStop(0.45, B.col);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.globalAlpha = 0.6 * Math.min(1, k * 1.7);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.arc(mx, my, range, ang - B.arc, ang + B.arc);
      ctx.closePath();
      ctx.fill();
    } else if (B.kind === "line" && c.breathPts && c.breathPts.length > 1) {
      var pts = c.breathPts;
      ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.strokeStyle = B.col; ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
      ctx.strokeStyle = B.col2; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (var j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0], pts[j][1]);
      ctx.stroke();
    } else if (B.kind === "ring") {
      var rr = B.range * (0.8 + 0.4 * c.scale) * (1 - k);
      ctx.globalAlpha = k * 0.7;
      ctx.strokeStyle = B.col2;
      ctx.lineWidth = 4 + 9 * k;
      ctx.beginPath(); ctx.ellipse(c.x, c.y + c.radius * 0.3, rr, rr * 0.55, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = B.col;
      ctx.lineWidth = 2 + 4 * k;
      ctx.beginPath(); ctx.ellipse(c.x, c.y + c.radius * 0.3, rr * 0.72, rr * 0.4, 0, 0, TAU); ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function projectiles(game) {
    var ctx = game.ctx, list = game.projectiles || [];
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (!game.inView(p.x, p.y, 60)) continue;
      if (p.kind === "fireball") {
        var g = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, p.r * 3);
        g.addColorStop(0, "rgba(255,220,120,0.9)");
        g.addColorStop(0.4, "rgba(255,140,50,0.55)");
        g.addColorStop(1, "rgba(255,80,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3, 0, TAU); ctx.fill();
        ctx.fillStyle = "#fff2c0";
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.7 + 0.12 * Math.sin(p.ph)), 0, TAU); ctx.fill();
      } else {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.ang);
        ctx.strokeStyle = "#a5793f"; ctx.lineWidth = 3; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(8, 0); ctx.stroke();
        ctx.fillStyle = "#ece5d3";
        ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(6, -3.4); ctx.lineTo(6, 3.4); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
  }

  function creature(ctx, c, game) {
    var d = c.def;
    ctx.save();
    ctx.translate(c.x, c.y);
    if (d.spectral) ctx.globalAlpha = 0.5 + 0.2 * Math.sin(game.time * 3.4 + c.id);
    if (d.kind === "human") human(ctx, c, game.time);
    else if (d.kind === "struct") totemArt(ctx, c, game.time);
    else dino(ctx, c, game.time);
    ctx.globalAlpha = 1;
    auras(ctx, c, game.time);
    ctx.restore();
    breathFx(ctx, c, game);
  }

  /* ---------------- 地形 ---------------- */
  function terrain(game) {
    var ctx = game.ctx, w = game.world, T = D.T, TILE = w.tile, v = game.view;
    var c0 = Math.max(0, Math.floor(v.x0 / TILE)), c1 = Math.min(w.cols - 1, Math.floor(v.x1 / TILE));
    var r0 = Math.max(0, Math.floor(v.y0 / TILE)), r1 = Math.min(w.rows - 1, Math.floor(v.y1 / TILE));
    var t = game.time;
    for (var y = r0; y <= r1; y++) {
      for (var x = c0; x <= c1; x++) {
        var i = y * w.cols + x;
        ctx.fillStyle = w.color[i];
        ctx.fillRect(x * TILE, y * TILE, TILE + 1, TILE + 1);
      }
    }
    // 细节层
    for (var y2 = r0; y2 <= r1; y2++) {
      for (var x2 = c0; x2 <= c1; x2++) {
        var i2 = y2 * w.cols + x2, tt = w.map[i2], f = w.flags[i2];
        var bx = x2 * TILE, by = y2 * TILE;
        if (tt <= T.WATER) {
          var hp = t * 0.7 + U.hash2i(x2, y2, 5) * 9;
          ctx.fillStyle = "rgba(255,255,255,0.075)";
          ctx.fillRect(bx + 6 + Math.sin(hp) * 9, by + TILE * 0.28, TILE * 0.5, 2.5);
          ctx.fillRect(bx + TILE * 0.32 + Math.cos(hp * 1.2) * 8, by + TILE * 0.66, TILE * 0.4, 2);
          if (f & 2) {
            ctx.fillStyle = "rgba(255,255,255," + (0.1 + 0.06 * Math.sin(t * 2 + x2 + y2)) + ")";
            ctx.fillRect(bx, by, TILE + 1, TILE + 1);
          }
        } else if (tt === T.ROCK) {
          if (f & 4) {
            ctx.fillStyle = "rgba(255,255,255,0.14)";
            ctx.fillRect(bx, by, TILE + 1, TILE * 0.3);
          }
          ctx.fillStyle = "rgba(0,0,0,0.16)";
          ctx.fillRect(bx, by + TILE * 0.72, TILE + 1, TILE * 0.3);
        } else if (game.quality > 0) {
          if (f & 1) {
            ctx.fillStyle = "rgba(226,214,168,0.5)";
            ctx.fillRect(bx, by, TILE + 1, TILE + 1);
          }
          if (tt >= T.GRASS && game.quality > 1) {
            ctx.fillStyle = "rgba(0,0,0,0.055)";
            for (var k = 0; k < 3; k++) {
              var hx = U.hash2i(x2 * 3 + k, y2 * 7, 11) * TILE;
              var hy = U.hash2i(x2 * 5, y2 * 11 + k, 13) * TILE;
              ctx.fillRect(bx + hx, by + hy, 3, 2);
            }
          }
        }
      }
    }
  }

  /* ---------------- 巢 / 蛋 / 火 / 陨石 ---------------- */
  function nest(ctx, n, time) {
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath(); ctx.ellipse(n.x, n.y + 6, 46, 20, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#6b5433";
    ctx.beginPath(); ctx.ellipse(n.x, n.y, 44, 22, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#3f3120";
    ctx.beginPath(); ctx.ellipse(n.x, n.y, 33, 15, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#8a6d42"; ctx.lineWidth = 3; ctx.lineCap = "round";
    for (var i = 0; i < 9; i++) {
      var a = i * 0.7 + 0.2;
      ctx.beginPath();
      ctx.moveTo(n.x + Math.cos(a) * 24, n.y + Math.sin(a) * 11);
      ctx.lineTo(n.x + Math.cos(a + 0.6) * 46, n.y + Math.sin(a + 0.6) * 21);
      ctx.stroke();
    }
  }

  function egg(ctx, e, time) {
    var b = 1 + Math.sin(time * 6 + e.x) * 0.04 * (e.t < 6 ? 1 : 0);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath(); ctx.ellipse(e.x, e.y + 8, 10, 4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#efe4c8";
    ctx.beginPath(); ctx.ellipse(e.x, e.y, 9 * b, 12 * b, 0.1, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(180,160,120,0.55)";
    ctx.beginPath(); ctx.ellipse(e.x + 2, e.y + 3, 4, 5, 0.3, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath(); ctx.ellipse(e.x - 3, e.y - 4, 2.6, 3.4, 0.2, 0, TAU); ctx.fill();
  }

  function fires(game) {
    var ctx = game.ctx, list = game.fires || [];
    for (var i = 0; i < list.length; i++) {
      var f = list[i];
      var k = Math.min(1, f.t / 2);
      ctx.globalAlpha = 0.5 * k;
      var g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
      g.addColorStop(0, "rgba(255,180,60,0.9)");
      g.addColorStop(1, "rgba(255,80,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(40,26,18,0.5)";
      ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * 0.6, f.r * 0.3, 0, 0, TAU); ctx.fill();
    }
  }

  function meteors(game, phase) {
    var ctx = game.ctx, list = game.meteors || [];
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      var k = m.t / m.dur;
      if (phase === "ground") {
        ctx.strokeStyle = "rgba(255,90,60," + (0.35 + 0.35 * Math.sin(game.time * 14)) + ")";
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(m.x, m.y, m.r * (0.4 + k * 0.6), m.r * 0.5 * (0.4 + k * 0.6), 0, 0, TAU); ctx.stroke();
        ctx.fillStyle = "rgba(255,60,30,0.12)";
        ctx.beginPath(); ctx.ellipse(m.x, m.y, m.r * k, m.r * 0.5 * k, 0, 0, TAU); ctx.fill();
      } else {
        var h = (1 - k) * 900;
        var mx = m.x + (1 - k) * 260, my = m.y - h;
        ctx.strokeStyle = "rgba(255,170,80,0.75)";
        ctx.lineWidth = 6 + 6 * k;
        ctx.beginPath(); ctx.moveTo(mx + 90, my - 300); ctx.lineTo(mx, my); ctx.stroke();
        ctx.fillStyle = "#ffe9a8";
        ctx.beginPath(); ctx.arc(mx, my, 9 + 8 * k, 0, TAU); ctx.fill();
      }
    }
  }

  function flyers(game) {
    var ctx = game.ctx, list = game.flyers || [];
    for (var i = 0; i < list.length; i++) {
      var f = list[i];
      var flap = Math.sin(f.ph) * 0.55;
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = "#000";
      ctx.beginPath(); ctx.ellipse(f.x, f.y, 16, 5, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      var fx = f.x, fy = f.y - f.alt;
      var dirn = f.vx < 0 ? -1 : 1;
      ctx.save();
      ctx.translate(fx, fy);
      ctx.scale(dirn, 1);
      ctx.fillStyle = "#8d7a58";
      ctx.beginPath(); ctx.ellipse(0, 0, 9, 4.5, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(20, -3); ctx.lineTo(16, 2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#a2906a"; ctx.lineWidth = 3.4; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-2, -1);
      ctx.quadraticCurveTo(-14, -12 * flap - 4, -30, -3 * flap);
      ctx.moveTo(-2, 1);
      ctx.quadraticCurveTo(-13, 10 * flap + 4, -28, 4 * flap);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* ---------------- 血条与标记 ---------------- */
  function bars(game) {
    var ctx = game.ctx, list = game.creatures, p = game.player;
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.dead || c === p) continue;
      if (!game.inView(c.x, c.y, 90)) continue;
      var showBar = c.hp < c.maxHp - 0.5 || c.def.kind === "struct" || c.def.boss;
      var y = c.y - c.radius * (c.def.art && c.def.art.sail ? 2.4 : 1.9) - 12;
      if (showBar) {
        var w = Math.max(24, c.radius * 1.5);
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(c.x - w / 2, y, w, 5);
        ctx.fillStyle = c.ally ? "#7ede63" : (c.def.diet === "herb" ? "#e2c04a" : "#ef5a4c");
        ctx.fillRect(c.x - w / 2 + 1, y + 1, (w - 2) * Math.max(0, c.hp / c.maxHp), 3);
      }
      if (c.ally) {
        ctx.fillStyle = "#9dffb0";
        ctx.beginPath();
        ctx.moveTo(c.x, y - 8); ctx.lineTo(c.x - 5, y - 15); ctx.lineTo(c.x + 5, y - 15);
        ctx.closePath(); ctx.fill();
      } else if (c.def.apex || c.def.elite || c.def.kind === "struct") {
        ctx.fillStyle = c.def.boss ? "#ff7a4a" : (c.def.kind === "struct" ? "#ffd257" : "#ffce54");
        ctx.font = "700 12px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(c.def.name, c.x, y - 8);
        ctx.textAlign = "left";
      }
      if (c.state === "flee" && c.fleeT > 0.1) {
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.font = "700 13px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("!", c.x + c.radius * 0.8, y - 4);
        ctx.textAlign = "left";
      }
    }
  }

  /* ---------------- 天气 / 光照 ---------------- */
  function weather(game) {
    var ctx = game.ctx, W = game.vw, H = game.vh, wx = game.weather;
    ctx.setTransform(game.dpr, 0, 0, game.dpr, 0, 0);
    if (wx.rain > 0.02) {
      var n = Math.floor(70 * wx.rain * (game.quality > 1 ? 1.6 : game.quality > 0 ? 1 : 0.5));
      ctx.strokeStyle = "rgba(180,215,235," + (0.28 + wx.rain * 0.3) + ")";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (var i = 0; i < n; i++) {
        var sx = (U.hash2i(i, 3, 7) * W + game.time * 260 * (0.6 + wx.wind)) % W;
        var sy = (U.hash2i(i, 9, 11) * H + game.time * 1250) % H;
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - 9 * wx.wind - 3, sy + 20);
      }
      ctx.stroke();
    }
    if (wx.fog > 0.02) {
      var fg = ctx.createLinearGradient(0, 0, 0, H);
      fg.addColorStop(0, "rgba(196,208,205," + (0.42 * wx.fog) + ")");
      fg.addColorStop(0.5, "rgba(186,200,198," + (0.3 * wx.fog) + ")");
      fg.addColorStop(1, "rgba(196,208,205," + (0.44 * wx.fog) + ")");
      ctx.fillStyle = fg;
      ctx.fillRect(0, 0, W, H);
    }
    if (game.flash > 0.01) {
      ctx.fillStyle = "rgba(240,248,255," + Math.min(0.75, game.flash) + ")";
      ctx.fillRect(0, 0, W, H);
    }
  }

  function lighting(game) {
    var ctx = game.ctx, W = game.vw, H = game.vh;
    var dark = game.darkness;
    ctx.setTransform(game.dpr, 0, 0, game.dpr, 0, 0);
    if (game.warm > 0.01) {
      ctx.fillStyle = "rgba(255,146,52," + (0.16 * game.warm) + ")";
      ctx.fillRect(0, 0, W, H);
    }
    if (dark > 0.02) {
      var lc = game.lightCanvas;
      if (!lc) return;
      var lx = lc.getContext("2d");
      if (!lx) return;
      lx.setTransform(1, 0, 0, 1, 0, 0);
      lx.clearRect(0, 0, lc.width, lc.height);
      lx.fillStyle = "rgba(8,14,40," + dark + ")";
      lx.fillRect(0, 0, lc.width, lc.height);
      lx.globalCompositeOperation = "destination-out";
      var p = game.player;
      var dpr = game.dpr;
      function hole(wxx, wyy, rad, strength) {
        var sx = ((wxx - game.cam.x) * game.cam.zoom + W / 2) * dpr;
        var sy = ((wyy - game.cam.y) * game.cam.zoom + H / 2) * dpr;
        var rr = rad * game.cam.zoom * dpr;
        var g = lx.createRadialGradient(sx, sy, 0, sx, sy, rr);
        g.addColorStop(0, "rgba(0,0,0," + strength + ")");
        g.addColorStop(0.55, "rgba(0,0,0," + strength * 0.55 + ")");
        g.addColorStop(1, "rgba(0,0,0,0)");
        lx.fillStyle = g;
        lx.beginPath(); lx.arc(sx, sy, rr, 0, TAU); lx.fill();
      }
      if (p) hole(p.x, p.y, 300 + p.radius * 4, 0.96);
      var fl = game.fires || [];
      for (var i = 0; i < fl.length; i++) hole(fl[i].x, fl[i].y, fl[i].r * 2.4, 0.8);
      var lts = (game.world && game.world.lights) || [];
      for (var L = 0; L < lts.length; L++) {
        var lt = lts[L];
        if (!game.inView(lt.x, lt.y, lt.r * 1.2)) continue;
        hole(lt.x, lt.y, lt.r * (0.92 + 0.08 * Math.sin(game.time * 3 + L)), lt.kind === "fire" ? 0.85 : 0.7);
      }
      var pr = game.projectiles || [];
      for (var q = 0; q < pr.length; q++) {
        if (pr[q].kind === "fireball") hole(pr[q].x, pr[q].y, 90, 0.6);
      }
      lx.globalCompositeOperation = "source-over";
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(lc, 0, 0);
      ctx.setTransform(game.dpr, 0, 0, game.dpr, 0, 0);
    }
  }

  function vignette(game) {
    var ctx = game.ctx, W = game.vw, H = game.vh, p = game.player;
    var lowHp = p && !p.dead ? Math.max(0, 1 - p.hp / (p.maxHp * 0.35)) : 0;
    var starve = p && !p.dead ? Math.max(0, 1 - Math.min(p.hunger, p.thirst) / 18) : 0;
    var a = Math.max(lowHp, starve);
    if (a > 0.01) {
      var g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.28, W / 2, H / 2, Math.max(W, H) * 0.72);
      g.addColorStop(0, "rgba(120,0,0,0)");
      g.addColorStop(1, "rgba(150,10,10," + (0.24 + 0.3 * a * (0.7 + 0.3 * Math.sin(game.time * 5))) + ")");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    if (game.sleepFade > 0.01) {
      ctx.fillStyle = "rgba(0,0,0," + Math.min(1, game.sleepFade) + ")";
      ctx.fillRect(0, 0, W, H);
      if (game.sleepFade > 0.5) {
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.font = "600 18px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("睡眠中...", W / 2, H / 2);
        ctx.textAlign = "left";
      }
    }
  }

  /* ---------------- 主绘制 ---------------- */
  var buf = [];

  function draw(game) {
    var ctx = game.ctx;
    if (!ctx) return;
    var W = game.vw, H = game.vh, cam = game.cam;
    ctx.setTransform(game.dpr, 0, 0, game.dpr, 0, 0);
    ctx.fillStyle = "#0a1a2c";
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2 + cam.sx, H / 2 + cam.sy);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    terrain(game);
    fires(game);
    if (game.nest) nest(ctx, game.nest, game.time);
    meteors(game, "ground");

    // 收集可见对象并按 y 排序
    buf.length = 0;
    var w = game.world, TILE = w.tile, v = game.view;
    var c0 = Math.max(0, Math.floor((v.x0 - 64) / TILE)), c1 = Math.min(w.cols - 1, Math.floor((v.x1 + 64) / TILE));
    var r0 = Math.max(0, Math.floor((v.y0 - 96) / TILE)), r1 = Math.min(w.rows - 1, Math.floor((v.y1 + 64) / TILE));
    for (var y = r0; y <= r1; y++) {
      for (var x = c0; x <= c1; x++) {
        var b = w.buckets[y * w.cols + x];
        if (b) for (var k = 0; k < b.length; k++) buf.push(b[k]);
      }
    }
    for (var i = 0; i < game.creatures.length; i++) {
      var c = game.creatures[i];
      if (game.inView(c.x, c.y, 140)) buf.push(c);
    }
    var eg = game.eggs || [];
    for (var e = 0; e < eg.length; e++) buf.push({ kind: "egg", x: eg[e].x, y: eg[e].y, ref: eg[e] });
    buf.sort(function (a, b2) { return a.y - b2.y; });

    for (var n = 0; n < buf.length; n++) {
      var o = buf[n];
      if (o.def) {
        creature(ctx, o, game);
      } else if (o.kind === "egg") {
        egg(ctx, o, game.time);
      } else {
        prop(ctx, o, game.time, 1);
      }
    }

    projectiles(game);
    bars(game);
    game.fx.draw(ctx, cam.zoom);
    meteors(game, "air");
    flyers(game);
    ctx.restore();

    weather(game);
    lighting(game);
    vignette(game);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function preview(ctx, spKey, w, h, time) {
    var def = D.SPECIES[spKey];
    if (!def) return;
    var R = Math.min(h * 0.3, w * 0.19);
    var fake = {
      def: def, radius: R, scale: R / def.size, face: 0.15, phase: time * 0.5 + spKey.length,
      speedNow: 26, speed: 100, dead: false, hurtT: 0, atkAnim: 0, eatT: 0, roarT: 0, decay: 0
    };
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w * 0.46, h * 0.66);
    dino(ctx, fake, time);
    ctx.restore();
  }

  D.FX = FX;
  D.Render = { draw: draw, preview: preview, dino: dino, human: human, totem: totemArt, prop: prop };
})(window.DINO);
