/* =========================================================================
   两岸地形：北=马林海岬（陡崖草坡）南=旧金山要塞（林地、贝克海滩、克里西场）
   非均匀网格（中心密、外围疏），并烘出海床深度图供水面使用
   ========================================================================= */
const T = { EXT: 26000, N: 401, WARP: 1.9, h: null, n: 0 };

const gs = (x, z, cx, cz, rx, rz) => {
  const a = (x - cx) / rx, b = (z - cz) / rz;
  const d = a * a + b * b;
  return d > 12 ? 0 : Math.exp(-d);
};
function smax(a, b, k) {
  const t = clamp(0.5 + 0.5 * (a - b) / k, 0, 1);
  return lerp(b, a, t) + k * t * (1 - t);
}

/* 地表高程（米，负值为水下）
   控制目标：北塔 x=640 恰在水边；北岸桥位为低鞍地（锚碇处 ~50m），两侧山脊 150~300m；
   南岸堡垒点岬 ~12m，要塞崖顶 ~60m，克里西场与贝克海滩低平 */
function landHeight(x, z) {
  const n1 = fbm(x * 0.00042, z * 0.00042, 5);
  const n2 = fbm(x * 0.0016 + 11, z * 0.0016 - 7, 4);
  const n3 = ridge(x * 0.0030, z * 0.0030, 4);
  const n4 = fbm(x * 0.0092 - 5, z * 0.0092 + 3, 3);

  /* ---- 海床 ---- */
  let bed = -20 - 58 * gs(x, z, 240, -150, 820, 4600) - 12 * n2 - 5 * n4;

  /* ---- 北岸：马林海岬 ---- */
  const cN = B.shoreN + 66 * (n2 - 0.5) + 44 * Math.sin(z * 0.0012) + 22 * Math.sin(z * 0.0043 + 1);
  const dN = x - cN;
  let hN = -34 + 34 * smoothstep(-320, 0, dN);
  hN += 96 * smoothstep(0, 420, dN) + 26 * smoothstep(380, 1600, dN);
  const mN = smoothstep(-60, 260, dN);
  // 山峰取“最高者”而非叠加，避免高程失控
  let peaks = smax(
    smax(174 * gs(x, z, 1820, -900, 1000, 1200), 192 * gs(x, z, 2460, 340, 1000, 1200), 34),
    smax(250 * gs(x, z, 4400, -1100, 2000, 2300), 215 * gs(x, z, 5500, 1700, 2300, 2600), 34), 34);
  peaks = smax(peaks, 152 * gs(x, z, 950, -640, 440, 540), 30);      // 斯宾塞炮台山脊（经典观景点）
  hN += mN * peaks;
  hN += 40 * (n1 - 0.45) * smoothstep(60, 620, dN) + 26 * (n3 - 0.5) * smoothstep(0, 900, dN);
  // 桥位鞍地：北引桥与锚碇落在低地上（向 52m 靠拢），越往北鞍地消失、山体抬升
  hN = lerp(hN, 52, clamp(gs(x, z, 1150, 0, 620, 760) * 1.5, 0, 0.9)
    * smoothstep(-80, 240, dN) * smoothstep(1520, 1080, x));
  hN = lerp(hN, -10, clamp(gs(x, z, 1600, 1430, 360, 470) * 1.7, 0, 0.96));  // 马蹄湾（水域）
  hN -= 86 * gs(x, z, 2500, -1550, 620, 820);                                // 罗迪欧谷

  /* ---- 南岸：旧金山半岛北端 ---- */
  const cS = B.shoreS - 62 * (n2 - 0.5) - 52 * Math.sin(z * 0.0011 + 2) - 20 * Math.sin(z * 0.004);
  const dS = cS - x;
  let hS = -34 + 34 * smoothstep(-320, 0, dS);
  hS += 54 * smoothstep(0, 300, dS) + 26 * smoothstep(280, 1500, dS);
  const mS = smoothstep(-40, 240, dS);
  hS += mS * smax(26 * gs(x, z, -2400, -200, 1500, 1700),
    smax(36 * gs(x, z, -3600, 700, 2000, 2300), 28 * gs(x, z, -2800, -1700, 1400, 1700), 20), 20);
  hS += 28 * (n1 - 0.45) * smoothstep(80, 700, dS) + 18 * (n3 - 0.5) * smoothstep(0, 800, dS);
  hS = lerp(hS, 4.5, clamp(gs(x, z, -1620, 1750, 1050, 1000) * 1.45, 0, 0.9));  // 克里西场（低平）
  hS = lerp(hS, 7.5, clamp(gs(x, z, -1430, -1460, 740, 840) * 1.6, 0, 0.93));   // 贝克海滩
  hS += 13 * gs(x, z, -1060, 70, 210, 250);                                     // 堡垒点岬角

  let h = smax(smax(bed, hN, 24), hS, 24);
  // 堡垒点古堡平台
  h = lerp(h, 7.0, clamp(gs(x, z, -1075, 55, 120, 140) * 1.7, 0, 0.92));

  /* ---- 引道开挖（让公路嵌进山体） ---- */
  if (x > B.anchorX - 120) {
    const w = smoothstep(190, 46, Math.abs(z)) * smoothstep(B.anchorX - 120, B.anchorX + 90, x) * smoothstep(B.endN + 90, B.endN - 60, x);
    h = lerp(h, Math.min(h, deckY(x) - 11), w);
  }
  if (x < -B.anchorX + 120) {
    const w = smoothstep(210, 52, Math.abs(z)) * smoothstep(-B.anchorX + 120, -B.anchorX - 120, x) * smoothstep(B.endS - 300, B.endS + 90, x);
    h = lerp(h, Math.min(h, deckY(x) - 11), w);
    // 收费广场平台：路面在此落地（平台略低于桥面）
    const p = clamp(gs(x, z, -1520, 0, 210, 260) * 1.5, 0, 0.93);
    h = lerp(h, deckY(clamp(x, -1600, -1440)) - 1.5, p);
  }
  // 外缘沉入海面
  const r = Math.max(Math.abs(x), Math.abs(z));
  h = lerp(h, Math.min(h, -30), smoothstep(10500, 12800, r));
  return h;
}

