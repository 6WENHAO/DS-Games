/* ============================================================
   古建构件生成器：把中国古典木构建筑拆成体素可生成的构件
     · 台基（普通/须弥座）· 汉白玉栏杆 · 御路踏跺
     · 屋身（檐柱/槛墙/隔扇门/槛窗/额枋/斗拱/殿内金柱宝座）
     · 屋顶（庑殿/歇山/攒尖/圆攒尖/盝顶/十字脊/卷棚 + 翼角起翘 + 正脊吻兽）
     · 陈设（铜狮/华表/日晷/嘉量/铜龟鹤/香炉/大缸/树木/假山/石桥/井亭）
   ============================================================ */
'use strict';

/* 建筑索引图：用于鼠标点选识别建筑 */
class IdMap {
  constructor(x0, z0, x1, z1) {
    this.x0 = x0; this.z0 = z0;
    this.nx = x1 - x0; this.nz = z1 - z0;
    this.a = new Uint16Array(this.nx * this.nz);
  }
  fill(x0, z0, x1, z1, id) {
    const i0 = Math.max(0, Math.floor(x0) - this.x0), i1 = Math.min(this.nx - 1, Math.ceil(x1) - this.x0);
    const j0 = Math.max(0, Math.floor(z0) - this.z0), j1 = Math.min(this.nz - 1, Math.ceil(z1) - this.z0);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this.a[j * this.nx + i] = id;
  }
  at(x, z) {
    const i = Math.floor(x) - this.x0, j = Math.floor(z) - this.z0;
    if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) return 0;
    return this.a[j * this.nx + i];
  }
}

/* 可重复随机 */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

class Arch {
  constructor(vol, ground, idmap) {
    this.V = vol; this.G = ground; this.ID = idmap;
    this.rnd = mulberry32(20240915);
    this.labels = [];      // {id,name,x,y,z,cat,desc}
    this.nextId = 1;
  }
  rint(a, b) { return a + Math.floor(this.rnd() * (b - a + 1)); }

  /* 注册一座建筑（返回 id） */
  reg(name, x0, z0, x1, z1, topY, cat, desc) {
    const id = this.nextId++;
    this.ID.fill(x0, z0, x1, z1, id);
    this.labels.push({
      id, name, cat: cat || '', desc: desc || '',
      x: (x0 + x1) / 2, z: (z0 + z1) / 2, y: topY || 20,
      x0, z0, x1, z1,
    });
    return id;
  }

  /* ---------------- 基础 ---------------- */
  box(x0, y0, z0, x1, y1, z1, c) { this.V.box(x0, y0, z0, x1, y1, z1, c); }

  /** 台基 / 须弥座
   *  style: 'plain' 素台基 | 'sumeru' 须弥座 | 'terrace' 三台大月台 */
  platform(x0, z0, x1, z1, y0, h, o = {}) {
    const V = this.V;
    const stone = o.stone || C.stone, face = o.face || C.marbleD, top = o.top || C.stone;
    x0 = Math.round(x0); x1 = Math.round(x1); z0 = Math.round(z0); z1 = Math.round(z1);
    if (o.style === 'sumeru' && h >= 4) {
      // 圭角 → 下枋 → 下枭 → 束腰(内收) → 上枭 → 上枋
      const waist = y0 + Math.max(1, Math.floor(h * 0.45));
      for (let y = y0; y < y0 + h; y++) {
        const inset = (y === waist) ? 1 : 0;
        const c = (y === waist) ? C.marbleS : (y === y0 + h - 1 ? top : face);
        V.box(x0 + inset, y, z0 + inset, x1 - inset, y, z1 - inset, c);
      }
    } else {
      V.box(x0, y0, z0, x1, y0 + h - 1, z1, face);
      V.box(x0, y0 + h - 1, z0, x1, y0 + h - 1, z1, top);
      if (h >= 3) V.box(x0, y0, z0, x1, y0, z1, stone);      // 土衬石
    }
    if (o.railing) this.railing(x0, z0, x1, z1, y0 + h, o.railGaps || []);
    return y0 + h;   // 台面标高
  }

  /** 汉白玉栏杆（望柱 + 栏板），gaps=[{x0,z0,x1,z1}] 处断开（台阶口） */
  railing(x0, z0, x1, z1, y, gaps = []) {
    const V = this.V;
    const inGap = (x, z) => {
      for (const g of gaps) if (x >= g.x0 - 1 && x <= g.x1 + 1 && z >= g.z0 - 1 && z <= g.z1 + 1) return true;
      return false;
    };
    const put = (x, z, i) => {
      if (inGap(x, z)) return;
      const post = (i % 3 === 0);
      V.set(x, y, z, C.marble);
      V.set(x, y + 1, z, post ? C.marble : C.marbleD);
      if (post) V.set(x, y + 2, z, C.marbleS);
    };
    let i = 0;
    for (let x = x0; x <= x1; x++, i++) { put(x, z0, i); put(x, z1, i); }
    i = 0;
    for (let z = z0 + 1; z < z1; z++, i++) { put(x0, z, i); put(x1, z, i); }
  }

  /** 台阶（踏跺）：dir = 's'|'n'|'e'|'w'，从 yTop 向外逐级下降 */
  stairs(cx, cz, width, yBase, yTop, dir, o = {}) {
    const V = this.V;
    const c = o.color || C.marbleD, cr = o.rail !== false;
    const steps = yTop - yBase;
    if (steps <= 0) return;
    const w2 = Math.floor(width / 2);
    for (let s = 0; s < steps; s++) {
      const y = yTop - 1 - s;                  // 该级台面
      const d = s + 1;                         // 距台基的水平距离
      let ax0, az0, ax1, az1;
      if (dir === 's') { ax0 = cx - w2; ax1 = cx + w2; az0 = cz + d; az1 = cz + d; }
      else if (dir === 'n') { ax0 = cx - w2; ax1 = cx + w2; az0 = cz - d; az1 = cz - d; }
      else if (dir === 'e') { az0 = cz - w2; az1 = cz + w2; ax0 = cx + d; ax1 = cx + d; }
      else { az0 = cz - w2; az1 = cz + w2; ax0 = cx - d; ax1 = cx - d; }
      V.box(ax0, yBase, az0, ax1, y, az1, c);
      // 御路（中央雕龙石）
      if (o.imperial && width >= 9) {
        const m = Math.floor((dir === 's' || dir === 'n') ? cx : cz);
        if (dir === 's' || dir === 'n') V.box(m - 1, y, az0, m + 1, y, az1, C.marble);
        else V.box(ax0, y, m - 1, ax1, y, m + 1, C.marble);
      }
      if (cr && (s % 2 === 0)) {   // 垂带栏杆
        if (dir === 's' || dir === 'n') {
          V.set(ax0, y + 1, az0, C.marbleD); V.set(ax1, y + 1, az1, C.marbleD);
        } else {
          V.set(ax0, y + 1, az0, C.marbleD); V.set(ax1, y + 1, az1, C.marbleD);
        }
      }
    }
  }

