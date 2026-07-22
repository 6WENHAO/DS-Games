const fs = require('fs');
const zlib = require('zlib');

const buf = fs.readFileSync(process.argv[2]);
if (buf.readUInt32BE(0) !== 0x89504e47) { console.log('not png'); process.exit(1); }
let off = 8;
let width = 0, height = 0, bitDepth = 0, colorType = 0;
const idat = [];
while (off < buf.length) {
  const len = buf.readUInt32BE(off);
  const type = buf.toString('ascii', off + 4, off + 8);
  const data = buf.slice(off + 8, off + 8 + len);
  if (type === 'IHDR') {
    width = data.readUInt32BE(0);
    height = data.readUInt32BE(4);
    bitDepth = data[8];
    colorType = data[9];
  } else if (type === 'IDAT') {
    idat.push(data);
  } else if (type === 'IEND') break;
  off += 12 + len;
}
const raw = zlib.inflateSync(Buffer.concat(idat));
const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
const stride = width * channels;
const pixels = Buffer.alloc(width * height * channels);
let pos = 0;
let prevRow = Buffer.alloc(stride);
for (let y = 0; y < height; y++) {
  const filter = raw[pos++];
  const row = raw.slice(pos, pos + stride);
  pos += stride;
  const out = Buffer.alloc(stride);
  for (let x = 0; x < stride; x++) {
    const a = x >= channels ? out[x - channels] : 0;
    const b = prevRow[x];
    const c = x >= channels ? prevRow[x - channels] : 0;
    let v = row[x];
    if (filter === 1) v = (v + a) & 0xff;
    else if (filter === 2) v = (v + b) & 0xff;
    else if (filter === 3) v = (v + ((a + b) >> 1)) & 0xff;
    else if (filter === 4) {
      const p = a + b - c;
      const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      v = (v + pr) & 0xff;
    }
    out[x] = v;
  }
  out.copy(pixels, y * stride);
  prevRow = out;
}

function zoneStats(x0, y0, x1, y1) {
  let r = 0, g = 0, b = 0, n = 0;
  const colors = new Set();
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const i = (y * width + x) * channels;
      r += pixels[i]; g += pixels[i + 1]; b += pixels[i + 2];
      colors.add((pixels[i] >> 4) << 8 | (pixels[i + 1] >> 4) << 4 | (pixels[i + 2] >> 4));
      n++;
    }
  }
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n), uniqueColors: colors.size };
}

console.log('size', width, 'x', height, 'channels', channels);
console.log('top   ', JSON.stringify(zoneStats(0, 0, width, Math.floor(height * 0.33))));
console.log('middle', JSON.stringify(zoneStats(0, Math.floor(height * 0.33), width, Math.floor(height * 0.66))));
console.log('bottom', JSON.stringify(zoneStats(0, Math.floor(height * 0.66), width, height)));
console.log('center', JSON.stringify(zoneStats(Math.floor(width * 0.4), Math.floor(height * 0.4), Math.floor(width * 0.6), Math.floor(height * 0.6))));