const warp = (t) => Math.sign(t) * Math.pow(Math.abs(t), T.WARP);
function buildTerrain(scene) {
  const n = T.N, ext = T.EXT, half = ext / 2;
  const pos = new Float32Array(n * n * 3), col = new Float32Array(n * n * 3), uv = new Float32Array(n * n * 2);
  const H = new Float32Array(n * n);
  T.h = H; T.n = n;
  const xs = new Float32Array(n);
  for (let i = 0; i < n; i++) xs[i] = warp(i / (n - 1) * 2 - 1) * half;
  for (let j = 0; j < n; j++) {
    const z = xs[j];
    for (let i = 0; i < n; i++) {
      const x = xs[i], k = j * n + i;
      const h = landHeight(x, z);
      H[k] = h;
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
      uv[k * 2] = x / 420; uv[k * 2 + 1] = z / 420;
    }
  }
  // 颜色（按高程/坡度/噪声上色）
  const c = new THREE.Color();
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i, x = xs[i], z = xs[j], h = H[k];
      const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(n - 1, j + 1);
      const dx = (H[j * n + i1] - H[j * n + i0]) / Math.max(1e-3, xs[i1] - xs[i0]);
      const dz = (H[j1 * n + i] - H[j0 * n + i]) / Math.max(1e-3, xs[j1] - xs[j0]);
      const slope = Math.min(1, Math.hypot(dx, dz));
      terrainColor(c, x, z, h, slope);
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
    }
  }
  const idx = new Uint32Array((n - 1) * (n - 1) * 6);
  let p = 0;
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
    const a = j * n + i, b = a + 1, cc = a + n, d = cc + 1;
    idx[p++] = a; idx[p++] = cc; idx[p++] = b; idx[p++] = b; idx[p++] = cc; idx[p++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();

  const detail = tex(noiseCanvas(256, 168, 74, 8), 1, 1, false);
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.94, metalness: 0.0,
    map: detail, envMapIntensity: 0.85,
  });
  mat.map.colorSpace = THREE.SRGBColorSpace;
  const me = new THREE.Mesh(g, mat);
  me.receiveShadow = true; me.castShadow = true; me.name = 'terrain';
  scene.add(me);
  return me;
}

