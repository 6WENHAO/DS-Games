// Canvas2D anime face texture: big eyes with highlights, lashes, brows, mouth, blush.
// One 512x576 texture per character. The top 512 rows are the face patch; the bottom
// 64 rows are a utility strip whose white block is what every body vertex samples, so a
// whole character can be a single draw call (vertexColor * white).
import * as THREE from 'three';
import { clamp, lerp } from '../core/utils.js';

export const FACE_W = 512;
export const FACE_H = 576;
export const FACE_REGION = 512;                        // face occupies canvas rows 0..511
export const FACE_V0 = (FACE_H - FACE_REGION) / FACE_H; // uv.v of the face bottom edge
export const WHITE_UV = [32 / FACE_W, 32 / FACE_H];     // centre of the white block

// face layout, in canvas pixels inside the 512x512 face region
export const F = {
  cx: 256,
  browY: 124, browW: 98, browTh: 16,
  eyeY: 250, eyeDX: 102, eyeHW: 63, eyeHH: 56,
  noseY: 342, mouthY: 402,
  blushY: 330, blushDX: 146,
};

const EXPR = {
  normal:    { browY: 0,   browTilt: 0,   arch: 1.00, eyeH: 1.00, lid: 0.00, pupil: 1.00, mouth: 'smile',  closed: false },
  happy:     { browY: -6,  browTilt: -4,  arch: 1.18, eyeH: 0.84, lid: 0.10, pupil: 1.06, mouth: 'grin',   closed: false },
  angry:     { browY: 10,  browTilt: 18,  arch: 0.70, eyeH: 0.96, lid: 0.20, pupil: 0.88, mouth: 'frown',  closed: false },
  sad:       { browY: 4,   browTilt: -16, arch: 0.78, eyeH: 0.90, lid: 0.26, pupil: 1.12, mouth: 'sad',    closed: false },
  surprised: { browY: -16, browTilt: -5,  arch: 1.32, eyeH: 1.14, lid: 0.00, pupil: 1.18, mouth: 'oh',     closed: false },
  closed:    { browY: -3,  browTilt: 0,   arch: 1.00, eyeH: 1.00, lid: 0.00, pupil: 1.00, mouth: 'smile',  closed: true },
};
export const EXPRESSIONS = Object.keys(EXPR);

// ------------------------------------------------------------------ colour utils
function ch(hex, i) { return (hex >> (16 - i * 8)) & 255; }
function mixHex(a, b, t) {
  const r = Math.round(lerp(ch(a, 0), ch(b, 0), t));
  const g = Math.round(lerp(ch(a, 1), ch(b, 1), t));
  const bl = Math.round(lerp(ch(a, 2), ch(b, 2), t));
  return (r << 16) | (g << 8) | bl;
}
export const lighten = (hex, t) => mixHex(hex, 0xffffff, t);
export const darken = (hex, t) => mixHex(hex, 0x000000, t);
function rgba(hex, a) { return 'rgba(' + ch(hex, 0) + ',' + ch(hex, 1) + ',' + ch(hex, 2) + ',' + a + ')'; }
function solid(hex) { return 'rgb(' + ch(hex, 0) + ',' + ch(hex, 1) + ',' + ch(hex, 2) + ')'; }

// ------------------------------------------------------------------ eye drawing
function eyeOutline(g, bx, by, hw, hh, s) {
  const X = (n) => bx + s * n * hw, Y = (n) => by + n * hh;
  g.beginPath();
  g.moveTo(X(-1.00), Y(0.30));
  g.bezierCurveTo(X(-0.94), Y(-0.40), X(-0.58), Y(-0.98), X(-0.04), Y(-1.00));
  g.bezierCurveTo(X(0.46), Y(-1.02), X(0.88), Y(-0.74), X(1.00), Y(-0.24));
  g.bezierCurveTo(X(0.94), Y(0.30), X(0.52), Y(0.76), X(0.00), Y(0.80));
  g.bezierCurveTo(X(-0.52), Y(0.82), X(-0.90), Y(0.62), X(-1.00), Y(0.30));
  g.closePath();
}
function upperLidPath(g, bx, by, hw, hh, s) {
  const X = (n) => bx + s * n * hw, Y = (n) => by + n * hh;
  g.beginPath();
  g.moveTo(X(-1.02), Y(0.26));
  g.bezierCurveTo(X(-0.94), Y(-0.42), X(-0.58), Y(-1.00), X(-0.04), Y(-1.02));
  g.bezierCurveTo(X(0.48), Y(-1.04), X(0.90), Y(-0.76), X(1.06), Y(-0.26));
}

