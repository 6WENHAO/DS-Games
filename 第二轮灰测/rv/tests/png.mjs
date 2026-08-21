/* 极简 PNG 解码 + 画面分析（用于自动验收渲染结果） */
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

export function decodePng(path) {
  const buf = readFileSync(path);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('不是 PNG');
  let off = 8, w = 0, h = 0, bitDepth = 8, colorType = 6, interlace = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (bitDepth !== 8 || interlace !== 0) throw new Error('仅支持 8bit 非隔行 PNG');
  const ch = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 0;
  if (!ch) throw new Error('不支持的颜色类型 ' + colorType);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const ft = raw[p++];
    const line = raw.subarray(p, p + stride); p += stride;
    const cur = out.subarray(y * stride, y * stride + stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, (y - 1) * stride + stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prev ? prev[x] : 0;
      const c = (prev && x >= ch) ? prev[x - ch] : 0;
      let v = line[x];
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 255;
    }
  }
  return { w, h, ch, data: out };
}

// 统计彩色（高饱和）像素、色调种类、包围盒、黑描边比例
export function analyze(img, region) {
  const { w, h, ch, data } = img;
  const x0 = region ? region.x0 : 0, x1 = region ? region.x1 : w;
  const y0 = region ? region.y0 : 0, y1 = region ? region.y1 : h;
  let colored = 0, dark = 0, total = 0;
  let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1;
  const hues = new Map();
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * w + x) * ch;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      total++;
      if (mx > 100 && mx - mn > 55) {
        colored++;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        // 主色分类
        let key;
        if (r > 200 && g > 200 && b > 200) key = 'white';
        else if (r > 150 && g < 110 && b < 110) key = 'red';
        else if (g > 130 && r < 140 && b < 140) key = 'green';
        else if (r > 180 && g > 150 && b < 120) key = 'yellow';
        else if (r > 170 && g > 90 && g < 170 && b < 100) key = 'orange';
        else if (b > 130 && r < 130) key = 'blue';
        else key = 'other';
        hues.set(key, (hues.get(key) || 0) + 1);
      } else if (mx < 45) dark++;
    }
  }
  return {
    total, colored, dark, hues: Object.fromEntries([...hues].sort((a, b) => b[1] - a[1])),
    bbox: maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
  };
}