function terrainColor(c, x, z, h, slope) {
  const pat = fbm(x * 0.0021 + 3, z * 0.0021 - 2, 4);
  const pat2 = fbm(x * 0.011, z * 0.011, 3);
  if (h < -1) {                                       // 水下
    c.setRGB(0.10, 0.12, 0.11).lerp(_tc.setRGB(0.30, 0.28, 0.22), clamp((h + 26) / 26, 0, 1) * 0.6);
    return;
  }
  const north = x > 0;
  let r, g2, b;
  if (north) {                                        // 马林：金褐色草坡
    const grass = _tc.setHex(0x8d7c47).lerp(_tc.clone().setHex(0x5c6b38), pat);
    c.copy(grass);
    c.lerp(_tc.setHex(0x3f5230), clamp((pat - 0.55) * 2.6, 0, 1) * 0.75);   // 沟谷灌木
  } else {                                            // 旧金山：柏树林 + 草地
    c.setHex(0x5f6b3c).lerp(_tc.setHex(0x33452a), clamp(pat * 1.5 - 0.18, 0, 1));
    if (z < -600 && h < 30) c.lerp(_tc.setHex(0xc7b18d), smoothstep(-600, -1100, z) * 0.85); // 贝克海滩沙丘
  }
  // 岩壁
  const rock = _tc.setHex(0x776b5c).lerp(_tc.clone().setHex(0x574c42), pat2);
  c.lerp(rock, smoothstep(0.42, 0.95, slope) * 0.92);
  // 潮间带
  c.lerp(_tc.setHex(0x9d9081), smoothstep(6, 0.3, h) * 0.8);
  c.multiplyScalar(0.94 + 0.24 * pat2);
}

