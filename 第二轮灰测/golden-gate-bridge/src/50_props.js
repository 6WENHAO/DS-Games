/* =========================================================================
   动态与细节：车流 · 船舶与航迹 · 堡垒点古堡 · 收费广场 · 海鸥 · 夜间灯光
   ========================================================================= */
const CARS = [];
let carBody = null, carTop = null, carLampF = null, carLampR = null;

const CAR_COL = [0xdedede, 0xf2f2f2, 0x9aa0a6, 0x2a2f36, 0x1d2b3a, 0xb03a2a, 0x1f4f8f,
  0x2f6b45, 0xd9b34a, 0x6e4a8a, 0xc7c2b8, 0x3b4148];
function buildCars(par) {
  const N = 132;
  const lanes = [1.59, 4.77, 7.95];
  for (let i = 0; i < N; i++) {
    const dir = i % 2 ? 1 : -1;
    const lane = lanes[(i / 2 | 0) % 3] * dir;
    const truck = RND() < 0.17;
    CARS.push({
      x: lerp(B.endS + 40, B.endN - 60, RND()),
      z: lane, dir,
      spd: (truck ? rr(19, 24) : rr(26, 34)),
      len: truck ? rr(9, 15) : rr(4.2, 5.2),
      wid: truck ? 2.5 : rr(1.8, 2.0),
      hgt: truck ? rr(3.2, 4.0) : rr(1.35, 1.6),
      col: CAR_COL[(RND() * CAR_COL.length) | 0], truck,
    });
  }
  const bm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .3, metalness: .5, envMapIntensity: 1.4 });
  const tm = new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: .18, metalness: .3, envMapIntensity: 1.6 });
  carBody = new THREE.InstancedMesh(G.box, bm, CARS.length);
  carTop = new THREE.InstancedMesh(G.box, tm, CARS.length);
  const lf = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff0cc, emissiveIntensity: 0 });
  const lr = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2200, emissiveIntensity: 0 });
  carLampF = new THREE.InstancedMesh(G.box, lf, CARS.length * 2);
  carLampR = new THREE.InstancedMesh(G.box, lr, CARS.length * 2);
  for (const m of [carBody, carTop, carLampF, carLampR]) {
    m.castShadow = true; m.frustumCulled = false; par.add(m);
  }
  carLampF.castShadow = carLampR.castShadow = false;
  CARS.forEach((c, i) => { carBody.setColorAt(i, _tc.setHex(c.col)); });
  carBody.instanceColor.needsUpdate = true;
  updateCars(0);
}
function updateCars(dt) {
  if (!carBody) return;
  const m = _m, on = S.night > 0.35 ? 1 : 0;
  carLampF.material.emissiveIntensity = on * 3.4;
  carLampR.material.emissiveIntensity = on * 1.8;
  for (let i = 0; i < CARS.length; i++) {
    const c = CARS[i];
    c.x += c.spd * c.dir * dt * S.traffic;
    if (c.dir > 0 && c.x > B.endN - 40) c.x = B.endS + 30;
    if (c.dir < 0 && c.x < B.endS + 30) c.x = B.endN - 40;
    const y = deckY(c.x) + 0.26;
    m.makeScale(c.len, c.hgt * 0.62, c.wid); m.setPosition(c.x, y + c.hgt * 0.31, c.z);
    carBody.setMatrixAt(i, m);
    m.makeScale(c.len * (c.truck ? 0.34 : 0.52), c.hgt * 0.42, c.wid * 0.92);
    m.setPosition(c.x + (c.truck ? c.len * 0.3 * c.dir : 0), y + c.hgt * 0.62 + c.hgt * 0.21, c.z);
    carTop.setMatrixAt(i, m);
    for (let k = 0; k < 2; k++) {
      const zo = (k ? 0.62 : -0.62) * c.wid * 0.5;
      m.makeScale(0.3, 0.26, 0.5);
      m.setPosition(c.x + c.len * 0.5 * c.dir, y + c.hgt * 0.34, c.z + zo);
      carLampF.setMatrixAt(i * 2 + k, m);
      m.setPosition(c.x - c.len * 0.5 * c.dir, y + c.hgt * 0.34, c.z + zo);
      carLampR.setMatrixAt(i * 2 + k, m);
    }
  }
  carBody.instanceMatrix.needsUpdate = true; carTop.instanceMatrix.needsUpdate = true;
  carLampF.instanceMatrix.needsUpdate = true; carLampR.instanceMatrix.needsUpdate = true;
}