  /** 屋身：檐柱、槛墙、隔扇门、槛窗、额枋、斗拱
   *  y0 = 台面标高（第一层墙体所在），h = 柱高（含额枋斗拱）
   *  sides: {s,n,e,w} 每边 'door'|'wall'|'window'|'open'
   */
  body(x0, z0, x1, z1, y0, h, o = {}) {
    const V = this.V;
    x0 = Math.round(x0); x1 = Math.round(x1); z0 = Math.round(z0); z1 = Math.round(z1);
    const wallC = o.wall || C.wallRed, colC = o.column || C.columnRed;
    const sides = Object.assign({ s: 'door', n: 'wall', e: 'wall', w: 'wall' }, o.sides || {});
    const bay = o.bay || 4;                     // 开间宽（米）
    const top = y0 + h - 1;                     // 斗拱层
    const arch = y0 + h - 2;                    // 额枋层
    const wallTop = y0 + h - 3;
    // 室内地面
    V.box(x0 + 1, y0 - 1, z0 + 1, x1 - 1, y0 - 1, z1 - 1, o.floor || C.goldBrick);

    const drawSide = (fixed, isX, from, to, kind, sideKey) => {
      // isX: 该边沿 x 方向延展（南北面）
      const openMid = (kind === 'door');
      const mid = (from + to) / 2;
      const doorHalf = Math.max(1, Math.min(3, Math.round((to - from) / 14)));
      for (let t = from; t <= to; t++) {
        const X = isX ? t : fixed, Z = isX ? fixed : t;
        const rel = t - from;
        const isColumn = (rel % bay === 0) || t === to;
        if (kind === 'open') {
          if (isColumn) V.box(X, y0, Z, X, wallTop, Z, colC);
          continue;
        }
        if (openMid && Math.abs(t - mid) <= doorHalf) {
          // 中央明间：留门洞（可进入）
          if (isColumn && Math.abs(t - mid) === doorHalf) V.box(X, y0, Z, X, wallTop, Z, colC);
          else {
            V.box(X, wallTop - 1, Z, X, wallTop, Z, C.latticeRed);   // 门楣
          }
          continue;
        }
        if (isColumn) { V.box(X, y0, Z, X, wallTop, Z, colC); continue; }
        if (kind === 'wall') {
          V.box(X, y0, Z, X, wallTop, Z, ((t % 5) === 0) ? C.wallRedD : wallC);
        } else if (kind === 'door') {
          // 隔扇门：下裙板 + 上棂花
          const hh = wallTop - y0;
          V.box(X, y0, Z, X, y0 + Math.floor(hh * 0.35), Z, C.doorRed);
          V.box(X, y0 + Math.floor(hh * 0.35) + 1, Z, X, wallTop, Z, (t % 2) ? C.windowPaper : C.latticeRed);
        } else if (kind === 'window') {
          const hh = wallTop - y0;
          const sill = y0 + Math.max(1, Math.floor(hh * 0.4));
          V.box(X, y0, Z, X, sill, Z, wallC);                       // 槛墙
          V.box(X, sill + 1, Z, X, wallTop, Z, (t % 2) ? C.windowPaper : C.latticeRed);
        }
        void sideKey;
      }
    };
    if (sides.s !== 'none') drawSide(z1, true, x0, x1, sides.s, 's');
    if (sides.n !== 'none') drawSide(z0, true, x0, x1, sides.n, 'n');
    if (sides.w !== 'none') drawSide(x0, false, z0 + 1, z1 - 1, sides.w, 'w');
    if (sides.e !== 'none') drawSide(x1, false, z0 + 1, z1 - 1, sides.e, 'e');

    // 额枋 + 斗拱：环绕一圈
    const ring = (y, fn) => {
      for (let x = x0; x <= x1; x++) { fn(x, y, z0, x - x0); fn(x, y, z1, x - x0); }
      for (let z = z0 + 1; z < z1; z++) { fn(x0, y, z, z - z0); fn(x1, y, z, z - z0); }
    };
    if (h >= 5) {
      ring(arch, (x, y, z, i) => V.set(x, y, z, (i % bay === 0) ? C.gold : ((i % 2) ? C.paintGreen : C.paintBlue)));
      ring(top, (x, y, z, i) => V.set(x, y, z, (i % 2) ? C.paintWhite : C.paintGreen));
    }
    // 殿内金柱 + 藻井 + 宝座
    if (o.interior) {
      const gx = Math.max(4, Math.round((x1 - x0) / 6)), gz = Math.max(4, Math.round((z1 - z0) / 3));
      for (let x = x0 + gx; x < x1 - 1; x += gx)
        for (let z = z0 + gz; z < z1 - 1; z += gz)
          V.box(x, y0, z, x, wallTop, z, C.gold);
      if (o.throne) {
        const cx = Math.round((x0 + x1) / 2), cz = Math.round(z0 + (z1 - z0) * 0.38);
        this.platform(cx - 5, cz - 3, cx + 5, cz + 3, y0, 2, { face: C.marbleD, top: C.marble });
        V.box(cx - 2, y0 + 2, cz - 2, cx + 2, y0 + 3, cz + 1, C.gold);           // 宝座
        V.box(cx - 3, y0 + 4, cz - 2, cx + 3, y0 + 5, cz - 2, C.goldBright);     // 屏风
        V.box(cx - 4, y0 + 2, cz + 2, cx - 4, y0 + 4, cz + 2, C.bronze);
        V.box(cx + 4, y0 + 2, cz + 2, cx + 4, y0 + 4, cz + 2, C.bronze);
        // 藻井
        V.box(cx - 3, wallTop, cz - 3, cx + 3, wallTop, cz + 3, C.goldBright);
      }
    }
    return { top, arch, wallTop };
  }