/* ---------------- 海床深度图（复用地形网格，零额外开销） ---------------- */
function bakeShoreFromTerrain() {
  const n = T.n, H = T.h, d = new Uint8Array(n * n * 4);
  for (let k = 0; k < n * n; k++) {
    const h = H[k];
    d[k * 4] = (clamp(-h / 26, 0, 1) * 255) | 0;
    d[k * 4 + 1] = (clamp(-h / 90, 0, 1) * 255) | 0;
    d[k * 4 + 2] = (clamp(h / 60, 0, 1) * 255) | 0;
    d[k * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(d, n, n, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

/* ---------------- 植被 ---------------- */
function buildVegetation(scene) {
  const trunk = new Batch(G.cyl, MAT.trunk, { name: 'trunk', recv: false });
  const leaf1 = new Batch(new THREE.ConeGeometry(1, 1, 7, 2), MAT.foliage, { name: 'cypress' });
  const leaf2 = new Batch(new THREE.SphereGeometry(1, 7, 5), MAT.foliage2, { name: 'euca' });
  const rnd = mulberry(777);
  let placed = 0;
  for (let i = 0; i < 24000 && placed < 3600; i++) {
    const x = lerp(-6200, 6200, rnd()), z = lerp(-4600, 4600, rnd());
    const h = landHeight(x, z);
    if (h < 12) continue;
    const sl = Math.abs(landHeight(x + 12, z) - h) / 12 + Math.abs(landHeight(x, z + 12) - h) / 12;
    if (sl > 0.62) continue;
    const inRoad = (Math.abs(z) < 150 && (x > 900 || x < -900));
    if (inRoad) continue;
    const south = x < -1000;
    const dens = south ? fbm(x * 0.0013 + 9, z * 0.0013, 3) : fbm(x * 0.0016, z * 0.0016 + 4, 3) * 0.42;
    if (rnd() > dens * (south ? 1.5 : 0.55)) continue;
    if (x > -1000 && x < 1250) continue;             // 桥区留空
    const s = lerp(0.7, 1.5, rnd());
    const th = (south ? lerp(14, 30, rnd()) : lerp(7, 15, rnd())) * s * 0.5;
    const cyp = rnd() < (south ? 0.55 : 0.3);
    const tr = th * (cyp ? 0.06 : 0.09);
    trunk.box(x, h + th * 0.3, z, tr, th * 0.62, tr);
    if (cyp) {
      const cw = th * (0.30 + rnd() * 0.1), ch = th * lerp(1.1, 1.6, rnd());
      leaf1.box(x, h + th * 0.55 + ch * 0.42, z, cw, ch, cw);
    } else {
      const cw = th * lerp(0.4, 0.62, rnd());
      leaf2.box(x, h + th * 0.62 + cw * 0.5, z, cw, cw * 0.8, cw * 1.05);
    }
    placed++;
  }
  trunk.build(scene); leaf1.build(scene); leaf2.build(scene);
  return placed;
}

/* ---------------- 岸边巨石 ---------------- */
function buildRocks(scene) {
  const b = new Batch(new THREE.IcosahedronGeometry(1, 0), MAT.rock, { name: 'rocks' });
  const rnd = mulberry(4242);
  for (let i = 0; i < 1100; i++) {
    const north = rnd() < 0.62;
    let x, z;
    if (north) { z = lerp(-2600, 2800, rnd()); x = B.shoreN + 96 * (fbm(0, z * 0.0015 - 7, 4) - 0.5) + 52 * Math.sin(z * 0.0013) + lerp(-90, 130, rnd()); }
    else { z = lerp(-2600, 2600, rnd()); x = B.shoreS - 78 * (fbm(0, z * 0.0015 - 7, 4) - 0.5) - 60 * Math.sin(z * 0.0011 + 2) + lerp(-120, 90, rnd()); }
    const h = landHeight(x, z);
    if (h < -9 || h > 26) continue;
    const s = lerp(1.6, 8.5, Math.pow(rnd(), 2));
    b.boxR(x, h + s * 0.25, z, s, s * lerp(0.5, 0.9, rnd()), s * lerp(0.7, 1.2, rnd()), rnd() * 6.28);
  }
  b.build(scene);
}

/* ---------------- 建筑：贝克堡营房、要塞、远景天际线 ---------------- */
let cityWinMat = null;
function buildBuildings(scene) {
  const wall = new Batch(G.box, MAT.white, { name: 'bldg' });
  const roof = new Batch(G.box, MAT.roof, { name: 'roof' });
  const rnd = mulberry(9091);
  const slopeAt = (x, z) => (Math.abs(landHeight(x + 14, z) - landHeight(x - 14, z)) + Math.abs(landHeight(x, z + 14) - landHeight(x, z - 14))) / 28;
  // 贝克堡（北岸马蹄湾）白墙红瓦营房
  for (let i = 0; i < 18; i++) {
    const x = lerp(1150, 1780, rnd()), z = lerp(820, 1560, rnd());
    const h = landHeight(x, z);
    if (h < 4 || h > 60 || slopeAt(x, z) > 0.22) continue;
    const w = lerp(11, 26, rnd()), d = lerp(9, 15, rnd()), hh = lerp(6, 10, rnd());
    const ry = rnd() < 0.5 ? 0 : Math.PI / 2;
    wall.boxR(x, h + hh / 2 - 1.6, z, w, hh, d, ry);
    roof.boxR(x, h + hh - 0.7, z, w * 1.08, 1.8, d * 1.14, ry);
  }
  // 要塞区（南岸）建筑群 + 收费广场附属
  for (let i = 0; i < 26; i++) {
    const x = lerp(-2500, -1250, rnd()), z = lerp(-500, 1500, rnd());
    const h = landHeight(x, z);
    if (h < 5 || h > 90 || slopeAt(x, z) > 0.2) continue;
    if (Math.abs(z) < 240 && x > -1800) continue;
    const w = lerp(12, 30, rnd()), d = lerp(10, 20, rnd()), hh = lerp(7, 14, rnd());
    wall.boxR(x, h + hh / 2 - 1.8, z, w, hh, d, rnd() * 0.4);
    roof.boxR(x, h + hh - 0.8, z, w * 1.06, 2.0, d * 1.1, 0);
  }
  wall.build(scene); roof.build(scene);

  // 远景：旧金山市区天际线（东南方，雾中剪影 + 夜间窗光）
  cityWinMat = new THREE.MeshStandardMaterial({
    color: 0x2a2f3a, roughness: .8, metalness: .1,
    emissive: 0xffc271, emissiveIntensity: 0,
  });
  const city = new Batch(G.box, cityWinMat, { name: 'city', recv: false });
  const rnd2 = mulberry(31337);
  for (let i = 0; i < 150; i++) {
    const ang = lerp(-0.35, 0.75, rnd2());
    const rad = lerp(6200, 11500, rnd2());
    const x = -Math.cos(ang) * rad * 0.5 - 2500;
    const z = Math.sin(ang) * rad + 2400;
    const h = Math.max(2, landHeight(x, z));
    const dc = Math.hypot(x + 4200, z - 5200);
    const tall = clamp(1 - dc / 4200, 0, 1);
    const hh = lerp(24, 96, Math.pow(rnd2(), 1.7)) * (0.4 + tall * 1.5);
    const w = lerp(22, 52, rnd2());
    city.boxR(x, h + hh / 2, z, w, hh, w * lerp(.7, 1.3, rnd2()), rnd2() * 1.5);
  }
  // 泛美金字塔 + 塔尖群（示意）
  city.box(-4150, 130, 5250, 40, 260, 40);
  city.box(-4600, 100, 4700, 44, 200, 44);
  city.build(scene);
}
