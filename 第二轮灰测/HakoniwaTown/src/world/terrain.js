/**
 * 地形：箱庭底座（岩层剖面 + 海水剖面）、带顶点色的地表、
 * 贴合地形的道路 / 广场 / 台阶 / 挡土墙。
 */
import * as THREE from 'three';
import {
  Batch, mat, mesh, box, roundedBox, roundedRectShape, clamp, lerp, smoothstep, noise2,
  ribbon, mergeGeometries, RNG,
} from '../lib/utils.js';
import {
  SLAB, SLAB_BOTTOM, SEABED, TERRACES, groundHeight, baseHeight, slopeAt, riverDist,
  makeRoadCurve, ROAD_WIDTH, WALK_PATHS,
} from './layout.js';

const C = {
  deepSand: new THREE.Color('#5c6058'),
  wetSand: new THREE.Color('#a99a74'),
  beach: new THREE.Color('#d9c89c'),
  grass: new THREE.Color('#6d9b4e'),
  grassDark: new THREE.Color('#4f7f42'),
  grassDry: new THREE.Color('#9aad5e'),
  highland: new THREE.Color('#7d9455'),
  rock: new THREE.Color('#8d8578'),
  rockDark: new THREE.Color('#6b6459'),
  soil: new THREE.Color('#7d5c40'),
  strata: [
    new THREE.Color('#b0a082'),
    new THREE.Color('#8d8274'),
    new THREE.Color('#7a6c5c'),
    new THREE.Color('#5d564d'),
    new THREE.Color('#463f39'),
  ],
  seaTop: new THREE.Color('#2f7f92'),
  seaBottom: new THREE.Color('#0a2338'),
};

/** 底座边缘处把地形压平到海床高度，便于和剖面墙严丝合缝 */
function rimFlatten(x, z, y) {
  const rim = Math.max(Math.abs(x), Math.abs(z));
  const k = smoothstep((rim - (SLAB - 3.2)) / 3.2);
  return lerp(y, SEABED, k);
}

function terrainColor(y, slope, x, z, out) {
  const n = noise2(x * 1.7, z * 1.7);
  if (y < -0.04) {
    out.copy(C.wetSand).lerp(C.deepSand, clamp(-y / 3.2));
  } else if (y < 0.85) {
    const t = smoothstep((y - 0.1) / 0.85);
    out.copy(C.wetSand).lerp(C.beach, smoothstep(y / 0.35)).lerp(C.grass, t * 0.75);
  } else {
    const alt = clamp((y - 2) / 14);
    out.copy(C.grass).lerp(C.grassDark, clamp(0.5 + n * 0.5));
    out.lerp(C.highland, alt * 0.55);
    out.lerp(C.grassDry, clamp(n * 0.4 + alt * 0.25));
  }
  // 陡坡露岩
  const rk = smoothstep((slope - 0.42) / 0.5);
  if (rk > 0) out.lerp(noise2(x * 3.1, z * 2.7) > 0 ? C.rock : C.rockDark, rk * 0.92);
  // 农田翻耕地
  if (x > 6 && x < 26 && z > -24 && z < -7 && y > 6.5 && slope < 0.3) {
    const rows = Math.sin(x * 2.1 + z * 0.6);
    out.lerp(C.soil, clamp(0.45 + rows * 0.25));
  }
  // 河岸湿润
  const rd = riverDist(x, z).dist;
  if (rd < 6 && y > 0.4) out.lerp(C.grassDark, smoothstep((6 - rd) / 5) * 0.5);
  return out;
}

