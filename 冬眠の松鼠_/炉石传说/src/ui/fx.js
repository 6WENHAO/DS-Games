// ==== Canvas 特效层：瞄准箭头 / 粒子 / 飘字 ====

export class FX {
  constructor() {
    this.canvas = document.getElementById('fx-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.arrow = null; // {from:{x,y}, to:{x,y}}
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  resize() {
    this.canvas.width = innerWidth * devicePixelRatio;
    this.canvas.height = innerHeight * devicePixelRatio;
    this.canvas.style.width = innerWidth + 'px';
    this.canvas.style.height = innerHeight + 'px';
    this.ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  // ---------- 瞄准箭头 ----------
  showArrow(from, to) { this.arrow = { from, to }; }
  moveArrow(to) { if (this.arrow) this.arrow.to = to; }
  hideArrow() { this.arrow = null; }

  drawArrow() {
    if (!this.arrow) return;
    const { from, to } = this.arrow;
    const ctx = this.ctx;
    const dx = to.x - from.x, dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    if (len < 8) return;
    const ang = Math.atan2(dy, dx);

    ctx.save();
    ctx.translate(from.x, from.y);
    ctx.rotate(ang);

    const bodyLen = Math.max(0, len - 30);
    const grad = ctx.createLinearGradient(0, 0, len, 0);
    grad.addColorStop(0, 'rgba(255,90,40,0.25)');
    grad.addColorStop(0.7, 'rgba(255,60,30,0.85)');
    grad.addColorStop(1, 'rgba(255,40,20,1)');

    // 箭身（波浪虚线段）
    ctx.strokeStyle = grad;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.setLineDash([18, 12]);
    ctx.lineDashOffset = -performance.now() / 30;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(bodyLen * 0.5, -Math.min(60, len * 0.18), bodyLen, 0);
    ctx.stroke();
    ctx.setLineDash([]);

    // 箭头
    ctx.fillStyle = '#ff3b1e';
    ctx.strokeStyle = '#7a1204';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(len, 0);
    ctx.lineTo(len - 30, -14);
    ctx.lineTo(len - 22, 0);
    ctx.lineTo(len - 30, 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // ---------- 粒子 ----------
  burst(x, y, color, count = 18, speed = 5) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (0.4 + Math.random() * 0.6) * speed;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 1.2,
        size: 2.5 + Math.random() * 4,
        life: 1,
        decay: 0.02 + Math.random() * 0.025,
        color,
      });
    }
  }

  sparkle(x, y, color = '#ffd76e', count = 14) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 34;
      this.particles.push({
        x: x + Math.cos(a) * r,
        y: y + Math.sin(a) * r,
        vx: 0, vy: -0.6 - Math.random(),
        size: 1.5 + Math.random() * 2.5,
        life: 1,
        decay: 0.018 + Math.random() * 0.02,
        color,
        star: true,
      });
    }
  }

  loop() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    this.drawArrow();
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.life -= p.decay;
      if (p.life <= 0) continue;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      if (p.star) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.life * 4);
        ctx.fillRect(-p.size, -p.size / 3, p.size * 2, p.size / 1.5);
        ctx.fillRect(-p.size / 3, -p.size, p.size / 1.5, p.size * 2);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    this.particles = this.particles.filter(p => p.life > 0);
    requestAnimationFrame(this.loop);
  }

  // ---------- 飘字 ----------
  floatNumber(x, y, text, cls = '') {
    const n = document.createElement('div');
    n.className = `float-num ${cls}`;
    n.textContent = text;
    n.style.left = x + 'px';
    n.style.top = y + 'px';
    document.getElementById('overlay-root').appendChild(n);
    setTimeout(() => n.remove(), 950);
  }
}