/** One eye. o = openness 0..1, gz = gaze offset (-1..1). */
function drawEye(g, pal, ex, s, o, gz) {
  const bx = F.cx + s * F.eyeDX, by = F.eyeY;
  const hw = F.eyeHW, hh = F.eyeHH * ex.eyeH;
  const lash = pal.lash, iris = pal.eye;
  const lowY = by + 0.80 * hh;

  if (ex.closed || o < 0.06) {
    const up = (ex.mouth === 'grin' || ex.closed) ? -0.26 : 0.10;
    g.save();
    g.strokeStyle = solid(lash); g.lineCap = 'round'; g.lineJoin = 'round';
    g.lineWidth = 10;
    g.beginPath();
    g.moveTo(bx - s * hw * 1.0, by + hh * (0.24 + up * 0.4));
    g.quadraticCurveTo(bx - s * hw * 0.05, by + hh * (0.46 + up * 2.0), bx + s * hw * 1.02, by + hh * (0.06 + up * 0.5));
    g.stroke();
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(bx + s * hw * 0.96, by + hh * (0.10 + up * 0.5));
    g.lineTo(bx + s * hw * 1.30, by - hh * 0.24);
    g.stroke();
    g.restore();
    return;
  }

  g.save();
  if (o < 0.999) { g.translate(0, lowY); g.scale(1, o); g.translate(0, -lowY); }

  eyeOutline(g, bx, by, hw, hh, s);
  g.save();
  g.clip();
  let grd = g.createLinearGradient(0, by - hh, 0, by + hh);
  grd.addColorStop(0, solid(mixHex(pal.sclera, 0xb8a7ac, 0.42)));
  grd.addColorStop(0.42, solid(pal.sclera));
  grd.addColorStop(1, solid(lighten(pal.sclera, 0.4)));
  g.fillStyle = grd; g.fillRect(bx - hw * 1.5, by - hh * 1.5, hw * 3, hh * 3);

  const ix = bx + s * gz.x * hw * 0.20, iy = by - hh * 0.04 + gz.y * hh * 0.16;
  const irx = hw * 0.62, iry = hh * 0.88 * clamp(ex.pupil, 0.6, 1.4);
  grd = g.createLinearGradient(0, iy - iry, 0, iy + iry);
  grd.addColorStop(0, solid(darken(iris, 0.58)));
  grd.addColorStop(0.38, solid(darken(iris, 0.16)));
  grd.addColorStop(0.74, solid(iris));
  grd.addColorStop(1, solid(lighten(iris, 0.52)));
  g.fillStyle = grd;
  g.beginPath(); g.ellipse(ix, iy, irx, iry, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = rgba(darken(iris, 0.68), 0.85); g.lineWidth = 5;
  g.beginPath(); g.ellipse(ix, iy, irx, iry, 0, 0, Math.PI * 2); g.stroke();
  g.fillStyle = rgba(lighten(iris, 0.75), 0.5);
  g.beginPath(); g.ellipse(ix, iy + iry * 0.48, irx * 0.66, iry * 0.34, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = rgba(darken(iris, 0.86), 0.95);
  g.beginPath(); g.ellipse(ix, iy - iry * 0.06, irx * 0.30, iry * 0.44, 0, 0, Math.PI * 2); g.fill();
  grd = g.createLinearGradient(0, by - hh * 1.05, 0, by + hh * 0.15);
  grd.addColorStop(0, rgba(pal.socket, 0.72));
  grd.addColorStop(0.55, rgba(pal.socket, 0.20));
  grd.addColorStop(1, rgba(pal.socket, 0.0));
  g.fillStyle = grd; g.fillRect(bx - hw * 1.5, by - hh * 1.5, hw * 3, hh * 2.4);
  g.fillStyle = 'rgba(255,255,255,0.96)';
  g.beginPath(); g.ellipse(ix - s * irx * 0.42, iy - iry * 0.40, irx * 0.30, iry * 0.24, s * 0.35, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.72)';
  g.beginPath(); g.ellipse(ix + s * irx * 0.34, iy + iry * 0.34, irx * 0.17, iry * 0.13, 0, 0, Math.PI * 2); g.fill();
  g.restore();

  g.lineCap = 'round'; g.lineJoin = 'round';
  upperLidPath(g, bx, by, hw, hh, s);
  g.strokeStyle = solid(lash); g.lineWidth = 13 - 4 * ex.lid; g.stroke();
  g.beginPath();
  g.moveTo(bx + s * hw * 0.78, by - hh * 0.72);
  g.quadraticCurveTo(bx + s * hw * 1.22, by - hh * 0.86, bx + s * hw * 1.46, by - hh * 0.34);
  g.lineTo(bx + s * hw * 1.02, by - hh * 0.20);
  g.closePath();
  g.fillStyle = solid(lash); g.fill();
  g.strokeStyle = rgba(mixHex(lash, pal.skin, 0.28), 0.85); g.lineWidth = 4.5;
  g.beginPath();
  g.moveTo(bx + s * hw * 1.02, by - hh * 0.20);
  g.bezierCurveTo(bx + s * hw * 0.92, by + hh * 0.34, bx + s * hw * 0.50, by + hh * 0.80, bx - s * hw * 0.06, by + hh * 0.82);
  g.stroke();
  g.strokeStyle = rgba(pal.socket, 0.34); g.lineWidth = 4;
  g.beginPath();
  g.moveTo(bx - s * hw * 0.82, by - hh * 0.92);
  g.quadraticCurveTo(bx + s * hw * 0.10, by - hh * 1.34, bx + s * hw * 1.06, by - hh * 0.62);
  g.stroke();
  g.restore();
}

// ------------------------------------------------------------------ brows / mouth
function drawBrow(g, pal, ex, s) {
  const bx = F.cx + s * F.eyeDX, by = F.browY + ex.browY;
  const hw = F.browW * 0.5, th = F.browTh;
  const tan = Math.tan(ex.browTilt * (Math.PI / 180));
  const N = 14, pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, x = -1 + 2 * t;
    const arc = -Math.sin(Math.PI * Math.pow(t, 0.85)) * 9 * ex.arch;
    pts.push([bx + s * x * hw, by + arc - x * hw * tan]);
  }
  const wAt = (t) => th * (0.35 + 0.65 * Math.pow(1 - t, 0.75)) * (0.30 + 0.9 * Math.min(1, t * 6));
  g.beginPath();
  for (let i = 0; i <= N; i++) { const p = pts[i], w = wAt(i / N); if (i === 0) g.moveTo(p[0], p[1] - w * 0.5); else g.lineTo(p[0], p[1] - w * 0.5); }
  for (let i = N; i >= 0; i--) { const p = pts[i], w = wAt(i / N); g.lineTo(p[0], p[1] + w * 0.5); }
  g.closePath();
  const grd = g.createLinearGradient(bx - s * hw, 0, bx + s * hw, 0);
  grd.addColorStop(0, rgba(pal.brow, 0.94));
  grd.addColorStop(1, rgba(pal.brow, 0.70));
  g.fillStyle = grd; g.fill();
}

function drawMouth(g, pal, kind) {
  const cx = F.cx, cy = F.mouthY;
  const lip = pal.lip, dark = darken(lip, 0.5);
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (kind === 'grin' || kind === 'oh') {
    const w = kind === 'grin' ? 34 : 19, h = kind === 'grin' ? 20 : 22;
    g.beginPath();
    if (kind === 'grin') {
      g.moveTo(cx - w, cy - 5);
      g.quadraticCurveTo(cx, cy + h * 1.45, cx + w, cy - 5);
      g.quadraticCurveTo(cx, cy + 2, cx - w, cy - 5);
    } else {
      g.ellipse(cx, cy + 2, w, h, 0, 0, Math.PI * 2);
    }
    g.closePath();
    g.fillStyle = solid(darken(lip, 0.62)); g.fill();
    g.save(); g.clip();
    g.fillStyle = solid(mixHex(lip, 0xff8fa0, 0.55));
    g.beginPath(); g.ellipse(cx, cy + h * 1.05, w * 0.85, h * 0.72, 0, 0, Math.PI * 2); g.fill();
    g.restore();
    g.strokeStyle = rgba(dark, 0.9); g.lineWidth = 3.5;
    g.beginPath();
    g.moveTo(cx - w, cy - 5);
    g.quadraticCurveTo(cx, cy + (kind === 'grin' ? h * 1.45 : h * 1.1), cx + w, cy - 5);
    g.stroke();
    return;
  }
  g.strokeStyle = solid(dark); g.lineWidth = 5.5;
  g.beginPath();
  if (kind === 'frown') {
    g.moveTo(cx - 24, cy + 7); g.quadraticCurveTo(cx, cy - 8, cx + 24, cy + 7);
  } else if (kind === 'sad') {
    g.moveTo(cx - 21, cy + 4); g.quadraticCurveTo(cx - 7, cy - 6, cx, cy + 3);
    g.quadraticCurveTo(cx + 7, cy + 10, cx + 21, cy + 1);
  } else {
    g.moveTo(cx - 22, cy - 4); g.quadraticCurveTo(cx, cy + 12, cx + 22, cy - 4);
  }
  g.stroke();
  g.strokeStyle = rgba(lighten(lip, 0.55), 0.5); g.lineWidth = 2.4;
  g.beginPath(); g.moveTo(cx - 10, cy + 11); g.quadraticCurveTo(cx, cy + 15, cx + 10, cy + 11); g.stroke();
}

// ------------------------------------------------------------------ base layer
function drawBase(g, pal) {
  g.clearRect(0, 0, FACE_W, FACE_H);
  g.fillStyle = '#ffffff'; g.fillRect(0, FACE_REGION, FACE_W, FACE_H - FACE_REGION);
  g.fillStyle = solid(pal.skin); g.fillRect(0, 0, FACE_W, FACE_REGION);
  let grd = g.createLinearGradient(0, 0, 0, 190);
  grd.addColorStop(0, rgba(pal.shadow, 0.24));
  grd.addColorStop(0.55, rgba(pal.shadow, 0.08));
  grd.addColorStop(1, rgba(pal.shadow, 0));
  g.fillStyle = grd; g.fillRect(0, 0, FACE_W, 190);
  grd = g.createLinearGradient(0, 0, 130, 0);
  grd.addColorStop(0, rgba(pal.shadow, 0.18)); grd.addColorStop(1, rgba(pal.shadow, 0));
  g.fillStyle = grd; g.fillRect(0, 0, 130, FACE_REGION);
  grd = g.createLinearGradient(FACE_W, 0, FACE_W - 130, 0);
  grd.addColorStop(0, rgba(pal.shadow, 0.18)); grd.addColorStop(1, rgba(pal.shadow, 0));
  g.fillStyle = grd; g.fillRect(FACE_W - 130, 0, 130, FACE_REGION);
  grd = g.createLinearGradient(0, FACE_REGION, 0, FACE_REGION - 130);
  grd.addColorStop(0, rgba(pal.shadow, 0.28)); grd.addColorStop(1, rgba(pal.shadow, 0));
  g.fillStyle = grd; g.fillRect(0, FACE_REGION - 130, FACE_W, 130);
  for (const s of [-1, 1]) {
    const bx = F.cx + s * F.blushDX;
    grd = g.createRadialGradient(bx, F.blushY, 2, bx, F.blushY, 78);
    grd.addColorStop(0, rgba(pal.blush, 0.42));
    grd.addColorStop(0.6, rgba(pal.blush, 0.16));
    grd.addColorStop(1, rgba(pal.blush, 0));
    g.fillStyle = grd;
    g.beginPath(); g.ellipse(bx, F.blushY, 78, 52, 0, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = rgba(pal.shadow, 0.26);
  g.beginPath();
  g.moveTo(F.cx - 7, F.noseY + 5); g.quadraticCurveTo(F.cx, F.noseY - 12, F.cx + 7, F.noseY + 5);
  g.quadraticCurveTo(F.cx, F.noseY + 9, F.cx - 7, F.noseY + 5);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.20)';
  g.beginPath(); g.ellipse(F.cx - 1, F.noseY - 12, 4.5, 9, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = rgba(pal.blush, 0.28); g.lineWidth = 3;
  for (const s of [-1, 1]) {
    const bx = F.cx + s * F.eyeDX;
    g.beginPath();
    g.moveTo(bx - 34, F.eyeY + 74); g.quadraticCurveTo(bx + s * 6, F.eyeY + 84, bx + 34, F.eyeY + 72);
    g.stroke();
  }
}

/** Character specific marks drawn on top of the eyes. */
function drawMarks(g, pal, def) {
  const mark = def.faceMark;
  if (mark === 'eyepatch') {
    const bx = F.cx + F.eyeDX + 4, by = F.eyeY - 2;
    const pc = pal.patch || 0x2b3350;
    g.save();
    g.strokeStyle = solid(darken(pc, 0.25)); g.lineWidth = 22; g.lineCap = 'round';
    g.beginPath(); g.moveTo(bx + 70, by - 26); g.lineTo(FACE_W + 20, by - 74); g.stroke();
    g.beginPath(); g.moveTo(bx - 74, by - 4); g.lineTo(-20, by - 46); g.stroke();
    g.fillStyle = solid(pc);
    g.beginPath(); g.ellipse(bx, by, 92, 78, -0.08, 0, Math.PI * 2); g.fill();
    g.fillStyle = rgba(0x18203a, 0.5);
    g.beginPath(); g.ellipse(bx + 18, by + 16, 60, 48, -0.1, 0, Math.PI * 2); g.fill();
    g.strokeStyle = rgba(0xd8c690, 0.8); g.lineWidth = 5;
    g.beginPath(); g.ellipse(bx, by, 92, 78, -0.08, 0, Math.PI * 2); g.stroke();
    g.restore();
  } else if (mark === 'freckles') {
    g.fillStyle = rgba(darken(pal.blush, 0.25), 0.5);
    for (const s of [-1, 1]) for (let i = 0; i < 5; i++) {
      const bx = F.cx + s * (F.blushDX - 26 + (i % 3) * 22), by = F.blushY - 12 + ((i * 37) % 30);
      g.beginPath(); g.ellipse(bx, by, 3.4, 2.8, 0, 0, Math.PI * 2); g.fill();
    }
  }
}

// ------------------------------------------------------------------ palette
export function facePalette(def) {
  const c = def.col || {};
  const skin = c.skin != null ? c.skin : 0xf7dcc6;
  const hair = c.hair != null ? c.hair : 0xd8c9a4;
  return {
    skin,
    shadow: mixHex(darken(skin, 0.30), 0xc07a68, 0.45),
    blush: c.blush != null ? c.blush : 0xf08a90,
    sclera: 0xfdf7f2,
    socket: mixHex(0x5b3a46, skin, 0.22),
    lash: c.lash != null ? c.lash : mixHex(darken(hair, 0.70), 0x241a20, 0.55),
    brow: c.brow != null ? c.brow : darken(hair, 0.46),
    eye: c.eye != null ? c.eye : 0xc9a86a,
    lip: mixHex(0xd0666e, skin, 0.25),
    patch: c.cape != null ? c.cape : 0x2b3350,
  };
}

const EYE_RECT = { x: 52, y: 166, w: 408, h: 182 };

/** Map face-patch parameters (0..1) to texture uv. */
export function facePatchUV(u01, v01, out) {
  out[0] = u01;
  out[1] = FACE_V0 + v01 * (1 - FACE_V0);
  return out;
}

// ------------------------------------------------------------------ FaceTexture
export class FaceTexture {
  constructor(def) {
    this.def = def;
    this.pal = facePalette(def);
    this.canvas = document.createElement('canvas');
    this.canvas.width = FACE_W; this.canvas.height = FACE_H;
    this.g = this.canvas.getContext('2d');
    this.base = document.createElement('canvas');
    this.base.width = FACE_W; this.base.height = FACE_H;
    drawBase(this.base.getContext('2d'), this.pal);

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.wrapS = this.texture.wrapT = THREE.ClampToEdgeWrapping;
    this.texture.anisotropy = 4;

    this.expr = 'normal';
    this.open = 1;
    this.gaze = { x: 0, y: 0 };
    this.blinkEnabled = true;
    this.blinkTimer = 1.2 + Math.random() * 3.0;
    this.blinkT = -1;
    this._lo = 1; this._lgx = 0; this._lgy = 0;
    this.redrawAll();
  }

  get ex() { return EXPR[this.expr] || EXPR.normal; }

  drawFeatures() {
    const g = this.g, p = this.pal, e = this.ex;
    drawEye(g, p, e, -1, this.open, this.gaze);
    drawEye(g, p, e, 1, this.open, this.gaze);
    drawMarks(g, p, this.def);
  }

  redrawAll() {
    const g = this.g, p = this.pal, e = this.ex;
    g.clearRect(0, 0, FACE_W, FACE_H);
    g.drawImage(this.base, 0, 0);
    drawBrow(g, p, e, -1);
    drawBrow(g, p, e, 1);
    drawMouth(g, p, e.mouth);
    this.drawFeatures();
    this._lo = this.open; this._lgx = this.gaze.x; this._lgy = this.gaze.y;
    this.texture.needsUpdate = true;
  }

  /** Cheap partial redraw: only the eye band is repainted from the cached base layer. */
  redrawEyes() {
    const g = this.g, R = EYE_RECT;
    g.save();
    g.beginPath(); g.rect(R.x, R.y, R.w, R.h); g.clip();
    g.clearRect(R.x, R.y, R.w, R.h);
    g.drawImage(this.base, R.x, R.y, R.w, R.h, R.x, R.y, R.w, R.h);
    this.drawFeatures();
    g.restore();
    this._lo = this.open; this._lgx = this.gaze.x; this._lgy = this.gaze.y;
    this.texture.needsUpdate = true;
  }

  setExpression(name) {
    if (!EXPR[name]) name = 'normal';
    if (name === this.expr) return;
    this.expr = name;
    this.redrawAll();
  }

  /** on = automatic blinking. Turning it off leaves the eyes open. */
  setBlink(on) {
    this.blinkEnabled = on !== false;
    if (!this.blinkEnabled) { this.blinkT = -1; this.open = 1; }
  }

  blink() { if (this.blinkT < 0) this.blinkT = 0; }

  setGaze(x, y) {
    this.gaze.x = clamp(x, -1, 1);
    this.gaze.y = clamp(y, -1, 1);
  }

  update(dt) {
    if (this.blinkEnabled) {
      if (this.blinkT >= 0) {
        this.blinkT += dt;
        const t = this.blinkT;
        this.open = t < 0.07 ? 1 - t / 0.07 : t < 0.13 ? 0 : Math.min(1, (t - 0.13) / 0.11);
        if (t > 0.25) { this.blinkT = -1; this.open = 1; this.blinkTimer = 2.2 + Math.random() * 4.0; }
      } else {
        this.blinkTimer -= dt;
        if (this.blinkTimer <= 0) this.blinkT = 0;
      }
    }
    if (Math.abs(this.open - this._lo) > 0.06 ||
        Math.abs(this.gaze.x - this._lgx) > 0.10 || Math.abs(this.gaze.y - this._lgy) > 0.10) {
      this.redrawEyes();
    }
  }

  dispose() { this.texture.dispose(); }
}
