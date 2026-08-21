/**
 * 星际战舰 “破晓 / DAWNBREAKER”（Nova 级重型截击舰）
 *
 * 建模思路（追求精致 + 帅气）：
 *  - 舰体用连续变截面放样（loft），得到硬朗折面 + 平滑过渡的主体
 *  - 前掠翼 + 外倾垂尾，构成有攻击性的剪影
 *  - 四台矢量推进器：喷口会随操控输入偏转，尾焰随油门/加力变化
 *  - 座舱有真实内构（座椅、仪表辉光、框架肋条）
 *  - 上千个程序化“堆料”零件（面板/管路/散热片）提供近看的细节密度
 *  - 导航灯、频闪灯、能量导管、雷达天线、双炮塔均有动画
 *
 * 模型在本地空间朝 +Z 建造，最后整体旋转 180°，
 * 使对外接口统一为：前 = -Z, 上 = +Y, 右 = +X（与相机一致）。
 */
import * as THREE from 'three';
import {
  loft, hullProfile, superellipse, airfoilProfile, bevelBox, mirroredX, xform,
  mergeAll, greebleField,
} from '../util/geom.js';
import { hullTextureSet, decalTexture, glowTexture } from '../util/textures.js';
import { TAU, clamp01, lerp, damp, makeRng } from '../util/math.js';

/** 从几何体表面均匀采样（用于撒细节零件） */
function makeSurfaceSampler(geo, filter) {
  const pos = geo.attributes.position;
  const idx = geo.index;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), n = new THREE.Vector3();
  const tris = [];
  let total = 0;
  const count = idx ? idx.count : pos.count;
  for (let i = 0; i < count; i += 3) {
    const i0 = idx ? idx.getX(i) : i;
    const i1 = idx ? idx.getX(i + 1) : i + 1;
    const i2 = idx ? idx.getX(i + 2) : i + 2;
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1);
    c.fromBufferAttribute(pos, i2);
    ab.subVectors(b, a); ac.subVectors(c, a);
    n.crossVectors(ab, ac);
    const area = n.length() * 0.5;
    if (area < 1e-6) continue;
    n.normalize();
    const cx = (a.x + b.x + c.x) / 3, cy = (a.y + b.y + c.y) / 3, cz = (a.z + b.z + c.z) / 3;
    if (filter && !filter({ x: cx, y: cy, z: cz }, { x: n.x, y: n.y, z: n.z })) continue;
    total += area;
    tris.push({ i0, i1, i2, cum: total, n: n.clone() });
  }
  if (!tris.length) return () => null;
  return (u, v, rng) => {
    const target = u * total;
    let lo = 0, hi = tris.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tris[mid].cum < target) lo = mid + 1; else hi = mid;
    }
    const t = tris[lo];
    a.fromBufferAttribute(pos, t.i0);
    b.fromBufferAttribute(pos, t.i1);
    c.fromBufferAttribute(pos, t.i2);
    let r1 = v, r2 = rng ? rng() : 0.33;
    if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }
    const p = [
      a.x + ab.subVectors(b, a).x * r1 + ac.subVectors(c, a).x * r2,
      a.y + (b.y - a.y) * r1 + (c.y - a.y) * r2,
      a.z + (b.z - a.z) * r1 + (c.z - a.z) * r2,
    ];
    return { pos: p, normal: [t.n.x, t.n.y, t.n.z], tangent: [0, 0, 1] };
  };
}

export class Starship {
  constructor({ quality = 'high' } = {}) {
    this.quality = quality;
    this.group = new THREE.Group();       // 对外：前 = -Z
    this.group.name = 'Starship';
    this.model = new THREE.Group();       // 内部：前 = +Z
    this.model.rotation.y = Math.PI;
    this.group.add(this.model);

    this.length = 21;
    this.radius = 7.2;                    // 碰撞半径
    this.time = 0;
    this.throttle = 0;
    this.boost = 0;
    this.warp = 0;
    this.inputPitch = 0;
    this.inputYaw = 0;
    this.inputRoll = 0;
    this.shieldFlash = 0;

    this._nozzles = [];
    this._plumes = [];
    this._glows = [];
    this._navLights = [];
    this._strobes = [];
    this._vanes = [];
    this._turrets = [];

    this._buildMaterials();
    this._buildHull();
    this._buildDorsal();
    this._buildCockpit();
    this._buildWings();
    this._buildTails();
    this._buildEngines();
    this._buildDetails();
    this._buildLights();
    this._buildShield();
  }