export function buildTerrain(scene) {
  const root = new THREE.Group();
  root.name = 'terrain';
  scene.add(root);

  /* ---------- 地表 ---------- */
  const SEG = 200;
  const geo = new THREE.PlaneGeometry(SLAB * 2, SLAB * 2, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const n = SEG + 1;
  const H = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      const x = pos.getX(k), z = pos.getZ(k);
      const y = rimFlatten(x, z, groundHeight(x, z));
      H[k] = y;
      pos.setY(k, y);
    }
  }
  const colors = new Float32Array(n * n * 3);
  const tmp = new THREE.Color();
  const step = (SLAB * 2) / SEG;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      const x = pos.getX(k), z = pos.getZ(k);
      const hL = H[j * n + Math.max(0, i - 1)], hR = H[j * n + Math.min(n - 1, i + 1)];
      const hU = H[Math.max(0, j - 1) * n + i], hD = H[Math.min(n - 1, j + 1) * n + i];
      const slope = Math.min(1, Math.hypot((hR - hL) / (2 * step), (hD - hU) / (2 * step)));
      terrainColor(H[k], slope, x, z, tmp);
      colors[k * 3] = tmp.r; colors[k * 3 + 1] = tmp.g; colors[k * 3 + 2] = tmp.b;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, mat('#ffffff', { rough: 0.94, vertexColors: true }));
  ground.receiveShadow = true;
  ground.castShadow = true;
  ground.name = 'ground';
  root.add(ground);

  /* ---------- 箱庭底座：岩层剖面 ---------- */
  root.add(buildSlab());

  /* ---------- 道路、广场、台阶、挡土墙 ---------- */
  const roadCurve = makeRoadCurve();
  root.add(buildRoads(roadCurve));
  root.add(buildStoneWorks());

  return { root, ground, roadCurve };
}

/** 底座剖面：海水断面 + 岩层断面 + 底板 */
function buildSlab() {
  const g = new THREE.Group();
  g.name = 'slab';
  const PER = 4 * 40; // 每边 40 段
  const pts = [];
  for (let i = 0; i < PER; i++) {
    const t = (i / PER) * 4;
    const side = Math.floor(t), f = t - side;
    const a = -SLAB + f * SLAB * 2;
    if (side === 0) pts.push([a, -SLAB]);
    else if (side === 1) pts.push([SLAB, a]);
    else if (side === 2) pts.push([-a, SLAB]);
    else pts.push([-SLAB, -a]);
  }

  // 海水断面（顶部 0 → 海床）
  {
    const rings = [
      { y: 0.0, s: 1.0, c: C.seaTop },
      { y: SEABED * 0.45, s: 1.0, c: C.seaTop.clone().lerp(C.seaBottom, 0.55) },
      { y: SEABED, s: 1.0, c: C.seaBottom },
    ];
    g.add(ringWall(pts, rings, 0.9985, { rough: 0.35, metal: 0.15 }, 'seaWall'));
  }
  // 岩层断面
  {
    const rings = [
      { y: SEABED + 0.02, s: 1.0, c: C.strata[0] },
      { y: SEABED - 1.6, s: 1.0, c: C.strata[1] },
      { y: -7.2, s: 0.995, c: C.strata[2] },
      { y: -11.4, s: 0.972, c: C.strata[3] },
      { y: SLAB_BOTTOM, s: 0.93, c: C.strata[4] },
    ];
    g.add(ringWall(pts, rings, 1.0, { rough: 0.95, flat: false }, 'rockWall'));
  }
  // 底板
  {
    const shape = roundedRectShape(SLAB * 2 * 0.93, SLAB * 2 * 0.93, 3);
    const bg = new THREE.ShapeGeometry(shape, 4);
    bg.rotateX(Math.PI / 2);
    bg.translate(0, SLAB_BOTTOM, 0);
    const m = new THREE.Mesh(bg, mat('#3b3630', { rough: 1 }));
    m.receiveShadow = false;
    g.add(m);
  }
  return g;
}

