/* =============================================================
 * piano.js —— 纯白三角钢琴模型（程序化建模）
 *
 * 结构：琴壳(rim) / 音板 / 铸铁排(plate) / 琴弦 / 弦槌 / 制音器
 *       88 键键盘 / 键盘盖 / 谱架 / 大琴盖(两折) / 支撑杆
 *       三条车削琴腿 + 脚轮 / 琴腿架(lyre) + 三踏板
 * ============================================================= */
(function (global) {
  'use strict';

  const T = global.THREE;
  const G = global.Geom;
  const V2 = (x, y) => new T.Vector2(x, y);
  const V3 = (x, y, z) => new T.Vector3(x, y, z);

  /* ---------------- 尺寸规格（单位：米，接近 7 尺三角琴） ---------------- */
  const S = {
    W: 0.755,            // 半宽
    L: 2.26,             // 全长
    caseY: 0.700,        // 琴壳底面高度
    rimH: 0.265,         // 侧板高度
    rimT: 0.056,         // 侧板厚度
    bellyY: 0.335,       // 共鸣箱前沿（shape 坐标 y）
    lidT: 0.024,         // 琴盖厚度
    lidOver: 0.010,      // 琴盖外沿出檐
    lidSplit: 0.98,      // 前后两折分界
    keyTopY: 0.737,      // 白键顶面
    keyH: 0.021,         // 白键厚度
    keyBackZ: -0.322,    // 琴键后端（支点）
    keyLen: 0.310,       // 琴键总长
    wkPitch: 0.0235,     // 白键节距
    wkGap: 0.0013,       // 白键缝隙
    bkW: 0.0137,         // 黑键宽
    bkH: 0.0115,         // 黑键高出白键
    wkFront: 0.052,      // 白键前段（全宽）长度
    bkLen: 0.094,        // 黑键可见长度
    bkFrontGap: 0.054,   // 黑键前端比白键前端靠后
    sbY: 0.723,          // 音板高度
    plateY: 0.797,       // 铸铁排高度
    plateT: 0.020,
    stringY: 0.829,      // 琴弦高度
    nameZ: -0.167,       // 名牌板前沿（键盘盖铰链）
  };
  const KEY_X0 = -(52 * S.wkPitch) / 2; // 键盘左端

  /* ---------------- 材质 ---------------- */
  function makeMaterials() {
    const roughMap = G.keyRoughness();
    const grain = G.soundboardGrain();
    if (grain) grain.repeat.set(0.55, 0.55);

    const M = {};
    // 钢琴漆：极光滑的纯白 + 清漆层
    M.lacquer = new T.MeshPhysicalMaterial({
      color: 0xffffff, roughness: 0.055, metalness: 0.0,
      clearcoat: 1.0, clearcoatRoughness: 0.030, envMapIntensity: 0.90, reflectivity: 0.32,
    });
    // 琴腔内壁 / 背面：哑光一些，避免纯白糊成一片
    M.lacquerSoft = new T.MeshPhysicalMaterial({
      color: 0xf0f2f5, roughness: 0.32, metalness: 0.0,
      clearcoat: 0.40, clearcoatRoughness: 0.20, envMapIntensity: 0.62,
    });
    // 白键：象牙质感，细腻哑光高光
    M.whiteKey = new T.MeshPhysicalMaterial({
      color: 0xfffffd, roughness: 0.20, metalness: 0.0, roughnessMap: roughMap,
      clearcoat: 0.7, clearcoatRoughness: 0.12, envMapIntensity: 0.60,
      sheen: 0.35, sheenRoughness: 0.6, sheenColor: new T.Color(0xffffff),
    });
    // 半音键（依然是白色，只用哑光与极轻的冷调区分形体）
    M.blackKey = new T.MeshPhysicalMaterial({
      color: 0xeceef2, roughness: 0.42, metalness: 0.0,
      clearcoat: 0.35, clearcoatRoughness: 0.25, envMapIntensity: 0.50,
    });
    M.blackKeyContrast = new T.MeshPhysicalMaterial({
      color: 0xc9ccd3, roughness: 0.35, metalness: 0.0,
      clearcoat: 0.5, clearcoatRoughness: 0.2, envMapIntensity: 0.8,
    });
    // 白铬五金
    M.metal = new T.MeshPhysicalMaterial({
      color: 0xf3f4f7, roughness: 0.24, metalness: 0.95, envMapIntensity: 1.4,
    });
    M.metalSoft = new T.MeshPhysicalMaterial({
      color: 0xeeeff2, roughness: 0.42, metalness: 0.8, envMapIntensity: 1.0,
    });
    // 琴弦
    M.string = new T.MeshStandardMaterial({
      color: 0xe6e8ee, roughness: 0.22, metalness: 1.0, envMapIntensity: 1.5,
    });
    M.stringBass = new T.MeshStandardMaterial({
      color: 0xdfe2e9, roughness: 0.35, metalness: 1.0, envMapIntensity: 1.2,
    });
    // 毛毡（弦槌 / 制音器）
    M.felt = new T.MeshPhysicalMaterial({
      color: 0xfafafa, roughness: 0.95, metalness: 0.0,
      sheen: 1.0, sheenRoughness: 0.85, sheenColor: new T.Color(0xffffff), envMapIntensity: 0.5,
    });
    // 白漆铸铁排
    M.plate = new T.MeshPhysicalMaterial({
      color: 0xf7f8fa, roughness: 0.34, metalness: 0.18,
      clearcoat: 0.35, clearcoatRoughness: 0.3, envMapIntensity: 0.75,
    });
    // 音板（白化云杉）
    M.soundboard = new T.MeshPhysicalMaterial({
      color: 0xfaf9f6, roughness: 0.32, metalness: 0.0, map: grain || null,
      clearcoat: 0.50, clearcoatRoughness: 0.16, envMapIntensity: 0.60,
    });
    // 名牌贴花
    const decal = G.brandDecal('AURORA', 'H A N D   C R A F T E D   G R A N D');
    M.decal = new T.MeshBasicMaterial({
      map: decal || null, transparent: true, opacity: 0.5, depthWrite: false,
    });
    return M;
  }

  /* ---------------- 琴身轮廓（俯视）：直脊 + 圆尾 + 弯边 ---------------- */
  function outlineShape() {
    const W = S.W, L = S.L;
    const s = new T.Shape();
    s.moveTo(-W, 0);
    s.lineTo(-W, L - 0.36);
    s.splineThru([
      V2(-W + 0.022, L - 0.17),
      V2(-W + 0.155, L - 0.035),
      V2(-0.34, L),
      V2(-0.03, L - 0.045),
      V2(0.22, L - 0.20),
      V2(0.40, L - 0.44),
      V2(0.545, L - 0.78),
      V2(0.645, L - 1.16),
      V2(0.712, L - 1.58),
      V2(0.744, L - 1.98),
      V2(W, 0.26),
    ]);
    s.lineTo(W, 0.018);
    s.quadraticCurveTo(W, 0, W - 0.018, 0);
    s.lineTo(-W + 0.018, 0);
    s.quadraticCurveTo(-W, 0, -W, 0.018);
    s.closePath();
    return s;
  }

  // 用 y=fy 的直线切掉前部（保留 y>=fy 的部分）
  function clipFront(pts, fy) {
    const res = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const ain = a.y >= fy, bin = b.y >= fy;
      if (ain) res.push(a.clone());
      if (ain !== bin) {
        const t = (fy - a.y) / (b.y - a.y);
        res.push(V2(a.x + (b.x - a.x) * t, fy));
      }
    }
    return res;
  }

  // 只保留 y 在 [y0,y1] 的部分
  function clipBand(pts, y0, y1) {
    let p = clipFront(pts, y0);
    p = clipFront(p.map((q) => V2(q.x, -q.y)), -y1).map((q) => V2(q.x, -q.y));
    return p;
  }

  // 取出 y>=fy 的一段开放折线（去掉前沿直边），用于生成"U 形"侧板
  function chainAbove(pts, fy) {
    const n = pts.length;
    let start = -1;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      if (a.y < fy && b.y >= fy) { start = i; break; }
    }
    if (start < 0) return pts.map((p) => p.clone());
    const chain = [];
    let a = pts[start], b = pts[(start + 1) % n];
    let t = (fy - a.y) / (b.y - a.y);
    chain.push(V2(a.x + (b.x - a.x) * t, fy));
    let i = (start + 1) % n;
    let guard = 0;
    while (pts[i].y >= fy && guard++ < n) { chain.push(pts[i].clone()); i = (i + 1) % n; }
    a = pts[(i - 1 + n) % n]; b = pts[i];
    t = (fy - a.y) / (b.y - a.y);
    chain.push(V2(a.x + (b.x - a.x) * t, fy));
    return chain;
  }

  /* ---------------- 键盘布局 ---------------- */
  // 每个八度内：3 白键组(C D E) 与 4 白键组(F G A B)，尾部均分给黑键让位
  const OCT = {
    0: { w: true, g: 3, j: 0 }, 1: { w: false, g: 3, j: 0 },
    2: { w: true, g: 3, j: 1 }, 3: { w: false, g: 3, j: 1 },
    4: { w: true, g: 3, j: 2 },
    5: { w: true, g: 4, j: 0 }, 6: { w: false, g: 4, j: 0 },
    7: { w: true, g: 4, j: 1 }, 8: { w: false, g: 4, j: 1 },
    9: { w: true, g: 4, j: 2 }, 10: { w: false, g: 4, j: 2 },
    11: { w: true, g: 4, j: 3 },
  };
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  function tailWidth(groupSize) {
    return (groupSize * S.wkPitch - (groupSize - 1) * S.bkW) / groupSize;
  }

  function keyboardLayout() {
    const out = [];
    let wi = 0, lastWhiteLeft = 0;
    for (let midi = 21; midi <= 108; midi++) {
      const pc = ((midi % 12) + 12) % 12;
      const info = OCT[pc];
      const tw = tailWidth(info.g);
      if (info.w) {
        const left = KEY_X0 + wi * S.wkPitch;
        const tailLeft = left + info.j * (tw + S.bkW - S.wkPitch);
        out.push({
          midi, pc, white: true, index: out.length, whiteIndex: wi,
          frontLeft: left + S.wkGap * 0.5, frontRight: left + S.wkPitch - S.wkGap * 0.5,
          tailLeft: tailLeft + S.wkGap * 0.5, tailRight: tailLeft + tw - S.wkGap * 0.5,
          center: left + S.wkPitch / 2, name: NOTE_NAMES[pc] + (Math.floor(midi / 12) - 1),
        });
        lastWhiteLeft = left;
        wi++;
      } else {
        const bl = lastWhiteLeft + tw + info.j * (tw + S.bkW - S.wkPitch);
        out.push({
          midi, pc, white: false, index: out.length,
          left: bl, right: bl + S.bkW, center: bl + S.bkW / 2,
          name: NOTE_NAMES[pc] + (Math.floor(midi / 12) - 1),
        });
      }
    }
    return out;
  }

  /* ---------------- 白键 / 黑键几何 ---------------- */
  function whiteKeyGeometry(k) {
    const L = S.keyLen, front = L, stepY = L - S.wkFront;
    const fl = k.frontLeft, fr = k.frontRight, tl = k.tailLeft, tr = k.tailRight;
    const r = 0.0022, f = 0.0014;
    const sh = new T.Shape();
    sh.moveTo(tl, 0);
    sh.lineTo(tl, stepY - f);
    if (tl - fl > 0.0005) {
      sh.quadraticCurveTo(tl, stepY, tl - Math.min(f, tl - fl), stepY);
      sh.lineTo(fl + f, stepY);
      sh.quadraticCurveTo(fl, stepY, fl, stepY + f);
    } else {
      sh.lineTo(fl, stepY);
    }
    sh.lineTo(fl, front - r);
    sh.quadraticCurveTo(fl, front, fl + r, front);
    sh.lineTo(fr - r, front);
    sh.quadraticCurveTo(fr, front, fr, front - r);
    sh.lineTo(fr, stepY + f);
    if (fr - tr > 0.0005) {
      sh.quadraticCurveTo(fr, stepY, fr - f, stepY);
      sh.lineTo(tr + Math.min(f, fr - tr), stepY);
      sh.quadraticCurveTo(tr, stepY, tr, stepY - f);
    } else {
      sh.lineTo(tr, stepY);
    }
    sh.lineTo(tr, 0);
    sh.closePath();
    return G.extrude(sh, S.keyH, { down: true, bevel: 0.0007, bevelSegments: 1, curveSegments: 4 });
  }

  function blackKeyGeometry(k) {
    const zFront = S.keyLen - S.bkFrontGap;      // 黑键前端
    const zBack = zFront - S.bkLen;              // 抬起段后端
    const hw = S.bkW / 2, hwTop = (S.bkW - 0.0021) / 2;
    const h = S.bkH, slope = 0.0045;
    const x0 = k.center;
    // 抬起的楔形块（顶面略窄、前脸内收形成斜面）
    const wedge = G.prism8(
      V3(x0 - hw, 0, zBack), V3(x0 + hw, 0, zBack), V3(x0 + hw, 0, zFront), V3(x0 - hw, 0, zFront),
      V3(x0 - hwTop, h, zBack), V3(x0 + hwTop, h, zBack),
      V3(x0 + hwTop, h, zFront - slope), V3(x0 - hwTop, h, zFront - slope)
    );
    // 键身（白键面以下，藏在两白键之间）
    const sw = (S.bkW - 0.0016) / 2, sh2 = S.keyH * 0.92;
    const stick = G.prism8(
      V3(x0 - sw, -sh2, 0), V3(x0 + sw, -sh2, 0), V3(x0 + sw, -sh2, zFront), V3(x0 - sw, -sh2, zFront),
      V3(x0 - sw, 0, 0), V3(x0 + sw, 0, 0), V3(x0 + sw, 0, zFront), V3(x0 - sw, 0, zFront)
    );
    return G.merge([wedge, stick]);
  }

  /* ---------------- 工具：把圆柱摆在两点之间 ---------------- */
  const _up = V3(0, 1, 0);
  function cylBetween(m4, a, b, radius) {
    const dir = new T.Vector3().subVectors(b, a);
    const len = Math.max(dir.length(), 1e-5);
    const q = new T.Quaternion().setFromUnitVectors(_up, dir.clone().normalize());
    m4.compose(new T.Vector3().addVectors(a, b).multiplyScalar(0.5), q, V3(radius, len, radius));
    return m4;
  }

  /* ---------------- 琴弦布局 ---------------- */
  function stringLayout(insidePts) {
    const rows = [];
    const zPin = -0.455;
    for (let midi = 21; midi <= 108; midi++) {
      const i = midi - 21, t = i / 87;
      const len = Math.max(0.055, 1.70 * Math.pow(0.5, i / 17.6));
      const xPin = -0.638 + 1.276 * t;
      let xEnd = xPin + 0.34 * Math.pow(1 - t, 1.35);
      let zEnd = zPin - len;
      // 保证末端落在琴体内部
      let guard = 0;
      while (!G.pointInPolygon(insidePts, xEnd, -zEnd) && guard++ < 24) {
        zEnd += 0.03; xEnd *= 0.93;
      }
      const count = midi <= 32 ? 1 : midi <= 45 ? 2 : 3;
      const radius = midi <= 32 ? 0.0026 : midi <= 45 ? 0.0017 : Math.max(0.00055, 0.0013 - t * 0.0006);
      rows.push({ midi, zPin, xPin, xEnd, zEnd, len, count, radius, bass: midi <= 45 });
    }
    return rows;
  }

  /* ---------------- 主构建 ---------------- */
  function build() {
    const M = makeMaterials();
    const root = new T.Group();
    root.name = 'piano';

    const base = outlineShape();
    const outer = G.samplePoints(base, 110);
    const lidPts = G.offsetPolygon(outer, -S.lidOver);
    const rimOuter = clipFront(outer, S.bellyY);
    const rimInner = G.offsetPolygon(rimOuter, S.rimT);
    const sbPts = G.offsetPolygon(rimInner, 0.010);

    const caseGroup = new T.Group(); root.add(caseGroup);
    const innerGroup = new T.Group(); root.add(innerGroup);   // 琴腔内部（弦、排、槌）
    const keysGroup = new T.Group(); root.add(keysGroup);
    const parts = {};

    /* ---- 侧板：U 形环带（前端开口，符合真实三角琴的"腹梁"结构） ---- */
    const outerChain = chainAbove(rimOuter, S.bellyY + 1e-6);
    const innerChain = chainAbove(rimInner, S.bellyY + S.rimT + 1e-6);
    innerChain[0] = V2(innerChain[0].x, S.bellyY);                       // 前端切平
    innerChain[innerChain.length - 1] = V2(innerChain[innerChain.length - 1].x, S.bellyY);
    const bandPts = outerChain.concat(innerChain.slice().reverse());
    const rim = new T.Mesh(
      G.extrude(G.shapeFromPoints(bandPts), S.rimH, { bevel: 0.004, curveSegments: 2 }), M.lacquer);
    rim.position.y = S.caseY;
    rim.castShadow = rim.receiveShadow = true;
    caseGroup.add(rim);

    /* ---- 腹梁（前横梁，比侧板矮，让人从键盘侧看见铸铁排与琴弦） ---- */
    const bellyH = 0.100;
    const belly = new T.Mesh(new T.BoxGeometry(1.404, bellyH, S.rimT), M.lacquerSoft);
    belly.position.set(0, S.caseY + bellyH / 2, -(S.bellyY + S.rimT / 2));
    belly.castShadow = belly.receiveShadow = true;
    caseGroup.add(belly);
    // 弦轴板（腹梁上方的硬木块，钉着调音钉）
    const pinblock = new T.Mesh(new T.BoxGeometry(1.404, 0.062, 0.115), M.lacquerSoft);
    pinblock.position.set(0, S.caseY + bellyH + 0.031, -(S.bellyY + 0.075));
    pinblock.castShadow = pinblock.receiveShadow = true;
    caseGroup.add(pinblock);

    /* ---- 底板（向上挤出后整体下移，使其悬于侧板底缘） ---- */
    const bottom = new T.Mesh(
      G.extrude(G.shapeFromPoints(rimInner), 0.016, { bevel: 0.002, curveSegments: 2 }), M.lacquerSoft);
    bottom.position.y = S.caseY - 0.010;
    bottom.receiveShadow = true;
    caseGroup.add(bottom);

    /* ---- 音板 + 肋木 + 马桥 ---- */
    const sb = new T.Mesh(G.extrude(G.shapeFromPoints(sbPts), 0.009, { bevel: 0.0015, curveSegments: 2 }), M.soundboard);
    sb.position.y = S.sbY;
    sb.receiveShadow = true;
    innerGroup.add(sb);

    // 长马桥 + 低音马桥（弦压在其上）
    function bridge(points, w, h) {
      const geos = [];
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i], b = points[i + 1];
        const dx = b[0] - a[0], dz = b[1] - a[1];
        const len = Math.hypot(dx, dz);
        geos.push(G.xform(new T.BoxGeometry(w, h, len), {
          pos: [(a[0] + b[0]) / 2, h / 2, (a[1] + b[1]) / 2],
          rot: [0, Math.atan2(dx, dz), 0],
        }));
      }
      const m = new T.Mesh(G.merge(geos), M.lacquerSoft);
      m.position.y = S.sbY + 0.009;
      m.castShadow = true;
      innerGroup.add(m);
    }
    bridge([[0.60, -0.60], [0.44, -0.85], [0.22, -1.10], [-0.02, -1.30], [-0.24, -1.45]], 0.030, 0.030);
    bridge([[-0.30, -1.52], [-0.44, -1.72], [-0.52, -1.95]], 0.034, 0.032);

    /* ---- 铸铁排（白漆）：周边框 + 前部弦枕板 + 支撑梁 ---- */
    const plateBandOuter = G.offsetPolygon(rimInner, 0.004);
    const plateShape = G.shapeFromPoints(plateBandOuter);
    plateShape.holes.push(G.pathFromPoints(G.offsetPolygon(plateBandOuter, 0.098).slice().reverse()));
    const plate = new T.Mesh(G.extrude(plateShape, S.plateT, { bevel: 0.003, curveSegments: 2 }), M.plate);
    plate.position.y = S.plateY;
    plate.castShadow = plate.receiveShadow = true;
    innerGroup.add(plate);

    const plateExtras = [];
    // 前部弦枕/弦轴板区域
    plateExtras.push(G.xform(new T.BoxGeometry(1.40, S.plateT, 0.15), { pos: [0, S.plateY + S.plateT / 2, -0.475] }));
    plateExtras.push(G.xform(new T.BoxGeometry(1.36, 0.014, 0.035), { pos: [0, S.plateY + S.plateT + 0.006, -0.545] }));
    // 支撑梁
    const struts = [
      { p: [-0.34, -0.86], q: [0.30, -1.30], w: 0.075 },
      { p: [-0.50, -1.24], q: [0.02, -1.60], w: 0.070 },
      { p: [-0.60, -1.62], q: [-0.16, -1.92], w: 0.065 },
      { p: [-0.14, -0.60], q: [0.52, -0.86], w: 0.070 },
    ];
    struts.forEach((st) => {
      const dx = st.q[0] - st.p[0], dz = st.q[1] - st.p[1];
      plateExtras.push(G.xform(new T.BoxGeometry(st.w, S.plateT * 0.85, Math.hypot(dx, dz)), {
        pos: [(st.p[0] + st.q[0]) / 2, S.plateY + S.plateT * 0.42, (st.p[1] + st.q[1]) / 2],
        rot: [0, Math.atan2(dx, dz), 0],
      }));
    });
    const plateMesh = new T.Mesh(G.merge(plateExtras), M.plate);
    plateMesh.castShadow = plateMesh.receiveShadow = true;
    innerGroup.add(plateMesh);

    /* ---- 琴弦 + 弦轴 + 挂弦钉 ---- */
    const insidePts = rimInner.map((p) => p.clone());
    const rows = stringLayout(insidePts);
    let strCount = 0, bassCount = 0;
    rows.forEach((r) => (r.bass ? (bassCount += r.count) : (strCount += r.count)));
    const cylGeo = new T.CylinderGeometry(1, 1, 1, 6, 1, true);
    const strMesh = new T.InstancedMesh(cylGeo, M.string, strCount);
    const bassMesh = new T.InstancedMesh(cylGeo, M.stringBass, bassCount);
    strMesh.castShadow = bassMesh.castShadow = true;
    const m4 = new T.Matrix4();
    let si = 0, bi = 0;
    const pinGeos = [];
    rows.forEach((r) => {
      const spread = r.count === 1 ? 0 : r.count === 2 ? 0.0055 : 0.0042;
      for (let c = 0; c < r.count; c++) {
        const off = (c - (r.count - 1) / 2) * spread;
        const a = V3(r.xPin + off, S.stringY, r.zPin);
        const b = V3(r.xEnd + off * 0.7, S.stringY - 0.012, r.zEnd);
        cylBetween(m4, a, b, r.radius);
        if (r.bass) bassMesh.setMatrixAt(bi++, m4); else strMesh.setMatrixAt(si++, m4);
      }
      // 弦轴（调音钉）
      pinGeos.push(G.xform(new T.CylinderGeometry(0.0028, 0.0032, 0.030, 6), {
        pos: [r.xPin, S.plateY + S.plateT + 0.013, r.zPin + 0.055], rot: [0.12, 0, 0],
      }));
    });
    strMesh.instanceMatrix.needsUpdate = true;
    bassMesh.instanceMatrix.needsUpdate = true;
    innerGroup.add(strMesh, bassMesh);
    const pins = new T.Mesh(G.merge(pinGeos), M.metal);
    innerGroup.add(pins);

    /* ---- 弦槌（88 组，可动） ---- */
    const hammerGeo = G.merge([
      G.xform(new T.CylinderGeometry(0.0022, 0.0026, 0.10, 6), { pos: [0, 0, -0.05], rot: [Math.PI / 2, 0, 0] }),
      G.xform(new T.BoxGeometry(0.010, 0.020, 0.013), { pos: [0, 0.008, -0.099] }),
    ]);
    const hammers = new T.InstancedMesh(hammerGeo, M.felt, 88);
    hammers.castShadow = true;
    const hammerInfo = rows.map((r) => {
      const strike = Math.min(-0.50, r.zPin - Math.max(0.05, r.len * 0.11));
      return { x: r.xPin, y: S.stringY - 0.053, z: strike + 0.105, angle: 0 };
    });
    innerGroup.add(hammers);

    /* ---- 制音器（低音至次高音，可随踏板/琴键抬起） ---- */
    const damperCount = 68;
    const damperGeo = G.merge([
      G.xform(new T.CylinderGeometry(0.0012, 0.0012, 0.075, 5), { pos: [0, 0.045, 0] }),
      G.xform(new T.BoxGeometry(0.011, 0.014, 0.020), { pos: [0, 0.002, 0] }),
    ]);
    const dampers = new T.InstancedMesh(damperGeo, M.felt, damperCount);
    const damperInfo = [];
    for (let i = 0; i < damperCount; i++) {
      const r = rows[i];
      const t = 0.60;
      damperInfo.push({
        x: r.xPin + (r.xEnd - r.xPin) * t * 0.9,
        y: S.stringY + 0.006,
        z: r.zPin + (r.zEnd - r.zPin) * t,
        lift: 0,
      });
    }
    innerGroup.add(dampers);

    /* ---- 键盘部分：键床 / 侧木块 / 前挡条 / 名牌板 ---- */
    const keybed = new T.Mesh(new T.BoxGeometry(2 * S.W - 0.012, 0.013, 0.335), M.lacquerSoft);
    keybed.position.set(0, S.caseY + 0.0065, -0.1675);
    keybed.receiveShadow = true;
    caseGroup.add(keybed);

    const frame = G.merge([
      G.xform(new T.BoxGeometry(1.26, 0.008, 0.020), { pos: [0, S.keyTopY - S.keyH - 0.004, -0.045] }),
      G.xform(new T.BoxGeometry(1.26, 0.014, 0.024), { pos: [0, S.keyTopY - S.keyH - 0.007, -0.165] }),
      G.xform(new T.BoxGeometry(1.26, 0.010, 0.022), { pos: [0, S.keyTopY - S.keyH - 0.005, -0.300] }),
    ]);
    const frameMesh = new T.Mesh(frame, M.felt);
    caseGroup.add(frameMesh);

    [-1, 1].forEach((sgn) => {
      const blockW = S.W - 0.611;
      const cheek = new T.Mesh(
        G.extrude(G.roundedRect(blockW - 0.004, 0.330, 0.010), 0.064, { bevel: 0.003, curveSegments: 6 }),
        M.lacquer);
      cheek.position.set(sgn * (0.611 + blockW / 2), S.caseY + 0.013, -0.170);
      cheek.rotation.y = 0;
      cheek.castShadow = cheek.receiveShadow = true;
      caseGroup.add(cheek);
    });

    const keyslip = new T.Mesh(new T.BoxGeometry(1.226, 0.030, 0.013), M.lacquer);
    keyslip.position.set(0, S.keyTopY - 0.0165, -0.0055);
    keyslip.castShadow = true;
    caseGroup.add(keyslip);

    // 名牌板（琴键后方的横板，同时是键盘盖铰链座）
    const nameboard = new T.Mesh(G.merge([
      G.xform(new T.BoxGeometry(1.226, 0.020, 0.170), { pos: [0, S.keyTopY + 0.012, -0.252] }),
      G.xform(new T.BoxGeometry(1.226, 0.052, 0.018), { pos: [0, S.keyTopY - 0.014, -0.176] }),
    ]), M.lacquer);
    nameboard.castShadow = nameboard.receiveShadow = true;
    caseGroup.add(nameboard);

    /* ---- 88 键 ---- */
    const layout = keyboardLayout();
    const keys = [];
    layout.forEach((k, idx) => {
      const geo = k.white ? whiteKeyGeometry(k) : blackKeyGeometry(k);
      const mesh = new T.Mesh(geo, k.white ? M.whiteKey : M.blackKey);
      mesh.position.set(0, S.keyTopY, S.keyBackZ);
      mesh.castShadow = true;
      mesh.receiveShadow = k.white;
      mesh.userData.midi = k.midi;
      keysGroup.add(mesh);
      keys.push({
        midi: k.midi, name: k.name, white: k.white, mesh,
        center: k.white ? k.center : k.center,
        angle: 0, target: 0, held: false, index: idx,
      });
    });

    /* ---- 键盘盖（两折：前半折到后半上，整体翻转平放于名牌板） ---- */
    const fbPivot = new T.Group();
    fbPivot.position.set(0, S.keyTopY + 0.039, S.nameZ);
    caseGroup.add(fbPivot);
    const fbW = 1.226, fbHalf = 0.084, fbT = 0.016;

    const backHalf = new T.Mesh(new T.BoxGeometry(fbW, fbT, fbHalf), M.lacquer);
    backHalf.position.set(0, -fbT / 2, fbHalf / 2);
    backHalf.castShadow = backHalf.receiveShadow = true;
    fbPivot.add(backHalf);

    const fbFold = new T.Group();
    fbFold.position.set(0, 0, fbHalf);
    fbPivot.add(fbFold);

    const fbShape = new T.Shape();
    fbShape.moveTo(-fbW / 2, 0);
    fbShape.lineTo(fbW / 2, 0);
    fbShape.lineTo(fbW / 2, fbHalf - 0.013);
    fbShape.quadraticCurveTo(fbW / 2, fbHalf, fbW / 2 - 0.013, fbHalf);
    fbShape.lineTo(-fbW / 2 + 0.013, fbHalf);
    fbShape.quadraticCurveTo(-fbW / 2, fbHalf, -fbW / 2, fbHalf - 0.013);
    fbShape.closePath();
    const frontHalf = new T.Mesh(G.extrude(fbShape, fbT, { down: true, bevel: 0.0025, curveSegments: 6 }), M.lacquer);
    frontHalf.castShadow = frontHalf.receiveShadow = true;
    fbFold.add(frontHalf);
    // 折叠处的合页
    const fbHinge = new T.Mesh(new T.CylinderGeometry(0.0045, 0.0045, fbW * 0.97, 10), M.metal);
    fbHinge.rotation.z = Math.PI / 2;
    fbHinge.position.set(0, 0.0006, 0);
    fbFold.add(fbHinge);
    // 名牌贴花（合上时可见）
    const decalMesh = new T.Mesh(new T.PlaneGeometry(0.40, 0.10), M.decal);
    decalMesh.rotation.x = -Math.PI / 2;
    decalMesh.position.set(0, 0.0012, 0.046);
    decalMesh.renderOrder = 2;
    fbFold.add(decalMesh);
    parts.fallboard = fbPivot;
    parts.fallboardFold = fbFold;

    /* ---- 谱架 ---- */
    const deskPivot = new T.Group();
    deskPivot.position.set(0, S.keyTopY + 0.023, -0.300);
    caseGroup.add(deskPivot);
    const dW = 0.94, dH = 0.186;
    const deskShape = G.roundedRect(dW, dH, 0.012);
    for (let i = -1; i <= 1; i++) {
      const slot = new T.Path();
      const sw = 0.115, shh = 0.120, x = i * 0.19, y = 0.012, r = 0.02;
      slot.moveTo(x - sw / 2 + r, y - shh / 2);
      slot.lineTo(x + sw / 2 - r, y - shh / 2);
      slot.absarc(x + sw / 2 - r, y - shh / 2 + r, r, -Math.PI / 2, 0, false);
      slot.lineTo(x + sw / 2, y + shh / 2 - r);
      slot.absarc(x + sw / 2 - r, y + shh / 2 - r, r, 0, Math.PI / 2, false);
      slot.lineTo(x - sw / 2 + r, y + shh / 2);
      slot.absarc(x - sw / 2 + r, y + shh / 2 - r, r, Math.PI / 2, Math.PI, false);
      slot.lineTo(x - sw / 2, y - shh / 2 + r);
      slot.absarc(x - sw / 2 + r, y - shh / 2 + r, r, Math.PI, Math.PI * 1.5, false);
      deskShape.holes.push(slot);
    }
    const deskGeo = new T.ExtrudeGeometry(deskShape, {
      depth: 0.013, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 8,
    });
    deskGeo.translate(0, dH / 2, -0.0065);
    const desk = new T.Mesh(deskGeo, M.lacquer);
    desk.castShadow = desk.receiveShadow = true;
    deskPivot.add(desk);
    const deskLip = new T.Mesh(new T.BoxGeometry(dW, 0.012, 0.030), M.lacquer);
    deskLip.position.set(0, 0.006, 0.014);
    deskPivot.add(deskLip);
    parts.desk = deskPivot;

    /* ---- 大琴盖（两折） ---- */
    const hingeX = -(S.W + S.lidOver);
    const lidTopY = S.caseY + S.rimH;
    const lidPivot = new T.Group();
    lidPivot.position.set(hingeX, lidTopY, 0);
    caseGroup.add(lidPivot);

    const lidAll = clipFront(lidPts, S.bellyY);
    const mainPts = clipFront(lidAll, S.lidSplit);
    const frontPts = clipBand(lidAll, S.bellyY, S.lidSplit);

    const mainGeo = G.extrude(G.shapeFromPoints(mainPts), S.lidT, { bevel: 0.0035, curveSegments: 2 });
    mainGeo.translate(-hingeX, 0, 0);
    const mainLid = new T.Mesh(mainGeo, M.lacquer);
    mainLid.castShadow = mainLid.receiveShadow = true;
    lidPivot.add(mainLid);

    const flPivot = new T.Group();
    flPivot.position.set(0, S.lidT, -S.lidSplit);
    lidPivot.add(flPivot);
    const frontGeo = G.extrude(G.shapeFromPoints(frontPts), S.lidT, { bevel: 0.0035, curveSegments: 2 });
    frontGeo.translate(-hingeX, -S.lidT, S.lidSplit);
    const frontLid = new T.Mesh(frontGeo, M.lacquer);
    frontLid.castShadow = frontLid.receiveShadow = true;
    flPivot.add(frontLid);
    parts.lid = lidPivot;
    parts.frontLid = flPivot;

    // 铰链
    const hingeGeos = [];
    [-0.35, -1.05, -1.75].forEach((z) => {
      hingeGeos.push(G.xform(new T.BoxGeometry(0.070, 0.010, 0.085), { pos: [hingeX + 0.036, lidTopY - 0.004, z] }));
      hingeGeos.push(G.xform(new T.CylinderGeometry(0.006, 0.006, 0.088, 10), {
        pos: [hingeX + 0.004, lidTopY + 0.002, z], rot: [Math.PI / 2, 0, 0],
      }));
    });
    caseGroup.add(new T.Mesh(G.merge(hingeGeos), M.metal));

    /* ---- 支撑杆（位置每帧按琴盖角度求解，默认隐藏） ---- */
    const stickGroup = new T.Group();
    stickGroup.visible = false;
    caseGroup.add(stickGroup);
    const stick = new T.Mesh(new T.CylinderGeometry(0.011, 0.013, 1, 12), M.lacquer);
    stick.castShadow = true;
    stickGroup.add(stick);
    const stickFoot = new T.Mesh(new T.CylinderGeometry(0.020, 0.024, 0.012, 14), M.metalSoft);
    stickGroup.add(stickFoot);
    parts.stick = { group: stickGroup, rod: stick, foot: stickFoot };
    parts.stickAnchorCase = V3(0.552, lidTopY - 0.003, -1.05);   // 侧板上的插座（世界坐标）
    parts.stickAnchorLid = V3(1.090, -0.005, -1.05);             // 琴盖内侧凹槽（lidPivot 局部坐标）
    // 初始摆放一次，避免未更新时出现在原点
    stick.matrixAutoUpdate = false;
    stickFoot.matrixAutoUpdate = false;
    cylBetween(stick.matrix, parts.stickAnchorCase,
      parts.stickAnchorCase.clone().add(V3(-0.30, 0.85, 0)), 1);
    stickFoot.matrix.compose(parts.stickAnchorCase, new T.Quaternion(), V3(1, 1, 1));

    /* ---- 琴腿 + 脚轮 ---- */
    const legProfile = [
      [0.0, 0.0], [0.072, 0.0], [0.072, 0.016], [0.058, 0.030], [0.050, 0.055],
      [0.043, 0.13], [0.038, 0.28], [0.036, 0.42], [0.038, 0.52], [0.046, 0.575],
      [0.056, 0.600], [0.058, 0.625], [0.068, 0.640], [0.070, 0.662], [0.0, 0.662],
    ];
    const legGeo = G.lathe(legProfile, 30);
    const casterGeo = G.merge([
      G.xform(new T.BoxGeometry(0.040, 0.026, 0.020), { pos: [0, 0.030, 0] }),
      G.xform(new T.CylinderGeometry(0.019, 0.019, 0.012, 16), { pos: [0, 0.019, 0.014], rot: [0, 0, Math.PI / 2] }),
      G.xform(new T.CylinderGeometry(0.019, 0.019, 0.012, 16), { pos: [0, 0.019, -0.014], rot: [0, 0, Math.PI / 2] }),
    ]);
    const legPos = [[-0.655, -0.215], [0.655, -0.215], [-0.045, -1.90]];
    legPos.forEach((p) => {
      const leg = new T.Mesh(legGeo, M.lacquer);
      leg.position.set(p[0], 0.038, p[1]);
      leg.castShadow = leg.receiveShadow = true;
      root.add(leg);
      const caster = new T.Mesh(casterGeo, M.metalSoft);
      caster.position.set(p[0], 0.0, p[1]);
      caster.castShadow = true;
      root.add(caster);
    });

    /* ---- 踏板架（lyre）与三个踏板 ---- */
    const lyre = new T.Group();
    lyre.position.set(0, 0, -0.150);
    root.add(lyre);

    const lyreBody = G.merge([
      // 立柱与装饰板
      G.xform(new T.BoxGeometry(0.026, 0.480, 0.019), { pos: [-0.086, 0.455, 0], rot: [0, 0, 0.048] }),
      G.xform(new T.BoxGeometry(0.026, 0.480, 0.019), { pos: [0.086, 0.455, 0], rot: [0, 0, -0.048] }),
      G.xform(new T.BoxGeometry(0.019, 0.430, 0.015), { pos: [0, 0.450, 0] }),
      // 上部与琴体连接的座
      G.xform(new T.BoxGeometry(0.235, 0.020, 0.055), { pos: [0, 0.690, 0] }),
      // 踏板箱
      G.xform(new T.BoxGeometry(0.290, 0.048, 0.070), { pos: [0, 0.188, 0.010] }),
      G.xform(new T.BoxGeometry(0.250, 0.014, 0.050), { pos: [0, 0.213, 0.012] }),
    ]);
    const lyreMesh = new T.Mesh(lyreBody, M.lacquer);
    lyreMesh.castShadow = lyreMesh.receiveShadow = true;
    lyre.add(lyreMesh);
    // 斜撑
    [-1, 1].forEach((sgn) => {
      const brace = new T.Mesh(new T.CylinderGeometry(0.007, 0.007, 0.30, 10), M.lacquer);
      brace.position.set(sgn * 0.112, 0.560, -0.070);
      brace.rotation.set(0.50, 0, sgn * -0.22);
      brace.castShadow = true;
      lyre.add(brace);
    });

    const pedals = [];
    const pedalShape = G.roundedRect(0.036, 0.150, 0.016);
    const pedalGeo = G.extrude(pedalShape, 0.009, { down: true, bevel: 0.0025, curveSegments: 8 });
    pedalGeo.translate(0, 0, 0.075);
    [-0.082, 0, 0.082].forEach((x, i) => {
      const pv = new T.Group();
      pv.position.set(x, 0.198, 0.028);
      lyre.add(pv);
      const p = new T.Mesh(pedalGeo, M.metal);
      p.castShadow = true;
      pv.add(p);
      pedals.push({ pivot: pv, mesh: p, index: i, angle: 0, target: 0 });
    });
    parts.pedals = pedals;

    /* ---- 返回句柄 ---- */
    // 弦槌 / 制音器的实例矩阵写入（初始化 + 每帧动画共用）
    const _m = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler(), _s = V3(1, 1, 1);
    const _qi = new T.Quaternion();
    function writeHammers() {
      for (let i = 0; i < hammerInfo.length; i++) {
        const h = hammerInfo[i];
        _e.set(h.angle, 0, 0); _q.setFromEuler(_e);
        _m.compose(V3(h.x, h.y, h.z), _q, _s);
        hammers.setMatrixAt(i, _m);
      }
      hammers.instanceMatrix.needsUpdate = true;
    }
    function writeDampers() {
      for (let i = 0; i < damperInfo.length; i++) {
        const d = damperInfo[i];
        _m.compose(V3(d.x, d.y + d.lift, d.z), _qi, _s);
        dampers.setMatrixAt(i, _m);
      }
      dampers.instanceMatrix.needsUpdate = true;
    }
    writeHammers();
    writeDampers();

    return {
      root, keys, parts, materials: M, spec: S,
      outline: outer, lidOutline: lidPts, rimInner,
      hammers: { mesh: hammers, info: hammerInfo, geo: hammerGeo, write: writeHammers },
      dampers: { mesh: dampers, info: damperInfo, count: damperCount, write: writeDampers },
      innerGroup, keysGroup, caseGroup,
      cylBetween,
    };
  }

  global.Piano = { build, SPEC: S, keyboardLayout, NOTE_NAMES };
})(typeof window !== 'undefined' ? window : globalThis);
