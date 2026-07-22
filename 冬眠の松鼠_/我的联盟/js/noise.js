'use strict';
// ---------- 随机 / 噪声工具 ----------
const WORLD_SEED = 20260716;

function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const seededRand = mulberry32(WORLD_SEED);

function hash2(x, z){
  let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ WORLD_SEED;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function smoothT(t){ return t * t * (3 - 2 * t); }
function vnoise2(x, z){
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const a = hash2(xi, zi), b = hash2(xi + 1, zi);
  const c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  const u = smoothT(xf), v = smoothT(zf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm2(x, z, oct, lac, gain){
  oct = oct || 4; lac = lac || 2; gain = gain || 0.5;
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for(let i = 0; i < oct; i++){
    sum += vnoise2(x * freq, z * freq) * amp;
    norm += amp; amp *= gain; freq *= lac;
  }
  return sum / norm;
}
function clamp(v, a, b){ return v < a ? a : v > b ? b : v; }
function lerp(a, b, t){ return a + (b - a) * t; }
function randRange(a, b){ return a + Math.random() * (b - a); }