/** 由环形轮廓 + 多层高度生成带顶点色的侧壁 */
function ringWall(pts, rings, inset, matOpts, name) {
  const position = [], color = [], index = [];
  const N = pts.length;
  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    for (let i = 0; i < N; i++) {
      const [x, z] = pts[i];
      position.push(x * ring.s * inset, ring.y, z * ring.s * inset);
      color.push(ring.c.r, ring.c.g, ring.c.b);
    }
  }
  for (let r = 0; r < rings.length - 1; r++) {
    for (let i = 0; i < N; i++) {
      const a = r * N + i, b = r * N + ((i + 1) % N);
      const c = (r + 1) * N + i, d = (r + 1) * N + ((i + 1) % N);
      index.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat('#ffffff', { ...matOpts, vertexColors: true }));
  m.name = name;
  m.receiveShadow = true;
  return m;
}

/* ------------------------------------------------------------ 道路 */
function buildRoads(roadCurve) {
  const g = new THREE.Group();
  g.name = 'roads';
  const hFn = (x, z) => baseHeight(x, z).h;

  // 主环路（沥青/石板 + 顶点色做旧）
  const roadGeo = ribbon(roadCurve, ROAD_WIDTH, { segments: 420, heightFn: hFn, yOffset: 0.075 });
  paintRibbon(roadGeo, '#6b6a68', '#575654');
  const road = new THREE.Mesh(roadGeo, mat('#ffffff', { rough: 0.88, vertexColors: true }));
  road.receiveShadow = true; road.castShadow = false;
  g.add(road);

  // 路缘石
  for (const s of [-1, 1]) {
    const curbGeo = ribbon(roadCurve, ROAD_WIDTH + 0.55, {
      segments: 420, heightFn: hFn, yOffset: 0.12,
    });
    // 只保留外侧细带：把内侧顶点向外挤压
    shrinkRibbonToEdge(curbGeo, s, 0.34);
    paintRibbon(curbGeo, '#b3ac9d', '#9a927f');
    const curb = new THREE.Mesh(curbGeo, mat('#ffffff', { rough: 0.8, vertexColors: true }));
    curb.receiveShadow = true;
    g.add(curb);
  }

  // 人行小径
  for (const p of WALK_PATHS) {
    const curve = new THREE.CatmullRomCurve3(
      p.pts.map(([x, z]) => new THREE.Vector3(x, hFn(x, z), z)), false, 'catmullrom', 0.4
    );
    const geo = ribbon(curve, p.name === 'hillstair' ? 1.9 : 1.55, {
      segments: 140, heightFn: (x, z) => hFn(x, z), yOffset: 0.085,
    });
    paintRibbon(geo, '#b8a98c', '#a2947a');
    const m = new THREE.Mesh(geo, mat('#ffffff', { rough: 0.92, vertexColors: true }));
    m.receiveShadow = true;
    g.add(m);
  }

  // 中央广场铺装
  g.add(plazaPaving());
  return g;
}

function paintRibbon(geo, c1, c2) {
  const a = new THREE.Color(c1), b = new THREE.Color(c2), t = new THREE.Color();
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const k = clamp(0.5 + 0.5 * noise2(x * 3.3, z * 3.1));
    t.copy(a).lerp(b, k);
    col[i * 3] = t.r; col[i * 3 + 1] = t.g; col[i * 3 + 2] = t.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

/** 把带状面收窄成靠某一侧的细边（做路缘） */
function shrinkRibbonToEdge(geo, side, width) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i += 2) {
    const ax = p.getX(i), ay = p.getY(i), az = p.getZ(i);
    const bx = p.getX(i + 1), by = p.getY(i + 1), bz = p.getZ(i + 1);
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len = Math.hypot(dx, dz) || 1;
    const f = width / len;
    if (side < 0) {
      p.setXYZ(i + 1, ax + dx * f, ay + dy * f, az + dz * f);
    } else {
      p.setXYZ(i, bx - dx * f, by - dy * f, bz - dz * f);
    }
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
}