  /* ---------------- 屋顶 ---------------- */
  /** 通用屋顶
   * x0..x1,z0..z1：含出檐的屋顶投影范围
   * yEave：檐口顶面标高；H：檐口到正脊的高差
   * o.type: 'hip'(庑殿) 'gable'(歇山) 'pyramid'(攒尖) 'round'(圆攒尖)
   *         'lu'(盝顶) 'cross'(十字脊) 'juan'(卷棚)
   * o.tile: [亮,暗] 瓦色；o.lift 翼角起翘；o.thk 瓦面厚
   */
  roof(x0, z0, x1, z1, yEave, H, o = {}) {
    const V = this.V;
    x0 = Math.round(x0); x1 = Math.round(x1); z0 = Math.round(z0); z1 = Math.round(z1);
    const nx = x1 - x0 + 1, nz = z1 - z0 + 1;
    const A = (nx - 1) / 2 + 0.5, B = (nz - 1) / 2 + 0.5;
    const cx = (x0 + x1) / 2 + 0.5, cz = (z0 + z1) / 2 + 0.5;
    const type = o.type || 'hip';
    const p = o.pitch || 1.42;
    const tileA = (o.tile && o.tile[0]) || C.tileA, tileB = (o.tile && o.tile[1]) || C.tileB;
    const ridgeC = o.ridgeColor || C.ridge;
    const thk = o.thk || (H > 8 ? 2 : 1);
    const lift = o.lift === undefined ? Math.min(3, Math.max(1, Math.round(Math.min(A, B) / 5))) : o.lift;
    const gw = o.gw || Math.max(2, Math.round(B * 0.62));
    const hf = new Float32Array(nx * nz);
    const which = new Uint8Array(nx * nz);      // 0=前后坡 1=端坡 2=脊
    const curve = (u) => Math.pow(Math.max(0, Math.min(1, u)), p);
    const TR = o.tref || B;          // 举架参考距离（腰檐裙用出檐宽）
    const Rr = o.tref || Math.min(A, B);

    const hole = o.hole;
    for (let ix = 0; ix < nx; ix++) {
      const dx = Math.abs(x0 + ix + 0.5 - cx);
      for (let iz = 0; iz < nz; iz++) {
        const dz = Math.abs(z0 + iz + 0.5 - cz);
        if (hole) {
          const X = x0 + ix, Z = z0 + iz;
          if (X > hole.x0 && X < hole.x1 && Z > hole.z0 && Z < hole.z1) { hf[ix * nz + iz] = -1e9; continue; }
        }
        const tz = B - dz, tx = A - dx;
        let hh = 0, w = 0;
        switch (type) {
          case 'hip': {
            const t = Math.min(tz, tx);
            hh = curve(t / TR) * H; w = (tx < tz) ? 1 : 0;
            break;
          }
          case 'gable': {
            const hg = curve(tz / TR) * H;
            if (tx >= gw) { hh = hg; w = 0; }
            else { const he = curve(tx / TR) * H; hh = Math.min(hg, he); w = (he < hg) ? 1 : 0; }
            break;
          }
          case 'pyramid': {
            const t = Math.min(tz, tx);
            hh = curve(t / Rr) * H; w = (tx < tz) ? 1 : 0;
            break;
          }
          case 'round': {
            const d = Math.hypot(dx, dz);
            const t = Rr - d;
            if (t <= -0.5) { hf[ix * nz + iz] = -1e9; continue; }
            hh = curve(t / Rr) * H; w = 0;
            break;
          }
          case 'lu': {
            const t = Math.min(tz, tx);
            hh = Math.min(curve(t / TR) * H, H * (o.flat || 0.72));
            w = (Math.abs(hh - H * (o.flat || 0.72)) < 0.01) ? 2 : (tx < tz ? 1 : 0);
            break;
          }
          case 'cross': {
            const g1 = (tx >= gw) ? curve(tz / B) * H : Math.min(curve(tz / B) * H, curve(tx / B) * H);
            const gwz = o.gwz || Math.max(2, Math.round(A * 0.62));
            const g2 = (tz >= gwz) ? curve(tx / A) * H : Math.min(curve(tx / A) * H, curve(tz / A) * H);
            hh = Math.max(g1, g2); w = (g2 > g1) ? 1 : 0;
            break;
          }
          case 'juan': {
            const t = Math.min(tz + 0.6, tx);
            hh = curve(Math.min(1, t / B)) * H; w = (tx < tz) ? 1 : 0;
            break;
          }
        }
        // 翼角起翘
        if (lift > 0) {
          const cl = Math.pow(dx / A, 3) * Math.pow(dz / B, 3);
          const t = Math.min(tz, tx);
          const decay = Math.pow(Math.max(0, 1 - t / (B * 0.55)), 1.5);
          hh += lift * cl * decay * 3.0;
        }
        hf[ix * nz + iz] = hh;
        which[ix * nz + iz] = w;
      }
    }
    // 体素化：逐列填充 + 竖向裙边（保证无缝，落差大处作山花）
    const hi = new Int32Array(nx * nz);
    let hmax = -1e9;
    for (let i = 0; i < nx * nz; i++) {
      hi[i] = hf[i] < -1e8 ? -1e9 : Math.round(yEave + hf[i]);
      if (hi[i] > hmax) hmax = hi[i];
    }
    const get = (ix, iz) => (ix < 0 || iz < 0 || ix >= nx || iz >= nz) ? -1e9 : hi[ix * nz + iz];
    for (let ix = 0; ix < nx; ix++) {
      for (let iz = 0; iz < nz; iz++) {
        const h = hi[ix * nz + iz];
        if (h < -1e8) continue;
        const X = x0 + ix, Z = z0 + iz;
        const nb = Math.max(get(ix - 1, iz), get(ix + 1, iz), get(ix, iz - 1), get(ix, iz + 1));
        const nbMin = Math.min(
          get(ix - 1, iz) < -1e8 ? h : get(ix - 1, iz),
          get(ix + 1, iz) < -1e8 ? h : get(ix + 1, iz),
          get(ix, iz - 1) < -1e8 ? h : get(ix, iz - 1),
          get(ix, iz + 1) < -1e8 ? h : get(ix, iz + 1));
        const stripe = which[ix * nz + iz] === 1 ? (Z & 1) : (X & 1);
        const tc = stripe ? tileA : tileB;
        let low = h - thk + 1;
        const drop = h - nbMin;
        if (drop > 2) {
          // 山花 / 收山：上部瓦当，下部山花板
          low = nbMin + 1;
          V.box(X, low, Z, X, h - 2, Z, o.gable || C.gableWood);
          V.box(X, h - 1, Z, X, h, Z, tc);
        } else {
          low = Math.min(low, nbMin);
          V.box(X, low, Z, X, h, Z, tc);
        }
        // 檐口椽头
        const t0 = Math.min(B - Math.abs(Z + 0.5 - cz), A - Math.abs(X + 0.5 - cx));
        if (t0 < 1.05 && nb <= h + 1) {
          V.set(X, low - 1, Z, C.beamDark);
          if (o.eaveTip !== false) V.set(X, low, Z, C.eaveEnd);
        }
      }
    }
    // 正脊 / 垂脊 / 吻兽 / 宝顶
    const ridgeH = o.ridgeH === undefined ? (H > 7 ? 2 : 1) : o.ridgeH;
    if (ridgeH > 0) {
      let rx0 = 1e9, rx1 = -1e9, rz0 = 1e9, rz1 = -1e9;
      for (let ix = 0; ix < nx; ix++) for (let iz = 0; iz < nz; iz++) {
        if (hi[ix * nz + iz] >= hmax) {
          const X = x0 + ix, Z = z0 + iz;
          V.box(X, hmax + 1, Z, X, hmax + ridgeH, Z, ridgeC);
          if (ridgeH >= 2) V.set(X, hmax + ridgeH, Z, ((X + Z) & 1) ? ridgeC : C.ridgeHi);
          if (X < rx0) rx0 = X; if (X > rx1) rx1 = X;
          if (Z < rz0) rz0 = Z; if (Z > rz1) rz1 = Z;
        }
      }
      // 垂脊：沿戗脊线加一层脊瓦
      for (let ix = 0; ix < nx; ix++) for (let iz = 0; iz < nz; iz++) {
        const X = x0 + ix, Z = z0 + iz;
        const dx = Math.abs(X + 0.5 - cx), dz = Math.abs(Z + 0.5 - cz);
        const tz = B - dz, tx = A - dx;
        const h = hi[ix * nz + iz];
        if (h < -1e8 || h >= hmax) continue;
        if (type === 'hip' || type === 'pyramid' || type === 'cross' || type === 'gable') {
          if (Math.abs(tz - tx) < 0.8) V.set(X, h + 1, Z, ((X + Z) & 3) === 0 ? C.ridgeHi : ridgeC);
        }
      }
      // 吻兽（正脊两端）
      if (rx1 > rx0 + 1 && (type === 'hip' || type === 'gable' || type === 'juan')) {
        for (const [ex, dir] of [[rx0, -1], [rx1, 1]]) {
          const zc = Math.round((rz0 + rz1) / 2);
          V.box(ex, hmax + 1, zc - 1, ex, hmax + ridgeH + 1, zc + 1, C.ridgeHi);
          V.set(ex + dir, hmax + ridgeH + 1, zc, C.goldBright);
          V.set(ex, hmax + ridgeH + 2, zc, C.goldBright);
        }
      }
      // 宝顶
      if (type === 'pyramid' || type === 'round' || type === 'lu') {
        const ax = Math.round(cx - 0.5), az = Math.round(cz - 0.5);
        const base = type === 'lu' ? hmax + ridgeH : hmax;
        V.box(ax - 1, base + 1, az - 1, ax + 1, base + 1, az + 1, C.ridgeHi);
        V.box(ax, base + 2, az, ax, base + 3, az, C.goldBright);
        if (o.tallFinial) V.box(ax, base + 4, az, ax, base + 5, az, C.gold);
      }
    }
    return hmax + ridgeH;
  }

