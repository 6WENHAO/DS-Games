/* ============================================================================
 *  30 · 几何构造核心：放样(loft)、超椭圆截面、翼型、UV 世界投影
 * ==========================================================================*/

/* ---------- 超椭圆环：截面轮廓（YZ 平面），返回 [ [y,z], ... ] ---------- */
/* w:半宽(z)  h:半高(y)  yc:中心高  eTop/eBot:上下指数(2=椭圆, >2 更方)  flat:侧面平直度 */
function ringSuperellipse(w, h, yc, {
  eTop = 2.4, eBot = 2.2, count = 56, hTop = null, hBot = null,
  wTop = 1, wBot = 1, shear = 0, bulge = 0, bulgeY = -0.3,
} = {}) {
  const ht = hTop === null ? h : hTop, hb = hBot === null ? h : hBot;
  const pts = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU;               // 0 = +z 方向（右侧）
    const ca = Math.cos(a), sa = Math.sin(a);  // z, y
    const up = sa >= 0;
    const e = up ? eTop : eBot;
    const hh = up ? ht : hb;
    const ww = w * (up ? wTop : wBot);
    const sgn = v => v < 0 ? -1 : 1;
    let z = sgn(ca) * Math.pow(Math.abs(ca), 2 / e) * ww;
    let y = sgn(sa) * Math.pow(Math.abs(sa), 2 / e) * hh;
    if (bulge) {                                // 侧面鼓包（弹药舱 / 航电舱）
      const g = Math.exp(-Math.pow((y / Math.max(hh, 1e-4) - bulgeY) * 1.6, 2));
      z += sgn(ca) * bulge * g * Math.pow(Math.abs(ca), 0.35);
    }
    y += yc + shear * z;
    pts.push([y, z]);
  }
  return pts;
}

/* 由截面数组生成放样几何体
 * sections: [{ x, ring:[[y,z]...], vScale? }, ...]  —— 环点数必须一致
 * UV 以"米"为单位（与真实尺寸一致 → 全机纹理密度统一）
 */