/* ---------------- 船舶 ---------------- */
const SHIPS = [];
function wakeTex() {
  const N = 256, [c, g] = cv(N, N), im = g.createImageData(N, N), d = im.data;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N * 2 - 1;
    const spread = 0.06 + u * 0.85;
    const edge = Math.exp(-Math.pow((Math.abs(v) - spread * 0.9) / (0.1 + u * 0.1), 2));
    const body = Math.exp(-Math.pow(v / spread, 2)) * 0.5;
    let a = (edge * 0.9 + body) * (1 - u * 0.92);
    a *= 0.6 + 0.4 * fbm(u * 14, v * 9, 3);
    const i = (y * N + x) * 4; d[i] = d[i + 1] = d[i + 2] = 255;
    d[i + 3] = clamp(a * 255, 0, 255) | 0;
  }
  g.putImageData(im, 0, 0); return c;
}
function makeShip(kind) {
  const g = new THREE.Group();
  if (kind === 'container') {
    const L = 232, W = 32;
    const hull = new THREE.Mesh(new THREE.BoxGeometry(W, 15, L), MAT.hull);
    hull.position.y = 4.5; g.add(hull);
    const bow = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.5, W * 0.24, 22, 8, 1, false), MAT.hull);
    bow.rotation.set(Math.PI / 2, 0, 0); bow.position.set(0, 4.5, L * 0.5 + 6); g.add(bow);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(W * 0.96, 2, L * 0.98), MAT.deckW);
    deck.position.y = 12.4; g.add(deck);
    const rnd = mulberry(55);
    const cols = [0xb03a2a, 0x1f4f8f, 0x2f6b45, 0xd9b34a, 0x8a8f96, 0x7a3b6a];
    const b = new Batch(G.box, new THREE.MeshStandardMaterial({ roughness: .75 }), { color: true, name: 'cont' });
    for (let i = 0; i < 260; i++) {
      const cz = lerp(-L * 0.42, L * 0.30, rnd());
      const cx = lerp(-W * 0.35, W * 0.35, rnd());
      const st = 1 + (rnd() * 4 | 0);
      for (let s = 0; s < st; s++) b.box(cx, 14 + s * 2.7 + 1.3, cz, 2.3, 2.5, 6, cols[(rnd() * cols.length) | 0]);
    }
    b.build(g);
    const house = new THREE.Mesh(new THREE.BoxGeometry(W * 0.8, 24, 20), MAT.white);
    house.position.set(0, 25, -L * 0.36); g.add(house);
    const funnel = new THREE.Mesh(new THREE.BoxGeometry(9, 14, 10), MAT.hull);
    funnel.position.set(0, 44, -L * 0.40); g.add(funnel);
  } else if (kind === 'sail') {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, 12), MAT.white);
    hull.position.y = 0.7; g.add(hull);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.1, 15, 6), MAT.white);
    mast.position.set(0, 8, 0.5); g.add(mast);
    const sailG = new THREE.BufferGeometry();
    sailG.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.6, 0.4, 0, 14.4, 0.4, 0, 1.2, -5.6], 3));
    sailG.computeVertexNormals();
    const sail = new THREE.Mesh(sailG, new THREE.MeshStandardMaterial({ color: 0xf6f2ea, side: THREE.DoubleSide, roughness: .8 }));
    g.add(sail);
    const jib = sail.clone(); jib.scale.set(1, 0.62, -0.66); jib.position.z = 1.2; g.add(jib);
  } else {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(9, 4, 34), MAT.white);
    hull.position.y = 1.6; g.add(hull);
    const h2 = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 18), MAT.white);
    h2.position.set(0, 5.6, -2); g.add(h2);
    const h3 = new THREE.Mesh(new THREE.BoxGeometry(6, 3.4, 8), MAT.white);
    h3.position.set(0, 9.6, -4); g.add(h3);
    const st = new THREE.Mesh(new THREE.BoxGeometry(3, 3.6, 3), MAT.roof);
    st.position.set(0, 12.4, -4); g.add(st);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