  /** 一座标准殿宇（台基 + 屋身 + 屋顶，可重檐/多层） */
  hall(s) {
    const V = this.V;
    const w = s.w, d = s.d;                    // 屋身面阔/进深
    const cx = s.x, cz = s.z;
    const x0 = Math.round(cx - w / 2), x1 = Math.round(cx + w / 2);
    const z0 = Math.round(cz - d / 2), z1 = Math.round(cz + d / 2);
    const ph = s.ph === undefined ? 2 : s.ph;             // 台基高
    const yb = (s.y || 0) + ph;                           // 台面
    const bodyH = s.bh || Math.max(5, Math.round(d * 0.42) + 3);
    const over = s.over === undefined ? Math.max(2, Math.round(d * 0.18)) : s.over;  // 出檐
    const type = s.type || 'hip';
    let topY;
    if (ph > 0) {
      this.platform(x0 - (s.pmar || 2), z0 - (s.pmar || 2), x1 + (s.pmar || 2), z1 + (s.pmar || 2),
        s.y || 0, ph, {
          style: s.pstyle || (ph >= 4 ? 'sumeru' : 'plain'),
          railing: s.railing, railGaps: s.railGaps,
        });
    }
    // 月台
    if (s.yuetai) {
      const yt = s.yuetai;
      this.platform(cx - yt.w / 2, z1 + (s.pmar || 2), cx + yt.w / 2, z1 + (s.pmar || 2) + yt.d,
        s.y || 0, ph, { style: 'plain', railing: s.railing });
    }
    if (s.tiers === 2) {
      // 重檐：下檐 → 腰身 → 上檐
      const h1 = Math.round(bodyH * 0.62);
      this.body(x0, z0, x1, z1, yb, h1, s.bodyOpt || { sides: s.sides, interior: s.interior, throne: s.throne, bay: s.bay });
      const eave1 = yb + h1;
      const ix0 = x0 + 1, ix1 = x1 - 1, iz0 = z0 + 1, iz1 = z1 - 1;
      const H1 = Math.max(3, Math.min(6, Math.round(over * 0.85)));
      this.roof(x0 - over, z0 - over, x1 + over, z1 + over, eave1, H1,
        { type: type === 'pyramid' ? 'hip' : type, tile: s.tile, thk: 1, ridgeH: 1, lift: s.lift, gw: s.gw,
          tref: over + 1.5, hole: { x0: ix0, z0: iz0, x1: ix1, z1: iz1 } });
      // 腰身（平座 + 槛窗），坐落于腰檐裙顶
      const iy = eave1 + H1 + 1;
      const h2 = Math.max(4, bodyH - h1);
      this.body(ix0, iz0, ix1, iz1, iy, h2, { sides: { s: 'window', n: 'wall', e: 'window', w: 'window' }, bay: s.bay || 4, floor: C.beamDark });
      topY = this.roof(ix0 - over, iz0 - over, ix1 + over, iz1 + over, iy + h2, s.rh || Math.max(5, Math.round(d * 0.5)),
        { type, tile: s.tile, lift: s.lift, gw: s.gw, pitch: s.pitch, ridgeColor: s.ridgeColor });
    } else {
      this.body(x0, z0, x1, z1, yb, bodyH, s.bodyOpt || { sides: s.sides, interior: s.interior, throne: s.throne, bay: s.bay });
      topY = this.roof(x0 - over, z0 - over, x1 + over, z1 + over, yb + bodyH, s.rh || Math.max(4, Math.round(d * 0.45)),
        { type, tile: s.tile, lift: s.lift, gw: s.gw, pitch: s.pitch, flat: s.flat, ridgeColor: s.ridgeColor, tallFinial: s.tallFinial });
    }
    // 台阶
    if (s.stairs !== false && ph > 0) {
      const sw = Math.min(w * 0.5, 14) | 0;
      this.stairs(cx, z1 + (s.pmar || 2), Math.max(5, sw), s.y || 0, yb, 's', { imperial: s.imperial });
      if (s.stairN) this.stairs(cx, z0 - (s.pmar || 2), Math.max(5, sw), s.y || 0, yb, 'n', {});
      if (s.stairEW) {
        this.stairs(x1 + (s.pmar || 2), cz, 7, s.y || 0, yb, 'e', {});
        this.stairs(x0 - (s.pmar || 2), cz, 7, s.y || 0, yb, 'w', {});
      }
    }
    if (s.name) this.reg(s.name, x0 - over, z0 - over, x1 + over, z1 + over, topY, s.cat, s.desc);
    if (this.G && s.pave !== false) this.G.rect(x0 - over - 2, z0 - over - 2, x1 + over + 3, z1 + over + 3, GM.plaza, 0);
    return topY;
  }

