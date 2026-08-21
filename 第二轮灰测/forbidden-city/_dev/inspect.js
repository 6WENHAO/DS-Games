/* 把 WebGL 画面回读并转成 ASCII 彩色分类图，便于无图像通道时自检 */
'use strict';
function makeInspector(R) {
  const gl = R.gl;
  let buf = null, W = 0, H = 0;
  function grab() {
    W = gl.drawingBufferWidth; H = gl.drawingBufferHeight;
    buf = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  }
  function classify(r, g, b) {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const lum = (r * 0.3 + g * 0.6 + b * 0.11);
    const sat = mx - mn;
    if (b > r + 22 && b > 90 && sat > 12 && lum > 70) return '.';    // 天空
    if (lum < 26) return '#';                                        // 极暗
    if (sat < 26) return lum > 175 ? 'W' : (lum > 108 ? '=' : (lum > 62 ? '-' : ':')); // 石/砖/阴影
    if (r > g && g > b) {
      const warm = r - b;
      if (g > r * 0.62 && warm > 55) return lum > 120 ? 'Y' : 'y';    // 琉璃黄瓦
      return lum > 88 ? 'R' : 'r';                                    // 朱红
    }
    if (g >= r && g > b) return lum > 88 ? 'G' : 'g';                 // 绿（树/彩画）
    if (b >= g && b > r) return lum > 96 ? 'w' : 'v';                 // 水/暗蓝
    return '?';
  }
  function ascii(cols = 118, rows = 46) {
    if (!buf) grab();
    const out = [];
    for (let j = 0; j < rows; j++) {
      let line = '';
      for (let i = 0; i < cols; i++) {
        // 每个字符对应一个块，取块内中位亮度像素
        const x0 = Math.floor(i * W / cols), x1 = Math.max(x0 + 1, Math.floor((i + 1) * W / cols));
        const y1 = H - Math.floor(j * H / rows), y0 = Math.max(0, H - Math.floor((j + 1) * H / rows));
        let r = 0, g = 0, b = 0, n = 0;
        for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
          const k = (y * W + x) * 4;
          r += buf[k]; g += buf[k + 1]; b += buf[k + 2]; n++;
        }
        line += n ? classify(r / n, g / n, b / n) : ' ';
      }
      out.push(line);
    }
    return out.join('\n');
  }
  function stats() {
    if (!buf) grab();
    const hist = {};
    let sum = 0, n = 0;
    for (let k = 0; k < buf.length; k += 4 * 7) {
      const c = classify(buf[k], buf[k + 1], buf[k + 2]);
      hist[c] = (hist[c] || 0) + 1;
      sum += buf[k] * 0.3 + buf[k + 1] * 0.6 + buf[k + 2] * 0.11; n++;
    }
    const tot = Object.values(hist).reduce((a, b) => a + b, 0);
    const parts = Object.entries(hist).sort((a, b) => b[1] - a[1])
      .map(([k, v]) => k + ':' + (100 * v / tot).toFixed(1) + '%').join(' ');
    return 'lum=' + (sum / n).toFixed(1) + ' ' + parts;
  }
  /** 采样若干标记点的 sRGB 值（u,v 为 0..1 屏幕坐标，v 从上到下） */
  function probe(pts) {
    if (!buf) grab();
    const out = [];
    for (const [name, u, v] of pts) {
      const x = Math.min(W - 1, Math.max(0, Math.round(u * W)));
      const y = Math.min(H - 1, Math.max(0, Math.round((1 - v) * H)));
      let r = 0, g = 0, b = 0, n = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const k = ((y + dy) * W + (x + dx)) * 4;
        if (k < 0 || k >= buf.length) continue;
        r += buf[k]; g += buf[k + 1]; b += buf[k + 2]; n++;
      }
      out.push(name + '=(' + [r / n, g / n, b / n].map(v => Math.round(v)).join(',') + ')');
    }
    return out.join('  ');
  }
  /** 用世界坐标探针：自动投影到屏幕再采样 */
  function probeWorld(pts) {
    const vp = R.tmp.vp;
    const o = new Float32Array(4);
    const list = [];
    for (const [name, x, y, z] of pts) {
      M4.xformPoint(o, vp, [x, y, z]);
      if (o[3] <= 0) { list.push(name + '=(视锥外)'); continue; }
      const u = (o[0] / o[3]) * 0.5 + 0.5, v = (o[1] / o[3]) * 0.5 + 0.5;
      if (u < 0 || u > 1 || v < 0 || v > 1) { list.push(name + '=(画面外 ' + u.toFixed(2) + ',' + v.toFixed(2) + ')'); continue; }
      list.push(probe([[name, u, v]]));
    }
    return list.join('  ');
  }
  return { grab, ascii, stats, probe, probeWorld };
}
window.makeInspector = makeInspector;

/** 体素剖面：axis='x' 表示固定 x 看 z-y 剖面；返回 ASCII */
function sliceVolume(vol, axis, at, a0, a1, y0, y1) {
  const glyph = (c) => {
    if (!c) return '.';
    const n = Object.keys(C).find(k => C[k] === c) || '?';
    if (/^tile[AB]$|^tileC$/.test(n)) return '#';
    if (/ridge/.test(n)) return '^';
    if (/^wallRed|cityWall|plaster/.test(n)) return 'R';
    if (/marble|stone|brick|goldBrick/.test(n)) return '=';
    if (/column|door|lattice/.test(n)) return '|';
    if (/paint|gold/.test(n)) return '*';
    if (/window/.test(n)) return 'o';
    if (/beam|gable|trunk/.test(n)) return 'w';
    if (/pine|leaf|grass/.test(n)) return 'T';
    if (/bronze|patina/.test(n)) return 'b';
    if (/rock|soil/.test(n)) return 'n';
    if (/water/.test(n)) return '~';
    return '+';
  };
  const lines = [];
  for (let y = y1; y >= y0; y--) {
    let s = String(y).padStart(3, ' ') + '|';
    for (let a = a0; a <= a1; a++) {
      s += glyph(axis === 'x' ? vol.get(at, y, a) : vol.get(a, y, at));
    }
    lines.push(s);
  }
  return lines.join('\n');
}
window.sliceVolume = sliceVolume;
