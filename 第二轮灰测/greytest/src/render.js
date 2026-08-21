/* =====================================================================
 * render.js —— 小车-倒立摆动画渲染
 * ---------------------------------------------------------------------
 * 画面上刻意保留了教学所需的全部"物理证据"：
 *   · 导轨刻度与限位（撞限位就是控制失败，学生要能看见）
 *   · 驱动力箭头（长度 ∝ |u|，饱和时变红闪烁）
 *   · 倾角圆弧 + 内环给定角 θ_ref（串级 PID 时能看到外环在"命令倾斜"）
 *   · 摆尖拖尾（直观显示轨迹与振荡）
 *   · 风力箭头、位置目标标记
 * 对比模式下上下两条轨道同时演示两种控制器，扰动完全相同。
 * ===================================================================== */
(function (global) {
  'use strict';
  const CP = global.CartPole;

  const COL = {
    bgTop: '#151b28', bgBot: '#0d1220',
    rail: '#2a3549', railEdge: '#4a5b7a', tick: '#3a4760', tickText: '#7c8ca8',
    cart: '#3d6ea8', cartEdge: '#7fb2e8', wheel: '#22304a',
    pole: '#e0a84c', poleEdge: '#f5d090', bob: '#f0c46a',
    force: '#5fd08a', forceSat: '#ff5a5a', wind: '#6fa8dc',
    target: '#c86fd8', text: '#c8d6ea', dim: '#7c8ca8',
    trail: 'rgba(224,168,76,0.35)', fail: '#ff5a5a'
  };

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.trails = [[], []];
      this.blink = 0;
    }
    clearTrails() { this.trails = [[], []]; }

    /* lanes: [{ s, u, p, label, color, info, failed, xRef, wind, thetaRef }] */
    draw(lanes, opts) {
      opts = opts || {};
      const dpr = Math.max(1, Math.min(3, global.devicePixelRatio || 1));
      const rect = this.canvas.getBoundingClientRect();
      const w = Math.max(200, Math.round(rect.width)), h = Math.max(160, Math.round(rect.height));
      if (this.canvas.width !== w * dpr || this.canvas.height !== h * dpr) {
        this.canvas.width = w * dpr; this.canvas.height = h * dpr;
      }
      const ctx = this.canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.blink = (this.blink + 1) % 60;

      // 背景
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, COL.bgTop); grad.addColorStop(1, COL.bgBot);
      ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);

      const n = lanes.length;
      const laneH = h / n;
      for (let i = 0; i < n; i++) {
        this.drawLane(ctx, w, laneH, i * laneH, lanes[i], i, n > 1);
      }
      if (n > 1) {
        ctx.strokeStyle = '#26314a'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, laneH); ctx.lineTo(w, laneH); ctx.stroke();
      }
    }

    drawLane(ctx, w, h, yOff, lane, laneIdx, compact) {
      const p = lane.p, s = lane.s;
      const railHalf = p.railHalf;
      const margin = 46;
      const scale = (w - 2 * margin) / (2 * railHalf * 1.06);      // 像素/米
      const cx = w / 2;                                            // x=0 的屏幕坐标
      const railY = yOff + h * (compact ? 0.74 : 0.78);
      const X = (xm) => cx + xm * scale;

      // ---- 导轨 ----
      ctx.fillStyle = COL.rail;
      ctx.fillRect(X(-railHalf) - 6, railY, 2 * railHalf * scale + 12, 7);
      ctx.strokeStyle = COL.railEdge; ctx.lineWidth = 1;
      ctx.strokeRect(X(-railHalf) - 6, railY, 2 * railHalf * scale + 12, 7);
      // 限位块
      for (const sgn of [-1, 1]) {
        ctx.fillStyle = '#54324a';
        ctx.fillRect(X(sgn * railHalf) + (sgn > 0 ? 6 : -14), railY - 16, 8, 23);
      }
      // 刻度
      ctx.strokeStyle = COL.tick; ctx.fillStyle = COL.tickText;
      ctx.font = '9px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      const tickStep = railHalf > 0.8 ? 0.5 : 0.2;
      for (let xm = -Math.floor(railHalf / tickStep) * tickStep; xm <= railHalf + 1e-9; xm += tickStep) {
        ctx.beginPath(); ctx.moveTo(X(xm), railY + 7); ctx.lineTo(X(xm), railY + 12); ctx.stroke();
        if (!compact || Math.abs(xm) > 1e-9) ctx.fillText(xm.toFixed(1), X(xm), railY + 13);
      }

      // ---- 位置目标 ----
      if (lane.xRef !== undefined) {
        const tx = X(lane.xRef);
        ctx.fillStyle = COL.target;
        ctx.beginPath(); ctx.moveTo(tx, railY - 3); ctx.lineTo(tx - 6, railY - 14); ctx.lineTo(tx + 6, railY - 14); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = COL.target; ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(tx, yOff + 8); ctx.lineTo(tx, railY); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
      }

      // ---- 小车 ----
      const cw = Math.max(30, 0.16 * scale), ch = Math.max(16, 0.075 * scale);
      const cxp = X(s[0]), cyp = railY - ch / 2 + 1;
      ctx.save();
      ctx.fillStyle = COL.cart; ctx.strokeStyle = COL.cartEdge; ctx.lineWidth = 1.5;
      roundRect(ctx, cxp - cw / 2, cyp - ch / 2, cw, ch, 4);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = COL.wheel;
      for (const dx of [-cw * 0.28, cw * 0.28]) {
        ctx.beginPath(); ctx.arc(cxp + dx, cyp + ch / 2, Math.max(3, ch * 0.22), 0, 2 * Math.PI); ctx.fill();
      }
      ctx.restore();

      // ---- 摆杆 ----
      const L = p.L * scale;
      const pivotX = cxp, pivotY = cyp - ch / 2 + 1;
      // θ 从竖直向上量起，正方向 = 向 +x 倾倒（与 model.js 约定一致）
      const tipX = pivotX + L * Math.sin(s[2]);
      const tipY = pivotY - L * Math.cos(s[2]);

      // 拖尾
      const tr = this.trails[laneIdx];
      tr.push([tipX, tipY]);
      if (tr.length > 260) tr.shift();
      ctx.lineWidth = 1.6;
      for (let i = 1; i < tr.length; i++) {
        const a = i / tr.length;
        ctx.strokeStyle = `rgba(224,168,76,${(0.30 * a).toFixed(3)})`;
        ctx.beginPath(); ctx.moveTo(tr[i - 1][0], tr[i - 1][1]); ctx.lineTo(tr[i][0], tr[i][1]); ctx.stroke();
      }

      // 竖直参考线与倾角圆弧
      ctx.strokeStyle = 'rgba(140,160,190,0.30)'; ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pivotX, pivotY); ctx.lineTo(pivotX, pivotY - L * 1.12); ctx.stroke();
      ctx.setLineDash([]);
      const th = CP.wrapPi(s[2]);
      if (Math.abs(th) > 0.01) {
        ctx.strokeStyle = 'rgba(200,214,234,0.5)'; ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(pivotX, pivotY, L * 0.42, -Math.PI / 2, -Math.PI / 2 + th, th < 0);
        ctx.stroke();
      }
      // 内环给定角（串级 PID 才有）
      if (lane.thetaRef !== undefined && Math.abs(lane.thetaRef) > 1e-4) {
        ctx.strokeStyle = 'rgba(200,111,216,0.75)'; ctx.setLineDash([5, 3]); ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(pivotX, pivotY);
        ctx.lineTo(pivotX + L * 0.75 * Math.sin(lane.thetaRef), pivotY - L * 0.75 * Math.cos(lane.thetaRef));
        ctx.stroke(); ctx.setLineDash([]);
      }

      // 杆
      ctx.lineCap = 'round';
      ctx.strokeStyle = COL.pole; ctx.lineWidth = Math.max(5, 0.022 * scale);
      ctx.beginPath(); ctx.moveTo(pivotX, pivotY); ctx.lineTo(tipX, tipY); ctx.stroke();
      ctx.strokeStyle = COL.poleEdge; ctx.lineWidth = Math.max(1.5, 0.006 * scale);
      ctx.beginPath(); ctx.moveTo(pivotX, pivotY); ctx.lineTo(tipX, tipY); ctx.stroke();
      ctx.lineCap = 'butt';
      // 摆尖配重与转轴
      ctx.fillStyle = COL.bob;
      ctx.beginPath(); ctx.arc(tipX, tipY, Math.max(5, 0.028 * scale), 0, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = '#1b2436'; ctx.strokeStyle = COL.cartEdge; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(pivotX, pivotY, 3.6, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();

      // ---- 驱动力箭头 ----
      const u = lane.u || 0;
      if (Math.abs(u) > 1e-3) {
        const sat = Math.abs(u) >= p.uMax * 0.999;
        const len = Math.min(1, Math.abs(u) / p.uMax) * Math.max(34, 0.34 * scale);
        const dir = Math.sign(u);
        const ay = cyp;
        const blink = sat && this.blink < 30;
        ctx.strokeStyle = sat ? (blink ? COL.forceSat : '#ff9a9a') : COL.force;
        ctx.fillStyle = ctx.strokeStyle;
        ctx.lineWidth = 3;
        const x0 = cxp + dir * (cw / 2 + 3), x1 = x0 + dir * len;
        ctx.beginPath(); ctx.moveTo(x0, ay); ctx.lineTo(x1, ay); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x1 + dir * 7, ay); ctx.lineTo(x1, ay - 5); ctx.lineTo(x1, ay + 5); ctx.closePath(); ctx.fill();
        ctx.font = '10px ui-monospace, monospace'; ctx.textAlign = dir > 0 ? 'left' : 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`${u >= 0 ? '+' : ''}${u.toFixed(1)} N${sat ? ' 饱和!' : ''}`, x1 + dir * 10, ay - 2);
      }

      // ---- 风力 ----
      if (lane.wind && Math.abs(lane.wind) > 1e-6) {
        ctx.strokeStyle = COL.wind; ctx.globalAlpha = 0.8; ctx.lineWidth = 2;
        const dir = Math.sign(lane.wind);
        const wy = yOff + h * 0.2;
        for (let k = 0; k < 3; k++) {
          const bx = cx - dir * 70 + k * dir * 26;
          const yy = wy + k * 9;
          ctx.beginPath(); ctx.moveTo(bx, yy); ctx.lineTo(bx + dir * 18, yy); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(bx + dir * 18, yy); ctx.lineTo(bx + dir * 12, yy - 3); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(bx + dir * 18, yy); ctx.lineTo(bx + dir * 12, yy + 3); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = COL.wind; ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(`风扰 ${lane.wind.toFixed(1)} N`, cx - dir * 70 - 4, wy + 30);
      }

      // ---- 文字 ----
      ctx.font = '12px system-ui, "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillStyle = lane.color || COL.text;
      ctx.fillText(lane.label || '', 10, yOff + 8);
      ctx.font = '11px ui-monospace, Consolas, monospace';
      ctx.fillStyle = COL.dim;
      const deg = (th * 180 / Math.PI).toFixed(2);
      ctx.fillText(`θ=${deg}°  x=${s[0].toFixed(3)} m  θ̇=${s[3].toFixed(2)} rad/s  u=${(lane.u || 0).toFixed(2)} N`, 10, yOff + 24);
      if (lane.extra) ctx.fillText(lane.extra, 10, yOff + 38);

      // ---- 失败横幅 ----
      if (lane.failed) {
        ctx.fillStyle = 'rgba(255,90,90,0.13)';
        ctx.fillRect(0, yOff, this.canvas.width, h);
        ctx.fillStyle = COL.fail;
        ctx.font = 'bold 16px system-ui, "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(lane.failed, this.canvas.getBoundingClientRect().width / 2, yOff + h * 0.32);
      }
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  global.Renderer = Renderer;
})(typeof window !== 'undefined' ? window : globalThis);