  /** 城门楼 / 宫门（带城台或直接落地） */
  gate(s) {
    const V = this.V;
    const cx = s.x, cz = s.z;
    const w = s.w, d = s.d;
    const x0 = Math.round(cx - w / 2), x1 = Math.round(cx + w / 2);
    const z0 = Math.round(cz - d / 2), z1 = Math.round(cz + d / 2);
    const ph = s.ph === undefined ? 2 : s.ph;
    const yb = (s.y || 0) + ph;
    if (ph > 0) this.platform(x0 - 2, z0 - 2, x1 + 2, z1 + 2, s.y || 0, ph, { style: ph >= 4 ? 'sumeru' : 'plain', railing: s.railing });
    const bodyH = s.bh || 7;
    // 门殿：正面开三门洞
    const openings = s.openings === undefined ? 3 : s.openings;
    const gapW = s.gapW || 2;
    V.box(x0, yb, z0, x1, yb + bodyH - 3, z1, s.wall || C.wallRed);          // 实墙体
    V.box(x0 + 1, yb, z0 + 1, x1 - 1, yb + bodyH - 3, z1 - 1, 0);            // 掏空内部
    // 门洞
    const spots = [];
    if (openings === 1) spots.push(0);
    else if (openings === 3) spots.push(-Math.round(w * 0.28), 0, Math.round(w * 0.28));
    else if (openings === 5) spots.push(-Math.round(w * 0.36), -Math.round(w * 0.18), 0, Math.round(w * 0.18), Math.round(w * 0.36));
    for (const sx of spots) {
      const X = Math.round(cx + sx);
      const hw = (sx === 0) ? gapW + 1 : gapW;
      V.box(X - hw, yb, z0, X + hw, yb + bodyH - 5, z1, 0);
      V.box(X - hw, yb + bodyH - 4, z0, X + hw, yb + bodyH - 4, z1, C.doorRed);
      // 门扇（红门+金钉）
      if (s.doors) {
        V.box(X - hw, yb, cz, X + hw, yb + bodyH - 5, cz, C.doorRed);
        V.set(X, yb + 2, cz, C.gold);
      }
    }
    const st = this.body(x0, z0, x1, z1, yb + bodyH - 3, 3, { sides: { s: 'none', n: 'none', e: 'none', w: 'none' } });
    void st;
    const over = s.over === undefined ? Math.max(2, Math.round(d * 0.3)) : s.over;
    let topY;
    if (s.tiers === 2) {
      this.roof(x0 - over, z0 - over, x1 + over, z1 + over, yb + bodyH, 3,
        { type: 'hip', tile: s.tile, thk: 1, ridgeH: 1, lift: s.lift, tref: over + 1.5,
          hole: { x0: x0 + 1, z0: z0 + 1, x1: x1 - 1, z1: z1 - 1 } });
      const iy = yb + bodyH + 4;
      this.body(x0 + 1, z0 + 1, x1 - 1, z1 - 1, iy, 4, { sides: { s: 'window', n: 'window', e: 'window', w: 'window' }, bay: 3, floor: C.beamDark });
      topY = this.roof(x0 - over + 1, z0 - over + 1, x1 + over - 1, z1 + over - 1, iy + 4, s.rh || Math.max(4, Math.round(d * 0.55)),
        { type: s.type || 'hip', tile: s.tile, lift: s.lift, gw: s.gw });
    } else {
      topY = this.roof(x0 - over, z0 - over, x1 + over, z1 + over, yb + bodyH, s.rh || Math.max(4, Math.round(d * 0.5)),
        { type: s.type || 'hip', tile: s.tile, lift: s.lift, gw: s.gw });
    }
    if (s.name) this.reg(s.name, x0 - over, z0 - over, x1 + over, z1 + over, topY, s.cat, s.desc);
    if (this.G) this.G.rect(x0 - over - 1, z0 - over - 1, x1 + over + 2, z1 + over + 2, GM.plaza, 0);
    return topY;
  }