  /* ==================== 材质 ==================== */
  _buildMaterials() {
    const texSize = this.quality === 'low' ? 512 : 1024;
    const hullTex = hullTextureSet(texSize, 11, '#8e99a8');
    const plateTex = hullTextureSet(texSize / 2, 29, '#5d6673');

    this.matHull = new THREE.MeshStandardMaterial({
      color: 0xc9d3df,
      map: hullTex.map,
      normalMap: hullTex.normalMap,
      roughnessMap: hullTex.roughnessMap,
      metalness: 0.58,
      roughness: 0.46,
      envMapIntensity: 1.5,
    });
    if (this.matHull.normalMap) this.matHull.normalScale.set(0.7, 0.7);

    this.matDark = new THREE.MeshStandardMaterial({
      color: 0x39414c,
      map: plateTex.map,
      normalMap: plateTex.normalMap,
      metalness: 0.72,
      roughness: 0.4,
      envMapIntensity: 1.2,
    });
    if (this.matDark.normalMap) this.matDark.normalScale.set(0.6, 0.6);

    this.matTrim = new THREE.MeshStandardMaterial({
      color: 0x18202a, metalness: 0.95, roughness: 0.22, envMapIntensity: 1.4,
    });

    this.matGold = new THREE.MeshStandardMaterial({
      color: 0xd8a13c, metalness: 1.0, roughness: 0.28, envMapIntensity: 1.6,
    });

    this.matAccent = new THREE.MeshStandardMaterial({
      color: 0x0d2230, emissive: 0x35d8ff, emissiveIntensity: 2.6,
      metalness: 0.4, roughness: 0.5, toneMapped: true,
    });

    this.matWarn = new THREE.MeshStandardMaterial({
      color: 0x3a2408, emissive: 0xffa326, emissiveIntensity: 1.8,
      metalness: 0.4, roughness: 0.5,
    });

    this.matGlass = new THREE.MeshStandardMaterial({
      color: 0x0b1a2a, metalness: 0.55, roughness: 0.06,
      transparent: true, opacity: 0.46, envMapIntensity: 2.6,
      side: THREE.FrontSide, depthWrite: false,
    });

    this.matCore = new THREE.MeshBasicMaterial({ color: 0xbff0ff, toneMapped: true });

    const decal = decalTexture('DSH-01', 512);
    this.matDecal = new THREE.MeshStandardMaterial({
      map: decal, transparent: true, metalness: 0.6, roughness: 0.45,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
      depthWrite: false,
    });
  }

  add(mesh) {
    this.model.add(mesh);
    return mesh;
  }

  /* ==================== 主舰体 ==================== */
  _buildHull() {
    const prof = hullProfile(30, { keel: 0.58, chine: 1.16, crown: 0.94 });
    const stations = [
      { z: -9.4, sx: 1.42, sy: 1.00, oy: 0.05 },
      { z: -8.6, sx: 1.72, sy: 1.18, oy: 0.04 },
      { z: -6.4, sx: 1.94, sy: 1.32, oy: 0.02 },
      { z: -3.6, sx: 2.10, sy: 1.40, oy: 0.0 },
      { z: -0.8, sx: 2.06, sy: 1.34, oy: -0.02 },
      { z: 1.8, sx: 1.86, sy: 1.16, oy: -0.06 },
      { z: 4.2, sx: 1.52, sy: 0.94, oy: -0.12 },
      { z: 6.4, sx: 1.16, sy: 0.72, oy: -0.2 },
      { z: 8.4, sx: 0.78, sy: 0.48, oy: -0.3 },
      { z: 10.0, sx: 0.42, sy: 0.28, oy: -0.4 },
      { z: 11.1, sx: 0.14, sy: 0.10, oy: -0.46 },
    ];
    this.hullGeo = loft(prof, stations, { uvScale: [3, 5] });
    const hull = new THREE.Mesh(this.hullGeo, this.matHull);
    hull.name = 'hull';
    this.add(hull);

    // 舰腹装甲龙骨
    const keelProf = superellipse(16, 3.2, 1, 1);
    const keel = loft(keelProf, [
      { z: -8.8, sx: 1.05, sy: 0.28, oy: -1.18 },
      { z: -5.0, sx: 1.35, sy: 0.34, oy: -1.32 },
      { z: 0.0, sx: 1.3, sy: 0.32, oy: -1.3 },
      { z: 4.6, sx: 0.95, sy: 0.24, oy: -1.02 },
      { z: 7.6, sx: 0.5, sy: 0.14, oy: -0.72 },
    ]);
    this.add(new THREE.Mesh(keel, this.matDark));

    // 侧向进气/散热口（深色内凹格栅）
    const grills = [];
    for (let i = 0; i < 3; i++) {
      const z = -1.2 - i * 2.0;
      grills.push(xform(bevelBox(0.5, 1.05, 1.6, 0.08), { pos: [2.02, 0.18, z] }));
      for (let k = 0; k < 4; k++) {
        grills.push(xform(bevelBox(0.62, 0.06, 1.3, 0.02), { pos: [2.12, -0.28 + k * 0.25, z] }));
      }
    }
    const grillGeo = mergeAll(grills);
    this.add(new THREE.Mesh(grillGeo, this.matTrim));
    this.add(new THREE.Mesh(mirroredX(grillGeo), this.matTrim));

    // 舰体侧面涂装贴花
    const decalGeo = new THREE.PlaneGeometry(4.6, 1.5);
    const dLeft = new THREE.Mesh(decalGeo, this.matDecal);
    dLeft.position.set(2.12, 0.42, 2.2);
    dLeft.rotation.y = Math.PI / 2;
    dLeft.rotation.z = -0.06;
    this.add(dLeft);
    const dRight = dLeft.clone();
    dRight.position.x = -2.12;
    dRight.rotation.y = -Math.PI / 2;
    dRight.rotation.z = 0.06;
    this.add(dRight);

    // 机首传感器阵列
    const nose = mergeAll([
      xform(new THREE.CylinderGeometry(0.16, 0.05, 1.2, 12), { pos: [0, -0.46, 11.5], rot: [Math.PI / 2, 0, 0] }),
      xform(bevelBox(0.9, 0.16, 1.4, 0.05), { pos: [0, -0.12, 9.6] }),
    ]);
    this.add(new THREE.Mesh(nose, this.matTrim));

    const scanner = new THREE.Mesh(
      xform(bevelBox(0.72, 0.1, 1.05, 0.03), { pos: [0, -0.1, 9.62] }),
      this.matAccent,
    );
    this.add(scanner);
    this._scanner = scanner;

    // 舰体能量导管（发光细带）
    const conduits = [];
    for (const side of [1, -1]) {
      for (let i = 0; i < 2; i++) {
        const y = 0.62 - i * 1.16;
        conduits.push(xform(bevelBox(0.1, 0.1, 9.2, 0.02), { pos: [side * 1.86, y, -1.6] }));
      }
    }
    this.add(new THREE.Mesh(mergeAll(conduits), this.matAccent));
  }