function buildShips(scene) {
  const wt = tex(wakeTex(), 1, 1);
  wt.wrapS = wt.wrapT = THREE.ClampToEdgeWrapping;
  const defs = [
    { kind: 'container', x: 120, z: -2600, dir: 1, spd: 7.2, wake: [300, 90] },
    { kind: 'ferry', x: -230, z: 2200, dir: -1, spd: 9.5, wake: [110, 34] },
    { kind: 'sail', x: 380, z: 900, dir: -1, spd: 3.4, wake: [40, 12] },
    { kind: 'sail', x: -420, z: -1500, dir: 1, spd: 3.0, wake: [40, 12] },
    { kind: 'sail', x: 260, z: -900, dir: 1, spd: 2.6, wake: [40, 12] },
  ];
  for (const d of defs) {
    const g = makeShip(d.kind);
    g.position.set(d.x, 0, d.z);
    g.rotation.y = d.dir > 0 ? 0 : Math.PI;
    const wake = new THREE.Mesh(new THREE.PlaneGeometry(d.wake[1], d.wake[0]),
      new THREE.MeshBasicMaterial({ map: wt, transparent: true, opacity: .5, depthWrite: false, side: THREE.DoubleSide, fog: true }));
    wake.geometry.rotateX(-Math.PI / 2);
    wake.geometry.rotateY(Math.PI / 2);
    wake.position.y = 0.45; wake.renderOrder = 4;
    g.add(wake);
    wake.position.z = -d.wake[0] * 0.5 - 12;
    scene.add(g);
    SHIPS.push({ g, ...d, roll: RND() * 6 });
  }
}
function updateShips(dt) {
  for (const s of SHIPS) {
    s.g.position.z += s.spd * s.dir * dt;
    if (s.dir > 0 && s.g.position.z > 4200) s.g.position.z = -4200;
    if (s.dir < 0 && s.g.position.z < -4200) s.g.position.z = 4200;
    s.roll += dt;
    const amp = s.kind === 'container' ? 0.008 : 0.05;
    s.g.rotation.z = Math.sin(s.roll * 0.7) * amp;
    s.g.rotation.x = Math.sin(s.roll * 0.53 + 1) * amp * 0.7;
    s.g.position.y = Math.sin(s.roll * 0.61) * (s.kind === 'container' ? 0.4 : 0.7);
  }
}

/* ---------------- 堡垒点古堡（1861，砖石炮台 + 灯塔） ---------------- */
function buildFort(scene) {
  const FX = -1075, FZ = 55, FY = 6.4;
  const gp = new THREE.Group(); gp.position.set(FX, FY, FZ); scene.add(gp);
  const b = new Batch(G.box, MAT.brick, { name: 'fort' });
  const stone = new Batch(G.box, MAT.concreteS, { name: 'fortStone' });
  const dark = new Batch(G.box, new THREE.MeshStandardMaterial({ color: 0x2a2320, roughness: 1 }), { name: 'fortWin', cast: false });
  const W = 46, D = 42, H = 13.5;
  // 三面砖墙 + 内院
  const walls = [[0, -D / 2, W, 5], [0, D / 2, W, 5], [-W / 2, 0, 5, D], [W / 2, 0, 5, D]];
  for (const [x, z, sx, sz] of walls) {
    b.box(x, H / 2, z, sx, H, sz);
    stone.box(x, 0.9, z, sx + 1.6, 2.6, sz + 1.6);          // 花岗岩基座
    stone.box(x, H + 0.5, z, sx + 1.2, 1.4, sz + 1.2);      // 女儿墙
  }
  // 拱形炮眼
  for (let lv = 0; lv < 2; lv++) {
    const y = 4.2 + lv * 5.0;
    for (let i = 0; i < 7; i++) {
      const t = (i + 0.5) / 7 - 0.5, x = t * (W - 6);
      dark.box(x, y, -D / 2 - 1.4, 2.2, 3.0, 2.6);
      dark.box(x, y, D / 2 + 1.4, 2.2, 3.0, 2.6);
    }
    for (let i = 0; i < 6; i++) {
      const t = (i + 0.5) / 6 - 0.5, z = t * (D - 6);
      dark.box(-W / 2 - 1.4, y, z, 2.6, 3.0, 2.2);
      dark.box(W / 2 + 1.4, y, z, 2.6, 3.0, 2.2);
    }
  }
  b.build(gp); stone.build(gp); dark.build(gp);
  // 堡顶灯塔（白色塔身 + 黑色灯室）
  const lh = new THREE.Group(); lh.position.set(W / 2 - 8, H + 1.2, -D / 2 + 7); gp.add(lh);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.0, 9, 12), MAT.white);
  tower.position.y = 4.5; lh.add(tower);
  const gal = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.5, 12), MAT.steelDark);
  gal.position.y = 9.2; lh.add(gal);
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 2.6, 10),
    new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: .3, metalness: .6, emissive: 0xffd28a, emissiveIntensity: 0 }));
  lamp.position.y = 10.7; lh.add(lamp); LIGHTHOUSE = lamp;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.9, 2.2, 10), MAT.steelDark);
  cap.position.y = 13.0; lh.add(cap);
  lh.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  // 防波堤
  const rip = new Batch(new THREE.IcosahedronGeometry(1, 0), MAT.rock, { name: 'riprap' });
  for (let i = 0; i < 240; i++) {
    const a = rr(0, TAU), r = rr(30, 62);
    const x = FX + Math.cos(a) * r * 1.3, z = FZ + Math.sin(a) * r;
    const h = landHeight(x, z);
    if (h < -8 || h > 9) continue;
    const s = rr(1.4, 4.2);
    rip.boxR(x, h + s * 0.3, z, s, s * 0.7, s, rr(0, TAU));
  }
  rip.build(scene);
}
let LIGHTHOUSE = null;

