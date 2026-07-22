window.SCP = window.SCP || {};
(function (S) {
  S.DIRS = {
    n: { dc: 0, dr: 1, opp: 's' },
    s: { dc: 0, dr: -1, opp: 'n' },
    e: { dc: 1, dr: 0, opp: 'w' },
    w: { dc: -1, dr: 0, opp: 'e' }
  };
  S.key = (c, r) => c + ',' + r;
  S.zoneOf = function (r) {
    if (r <= 6) return 'LCZ';
    if (r === 7) return 'CPA';
    if (r <= 14) return 'HCZ';
    if (r === 15) return 'CPB';
    if (r <= 22) return 'EZ';
    return 'GATE';
  };
  S.zoneLabel = {
    LCZ: '轻收容区 LIGHT CONTAINMENT',
    CPA: '检查点 A — CHECKPOINT',
    HCZ: '重收容区 HEAVY CONTAINMENT',
    CPB: '检查点 B — CHECKPOINT',
    EZ: '入口区 ENTRANCE ZONE',
    GATE: 'B 大门 GATE B'
  };

  function makeCell(c, r) {
    return {
      c, r, zone: S.zoneOf(r),
      open: { n: false, s: false, e: false, w: false },
      doors: { n: null, s: null, e: null, w: null },
      special: null, visited: false, items: []
    };
  }

  function genOnce(seedStr) {
    const rng = S.makeRng(seedStr);
    const cells = new Map();
    const get = (c, r) => cells.get(S.key(c, r));
    const zones = [
      { name: 'LCZ', r0: 0, r1: 6, entry: [4, 1] },
      { name: 'HCZ', r0: 8, r1: 14, entry: [4, 8] },
      { name: 'EZ', r0: 16, r1: 22, entry: [4, 16] }
    ];
    for (const z of zones)
      for (let r = z.r0; r <= z.r1; r++)
        for (let c = 0; c < 9; c++)
          cells.set(S.key(c, r), makeCell(c, r));
    cells.set(S.key(4, 7), makeCell(4, 7));
    cells.set(S.key(4, 15), makeCell(4, 15));
    cells.set(S.key(4, 23), makeCell(4, 23));

    function link(a, b) {
      for (const d in S.DIRS) {
        const dd = S.DIRS[d];
        if (a.c + dd.dc === b.c && a.r + dd.dr === b.r) {
          a.open[d] = true; b.open[dd.opp] = true;
          return;
        }
      }
    }
    function unlink(a, b) {
      for (const d in S.DIRS) {
        const dd = S.DIRS[d];
        if (a.c + dd.dc === b.c && a.r + dd.dr === b.r) {
          a.open[d] = false; b.open[dd.opp] = false;
          return;
        }
      }
    }

    for (const z of zones) {
      const inZone = (c, r) => c >= 0 && c < 9 && r >= z.r0 && r <= z.r1 && !(z.name === 'LCZ' && c === 4 && r === 0);
      const start = get(z.entry[0], z.entry[1]);
      const stack = [start];
      const seen = new Set([S.key(start.c, start.r)]);
      while (stack.length) {
        const cur = stack[stack.length - 1];
        const opts = [];
        for (const d in S.DIRS) {
          const dd = S.DIRS[d];
          const nc = cur.c + dd.dc, nr = cur.r + dd.dr;
          if (inZone(nc, nr) && !seen.has(S.key(nc, nr))) opts.push(get(nc, nr));
        }
        if (!opts.length) { stack.pop(); continue; }
        const nxt = rng.pick(opts);
        link(cur, nxt);
        seen.add(S.key(nxt.c, nxt.r));
        stack.push(nxt);
      }
      const extra = Math.floor(seen.size * 0.16);
      let tries = 0, added = 0;
      while (added < extra && tries < 400) {
        tries++;
        const c = rng.int(0, 8), r = rng.int(z.r0, z.r1);
        if (!inZone(c, r)) continue;
        const a = get(c, r);
        const d = rng.pick(['n', 's', 'e', 'w']);
        const dd = S.DIRS[d];
        if (!inZone(c + dd.dc, r + dd.dr)) continue;
        if (a.open[d]) continue;
        link(a, get(c + dd.dc, r + dd.dr));
        added++;
      }
    }

    link(get(4, 0), get(4, 1));
    link(get(4, 6), get(4, 7)); link(get(4, 7), get(4, 8));
    link(get(4, 14), get(4, 15)); link(get(4, 15), get(4, 16));
    link(get(4, 22), get(4, 23));

    const doors = [];
    let doorId = 0;
    function addDoor(cell, side, opts) {
      const dd = S.DIRS[side];
      const other = get(cell.c + dd.dc, cell.r + dd.dr);
      if (!other || cell.doors[side]) return null;
      const door = Object.assign({
        id: doorId++, c: cell.c, r: cell.r, side,
        level: 0, checkpoint: false, big: false, locked: false,
        open: false, amount: 0, broken: false
      }, opts || {});
      doors.push(door);
      cell.doors[side] = door;
      other.doors[dd.opp] = door;
      return door;
    }

    get(4, 0).special = { type: 'chamber173' };
    addDoor(get(4, 0), 'n', { big: true, locked: true, level: 0 });
    addDoor(get(4, 7), 's', { big: true, checkpoint: true, level: 2 });
    addDoor(get(4, 7), 'n', { big: true, checkpoint: true, level: 0 });
    addDoor(get(4, 15), 's', { big: true, checkpoint: true, level: 3 });
    addDoor(get(4, 15), 'n', { big: true, checkpoint: true, level: 0 });
    addDoor(get(4, 23), 's', { big: true, checkpoint: true, level: 4 });
    get(4, 7).special = { type: 'checkpoint', label: 'A' };
    get(4, 15).special = { type: 'checkpoint', label: 'B', tesla: true };
    get(4, 23).special = { type: 'gateB' };

    function opensCount(cell) {
      let n = 0;
      for (const d in S.DIRS) if (cell.open[d]) n++;
      return n;
    }
    function endroomsOf(zone) {
      const out = [];
      for (const cell of cells.values())
        if (cell.zone === zone && !cell.special && opensCount(cell) === 1) out.push(cell);
      return rng.shuffle(out);
    }
    function corridorsOf(zone) {
      const out = [];
      for (const cell of cells.values()) {
        if (cell.zone !== zone || cell.special) continue;
        if (cell.open.n && cell.open.s && !cell.open.e && !cell.open.w) out.push(cell);
        else if (cell.open.e && cell.open.w && !cell.open.n && !cell.open.s) out.push(cell);
      }
      return rng.shuffle(out);
    }
    function anyFree(zone) {
      const out = [];
      for (const cell of cells.values())
        if (cell.zone === zone && !cell.special) out.push(cell);
      return rng.shuffle(out);
    }
    function place(zone, type, doorLevel, fromEnd) {
      let pool = fromEnd ? endroomsOf(zone) : corridorsOf(zone);
      if (!pool.length) pool = anyFree(zone);
      const cell = pool[0];
      if (!cell) return null;
      cell.special = { type };
      if (fromEnd && doorLevel !== null) {
        for (const d in S.DIRS) {
          if (cell.open[d] && !cell.doors[d]) {
            addDoor(cell, d, { level: doorLevel });
            break;
          }
        }
      }
      return cell;
    }

    place('LCZ', 'storage', 0, true);
    place('LCZ', 'room914', 1, true);
    place('LCZ', 'office2', 1, true);
    place('LCZ', 'medbay', 0, true);
    place('LCZ', 'gasCorridor', null, false);
    place('HCZ', 'server', 2, true);
    place('HCZ', 'chamber106', 2, true);
    place('HCZ', 'armory', 2, true);
    place('HCZ', 'corridor096', null, false);
    place('EZ', 'office4', 3, true);
    place('EZ', 'medbay2', 0, true);
    place('EZ', 'lobby', 0, true);

    for (const cell of cells.values()) {
      if (cell.special || cell.zone === 'CPA' || cell.zone === 'CPB' || cell.zone === 'GATE') continue;
      for (const d of ['n', 'e']) {
        if (!cell.open[d] || cell.doors[d]) continue;
        const dd = S.DIRS[d];
        const other = get(cell.c + dd.dc, cell.r + dd.dr);
        if (!other || other.special) continue;
        if (rng.chance(0.38)) addDoor(cell, d, { level: 0 });
      }
    }

    const scatterTable = {
      LCZ: [['battery', 0.10], ['doc_brief', 0.05], ['eyedrops', 0.07], ['firstaid', 0.05], ['doc173', 0.05]],
      HCZ: [['battery', 0.08], ['firstaid', 0.07], ['eyedrops', 0.06], ['doc106', 0.05], ['keycard2', 0.03]],
      EZ: [['firstaid', 0.07], ['eyedrops', 0.05], ['doc_ez', 0.06], ['battery', 0.06], ['keycard3', 0.03]]
    };
    for (const cell of cells.values()) {
      if (cell.special) continue;
      const table = scatterTable[cell.zone];
      if (!table) continue;
      for (const [id, p] of table) {
        if (rng.chance(p)) {
          cell.items.push({ id, dx: rng.range(-2.2, 2.2), dz: rng.range(-2.2, 2.2) });
          break;
        }
      }
    }

    return { seed: seedStr, cells, doors, get, start: { c: 4, r: 0 } };
  }

  S.checkSolvable = function (L) {
    const cardAt = {
      storage: 1, office2: 2, server: 3, office4: 4
    };
    let have = 0;
    for (let pass = 0; pass < 8; pass++) {
      const seen = new Set();
      const q = [[4, 0]];
      seen.add(S.key(4, 0));
      let gained = false, reachedGate = false;
      while (q.length) {
        const [c, r] = q.shift();
        const cell = L.get(c, r);
        if (!cell) continue;
        if (cell.special && cardAt[cell.special.type]) {
          const lvl = cardAt[cell.special.type];
          if (lvl > have) { have = lvl; gained = true; }
        }
        if (cell.special && cell.special.type === 'gateB') reachedGate = true;
        for (const d in S.DIRS) {
          if (!cell.open[d]) continue;
          const door = cell.doors[d];
          if (door && door.level > have && !(door.c === 4 && door.r === 0)) continue;
          const dd = S.DIRS[d];
          const k = S.key(c + dd.dc, r + dd.dr);
          if (!seen.has(k) && L.get(c + dd.dc, r + dd.dr)) {
            seen.add(k);
            q.push([c + dd.dc, r + dd.dr]);
          }
        }
      }
      if (reachedGate && have >= 4) return true;
      if (!gained) return false;
    }
    return false;
  };

  S.genLayout = function (seedStr) {
    for (let i = 0; i < 30; i++) {
      const L = genOnce(seedStr + (i ? '#' + i : ''));
      if (S.checkSolvable(L)) return L;
    }
    return genOnce(seedStr + '#fallback');
  };

  S.findPath = function (L, from, to, passFn) {
    const startK = S.key(from.c, from.r);
    const goalK = S.key(to.c, to.r);
    if (startK === goalK) return [from];
    const prev = new Map();
    const q = [from];
    prev.set(startK, null);
    while (q.length) {
      const cur = q.shift();
      for (const d in S.DIRS) {
        if (!cur.open[d]) continue;
        const door = cur.doors[d];
        if (door && passFn && !passFn(door)) continue;
        const dd = S.DIRS[d];
        const nxt = L.get(cur.c + dd.dc, cur.r + dd.dr);
        if (!nxt) continue;
        const k = S.key(nxt.c, nxt.r);
        if (prev.has(k)) continue;
        prev.set(k, cur);
        if (k === goalK) {
          const path = [nxt];
          let p = cur;
          while (p) { path.unshift(p); p = prev.get(S.key(p.c, p.r)); }
          return path;
        }
        q.push(nxt);
      }
    }
    return null;
  };

  S.losClear = function (L, x1, z1, x2, z2, doorMin) {
    const dist = Math.hypot(x2 - x1, z2 - z1);
    const steps = Math.max(2, Math.ceil(dist / 0.4));
    let pc = S.colOf(x1), pr = S.rowOf(z1);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = x1 + (x2 - x1) * t;
      const z = z1 + (z2 - z1) * t;
      const c = S.colOf(x), r = S.rowOf(z);
      if (c !== pc || r !== pr) {
        const a = L.get(pc, pr);
        if (!a) return false;
        let moved = false;
        for (const d in S.DIRS) {
          const dd = S.DIRS[d];
          if (pc + dd.dc === c && pr + dd.dr === r) {
            if (!a.open[d]) return false;
            const door = a.doors[d];
            if (door && door.amount < (doorMin === undefined ? 0.25 : doorMin)) return false;
            moved = true;
            break;
          }
        }
        if (!moved) return false;
        pc = c; pr = r;
      }
      const cell = L.get(pc, pr);
      if (!cell) return false;
      const lx = x - S.worldX(pc), lz = z - S.worldZ(pr);
      const H = S.CELL / 2;
      if (Math.abs(lx) > H - 0.25 || Math.abs(lz) > H - 0.25) {
        let nearOpening = false;
        if (Math.abs(lz) > H - 0.25) {
          const d = lz < 0 ? 'n' : 's';
          if (cell.open[d] && Math.abs(lx) < 1.6) nearOpening = true;
        }
        if (Math.abs(lx) > H - 0.25) {
          const d = lx > 0 ? 'e' : 'w';
          if (cell.open[d] && Math.abs(lz) < 1.6) nearOpening = true;
        }
        if (!nearOpening) return false;
      }
    }
    return true;
  };
})(window.SCP);