function loft(sections, { capStart = false, capEnd = false, uvScale = 1, flipU = false, openRing = false } = {}) {
  // 统一为 x 递增序（保证三角面朝外）
  if (sections.length > 1 && sections[sections.length - 1].x < sections[0].x) {
    sections = sections.slice().reverse();
    const t = capStart; capStart = capEnd; capEnd = t;
  }
  const M = sections.length, N = sections[0].ring.length;
  const pos = [], uv = [], idx = [];
  // v: 沿机身累计弧长
  const vArr = [0];
  for (let s = 1; s < M; s++) {
    let d = 0;
    for (let i = 0; i < N; i++) {
      const a = sections[s].ring[i], b = sections[s - 1].ring[i];
      d += Math.hypot(sections[s].x - sections[s - 1].x, a[0] - b[0], a[1] - b[1]);
    }
    vArr.push(vArr[s - 1] + d / N);
  }
  const W = openRing ? N : N + 1;          // 每断面顶点数
  for (let s = 0; s < M; s++) {
    const sec = sections[s], ring = sec.ring;
    // u: 环向累计弧长
    let u = 0;
    for (let i = 0; i < W; i++) {
      const p = ring[i % N];
      if (i > 0) {
        const q = ring[i - 1];
        u += Math.hypot(p[0] - q[0], p[1] - q[1]);
      }
      pos.push(sec.x, p[0], p[1]);
      uv.push((flipU ? -u : u) * uvScale, vArr[s] * uvScale);
    }
  }
  const lim = openRing ? N - 1 : N;
  for (let s = 0; s < M - 1; s++) {
    for (let i = 0; i < lim; i++) {
      const a = s * W + i, b = s * W + i + 1, c = (s + 1) * W + i + 1, d = (s + 1) * W + i;
      idx.push(a, d, c, a, c, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (!openRing) weldSeamNormals(g, M, W, N);

  const parts = [g];
  if (capStart) parts.push(capGeom(sections[0], false, uvScale));
  if (capEnd) parts.push(capGeom(sections[M - 1], true, uvScale));
  return parts.length > 1 ? mergeGeoms(parts) : g;
}

/* 缝合环向接缝法线（首尾同位点取平均，消除接缝亮线） */
function weldSeamNormals(g, M, W, N) {
  const nAttr = g.attributes.normal;
  for (let s = 0; s < M; s++) {
    const a = s * W, b = s * W + N;
    const nx = (nAttr.getX(a) + nAttr.getX(b)) * 0.5;
    const ny = (nAttr.getY(a) + nAttr.getY(b)) * 0.5;
    const nz = (nAttr.getZ(a) + nAttr.getZ(b)) * 0.5;
    const l = Math.hypot(nx, ny, nz) || 1;
    nAttr.setXYZ(a, nx / l, ny / l, nz / l);
    nAttr.setXYZ(b, nx / l, ny / l, nz / l);
  }
  nAttr.needsUpdate = true;
}

/* 端盖（三角扇） */
function capGeom(sec, forward, uvScale) {
  const ring = sec.ring, N = ring.length;
  let cy = 0, cz = 0;
  for (const p of ring) { cy += p[0]; cz += p[1]; }
  cy /= N; cz /= N;
  const pos = [sec.x, cy, cz], uv = [0.5, 0.5], idx = [];
  for (let i = 0; i < N; i++) pos.push(sec.x, ring[i][0], ring[i][1]);
  for (let i = 0; i < N; i++) uv.push(ring[i][1] * uvScale, ring[i][0] * uvScale);
  for (let i = 1; i <= N; i++) {
    const a = i, b = i % N + 1;
    if (forward) idx.push(0, a, b); else idx.push(0, b, a);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* 合并几何体（仅 position/normal/uv，索引式） */
function mergeGeoms(list) {
  let vc = 0, ic = 0;
  for (const g of list) { vc += g.attributes.position.count; ic += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3), uv = new Float32Array(vc * 2);
  const idx = vc > 65535 ? new Uint32Array(ic) : new Uint16Array(ic);
  let vo = 0, io = 0;
  for (const g of list) {
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    pos.set(g.attributes.position.array, vo * 3);
    nor.set(g.attributes.normal.array, vo * 3);
    uv.set(g.attributes.uv.array, vo * 2);
    const gi = g.index ? g.index.array : null;
    const n = g.attributes.position.count;
    if (gi) for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo;
    else for (let i = 0; i < n; i++) idx[io + i] = i + vo;
    io += gi ? gi.length : n;
    vo += n;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

/* ---------- 世界尺度 UV（盒投影）：让所有零件蒙皮纹理密度一致 ---------- */
function boxUV(g, scale = 1, offset = [0, 0]) {
  if (!g.attributes.normal) g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    let u, v;
    if (nx >= ny && nx >= nz) { u = z; v = y; }
    else if (ny >= nz) { u = x; v = z; }
    else { u = x; v = y; }
    uv[i * 2] = u * scale + offset[0];
    uv[i * 2 + 1] = v * scale + offset[1];
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/* ---------- 站位表加密（Catmull-Rom）：让放样曲面更顺滑 ---------- */
function cr(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}
function resample(rows, mul = 3) {
  if (mul <= 1 || rows.length < 3) return rows;
  const isArr = Array.isArray(rows[0]);
  const keys = isArr ? rows[0].map((_, i) => i) : Object.keys(rows[0]);
  const at = i => rows[clamp(i, 0, rows.length - 1)];
  const out = [];
  for (let i = 0; i < rows.length - 1; i++) {
    for (let s = 0; s < mul; s++) {
      const t = s / mul;
      const o = isArr ? [] : {};
      for (const k of keys) o[k] = cr(at(i - 1)[k] ?? 0, at(i)[k] ?? 0, at(i + 1)[k] ?? 0, at(i + 2)[k] ?? 0, t);
      out.push(o);
    }
  }
  out.push(isArr ? at(rows.length - 1).slice() : { ...at(rows.length - 1) });
  return out;
}

/* ---------- NACA 四位翼型 ---------- */
/* 返回闭合轮廓 [[x,y]...]，x: 0→c（前缘→后缘），上表面正 y */
function naca(c, thick = 0.12, n = 40, camber = 0) {
  const up = [], lo = [];
  for (let i = 0; i <= n; i++) {
    const b = (i / n) * PI * 0.5;
    const t = 1 - Math.cos(b);            // 前缘加密
    const xc = Math.min(1, t);
    const yt = 5 * thick * (0.2969 * Math.sqrt(xc) - 0.1260 * xc - 0.3516 * xc * xc + 0.2843 * xc ** 3 - 0.1036 * xc ** 4);
    const yc = camber ? (xc < 0.4 ? camber / 0.16 * (2 * 0.4 * xc - xc * xc) : camber / 0.36 * (1 - 2 * 0.4 + 2 * 0.4 * xc - xc * xc)) : 0;
    up.push([xc * c, (yc + yt) * c]);
    lo.push([xc * c, (yc - yt) * c]);
  }
  lo.reverse(); lo.pop(); up.pop();
  return up.concat(lo);
}

/* 翼型放样：沿 spanAxis 生成机翼/桨叶
 * stations: [{ s(展向位置), chord, thick, twist(rad), dx(前后偏移), dy(上下偏移), scaleZ? }]
 */
function loftAirfoil(stations, { n = 34, uvScale = 1, camber = 0, spanAxis = 'z', capRoot = true, capTip = true } = {}) {
  const secs = [];
  for (const st of stations) {
    const prof = naca(st.chord, st.thick, n, st.camber === undefined ? camber : st.camber);
    const cos = Math.cos(st.twist || 0), sin = Math.sin(st.twist || 0);
    const ring = prof.map(([px, py]) => {
      const xr = px - st.chord * 0.25;               // 以 1/4 弦为轴
      let x = xr * cos - py * sin, y = xr * sin + py * cos;
      x += (st.dx || 0); y += (st.dy || 0);
      return [y, x];                                  // [y, z] —— z 承载弦向
    });
    ring.reverse();                                   // 保证环向与超椭圆一致（外法线）
    secs.push({ x: st.s, ring });
  }
  // spanAxis: 'z' → 展向为 z；此处先按 x 放样再旋转
  const g = loft(secs, { capStart: capRoot, capEnd: capTip, uvScale });
  if (spanAxis === 'z') {
    // 当前：x=展向, y=厚度, z=弦向 → 目标：z=展向, y=厚度, x=弦向
    const m = new THREE.Matrix4().makeRotationY(-PI / 2);
    g.applyMatrix4(m);
  }
  return g;
}

/* ---------- 常用零件 ---------- */
function cyl(rt, rb, h, seg = 24, open = false, uvScale = 1) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
  return boxUV(g, uvScale);
}
function box(w, h, d, uvScale = 1, seg = 1) {
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  return boxUV(g, uvScale);
}
function sph(r, seg = 24, uvScale = 1) {
  return boxUV(new THREE.SphereGeometry(r, seg, Math.max(8, seg >> 1)), uvScale);
}
/* 沿曲线的管（线束 / 液压管 / 天线） */
function tube(points, r, { seg = null, radial = 8, closed = false, uvScale = 1 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), closed);
  const g = new THREE.TubeGeometry(curve, seg || Math.max(8, points.length * 8), r, radial, closed);
  return g;
}
/* 倒角盒（更高级的硬表面观感） */
function roundBox(w, h, d, r = 0.02, seg = 3, uvScale = 1) {
  // 用超椭圆放样近似圆角盒
  const secs = [];
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = -w / 2 + w * t;
    const e = 1 - Math.pow(Math.abs(t * 2 - 1), 3);
    const k = Math.min(1, 0.001 + Math.pow(e, 0.35));
    secs.push({ x, ring: ringSuperellipse(d / 2 * k, h / 2 * k, 0, { eTop: 6, eBot: 6, count: 28 }) });
  }
  return loft(secs, { capStart: true, capEnd: true, uvScale });
}

/* 螺栓 / 铆钉阵列（InstancedMesh） */
function bolts(list, r = 0.012, h = 0.008, mat = null, seg = 8) {
  const g = new THREE.CylinderGeometry(r, r * 1.05, h, seg);
  g.translate(0, h / 2, 0);
  const m = new THREE.InstancedMesh(g, mat, list.length);
  const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const s = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
  list.forEach((it, i) => {
    const [p, nrm] = it;
    q.setFromUnitVectors(up, v.set(...(nrm || [0, 1, 0])).normalize());
    mx.compose(new THREE.Vector3(...p), q, s);
    m.setMatrixAt(i, mx);
  });
  m.castShadow = m.receiveShadow = true;
  return m;
}

/* 环形螺栓（法兰） */
function flangeBolts(cx, axis, radius, count, r = 0.012, h = 0.01, mat = null, phase = 0) {
  const list = [];
  for (let i = 0; i < count; i++) {
    const a = phase + i / count * TAU;
    if (axis === 'x') list.push([[cx[0], cx[1] + Math.sin(a) * radius, cx[2] + Math.cos(a) * radius], [1, 0, 0]]);
    else if (axis === 'y') list.push([[cx[0] + Math.cos(a) * radius, cx[1], cx[2] + Math.sin(a) * radius], [0, 1, 0]]);
    else list.push([[cx[0] + Math.cos(a) * radius, cx[1] + Math.sin(a) * radius, cx[2]], [0, 0, 1]]);
  }
  return bolts(list, r, h, mat);
}

/* mesh 快捷方式 */
function mesh(g, m, { pos = null, rot = null, scale = null, name = '', shadow = true, layer = null } = {}) {
  const o = new THREE.Mesh(g, m);
  if (pos) o.position.set(...pos);
  if (rot) o.rotation.set(...rot);
  if (scale) (typeof scale === 'number') ? o.scale.setScalar(scale) : o.scale.set(...scale);
  o.name = name;
  o.castShadow = shadow; o.receiveShadow = shadow;
  return o;
}
function group(name, children = [], pos = null) {
  const g = new THREE.Group();
  g.name = name;
  for (const c of children) if (c) g.add(c);
  if (pos) g.position.set(...pos);
  return g;
}
/* 沿两点连线的方杆（框架 / 支柱 / 拉杆） */
function barMesh(p0, p1, w, h, mat, uvScale = 2) {
  const a = new THREE.Vector3(...p0), b = new THREE.Vector3(...p1);
  const d = b.clone().sub(a), L = d.length();
  const m = new THREE.Mesh(box(w, h, L, uvScale), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize());
  m.castShadow = m.receiveShadow = true;
  return m;
}
/* 沿两点连线的圆管 */
function pipeMesh(p0, p1, r, mat, seg = 12, r2 = null) {
  const a = new THREE.Vector3(...p0), b = new THREE.Vector3(...p1);
  const d = b.clone().sub(a), L = d.length();
  const g = new THREE.CylinderGeometry(r, r2 === null ? r : r2, L, seg, 1);
  boxUV(g, 4);
  const m = new THREE.Mesh(g, mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  m.castShadow = m.receiveShadow = true;
  return m;
}
/* 平面四边形（平面着色，世界尺度 UV）—— 用于风挡玻璃等平板件 */
function quadGeom(p0, p1, p2, p3, uvScale = 1) {
  const v = [p0, p1, p2, p3].map(p => new THREE.Vector3(...p));
  const pos = [], uv = [], nor = [];
  const n = new THREE.Vector3().crossVectors(
    v[1].clone().sub(v[0]), v[3].clone().sub(v[0])).normalize();
  // 建立平面内基向量做 UV
  const ex = v[1].clone().sub(v[0]).normalize();
  const ey = new THREE.Vector3().crossVectors(n, ex).normalize();
  const tri = [0, 1, 2, 0, 2, 3];
  for (const i of tri) {
    const p = v[i];
    pos.push(p.x, p.y, p.z);
    nor.push(n.x, n.y, n.z);
    const rel = p.clone().sub(v[0]);
    uv.push(rel.dot(ex) * uvScale, rel.dot(ey) * uvScale);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}
/* 贴花：贴在给定位置/朝向的小平面 */
function decal(texture, w, h, pos, rot, opts = {}) {
  const g = new THREE.PlaneGeometry(w, h);
  const m = new THREE.Mesh(g, MATS.decalOf(texture, opts));
  m.position.set(...pos);
  m.rotation.set(...rot);
  m.renderOrder = 2;
  return m;
}
/* 多段折线剖面 → 旋转体（用于整流罩 / 灯罩） */
function latheProfile(pts, seg = 32, uvScale = 1) {
  const g = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg);
  return boxUV(g, uvScale);
}

/* 镜像（左右对称件） */
function mirrorZ(obj) {
  const c = obj.clone(true);
  c.scale.z *= -1;
  c.traverse(o => { if (o.isMesh) o.material = o.material; });
  return c;
}
