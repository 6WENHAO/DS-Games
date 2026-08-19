/**
 * util.js —— 参数化几何工具集（全部按毫米建模）
 */
import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/jsm/utils/BufferGeometryUtils.js';

export const TAU = Math.PI * 2;
export const D2R = Math.PI / 180;

/** 旋转体：profile = [[r,y], ...]（mm），绕 Y 轴 */
export function lathe(profile, seg = 48) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(1e-4, r), y));
  return new THREE.LatheGeometry(pts, seg);
}

/** 空心圆筒（带端面） */
export function tubeShell(od, id, h, seg = 48) {
  const g = lathe([
    [id / 2, -h / 2], [od / 2, -h / 2], [od / 2, h / 2], [id / 2, h / 2], [id / 2, -h / 2],
  ], seg);
  return g;
}

/** 圆盘（可带中心孔） */
export function disc(od, h, id = 0, seg = 48) {
  if (id <= 0) return new THREE.CylinderGeometry(od / 2, od / 2, h, seg);
  return tubeShell(od, id, h, seg);
}

/** 圆柱（沿 Y） */
export function cyl(dia, h, seg = 32, dia2 = dia) {
  return new THREE.CylinderGeometry(dia2 / 2, dia / 2, h, seg);
}

/** 倒圆角长方体 */
export function roundBox(w, h, d, r = 4, seg = 3) {
  const shape = new THREE.Shape();
  const x = w / 2 - r, y = h / 2 - r;
  shape.moveTo(-x - r, -y);
  shape.lineTo(-x - r, y);
  shape.quadraticCurveTo(-x - r, y + r, -x, y + r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x + r, y + r, x + r, y);
  shape.lineTo(x + r, -y);
  shape.quadraticCurveTo(x + r, -y - r, x, -y - r);
  shape.lineTo(-x, -y - r);
  shape.quadraticCurveTo(-x - r, -y - r, -x - r, -y);
  const g = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false, curveSegments: seg });
  g.translate(0, 0, -d / 2);
  return g;
}

/** 从 2D 轮廓点（[x,y]）挤出，沿 Z 厚度 t，可选 XY 平面 → 任意朝向 */
export function extrudePoly(points, t, opts = {}) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  if (opts.holes) {
    for (const h of opts.holes) {
      const p = new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y)));
      shape.holes.push(p);
    }
  }
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: t, bevelEnabled: !!opts.bevel, bevelSize: opts.bevel || 0,
    bevelThickness: opts.bevel || 0, bevelSegments: 2, curveSegments: opts.curveSegments || 12,
  });
  g.translate(0, 0, -t / 2);
  return g;
}

/** 极坐标轮廓 → 挤出体（用于凸轮/齿轮等由函数定义的截面） */
export function polarExtrude(radiusFn, t, steps = 240) {
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * TAU;
    const r = radiusFn(a);
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return extrudePoly(pts, t, { curveSegments: 1 });
}

