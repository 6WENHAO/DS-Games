// glyph.js —— 浏览器端把真汉字渲染进材质（离屏 canvas → alpha 遮罩）
//   Node 端没有这个，pixels.js 会回落成抽象字块，构图不变
import { setGlyphRenderer } from './pixels.js';

const HEI = '"SimHei","Microsoft YaHei","Heiti SC","Noto Sans CJK SC",sans-serif';

export function installGlyphRenderer() {
  if (typeof document === 'undefined') return false;
  const cv = document.createElement('canvas');
  const c = cv.getContext('2d', { willReadFrequently: true });
  if (!c) return false;

  setGlyphRenderer((text, { size = 10, bold = true, vertical = false, spacing = 0, font }) => {
    const fam = font || HEI;
    const f = `${bold ? 'bold ' : ''}${size}px ${fam}`;
    const chars = [...text];
    let w, h;
    if (vertical) { w = size + 2; h = chars.length * (size + spacing) + 2; }
    else { w = chars.length * (size + spacing) + 2; h = size + 3; }
    cv.width = Math.max(1, Math.ceil(w));
    cv.height = Math.max(1, Math.ceil(h));
    c.clearRect(0, 0, cv.width, cv.height);
    c.font = f;
    c.fillStyle = '#fff';
    c.textBaseline = 'top';
    c.textAlign = 'left';
    chars.forEach((ch, i) => {
      if (vertical) c.fillText(ch, 1, 1 + i * (size + spacing));
      else c.fillText(ch, 1 + i * (size + spacing), 1);
    });
    const d = c.getImageData(0, 0, cv.width, cv.height).data;
    const alpha = new Uint8Array(cv.width * cv.height);
    for (let i = 0, k = 0; i < d.length; i += 4, k++) alpha[k] = d[i + 3];
    return { w: cv.width, h: cv.height, alpha };
  });
  return true;
}