function plazaPaving() {
  const g = new THREE.Group();
  g.name = 'plazaPaving';
  const shape = roundedRectShape(23, 8.4, 2.8);
  const geo = new THREE.ShapeGeometry(shape, 8);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  const a = new THREE.Color('#c8bda6'), b = new THREE.Color('#a89c85'), t = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) - 1.5, z = p.getZ(i) - 1.0;
    p.setXYZ(i, x, baseHeight(x, z).h + 0.09, z);
    const k = clamp(0.5 + 0.5 * noise2(x * 2.6, z * 2.4));
    t.copy(a).lerp(b, k);
    col[i * 3] = t.r; col[i * 3 + 1] = t.g; col[i * 3 + 2] = t.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat('#ffffff', { rough: 0.9, vertexColors: true }));
  m.receiveShadow = true;
  g.add(m);

  // 放射石纹圈（喷泉周围）
  const stone = mat('#8f8571', { rough: 0.85 });
  for (const r of [4.2, 6.0]) {
    const ring = new THREE.TorusGeometry(r, 0.075, 5, 48);
    ring.rotateX(Math.PI / 2);
    const mm = mesh(ring, stone, { x: 6.6, y: baseHeight(6.6, -1.2).h + 0.14, z: -1.2 });
    mm.castShadow = false;
    g.add(mm);
  }
  return g;
}

/* ------------------------------------------------------------ 石作：挡土墙、台阶 */
function buildStoneWorks() {
  const g = new THREE.Group();
  g.name = 'stonework';
  const rng = new RNG(4477);
  const batch = new Batch('stonework');
  const wallMat = mat('#a49883', { rough: 0.92 });
  const wallMat2 = mat('#8e8371', { rough: 0.95 });
  const capMat = mat('#c2b7a0', { rough: 0.85 });

  // 中央广场南缘挡土墙（面向下城），中部留出大台阶
  retainingWall(batch, -12.5, 9.4, 0.8, 9.4, { wallMat, wallMat2, capMat, rng, balustrade: true });
  retainingWall(batch, 5.4, 9.4, 12.4, 8.4, { wallMat, wallMat2, capMat, rng, balustrade: true });
  // 运河驳岸（两侧）
  retainingWall(batch, -10.1, 8.0, -11.9, -4.0, { wallMat, wallMat2, capMat, rng, balustrade: false, drop: 0.4 });
  retainingWall(batch, -15.1, -4.0, -13.3, 8.0, { wallMat, wallMat2, capMat, rng, balustrade: false, drop: 0.4 });
  // 上城台地南缘（教堂大台阶两侧）
  retainingWall(batch, -4.6, -6.3, -11.5, -6.3, { wallMat, wallMat2, capMat, rng, balustrade: true });
  retainingWall(batch, 4.8, -6.4, -0.4, -6.3, { wallMat, wallMat2, capMat, rng, balustrade: true });
  // 农场台地
  retainingWall(batch, 5.9, -8.0, 5.6, -20.0, { wallMat, wallMat2, capMat, rng, balustrade: false });
  retainingWall(batch, 23.5, -7.0, 7.5, -7.2, { wallMat, wallMat2, capMat, rng, balustrade: false });
  // 车站崖壁
  retainingWall(batch, 19.1, 10.4, 18.9, 2.6, { wallMat, wallMat2, capMat, rng, balustrade: true });
  // 码头岸壁
  retainingWall(batch, 13.6, 28.2, -11.6, 28.0, { wallMat, wallMat2, capMat, rng, balustrade: false, drop: 2.8 });

  // 台阶：广场↔下城、上城↔广场、集市↔农场、车站、码头
  stairFlight(batch, 3.0, 9.5, 0, 4.4, { rng, capMat, wallMat });
  stairFlight(batch, -2.5, -6.3, 0, 4.6, { rng, capMat, wallMat });
  stairFlight(batch, 16.0, -7.1, 0, 3.2, { rng, capMat, wallMat });
  stairFlight(batch, 19.0, 6.2, -Math.PI / 2, 3.0, { rng, capMat, wallMat });
  stairFlight(batch, -4.2, 27.9, 0, 3.0, { rng, capMat, wallMat });
  stairFlight(batch, 8.6, 27.9, 0, 3.0, { rng, capMat, wallMat });
  stairFlight(batch, -14.6, -15.6, Math.PI * 0.86, 2.6, { rng, capMat, wallMat });

  batch.build(g, { cast: true, receive: true });
  return g;
}