/** 渐开线近似齿轮（模数 m，齿数 z，厚 t，中心孔 bore） */
export function gearGeometry(z, m, t, bore = 0) {
  const rp = (m * z) / 2;          // 分度圆
  const ra = rp + m;               // 齿顶圆
  const rf = rp - 1.25 * m;        // 齿根圆
  const pts = [];
  const per = TAU / z;
  const seg = 6;
  for (let i = 0; i < z; i++) {
    const a0 = i * per;
    // 齿根 → 齿顶 → 齿顶 → 齿根（梯形+圆角近似渐开线）
    const key = [
      [rf, 0.0], [rf, 0.06], [rp, 0.16], [ra, 0.30], [ra, 0.46],
      [rp, 0.60], [rf, 0.70], [rf, 1.0],
    ];
    for (let k = 0; k < key.length - 1; k++) {
      for (let s = 0; s < seg; s++) {
        const u = s / seg;
        const r = key[k][0] + (key[k + 1][0] - key[k][0]) * u;
        const f = key[k][1] + (key[k + 1][1] - key[k][1]) * u;
        const a = a0 + f * per;
        pts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
    }
  }
  const holes = bore > 0 ? [circlePts(bore / 2, 32)] : null;
  const g = extrudePoly(pts, t, { holes, curveSegments: 1 });
  return g;
}

export function circlePts(r, n = 32, cx = 0, cy = 0) {
  const p = [];
  for (let i = n - 1; i >= 0; i--) {
    const a = (i / n) * TAU;
    p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return p;
}

/** 六角螺栓（沿 +Y 生长，头部在 y=0 上方） */
export function hexBolt(across, headH, shankDia, shankLen, seg = 6) {
  const head = new THREE.CylinderGeometry(across / 2, across / 2, headH, seg);
  head.translate(0, headH / 2, 0);
  const shank = new THREE.CylinderGeometry(shankDia / 2, shankDia / 2, shankLen, 12);
  shank.translate(0, -shankLen / 2, 0);
  const washer = new THREE.CylinderGeometry(across / 2 * 0.92, across / 2 * 0.92, 1.6, 16);
  washer.translate(0, -0.8, 0);
  return mergeGeometries([head, shank, washer], false);
}

/** 螺母 */
export function hexNut(across, h, bore) {
  const g = new THREE.CylinderGeometry(across / 2, across / 2, h, 6);
  const hole = new THREE.CylinderGeometry(bore / 2, bore / 2, h + 1, 12);
  // 简化：不做布尔运算，仅外形（示意件）
  hole.dispose?.();
  return g;
}

/** O 形密封圈 */
export function oring(centerDia, cordDia, seg = 48) {
  return new THREE.TorusGeometry(centerDia / 2, cordDia / 2, 10, seg);
}

/** 螺旋弹簧（真实螺旋线，TubeGeometry） */
export function coilSpring(od, wire, coils, len, tubeSeg = 8) {
  const r = (od - wire) / 2;
  const pts = [];
  const n = Math.ceil(coils * 26);
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const a = u * coils * TAU;
    pts.push(new THREE.Vector3(Math.cos(a) * r, u * len, Math.sin(a) * r));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  return new THREE.TubeGeometry(curve, n, wire / 2, tubeSeg, false);
}

/** 由折线点生成管道（软管/油管/水管） */
export function pipeFromPoints(points, od, radial = 14, tension = 0.35, closed = false) {
  const v = points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p)));
  const curve = new THREE.CatmullRomCurve3(v, closed, 'catmullrom', tension);
  const n = Math.max(24, Math.round(curve.getLength() / 9));
  return { geo: new THREE.TubeGeometry(curve, n, od / 2, radial, closed), curve };
}

/** 快速创建 Mesh */
export function mesh(geo, mat, pos = [0, 0, 0], rot = [0, 0, 0], name = '') {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(pos[0], pos[1], pos[2]);
  m.rotation.set(rot[0], rot[1], rot[2]);
  m.castShadow = true;
  m.receiveShadow = true;
  if (name) m.name = name;
  return m;
}

/** 沿 X 轴放置的圆柱（曲轴/凸轮轴类零件常用） */
export function cylX(dia, len, seg = 32) {
  const g = new THREE.CylinderGeometry(dia / 2, dia / 2, len, seg);
  g.rotateZ(Math.PI / 2);
  return g;
}
export function tubeX(od, id, len, seg = 32) {
  const g = tubeShell(od, id, len, seg);
  g.rotateZ(Math.PI / 2);
  return g;
}
export function cylZ(dia, len, seg = 32) {
  const g = new THREE.CylinderGeometry(dia / 2, dia / 2, len, seg);
  g.rotateX(Math.PI / 2);
  return g;
}

/** 合并几何（同材质，减少 draw call）
 *  统一转为「非索引 + 仅 position/normal/uv」，避免 BoxGeometry(索引) 与
 *  ExtrudeGeometry(非索引) 混合导致 mergeGeometries 失败。 */
export function merge(list) {
  const norm = list.filter(Boolean).map((g) => {
    let x = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(x.attributes)) {
      if (k !== 'position' && k !== 'normal' && k !== 'uv') x.deleteAttribute(k);
    }
    if (!x.attributes.uv) {
      const n = x.attributes.position.count;
      x.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    }
    if (!x.attributes.normal) x.computeVertexNormals();
    return x;
  });
  const out = mergeGeometries(norm, false);
  if (!out) throw new Error('merge() 失败：几何属性不兼容');
  return out;
}

/** 实例化重复小件（螺栓等） */
export function instances(geo, mat, transforms, name = '') {
  const im = new THREE.InstancedMesh(geo, mat, transforms.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3(1, 1, 1);
  transforms.forEach((t, i) => {
    const pos = new THREE.Vector3(...(t.pos || [0, 0, 0]));
    const e = new THREE.Euler(...(t.rot || [0, 0, 0]));
    q.setFromEuler(e);
    s.set(...(t.scale || [1, 1, 1]));
    m.compose(pos, q, s);
    im.setMatrixAt(i, m);
  });
  im.castShadow = true;
  im.receiveShadow = true;
  im.name = name;
  im.instanceMatrix.needsUpdate = true;
  return im;
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const smoothstep = (t) => t * t * (3 - 2 * t);