  /* ==================== 背脊 ==================== */
  _buildDorsal() {
    const prof = superellipse(18, 3.0, 1, 1);
    const spine = loft(prof, [
      { z: -8.4, sx: 0.85, sy: 0.42, oy: 1.14 },
      { z: -6.0, sx: 1.02, sy: 0.52, oy: 1.24 },
      { z: -2.4, sx: 1.06, sy: 0.5, oy: 1.3 },
      { z: 1.2, sx: 0.86, sy: 0.4, oy: 1.24 },
      { z: 3.4, sx: 0.6, sy: 0.28, oy: 1.1 },
    ]);
    this.add(new THREE.Mesh(spine, this.matDark));

    // 散热鳍片
    const fins = [];
    for (let i = 0; i < 9; i++) {
      const z = -7.8 + i * 0.92;
      const h = 0.26 + 0.2 * Math.sin((i / 8) * Math.PI);
      fins.push(xform(bevelBox(1.5, h, 0.1, 0.02), { pos: [0, 1.62 + h * 0.2, z] }));
    }
    this.add(new THREE.Mesh(mergeAll(fins), this.matGold));

    // 背脊发光缝
    const slit = new THREE.Mesh(
      mergeAll([xform(bevelBox(0.22, 0.05, 7.4, 0.01), { pos: [0, 1.66, -3.0] })]),
      this.matAccent,
    );
    this.add(slit);
  }

  /* ==================== 座舱 ==================== */
  _buildCockpit() {
    // 舱体基座
    const base = loft(superellipse(20, 2.6, 1, 1), [
      { z: 2.4, sx: 1.05, sy: 0.5, oy: 0.86 },
      { z: 3.6, sx: 1.16, sy: 0.62, oy: 0.92 },
      { z: 5.6, sx: 1.02, sy: 0.56, oy: 0.88 },
      { z: 7.2, sx: 0.7, sy: 0.36, oy: 0.72 },
    ]);
    this.add(new THREE.Mesh(base, this.matDark));

    // 座舱内壳（深色，避免透过玻璃看到空腔；不封端，座舱视角才能看出去）
    const inner = loft(superellipse(18, 2.4, 1, 1), [
      { z: 3.0, sx: 0.9, sy: 0.46, oy: 1.0 },
      { z: 4.4, sx: 0.98, sy: 0.54, oy: 1.04 },
      { z: 6.2, sx: 0.8, sy: 0.44, oy: 0.98 },
      { z: 7.0, sx: 0.5, sy: 0.26, oy: 0.86 },
    ], { capStart: false, capEnd: false });
    const innerMat = new THREE.MeshStandardMaterial({
      color: 0x080c12, metalness: 0.5, roughness: 0.8, side: THREE.DoubleSide,
    });
    this.add(new THREE.Mesh(inner, innerMat));

    // 座椅 + 仪表台
    const seat = mergeAll([
      xform(bevelBox(0.5, 0.12, 0.6, 0.03), { pos: [0, 0.98, 4.0] }),
      xform(bevelBox(0.5, 0.62, 0.12, 0.03), { pos: [0, 1.24, 3.72] }),
      xform(bevelBox(0.14, 0.42, 0.14, 0.03), { pos: [0.3, 1.16, 3.9] }),
      xform(bevelBox(0.14, 0.42, 0.14, 0.03), { pos: [-0.3, 1.16, 3.9] }),
    ]);
    this.add(new THREE.Mesh(seat, this.matTrim));

    const console1 = new THREE.Mesh(
      mergeAll([
        xform(bevelBox(0.78, 0.06, 0.42, 0.02), { pos: [0, 1.02, 5.1], rot: [-0.5, 0, 0] }),
        xform(bevelBox(0.3, 0.05, 0.2, 0.01), { pos: [0.42, 1.12, 4.62], rot: [-0.7, 0, 0.2] }),
        xform(bevelBox(0.3, 0.05, 0.2, 0.01), { pos: [-0.42, 1.12, 4.62], rot: [-0.7, 0, -0.2] }),
      ]),
      new THREE.MeshStandardMaterial({
        color: 0x0a1a24, emissive: 0x3ce0ff, emissiveIntensity: 0.95,
        metalness: 0.3, roughness: 0.5,
      }),
    );
    this.add(console1);
    this._console = console1;

    // 座舱玻璃罩
    const canopy = loft(superellipse(24, 2.3, 1, 1), [
      { z: 2.9, sx: 0.96, sy: 0.5, oy: 1.0 },
      { z: 4.2, sx: 1.06, sy: 0.62, oy: 1.06 },
      { z: 6.0, sx: 0.9, sy: 0.5, oy: 1.0 },
      { z: 7.3, sx: 0.48, sy: 0.26, oy: 0.84 },
    ], { capStart: false, capEnd: true });
    const glass = new THREE.Mesh(canopy, this.matGlass);
    glass.renderOrder = 4;
    this.add(glass);

    // 舱盖框架肋条
    const ribs = [];
    for (let i = 0; i < 4; i++) {
      const z = 3.3 + i * 1.25;
      const s = 1.02 - i * 0.13;
      ribs.push(xform(new THREE.TorusGeometry(0.9 * s, 0.035, 5, 22, Math.PI), {
        pos: [0, 1.02, z], rot: [0, 0, 0], scale: [1.08, 0.62, 1],
      }));
    }
    ribs.push(xform(bevelBox(0.07, 0.07, 4.5, 0.01), { pos: [0, 1.62, 5.0] }));
    this.add(new THREE.Mesh(mergeAll(ribs), this.matTrim));
  }

