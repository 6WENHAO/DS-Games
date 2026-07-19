// ============ 值噪声 + 分形噪声（自实现，用于地形生成） ============
const Noise = (() => {
  function makeRng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function makePerm(seed) {
    const rng = makeRng(seed);
    const p = new Uint8Array(512);
    const base = new Uint8Array(256);
    for (let i = 0; i < 256; i++) base[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = base[i]; base[i] = base[j]; base[j] = t;
    }
    for (let i = 0; i < 512; i++) p[i] = base[i & 255];
    return p;
  }

  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function grad2(h, x, y) {
    switch (h & 7) {
      case 0: return x + y; case 1: return -x + y;
      case 2: return x - y; case 3: return -x - y;
      case 4: return x; case 5: return -x;
      case 6: return y; default: return -y;
    }
  }

  class Noise2D {
    constructor(seed) { this.p = makePerm(seed); }
    get(x, y) {
      const p = this.p;
      const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
      x -= Math.floor(x); y -= Math.floor(y);
      const u = fade(x), v = fade(y);
      const A = p[X] + Y, B = p[X + 1] + Y;
      return lerp(
        lerp(grad2(p[A], x, y), grad2(p[B], x - 1, y), u),
        lerp(grad2(p[A + 1], x, y - 1), grad2(p[B + 1], x - 1, y - 1), u),
        v
      ) * 0.7071;
    }
    fbm(x, y, oct, lac, gain) {
      let amp = 1, freq = 1, sum = 0, norm = 0;
      for (let i = 0; i < oct; i++) {
        sum += this.get(x * freq, y * freq) * amp;
        norm += amp;
        amp *= gain; freq *= lac;
      }
      return sum / norm;
    }
  }

  // 简单 3D 哈希噪声（洞穴、矿脉分布用）
  function hash3(x, y, z, seed) {
    let h = seed >>> 0;
    h = Math.imul(h ^ x, 0x9E3779B1);
    h = Math.imul(h ^ y, 0x85EBCA77);
    h = Math.imul(h ^ z, 0xC2B2AE3D);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }

  return { Noise2D, makeRng, hash3 };
})();
