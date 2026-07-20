import type { EngineTelemetry } from './core/EngineAudio';

const FIRING_ORDER = [1, 8, 4, 3, 6, 5, 7, 2];
const FIRE_ANGLE = new Map<number, number>();
const ORDER_IDX = new Map<number, number>();
FIRING_ORDER.forEach((cyl, i) => {
  FIRE_ANGLE.set(cyl, i * 90);
  ORDER_IDX.set(cyl, i);
});

const STROKES = [
  { name: 'P', label: '做功', color: '#ff7038' },
  { name: 'E', label: '排气', color: '#5a7290' },
  { name: 'I', label: '进气', color: '#3fae6a' },
  { name: 'C', label: '压缩', color: '#d8a832' }
];

const BANK_L = [1, 3, 5, 7];
const BANK_R = [2, 4, 6, 8];
const PIN_OFFSET = [0, 90, 270, 180];
const PIN_CYLS = [[1, 2], [3, 4], [5, 6], [7, 8]];

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class V8Viz {
  private ctx: CanvasRenderingContext2D;
  private tele: EngineTelemetry | null = null;
  private teleTime = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  update(t: EngineTelemetry) {
    this.tele = t;
    this.teleTime = performance.now();
  }

  private phaseNow(): number {
    if (!this.tele) return 0;
    const dt = (performance.now() - this.teleTime) / 1000;
    return (this.tele.phase + this.tele.rpm * 6 * Math.min(dt, 0.1)) % 720;
  }

  draw() {
    const g = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    const t = this.tele;
    const ph = this.phaseNow();

    g.clearRect(0, 0, W, H);
    g.fillStyle = '#0b0e17';
    g.fillRect(0, 0, W, H);

    this.drawCrank(g, 86, 122, 56, ph);
    this.drawBlock(g, ph, t);
    this.drawExhaust(g, t);
    this.drawBlower(g, t);
    this.drawFiringStrip(g, ph, t);

    g.fillStyle = '#5a6a80';
    g.font = '11px Consolas, monospace';
    g.textAlign = 'center';
    g.fillText(`CRANK ${(ph % 360).toFixed(0).padStart(3, '0')}\u00b0`, 86, 212);
    g.fillText(`CYCLE ${ph.toFixed(0).padStart(3, '0')} / 720\u00b0`, 86, 228);

    // supercharger indicator
    const blwr = t?.blower ?? 0;
    if (blwr > 0.01) {
      g.fillStyle = `rgba(180,${200 - blwr * 100},50,${0.4 + blwr * 0.5})`;
      g.font = 'bold 10px Consolas, monospace';
      g.fillText(`S/C ${(blwr * 100).toFixed(0)}%`, 86, 250);
      g.font = '8px Consolas, monospace';
      g.fillStyle = '#6a7a90';
      g.fillText(`x${(t!.rpm > 80 ? t!.rpm / (60 * t!.rpm / 60 / 2) : 2).toFixed(0) || 2}.0`, 86, 264);
    }

    g.textAlign = 'left';
    STROKES.forEach((s, i) => {
      const y = 262 + i * 17;
      g.fillStyle = s.color;
      g.fillRect(30, y - 8, 10, 10);
      g.fillStyle = '#6a7a90';
      g.font = '10px "Segoe UI", sans-serif';
      g.fillText(`${s.name} ${s.label}`, 46, y + 1);
    });
  }

  private drawCrank(g: CanvasRenderingContext2D, cx: number, cy: number, R: number, ph: number) {
    const rot = (ph % 360) * Math.PI / 180;

    g.strokeStyle = '#1e2432';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, cy, R + 14, 0, Math.PI * 2);
    g.stroke();

    g.save();
    g.translate(cx, cy);
    g.rotate(rot - Math.PI / 2);

    for (let i = 0; i < 4; i++) {
      const a = PIN_OFFSET[i] * Math.PI / 180;
      const px = Math.cos(a) * R, py = Math.sin(a) * R;
      g.strokeStyle = '#2c3648';
      g.lineWidth = 7;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(px, py);
      g.stroke();

      const firing = this.pinFiring(i);
      g.fillStyle = firing > 0.05 ? `rgba(255,112,56,${Math.min(1, 0.35 + firing * 0.5)})` : '#3a465c';
      g.beginPath();
      g.arc(px, py, 8, 0, Math.PI * 2);
      g.fill();

      g.fillStyle = '#0b0e17';
      g.font = 'bold 8px Consolas, monospace';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(`${PIN_CYLS[i][0]}${PIN_CYLS[i][1]}`, px, py);
    }

    g.fillStyle = '#4a5a75';
    g.beginPath();
    g.arc(0, 0, 10, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.textBaseline = 'alphabetic';

    const mark = rot - Math.PI / 2;
    g.strokeStyle = '#e8553a';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(cx + Math.cos(mark) * (R + 8), cy + Math.sin(mark) * (R + 8));
    g.lineTo(cx + Math.cos(mark) * (R + 20), cy + Math.sin(mark) * (R + 20));
    g.stroke();
  }

  private pinFiring(pinIdx: number): number {
    if (!this.tele) return 0;
    const [a, b] = PIN_CYLS[pinIdx];
    const ea = this.tele.env[ORDER_IDX.get(a)!] || 0;
    const eb = this.tele.env[ORDER_IDX.get(b)!] || 0;
    return Math.max(ea, eb);
  }

  private drawBlock(g: CanvasRenderingContext2D, ph: number, t: EngineTelemetry | null) {
    const x0 = 180, cylW = 86, gap = 9, cylH = 104;
    const rows: Array<{ cyls: number[]; y: number }> = [
      { cyls: BANK_L, y: 16 },
      { cyls: BANK_R, y: 132 }
    ];

    g.font = '10px Consolas, monospace';
    for (const row of rows) {
      row.cyls.forEach((cyl, i) => {
        const x = x0 + i * (cylW + gap);
        const y = row.y;
        const local = (ph - FIRE_ANGLE.get(cyl)! + 720) % 720;
        const strokeIdx = Math.floor(local / 180);
        const s = STROKES[strokeIdx];
        const env = t ? t.env[ORDER_IDX.get(cyl)!] || 0 : 0;

        rr(g, x, y, cylW, cylH, 6);
        g.fillStyle = '#12161f';
        g.fill();
        g.strokeStyle = '#232a3a';
        g.lineWidth = 1;
        g.stroke();

        rr(g, x, y, cylW, cylH, 6);
        g.fillStyle = s.color + '26';
        g.fill();

        if (env > 0.03) {
          const a = Math.min(0.85, env * 0.45);
          const grad = g.createRadialGradient(x + cylW / 2, y + 30, 4, x + cylW / 2, y + 30, 52);
          grad.addColorStop(0, `rgba(255,150,60,${a})`);
          grad.addColorStop(1, 'rgba(255,80,30,0)');
          g.fillStyle = grad;
          rr(g, x, y, cylW, cylH, 6);
          g.fill();
        }

        const pp = (1 - Math.cos((local % 360) * Math.PI / 180)) / 2;
        const trackTop = y + 16, trackH = cylH - 44;
        const py = trackTop + pp * trackH;
        g.strokeStyle = '#1c2230';
        g.lineWidth = 1;
        g.strokeRect(x + 14, trackTop - 2, cylW - 28, trackH + 18);
        g.fillStyle = env > 0.03 ? '#c8a488' : '#8a94a8';
        g.fillRect(x + 16, py, cylW - 32, 12);
        g.strokeStyle = '#4a5568';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x + cylW / 2, py + 12);
        g.lineTo(x + cylW / 2, trackTop + trackH + 14);
        g.stroke();

        g.fillStyle = '#6a7a90';
        g.textAlign = 'left';
        g.fillText(`#${cyl}`, x + 6, y + 12);
        g.fillStyle = s.color;
        g.textAlign = 'right';
        g.fillText(s.name, x + cylW - 6, y + 12);
      });

      g.fillStyle = '#4a5a75';
      g.font = '9px Consolas, monospace';
      g.textAlign = 'left';
      g.fillText(row.cyls === BANK_L ? 'BANK L (1-3-5-7)' : 'BANK R (2-4-6-8)', x0, row.y === 16 ? 12 : 128);
      g.font = '10px Consolas, monospace';
    }
  }

  private drawExhaust(g: CanvasRenderingContext2D, t: EngineTelemetry | null) {
    const glowL = t ? Math.min(1, t.radL * 7) : 0;
    const glowR = t ? Math.min(1, t.radR * 7) : 0;
    const draw = (y: number, glow: number) => {
      g.fillStyle = '#1a2130';
      g.fillRect(560, y, 26, 14);
      if (glow > 0.02) {
        g.fillStyle = `rgba(255,${120 + glow * 80},50,${glow * 0.9})`;
        g.fillRect(560, y, 26, 14);
      }
    };
    draw(60, glowL);
    draw(176, glowR);
  }

  private drawBlower(g: CanvasRenderingContext2D, t: EngineTelemetry | null) {
    const bw = t?.blower ?? 0;
    if (bw < 0.01) return;
    // blower housing at engine V center
    const bx = 332, by = 90, bwW = 72, bwH = 28;
    const glow = bw * (0.15 + (t ? Math.min(1, t.rpm / 6000) * 0.45 : 0));
    g.fillStyle = '#1a2130';
    g.fillRect(bx, by, bwW, bwH);
    if (glow > 0.02) {
      g.fillStyle = `rgba(130,180,${220 + glow * 20},${glow * 0.7})`;
      g.fillRect(bx, by, bwW, bwH);
    }
    g.strokeStyle = '#3a4a5a';
    g.lineWidth = 1;
    g.strokeRect(bx, by, bwW, bwH);
    g.fillStyle = '#8090a8';
    g.font = 'bold 8px Consolas, monospace';
    g.textAlign = 'center';
    g.fillText('ROOTS S/C', bx + bwW / 2, by + 17);
    // belt line from crank (86,122) toward blower
    const rpm = t?.rpm || 0;
    const blwrRPM = rpm * 2;
    const freq = blwrRPM / 60 * 3;
    g.fillStyle = '#5a6a7e';
    g.font = '7px Consolas, monospace';
    g.fillText(`${freq.toFixed(0)} Hz`, bx + bwW / 2, by - 5);
  }

  private drawFiringStrip(g: CanvasRenderingContext2D, ph: number, t: EngineTelemetry | null) {
    const active = Math.floor(ph / 90) % 8;
    const x0 = 180, w = 42, gap = 7, y = 258, h = 34;
    g.font = 'bold 13px Consolas, monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    FIRING_ORDER.forEach((cyl, i) => {
      const x = x0 + i * (w + gap);
      const on = t && i === active && t.rpm > 40;
      rr(g, x, y, w, h, 5);
      g.fillStyle = on ? 'rgba(232,85,58,0.22)' : '#12161f';
      g.fill();
      g.strokeStyle = on ? '#e8553a' : '#232a3a';
      g.lineWidth = on ? 2 : 1;
      g.stroke();
      g.fillStyle = on ? '#ff9a70' : '#5a6a80';
      g.fillText(String(cyl), x + w / 2, y + h / 2 + 1);
    });
    g.textBaseline = 'alphabetic';
    g.fillStyle = '#4a5a75';
    g.font = '9px Consolas, monospace';
    g.textAlign = 'left';
    g.fillText('FIRING ORDER', x0, y - 6);
  }
}