  /* ==================== 机翼 ==================== */
  _buildWings() {
    const prof = airfoilProfile(24, 0.19, 0.02);
    // 放样后 rotateY(+90°)：站位 z → +X(右舷展向)，剖面 x → -Z
    // 故弦心 z = -ox；tip 的 ox 取负值 ⇒ 翼尖前移 ⇒ 前掠翼
    const wing = loft(prof, [
      { z: 1.55, sx: 7.4, sy: 4.2, ox: 0.9, oy: -0.02 },
      { z: 2.6, sx: 7.0, sy: 3.85, ox: 0.55, oy: -0.05 },
      { z: 4.6, sx: 5.6, sy: 3.0, ox: -0.6, oy: -0.14 },
      { z: 6.6, sx: 4.1, sy: 2.1, ox: -1.8, oy: -0.26 },
      { z: 8.0, sx: 2.9, sy: 1.45, ox: -2.6, oy: -0.37 },
      { z: 8.7, sx: 1.6, sy: 0.85, ox: -3.2, oy: -0.44 },
    ]);
    wing.rotateY(Math.PI / 2);            // 展向 → +X，翼前缘朝 +Z
    wing.translate(0, 0.05, -0.4);
    const wingMirror = mirroredX(wing);   // 左舷

    this.add(new THREE.Mesh(wing, this.matHull));
    this.add(new THREE.Mesh(wingMirror, this.matHull));

    // 翼根整形罩（沿机身前后方向放样）
    const fair = loft(superellipse(16, 2.6, 1, 1), [
      { z: -5.6, sx: 0.62, sy: 0.5, ox: 2.0, oy: 0.05 },
      { z: -2.4, sx: 0.86, sy: 0.66, ox: 2.15, oy: 0.05 },
      { z: 1.2, sx: 0.8, sy: 0.6, ox: 2.1, oy: 0.02 },
      { z: 3.6, sx: 0.42, sy: 0.34, ox: 1.9, oy: -0.05 },
    ]);
    this.add(new THREE.Mesh(fair, this.matDark));
    this.add(new THREE.Mesh(mirroredX(fair), this.matDark));

    // 前缘能量叶片（发光带，沿翼前缘）
    const vaneGeo = xform(bevelBox(7.1, 0.1, 0.18, 0.02), {
      pos: [5.1, -0.18, 3.0], rot: [0, -0.177, -0.06],
    });
    const vaneMat = this.matAccent.clone();
    this.add(new THREE.Mesh(vaneGeo, vaneMat));
    this.add(new THREE.Mesh(mirroredX(vaneGeo), vaneMat));
    this._vanes.push(vaneMat);

    // 翼下挂架 + 导弹吊舱
    const podParts = [];
    for (let i = 0; i < 2; i++) {
      const x = -3.4 - i * 2.1;
      const z = -0.4 + i * 0.85;
      podParts.push(xform(bevelBox(0.34, 0.5, 0.5, 0.06), { pos: [x, -0.42, z] }));
      podParts.push(xform(new THREE.CylinderGeometry(0.3, 0.3, 2.5, 14), {
        pos: [x, -0.86, z], rot: [Math.PI / 2, 0, 0],
      }));
      podParts.push(xform(new THREE.ConeGeometry(0.3, 0.9, 14), {
        pos: [x, -0.86, z + 1.7], rot: [Math.PI / 2, 0, 0],
      }));
      for (let k = 0; k < 4; k++) {
        podParts.push(xform(bevelBox(0.06, 0.42, 0.5, 0.02), {
          pos: [x, -0.86, z - 1.15], rot: [0, 0, (k / 4) * TAU],
        }));
      }
    }
    const podGeo = mergeAll(podParts);
    this.add(new THREE.Mesh(podGeo, this.matDark));
    this.add(new THREE.Mesh(mirroredX(podGeo), this.matDark));

    // 翼尖灯座
    const tipGeo = xform(bevelBox(0.5, 0.22, 1.2, 0.05), { pos: [-8.55, -0.39, 2.8] });
    this.add(new THREE.Mesh(tipGeo, this.matTrim));
    this.add(new THREE.Mesh(mirroredX(tipGeo), this.matTrim));
  }

