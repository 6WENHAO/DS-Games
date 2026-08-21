/* ============================================================================
 * cube4.js —— 四阶魔方（4x4x4）状态引擎
 * 所有转动置换均由几何推导自动生成，避免手写置换表出错。
 * 面序：U=0 R=1 F=2 D=3 L=4 B=5 ；贴纸编号 fid = face*16 + row*4 + col
 * 世界坐标：+x 右 / +y 上 / +z 朝向观察者（前）
 * ==========================================================================*/
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CUBE4 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const N = 4;                     // 阶数
  const NF = N * N;                // 每面贴纸数
  const NS = 6 * NF;               // 贴纸总数 96
  const FACE_NAMES = ['U', 'R', 'F', 'D', 'L', 'B'];
  const FACE_COLORS = ['#f7f7f2', '#d8352a', '#2fa84f', '#f4c518', '#f07c1e', '#2260c7'];

  /* --------------------------------------------------------------------------
   * 1. 贴纸 <-> 几何（cubie 坐标 + 法向）
   * ------------------------------------------------------------------------*/
  // 返回 {i,j,k, n:[nx,ny,nz]}，i/j/k ∈ 0..3
  function faceletGeom(face, r, c) {
    switch (face) {
      case 0: return { i: c, j: 3, k: r, n: [0, 1, 0] };        // U
      case 1: return { i: 3, j: 3 - r, k: 3 - c, n: [1, 0, 0] }; // R
      case 2: return { i: c, j: 3 - r, k: 3, n: [0, 0, 1] };     // F
      case 3: return { i: c, j: 0, k: 3 - r, n: [0, -1, 0] };    // D
      case 4: return { i: 0, j: 3 - r, k: c, n: [-1, 0, 0] };    // L
      case 5: return { i: 3 - c, j: 3 - r, k: 0, n: [0, 0, -1] };// B
    }
    throw new Error('bad face ' + face);
  }

  const GEOM = new Array(NS);
  const GEOM_KEY = new Map();
  const gkey = (i, j, k, n) => i + ',' + j + ',' + k + '|' + n[0] + ',' + n[1] + ',' + n[2];
  for (let f = 0; f < 6; f++) {
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const fid = f * NF + r * N + c;
        const g = faceletGeom(f, r, c);
        g.fid = fid; g.face = f; g.row = r; g.col = c;
        GEOM[fid] = g;
        GEOM_KEY.set(gkey(g.i, g.j, g.k, g.n), fid);
      }
    }
  }

  // 右手法则 90° 旋转（作用于以立方体中心为原点的坐标）
  function rot90(v, axis) {
    const [x, y, z] = v;
    if (axis === 0) return [x, -z, y];   // 绕 +x
    if (axis === 1) return [z, y, -x];   // 绕 +y
    return [-y, x, z];                   // 绕 +z
  }
  function rotN(v, axis, q) { let o = v; for (let t = 0; t < ((q % 4) + 4) % 4; t++) o = rot90(o, axis); return o; }

  const cubieCoord = (g, axis) => (axis === 0 ? g.i : axis === 1 ? g.j : g.k);

  /* --------------------------------------------------------------------------
   * 2. 转动置换生成
   * ------------------------------------------------------------------------*/
  // 单层转动：axis 0/1/2，layer 0..3（沿 +axis 方向的层号），q 个右手 90°
  function layerPerm(axis, layers, q) {
    const src = new Uint8Array(NS);
    for (let i = 0; i < NS; i++) src[i] = i;
    for (let fid = 0; fid < NS; fid++) {
      const g = GEOM[fid];
      if (layers.indexOf(cubieCoord(g, axis)) < 0) continue;
      const p = [g.i - 1.5, g.j - 1.5, g.k - 1.5];
      const np = rotN(p, axis, q);
      const nn = rotN(g.n, axis, q);
      const key = gkey(Math.round(np[0] + 1.5), Math.round(np[1] + 1.5), Math.round(np[2] + 1.5),
        [Math.round(nn[0]), Math.round(nn[1]), Math.round(nn[2])]);
      const dst = GEOM_KEY.get(key);
      if (dst === undefined) throw new Error('geometry mismatch');
      src[dst] = fid;   // 转动后 dst 位置上的贴纸来自 fid
    }
    return src;
  }

  /* --------------------------------------------------------------------------
   * 3. 招式表（MOVES）
   *   记号（SiGN 风格）：外层 U R F D L B ；内层 2U 2R 2F 2D 2L 2B
   *   宽层 Uw Rw ... ；中层 M E S
   * ------------------------------------------------------------------------*/
  // base: {name, axis, layers, qBase}  qBase = 顺时针（从该面外侧看）对应的右手转数
  const BASES = [
    { name: 'U', axis: 1, layers: [3], qBase: 3 },
    { name: '2U', axis: 1, layers: [2], qBase: 3 },
    { name: '2D', axis: 1, layers: [1], qBase: 1 },
    { name: 'D', axis: 1, layers: [0], qBase: 1 },
    { name: 'R', axis: 0, layers: [3], qBase: 3 },
    { name: '2R', axis: 0, layers: [2], qBase: 3 },
    { name: '2L', axis: 0, layers: [1], qBase: 1 },
    { name: 'L', axis: 0, layers: [0], qBase: 1 },
    { name: 'F', axis: 2, layers: [3], qBase: 3 },
    { name: '2F', axis: 2, layers: [2], qBase: 3 },
    { name: '2B', axis: 2, layers: [1], qBase: 1 },
    { name: 'B', axis: 2, layers: [0], qBase: 1 },
    // 宽层（两层一起转）
    { name: 'Uw', axis: 1, layers: [3, 2], qBase: 3 },
    { name: 'Dw', axis: 1, layers: [0, 1], qBase: 1 },
    { name: 'Rw', axis: 0, layers: [3, 2], qBase: 3 },
    { name: 'Lw', axis: 0, layers: [0, 1], qBase: 1 },
    { name: 'Fw', axis: 2, layers: [3, 2], qBase: 3 },
    { name: 'Bw', axis: 2, layers: [0, 1], qBase: 1 },
    // 中层（3x3 意义上的 M/E/S，作用于两个内层）
    { name: 'M', axis: 0, layers: [1, 2], qBase: 1 },   // 跟随 L
    { name: 'E', axis: 1, layers: [1, 2], qBase: 1 },   // 跟随 D
    { name: 'S', axis: 2, layers: [1, 2], qBase: 3 }    // 跟随 F
  ];

  const MOVES = [];           // 全部招式
  const MOVE_BY_NAME = new Map();
  for (const b of BASES) {
    for (const [sfx, mul] of [['', 1], ["'", -1], ['2', 2]]) {
      const q = ((b.qBase * mul) % 4 + 4) % 4;
      const name = b.name + sfx;
      const mv = {
        idx: MOVES.length, name, base: b.name, axis: b.axis, layers: b.layers.slice(),
        q, turns: mul, perm: layerPerm(b.axis, b.layers, q),
        // 动画用：绕 axis 的右手转角（度）
        angle: (b.qBase === 3 ? -90 : 90) * (mul === 2 ? 2 : mul)
      };
      MOVES.push(mv);
      MOVE_BY_NAME.set(name, mv);
    }
  }
  // 单层招式（打乱/搜索用，共 36 个）
  const SINGLE_MOVES = MOVES.filter(m => m.layers.length === 1);

  function moveByName(n) {
    const m = MOVE_BY_NAME.get(n);
    if (!m) throw new Error('unknown move: ' + n);
    return m;
  }
  function parseSeq(s) {
    if (Array.isArray(s)) return s.map(x => (typeof x === 'string' ? moveByName(x) : x));
    return s.trim().split(/\s+/).filter(Boolean).map(moveByName);
  }
  function seqToString(seq) { return seq.map(m => m.name).join(' '); }
  function invertSeq(seq) {
    return seq.slice().reverse().map(m => {
      const t = m.turns === 2 ? 2 : -m.turns;
      return moveByName(m.base + (t === 1 ? '' : t === -1 ? "'" : '2'));
    });
  }

  /* --------------------------------------------------------------------------
   * 4. 状态操作
   * ------------------------------------------------------------------------*/
  function solvedState() {
    const st = new Uint8Array(NS);
    for (let i = 0; i < NS; i++) st[i] = (i / NF) | 0;
    return st;
  }
  function applyMove(st, mv, out) {
    const p = mv.perm, o = out || new Uint8Array(NS);
    for (let i = 0; i < NS; i++) o[i] = st[p[i]];
    return o;
  }
  function applySeq(st, seq) {
    let cur = st.slice();
    for (const m of parseSeq(seq)) cur = applyMove(cur, m);
    return cur;
  }
  function isSolved(st) {
    for (let i = 0; i < NS; i++) if (st[i] !== ((i / NF) | 0)) return false;
    return true;
  }

  function randomScramble(len) {
    len = len || 40;
    const out = [];
    let lastKey = -1;
    while (out.length < len) {
      const m = SINGLE_MOVES[(Math.random() * SINGLE_MOVES.length) | 0];
      const key = m.axis * 4 + m.layers[0];
      if (key === lastKey) continue;
      out.push(m); lastKey = key;
    }
    return out;
  }

  /* --------------------------------------------------------------------------
   * 5. 块结构（角块 / 棱块（复合棱）/ 中心块）
   * ------------------------------------------------------------------------*/
  const nName = n => (n[1] === 1 ? 'U' : n[1] === -1 ? 'D' : n[0] === 1 ? 'R' : n[0] === -1 ? 'L' : n[2] === 1 ? 'F' : 'B');
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const eqv = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

  // 按 cubie 分组
  const cubieMap = new Map();
  for (const g of GEOM) {
    const k = g.i + ',' + g.j + ',' + g.k;
    if (!cubieMap.has(k)) cubieMap.set(k, []);
    cubieMap.get(k).push(g);
  }

  // ---- 角块槽位：facelets 排序满足 n0 = ±y 且 n0 × n1 = n2
  const CORNER_ORDER = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'];
  const cornerRaw = new Map();
  for (const [, gs] of cubieMap) {
    if (gs.length !== 3) continue;
    const vy = gs.find(g => g.n[1] !== 0);
    const rest = gs.filter(g => g !== vy);
    let a = rest[0], b = rest[1];
    if (!eqv(cross(vy.n, a.n), b.n)) { const t = a; a = b; b = t; }
    const ordered = [vy, a, b];
    const name = ordered.map(g => nName(g.n)).join('');
    cornerRaw.set(name, ordered);
  }
  const CORNER_SLOTS = CORNER_ORDER.map(name => {
    // 名称可能是循环排列（如 URF 记作 UFR），做循环归一匹配
    let found = null;
    for (const [k, v] of cornerRaw) {
      const set = k.split('').sort().join('');
      if (set === name.split('').sort().join('')) { found = { key: k, gs: v }; break; }
    }
    if (!found) throw new Error('corner not found ' + name);
    return {
      name, key: found.key,
      facelets: found.gs.map(g => g.fid),
      homeColors: found.gs.map(g => g.face)
    };
  });

  // ---- 棱块（复合棱 dedge）槽位：每槽 2 个 wing
  const EDGE_ORDER = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR'];
  const wingRaw = new Map();   // slotName -> [ {gs:[primary, secondary], along} ... ]
  for (const [, gs] of cubieMap) {
    if (gs.length !== 2) continue;
    let p = gs.find(g => g.n[1] !== 0);              // U/D 优先
    if (!p) p = gs.find(g => g.n[2] !== 0);          // 否则 F/B 优先
    const s = gs.find(g => g !== p);
    const name = nName(p.n) + nName(s.n);
    if (!wingRaw.has(name)) wingRaw.set(name, []);
    // 沿棱方向的位置（用于两 wing 排序）
    const axis = p.n[0] === 0 && s.n[0] === 0 ? 0 : (p.n[1] === 0 && s.n[1] === 0 ? 1 : 2);
    wingRaw.get(name).push({ gs: [p, s], along: axis === 0 ? p.i : axis === 1 ? p.j : p.k });
  }
  const EDGE_SLOTS = EDGE_ORDER.map(name => {
    let key = null;
    for (const k of wingRaw.keys()) if (k.split('').sort().join('') === name.split('').sort().join('')) key = k;
    if (!key) throw new Error('edge not found ' + name);
    const ws = wingRaw.get(key).slice().sort((a, b) => a.along - b.along);
    if (ws.length !== 2) throw new Error('bad wing count');
    return {
      name: key,
      wings: ws.map(w => w.gs.map(g => g.fid)),
      homeColors: ws[0].gs.map(g => g.face)
    };
  });

  // ---- 中心块贴纸
  const CENTER_FIDS = [];
  for (const g of GEOM) {
    if (g.row >= 1 && g.row <= 2 && g.col >= 1 && g.col <= 2) CENTER_FIDS.push(g.fid);
  }

  // 颜色集合 -> 块编号
  const cornerByColors = new Map();
  CORNER_SLOTS.forEach((s, i) => cornerByColors.set(s.homeColors.slice().sort().join(','), i));
  const edgeByColors = new Map();
  EDGE_SLOTS.forEach((s, i) => edgeByColors.set(s.homeColors.slice().sort().join(','), i));

  /* --------------------------------------------------------------------------
   * 6. 归约信息（用于降阶为 3x3 与代价函数）
   * ------------------------------------------------------------------------*/
  // 中心块错位数
  function centerErrors(st) {
    let e = 0;
    for (let t = 0; t < CENTER_FIDS.length; t++) {
      const fid = CENTER_FIDS[t];
      if (st[fid] !== ((fid / NF) | 0)) e++;
    }
    return e;
  }
  // 未配对复合棱数量（两个 wing 颜色不一致即未配对）
  function unpairedEdges(st) {
    let n = 0;
    for (let s = 0; s < 12; s++) {
      const w = EDGE_SLOTS[s].wings;
      if (st[w[0][0]] !== st[w[1][0]] || st[w[0][1]] !== st[w[1][1]]) n++;
    }
    return n;
  }
  function isReduced(st) { return unpairedEdges(st) === 0; }

  // 降阶为 3x3 状态：{cp,co,ep,eo}
  function reduce(st) {
    const cp = new Int8Array(8), co = new Int8Array(8);
    for (let s = 0; s < 8; s++) {
      const sl = CORNER_SLOTS[s];
      const cols = sl.facelets.map(f => st[f]);
      const pi = cornerByColors.get(cols.slice().sort().join(','));
      if (pi === undefined) return null;
      cp[s] = pi;
      let o = cols.indexOf(0); if (o < 0) o = cols.indexOf(3);
      if (o < 0) return null;
      co[s] = o;
    }
    const ep = new Int8Array(12), eo = new Int8Array(12);
    for (let s = 0; s < 12; s++) {
      const sl = EDGE_SLOTS[s];
      const w = sl.wings;
      if (st[w[0][0]] !== st[w[1][0]] || st[w[0][1]] !== st[w[1][1]]) return null;  // 未配对
      const cols = [st[w[0][0]], st[w[0][1]]];
      const pi = edgeByColors.get(cols.slice().sort().join(','));
      if (pi === undefined) return null;
      ep[s] = pi;
      eo[s] = (cols[0] === EDGE_SLOTS[pi].homeColors[0]) ? 0 : 1;
    }
    return { cp, co, ep, eo };
  }

  return {
    N, NF, NS, FACE_NAMES, FACE_COLORS,
    GEOM, MOVES, SINGLE_MOVES, MOVE_BY_NAME, BASES,
    moveByName, parseSeq, seqToString, invertSeq,
    solvedState, applyMove, applySeq, isSolved, randomScramble,
    CORNER_SLOTS, EDGE_SLOTS, CENTER_FIDS, CORNER_ORDER, EDGE_ORDER,
    centerErrors, unpairedEdges, isReduced, reduce,
    cubieMap
  };
});
