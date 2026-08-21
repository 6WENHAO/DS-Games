/**
 * 行动装置 (Running Gear)
 *
 * 布局：后置主动轮 + 前置诱导轮 + 每侧 6 对负重轮 + 3 个托带轮（T 系列底盘同源布局）。
 * 履带路径不是手摆的：把所有轮子当成圆，求"圆集合的凸包" —— 这正是一条绷紧
 * 履带的物理形状；再在上支段按支点间距加入自然垂度，最后沿路径等距分布履带板。
 */
import * as THREE from 'three';
import { D, TRACK_X } from './dims.js';
import { DEG, box, boltRing, chamfer, cyl, latheX, mergeAll, pipe, T, tubeFrom } from '../util/geom.js';

/** 履带板中心线相对轮面的偏移（半个履带板厚） */
const PATH_OFF = 0.015;

function add(parent, geo, mat, pid, name) {
  if (!geo) return null;
  const m = new THREE.Mesh(geo, mat);
  m.userData.pid = pid;
  m.name = name || pid;
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/* ------------------------------------------------------------------ *
 * 履带路径求解
 * ------------------------------------------------------------------ */
function convexHull(points) {
  const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  const upper = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper); // CCW（z 为横轴）
}

/** 返回履带中心线闭合折线 [[z,y],...]，绕向：下支段朝 -Z（保证局部坐标系右手且外法线朝外） */
export function trackPath() {
  const circles = [];
  for (const z of D.roadWheelZ) circles.push([z, D.roadWheelY, D.roadWheelR + PATH_OFF]);
  circles.push([D.idler.z, D.idler.y, D.idler.r + PATH_OFF]);
  circles.push([D.sprocket.z, D.sprocket.y, D.sprocket.r + PATH_OFF]);
  for (const z of D.rollerZ) circles.push([z, D.rollerY, D.rollerR + PATH_OFF]);

  const samples = [];
  for (const [cz, cy, r] of circles) {
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      samples.push([cz + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  }
  let hull = convexHull(samples);

  // 归一化绕向：取最低点所在边，要求沿 -Z 前进
  let lo = 0;
  for (let i = 1; i < hull.length; i++) if (hull[i][1] < hull[lo][1]) lo = i;
  const nxt = hull[(lo + 1) % hull.length];
  if (nxt[0] - hull[lo][0] > 0) hull = hull.slice().reverse();

  // 上支段自然垂度：托带轮之间的直段向下松弛
  const out = [];
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    out.push(a);
    const isUpper = a[1] > 0.75 && b[1] > 0.75;
    const div = isUpper && len > 0.45 ? 6 : Math.max(1, Math.round(len / 0.22));
    for (let k = 1; k < div; k++) {
      const t = k / div;
      let z = a[0] + (b[0] - a[0]) * t;
      let y = a[1] + (b[1] - a[1]) * t;
      if (isUpper && len > 0.45) y -= Math.min(0.035, len * 0.022) * Math.sin(Math.PI * t);
      out.push([z, y]);
    }
  }
  return out;
}

/** 沿路径等距取样，返回 {pos:[z,y], tan:[z,y]} 列表 */
function resample(path, count) {
  const segs = [];
  let total = 0;
  for (let i = 0; i < path.length; i++) {
    const a = path[i];
    const b = path[(i + 1) % path.length];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    segs.push({ a, b, l, s: total });
    total += l;
  }
  const res = [];
  for (let k = 0; k < count; k++) {
    const target = (total * k) / count;
    let si = 0;
    while (si < segs.length - 1 && segs[si].s + segs[si].l < target) si++;
    const sg = segs[si];
    const t = (target - sg.s) / sg.l;
    res.push({
      pos: [sg.a[0] + (sg.b[0] - sg.a[0]) * t, sg.a[1] + (sg.b[1] - sg.a[1]) * t],
      tan: [(sg.b[0] - sg.a[0]) / sg.l, (sg.b[1] - sg.a[1]) / sg.l],
    });
  }
  return { samples: res, total };
}

/* ------------------------------------------------------------------ *
 * 轮系零件
 * ------------------------------------------------------------------ */
function roadWheelDisc() {
  return latheX(
    [
      [0, -0.075],
      [0.055, -0.075],
      [0.06, -0.052],
      [0.14, -0.05],
      [0.152, -0.03],
      [0.3, -0.035],
      [0.318, -0.07],
      [0.322, -0.07],
      [0.322, 0.07],
      [0.318, 0.07],
      [0.3, 0.035],
      [0.152, 0.03],
      [0.14, 0.05],
      [0.06, 0.052],
      [0.055, 0.075],
      [0, 0.075],
    ],
    26,
  );
}

function roadWheelTyre() {
  return latheX(
    [
      [0.318, -0.072],
      [D.roadWheelR, -0.066],
      [D.roadWheelR, 0.066],
      [0.318, 0.072],
      [0.318, -0.072],
    ],
    26,
  );
}

function sprocketBody() {
  return latheX(
    [
      [0, -0.06],
      [0.07, -0.06],
      [0.08, -0.04],
      [0.15, -0.035],
      [0.16, -0.02],
      [0.255, -0.025],
      [0.262, -0.055],
      [0.262, 0.055],
      [0.255, 0.025],
      [0.16, 0.02],
      [0.15, 0.035],
      [0.08, 0.04],
      [0.07, 0.06],
      [0, 0.06],
    ],
    22,
  );
}

/* ------------------------------------------------------------------ *
 * 构建
 * ------------------------------------------------------------------ */
export function buildRunningGear(M) {
  const g = new THREE.Group();
  g.name = 'runningGear';
  const refs = { wheels: [] };
  g.userData.refs = refs;

  const path = trackPath();

  for (const side of [-1, 1]) {
    const sx = side * TRACK_X;
    const inner = side * (D.tubHalfWidth + 0.02);

    /* ---- 负重轮 ×6（双轮缘，中间留导向齿槽）---- */
    D.roadWheelZ.forEach((z, i) => {
      const wheel = new THREE.Group();
      wheel.position.set(sx, D.roadWheelY, z);
      g.add(wheel);
      refs.wheels.push(wheel);
      for (const off of [-0.115, 0.115]) {
        add(wheel, T(roadWheelDisc(), { pos: [off, 0, 0] }), M.steelDark, 'run.roadwheel', `负重轮 ${i + 1}`);
        add(wheel, T(roadWheelTyre(), { pos: [off, 0, 0] }), M.rubber, 'run.roadwheel', `负重轮 ${i + 1} 胶带`);
      }
      // 轮毂盖与螺栓
      add(wheel, T(cyl(0.075, 0.075, 0.05, 14, 'x'), { pos: [0.2, 0, 0] }), M.steel, 'run.roadwheel', '轮毂盖');
      const hb = boltRing(0.05, 8, 0.011, 0.014, 0);
      hb.rotateZ(Math.PI / 2);
      add(wheel, T(hb, { pos: [0.23, 0, 0] }), M.steel, 'run.roadwheel', '轮毂螺栓');
      // 平衡肘（摇臂）与轴
      add(
        g,
        T(chamfer(0.12, 0.17, 0.34, 0.03), { pos: [inner + side * 0.05, D.roadWheelY + 0.04, z - 0.16] }),
        M.steelDark,
        'run.suspension',
        `平衡肘 ${i + 1}`,
      );
      add(
        g,
        T(cyl(0.055, 0.055, 0.3, 14, 'x'), { pos: [inner + side * 0.12, D.roadWheelY, z] }),
        M.steel,
        'run.suspension',
        `负重轮轴 ${i + 1}`,
      );
      // 液压减振器（1、2、6 号位）
      if (i === 0 || i === 1 || i === 5) {
        add(
          g,
          T(cyl(0.045, 0.05, 0.42, 12, 'z'), { rot: [i === 5 ? -0.5 : 0.5, 0, 0], pos: [inner + side * 0.04, D.roadWheelY + 0.24, z + (i === 5 ? -0.18 : 0.18)] }),
          M.steel,
          'run.damper',
          `液压减振器 ${i + 1}`,
        );
      }
    });

    /* ---- 诱导轮（前）+ 履带张紧机构 ---- */
    const idler = new THREE.Group();
    idler.position.set(sx, D.idler.y, D.idler.z);
    g.add(idler);
    refs.wheels.push(idler);
    for (const off of [-0.115, 0.115]) {
      add(
        idler,
        T(
          latheX(
            [
              [0, -0.062],
              [0.05, -0.062],
              [0.06, -0.04],
              [0.13, -0.036],
              [0.15, -0.02],
              [0.24, -0.026],
              [D.idler.r, -0.06],
              [D.idler.r, 0.06],
              [0.24, 0.026],
              [0.15, 0.02],
              [0.13, 0.036],
              [0.06, 0.04],
              [0.05, 0.062],
              [0, 0.062],
            ],
            24,
          ),
          { pos: [off, 0, 0] },
        ),
        M.steelDark,
        'run.idler',
        '诱导轮',
      );
    }
    add(idler, T(cyl(0.07, 0.07, 0.05, 14, 'x'), { pos: [0.19, 0, 0] }), M.steel, 'run.idler', '诱导轮轮毂');
    // 曲臂式张紧机构
    add(
      g,
      T(chamfer(0.14, 0.2, 0.5, 0.03), { pos: [inner + side * 0.06, D.idler.y - 0.02, D.idler.z - 0.3] }),
      M.steelDark,
      'run.tensioner',
      '履带张紧曲臂',
    );
    add(
      g,
      T(cyl(0.05, 0.05, 0.26, 12, 'z'), { pos: [inner + side * 0.06, D.idler.y + 0.2, D.idler.z - 0.42] }),
      M.steel,
      'run.tensioner',
      '张紧调节螺杆',
    );

    /* ---- 主动轮（后）+ 齿圈 + 侧减速器 ---- */
    const sprocket = new THREE.Group();
    sprocket.position.set(sx, D.sprocket.y, D.sprocket.z);
    g.add(sprocket);
    refs.wheels.push(sprocket);
    for (const off of [-0.13, 0.13]) {
      add(sprocket, T(sprocketBody(), { pos: [off, 0, 0] }), M.steelDark, 'run.sprocket', '主动轮轮体');
      // 齿
      const teeth = [];
      for (let t = 0; t < D.sprocket.teeth; t++) {
        const a = (t / D.sprocket.teeth) * Math.PI * 2;
        const tooth = chamfer(0.085, 0.075, 0.1, 0.012);
        T(tooth, { rot: [a, 0, 0] });
        T(tooth, { pos: [off, Math.cos(a) * (D.sprocket.r - 0.015), Math.sin(a) * (D.sprocket.r - 0.015)] });
        teeth.push(tooth);
      }
      add(sprocket, mergeAll(teeth), M.steel, 'run.sprocket', '主动轮齿');
    }
    add(sprocket, T(cyl(0.1, 0.1, 0.06, 16, 'x'), { pos: [0.24, 0, 0] }), M.steel, 'run.sprocket', '主动轮毂');
    const sb = boltRing(0.07, 10, 0.012, 0.016, 0);
    sb.rotateZ(Math.PI / 2);
    add(sprocket, T(sb, { pos: [0.27, 0, 0] }), M.steel, 'run.sprocket', '主动轮螺栓');
    // 侧减速器（最终传动）壳体
    add(
      g,
      T(chamfer(0.34, 0.42, 0.44, 0.04), { pos: [inner + side * 0.14, D.sprocket.y, D.sprocket.z] }),
      M.engineBlock,
      'power.finalDrive',
      '侧减速器（最终传动）',
    );
    add(
      g,
      T(pipe(0.12, 0.07, 0.2, 18, 'x'), { pos: [sx - side * 0.12, D.sprocket.y, D.sprocket.z] }),
      M.steelDark,
      'power.finalDrive',
      '侧减速器输出轴',
    );

    /* ---- 托带轮 ×3 ---- */
    D.rollerZ.forEach((z, i) => {
      const roller = new THREE.Group();
      roller.position.set(sx, D.rollerY, z);
      g.add(roller);
      refs.wheels.push(roller);
      add(
        roller,
        T(cyl(D.rollerR, D.rollerR, 0.1, 18, 'x'), { pos: [-0.09, 0, 0] }),
        M.rubber,
        'run.roller',
        `托带轮 ${i + 1}`,
      );
      add(
        roller,
        T(cyl(D.rollerR, D.rollerR, 0.1, 18, 'x'), { pos: [0.09, 0, 0] }),
        M.rubber,
        'run.roller',
        `托带轮 ${i + 1}`,
      );
      add(roller, T(cyl(0.05, 0.05, 0.24, 12, 'x'), {}), M.steelDark, 'run.roller', '托带轮轴');
      add(
        g,
        T(box(0.1, 0.14, 0.12), { pos: [inner + side * 0.04, D.rollerY - 0.02, z] }),
        M.steelDark,
        'run.roller',
        '托带轮支座',
      );
    });

    /* ---- 履带 ---- */
    const pitch = D.trackPitch;
    const probe = resample(path, 8);
    const count = Math.max(60, Math.round(probe.total / pitch));
    const { samples } = resample(path, count);
    const links = [];
    const w = D.trackWidth;
    for (const s of samples) {
      const [pz, py] = s.pos;
      const [tz, ty] = s.tan;
      // 局部坐标：X=车宽方向, Z=切向, Y=外法线（由右手系推出 N=(tz,-ty)）
      const m = new THREE.Matrix4().makeBasis(
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0, tz, -ty),
        new THREE.Vector3(0, ty, tz),
      );
      m.setPosition(0, py, pz);

      const body = box(w, 0.03, pitch * 0.92);
      const pad = box(w * 0.86, 0.03, pitch * 0.78);
      pad.translate(0, 0.03, 0);
      const horn = chamfer(0.07, 0.08, pitch * 0.52, 0.01);
      horn.translate(0, -0.055, 0);
      const pinA = cyl(0.016, 0.016, w * 0.99, 8, 'x');
      pinA.translate(0, 0, pitch * 0.46);
      const link = mergeAll([body, pad, horn, pinA]);
      link.applyMatrix4(m);
      links.push(link);
    }
    const trackGeo = mergeAll(links);
    trackGeo.translate(sx, 0, 0);
    add(g, trackGeo, M.track, 'run.track', side > 0 ? '右履带' : '左履带');

    // 履带板橡胶衬垫（单独材质：只做地面接触段，降低面数）
    const pads = [];
    for (const s of samples) {
      if (s.pos[1] > 0.2) continue;
      const [pz, py] = s.pos;
      const [tz, ty] = s.tan;
      const m = new THREE.Matrix4().makeBasis(
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0, tz, -ty),
        new THREE.Vector3(0, ty, tz),
      );
      m.setPosition(0, py, pz);
      const p = box(w * 0.8, 0.016, pitch * 0.7);
      p.translate(0, 0.045, 0);
      p.applyMatrix4(m);
      pads.push(p);
    }
    const padGeo = mergeAll(pads);
    if (padGeo) {
      padGeo.translate(sx, 0, 0);
      add(g, padGeo, M.trackPad, 'run.track', '履带橡胶衬垫');
    }
  }

  /* ---- 扭杆悬挂（车体内部横置扭杆）---- */
  const bars = [];
  D.roadWheelZ.forEach((z, i) => {
    const len = D.tubHalfWidth * 2 - 0.16;
    bars.push(T(cyl(0.038, 0.038, len, 10, 'x'), { pos: [i % 2 === 0 ? 0.04 : -0.04, 0.56, z - 0.16] }));
  });
  add(g, mergeAll(bars), M.steel, 'run.torsionBar', '扭杆弹簧（横置）');

  return g;
}