  /* ==================== 垂尾 ==================== */
  _buildTails() {
    const prof = airfoilProfile(18, 0.22, 0.0);
    const fin = loft(prof, [
      { z: 0.0, sx: 4.4, sy: 1.6, ox: 0.0 },
      { z: 1.2, sx: 3.8, sy: 1.3, ox: 0.45 },
      { z: 2.4, sx: 2.8, sy: 0.95, ox: 1.0 },
      { z: 3.3, sx: 1.7, sy: 0.58, ox: 1.5 },
    ]);
    fin.rotateY(Math.PI / 2);    // 展向 → +X
    fin.rotateZ(Math.PI / 2);    // 立起 → +Y，厚度 → X
    const finGeo = xform(fin, { pos: [-1.15, 1.0, -6.6], rot: [0, 0, 0.34] });
    this.add(new THREE.Mesh(finGeo, this.matHull));
    this.add(new THREE.Mesh(mirroredX(finGeo), this.matHull));

    // 垂尾后缘发光条（后缘近乎垂直）
    const stripGeo = xform(bevelBox(0.09, 3.1, 0.16, 0.02), {
      pos: [-1.67, 2.46, -8.72], rot: [0, 0, 0.34],
    });
    const stripMat = this.matAccent.clone();
    this.add(new THREE.Mesh(stripGeo, stripMat));
    this.add(new THREE.Mesh(mirroredX(stripGeo), stripMat));
    this._vanes.push(stripMat);
  }

  /* ==================== 引擎 ==================== */
  _buildEngines() {
    const glowTex = glowTexture(128, '#ffffff', 'rgba(70,170,255,0)', 2.2);
    const mkNozzle = (x, y, z, r, len) => {
      const g = new THREE.Group();
      g.position.set(x, y, z);

      // 外壳
      const housing = loft(superellipse(20, 2.8, 1, 1), [
        { z: -len * 0.5, sx: r * 0.92, sy: r * 0.92 },
        { z: -len * 0.2, sx: r * 1.06, sy: r * 1.06 },
        { z: len * 0.18, sx: r * 1.0, sy: r * 1.0 },
        { z: len * 0.5, sx: r * 1.16, sy: r * 1.16 },
      ], { capStart: true, capEnd: false });
      g.add(new THREE.Mesh(housing, this.matDark));

      // 喷口环
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r * 1.12, r * 0.1, 8, 26),
        this.matTrim,
      );
      ring.position.z = -len * 0.5;
      ring.rotation.y = 0;
      g.add(ring);

      // 内壁 + 涡轮叶片
      const innerGeos = [];
      for (let i = 0; i < 12; i++) {
        innerGeos.push(xform(bevelBox(r * 0.16, r * 0.5, len * 0.5, 0.01), {
          pos: [0, r * 0.62, 0], rot: [0, 0, (i / 12) * TAU],
        }));
      }
      const vanes = new THREE.Mesh(mergeAll(innerGeos), this.matTrim);
      vanes.position.z = -len * 0.12;
      g.add(vanes);

      // 发光核心
      const core = new THREE.Mesh(
        new THREE.CircleGeometry(r * 0.92, 26),
        new THREE.MeshBasicMaterial({ color: 0x9fe8ff, toneMapped: true }),
      );
      core.position.z = -len * 0.46;
      core.rotation.y = Math.PI;
      g.add(core);