/**
 * 沿 A→B 生成挡土墙：墙顶跟随上侧台面，墙底延伸到下侧地面。
 */
function retainingWall(batch, ax, az, bx, bz, o) {
  const dx = bx - ax, dz = bz - az;
  const len = Math.hypot(dx, dz);
  const nx = dz / len, nz = -dx / len;
  const steps = Math.max(3, Math.round(len / 0.9));
  const th = 0.5;
  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) / steps;
    const x = ax + dx * t, z = az + dz * t;
    const topY = Math.max(baseHeight(x - nx * 0.8, z - nz * 0.8).h, baseHeight(x, z).h);
    const outX = x + nx * 1.7, outZ = z + nz * 1.7;
    const botY = Math.min(groundHeight(outX, outZ), baseHeight(outX, outZ).h) - (o.drop ?? 0.9);
    const h = Math.max(0.6, topY - botY);
    const segLen = len / steps + 0.06;
    const ry = Math.atan2(dx, dz) + Math.PI / 2;
    batch.add(box(segLen, h, th), i % 2 ? o.wallMat : o.wallMat2, { x, y: botY, z, ry });
    // 压顶石
    batch.add(box(segLen, 0.18, th + 0.24), o.capMat, { x, y: topY - 0.02, z, ry });
    if (o.balustrade && i % 2 === 0) {
      batch.add(box(0.16, 0.5, 0.16), o.capMat, { x: x + nx * 0.12, y: topY + 0.14, z: z + nz * 0.12, ry });
      if (i % 4 === 0) batch.add(box(segLen * 2, 0.12, 0.2), o.capMat, { x, y: topY + 0.6, z, ry });
    }
  }
}

/** 顺着朝向 angle 从高处走到低处的一段台阶 */
function stairFlight(batch, x, z, angle, width, o) {
  const dirX = Math.sin(angle), dirZ = Math.cos(angle);
  const topY = baseHeight(x - dirX * 0.9, z - dirZ * 0.9).h;
  let run = 0, botY = topY;
  for (let d = 1; d <= 9; d += 0.5) {
    const yy = baseHeight(x + dirX * d, z + dirZ * d).h;
    if (yy < botY - 0.05) { botY = yy; run = d; }
    if (topY - yy > 0.2 && Math.abs(yy - botY) < 0.06 && run > 0) break;
  }
  const drop = topY - botY;
  if (drop < 0.45) return;
  run = Math.max(run, drop * 1.25);
  const steps = Math.max(3, Math.round(drop / 0.32));
  const sr = run / steps, sh = drop / steps;
  const ry = angle;
  for (let i = 0; i < steps; i++) {
    const px = x + dirX * (sr * (i + 0.5)), pz = z + dirZ * (sr * (i + 0.5));
    const y = topY - sh * (i + 1);
    batch.add(box(width, sh + 0.16, sr * 1.02), i % 2 ? o.capMat : o.wallMat, { x: px, y: y - 0.08, z: pz, ry });
  }
  // 两侧矮墙
  for (const s of [-1, 1]) {
    const ox = Math.cos(angle) * (width / 2 + 0.16) * s, oz = -Math.sin(angle) * (width / 2 + 0.16) * s;
    for (let i = 0; i < steps; i++) {
      const px = x + dirX * (sr * (i + 0.5)) + ox, pz = z + dirZ * (sr * (i + 0.5)) + oz;
      const y = topY - sh * (i + 1);
      batch.add(box(0.3, sh + 0.5, sr * 1.02), o.wallMat, { x: px, y: y - 0.1, z: pz, ry });
    }
  }
}

export { retainingWall, stairFlight };