  /** 亭子（方/圆/八角，攒尖顶） */
  pavilion(s) {
    const V = this.V;
    const r = s.r || 4;
    const cx = Math.round(s.x), cz = Math.round(s.z);
    const y = s.y || 0;
    const ph = s.ph === undefined ? 2 : s.ph;
    this.platform(cx - r, cz - r, cx + r, cz + r, y, ph, { style: 'plain' });
    const yb = y + ph;
    const h = s.bh || 5;
    // 檐柱
    for (const dx of [-r + 1, r - 1]) for (const dz of [-r + 1, r - 1]) V.box(cx + dx, yb, cz + dz, cx + dx, yb + h, cz + dz, C.columnRed);
    if (r >= 5) {
      for (const dx of [-r + 1, r - 1]) V.box(cx + dx, yb, cz, cx + dx, yb + h, cz, C.columnRed);
      for (const dz of [-r + 1, r - 1]) V.box(cx, yb, cz + dz, cx, yb + h, cz + dz, C.columnRed);
    }
    // 坐凳栏杆
    if (s.bench !== false) {
      for (let x = cx - r + 1; x <= cx + r - 1; x++) { V.set(x, yb, cz - r + 1, C.marbleD); V.set(x, yb, cz + r - 1, C.marbleD); }
      for (let z = cx - r + 2; z <= cz + r - 2; z++) { V.set(cx - r + 1, yb, z, C.marbleD); V.set(cx + r - 1, yb, z, C.marbleD); }
    }
    // 额枋斗拱
    for (let x = cx - r + 1; x <= cx + r - 1; x++) {
      V.set(x, yb + h, cz - r + 1, (x & 1) ? C.paintGreen : C.paintBlue);
      V.set(x, yb + h, cz + r - 1, (x & 1) ? C.paintGreen : C.paintBlue);
    }
    for (let z = cz - r + 1; z <= cz + r - 1; z++) {
      V.set(cx - r + 1, yb + h, z, (z & 1) ? C.paintGreen : C.paintBlue);
      V.set(cx + r - 1, yb + h, z, (z & 1) ? C.paintGreen : C.paintBlue);
    }
    const over = s.over === undefined ? 2 : s.over;
    let topY;
    if (s.tiers === 2) {
      const r2 = r - 1;
      this.roof(cx - r - over, cz - r - over, cx + r + over, cz + r + over, yb + h + 1, 3,
        { type: 'hip', tile: s.tile, thk: 1, ridgeH: 1, lift: 1, tref: over + 1.5,
          hole: { x0: cx - r2 + 1, z0: cz - r2 + 1, x1: cx + r2 - 1, z1: cz + r2 - 1 } });
      const iy = yb + h + 5;
      for (const dx of [-r2 + 1, r2 - 1]) for (const dz of [-r2 + 1, r2 - 1]) V.box(cx + dx, iy, cz + dz, cx + dx, iy + 3, cz + dz, C.columnRed);
      V.box(cx - r2 + 1, iy, cz - r2 + 1, cx + r2 - 1, iy, cz + r2 - 1, C.beamDark);
      topY = this.roof(cx - r2 - over, cz - r2 - over, cx + r2 + over, cz + r2 + over, iy + 4, s.rh || (r2 + 2),
        { type: s.type || 'round', tile: s.tile, lift: 1, tallFinial: true });
    } else {
      topY = this.roof(cx - r - over, cz - r - over, cx + r + over, cz + r + over, yb + h + 1, s.rh || (r + 2),
        { type: s.type || 'pyramid', tile: s.tile, lift: s.lift === undefined ? 1 : s.lift, tallFinial: true });
    }
    if (s.name) this.reg(s.name, cx - r - over, cz - r - over, cx + r + over, cz + r + over, topY, s.cat, s.desc);
    if (this.G && s.pave !== false) this.G.rect(cx - r - over, cz - r - over, cx + r + over + 1, cz + r + over + 1, s.paveMat || GM.slab, 0);
    return topY;
  }

  /** 庑房 / 朝房 / 值房：长条低矮房屋，围合院落 */
  corridor(x0, z0, x1, z1, o = {}) {
    const V = this.V;
    x0 = Math.round(x0); x1 = Math.round(x1); z0 = Math.round(z0); z1 = Math.round(z1);
    const y = o.y || 0, ph = o.ph === undefined ? 1 : o.ph;
    const h = o.h || 5;
    const alongX = (x1 - x0) >= (z1 - z0);
    this.platform(x0, z0, x1, z1, y, ph, { style: 'plain', face: C.stone, top: C.stone });
    const yb = y + ph;
    const sides = alongX
      ? { s: o.face === 'n' ? 'wall' : 'window', n: o.face === 'n' ? 'window' : 'wall', e: 'wall', w: 'wall' }
      : { e: o.face === 'w' ? 'wall' : 'window', w: o.face === 'w' ? 'window' : 'wall', s: 'wall', n: 'wall' };
    this.body(x0, z0, x1, z1, yb, h, { sides, bay: o.bay || 4, wall: o.wall });
    const over = o.over === undefined ? 1 : o.over;
    const rh = o.rh || 3;
    return this.roof(x0 - over, z0 - over, x1 + over, z1 + over, yb + h, rh,
      { type: o.type || 'juan', tile: o.tile, thk: 1, ridgeH: 1, lift: 1, gw: 2 });
  }