      // 尾焰（加法混合锥体）
      const plumeMat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uPower: { value: 0 },
          uColorIn: { value: new THREE.Color(0xdff6ff) },
          uColorOut: { value: new THREE.Color(0x3aa0ff) },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          varying vec3 vN;
          varying vec3 vV;
          void main(){
            vUv = uv;
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vN = normalize(mat3(modelMatrix) * normal);
            vV = normalize(cameraPosition - wp.xyz);
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `,
        fragmentShader: /* glsl */ `
          precision mediump float;
          uniform float uTime; uniform float uPower;
          uniform vec3 uColorIn; uniform vec3 uColorOut;
          varying vec2 vUv;
          varying vec3 vN;
          varying vec3 vV;
          float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
          float n2(vec2 p){
            vec2 i = floor(p), f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x),
                       mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y);
          }
          void main(){
            // 圆柱 UV：v=1 在喷口(粗端)，v=0 在尾端
            float t = clamp(1.0 - vUv.y, 0.0, 1.0);
            float flick = n2(vec2(vUv.x * 10.0, t * 7.0 - uTime * 9.0)) * 0.55
                        + n2(vec2(vUv.x * 24.0, t * 16.0 - uTime * 16.0)) * 0.45;
            float edge = 1.0 - abs(dot(normalize(vN), normalize(vV)));
            float shape = pow(1.0 - t, 1.6);
            float a = shape * (0.42 + 0.8 * flick) * (0.45 + 0.85 * edge) * uPower;
            vec3 col = mix(uColorIn, uColorOut, pow(t, 0.7));
            col = mix(col, vec3(1.0), pow(1.0 - t, 5.0) * 0.9);
            gl_FragColor = vec4(col * a * 2.6, a);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const plumeLen = len * 5.2;
      const plumeGeo = new THREE.CylinderGeometry(r * 0.92, r * 0.16, plumeLen, 20, 1, true);
      plumeGeo.translate(0, -plumeLen * 0.5, 0);
      plumeGeo.rotateX(Math.PI / 2);      // 指向 -Z（尾部）
      const plume = new THREE.Mesh(plumeGeo, plumeMat);
      plume.position.z = -len * 0.5;
      plume.renderOrder = 8;
      g.add(plume);
      this._plumes.push({ mesh: plume, mat: plumeMat, baseLen: plumeLen });

      // 喷口辉光贴片
      if (glowTex) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({
          map: glowTex, color: 0x9fe0ff, blending: THREE.AdditiveBlending,
          transparent: true, depthWrite: false, opacity: 0.9,
        }));
        s.scale.setScalar(r * 5.5);
        s.position.z = -len * 0.55;
        g.add(s);
        this._glows.push({ sprite: s, base: r * 5.5 });
      }

      this.model.add(g);
      this._nozzles.push({ group: g, base: g.position.clone(), r });
      return g;
    };

    // 两台主机（舰体后部）+ 两台副机（翼根）
    mkNozzle(0.92, 0.14, -9.5, 0.78, 2.2);
    mkNozzle(-0.92, 0.14, -9.5, 0.78, 2.2);
    mkNozzle(2.28, 0.1, -8.4, 0.44, 1.5);
    mkNozzle(-2.28, 0.1, -8.4, 0.44, 1.5);

    // 引擎舱结构
    const block = mergeAll([
      xform(bevelBox(3.6, 1.7, 1.5, 0.12), { pos: [0, 0.14, -8.9] }),
      xform(bevelBox(1.0, 1.0, 1.2, 0.08), { pos: [2.28, 0.1, -7.9] }),
      xform(bevelBox(1.0, 1.0, 1.2, 0.08), { pos: [-2.28, 0.1, -7.9] }),
    ]);
    this.add(new THREE.Mesh(block, this.matDark));

    // 姿态控制推进器（小喷口）
    const rcs = [];
    const rcsSpots = [
      [1.9, 1.0, 6.0], [-1.9, 1.0, 6.0], [1.9, -0.9, 6.0], [-1.9, -0.9, 6.0],
      [2.0, 1.0, -4.0], [-2.0, 1.0, -4.0], [2.0, -1.0, -4.0], [-2.0, -1.0, -4.0],
    ];
    for (const [x, y, z] of rcsSpots) {
      rcs.push(xform(new THREE.CylinderGeometry(0.13, 0.16, 0.2, 10), {
        pos: [x, y, z], rot: [0, 0, Math.PI / 2 * Math.sign(x)],
      }));
    }
    this.add(new THREE.Mesh(mergeAll(rcs), this.matTrim));
  }

  /* ==================== 细节：堆料 / 天线 / 炮塔 ==================== */
  _buildDetails() {
    const rng = makeRng(20240711);
    const density = this.quality === 'low' ? 240 : this.quality === 'medium' ? 480 : 820;

    // 上表面 & 侧面堆料
    const sampler = makeSurfaceSampler(this.hullGeo, (p, n) => {
      if (p.z > 8.6) return false;            // 机首保持干净
      if (Math.abs(n.y) < 0.25 && Math.abs(n.x) < 0.4) return false;
      if (p.y > 0.6 && Math.abs(p.x) < 1.0 && p.z > 2.0 && p.z < 7.6) return false; // 让开座舱
      return true;
    });
    const greebles = greebleField(sampler, rng, density, {
      sizeRange: [0.1, 0.55],
      heightRange: [0.03, 0.14],
      kinds: ['box', 'box', 'plate', 'plate', 'pipe', 'dome'],
    });
    this.add(new THREE.Mesh(greebles, this.matDark));

    // 更亮的一层小面板，增加色彩层次
    const greebles2 = greebleField(sampler, makeRng(7788), Math.floor(density * 0.45), {
      sizeRange: [0.14, 0.7],
      heightRange: [0.015, 0.05],
      kinds: ['plate', 'plate', 'box'],
    });
    this.add(new THREE.Mesh(greebles2, this.matHull));

    // 金色隔热箔片（集中在引擎段）
    const foilSampler = makeSurfaceSampler(this.hullGeo, (p, n) => p.z < -3.0 && n.y > 0.1);
    const foil = greebleField(foilSampler, makeRng(4242), Math.floor(density * 0.16), {
      sizeRange: [0.2, 0.6], heightRange: [0.01, 0.03], kinds: ['plate'],
    });
    this.add(new THREE.Mesh(foil, this.matGold));

    // 雷达天线（会转）
    const dish = new THREE.Group();
    dish.position.set(0, 1.78, -4.6);
    const dishGeo = new THREE.SphereGeometry(0.46, 20, 10, 0, TAU, 0, Math.PI * 0.4);
    const dishMesh = new THREE.Mesh(dishGeo, this.matHull);
    dishMesh.rotation.x = -Math.PI * 0.42;
    dishMesh.material = this.matHull;
    dish.add(dishMesh);
    dish.add(new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8),
      this.matTrim,
    ));
    const feed = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), this.matAccent);
    feed.position.set(0, 0.3, 0.28);
    dish.add(feed);
    this.add(dish);
    this._dish = dish;

    // 通讯天线
    const masts = [];
    masts.push(xform(new THREE.CylinderGeometry(0.03, 0.02, 2.2, 6), { pos: [0.55, 2.0, -6.2], rot: [0.24, 0, 0.12] }));
    masts.push(xform(new THREE.CylinderGeometry(0.025, 0.015, 1.6, 6), { pos: [-0.55, 1.9, -6.4], rot: [0.3, 0, -0.16] }));
    this.add(new THREE.Mesh(mergeAll(masts), this.matTrim));

    // 双联炮塔（背部 + 腹部）
    const mkTurret = (y, flip) => {
      const base = new THREE.Group();
      base.position.set(0, y, 0.4);
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.5, 0.2, 18), this.matDark);
      base.add(ring);
      const yaw = new THREE.Group();
      base.add(yaw);
      const body = new THREE.Mesh(bevelBox(0.72, 0.36, 0.8, 0.06), this.matHull);
      body.position.y = 0.2 * (flip ? -1 : 1);
      yaw.add(body);
      const pitch = new THREE.Group();
      pitch.position.set(0, 0.2 * (flip ? -1 : 1), 0.2);
      yaw.add(pitch);
      for (const bx of [-0.16, 0.16]) {
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 1.5, 10), this.matTrim);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(bx, 0, 0.7);
        pitch.add(barrel);
        const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.16, 10), this.matAccent);
        tip.rotation.x = Math.PI / 2;
        tip.position.set(bx, 0, 1.42);
        pitch.add(tip);
      }
      if (flip) base.rotation.z = Math.PI;
      this.add(base);
      this._turrets.push({ yaw, pitch, phase: Math.random() * TAU });
    };
    mkTurret(1.66, false);
    mkTurret(-1.42, true);
  }

  /* ==================== 灯光 ==================== */
  _buildLights() {
    const mkLamp = (color, x, y, z, size, intensity) => {
      const mat = new THREE.MeshBasicMaterial({ color, toneMapped: true });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 10, 8), mat);
      mesh.position.set(x, y, z);
      this.add(mesh);
      const tex = glowTexture(64, '#ffffff', 'rgba(255,255,255,0)', 2);
      let sprite = null;
      if (tex) {
        sprite = new THREE.Sprite(new THREE.SpriteMaterial({
          map: tex, color, blending: THREE.AdditiveBlending,
          transparent: true, depthWrite: false, opacity: 0.85,
        }));
        sprite.scale.setScalar(size * 9);
        sprite.position.set(x, y, z);
        this.add(sprite);
      }
      return { mat, sprite, color: new THREE.Color(color), intensity };
    };

    // 舷灯：左红右绿
    this._navLights.push(mkLamp(0xff2d2d, -8.62, -0.39, 2.95, 0.11, 1));
    this._navLights.push(mkLamp(0x2dff6a, 8.62, -0.39, 2.95, 0.11, 1));
    // 频闪：背脊 + 尾部
    this._strobes.push(mkLamp(0xffffff, 0, 1.74, 1.4, 0.075, 1));
    this._strobes.push(mkLamp(0xffffff, 0, -1.48, -2.0, 0.075, 1));
    this._strobes.push(mkLamp(0xffe2a0, 0, 2.9, -7.2, 0.07, 1));

    // 船体自发光补光：冷色轮廓光 + 引擎暖光
    const rim = new THREE.DirectionalLight(0x9cc8ff, 1.35);
    rim.position.set(-0.6, 1.0, -0.7);
    this.group.add(rim);
    const engineLight = new THREE.PointLight(0x66ccff, 0, 60, 2);
    engineLight.position.set(0, 0.2, 10.5); // group 空间：尾部在 +Z
    this.group.add(engineLight);
    this._engineLight = engineLight;
  }

  /* ==================== 护盾 ==================== */
  _buildShield() {
    this.shieldMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uFlash: { value: 0 },
        uColor: { value: new THREE.Color(0x6fd6ff) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vN; varying vec3 vView; varying vec3 vPos;
        void main(){
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vPos = position;
          vN = normalize(mat3(modelMatrix) * normal);
          vView = normalize(cameraPosition - wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        precision mediump float;
        uniform float uTime; uniform float uFlash; uniform vec3 uColor;
        varying vec3 vN; varying vec3 vView; varying vec3 vPos;
        void main(){
          float f = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 3.2);
          // 六边形能量网格
          vec2 g = vPos.xy * 1.7 + vec2(vPos.z * 0.9, 0.0);
          float grid = smoothstep(0.86, 1.0, max(abs(sin(g.x * 3.0)), abs(sin(g.y * 3.0))));
          float pulse = 0.55 + 0.45 * sin(uTime * 3.0 - vPos.z * 0.6);
          float a = (f * 0.5 + grid * 0.22 * f) * uFlash * pulse;
          gl_FragColor = vec4(uColor * a * 2.2, a);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const shield = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), this.shieldMat);
    shield.scale.set(9.6, 4.2, 13.0);
    shield.renderOrder = 9;
    this.group.add(shield);
    this.shield = shield;
  }

  /* ==================== 每帧更新 ==================== */
  update(dt, state = {}) {
    this.time += dt;
    const t = this.time;
    const throttle = clamp01(state.throttle ?? this.throttle);
    const boost = clamp01(state.boost ?? this.boost);
    const warp = clamp01(state.warp ?? this.warp);
    this.throttle = throttle;
    this.boost = boost;
    this.warp = warp;
    const power = clamp01(throttle * 0.75 + boost * 0.55 + warp * 1.0);

    // 尾焰
    for (let i = 0; i < this._plumes.length; i++) {
      const p = this._plumes[i];
      const jitter = 0.9 + 0.1 * Math.sin(t * 37 + i * 2.1);
      p.mat.uniforms.uTime.value = t;
      p.mat.uniforms.uPower.value = power * jitter;
      const len = 0.26 + power * (0.85 + warp * 0.95);
      p.mesh.scale.set(0.8 + power * 0.35, 0.8 + power * 0.35, len);
      p.mat.uniforms.uColorOut.value.setHSL(
        lerp(0.58, 0.78, boost * 0.7 + warp * 0.3), 0.9, lerp(0.5, 0.62, boost),
      );
    }
    for (const g of this._glows) {
      g.sprite.material.opacity = 0.18 + power * 0.85;
      g.sprite.scale.setScalar(g.base * (0.55 + power * 0.8));
    }
    if (this._engineLight) {
      this._engineLight.intensity = power * 950;
      this._engineLight.distance = 90 + power * 120;
    }

    // 矢量喷口随操控偏转
    const py = -(state.pitch ?? this.inputPitch);
    const yw = state.yaw ?? this.inputYaw;
    for (const n of this._nozzles) {
      n.group.rotation.x = damp(n.group.rotation.x, py * 0.2, 8, dt);
      n.group.rotation.y = damp(n.group.rotation.y, -yw * 0.2, 8, dt);
    }

    // 能量导管/叶片随功率脉动
    const glowI = 1.6 + power * 3.4 + 0.35 * Math.sin(t * 2.2);
    this.matAccent.emissiveIntensity = glowI;
    for (const m of this._vanes) m.emissiveIntensity = glowI * 1.15;
    if (this._console) this._console.material.emissiveIntensity = 0.9 + 0.22 * Math.sin(t * 5.0);

    // 导航灯 / 频闪
    for (const l of this._navLights) {
      const k = 0.75 + 0.25 * Math.sin(t * 2.0);
      l.mat.color.copy(l.color).multiplyScalar(k * 2.2);
      if (l.sprite) l.sprite.material.opacity = 0.55 * k;
    }
    for (let i = 0; i < this._strobes.length; i++) {
      const l = this._strobes[i];
      const phase = (t * 1.15 + i * 0.34) % 1;
      const on = phase < 0.09 ? 1 : phase < 0.16 ? 0.5 : 0.02;
      l.mat.color.copy(l.color).multiplyScalar(on * 3.2);
      if (l.sprite) l.sprite.material.opacity = on * 0.9;
    }

    // 雷达天线 + 炮塔
    if (this._dish) this._dish.rotation.y += dt * 0.55;
    for (const tu of this._turrets) {
      tu.yaw.rotation.y = Math.sin(t * 0.31 + tu.phase) * 1.5;
      tu.pitch.rotation.x = -0.25 + Math.sin(t * 0.23 + tu.phase * 1.7) * 0.35;
    }

    // 护盾
    this.shieldFlash = Math.max(0, this.shieldFlash - dt * 1.6);
    const shieldA = clamp01(this.shieldFlash + boost * 0.28 + warp * 0.5);
    this.shieldMat.uniforms.uTime.value = t;
    this.shieldMat.uniforms.uFlash.value = shieldA;
    this.shield.visible = shieldA > 0.01;
  }

  flashShield(amount = 1) {
    this.shieldFlash = Math.min(1.6, this.shieldFlash + amount);
  }
}
