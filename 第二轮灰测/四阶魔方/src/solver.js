/* ============================================================================
 * solver.js —— 四阶魔方求解器
 *   阶段一：归约（Reduction）—— 中心块归位 + 复合棱配对（定向束搜索 Beam Search）
 *   阶段二：奇偶校正（OLL / PLL Parity，公式已由几何引擎验证）
 *   阶段三：三阶还原 —— CFOP（十字→F2L→OLL→PLL）或 桥式 Roux（FB→SB→CMLL→LSE）
 *   三阶阶段使用：精确 BFS 距离表 + IDA* 迭代加深搜索 + 束搜索兜底
 * ==========================================================================*/
(function (root, factory) {
  const C = (typeof module !== 'undefined' && typeof require === 'function')
    ? require('./cube4.js') : root.CUBE4;
  const api = factory(C);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SOLVER = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (C) {
  'use strict';

  const NS = C.NS;

  /* ==========================================================================
   * 0. 通用工具
   * ========================================================================*/
  // 招式的"层键"：同一层连续转动没有意义，用于剪枝
  for (const m of C.MOVES) {
    let mask = 0; for (const l of m.layers) mask |= 1 << l;
    m.bkey = m.axis * 16 + mask;
  }
  const byName = n => C.moveByName(n);
  const SINGLES = C.SINGLE_MOVES;                       // 36 个单层招式（归约阶段搜索空间）

  // 归约阶段代价函数所需的索引表
  const CEN = new Int32Array(C.CENTER_FIDS);
  const CEN_COL = new Uint8Array(CEN.length);
  for (let i = 0; i < CEN.length; i++) CEN_COL[i] = (CEN[i] / C.NF) | 0;
  const WING = new Int32Array(12 * 4);
  C.EDGE_SLOTS.forEach((s, i) => {
    WING[i * 4] = s.wings[0][0]; WING[i * 4 + 1] = s.wings[0][1];
    WING[i * 4 + 2] = s.wings[1][0]; WING[i * 4 + 3] = s.wings[1][1];
  });

  function nUnpaired(buf, off) {
    let n = 0;
    for (let i = 0; i < 12; i++) {
      const b = i * 4;
      if (buf[off + WING[b]] !== buf[off + WING[b + 2]] || buf[off + WING[b + 1]] !== buf[off + WING[b + 3]]) n++;
    }
    return n;
  }

  /* ==========================================================================
   * 1. 归约阶段启发式：两张精确 BFS 距离表
   *    (a) 中心块：每种颜色的 4 块聚拢到目标面 —— C(24,4)=10626 态完全 BFS
   *    (b) 棱片：一对棱片合并到同一棱槽 —— 24×24 态完全 BFS
   * ========================================================================*/
  // 中心槽位 0..23 与招式作用
  const SLOT_OF_FID = new Int8Array(NS).fill(-1);
  for (let i = 0; i < CEN.length; i++) SLOT_OF_FID[CEN[i]] = i;
  const SLOT_FACE = Int8Array.from(CEN_COL);
  function slotMaps(moves, fids, slotOf) {
    return moves.map(m => {
      const dst = new Int32Array(NS);
      for (let i = 0; i < NS; i++) dst[m.perm[i]] = i;
      const map = new Int8Array(fids.length);
      for (let s = 0; s < fids.length; s++) map[s] = slotOf[dst[fids[s]]];
      return map;
    });
  }
  const CEN_MOVE = slotMaps(SINGLES, CEN, SLOT_OF_FID);
  // 组合编码 C(24,4)
  const CH = [];
  for (let n = 0; n <= 24; n++) { CH.push([]); for (let k = 0; k <= 4; k++) CH[n].push(k === 0 ? 1 : (n === 0 ? 0 : CH[n - 1][k - 1] + CH[n - 1][k])); }
  const NCOMB = CH[24][4];
  const rank4 = a => CH[a[0]][1] + CH[a[1]][2] + CH[a[2]][3] + CH[a[3]][4];
  let COLOR_DIST = null;
  function colorTables() {
    if (COLOR_DIST) return COLOR_DIST;
    const unrank = new Array(NCOMB);
    (function rec(start, arr) {
      if (arr.length === 4) { unrank[rank4(arr)] = Int8Array.from(arr); return; }
      for (let v = start; v < 24; v++) { arr.push(v); rec(v + 1, arr); arr.pop(); }
    })(0, []);
    COLOR_DIST = [];
    const tmp = new Array(4);
    for (let col = 0; col < 6; col++) {
      const goal = [];
      for (let s = 0; s < 24; s++) if (SLOT_FACE[s] === col) goal.push(s);
      const dist = new Int8Array(NCOMB).fill(-1);
      const g = rank4(goal); dist[g] = 0;
      let frontier = [g], d = 0;
      while (frontier.length) {
        const next = [];
        for (const s of frontier) {
          const set = unrank[s];
          for (const map of CEN_MOVE) {
            tmp[0] = map[set[0]]; tmp[1] = map[set[1]]; tmp[2] = map[set[2]]; tmp[3] = map[set[3]];
            tmp.sort((x, y) => x - y);
            const t = rank4(tmp);
            if (dist[t] < 0) { dist[t] = d + 1; next.push(t); }
          }
        }
        frontier = next; d++;
      }
      COLOR_DIST.push(dist);
    }
    return COLOR_DIST;
  }

  // 棱片（wing）位置 0..23，主贴纸标识；WING_SLOT[p] = 所属棱槽
  const WING_FIDS = [], WING_SEC = [], WING_SLOT_ARR = [];
  C.EDGE_SLOTS.forEach((s, si) => s.wings.forEach(w => { WING_FIDS.push(w[0]); WING_SEC.push(w[1]); WING_SLOT_ARR.push(si); }));
  const WING_FID = Int32Array.from(WING_FIDS), WING_SEC_FID = Int32Array.from(WING_SEC);
  const WING_SLOT = Int8Array.from(WING_SLOT_ARR);
  const WPOS_OF_FID = new Int8Array(NS).fill(-1);
  for (let i = 0; i < WING_FID.length; i++) WPOS_OF_FID[WING_FID[i]] = i;
  const WING_MOVE = slotMaps(SINGLES, WING_FID, WPOS_OF_FID);
  let WPAIR_DIST = null;
  function wingPairTable() {
    if (WPAIR_DIST) return WPAIR_DIST;
    const dist = new Int8Array(576).fill(-1);
    let frontier = [];
    for (let a = 0; a < 24; a++) for (let b = 0; b < 24; b++) {
      if (a !== b && WING_SLOT[a] === WING_SLOT[b]) { dist[a * 24 + b] = 0; frontier.push(a * 24 + b); }
    }
    let d = 0;
    while (frontier.length) {
      const next = [];
      for (const s of frontier) {
        const a = (s / 24) | 0, b = s % 24;
        for (const map of WING_MOVE) {
          const t = map[a] * 24 + map[b];
          if (dist[t] < 0) { dist[t] = d + 1; next.push(t); }
        }
      }
      frontier = next; d++;
    }
    WPAIR_DIST = dist;
    return dist;
  }

  // 快速代价：中心块（单遍算 6 色 rank）
  const _cnt = new Int32Array(6), _rk = new Int32Array(6);
  function centerDistSum(buf, off) {
    const T = colorTables();
    _cnt.fill(0); _rk.fill(0);
    for (let s = 0; s < 24; s++) { const col = buf[off + CEN[s]]; _rk[col] += CH[s][++_cnt[col]]; }
    let sum = 0;
    for (let c = 0; c < 6; c++) sum += T[c][_rk[c]];
    return sum;
  }
  function centerMis(buf, off) {
    let m = 0;
    for (let s = 0; s < 24; s++) if (buf[off + CEN[s]] !== SLOT_FACE[s]) m++;
    return m;
  }
  // 快速代价：棱片配对（按颜色对把 24 个棱片两两配起来，查表求和）
  const _seen36 = new Int8Array(36);
  function wingDistSum(buf, off) {
    const T = wingPairTable();
    _seen36.fill(-1);
    let sum = 0;
    for (let p = 0; p < 24; p++) {
      const a = buf[off + WING_FID[p]], b = buf[off + WING_SEC_FID[p]];
      const key = a < b ? a * 6 + b : b * 6 + a;
      const q = _seen36[key];
      if (q >= 0) sum += T[q * 24 + p]; else _seen36[key] = p;
    }
    return sum;
  }

  /* ==========================================================================
   * 2. 束搜索（Beam Search）—— 投影去重 + 平台期检测 + 逐步加宽重试
   *    招式项可以是"原子招式"，也可以是"宏招式"（多步组合，perm 已预先合成）
   * ========================================================================*/
  // 序列合成：applySeq 的等价置换（out[i] = st[P[i]]）
  function composePerm(seq) {
    let P = new Uint8Array(NS);
    for (let i = 0; i < NS; i++) P[i] = i;
    for (let k = seq.length - 1; k >= 0; k--) {
      const q = seq[k].perm, nP = new Uint8Array(NS);
      for (let i = 0; i < NS; i++) nP[i] = q[P[i]];
      P = nP;
    }
    return P;
  }
  const ATOM = SINGLES.map(m => ({ name: m.name, seq: [m], perm: m.perm, pk: m.bkey }));
  const OUTER_MV = C.MOVES.filter(m => /^[URFDLB]['2]?$/.test(m.name));
  const invMove = m => C.moveByName(m.base + (m.turns === 1 ? "'" : m.turns === -1 ? '' : '2'));

  /* 保中心宏招式集：内层切片 s 会"劈开"与 s 垂直的四个面的中心块，
   * 此时只有对这四个面净转动为 0 的外层序列才不会破坏中心块 ——
   * 即人类 slice-flip-slice 配对法的数学本质。故宏形如：
   *   s · f · s⁻¹              （f 为与 s 同轴的自由面转动）
   *   s · X · f · X⁻¹ · s⁻¹    （X 为被劈开面的转动，用共轭抵消净转动）
   * 另外中心块已复原时，任何外层单步都不影响中心块，可直接作为原子招式。*/
  let MACRO_SET = null;
  function macroMoves() {
    if (MACRO_SET) return MACRO_SET;
    const byAxis = { 0: [], 1: [], 2: [] };
    for (const m of OUTER_MV) byAxis[m.axis].push(m);
    const list = OUTER_MV.map(m => ({ name: m.name, seq: [m], perm: m.perm, pk: m.bkey }));
    const slices = C.MOVES.filter(m => /^2[URFDLB]['2]?$/.test(m.name));
    for (const s of slices) {
      const sInv = invMove(s);
      for (const f of byAxis[s.axis]) {
        let seq = [s, f, sInv];
        list.push({ name: seq.map(x => x.name).join(' '), seq, perm: composePerm(seq), pk: -1 });
        for (const X of OUTER_MV) {
          if (X.axis === s.axis || X.turns === 2) continue;
          seq = [s, X, f, invMove(X), sInv];
          list.push({ name: seq.map(x => x.name).join(' '), seq, perm: composePerm(seq), pk: -1 });
        }
      }
    }
    MACRO_SET = list;
    return list;
  }

  /* 收尾（"最后两组棱"）专用扩展宏：加入经典翻棱序列
   *   s · (A P A' B A' B' A) · s⁻¹
   * 其中 P 为自由面（净转动不受限），A/B 为被劈开面且净转动为 0 ——
   * 取 P=U, A=R, B=F 即经典的 2U (R U R' F R' F' R) 2U'。*/
  const FACE_OPP = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };
  let MACRO_L2E = null;
  function macroMovesL2E() {
    if (MACRO_L2E) return MACRO_L2E;
    const list = macroMoves().slice();
    const slices = C.MOVES.filter(m => /^2[URFDLB]'?$/.test(m.name));   // 仅单向切片
    const axisFaces = { 0: ['R', 'L'], 1: ['U', 'D'], 2: ['F', 'B'] };
    for (const s of slices) {
      const sInv = invMove(s);
      const free = axisFaces[s.axis];
      const mixed = ['U', 'D', 'R', 'L', 'F', 'B'].filter(n => free.indexOf(n) < 0);
      for (const P of free) for (const ps of ['', "'", '2'])
        for (const A of mixed) for (const B of mixed) {
          if (B === A || B === FACE_OPP[A]) continue;
          const x = [A, P + ps, A + "'", B, A + "'", B + "'", A].map(n => C.moveByName(n));
          const seq = [s, ...x, sInv];
          list.push({ name: seq.map(m => m.name).join(' '), seq, perm: composePerm(seq), pk: -1 });
        }
    }
    MACRO_L2E = list;
    return list;
  }

  function beamSearch(start, moves, costFn, opts) {
    const width = opts.width, maxDepth = opts.maxDepth;
    const proj = opts.proj;                       // 只按相关贴纸去重，极大提升束的多样性
    if (costFn(start, 0) === 0) return [];
    const levels = [{ buf: start.slice(), n: 1, mv: new Int16Array([-1]), par: new Int32Array([-1]) }];
    let cur = levels[0];
    let best = Infinity, stall = 0;
    for (let d = 0; d < maxDepth; d++) {
      const cap = cur.n * moves.length;
      const kbuf = new Uint8Array(cap * NS);
      const kcost = new Float64Array(cap);
      const kmv = new Int16Array(cap);
      const kpar = new Int32Array(cap);
      let kn = 0;
      const seen = new Set();
      for (let ni = 0; ni < cur.n; ni++) {
        const sOff = ni * NS;
        const lastPk = cur.mv[ni] >= 0 ? moves[cur.mv[ni]].pk : -2;
        for (let mi = 0; mi < moves.length; mi++) {
          const m = moves[mi];
          if (m.pk >= 0 && m.pk === lastPk) continue;      // 同层连续转动无意义
          const perm = m.perm, off = kn * NS;
          for (let t = 0; t < NS; t++) kbuf[off + t] = cur.buf[sOff + perm[t]];
          let h = 0x811c9dc5;
          for (let t = 0; t < proj.length; t++) h = ((h ^ kbuf[off + proj[t]]) * 16777619) >>> 0;
          if (seen.has(h)) continue;
          seen.add(h);
          const cost = costFn(kbuf, off);
          if (cost === 0) {
            const path = [mi];
            let li = levels.length - 1, nn = ni;
            while (li > 0) { path.unshift(levels[li].mv[nn]); nn = levels[li].par[nn]; li--; }
            const out = [];
            for (const p of path) out.push(...moves[p].seq);
            return out;
          }
          kcost[kn] = cost + Math.random() * 0.9;   // 抖动打破平台期僵局
          kmv[kn] = mi; kpar[kn] = ni; kn++;
        }
      }
      if (kn === 0) return null;
      let order = new Array(kn);
      for (let i = 0; i < kn; i++) order[i] = i;
      order.sort((a, b) => kcost[a] - kcost[b]);
      if (order.length > width) order = order.slice(0, width);
      const b0 = Math.floor(kcost[order[0]]);
      if (b0 >= best) { if (++stall > 10) return null; } else { best = b0; stall = 0; }
      const nb = new Uint8Array(order.length * NS);
      const nmv = new Int16Array(order.length), npar = new Int32Array(order.length);
      for (let di = 0; di < order.length; di++) {
        const s = order[di];
        nb.set(kbuf.subarray(s * NS, s * NS + NS), di * NS);
        nmv[di] = kmv[s]; npar[di] = kpar[s];
      }
      cur = { buf: nb, n: order.length, mv: nmv, par: npar };
      levels.push(cur);
    }
    return null;
  }

  // 逐步放宽宽度的束搜索（保证成功率）
  function beamSolveStage(st, costFn, opts) {
    opts = opts || {};
    const widths = opts.widths || [1500, 1500, 5000, 12000];
    for (const w of widths) {
      const r = beamSearch(st, opts.moves || ATOM, costFn, {
        width: w, maxDepth: opts.maxDepth || 42, proj: opts.proj || CEN
      });
      if (r) return r;
    }
    return null;
  }

  /* ==========================================================================
   * 2. 招式序列化简（相邻同层合并 / 抵消）
   * ========================================================================*/
  function simplify(seq) {
    const out = [];
    for (const m of seq) {
      const last = out[out.length - 1];
      if (last && last.base === m.base) {
        let t = ((last.turns + m.turns) % 4 + 4) % 4;
        out.pop();
        if (t === 3) t = -1;
        if (t !== 0) out.push(byName(m.base + (t === 1 ? '' : t === -1 ? "'" : '2')));
      } else out.push(m);
    }
    return out;
  }

  /* ==========================================================================
   * 3. 三阶（降阶后）模型：cp/co/ep/eo 平坦数组 + M 层偏移
   *    偏移量表由四阶引擎自动推导，保证两套模型完全一致
   * ========================================================================*/
  const S_LEN = 41;   // 0..7 cp, 8..15 co, 16..27 ep, 28..39 eo, 40 mOff
  const AXIS_OF = { U: 1, D: 1, R: 0, L: 0, M: 0, F: 2, B: 2 };
  const ORDER_OF = { U: 0, D: 1, R: 2, L: 3, M: 4, F: 5, B: 6 };

  function derive3(name) {
    const r = C.reduce(C.applySeq(C.solvedState(), name));
    if (!r) throw new Error('move breaks reduction: ' + name);
    const base = name.replace(/['2]$/, '');
    let mOff = 0;
    if (base === 'M') mOff = name === 'M' ? 1 : name === "M'" ? 3 : 2;
    return {
      name, base, axis: AXIS_OF[base], order: ORDER_OF[base],
      cp: Int8Array.from(r.cp), co: Int8Array.from(r.co),
      ep: Int8Array.from(r.ep), eo: Int8Array.from(r.eo), mOff
    };
  }
  const FACE3 = [];
  for (const f of ['U', 'D', 'R', 'L', 'F', 'B']) for (const s of ['', "'", '2']) FACE3.push(derive3(f + s));
  const MOVE3_M = [derive3('M'), derive3("M'"), derive3('M2')];
  const MOVE3_ALL = FACE3.concat(MOVE3_M);
  const M3_BY_NAME = new Map(MOVE3_ALL.map(m => [m.name, m]));

  function solved3() {
    const s = new Int8Array(S_LEN);
    for (let i = 0; i < 8; i++) { s[i] = i; s[8 + i] = 0; }
    for (let i = 0; i < 12; i++) { s[16 + i] = i; s[28 + i] = 0; }
    return s;
  }
  function state3From(st) {
    const r = C.reduce(st);
    if (!r) return null;
    const s = new Int8Array(S_LEN);
    for (let i = 0; i < 8; i++) { s[i] = r.cp[i]; s[8 + i] = r.co[i]; }
    for (let i = 0; i < 12; i++) { s[16 + i] = r.ep[i]; s[28 + i] = r.eo[i]; }
    s[40] = 0;
    return s;
  }
  function apply3(a, m, out) {
    for (let i = 0; i < 8; i++) { const s = m.cp[i]; out[i] = a[s]; out[8 + i] = (a[8 + s] + m.co[i]) % 3; }
    for (let i = 0; i < 12; i++) { const s = m.ep[i]; out[16 + i] = a[16 + s]; out[28 + i] = (a[28 + s] + m.eo[i]) & 1; }
    out[40] = (a[40] + m.mOff) & 3;
    return out;
  }
  function applySeq3(a, seq) {
    let cur = a.slice(), tmp = new Int8Array(S_LEN);
    for (const m of seq) { apply3(cur, m, tmp); const t = cur; cur = tmp; tmp = t; }
    return cur;
  }
  const isSolved3 = s => {
    for (let i = 0; i < 8; i++) if (s[i] !== i || s[8 + i] !== 0) return false;
    for (let i = 0; i < 12; i++) if (s[16 + i] !== i || s[28 + i] !== 0) return false;
    return s[40] === 0;
  };

  /* ==========================================================================
   * 4. 距离表（精确 BFS）—— 单块 / 块对 / 十字 / LSE
   * ========================================================================*/
  function pieceMaps(moves) {
    // cMap[mi][pos*3+ori] -> newPos*3+newOri ; eMap[mi][pos*2+ori] -> ...
    const cMap = [], eMap = [];
    for (const m of moves) {
      const dc = new Int8Array(8), de = new Int8Array(12);
      for (let i = 0; i < 8; i++) dc[m.cp[i]] = i;
      for (let i = 0; i < 12; i++) de[m.ep[i]] = i;
      const cm = new Uint8Array(24), em = new Uint8Array(24);
      for (let p = 0; p < 8; p++) for (let o = 0; o < 3; o++) { const d = dc[p]; cm[p * 3 + o] = d * 3 + (o + m.co[d]) % 3; }
      for (let p = 0; p < 12; p++) for (let o = 0; o < 2; o++) { const d = de[p]; em[p * 2 + o] = d * 2 + ((o + m.eo[d]) & 1); }
      cMap.push(cm); eMap.push(em);
    }
    return { cMap, eMap };
  }

  function bfs1(size, startIdx, step) {
    const dist = new Int8Array(size).fill(-1);
    dist[startIdx] = 0;
    let frontier = [startIdx], d = 0;
    while (frontier.length) {
      const next = [];
      for (const s of frontier) {
        step(s, t => { if (dist[t] < 0) { dist[t] = d + 1; next.push(t); } });
      }
      frontier = next; d++;
    }
    return dist;
  }

  function buildTables(moves) {
    const { cMap, eMap } = pieceMaps(moves);
    const nm = moves.length;
    const cornerDist = [], edgeDist = [];
    for (let t = 0; t < 8; t++) cornerDist.push(bfs1(24, t * 3, (s, push) => { for (let mi = 0; mi < nm; mi++) push(cMap[mi][s]); }));
    for (let t = 0; t < 12; t++) edgeDist.push(bfs1(24, t * 2, (s, push) => { for (let mi = 0; mi < nm; mi++) push(eMap[mi][s]); }));
    const pairDist = new Map();
    function pair(cSlot, eSlot) {
      const key = cSlot + ':' + eSlot;
      if (pairDist.has(key)) return pairDist.get(key);
      const d = bfs1(576, (cSlot * 3) * 24 + eSlot * 2, (s, push) => {
        const cs = (s / 24) | 0, es = s % 24;
        for (let mi = 0; mi < nm; mi++) push(cMap[mi][cs] * 24 + eMap[mi][es]);
      });
      pairDist.set(key, d);
      return d;
    }
    // 十字（4 条 D 层棱）精确距离表：24^4 = 331776
    let crossDist = null;
    function cross() {
      if (crossDist) return crossDist;
      const goal = ((4 * 2) * 24 + 5 * 2) * 576 + (6 * 2) * 24 + 7 * 2;
      crossDist = bfs1(331776, goal, (s, push) => {
        const a = (s / 13824) | 0, b = ((s / 576) | 0) % 24, c = ((s / 24) | 0) % 24, e = s % 24;
        for (let mi = 0; mi < nm; mi++) {
          const em = eMap[mi];
          push(em[a] * 13824 + em[b] * 576 + em[c] * 24 + em[e]);
        }
      });
      return crossDist;
    }
    return { cMap, eMap, cornerDist, edgeDist, pair, cross, moves };
  }

  let TAB_FACE = null;
  const tabFace = () => (TAB_FACE || (TAB_FACE = buildTables(FACE3)));

  /* ==========================================================================
   * 5. 子目标搜索：IDA*（精确、优先）+ 束搜索（兜底）
   * ========================================================================*/
  // req: {corners:[slot..], edges:[slot..], pairs:[[cSlot,eSlot]..], cross:bool}
  function makeGoal(req) {
    const cs = req.corners || [], es = req.edges || [], ps = req.pairs || [];
    return function (s) {
      for (const c of cs) if (s[c] !== c || s[8 + c] !== 0) return false;
      for (const e of es) if (s[16 + e] !== e || s[28 + e] !== 0) return false;
      for (const p of ps) {
        if (s[p[0]] !== p[0] || s[8 + p[0]] !== 0) return false;
        if (s[16 + p[1]] !== p[1] || s[28 + p[1]] !== 0) return false;
      }
      if (req.cross) for (let e = 4; e <= 7; e++) if (s[16 + e] !== e || s[28 + e] !== 0) return false;
      return true;
    };
  }
  function makeHeur(tab, req, sum) {
    const cs = req.corners || [], es = req.edges || [], ps = (req.pairs || []).map(p => [p[0], p[1], tab.pair(p[0], p[1])]);
    const crossTab = req.cross ? tab.cross() : null;
    const invC = new Int8Array(8), invE = new Int8Array(12);
    return function (s) {
      for (let i = 0; i < 8; i++) invC[s[i]] = i;
      for (let i = 0; i < 12; i++) invE[s[16 + i]] = i;
      let h = 0;
      const acc = sum ? (v => { h += v; }) : (v => { if (v > h) h = v; });
      for (const c of cs) { const p = invC[c]; acc(tab.cornerDist[c][p * 3 + s[8 + p]]); }
      for (const e of es) { const p = invE[e]; acc(tab.edgeDist[e][p * 2 + s[28 + p]]); }
      for (const pr of ps) {
        const pc = invC[pr[0]], pe = invE[pr[1]];
        acc(pr[2][(pc * 3 + s[8 + pc]) * 24 + pe * 2 + s[28 + pe]]);
      }
      if (crossTab) {
        const a = invE[4], b = invE[5], c = invE[6], d = invE[7];
        acc(crossTab[(a * 2 + s[28 + a]) * 13824 + (b * 2 + s[28 + b]) * 576 + (c * 2 + s[28 + c]) * 24 + d * 2 + s[28 + d]]);
      }
      return h;
    };
  }

  function idaSearch(start, moves, goal, heur, maxDepth, nodeBudget) {
    const stack = [];
    for (let i = 0; i <= maxDepth + 1; i++) stack.push(new Int8Array(S_LEN));
    stack[0].set(start);
    const path = new Array(maxDepth + 1);
    let nodes = 0, aborted = false;
    function dfs(depth, bound, prevBase, prevAxis) {
      const s = stack[depth];
      if (goal(s)) return depth;
      const h = heur(s);
      if (depth + h > bound) return -1;
      if (++nodes > nodeBudget) { aborted = true; return -1; }
      for (let mi = 0; mi < moves.length; mi++) {
        const m = moves[mi];
        if (m.base === prevBase) continue;
        if (m.axis === prevAxis && m.order < ORDER_OF[prevBase]) continue;
        apply3(s, m, stack[depth + 1]);
        path[depth] = m;
        const r = dfs(depth + 1, bound, m.base, m.axis);
        if (r >= 0) return r;
        if (aborted) return -1;
      }
      return -1;
    }
    for (let bound = heur(stack[0]); bound <= maxDepth; bound++) {
      const r = dfs(0, bound, '', -1);
      if (r >= 0) return path.slice(0, r);
      if (aborted) return null;
    }
    return null;   // 深度内无解 → 交给束搜索兜底（返回空数组会被误当成"已完成"）
  }

  // 三阶子目标束搜索兜底
  function beam3(start, moves, goal, cost, width, maxDepth) {
    let level = [{ s: start, mv: null, par: null }];
    if (goal(start)) return [];
    for (let d = 0; d < maxDepth; d++) {
      const cand = [];
      const seen = new Set();
      for (const node of level) {
        for (const m of moves) {
          if (node.mv && node.mv.base === m.base) continue;
          const ns = apply3(node.s, m, new Int8Array(S_LEN));
          const key = ns.join(',');
          if (seen.has(key)) continue;
          seen.add(key);
          const nn = { s: ns, mv: m, par: node };
          if (goal(ns)) { const out = []; let p = nn; while (p.mv) { out.unshift(p.mv); p = p.par; } return out; }
          cand.push({ node: nn, c: cost(ns) + Math.random() * 0.5 });
        }
      }
      if (!cand.length) return null;
      cand.sort((a, b) => a.c - b.c);
      level = cand.slice(0, width).map(x => x.node);
    }
    return null;
  }

  function solveSub(state, req, tab, opts) {
    opts = opts || {};
    const moves = opts.moves || tab.moves;
    const goal = makeGoal(req);
    if (goal(state)) return [];
    const h = makeHeur(tab, req, false);
    const r = idaSearch(state, moves, goal, h, opts.maxDepth || 12, opts.nodeBudget || 1.1e6);
    if (r) return r;
    const cost = makeHeur(tab, req, true);
    for (const w of [60, 250, 900]) {
      const b = beam3(state, moves, goal, cost, w, opts.beamDepth || 26);
      if (b) return b;
    }
    return null;
  }

  /* ==========================================================================
   * 6. 顶层公式阶段（OLL / PLL / CMLL）：公式集 + AUF 组合搜索
   * ========================================================================*/
  const ALGS = {
    // 顶层棱定向（2-look OLL 第一步）
    eoll: ["F R U R' U' F'", "F U R U' R' F'"],
    // 顶层角定向（Sune / Anti-Sune，纯外层公式，不破坏其余部分）
    coll: ["R U R' U R U2 R'", "R U2 R' U' R U' R'"],
    // 顶层角换位（T-perm / Y-perm）
    cp: ["R U R' U' R' F R2 U' R' U' R U R' F'",
      "F R U' R' U' R U R' F' R U R' U' R' F R F'"],
    // 顶层棱换位（Ua / Ub）
    ep: ["R U' R U R U R U' R' U' R2", "R2 U R U R' U' R' U' R' U R'"]
  };
  const AUF = ['', 'U', 'U2', "U'"];
  function seq3(str) { return str ? str.split(/\s+/).map(n => M3_BY_NAME.get(n)) : []; }
  const ALG_SEQ = {};
  for (const k in ALGS) ALG_SEQ[k] = ALGS[k].map(seq3);
  const AUF_SEQ = AUF.map(seq3);

  // 在 (AUF + 公式) 的组合空间内做有界搜索，直到满足 goalFn
  function algStage(state, algSets, goalFn, maxApply) {
    const opts = [];
    for (const set of algSets) for (const a of ALG_SEQ[set]) for (const u of AUF_SEQ) opts.push(u.concat(a));
    let frontier = [{ s: state, seq: [] }];
    if (goalFn(state)) return [];
    for (let d = 0; d < maxApply; d++) {
      const next = [];
      for (const node of frontier) {
        for (const o of opts) {
          const ns = applySeq3(node.s, o);
          const nseq = node.seq.concat(o);
          if (goalFn(ns)) return nseq;
          next.push({ s: ns, seq: nseq });
        }
      }
      frontier = next;
      if (frontier.length > 4000) frontier = frontier.slice(0, 4000);
    }
    return null;
  }
  function aufFix(state) {
    for (let u = 0; u < 4; u++) {
      const s = applySeq3(state, AUF_SEQ[u]);
      if (isSolved3(s)) return AUF_SEQ[u];
    }
    return null;
  }
  const existsAUF = (state, pred) => AUF_SEQ.some(u => pred(applySeq3(state, u)));

  /* ==========================================================================
   * 7. LSE（桥式最后六棱）—— <M,U> 群完全 BFS 距离表
   * ========================================================================*/
  const LSE_SLOTS = [0, 1, 2, 3, 5, 7];    // UR UF UL UB DF DB
  const LSE_LOCAL = new Int8Array(12).fill(-1);
  LSE_SLOTS.forEach((g, t) => { LSE_LOCAL[g] = t; });
  const LSE_MOVES = ['U', "U'", 'U2', 'M', "M'", 'M2'].map(n => M3_BY_NAME.get(n));
  const FACT = [1, 1, 2, 6, 24, 120, 720];
  function permIndex(p) {   // Lehmer code, 6 元
    let idx = 0;
    for (let i = 0; i < 6; i++) {
      let c = 0;
      for (let j = i + 1; j < 6; j++) if (p[j] < p[i]) c++;
      idx += c * FACT[5 - i];
    }
    return idx;
  }
  const LSE_SIZE = 720 * 64 * 4 * 4;
  const lseEnc = (p, o, mOff, cOff) => ((permIndex(p) * 64 + o) * 4 + mOff) * 4 + cOff;
  // 每个招式在 LSE 抽象空间的作用：src[t] / flip[t] / mOff / uTurn
  const LSE_ACT = LSE_MOVES.map(m => {
    const src = new Int8Array(6), flip = new Int8Array(6);
    for (let t = 0; t < 6; t++) {
      const g = LSE_SLOTS[t], sg = m.ep[g];
      if (LSE_LOCAL[sg] < 0) throw new Error('LSE slot escape: ' + m.name);
      src[t] = LSE_LOCAL[sg]; flip[t] = m.eo[g];
    }
    const uTurn = m.base === 'U' ? (m.name === 'U' ? 1 : m.name === "U'" ? 3 : 2) : 0;
    return { m, src, flip, mOff: m.mOff, uTurn };
  });
  let LSE_DIST = null;
  function lseTable() {
    if (LSE_DIST) return LSE_DIST;
    const dist = new Int8Array(LSE_SIZE).fill(-1);
    const p = new Int8Array(6), np = new Int8Array(6);
    const startP = Int8Array.from([0, 1, 2, 3, 4, 5]);
    const start = lseEnc(startP, 0, 0, 0);
    dist[start] = 0;
    let frontier = [start], d = 0;
    // 索引 -> (perm, o, mOff, cOff) 需要 perm 逆映射表
    const permList = [];
    (function gen(arr, used) {
      if (arr.length === 6) { permList[permIndex(arr)] = Int8Array.from(arr); return; }
      for (let v = 0; v < 6; v++) if (!used[v]) { used[v] = 1; arr.push(v); gen(arr, used); arr.pop(); used[v] = 0; }
    })([], new Uint8Array(6));
    while (frontier.length) {
      const next = [];
      for (const s of frontier) {
        const cOff = s & 3, mOff = (s >> 2) & 3, o = ((s >> 4) & 63), pi = (s / 1024) | 0;
        const pp = permList[pi];
        for (const act of LSE_ACT) {
          let no = 0;
          for (let t = 0; t < 6; t++) {
            const ts = act.src[t];
            np[t] = pp[ts];
            if (((o >> ts) & 1) ^ act.flip[t]) no |= 1 << t;
          }
          const ns = lseEnc(np, no, (mOff + act.mOff) & 3, (cOff - act.uTurn + 8) & 3);
          if (dist[ns] < 0) { dist[ns] = d + 1; next.push(ns); }
        }
      }
      frontier = next; d++;
    }
    LSE_DIST = dist;
    return dist;
  }
  function lseStateOf(s) {
    // 从三阶状态提取 LSE 抽象状态
    const p = new Int8Array(6);
    let o = 0;
    for (let t = 0; t < 6; t++) {
      const g = LSE_SLOTS[t], piece = s[16 + g];
      const lp = LSE_LOCAL[piece];
      if (lp < 0) return null;
      p[t] = lp;
      if (s[28 + g]) o |= 1 << t;
    }
    // 角块 AUF 偏移
    let cOff = -1;
    for (let u = 0; u < 4; u++) {
      const t = applySeq3(s, AUF_SEQ[u]);
      let good = true;
      for (let i = 0; i < 4; i++) if (t[i] !== i || t[8 + i] !== 0) { good = false; break; }
      if (good) { cOff = u; break; }
    }
    if (cOff < 0) return null;
    return { p, o, mOff: s[40] & 3, cOff, idx: lseEnc(p, o, s[40] & 3, cOff) };
  }
  function solveLSE(state) {
    const dist = lseTable();
    let cur = state.slice();
    const out = [];
    let ls = lseStateOf(cur);
    if (!ls) return null;
    let d = dist[ls.idx];
    if (d < 0) return null;
    let guard = 0;
    while (d > 0 && guard++ < 40) {
      let moved = false;
      for (const act of LSE_ACT) {
        const ns = apply3(cur, act.m, new Int8Array(S_LEN));
        const s2 = lseStateOf(ns);
        if (!s2) continue;
        const nd = dist[s2.idx];
        if (nd >= 0 && nd === d - 1) { out.push(act.m); cur = ns; d = nd; moved = true; break; }
      }
      if (!moved) return null;
    }
    return d === 0 ? out : null;
  }

  /* ==========================================================================
   * 8. 归约阶段代价函数（中心块 + 复合棱配对）
   * ========================================================================*/
  const PROJ_CEN = CEN;                                       // 只关心中心块
  const PROJ_RED = Int32Array.from([...CEN, ...WING_FID, ...WING_SEC_FID]);  // 中心块 + 棱片
  const PROJ_WING = Int32Array.from([...WING_FID, ...WING_SEC_FID]);          // 仅棱片（配对阶段中心块恒定）
  const centerCost = (buf, off) => centerDistSum(buf, off) * 4 + centerMis(buf, off);
  function pairCost(target) {
    return (buf, off) => {
      const u = nUnpaired(buf, off);
      return u > target ? (u - target) * 8 + wingDistSum(buf, off) : 0;
    };
  }
  // 收尾专用平滑代价：只用"每对棱片精确合并距离"，允许暂时拆散已配好的棱，
  // 从而越过"最后两组棱"的平台期陷阱（cost=0 ⟺ 12 组全部配对）
  const pairCostSmooth = (buf, off) => wingDistSum(buf, off) * 2 + nUnpaired(buf, off);
  // 带目标的平滑代价：收尾时先逐级把未配对数降下来，比一步冲到 0 便宜得多
  const pairCostSmoothT = target => (buf, off) => {
    const u = nUnpaired(buf, off);
    return u > target ? wingDistSum(buf, off) * 2 + u : 0;
  };

  /* ==========================================================================
   * 9. 主求解流程
   * ========================================================================*/
  const EDGE_NAME = C.EDGE_ORDER, CORNER_NAME = C.CORNER_ORDER;

  function solve(state, method, onProgress) {
    const t0 = Date.now();
    const steps = [];
    let st = Uint8Array.from(state);
    const report = (label, frac) => { if (onProgress) onProgress({ label, frac }); };

    let tLast = Date.now();
    function pushStep(phase, name, desc, seq) {
      const s = simplify(seq || []);
      st = C.applySeq(st, s);
      const now = Date.now();
      steps.push({ phase, name, desc, moves: s.map(m => m.name), ms: now - tLast });
      tLast = now;
      return s;
    }

    /* ---------- 阶段一 + 二：归约（中心块 + 复合棱配对）----------
     * 束搜索带随机抖动 ⇒ 同一状态每次跑出的轨迹不同。困难局面直接整段重启换轨迹，
     * 通常几百毫秒即可通过；最后一次尝试不设时限，靠"奇偶公式 / 打散重排 / 大宽度深搜"必定收敛。 */
    const PARITY_OLL = "2R2 B2 U2 2L U2 2R' U2 2R U2 F2 2R F2 2L' B2 2R2";
    const PARITY_PLL = "2R2 U2 2R2 Uw2 2R2 Uw2";
    const macros = macroMoves();
    const st0 = Uint8Array.from(st);
    const MAX_TRY = 8;
    for (let attempt = 0; attempt < MAX_TRY; attempt++) {
      const last = attempt === MAX_TRY - 1;
      const budget = last ? Infinity : 2600;
      st = Uint8Array.from(st0);
      steps.length = 0;
      // --- 中心块：每色精确 BFS 距离表 + 投影去重束搜索
      report('中心块归位', 0.05);
      const rc = beamSolveStage(st, centerCost,
        { widths: [1500, 2500, 6000], maxDepth: 30, proj: PROJ_CEN });
      if (!rc) continue;
      pushStep('归约', '中心块归位',
        '把 24 个中心块按颜色聚成 6 个 2×2 色块（每色 C(24,4) 完全 BFS 距离表 + 束搜索）', rc);
      if (C.centerErrors(st) !== 0) continue;

      // --- 复合棱配对：全部使用"保中心宏招式"，中心块全程不散
      const tPair = Date.now();
      const beamPair = (cost, w, d, ext) => beamSearch(st, ext ? macroMovesL2E() : macros, cost,
        { width: w, maxDepth: d, proj: PROJ_WING });
      let u = C.unpairedEdges(st), round = 0, parityUsed = false, kicks = 0, bigUsed = 0, dead = false;
      while (u > 0) {
        if (++round > 60 || Date.now() - tPair > budget) { dead = true; break; }
        report('复合棱配对', 0.15 + 0.3 * (1 - u / 12));
        let r = null, label = '复合棱配对 · 第 ' + round + ' 轮';
        if (u > 4) {           // 增量段：每轮少 2~3 组，很浅很快
          for (const step of [2, 3, 1]) {
            for (const w of [150, 600]) { r = beamPair(pairCost(Math.max(0, u - step)), w, 8, 0); if (r) break; }
            if (r) break;
          }
        } else {               // 收尾段：一次冲"全部配对"
          for (const [w, d, ext] of [[300, 7, 0], [200, 5, 1], [400, 8, 0]]) {
            r = beamPair(pairCostSmooth, w, d, ext); if (r) break;
          }
          if (!r && u > 2) {   // 便宜的"换局面"：只降 2 组，下一轮再冲（常常 1~2 毫秒）
            for (const [w, d, ext] of [[300, 6, 1], [300, 8, 0], [700, 7, 1]]) {
              r = beamPair(pairCostSmoothT(u - 2), w, d, ext); if (r) break;
            }
            if (r) label = '复合棱配对 · 第 ' + round + ' 轮（局面调整）';
          }
          if (!r && kicks >= 1 && bigUsed < (last ? 3 : 1)) {   // 有限次大宽度深搜兜底
            bigUsed++;
            for (const [w, d] of [[1200, 11], [2400, 13]]) { r = beamPair(pairCostSmooth, w, d, 0); if (r) break; }
          }
        }
        if (r) {
          pushStep('归约', label,
            '用 slice-flip-slice 型宏招式把成对棱片合成复合棱（中心块保持不散）', r);
          u = C.unpairedEdges(st);
          continue;
        }
        if (!parityUsed) {     // 四阶特有：最后两组棱的奇偶情形
          parityUsed = true;
          pushStep('奇偶', 'OLL 奇偶校正（配对期）',
            '最后两组棱遇到四阶特有奇偶：先用 15 步公式翻转一条复合棱，改变棱片置换奇偶性', C.parseSeq(PARITY_OLL));
          u = C.unpairedEdges(st);
          continue;
        }
        if (kicks++ < (last ? 24 : 4)) {
          const seq = [];
          const times = 2 + ((Math.random() * 3) | 0);
          for (let i = 0; i < times; i++) seq.push(...macros[(18 + Math.random() * (macros.length - 18)) | 0].seq);
          pushStep('归约', '复合棱配对 · 布局调整', '重新打散棱片布局，跳出局部困境后继续配对', seq);
          u = C.unpairedEdges(st);
          continue;
        }
        dead = true; break;
      }
      if (!dead && u === 0) break;
      if (last) throw new Error('复合棱配对失败');
    }
    if (C.unpairedEdges(st) !== 0 || C.centerErrors(st) !== 0) throw new Error('归约未完成');

    /* ---------- 阶段三：奇偶校正 ---------- */
    const parityOf = arr => { let p = 0; for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) if (arr[i] > arr[j]) p ^= 1; return p; };
    let red = C.reduce(st);
    let eoSum = 0; for (const v of red.eo) eoSum ^= v & 1;
    if (eoSum) {
      report('奇偶校正', 0.5);
      pushStep('奇偶', 'OLL 奇偶校正', '四阶特有：单条复合棱翻转，需用 15 步公式修正', C.parseSeq(PARITY_OLL));
      red = C.reduce(st);
    }
    if (parityOf(Array.from(red.cp)) !== parityOf(Array.from(red.ep))) {
      pushStep('奇偶', 'PLL 奇偶校正', '四阶特有：两条复合棱互换，需用 6 步公式修正', C.parseSeq(PARITY_PLL));
      red = C.reduce(st);
    }

    /* ---------- 阶段四：降阶为三阶后求解 ---------- */
    let s3 = state3From(st);
    if (!s3) throw new Error('降阶失败');
    const tab = tabFace();
    const emit = (phase, name, desc, seq3arr) => {
      if (!seq3arr) throw new Error('求解失败: ' + name);
      s3 = applySeq3(s3, seq3arr);
      pushStep(phase, name, desc, seq3arr.map(m => byName(m.name)));
    };
    const sub = (req, opts) => {
      const r = solveSub(s3, req, tab, opts);
      if (!r) throw new Error('子目标搜索失败');
      return r;
    };

    if (method === 'roux') {
      /* ================= 桥式 Roux ================= */
      report('桥式 · 第一块', 0.5);
      emit('Roux', '第一块 · 底棱 DL', 'FB：先把左下棱 DL 放好',
        sub({ edges: [6] }, { maxDepth: 9 }));
      emit('Roux', '第一块 · 前对 DLF+FL', 'FB：组好前左角棱对并插入',
        sub({ edges: [6], pairs: [[5, 9]] }, { maxDepth: 11 }));
      emit('Roux', '第一块 · 后对 DBL+BL', 'FB：组好后左角棱对，完成 1×2×3 第一块',
        sub({ edges: [6], pairs: [[5, 9], [6, 10]] }, { maxDepth: 12 }));
      report('桥式 · 第二块', 0.65);
      emit('Roux', '第二块 · 底棱 DR', 'SB：把右下棱 DR 放好（保持第一块）',
        sub({ edges: [6, 4], pairs: [[5, 9], [6, 10]] }, { maxDepth: 12 }));
      emit('Roux', '第二块 · 前对 DFR+FR', 'SB：组好前右角棱对并插入',
        sub({ edges: [6, 4], pairs: [[5, 9], [6, 10], [4, 8]] }, { maxDepth: 12 }));
      emit('Roux', '第二块 · 后对 DRB+BR', 'SB：完成右侧 1×2×3 第二块',
        sub({ edges: [6, 4], pairs: [[5, 9], [6, 10], [4, 8], [7, 11]] }, { maxDepth: 13 }));
      report('桥式 · CMLL', 0.8);
      emit('Roux', 'CMLL · 角块定向', '只处理顶层四个角：先全部翻正（Sune 家族）',
        algStage(s3, ['coll'], s => s[8] === 0 && s[9] === 0 && s[10] === 0 && s[11] === 0, 3));
      emit('Roux', 'CMLL · 角块归位', '顶层四角换位到正确位置（允许最后 AUF）',
        algStage(s3, ['cp'], s => existsAUF(s, t => t[0] === 0 && t[1] === 1 && t[2] === 2 && t[3] === 3 &&
          t[8] === 0 && t[9] === 0 && t[10] === 0 && t[11] === 0), 3));
      report('桥式 · LSE', 0.9);
      emit('Roux', 'LSE · 最后六棱', 'M/U 两层搞定最后六条棱（含 EOLR 与中层归位），已由完全 BFS 求最短解',
        solveLSE(s3));
    } else {
      /* ================= CFOP ================= */
      report('CFOP · 十字', 0.5);
      emit('CFOP', '底层十字 Cross', '把 D 层四条棱归位形成十字（BFS 精确最短解）',
        sub({ cross: true }, { maxDepth: 9 }));
      const F2L = [[4, 8, '右前'], [5, 9, '左前'], [6, 10, '左后'], [7, 11, '右后']];
      const done = [];
      F2L.forEach((p, i) => {
        report('CFOP · F2L ' + (i + 1), 0.55 + i * 0.06);
        done.push([p[0], p[1]]);
        emit('CFOP', 'F2L 第' + (i + 1) + '组 · ' + p[2], '角块 ' + CORNER_NAME[p[0]] + ' 与棱块 ' + EDGE_NAME[p[1]] + ' 配对并插入底层',
          sub({ cross: true, pairs: done.map(x => x.slice()) }, { maxDepth: 13 }));
      });
      report('CFOP · OLL', 0.82);
      emit('CFOP', 'OLL · 棱块朝向', '顶层十字：让四条顶棱朝上（2-look OLL 第一步）',
        algStage(s3, ['eoll'], s => s[28] === 0 && s[29] === 0 && s[30] === 0 && s[31] === 0, 3));
      emit('CFOP', 'OLL · 角块朝向', '顶层全黄：四个顶角翻正（2-look OLL 第二步）',
        algStage(s3, ['coll'], s => s[8] === 0 && s[9] === 0 && s[10] === 0 && s[11] === 0, 3));
      report('CFOP · PLL', 0.9);
      emit('CFOP', 'PLL · 角块归位', '顶层四角换位（2-look PLL 第一步）',
        algStage(s3, ['cp'], s => existsAUF(s, t => t[0] === 0 && t[1] === 1 && t[2] === 2 && t[3] === 3), 3));
      emit('CFOP', 'PLL · 棱块归位', '顶层四棱换位，魔方复原（2-look PLL 第二步）',
        algStage(s3, ['ep'], s => existsAUF(s, isSolved3), 3));
      const auf = aufFix(s3);
      if (auf && auf.length) emit('CFOP', 'AUF 顶层对齐', '最后转动顶层对齐颜色', auf);
    }

    if (!C.isSolved(st)) throw new Error('求解结果校验失败');
    const moves = [];
    for (const s of steps) moves.push(...s.moves);
    return { method, steps: steps.filter(s => s.moves.length), moves, ms: Date.now() - t0 };
  }

  return {
    solve, simplify, beamSearch, beamSolveStage,
    // 供测试使用
    _internal: {
      macroMoves, macroMovesL2E, composePerm, ATOM,
      state3From, apply3, applySeq3, solved3, isSolved3, MOVE3_ALL, M3_BY_NAME,
      buildTables, tabFace, solveSub, solveLSE, lseTable, algStage, derive3, S_LEN,
      centerCost, pairCost, pairCostSmooth, pairCostSmoothT, PROJ_CEN, PROJ_WING, PROJ_RED, centerDistSum, wingDistSum, centerMis,
      colorTables, wingPairTable, nUnpaired
    }
  };
});