  /** 宫墙（红墙黄琉璃瓦顶），gates=[{at, w, type}] at=沿墙轴向坐标 */
  wallRun(x0, z0, x1, z1, o = {}) {
    const V = this.V;
    x0 = Math.round(x0); x1 = Math.round(x1); z0 = Math.round(z0); z1 = Math.round(z1);
    const h = o.h || 6, t = o.t || 1;
    const alongX = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
    const wc = o.color || C.wallRed;
    if (alongX) {
      const zc = Math.round((z0 + z1) / 2);
      V.box(Math.min(x0, x1), o.y || 0, zc - (t - 1), Math.max(x0, x1), (o.y || 0) + h - 2, zc + (t - 1), wc);
      // 瓦顶
      V.box(Math.min(x0, x1), (o.y || 0) + h - 1, zc - t, Math.max(x0, x1), (o.y || 0) + h - 1, zc + t, C.tileB);
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) V.set(x, (o.y || 0) + h, zc, (x & 1) ? C.tileA : C.ridge);
    } else {
      const xc = Math.round((x0 + x1) / 2);
      V.box(xc - (t - 1), o.y || 0, Math.min(z0, z1), xc + (t - 1), (o.y || 0) + h - 2, Math.max(z0, z1), wc);
      V.box(xc - t, (o.y || 0) + h - 1, Math.min(z0, z1), xc + t, (o.y || 0) + h - 1, Math.max(z0, z1), C.tileB);
      for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) V.set(xc, (o.y || 0) + h, z, (z & 1) ? C.tileA : C.ridge);
    }
    // 开门洞
    for (const g of (o.gates || [])) {
      const gw = g.w || 3, gh = g.h || Math.min(h - 2, 5);
      if (alongX) {
        const zc = Math.round((z0 + z1) / 2);
        this.V.clearBox(g.at - gw, o.y || 0, zc - t, g.at + gw, (o.y || 0) + gh, zc + t);
        // 门楣与门框
        this.V.box(g.at - gw - 1, o.y || 0, zc - (t - 1), g.at - gw - 1, (o.y || 0) + gh + 1, zc + (t - 1), C.marbleD);
        this.V.box(g.at + gw + 1, o.y || 0, zc - (t - 1), g.at + gw + 1, (o.y || 0) + gh + 1, zc + (t - 1), C.marbleD);
        this.V.box(g.at - gw, (o.y || 0) + gh + 1, zc - (t - 1), g.at + gw, (o.y || 0) + gh + 1, zc + (t - 1), C.marbleD);
        if (g.name) this.reg(g.name, g.at - gw, zc - 2, g.at + gw, zc + 2, (o.y || 0) + h + 2, '门', g.desc);
      } else {
        const xc = Math.round((x0 + x1) / 2);
        this.V.clearBox(xc - t, o.y || 0, g.at - gw, xc + t, (o.y || 0) + gh, g.at + gw);
        this.V.box(xc - (t - 1), o.y || 0, g.at - gw - 1, xc + (t - 1), (o.y || 0) + gh + 1, g.at - gw - 1, C.marbleD);
        this.V.box(xc - (t - 1), o.y || 0, g.at + gw + 1, xc + (t - 1), (o.y || 0) + gh + 1, g.at + gw + 1, C.marbleD);
        this.V.box(xc - (t - 1), (o.y || 0) + gh + 1, g.at - gw, xc + (t - 1), (o.y || 0) + gh + 1, g.at + gw, C.marbleD);
        if (g.name) this.reg(g.name, xc - 2, g.at - gw, xc + 2, g.at + gw, (o.y || 0) + h + 2, '门', g.desc);
      }
    }
  }

  /** 琉璃门（宫墙上的小门楼，如天一门、内左门） */
  glazedGate(x, z, o = {}) {
    const V = this.V;
    const w = o.w || 5, dir = o.dir || 'ns';
    const h = o.h || 7;
    const x0 = x - w, x1 = x + w;
    if (dir === 'ns') {
      V.box(x0, 0, z - 1, x1, h - 3, z + 1, C.wallRed);
      V.clearBox(x - 2, 0, z - 1, x + 2, h - 5, z + 1);
      V.box(x - 2, h - 4, z - 1, x + 2, h - 4, z + 1, C.marbleD);
      this.roof(x0 - 2, z - 3, x1 + 2, z + 3, h - 1, 3, { type: 'hip', thk: 1, ridgeH: 1, lift: 1 });
    } else {
      V.box(x - 1, 0, z - w, x + 1, h - 3, z + w, C.wallRed);
      V.clearBox(x - 1, 0, z - 2, x + 1, h - 5, z + 2);
      V.box(x - 1, h - 4, z - 2, x + 1, h - 4, z + 2, C.marbleD);
      this.roof(x - 3, z - w - 2, x + 3, z + w + 2, h - 1, 3, { type: 'hip', thk: 1, ridgeH: 1, lift: 1 });
    }
    if (o.name) this.reg(o.name, x - w, z - 3, x + w, z + 3, h + 3, '门', o.desc);
  }

  /* ---------------- 陈设小品 ---------------- */
  lion(x, z, y = 0, face = 's') {
    const V = this.V;
    this.platform(x - 1, z - 1, x + 1, z + 1, y, 2, { style: 'plain', face: C.marbleD, top: C.marbleS });
    const b = y + 2;
    V.box(x, b, z, x, b + 1, z, C.bronzeD);
    V.set(x, b + 2, z, C.bronze);
    const d = face === 's' ? 1 : -1;
    V.set(x, b + 1, z + d, C.bronzeD);
    V.set(x, b + 2, z + d, C.bronze);   // 头
    V.set(x, b + 3, z + d, C.gold);
  }
  huabiao(x, z, y = 0) {
    const V = this.V;
    this.platform(x - 2, z - 2, x + 2, z + 2, y, 2, { style: 'sumeru', face: C.marble, top: C.marbleD });
    V.box(x, y + 2, z, x, y + 12, z, C.marble);
    V.box(x - 2, y + 9, z, x + 2, y + 9, z, C.marbleD);      // 云板
    V.box(x - 1, y + 13, z - 1, x + 1, y + 13, z + 1, C.marbleD);
    V.set(x, y + 14, z, C.marbleS);
  }
  cauldron(x, z, y = 0, c) {   // 铜鼎 / 香炉
    const V = this.V;
    V.box(x, y, z, x, y + 1, z, c || C.bronzeD);
    V.box(x - 1, y + 2, z - 1, x + 1, y + 3, z + 1, c || C.bronze);
    V.set(x, y + 4, z, C.gold);
  }
  vat(x, z, y = 0) {           // 太平缸
    const V = this.V;
    V.box(x, y, z, x + 1, y + 1, z + 1, C.bronzeD);
    V.box(x, y + 2, z, x + 1, y + 2, z + 1, C.bronze);
  }
  sundial(x, z, y = 0) {       // 日晷
    const V = this.V;
    this.platform(x - 1, z - 1, x + 1, z + 1, y, 2, { style: 'plain', face: C.marbleD, top: C.marble });
    V.box(x, y + 2, z, x, y + 2, z, C.marble);
    V.set(x, y + 3, z, C.marbleS);
  }
  craneTurtle(x, z, y = 0) {   // 铜龟铜鹤
    const V = this.V;
    this.platform(x - 1, z - 1, x + 1, z + 1, y, 1, { style: 'plain', face: C.marbleD, top: C.marbleS });
    V.box(x, y + 1, z, x, y + 2, z, C.patina);
    V.set(x, y + 3, z, C.bronze);
  }
  well(x, z, y = 0) {          // 井亭
    this.pavilion({ x, z, r: 3, y, ph: 1, bh: 4, type: 'pyramid', rh: 3, over: 1, bench: false, pave: true, paveMat: GM.slab });
  }
  /** 石桥（拱桥） */
  bridge(cx, cz, w, len, o = {}) {
    const V = this.V;
    const dir = o.dir || 'ns';        // 桥的通行方向
    const rise = o.rise === undefined ? 2 : o.rise;
    const y = o.y || 0;
    if (dir === 'ns') {
      for (let z = cz - len; z <= cz + len; z++) {
        const t = 1 - Math.abs(z - cz) / (len + 0.5);
        const h = y + Math.round(rise * Math.pow(t, 0.7));
        V.box(cx - w, y - 3, z, cx + w, h, z, C.marbleD);
        V.set(cx - w, h + 1, z, C.marble); V.set(cx + w, h + 1, z, C.marble);
        if ((z & 1) === 0) { V.set(cx - w, h + 2, z, C.marbleS); V.set(cx + w, h + 2, z, C.marbleS); }
        if (o.imperial && Math.abs(z - cz) < len) V.set(cx, h, z, C.marble);
      }
      // 拱券洞
      V.clearBox(cx - w + 1, y - 3, cz - Math.max(1, len - 3), cx + w - 1, y - 1, cz + Math.max(1, len - 3));
    } else {
      for (let x = cx - len; x <= cx + len; x++) {
        const t = 1 - Math.abs(x - cx) / (len + 0.5);
        const h = y + Math.round(rise * Math.pow(t, 0.7));
        V.box(x, y - 3, cz - w, x, h, cz + w, C.marbleD);
        V.set(x, h + 1, cz - w, C.marble); V.set(x, h + 1, cz + w, C.marble);
        if ((x & 1) === 0) { V.set(x, h + 2, cz - w, C.marbleS); V.set(x, h + 2, cz + w, C.marbleS); }
      }
      V.clearBox(cx - Math.max(1, len - 3), y - 3, cz - w + 1, cx + Math.max(1, len - 3), y - 1, cz + w - 1);
    }
  }
  /** 石座宫灯（夜间发光） */
  lantern(x, z, y = 0) {
    const V = this.V;
    V.box(x, y, z, x, y + 3, z, C.columnRedD);
    V.set(x, y + 4, z, C.lantern);
    V.set(x, y + 5, z, C.lantern);
  }
  /** 树：松/柏/槐/柳 */
  tree(x, z, y = 0, kind = 'pine', scale = 1) {
    const V = this.V;
    const R = this.rnd;
    x = Math.round(x); z = Math.round(z);
    const hh = Math.round((kind === 'pine' ? 8 : 7) * scale + R() * 3);
    V.box(x, y, z, x, y + hh, z, C.trunk);
    if (kind === 'pine' || kind === 'cypress') {
      let r = Math.max(1, Math.round(2.4 * scale + R()));
      for (let ly = y + Math.round(hh * 0.35); ly <= y + hh + 1; ly += 2) {
        const rr = Math.max(1, Math.round(r * (1 - (ly - y - hh * 0.35) / (hh * 0.8)) + 0.6));
        for (let dx = -rr; dx <= rr; dx++) for (let dz = -rr; dz <= rr; dz++) {
          if (dx * dx + dz * dz > rr * rr + 0.3) continue;
          if (((dx * 7 + dz * 5 + ly * 3) % 11) === 0) continue;
          V.set(x + dx, ly, z + dz, ((dx + dz + ly) & 1) ? C.pine : C.pineD);
        }
      }
      V.set(x, y + hh + 2, z, C.pineD);
    } else {
      const r = Math.max(2, Math.round(3 * scale + R() * 1.5));
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        const d = dx * dx + dy * dy * 1.6 + dz * dz;
        if (d > r * r) continue;
        if (((dx * 5 + dy * 7 + dz * 3) % 9) === 0) continue;
        V.set(x + dx, y + hh + dy, z + dz, ((dx + dz) & 1) ? C.leaf : C.leafD);
      }
    }
  }
  /** 假山（叠石） */
  rockery(cx, cz, rx, rz, h, o = {}) {
    const V = this.V;
    const R = this.rnd;
    for (let x = -rx; x <= rx; x++) {
      for (let z = -rz; z <= rz; z++) {
        const d = Math.hypot(x / rx, z / rz);
        if (d > 1.05) continue;
        let hh = h * Math.pow(Math.max(0, 1 - d), 0.65);
        hh += (R() - 0.4) * Math.min(3, h * 0.25);
        hh = Math.round(hh);
        if (hh <= 0) continue;
        const top = (o.y || 0) + hh;
        for (let y = Math.max(0, top - 2); y <= top; y++)
          V.set(cx + x, y, cz + z, ((x * 3 + z * 5 + y) % 4 === 0) ? C.rockD : C.rock);
        if (R() < 0.05 && hh > 2) V.set(cx + x, top + 1, cz + z, C.pineD);
      }
    }
  }
  /** 土山（景山） */
  mound(cx, cz, rx, rz, h, o = {}) {
    const V = this.V;
    const R = this.rnd;
    for (let x = -rx; x <= rx; x++) {
      for (let z = -rz; z <= rz; z++) {
        const d = Math.hypot(x / rx, z / rz);
        if (d > 1.02) continue;
        let hh = h * Math.pow(Math.cos(Math.min(1, d) * Math.PI / 2), 1.25);
        hh += Math.sin(x * 0.21) * 1.6 + Math.cos(z * 0.17) * 1.6 + (R() - 0.5) * 1.2;
        hh = Math.round(hh);
        if (hh <= 0) continue;
        for (let y = Math.max(0, hh - 3); y <= hh; y++) {
          const c = (y === hh) ? (((x + z) & 1) ? C.grass : C.grassD) : C.soil;
          V.set(cx + x, y, cz + z, c);
        }
        if (R() < 0.012 && hh > 3) this.tree(cx + x, cz + z, hh, R() < 0.7 ? 'cypress' : 'leaf', 0.8);
      }
    }
  }
}

window.Arch = Arch; window.IdMap = IdMap; window.mulberry32 = mulberry32;