/* ---------------- 收费广场 ---------------- */
function buildTollPlaza(scene) {
  const g = new THREE.Group(); scene.add(g);
  const x = -1500, y = deckY(x);
  const col = new Batch(G.box, MAT.concreteS, { name: 'toll' });
  for (let i = 0; i < 8; i++) {
    const z = lerp(-14, 14, i / 7);
    col.box(x, y + 3.6, z, 1.6, 7.2, 1.6);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(26, 1.6, 34), MAT.white);
  roof.position.set(x, y + 8.0, 0); roof.castShadow = true; roof.receiveShadow = true; g.add(roof);
  col.build(g);
  // 行政楼
  const b = new THREE.Mesh(new THREE.BoxGeometry(34, 12, 22), MAT.white);
  b.position.set(-1520, 43, 92); b.castShadow = b.receiveShadow = true; g.add(b);
  const r2 = new THREE.Mesh(new THREE.BoxGeometry(37, 1.6, 25), MAT.roof);
  r2.position.set(-1520, 49.6, 92); g.add(r2);
}

/* ---------------- 海鸥 ---------------- */
let gulls = null; const GULL = [];
function buildGulls(scene) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0.9, -1.9, 0.55, -0.5, 0, 0.05, -0.35,
    0, 0, 0.9, 0, 0.05, -0.35, 1.9, 0.55, -0.5,
  ], 3));
  g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: .8, side: THREE.DoubleSide, flatShading: true });
  gulls = new THREE.InstancedMesh(g, mat, 22);
  gulls.frustumCulled = false; gulls.castShadow = false;
  scene.add(gulls);
  for (let i = 0; i < 22; i++) {
    GULL.push({
      cx: rr(-900, 900), cz: rr(-700, 900), r: rr(60, 420), y: rr(38, 150),
      sp: rr(0.06, 0.16) * (RND() < .5 ? 1 : -1), ph: rr(0, TAU), fl: rr(4, 7), sc: rr(1.4, 2.4),
    });
  }
}
function updateGulls() {
  if (!gulls) return;
  for (let i = 0; i < GULL.length; i++) {
    const b = GULL[i], a = b.ph + S.t * b.sp;
    const x = b.cx + Math.cos(a) * b.r, z = b.cz + Math.sin(a) * b.r * 0.7;
    const y = b.y + Math.sin(S.t * 0.3 + b.ph) * 6;
    const flap = Math.sin(S.t * b.fl + b.ph);
    _q.setFromEuler(new THREE.Euler(flap * 0.3, -a + (b.sp > 0 ? -Math.PI / 2 : Math.PI / 2), flap * 0.42));
    _m.compose(_v0.set(x, y, z), _q, _s.set(b.sc, b.sc, b.sc));
    gulls.setMatrixAt(i, _m);
  }
  gulls.instanceMatrix.needsUpdate = true;
}

/* ---------------- 夜间灯光总控 ---------------- */
function updateNightLights() {
  const n = clamp(S.night * 1.15, 0, 1);
  const on = S.lamps ? Math.max(n, 0.55) : n;
  if (LAMPMESH) LAMPMESH.material.emissiveIntensity = on * 5.5;
  if (LIGHTHOUSE) LIGHTHOUSE.material.emissiveIntensity = (0.6 + 0.4 * Math.sin(S.t * 2.2)) * on * 6;
  if (cityWinMat) {
    cityWinMat.emissiveIntensity = on * 1.35;
    cityWinMat.color.setHex(0x2a2f3a).lerp(_tc.setHex(0x0b0e14), n);
  }
  for (const b of BEACONS) {
    b.material.emissiveIntensity = 0.6 + 0.4 * Math.sin(S.t * 1.6) + on * 2.2;
  }
}
