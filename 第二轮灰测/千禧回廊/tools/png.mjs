// tools/png.mjs —— 极简 PNG 编码器（只用 node:zlib，无第三方依赖）
import zlib from 'node:zlib';

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

/**
 * @param {number} w
 * @param {number} h
 * @param {Uint8ClampedArray|Buffer} rgba  长度 w*h*4
 * @returns {Buffer} PNG 字节
 */
export function encodePNG(w, h, rgba) {
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    for (let x = 0; x < stride; x++) raw[y * (stride + 1) + 1 + x] = rgba[y * stride + x];
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** 最近邻放大，方便肉眼看清像素画 */
export function upscale(w, h, rgba, k) {
  const W = w * k, H = h * k;
  const out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    const sy = (y / k) | 0;
    for (let x = 0; x < W; x++) {
      const sx = (x / k) | 0;
      const si = (sy * w + sx) * 4, di = (y * W + x) * 4;
      out[di] = rgba[si]; out[di + 1] = rgba[si + 1];
      out[di + 2] = rgba[si + 2]; out[di + 3] = rgba[si + 3];
    }
  }
  return { w: W, h: H, data: out };
}
