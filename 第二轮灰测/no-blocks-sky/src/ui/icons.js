// Item icon generator: isometric block icons from the atlas + NMS-style hex element icons.
import { ITEMS } from '../data/items.js';
import { BLOCKS } from '../world/blocks.js';
import { TILE_INDEX, blockIconDataURL } from '../world/atlas.js';

export class Icons {
  constructor(atlasCanvas) {
    this.atlas = atlasCanvas;
    this.cache = new Map();
  }

  setAtlas(canvas) { this.atlas = canvas; this.cache.clear(); }

  get(key) {
    if (this.cache.has(key)) return this.cache.get(key);
    const url = this._make(key);
    this.cache.set(key, url);
    return url;
  }

  _make(key) {
    const def = ITEMS[key];
    if (!def) return this._hex('?', '#8fa3b8');
    if (def.type === 'block' && def.block !== undefined && this.atlas) {
      const b = BLOCKS[def.block];
      const top = TILE_INDEX[b.top || b.side] ?? 0;
      const side = TILE_INDEX[b.side] ?? 0;
      try { return blockIconDataURL(this.atlas, { top, side }, 56); } catch (e) { /* fall through */ }
    }
    return this._hex(def.sym || '◈', def.color || '#ffa62b');
  }

  _hex(sym, color) {
    const s = 56;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const g = c.getContext('2d');
    // hexagon plate
    const cx = s / 2, cy = s / 2, r = s * 0.42;
    g.save();
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.closePath();
    const grad = g.createLinearGradient(0, 0, s, s);
    grad.addColorStop(0, this._shade(color, 0.95));
    grad.addColorStop(0.55, this._shade(color, 0.5));
    grad.addColorStop(1, this._shade(color, 0.22));
    g.fillStyle = grad;
    g.fill();
    g.clip();
    // inner scanlines
    g.globalAlpha = 0.22;
    g.fillStyle = '#000';
    for (let y = 0; y < s; y += 3) g.fillRect(0, y, s, 1);
    g.globalAlpha = 1;
    g.restore();
    // outline
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.closePath();
    g.strokeStyle = this._shade(color, 1.35);
    g.lineWidth = 1.6;
    g.stroke();
    // symbol
    g.fillStyle = '#0b1016';
    g.font = 'bold ' + (sym.length > 2 ? 15 : 20) + 'px "Segoe UI", system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(sym, cx + 0.5, cy + 1.5);
    g.fillStyle = '#f4fbff';
    g.fillText(sym, cx, cy);
    return c.toDataURL();
  }

  _shade(hex, f) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
    let r = (n >> 16) & 255, g2 = (n >> 8) & 255, b = n & 255;
    r = Math.max(0, Math.min(255, r * f)) | 0;
    g2 = Math.max(0, Math.min(255, g2 * f)) | 0;
    b = Math.max(0, Math.min(255, b * f)) | 0;
    return 'rgb(' + r + ',' + g2 + ',' + b + ')';
  }
}
