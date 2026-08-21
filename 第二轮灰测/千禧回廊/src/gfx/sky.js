// ============================================================================
//  sky.js —— 黄昏天空全景条（512×128，覆盖方位 0~360°、仰角 0~45°）
//  内容：暖色渐变 + 云 + 一枚永远不动的落日 + 千禧年城市天际线
//        （板楼、玻璃幕墙尖塔、大屋檐复兴式建筑、水塔、天线、塔吊）
// ============================================================================

import { pix, makeRng, mix, scaleColor, fbm } from './pixels.js';
import { P } from './palette.js';

export const PW = 512;
export const PH = 160;
export const MAX_ELEV = (40 * Math.PI) / 180; // 40°：一屏能看到 0~20°，剪影必须压在最下面

let panorama = null;

export function skyPanorama() {
  if (panorama) return panorama;
  const p = pix(PW, PH);
  const rng = makeRng(20000101);

  // —— 天空渐变（上紫下金，千禧年夏天傍晚六点半）——
  for (let y = 0; y < PH; y++) {
    const t = y / (PH - 1);           // 0 = 天顶方向, 1 = 地平线
    let c;
    if (t < 0.75) c = mix(P.skyTop, P.skyMid, t / 0.75);
    else c = mix(P.skyMid, P.skyLow, (t - 0.75) / 0.25);
    p.rect(0, y, PW, 1, c);
  }

  // —— 云带（横向拉长的 fbm，底部受落日照亮）——
  for (let y = 0; y < PH; y++) {
    for (let x = 0; x < PW; x++) {
      const n = fbm(x * 0.035, y * 0.14, PW, 4242, 4);
      const band = Math.sin(y * 0.13 + n * 3.5) * 0.5 + 0.5;
      const density = Math.pow(Math.max(0, n * 0.75 + band * 0.45 - 0.52), 1.5) * 2.2;
      if (density > 0.01) {
        const lit = 1 - y / PH;
        const c = mix('#a98a9a', '#ffd9a0', Math.pow(1 - lit, 1.6));
        p.blend(x, y, c, Math.min(0.72, density));
      }
    }
  }

  // —— 落日：固定在方位 ~205°，压在天际线上方（它永远不动）——
  const sunU = Math.floor(PW * 0.57);
  const sunV = Math.floor(PH * 0.74);
  for (let r = 34; r > 0; r--) {
    const a = Math.pow(1 - r / 34, 2.6) * 0.5;
    p.disc(sunU, sunV, r * 1.5, r, mix('#ffd08a', '#fff6dc', 1 - r / 34), a);
  }
  p.disc(sunU, sunV, 9, 8.5, '#fff2cc');
  p.disc(sunU, sunV, 6, 5.6, '#ffffff');
  p.glow(sunU - 14, sunV - 14, 28, 28, 1);

  // —— 天际线：三层，越远越淡（空气透视）。剪影只占最下面一小条，
  //    因为从天台望出去，城市其实只占视野的 5~10° ——
  function skylineLayer(baseV, haze, seed, maxH, gapMin, gapMax) {
    const r = makeRng(seed);
    const silo = mix('#4a3f52', mix(P.skyMid, P.skyLow, 0.45), haze);
    let x = -10;
    while (x < PW + 40) {
      const w = 7 + Math.floor(r() * 22);
      const hgt = 5 + Math.floor(r() * maxH);
      const kind = r();
      const top = baseV - hgt;

      if (kind > 0.93) {
        // ★ 千禧年地标：玻璃幕墙塔 + 尖塔 + 一点顶灯
        const tw = Math.max(9, Math.floor(w * 0.75));
        const th = hgt + 14 + Math.floor(r() * 18);
        const ttop = baseV - th;
        p.rect(x, ttop, tw, baseV - ttop, silo);
        for (let yy = ttop + 2; yy < baseV - 1; yy += 3) {
          p.rect(x + 1, yy, tw - 2, 1, mix('#2f6f78', silo, haze * 0.7), 0.45);
        }
        for (let xx = x + 2; xx < x + tw - 1; xx += 4) {
          p.rect(xx, ttop + 1, 1, baseV - ttop - 2, mix('#8ecfd6', silo, haze * 0.75), 0.24);
        }
        const cx = Math.round(x + tw / 2);
        const spire = 10 + Math.floor(r() * 12);
        for (let i = 0; i < spire; i++) {
          const ww = Math.max(1, Math.round((spire - i) / 5));
          p.rect(cx - (ww >> 1), ttop - i, ww, 1, silo);
        }
        p.disc(cx, ttop - spire, 1.3, 1.3, '#ff9a6a', 0.95 - haze * 0.55);
        p.glow(cx - 2, ttop - spire - 2, 5, 5, 0.85);
        x += tw + gapMin + Math.floor(r() * gapMax);
        continue;
      }

      if (kind > 0.82) {
        // ★ 中华复兴式：大屋檐（梯形坡顶 + 起翘檐角）压在方体上
        p.rect(x, top, w, baseV - top, silo);
        const eave = 3 + Math.floor(r() * 4);
        for (let i = 0; i < eave; i++) {
          const ext = Math.round((eave - i) * 1.6);
          p.rect(x - ext, top - i, w + ext * 2, 1, mix('#3f3644', silo, haze * 0.85));
        }
        p.rect(x - eave * 2, top - 1, 3, 2, mix('#3f3644', silo, haze * 0.85));
        p.rect(x + w + eave * 2 - 3, top - 1, 3, 2, mix('#3f3644', silo, haze * 0.85));
        x += w + gapMin + Math.floor(r() * gapMax);
        continue;
      }

      // ★ 普通板楼（近处的能看见亮着的小窗）
      p.rect(x, top, w, baseV - top, silo);
      if (haze < 0.5) {
        for (let yy = top + 2; yy < baseV - 2; yy += 4) {
          for (let xx = x + 2; xx < x + w - 2; xx += 3) {
            if (r() > 0.6) p.rect(xx, yy, 1, 2, mix('#ffcf88', silo, haze * 0.55), 0.7);
          }
        }
      }
      // 屋顶：水塔 / 鱼骨天线 / 塔吊（2000 年到处都在盖楼）
      const roofKind = r();
      if (roofKind > 0.74) {
        const tx = x + Math.floor(w * 0.6);
        p.rect(tx, top - 5, 4, 5, silo);
        p.rect(tx - 1, top - 6, 6, 2, silo);
      } else if (roofKind > 0.48) {
        const tx = x + Math.floor(w * 0.4);
        p.vline(tx, top - 9, 9, silo, 0.9);
        for (let i = 0; i < 3; i++) p.hline(tx - 3, top - 8 + i * 3, 7, silo, 0.8);
      } else if (roofKind > 0.36) {
        const tx = x + Math.floor(w * 0.5);
        p.vline(tx, top - 18, 18, silo, 0.85);
        p.hline(tx - 13, top - 18, 22, silo, 0.85);
        p.hline(tx - 13, top - 17, 22, silo, 0.45);
        p.vline(tx - 11, top - 18, 4, silo, 0.55);
      }
      x += w + gapMin + Math.floor(r() * gapMax);
    }
  }

  skylineLayer(PH - 5, 0.70, 777, 11, 2, 6);    // 远景（淡）
  skylineLayer(PH - 2, 0.44, 888, 18, 2, 8);    // 中景
  skylineLayer(PH + 2, 0.14, 999, 26, 3, 11);   // 近景（实、有亮窗、有间隙）

  // 地平线的暖霾
  for (let y = PH - 22; y < PH; y++) {
    p.rect(0, y, PW, 1, P.skyHaze, ((y - (PH - 22)) / 22) * 0.32);
  }

  p.grain(3, 31337);
  panorama = p;
  return p;
}

export function resetSky() { panorama = null; }
