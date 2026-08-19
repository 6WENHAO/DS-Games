/* =============================================================
   layout.js — the town plan.

   Nothing here is hand-positioned by trial and error: a small
   placement engine checks flatness, street corridors, the stream
   and previously-placed footprints, so districts can be described
   by intent ("a row of shops facing the main street") and the
   engine finds legal ground.

   Districts, from the water up:
     harbour (1.75) · fairground (3.0) · town (4.4)
     terrace (8.6) · knoll (10.9) · hilltop (13.8)
   ============================================================= */
(function (global) {
  'use strict';
  const T = global.THREE;
  const TOWN = global.TOWN;
  const U = TOWN.U, Geo = TOWN.Geo, Mat = TOWN.Mat, P = TOWN.Palette;
  const Island = TOWN.Island, Roads = TOWN.Roads;

  const L = TOWN.Layout = {};
  const TIERS = Island.TIERS;

  // module handles — every use is guarded so a missing module degrades
  const H = () => TOWN.BuildingsHome || {};
  const C = () => TOWN.BuildingsCivic || {};
  const N = () => TOWN.Nature || {};
  const PR = () => TOWN.Props || {};
  const D = () => TOWN.Dynamics || {};
  const FX = () => TOWN.FX || {};
  const has = (mod, fn) => typeof mod()[fn] === 'function';

  let rng = U.rng(20250819);

  /**
   * The island's flat plateaux are the scarce resource. Trimming every
   * building to 0.82 and vegetation to 0.88 buys ~40 % more usable plot
   * area, which reads as a finer-grained miniature rather than a
   * half-empty one. Applied once, by wrapping the asset factories, so
   * every code path (frontage, infill, landmarks) stays consistent.
   */
  const BUILDING_SCALE = 0.82;
  const NATURE_SCALE = 0.88;
  let scaled = false;
  function applyScales() {
    if (scaled) return;
    scaled = true;
    const wrap = (mod, k, factor, skip) => {
      if (!mod) return;
      for (const key in mod) {
        if (typeof mod[key] !== 'function') continue;
        if (key === 'demo' || key === 'sway' || key === 'variants' || key === 'stats') continue;
        if (skip && skip.test(key)) continue;
        const orig = mod[key];
        mod[key] = function (o) {
          const g = orig.call(mod, o);
          return (g && g.isObject3D) ? fit(g, factor) : g;
        };
      }
    };
    wrap(TOWN.BuildingsHome, null, BUILDING_SCALE);
    wrap(TOWN.BuildingsCivic, null, BUILDING_SCALE);
    // vegetation only: leave anything taking absolute world points alone
    wrap(TOWN.Nature, null, NATURE_SCALE, /^(ivy)$/);
  }
  const stats = L.stats = { placed: 0, rejected: 0, byKind: {}, groups: {}, why: {}, whyF: {} };
  function why(bag, k) { bag[k] = (bag[k] || 0) + 1; }

  /* ============================================================
     1 · PLACEMENT ENGINE
     ============================================================ */
  const taken = [];          // {x,z,w,d,rot,r,name}

  function rectRadius(w, d) { return Math.hypot(w, d) * 0.5; }

  /**
   * Oriented-box overlap (separating-axis test) in the SAME frame three.js
   * uses for a Y rotation: local +X maps to (cos, -sin) and local +Z to
   * (sin, cos) in the XZ plane. Getting this convention wrong silently
   * mis-tests every rotated footprint.
   */
  function axesOf(rot) {
    const c = Math.cos(rot), s = Math.sin(rot);
    return [[c, -s], [s, c]];
  }
  function obbOverlap(a, b, pad) {
    pad = pad || 0;
    const dx = b.x - a.x, dz = b.z - a.z;
    if (dx * dx + dz * dz > (a.r + b.r + pad) * (a.r + b.r + pad)) return false;
    const A = axesOf(a.rot), B = axesOf(b.rot);
    const axes = [A[0], A[1], B[0], B[1]];
    const aw = a.w / 2 + pad / 2, ad = a.d / 2 + pad / 2;
    const bw = b.w / 2, bd = b.d / 2;
    for (let k = 0; k < 4; k++) {
      const ax = axes[k];
      const ea = Math.abs(ax[0] * A[0][0] + ax[1] * A[0][1]) * aw +
                 Math.abs(ax[0] * A[1][0] + ax[1] * A[1][1]) * ad;
      const eb = Math.abs(ax[0] * B[0][0] + ax[1] * B[0][1]) * bw +
                 Math.abs(ax[0] * B[1][0] + ax[1] * B[1][1]) * bd;
      if (Math.abs(dx * ax[0] + dz * ax[1]) > ea + eb) return false;
    }
    return true;
  }

  /**
   * Road corridors as a chain of oriented boxes. Testing the building's real
   * footprint against these is far more accurate than a centre-point distance:
   * a narrow house can sit beside a cross-street that a radius test would veto.
   */
  let roadBoxes = [];
  function buildRoadBoxes() {
    roadBoxes = [];
    const cs = (Roads && Roads.corridors) || [];
    for (const c of cs) {
      if (!(c.halfW > 0.05) || !c.pts || c.pts.length < 2) continue;
      const step = 4;
      for (let i = 0; i < c.pts.length - 1; i += step) {
        const a = c.pts[i], b = c.pts[Math.min(c.pts.length - 1, i + step)];
        const dx = b[0] - a[0], dz = b[2] - a[2];
        const len = Math.hypot(dx, dz);
        if (len < 0.05) continue;
        roadBoxes.push({
          x: (a[0] + b[0]) / 2, z: (a[2] + b[2]) / 2,
          w: len + 0.2, d: c.halfW * 2, rot: Math.atan2(-dz, dx),
          r: Math.hypot(len, c.halfW * 2) / 2, name: c.name || 'road',
        });
      }
    }
    L.roadBoxes = roadBoxes;
  }

  /** hitsRoad(cand, pad) -> road name that the footprint intrudes on, or null */
  function hitsRoad(cand, pad) {
    for (let i = 0; i < roadBoxes.length; i++) {
      if (obbOverlap(roadBoxes[i], cand, pad || 0)) return roadBoxes[i].name;
    }
    return null;
  }

  function streamClearance(x, z) { return Island.sdLine(x, z, Island.STREAM) - 2.0; }

  /** the brook, as boxes, so only footprints that truly cross it are refused */
  let streamBoxes = [];
  function buildStreamBoxes() {
    streamBoxes = [];
    const pts = Island.STREAM;
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i][0], az = pts[i][1], bx = pts[i + 1][0], bz = pts[i + 1][1];
      const dx = bx - ax, dz = bz - az;
      const len = Math.hypot(dx, dz);
      if (len < 0.05) continue;
      streamBoxes.push({ x: (ax + bx) / 2, z: (az + bz) / 2, w: len, d: 4.4,
        rot: Math.atan2(-dz, dx), r: Math.hypot(len, 4.4) / 2, name: 'brook' });
    }
  }
  function hitsStream(cand, pad) {
    for (let i = 0; i < streamBoxes.length; i++) {
      if (obbOverlap(streamBoxes[i], cand, pad || 0)) return true;
    }
    return false;
  }

  /**
   * site(w, d, opts) -> {x, z, y, rot} | null
   * opts: {near:[x,z], spread, rot, rotJitter, tries, tier, minRoad, maxSpread,
   *        allowSlope, keepStream, pad, name}
   */
  function site(w, d, opts) {
    opts = opts || {};
    const near = opts.near || [0, 0];
    const spread = opts.spread === undefined ? 6 : opts.spread;
    const tries = opts.tries || 40;
    const pad = opts.pad === undefined ? 1.0 : opts.pad;
    const minRoad = opts.minRoad === undefined ? 0.35 : opts.minRoad;
    const r = rectRadius(w, d);

    for (let i = 0; i < tries; i++) {
      const t = i / tries;
      const ang = rng() * U.TAU;
      const rad = spread * Math.pow(rng(), 0.62) * (0.15 + t);
      const x = near[0] + Math.cos(ang) * rad;
      const z = near[1] + Math.sin(ang) * rad;
      let rot = opts.rot === undefined ? rng() * U.TAU : opts.rot;
      if (opts.rotJitter) rot += rng.bell() * opts.rotJitter;

      const s = Island.sample(x, z);
      if (!s.land || s.y < (opts.minY === undefined ? 0.9 : opts.minY)) { why(stats.why, 'water'); continue; }
      if (opts.tier !== undefined && Math.abs(s.y - opts.tier) > (opts.tierTol || 1.3)) { why(stats.why, 'tier'); continue; }

      const fs = Island.flatSpot(x, z, w, d, rot);
      if (!opts.allowSlope && fs.spread > (opts.maxSpread || 0.8)) { why(stats.why, 'slope'); continue; }
      const cand = { x, z, w, d, rot, r, name: opts.name || '?' };
      if (opts.onRoad !== true && hitsRoad(cand, minRoad)) { why(stats.why, 'road'); continue; }
      if (opts.keepStream !== false && hitsStream(cand, 0.3)) { why(stats.why, 'stream'); continue; }
      let hit = false;
      for (const o of taken) { if (obbOverlap(o, cand, pad)) { hit = true; break; } }
      if (hit) { why(stats.why, 'overlap'); continue; }

      taken.push(cand);
      return { x, z, y: fs.y, rot };
    }
    stats.rejected++;
    return null;
  }
  L.site = site;


  /**
   * faceRoad(x, z) -> {rot, dist} — the rotation that turns a building's
   * front (+Z) toward the nearest street. Infill buildings that all face
   * their nearest road read as a coherent town rather than scattered boxes.
   */
  function faceRoad(x, z) {
    let best = Infinity, bx = 0, bz = 0;
    const cs = (Roads && Roads.corridors) || [];
    for (const c of cs) {
      const pts = c.pts;
      if (!pts || pts.length < 2) continue;
      for (let i = 0; i < pts.length - 1; i += 2) {
        const ax = pts[i][0], az = pts[i][2];
        const ex = pts[i + 1][0] - ax, ez = pts[i + 1][2] - az;
        const l2 = ex * ex + ez * ez;
        let t = l2 > 1e-9 ? ((x - ax) * ex + (z - az) * ez) / l2 : 0;
        t = U.clamp(t, 0, 1);
        const px = ax + ex * t, pz = az + ez * t;
        const d = Math.hypot(x - px, z - pz);
        if (d < best) { best = d; bx = px; bz = pz; }
      }
    }
    if (!isFinite(best)) return { rot: rng() * U.TAU, dist: Infinity };
    let tx = bx - x, tz = bz - z;
    const l = Math.hypot(tx, tz);
    if (l < 1e-4) return { rot: rng() * U.TAU, dist: best };
    tx /= l; tz /= l;
    return { rot: Math.atan2(tx, tz), dist: best };
  }
  L.faceRoad = faceRoad;

  /**
   * fit(group, k) — uniformly scale an object and keep its reported
   * footprint/height truthful, so the placement engine still reasons
   * correctly. Used to bring a few oversized landmarks into scale with
   * the plots the town plan actually offers.
   */
  function fit(g, k) {
    if (!g || !(k > 0) || k === 1) return g;
    g.scale.setScalar(k);
    const fp = g.userData.footprint;
    if (fp) { fp.w *= k; fp.d *= k; }
    if (g.userData.height) g.userData.height *= k;
    return g;
  }
  L.fit = fit;

  /** claim(x,z,w,d,rot) — reserve ground without placing anything */
  function claim(x, z, w, d, rot, name) {
    taken.push({ x, z, w, d, rot: rot || 0, r: rectRadius(w, d), name: name || 'claim' });
  }
  L.claim = claim;

  /**
   * plinth(g, fp, drop) — tuck a battered stone base under a building so it
   * can stand on sloping ground without appearing to sink. This is what
   * unlocks the terrace flanks for building, and it looks right: hill towns
   * are full of houses riding on masonry bases.
   */
  const plinthMat = () => Mat.std(P.stoneDark, { rough: 0.9, flat: true, name: 'plinth' });
  function plinth(g, fp, drop) {
    if (!(drop > 0.12)) return;
    const h = drop + 0.35;
    const geo = Geo.taperBox(fp.w * 0.99, h, fp.d * 0.99, 1.06, 1.06);
    const m = new T.Mesh(geo, plinthMat());
    m.position.y = -h + 0.06;
    m.castShadow = true; m.receiveShadow = true;
    m.userData.keep = true;
    g.add(m);
  }

  /** put(group, x, z, y, rot, parent) */
  function put(g, x, z, y, rot, parent) {
    g.position.set(x, y, z);
    g.rotation.y = rot || 0;
    g.userData.keep = true;
    (parent || L.root).add(g);
    stats.placed++;
    const k = g.userData.kind || 'other';
    stats.byKind[k] = (stats.byKind[k] || 0) + 1;
    return g;
  }

  /**
   * build a factory and place it near a target.
   * spec: {make:fn, opts:{}, near, spread, rot, rotJitter, tier, parent, pad, ...}
   */
  function drop(spec) {
    if (typeof spec.make !== 'function') return null;
    let g;
    try { g = spec.make(spec.opts || { seed: rng.int(1, 99999) }); }
    catch (e) { console.warn('[layout] factory failed', e); return null; }
    if (!g) return null;
    if (spec.scale) fit(g, spec.scale);
    const fp = g.userData.footprint || { w: 6, d: 6 };
    const s = site(fp.w, fp.d, spec);
    if (!s) return null;
    if (spec.plinth !== false) {
      const fs = Island.flatSpot(s.x, s.z, fp.w, fp.d, s.rot);
      if (fs.spread > 0.2) {
        const by = fs.lowest + Math.min(0.3, fs.spread * 0.35);
        plinth(g, fp, by - fs.lowest + 0.3);
        return put(g, s.x, s.z, by + (spec.lift || 0), s.rot, spec.parent);
      }
    }
    return put(g, s.x, s.z, s.y + (spec.lift || 0), s.rot, spec.parent);
  }
  L.drop = drop;

  /* ------------------------------------------------------------
     frontage() — lay a continuous street frontage.
     Walks a road corridor and lines buildings up facing it, which
     is what turns scattered houses into a street.
     ------------------------------------------------------------ */
  function frontage(pathPts, opts) {
    opts = opts || {};
    const side = opts.side || 1;
    const setback = opts.setback === undefined ? 2.6 : opts.setback;
    const gap = opts.gap === undefined ? 0.9 : opts.gap;
    const from = opts.from === undefined ? 0 : opts.from;
    const to = opts.to === undefined ? 1 : opts.to;
    const pick = opts.pick;
    const parent = opts.parent;
    const placed = [];

    // arc-length table
    const cum = [0];
    for (let i = 1; i < pathPts.length; i++) {
      cum.push(cum[i - 1] + Math.hypot(pathPts[i][0] - pathPts[i - 1][0], pathPts[i][2] - pathPts[i - 1][2]));
    }
    const total = cum[cum.length - 1];
    const at = (s) => {
      s = U.clamp(s, 0, total);
      let i = 1;
      while (i < cum.length - 1 && cum[i] < s) i++;
      const t = (s - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
      const a = pathPts[i - 1], b = pathPts[i];
      const x = U.lerp(a[0], b[0], t), z = U.lerp(a[2], b[2], t);
      let dx = b[0] - a[0], dz = b[2] - a[2];
      const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      return { x, z, dx, dz };
    };

    // offset is measured from the road EDGE, so the pavement stays clear
    const roadHalf = opts.roadHalf === undefined ? 0 : opts.roadHalf;
    let s = from * total;
    const end = to * total;
    let guard = 0;
    while (s < end && guard++ < 260) {
      const g = pick ? pick(s / total) : null;
      if (!g) { s += 4; continue; }
      const fp = g.userData.footprint || { w: 6, d: 6 };
      const p = at(s + fp.w / 2);
      const nx = -p.dz * side, nz = p.dx * side;
      const off = roadHalf + setback + fp.d / 2;
      const ox = p.x + nx * off;
      const oz = p.z + nz * off;
      const rot = Math.atan2(-nx, -nz) + (opts.rotJitter ? rng.bell() * opts.rotJitter : 0);

      const fs = Island.flatSpot(ox, oz, fp.w, fp.d, rot);
      const cand = { x: ox, z: oz, w: fp.w, d: fp.d, rot, r: rectRadius(fp.w, fp.d), name: 'frontage' };
      const tag = (opts.tag || 'f') + ':';
      let blocked = false;
      if (!Island.landAt(ox, oz)) { blocked = true; why(stats.whyF, tag + 'water'); }
      else if (fs.spread > (opts.maxSpread || 1.35)) { blocked = true; why(stats.whyF, tag + 'slope'); }
      else if (hitsRoad(cand, 0.25)) { blocked = true; why(stats.whyF, tag + 'road:' + hitsRoad(cand, 0.25)); }
      else if (hitsStream(cand, 0.3)) { blocked = true; why(stats.whyF, tag + 'stream'); }
      else { for (const o of taken) if (obbOverlap(o, cand, opts.pad === undefined ? 0.5 : opts.pad)) { blocked = true; why(stats.whyF, tag + 'overlap:' + o.name); break; } }

      if (blocked) { s += Math.max(1.8, Math.min(4.5, fp.w * 0.3)); stats.rejected++; continue; }
      taken.push(cand);
      const baseY = fs.lowest + Math.min(0.28, fs.spread * 0.35);
      plinth(g, fp, baseY - fs.lowest + (fs.spread > 0.2 ? 0.3 : 0));
      put(g, ox, oz, baseY, rot, parent);
      placed.push(g);
      s += fp.w + gap + (opts.gapJitter ? rng() * opts.gapJitter : 0);
    }
    return placed;
  }
  L.frontage = frontage;

  /** scatter(n, make, opts) — organic scatter with rejection */
  function scatter(n, make, opts) {
    opts = opts || {};
    const out = [];
    for (let i = 0; i < n; i++) {
      const g = make(i);
      if (!g) continue;
      const fp = g.userData.footprint || { w: 2, d: 2 };
      const s = site(fp.w * (opts.tight || 1), fp.d * (opts.tight || 1), opts);
      if (!s) continue;
      out.push(put(g, s.x, s.z, s.y + (opts.lift || 0), opts.rot === undefined ? rng() * U.TAU : s.rot, opts.parent));
    }
    return out;
  }
  L.scatter = scatter;

  /* ------------------------------------------------------------
     alongPath() — dress a corridor: lamps, benches, bins, trees.
     Placing street furniture procedurally along the real road
     geometry is what makes the streets feel inhabited.
     ------------------------------------------------------------ */
  function alongPath(pathPts, step, cb, opts) {
    opts = opts || {};
    const closed = !!opts.closed;
    const n = pathPts.length;
    let acc = opts.offset || 0;
    let s = 0;
    const lim = closed ? n : n - 1;
    for (let i = 0; i < lim; i++) {
      const a = pathPts[i], b = pathPts[(i + 1) % n];
      const seg = Math.hypot(b[0] - a[0], b[2] - a[2]);
      if (seg < 1e-4) continue;
      let dx = (b[0] - a[0]) / seg, dz = (b[2] - a[2]) / seg;
      let local = acc;
      while (local < seg) {
        const x = a[0] + dx * local, z = a[2] + dz * local;
        cb({ x, z, dx, dz, s: s + local, i });
        local += step;
      }
      acc = local - seg;
      s += seg;
    }
  }
  L.alongPath = alongPath;

  /* ============================================================
     2 · DISTRICTS
     ============================================================ */
  const groups = {};
  function G(name) {
    if (!groups[name]) { groups[name] = TOWN.group(name); L.root.add(groups[name]); }
    return groups[name];
  }

  /* ---------- the main square ---------- */
  function buildSquare() {
    const g = G('square');
    const pz = Roads.PLAZA;
    const py = Roads.plazaY || Island.heightAt(pz.x, pz.z);
    claim(pz.x, pz.z, pz.w + 1, pz.d + 1, pz.rot, 'plaza');

    // the fountain at the centre, with its water jets
    if (has(PR, 'fountain')) {
      const f = PR().fountain({ seed: 5, r: 2.4, tiers: 2 });
      put(f, pz.x, pz.z, py, 0.2, g);
      const anchors = f.userData.jetAnchors;
      if (has(FX, 'fountainJet')) {
        if (anchors && anchors.length) {
          for (const a of anchors.slice(0, 3)) {
            g.add(FX().fountainJet({ position: [pz.x + a[0], py + a[1], pz.z + a[2]], height: 1.9, radius: 0.3, count: 70, seed: 8 }));
          }
        } else {
          g.add(FX().fountainJet({ position: [pz.x, py + 2.2, pz.z], height: 2.1, radius: 0.35, count: 80, seed: 8 }));
        }
      }
    } else if (has(FX, 'fountainJet')) {
      g.add(FX().fountainJet({ position: [pz.x, py + 1.6, pz.z], seed: 8 }));
    }

    // market stalls ringing the square
    if (has(PR, 'marketStall')) {
      const goods = ['fruit', 'fish', 'flowers', 'bread', 'pottery', 'veg'];
      for (let i = 0; i < 7; i++) {
        const a = -0.4 + (i / 7) * U.TAU;
        const rr = 7.2 + rng.range(-0.5, 0.6);
        const x = pz.x + Math.cos(a) * rr * 1.12, z = pz.z + Math.sin(a) * rr * 0.72;
        const st = PR().marketStall({ seed: 100 + i, goods: goods[i % goods.length] });
        claim(x, z, 3, 2.6, a, 'stall');
        put(st, x, z, Island.heightAt(x, z), a + Math.PI + rng.bell() * 0.2, g);
      }
    }
    // benches, lamps and planters around the rim
    for (let i = 0; i < 8; i++) {
      const a = 0.3 + (i / 8) * U.TAU;
      const x = pz.x + Math.cos(a) * 9.6, z = pz.z + Math.sin(a) * 5.9;
      const y = Island.heightAt(x, z);
      if (i % 2 === 0 && has(PR, 'bench')) put(PR().bench({ seed: 200 + i }), x, z, y, a + Math.PI / 2, g);
      else if (has(PR, 'planter')) put(PR().planter({ seed: 210 + i, w: 1.6 }), x, z, y, a, g);
    }
    if (has(PR, 'statue')) {
      const x = pz.x - 7.4, z = pz.z - 4.2;
      claim(x, z, 2.6, 2.6, 0, 'statue');
      put(PR().statue({ seed: 9, kind: 'figure' }), x, z, Island.heightAt(x, z), 2.4, g);
    }
    if (has(PR, 'clockPost')) {
      const x = pz.x + 8.6, z = pz.z + 4.6;
      put(PR().clockPost({ seed: 12 }), x, z, Island.heightAt(x, z), -0.6, g);
    }
    // bunting strung across the square
    if (has(PR, 'bunting')) {
      for (let i = 0; i < 3; i++) {
        const a0 = 0.5 + i * 2.1, a1 = a0 + 2.3;
        const y = py + 4.2;
        g.add(PR().bunting({
          a: [pz.x + Math.cos(a0) * 9.4, y, pz.z + Math.sin(a0) * 5.8],
          b: [pz.x + Math.cos(a1) * 9.4, y, pz.z + Math.sin(a1) * 5.8],
          count: 12, seed: 300 + i,
        }));
      }
    }
    return g;
  }

  /* ---------- civic landmarks on the town plateau ---------- */
  function buildCivic() {
    const g = G('civic');

    // each entry is an intended site; the engine still validates the ground
    const plan = [
      { make: C().townHall, seed: 21, at: [-4, -6], rot: 0, spread: 4, name: 'townHall' },
      { make: C().church, seed: 81, at: [16, -24], rot: Math.PI / 2, spread: 4, name: 'church' },
      { make: C().station, seed: 24, at: [-13, -24], rot: Math.PI, spread: 5, name: 'station' },
      { make: C().market, seed: 23, at: [-26, 26], rot: 0.4, spread: 6, name: 'market' },
      { make: C().warehouse, seed: 41, at: [-10, 24], rot: 0, spread: 6, name: 'warehouse' },
    ];
    // search outward from the intended spot until genuinely level ground is
    // found — a landmark that visibly sinks into a slope ruins the illusion
    for (const it of plan) {
      let ok = null;
      for (const relax of [[it.spread, 0.55], [it.spread + 4, 0.8], [it.spread + 9, 1.05], [it.spread + 14, 1.35]]) {
        ok = drop({ make: it.make, opts: { seed: it.seed }, near: it.at, spread: relax[0],
          rot: it.rot, rotJitter: 0.04, maxSpread: relax[1], pad: 0.9, scale: it.scale,
          minRoad: 0.15, minY: 1.6, tries: 200, parent: g, name: it.name });
        if (ok) break;
      }
      if (!ok) console.warn('[layout] no site for ' + it.name);
    }
    return g;
  }

  /* ---------- the shopping streets ---------- */
  function buildTownStreets() {
    const g = G('town');
    const mainPts = ((Roads.routes && Roads.routes.mainWalk) || []).slice(0, 42);
    const streets = [];
    // reconstruct clean centre-lines from the corridor list
    for (const c of Roads.corridors) if (c.pts.length > 8) streets.push(c);

    const shopPick = (t) => {
      const r = rng();
      if (r < 0.44 && has(H, 'rowTerrace')) return H().rowTerrace({ seed: rng.int(1, 9e4), count: rng.int(3, 5) });
      if (r < 0.62 && has(H, 'townhouse')) return H().townhouse({ seed: rng.int(1, 9e4), shop: true, floors: rng.int(2, 4) });
      if (r < 0.74 && has(H, 'cafe')) return H().cafe({ seed: rng.int(1, 9e4) });
      if (r < 0.85 && has(H, 'apartment')) return H().apartment({ seed: rng.int(1, 9e4), floors: rng.int(4, 5) });
      if (r < 0.93 && has(H, 'tower_house')) return H().tower_house({ seed: rng.int(1, 9e4) });
      if (has(H, 'villa')) return H().villa({ seed: rng.int(1, 9e4) });
      return null;
    };

    // main street: both frontages
    const main = Roads.corridors.find((c) => c.name === 'mainSt');
    if (main) {
      frontage(main.pts, { side: 1, roadHalf: main.roadHalf, setback: 1.1, gap: 0.5, gapJitter: 1.1,
        rotJitter: 0.03, pick: shopPick, parent: g, pad: 0.4, tag: 'mainA' });
      frontage(main.pts, { side: -1, roadHalf: main.roadHalf, setback: 1.1, gap: 0.55, gapJitter: 1.3,
        rotJitter: 0.03, pick: shopPick, parent: g, pad: 0.4, from: 0.03, to: 0.95, tag: 'mainB' });
    }
    // north street: quieter, houses and workshops
    const north = Roads.corridors.find((c) => c.name === 'backLane');
    if (north) {
      const pick = () => {
        const r = rng();
        if (r < 0.34 && has(H, 'rowTerrace')) return H().rowTerrace({ seed: rng.int(1, 9e4), count: rng.int(3, 4) });
        if (r < 0.58 && has(H, 'townhouse')) return H().townhouse({ seed: rng.int(1, 9e4), shop: rng.chance(0.4), floors: rng.int(2, 3) });
        if (r < 0.74 && has(H, 'cottage')) return H().cottage({ seed: rng.int(1, 9e4), floors: 2 });
        if (r < 0.88 && has(H, 'villa')) return H().villa({ seed: rng.int(1, 9e4) });
        if (has(H, 'greenhouse')) return H().greenhouse({ seed: rng.int(1, 9e4) });
        return null;
      };
      frontage(north.pts, { side: 1, roadHalf: north.roadHalf, setback: 1.3, gap: 1.0, gapJitter: 1.7,
        rotJitter: 0.05, pick, parent: g, pad: 0.55, from: 0.02, to: 0.96, tag: 'laneA' });
      frontage(north.pts, { side: -1, roadHalf: north.roadHalf, setback: 1.5, gap: 1.3, gapJitter: 2.1,
        rotJitter: 0.06, pick, parent: g, pad: 0.6, from: 0.05, to: 0.94, tag: 'laneB' });
    }
    // hillside frontages: houses stepping up the graded ramp streets.
    // These are the strongest anti-cube feature in the whole town — the
    // roofline climbs with the road instead of sitting on one flat plane.
    for (const nm of ['ramp_toQuay', 'ramp_toTerrace', 'ramp_toFair']) {
      const rc = Roads.corridors.find((c) => c.name === nm);
      if (!rc) continue;
      const pick = () => {
        const r = rng();
        if (r < 0.34 && has(H, 'cottage')) return H().cottage({ seed: rng.int(1, 9e4), floors: rng.int(1, 2) });
        if (r < 0.60 && has(H, 'townhouse')) return H().townhouse({ seed: rng.int(1, 9e4), shop: rng.chance(0.5), floors: rng.int(2, 3) });
        if (r < 0.76 && has(H, 'tower_house')) return H().tower_house({ seed: rng.int(1, 9e4) });
        if (r < 0.88 && has(H, 'shed')) return H().shed({ seed: rng.int(1, 9e4) });
        if (has(H, 'greenhouse')) return H().greenhouse({ seed: rng.int(1, 9e4) });
        return null;
      };
      for (const sd of [1, -1]) {
        frontage(rc.pts, { side: sd, roadHalf: rc.roadHalf, setback: 1.2, gap: 1.3, gapJitter: 2.0,
          rotJitter: 0.07, pick, parent: g, pad: 0.5, maxSpread: 1.45, tag: nm });
      }
    }

    // cross streets get infill houses
    for (const c of Roads.corridors) {
      if (c.halfW > 4.4 || c.pts.length < 10) continue;
      if (Math.abs(c.pts[0][1] - TIERS.TOWN) > 1.4) continue;
      const pick = () => (rng.chance(0.55) && has(H, 'townhouse'))
        ? H().townhouse({ seed: rng.int(1, 9e4), shop: rng.chance(0.3), floors: rng.int(2, 3) })
        : (has(H, 'cottage') ? H().cottage({ seed: rng.int(1, 9e4) }) : null);
      frontage(c.pts, { side: rng.sign(), roadHalf: c.roadHalf, setback: 1.2, gap: 1.1, gapJitter: 1.5,
        rotJitter: 0.05, pick, parent: g, pad: 0.55, tag: 'cross' });
    }
    return g;
  }

  /* ---------- harbour ---------- */
  function buildHarbour() {
    const g = G('harbour');

    // the lighthouse claims its rocky spit first, before the quay clutter
    drop({ make: C().lighthouse, opts: { seed: 46 }, near: [44, 27], spread: 4.0, rot: -0.8,
      tier: 4.2, tierTol: 2.0, maxSpread: 1.2, pad: 0.6, tries: 200, parent: g, name: 'lighthouse' });

    // warehouses + boathouses lining the quay
    const quay = Roads.corridors.find((c) => c.name === 'quayRing');
    if (quay) {
      const pick = () => {
        const r = rng();
        if (r < 0.34 && has(C, 'warehouse')) return C().warehouse({ seed: rng.int(1, 9e4) });
        if (r < 0.52 && has(H, 'boathouse')) return H().boathouse({ seed: rng.int(1, 9e4) });
        if (r < 0.70 && has(H, 'townhouse')) return H().townhouse({ seed: rng.int(1, 9e4), shop: true, floors: rng.int(2, 3) });
        if (r < 0.84 && has(H, 'cottage')) return H().cottage({ seed: rng.int(1, 9e4) });
        if (has(H, 'shed')) return H().shed({ seed: rng.int(1, 9e4) });
        return null;
      };
      frontage(quay.pts, { side: -1, roadHalf: quay.roadHalf, setback: 1.2, gap: 1.2, gapJitter: 2.2,
        rotJitter: 0.05, pick, parent: g, pad: 0.6, closed: true, tag: 'quay' });
    }


    // harbour crane and dock clutter
    if (has(PR, 'harbourCrane')) {
      for (const [x, z, r] of [[6.6, 25, 1.5], [33.0, 25.5, -1.5]]) {
        const y = Island.heightAt(x, z);
        claim(x, z, 3, 3, 0, 'crane');
        put(PR().harbourCrane({ seed: 44, h: 7.4 }), x, z, y, r, g);
      }
    }
    const clutter = ['crate', 'crateStack', 'barrel', 'sackPile', 'fishCrate', 'lobsterTrap', 'fishingNet', 'anchorProp', 'buoy', 'rowboatProp', 'capstan'];
    for (let i = 0; i < 34; i++) {
      const fn = rng.pick(clutter);
      if (!has(PR, fn)) continue;
      const o = PR()[fn]({ seed: 500 + i, count: rng.int(2, 4), color: rng.pick([P.awningRed, P.awningBlue, P.awningYellow, P.white]) });
      const s = site(1.6, 1.6, { near: rng.pick([[4, 21], [16, 18.5], [31, 23], [9, 34], [27, 33], [34, 30]]),
        spread: 7, tier: TIERS.QUAY, tierTol: 1.5, minRoad: -1.6, pad: 0.2, tries: 24, name: fn });
      if (s) put(o, s.x, s.z, s.y, rng() * U.TAU, g);
    }
    // mooring posts + lamps along the quay wall
    if (has(PR, 'mooringPost')) {
      for (let i = 0; i < 16; i++) {
        const t = i / 16;
        const pts = [[8.2, 17], [8.4, 25], [8.6, 34], [8.8, 41], [30.2, 38], [30.4, 30], [30.6, 23], [31, 18]];
        const p = pts[i % pts.length];
        const x = p[0] + rng.bell() * 0.5, z = p[1] + rng.bell() * 2.4;
        if (!Island.landAt(x, z)) continue;
        put(PR().mooringPost({ seed: 600 + i }), x, z, Island.heightAt(x, z), rng() * U.TAU, g);
      }
    }
    if (has(N, 'rockCluster')) {
      for (let i = 0; i < 5; i++) {
        const a = rng() * U.TAU, rr = rng.range(6.5, 10);
        const x = 44 + Math.cos(a) * rr, z = 27 + Math.sin(a) * rr;
        if (!Island.landAt(x, z)) continue;
        put(N().rockCluster({ seed: 700 + i, r: rng.range(2, 3.4), count: 4 }), x, z, Island.heightAt(x, z) - 0.3, rng() * U.TAU, g);
      }
    }
    return g;
  }

  /* ---------- fairground ---------- */
  function buildFair() {
    const g = G('fair');
    const cx = 35, cz = -5;

    if (has(D, 'ferrisWheel')) {
      const w = D().ferrisWheel({ seed: 61, radius: 7.6, cabins: 10 });
      const x = 38.5, z = -11.0;
      claim(x, z, 12, 6, 0.5, 'ferris');
      put(w, x, z, Island.heightAt(x, z), 0.5, g);
    }
    if (has(D, 'carousel')) {
      const x = 31.0, z = 2.0;
      claim(x, z, 9, 9, 0, 'carousel');
      put(D().carousel({ seed: 62, radius: 3.8 }), x, z, Island.heightAt(x, z), 0.2, g);
    }
    if (has(D, 'swingRide')) {
      const x = 41.5, z = -3.0;
      claim(x, z, 9, 9, 0, 'swing');
      put(D().swingRide({ seed: 63 }), x, z, Island.heightAt(x, z), 0, g);
    }
    if (has(D, 'playground')) {
      const x = 29.5, z = -13.0;
      claim(x, z, 8, 6, 0.4, 'playground');
      put(D().playground({ seed: 64 }), x, z, Island.heightAt(x, z), 0.4, g);
    }
    // fairground gate + stalls + kiosks
    drop({ make: C().cityGate, opts: { seed: 65 }, near: [34, -17], spread: 5.0, rot: -0.35,
      tier: TIERS.FAIR, tierTol: 2.0, maxSpread: 1.3, pad: 0.5, tries: 200, parent: g, name: 'cityGate' });
    for (let i = 0; i < 9; i++) {
      const fn = rng.pick(['marketStall', 'kiosk', 'parasol', 'chairSet', 'trashBin', 'noticeBoard']);
      if (!has(PR, fn)) continue;
      const s = site(2.8, 2.4, { near: [cx + rng.bell() * 6, cz + rng.bell() * 7], spread: 5,
        tier: TIERS.FAIR, tierTol: 1.6, minRoad: -0.8, pad: 0.35, name: fn });
      if (s) put(PR()[fn]({ seed: 800 + i, goods: rng.pick(['fruit', 'bread', 'flowers']) }), s.x, s.z, s.y, rng() * U.TAU, g);
    }
    if (has(PR, 'lanternString')) {
      for (let i = 0; i < 4; i++) {
        const a0 = rng() * U.TAU, a1 = a0 + rng.range(1.4, 2.4);
        const y = Island.heightAt(cx, cz) + 5.4;
        g.add(PR().lanternString({
          a: [cx + Math.cos(a0) * 9, y, cz + Math.sin(a0) * 8],
          b: [cx + Math.cos(a1) * 9, y + rng.bell(), cz + Math.sin(a1) * 8],
          count: 10, seed: 900 + i,
        }));
      }
    }
    return g;
  }

  /* ---------- upper terrace: the residential quarter ---------- */
  function buildTerrace() {
    const g = G('terrace');


    // the watermill sits on the stream
    if (has(C, 'watermill')) {
      const mill = C().watermill({ seed: 82 });
      const x = -30.0, z = 1.0;
      claim(x, z, 12, 9, 0.5, 'watermill');
      put(mill, x, z, Island.heightAt(x, z), 0.5, g);
      const wa = mill.userData.wheelAnchor;
      if (has(FX, 'splash')) {
        const px = x + (wa ? wa[0] : -5), py = Island.heightAt(x, z) + 0.35, pz2 = z + (wa ? wa[2] : 0);
        g.add(FX().splash({ position: [px, py, pz2], r: 1.3, seed: 4 }));
      }
    }

    // houses along the terrace lane
    const lane = Roads.corridors.find((c) => c.name === 'terraceSt');
    if (lane) {
      const pick = () => {
        const r = rng();
        if (r < 0.36 && has(H, 'cottage')) return H().cottage({ seed: rng.int(1, 9e4), floors: rng.int(1, 2) });
        if (r < 0.58 && has(H, 'villa')) return H().villa({ seed: rng.int(1, 9e4) });
        if (r < 0.72 && has(H, 'townhouse')) return H().townhouse({ seed: rng.int(1, 9e4), shop: false, floors: 2 });
        if (r < 0.82 && has(H, 'tower_house')) return H().tower_house({ seed: rng.int(1, 9e4) });
        if (r < 0.90 && has(H, 'greenhouse')) return H().greenhouse({ seed: rng.int(1, 9e4) });
        if (has(H, 'shed')) return H().shed({ seed: rng.int(1, 9e4) });
        return null;
      };
      frontage(lane.pts, { side: -1, roadHalf: lane.roadHalf, setback: 1.8, gap: 1.9, gapJitter: 2.8,
        rotJitter: 0.07, pick, parent: g, pad: 0.8, closed: true, tag: 'terrA' });
      frontage(lane.pts, { side: 1, roadHalf: lane.roadHalf, setback: 2.2, gap: 2.4, gapJitter: 3.2,
        rotJitter: 0.08, pick, parent: g, pad: 0.9, from: 0.08, to: 0.88, tag: 'terrB' });
    }
    // garden walls, hedges, sheds and kitchen gardens between the houses
    for (let i = 0; i < 22; i++) {
      const fn = rng.pickW([['hedge', 3], ['fence', 3], ['vegPatch', 2], ['potPlant', 2], ['washingLine', 1], ['beehive', 1], ['wheelbarrow', 1], ['haystack', 1], ['birdhouse', 1]]);
      const mod = (fn === 'vegPatch' || fn === 'hedge') ? N : PR;
      if (!has(mod, fn)) continue;
      const o = mod()[fn]({ seed: 1000 + i, len: rng.range(4, 9), w: rng.range(3, 6), d: rng.range(2.5, 4.5) });
      const s = site(4, 3, { near: [-33 + rng.bell() * 8, 4 + rng.bell() * 8], spread: 7,
        tier: TIERS.TERRACE, tierTol: 2.2, minRoad: 0.2, pad: 0.3, name: fn });
      if (s) put(o, s.x, s.z, s.y, rng() * U.TAU, g);
    }
    return g;
  }

  /* ---------- knoll: the windmill and its fields ---------- */
  function buildKnoll() {
    const g = G('knoll');
    drop({ make: C().windmill, opts: { seed: 91 }, near: [13, -39.5], spread: 5.0, rot: 0.25,
      tier: TIERS.KNOLL, tierTol: 1.6, maxSpread: 1.0, pad: 0.6, tries: 200, parent: g, name: 'windmill' });
    drop({ make: H().cottage, opts: { seed: 92, floors: 1 }, near: [9, -39.5], spread: 4,
      tier: TIERS.KNOLL, tierTol: 1.8, parent: g, name: 'millerHouse' });
    drop({ make: H().shed, opts: { seed: 93 }, near: [20, -39.5], spread: 4,
      tier: TIERS.KNOLL, tierTol: 1.8, parent: g, name: 'shed' });
    // fields
    for (let i = 0; i < 7; i++) {
      if (!has(N, 'vegPatch')) break;
      const s = site(7, 5, { near: [8 + rng() * 14, -43 + rng() * 5], spread: 5,
        tier: TIERS.KNOLL, tierTol: 2.0, minRoad: 0.3, pad: 0.2, name: 'field' });
      if (s) put(N().vegPatch({ seed: 1100 + i, w: rng.range(5, 8), d: rng.range(3.5, 5.5) }), s.x, s.z, s.y, rng.pick([0, Math.PI / 2]) + rng.bell() * 0.2, g);
    }
    for (let i = 0; i < 5; i++) {
      const fn = rng.pick(['haystack', 'scarecrow', 'waterTrough', 'wheelbarrow', 'fence']);
      if (!has(PR, fn)) continue;
      const s = site(2.4, 2.4, { near: [15 + rng.bell() * 7, -40 + rng.bell() * 4], spread: 5,
        tier: TIERS.KNOLL, tierTol: 2.0, minRoad: 0.2, pad: 0.25, name: fn });
      if (s) put(PR()[fn]({ seed: 1200 + i, len: rng.range(5, 10) }), s.x, s.z, s.y, rng() * U.TAU, g);
    }
    return g;
  }

  /* ---------- hilltop ---------- */
  function buildHill() {
    const g = G('hill');
    drop({ make: C().observatory, opts: { seed: 95 }, near: [-36, -22], spread: 3.0, rot: 0.25,
      tier: TIERS.HILL, tierTol: 1.8, maxSpread: 0.9, pad: 0.6, tries: 200, parent: g, name: 'observatory' });
    if (has(C, 'gazebo')) {
      const gz = C().gazebo({ seed: 96 });
      const gf = gz.userData.footprint;
      const gx = -43.5, gz2 = -25.5, grot = 0.45;
      const fs = Island.flatSpot(gx, gz2, gf.w, gf.d, grot);
      claim(gx, gz2, gf.w, gf.d, grot, 'gazebo');
      plinth(gz, gf, Math.min(1.2, fs.spread) + 0.3);
      put(gz, gx, gz2, fs.lowest + 0.25, grot, g);
    }
    // a great old tree crowning the hill
    if (has(N, 'treeBroad')) {
      const t = N().treeBroad({ seed: 97, scale: 1.9 });
      const x = -31.0, z = -17.0;
      claim(x, z, 8, 8, 0, 'greatTree');
      put(t, x, z, Island.heightAt(x, z), 0, g);
      if (has(N, 'sway')) N().sway(t, { amount: 0.02, speed: 0.7, seed: 5 });
    }
    for (let i = 0; i < 7; i++) {
      const fn = rng.pick(['rock', 'rockCluster', 'bush', 'flowerPatch']);
      if (!has(N, fn)) continue;
      const s = site(2.5, 2.5, { near: [-36 + rng.bell() * 8, -19 + rng.bell() * 8], spread: 6,
        tier: TIERS.HILL, tierTol: 4.0, minRoad: 0.1, pad: 0.2, allowSlope: true, name: fn });
      if (s) put(N()[fn]({ seed: 1300 + i, r: rng.range(1.5, 3), w: 4, d: 3, count: 4 }), s.x, s.z, s.y - 0.15, rng() * U.TAU, g);
    }
    if (has(PR, 'bench')) {
      for (let i = 0; i < 3; i++) {
        const a = 1.0 + i * 2.0;
        const x = -36 + Math.cos(a) * 7.0, z = -19 + Math.sin(a) * 7.0;
        if (Island.landAt(x, z)) put(PR().bench({ seed: 1400 + i }), x, z, Island.heightAt(x, z), a + Math.PI, g);
      }
    }
    return g;
  }

  /* ---------- shore & beach ---------- */
  function buildShore() {
    const g = G('shore');
    // palms and beach clutter on the south-west sand
    for (let i = 0; i < 40; i++) {
      const fn = rng.pickW([['treePalm', 4], ['beachGrass', 4], ['driftwood', 2], ['seashells', 2], ['rock', 2], ['rowboatProp', 1], ['parasol', 1]]);
      const mod = (fn === 'rowboatProp' || fn === 'parasol') ? PR : N;
      if (!has(mod, fn)) continue;
      let ok = null;
      for (let k = 0; k < 18 && !ok; k++) {
        const a = rng.range(1.9, 4.2);
        const rr = rng.range(38, 51);
        const x = Math.cos(a) * rr - 4, z = Math.sin(a) * rr;
        const s = Island.sample(x, z);
        if (!s.land || s.y < 0.35 || s.y > 2.6) continue;
        const cand = { x, z, w: 2.4, d: 2.4, rot: 0, r: 1.7, name: fn };
        let hit = false;
        for (const o of taken) if (obbOverlap(o, cand, 0.3)) { hit = true; break; }
        if (hit) continue;
        taken.push(cand);
        ok = { x, z, y: s.y };
      }
      if (!ok) continue;
      put(mod()[fn]({ seed: 1500 + i, count: rng.int(3, 6), scale: rng.range(0.85, 1.25) }), ok.x, ok.z, ok.y - 0.08, rng() * U.TAU, g);
    }
    // rocks along the whole coastline
    if (has(N, 'cliffRocks') || has(N, 'rockCluster')) {
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * U.TAU + rng.bell() * 0.1;
        for (let rr = 56; rr > 30; rr -= 1.2) {
          const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
          const s = Island.sample(x, z);
          if (s.land && s.y > 0.2 && s.y < 4.5) {
            const fn = has(N, 'cliffRocks') && rng.chance(0.5) ? 'cliffRocks' : 'rockCluster';
            put(N()[fn]({ seed: 1600 + i, len: rng.range(4, 8), r: rng.range(2, 3.6), count: 4 }),
              x, z, s.y - 0.45, a + Math.PI / 2 + rng.bell() * 0.3, g);
            break;
          }
        }
      }
    }
    return g;
  }


  /* ------------------------------------------------------------
     infill() — the density pass.
     Street frontages leave every block hollow. This scans the whole
     island on a grid for pockets of level, road-free, unclaimed
     ground and fills them with buildings facing the nearest street,
     which is what finally makes the town read as dense.
     ------------------------------------------------------------ */
  function freeCells(step, tiers) {
    const cells = [];
    const probe = { x: 0, z: 0, w: 2.0, d: 2.0, rot: 0, r: 1.42, name: 'probe' };
    for (let x = -50; x <= 50; x += step) {
      for (let z = -48; z <= 48; z += step) {
        const sm = Island.sample(x, z);
        if (!sm.land || sm.y < 1.15) continue;
        if (Island.slopeAt(x, z, 1.2) > 0.30) continue;
        probe.x = x; probe.z = z;
        if (hitsRoad(probe, 0.3)) continue;
        if (hitsStream({ x, z, w: 3.2, d: 3.2, rot: 0, r: 2.26 }, 0.4)) continue;
        cells.push([x, z, sm.y]);
      }
    }
    return cells;
  }

  function buildInfill() {
    const g = G('infill');
    const tiers = [TIERS.QUAY, TIERS.FAIR, TIERS.TOWN, TIERS.TERRACE, TIERS.KNOLL];
    let cells = freeCells(1.7, tiers);
    // annotate each cell with its nearest street, then fill from the street
    // inward so buildings form frontages before filling the block interiors
    for (const c of cells) {
      const fr = faceRoad(c[0], c[1]);
      c[3] = fr.rot; c[4] = fr.dist;
    }
    // ~10 m from a street centre-line is the natural frontage distance;
    // cells nearer than that are pavement slivers, further ones are back lots
    cells.sort((a, b) => Math.abs(a[4] - 10) - Math.abs(b[4] - 10));
    L.freeCells = cells.length;

    // approximate footprints, sampled once, so we can test before building
    // quotas shape the MIX, not the count: outbuildings are capped low so a
    // plot that could hold a house is never spent on a shed
    const kinds = [
      ['rowTerrace', 6], ['apartment', 6], ['hotel', 2], ['villa', 14], ['cafe', 10],
      ['townhouse', 40], ['cottage', 34], ['tower_house', 10], ['greenhouse', 5],
      ['boathouse', 4], ['shed', 5],
    ];
    const probeFP = {};
    for (const [kind] of kinds) {
      if (!has(H, kind)) continue;
      try {
        const t = H()[kind]({ seed: 7 });
        probeFP[kind] = t.userData.footprint || { w: 6, d: 6 };
      } catch (e) { /* leave undefined */ }
    }
    const quota = {};
    for (const [kind, n] of kinds) quota[kind] = n;

    let placed = 0;
    const iw = L.infillWhy = {};
    const iwhy = (k) => { iw[k] = (iw[k] || 0) + 1; };
    for (let ci = 0; ci < cells.length; ci++) {
      const cell = cells[ci];
      const nearRoad = cell[4] < 26;
      const rot = nearRoad ? cell[3] + rng.bell() * 0.08 : rng() * U.TAU;
      // biggest first so large buildings are not squeezed out of good plots
      const order = rng.shuffle(kinds.slice()).sort((a, b) => {
        const fa = probeFP[a[0]], fb = probeFP[b[0]];
        if (!fa) return 1; if (!fb) return -1;
        return (fb.w * fb.d) - (fa.w * fa.d);
      });
      // street plots are reserved for proper houses; sheds and glasshouses
      // belong in the back lots, or the frontage fills up with outbuildings
      const minDepth = cell[4] < 9 ? 5.0 : 0;
      let done = false;
      for (const [kind] of order) {
        if (done || !quota[kind] || !probeFP[kind]) continue;
        const fp = probeFP[kind];
        if (fp.d < minDepth && fp.w < minDepth) { iwhy('tooSmallForStreet'); continue; }
        const jx = cell[0] + rng.bell() * 0.7, jz = cell[1] + rng.bell() * 0.7;
        // cheap pre-test with the sampled footprint (+10 % margin)
        const pre = { x: jx, z: jz, w: fp.w * 1.04, d: fp.d * 1.04, rot,
          r: rectRadius(fp.w, fp.d) * 1.04, name: kind };
        if (hitsRoad(pre, 0.4)) { iwhy('preRoad'); continue; }
        if (hitsStream(pre, 0.2)) { iwhy('preStream'); continue; }
        let bad = null;
        for (const o of taken) if (obbOverlap(o, pre, 0.25)) { bad = o.name; break; }
        if (bad) { iwhy('preOverlap:' + bad); continue; }
        const fs = Island.flatSpot(jx, jz, fp.w * 1.04, fp.d * 1.04, rot);
        if (fs.spread > 1.5) { iwhy('preSlope'); continue; }
        // passed: now build the real thing and confirm
        let obj;
        try {
          obj = H()[kind]({ seed: rng.int(1, 9e5), count: rng.int(3, 5),
            floors: rng.int(1, 4), shop: rng.chance(0.4) });
        } catch (e) { continue; }
        if (!obj) continue;
        const rfp = obj.userData.footprint || fp;
        const cand = { x: jx, z: jz, w: rfp.w, d: rfp.d, rot, r: rectRadius(rfp.w, rfp.d), name: kind };
        if (hitsRoad(cand, 0.4) || hitsStream(cand, 0.2)) { iwhy('road2'); continue; }
        let bad2 = false;
        for (const o of taken) if (obbOverlap(o, cand, 0.25)) { bad2 = true; break; }
        if (bad2) { iwhy('overlap2'); continue; }
        const fs2 = Island.flatSpot(jx, jz, rfp.w, rfp.d, rot);
        if (fs2.spread > 1.5) { iwhy('slope2'); continue; }
        taken.push(cand);
        const by = fs2.lowest + Math.min(0.34, fs2.spread * 0.35);
        plinth(obj, rfp, by - fs2.lowest + (fs2.spread > 0.2 ? 0.3 : 0));
        put(obj, jx, jz, by, rot, g);
        quota[kind]--;
        placed++; done = true;
      }
    }
    L.infillCount = placed;
    return g;
  }

  /* ============================================================
     3 · GREENERY — the layer that softens every hard edge
     ============================================================ */
  function buildGreen() {
    const g = G('green');
    if (!has(N, 'treeBroad')) return g;

    const kinds = [
      ['treeBroad', 5], ['treePine', 3], ['treeCypress', 2], ['treeBirch', 2],
      ['treeSakura', 2], ['treeAutumn', 2], ['treeOlive', 1.5], ['treeFruit', 1.5],
    ];
    const swayList = [];

    // street trees: in the pavement, alternating sides
    let treeIx = 0;
    for (const c of Roads.corridors) {
      if (c.pts.length < 12) continue;
      const tier = c.pts[0][1];
      alongPath(c.pts, 11 + rng() * 5, (p) => {
        const side = (treeIx++ % 2) ? 1 : -1;
        const nx = -p.dz * side, nz = p.dx * side;
        const x = p.x + nx * (c.halfW + 0.9), z = p.z + nz * (c.halfW + 0.9);
        const s = Island.sample(x, z);
        if (!s.land || s.y < 0.8) return;
        if (Math.abs(s.y - tier) > 2.2) return;
        const cand = { x, z, w: 2.2, d: 2.2, rot: 0, r: 1.6, name: 'streetTree' };
        for (const o of taken) if (obbOverlap(o, cand, 0.1)) return;
        taken.push(cand);
        const kind = rng.chance(0.6) ? 'treeBroad' : rng.pick(['treeCypress', 'treeBirch', 'treeSakura', 'treeAutumn']);
        if (!has(N, kind)) return;
        const t = N()[kind]({ seed: rng.int(1, 9e4), scale: rng.range(0.8, 1.15) });
        put(t, x, z, s.y, rng() * U.TAU, g);
        swayList.push(t);
        if (has(PR, 'treeGuard') && rng.chance(0.3)) put(PR().treeGuard({ seed: rng.int(1, 9e4) }), x, z, s.y, 0, g);
      });
    }

    // copses filling the empty ground of every tier
    const spots = [
      [-42, -14, 6], [-30, -27, 6], [-42, 14, 5], [-24, 12, 5], [-14, -34, 6],
      [-6, -40, 6], [4, -33, 5], [20, -33, 5], [33, -18, 5], [44, -14, 4],
      [45, 6, 5], [-24, 20, 6], [-12, 20, 5], [-34, 30, 6], [-25, 36, 5],
      [-10, -20, 4], [10, -30, 5], [18, -42, 5], [-20, -20, 4], [30, 11, 4],
      [-46, 4, 4], [-46, -4, 4], [38, -22, 4], [-8, 14, 4], [16, -8, 4],
      [-25, -14, 4], [-33, -12, 4], [12, 8, 4], [-2, -30, 4], [22, -22, 4],
    ];
    for (let i = 0; i < spots.length; i++) {
      const [sx, sz, sr] = spots[i];
      if (has(N, 'treeCluster')) {
        const s = site(sr * 1.3, sr * 1.3, { near: [sx, sz], spread: sr, minRoad: 1.0, pad: 0.3,
          allowSlope: true, tries: 26, name: 'copse', minY: 0.7 });
        if (s) {
          const cl = N().treeCluster({ seed: 1700 + i, r: sr * 0.72, count: rng.int(4, 7) });
          put(cl, s.x, s.z, s.y, rng() * U.TAU, g);
          swayList.push(cl);
        }
      }
    }
    // single trees scattered wherever there is room
    for (let i = 0; i < 70; i++) {
      const kind = rng.pickW(kinds);
      if (!has(N, kind)) continue;
      const a = rng() * U.TAU, rr = Math.sqrt(rng()) * 48;
      const s = site(2.6, 2.6, { near: [Math.cos(a) * rr, Math.sin(a) * rr], spread: 8,
        minRoad: 0.9, pad: 0.25, allowSlope: true, tries: 16, minY: 0.9, name: kind });
      if (!s) continue;
      const t = N()[kind]({ seed: rng.int(1, 9e4), scale: rng.range(0.8, 1.3) });
      put(t, s.x, s.z, s.y, rng() * U.TAU, g);
      if (rng.chance(0.5)) swayList.push(t);
    }
    // hedges, flowerbeds and grass tufts
    for (let i = 0; i < 46; i++) {
      const fn = rng.pickW([['grassTufts', 5], ['flowerPatch', 4], ['bush', 4], ['hedge', 2], ['reeds', 1]]);
      if (!has(N, fn)) continue;
      const a = rng() * U.TAU, rr = Math.sqrt(rng()) * 46;
      const near = [Math.cos(a) * rr, Math.sin(a) * rr];
      const isReed = fn === 'reeds';
      const s = site(4, 3, { near, spread: 9, minRoad: isReed ? -1 : 0.4, pad: 0.15,
        allowSlope: true, tries: 14, minY: isReed ? 0.3 : 0.8, keepStream: !isReed, name: fn });
      if (!s) continue;
      put(N()[fn]({ seed: rng.int(1, 9e4), w: rng.range(4, 8), d: rng.range(3, 6),
        len: rng.range(4, 9), count: fn === 'grassTufts' ? 90 : 34 }), s.x, s.z, s.y, rng() * U.TAU, g);
    }
    // reeds and lilies at the pond and along the stream
    if (has(N, 'reeds')) {
      const pond = Island.POND;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * U.TAU;
        const x = pond.x + Math.cos(a) * (pond.r + 0.5), z = pond.z + Math.sin(a) * (pond.r + 0.5);
        put(N().reeds({ seed: 1800 + i, w: 2.2, d: 1.6, count: 16 }), x, z, Island.heightAt(x, z), a, g);
      }
    }
    if (has(N, 'lilyPads')) {
      put(N().lilyPads({ seed: 1810, r: Island.POND.r * 0.6, count: 12 }),
        Island.POND.x, Island.POND.z, (Island.pondY || Island.heightAt(Island.POND.x, Island.POND.z)) + 0.02, 0, g);
    }
    // stream banks
    if (has(N, 'reeds') || has(N, 'rock')) {
      const sp = Island.STREAM;
      for (let i = 1; i < sp.length; i += 1) {
        for (const side of [-1, 1]) {
          const a = sp[i], b = sp[i - 1];
          let dx = a[0] - b[0], dz = a[1] - b[1];
          const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
          const x = a[0] - dz * side * 2.1 + rng.bell() * 0.6;
          const z = a[1] + dx * side * 2.1 + rng.bell() * 0.6;
          if (!Island.landAt(x, z)) continue;
          const fn = rng.chance(0.55) ? 'reeds' : 'rock';
          if (!has(N, fn)) continue;
          put(N()[fn]({ seed: rng.int(1, 9e4), w: 1.8, d: 1.4, count: 12, scale: rng.range(0.5, 1.0) }),
            x, z, Island.heightAt(x, z) - 0.1, rng() * U.TAU, g);
        }
      }
    }

    // register the wind
    if (has(N, 'sway')) {
      for (const t of swayList) N().sway(t, { amount: rng.range(0.018, 0.04), speed: rng.range(0.7, 1.3), seed: rng.int(1, 999) });
    }
    L.swayCount = swayList.length;
    return g;
  }

  /* ============================================================
     4 · STREET FURNITURE — lamps everywhere (the night look)
     ============================================================ */
  function buildFurniture() {
    const g = G('props');
    const lampPos = [];

    for (const c of Roads.corridors) {
      if (c.pts.length < 10) continue;
      const isBig = c.halfW > 4.2;
      let k = 0;
      alongPath(c.pts, isBig ? 13 : 17, (p) => {
        const side = (k++ % 2) ? 1 : -1;
        const nx = -p.dz * side, nz = p.dx * side;
        const x = p.x + nx * (c.halfW - 0.55), z = p.z + nz * (c.halfW - 0.55);
        const s = Island.sample(x, z);
        if (!s.land || s.y < 0.7) return;
        if (!has(PR, 'streetLamp')) return;
        const style = s.y < 3 ? 'classic' : (rng.chance(0.22) ? 'twin' : 'classic');
        const lamp = PR().streetLamp({ seed: rng.int(1, 9e4), style, h: rng.range(3.4, 4.4) });
        put(lamp, x, z, s.y, rng() * U.TAU, g);
        lampPos.push([x, s.y, z]);
      });
      // benches & bins on the bigger streets
      if (isBig) {
        let j = 0;
        alongPath(c.pts, 22, (p) => {
          const side = (j++ % 2) ? -1 : 1;
          const nx = -p.dz * side, nz = p.dx * side;
          const x = p.x + nx * (c.halfW - 0.8), z = p.z + nz * (c.halfW - 0.8);
          const s = Island.sample(x, z);
          if (!s.land || s.y < 0.7) return;
          const fn = rng.pickW([['bench', 4], ['trashBin', 2], ['postbox', 1], ['bollard', 1], ['noticeBoard', 1], ['bicycle', 2]]);
          if (!has(PR, fn)) return;
          put(PR()[fn]({ seed: rng.int(1, 9e4) }), x, z, s.y, Math.atan2(-nx, -nz), g);
        });
      }
    }
    L.lampPositions = lampPos;

    // cafe terraces spilling onto the pavement
    if (has(PR, 'cafeTerrace')) {
      for (const [x, z, r] of [[-9.5, 1.0, 3.14], [4.5, 0.8, 3.14], [-20.5, 1.5, 1.57], [5, -20.5, 0.0]]) {
        const s = Island.sample(x, z);
        if (!s.land) continue;
        put(PR().cafeTerrace({ seed: rng.int(1, 9e4), w: 5.5, d: 3.4, count: 3 }), x, z, s.y, r, g);
      }
    }
    // flags on the civic buildings + the quay
    if (has(PR, 'flagPole')) {
      for (const [x, z] of [[-11.0, 1.0], [6.0, 0.5], [-31.0, 0.0], [9.5, 17.5], [24, 17.0], [-36.0, -24.0]]) {
        const s = Island.sample(x, z);
        if (!s.land) continue;
        put(PR().flagPole({ seed: rng.int(1, 9e4), h: rng.range(5.5, 7.5), color: rng.pick([P.awningRed, P.awningBlue, P.white, P.awningYellow]) }), x, z, s.y, 0, g);
      }
    }
    // washing lines strung between the harbour houses
    if (has(PR, 'washingLine')) {
      for (let i = 0; i < 5; i++) {
        const base = rng.pick([[3, 23], [4, 33], [27, 21], [-8, -22], [-34, 6]]);
        const a = rng() * U.TAU;
        const y = Island.heightAt(base[0], base[1]) + rng.range(3.4, 5.2);
        g.add(PR().washingLine({
          a: [base[0], y, base[1]],
          b: [base[0] + Math.cos(a) * 6.5, y + rng.bell() * 0.5, base[1] + Math.sin(a) * 6.5],
          count: 6, seed: 1900 + i,
        }));
      }
    }
    // wells, power poles, misc
    for (const fn of ['well', 'sundial', 'milestone', 'waterTrough', 'phoneBooth', 'busStop', 'kiosk']) {
      if (!has(PR, fn)) continue;
      const s = site(2.4, 2.4, { near: [rng.bell() * 26, rng.bell() * 20], spread: 14,
        minRoad: 0.4, pad: 0.3, tries: 30, minY: 1.0, name: fn });
      if (s) put(PR()[fn]({ seed: rng.int(1, 9e4) }), s.x, s.z, s.y, rng() * U.TAU, g);
    }
    // rooftop clutter on the flat-ish roofs of the bigger buildings
    if (has(PR, 'rooftopKit')) {
      let n = 0;
      L.root.traverse((o) => {
        if (n > 9 || !o.userData || !o.userData.kind) return;
        if (!/apartment|warehouse|hotel|market/.test(o.userData.kind)) return;
        if (!rng.chance(0.7)) return;
        const box = new T.Box3().setFromObject(o);
        const kit = PR().rooftopKit({ seed: rng.int(1, 9e4), w: o.userData.footprint.w * 0.6, d: o.userData.footprint.d * 0.6, count: 3 });
        kit.position.set(o.position.x, box.max.y - 0.25, o.position.z);
        kit.rotation.y = o.rotation.y;
        g.add(kit);
        n++;
      });
    }
    return g;
  }

  /* ============================================================
     5 · DYNAMICS — traffic, tram, boats, crowds, sky traffic
     ============================================================ */
  function buildDynamics() {
    const g = G('dynamics');
    const R = (Roads.routes) || {};

    if (has(D, 'traffic')) {
      if (R.townLoop) g.add(D().traffic({ points: R.townLoop, count: 7, speed: 2.6, seed: 11, closed: true }));
      if (R.quayLoop) g.add(D().traffic({ points: R.quayLoop, count: 4, speed: 2.1, seed: 12, closed: true, types: ['van', 'truck', 'sedan'] }));
      if (R.fairLoop) g.add(D().traffic({ points: R.fairLoop, count: 3, speed: 2.2, seed: 13, closed: true }));
      if (R.terraceLoop) g.add(D().traffic({ points: R.terraceLoop, count: 3, speed: 1.9, seed: 14, closed: true, types: ['kei', 'sedan', 'van'] }));
    }
    if (has(D, 'tram') && R.tramLoop) g.add(D().tram({ points: R.tramLoop, seed: 15, speed: 3.1, cars: 2 }));

    if (has(D, 'trafficLight')) {
      for (const [x, z, r] of [[2.0, 1.0, 0.4], [-14.0, 1.0, -0.5], [2.0, -12.0, 2.6], [20.0, -12.0, 2.0]]) {
        const s = Island.sample(x, z);
        if (s.land) put(D().trafficLight({ seed: rng.int(1, 9e4) }), x, z, s.y, r, g);
      }
    }
    if (has(D, 'boats')) {
      if (R.bayBoats) g.add(D().boats({ points: R.bayBoats, count: 3, seed: 21, closed: true }));
      if (R.openSea) g.add(D().boats({ points: R.openSea, count: 5, seed: 22, closed: true }));
    }
    if (has(D, 'mooredBoats')) {
      g.add(D().mooredBoats({
        positions: [[13.6, 0, 25.5, 1.6], [13.7, 0, 29.5, 1.5], [19.7, 0, 20.2, 0.1],
          [26.6, 0, 27.0, -1.6], [26.7, 0, 31.0, -1.5], [10.5, 0, 34.5, 1.5], [-45.6, 0, 20.5, 1.6]],
        seed: 23,
      }));
    }
    if (has(D, 'ducks')) g.add(D().ducks({ points: [[-40, 0, -34], [-42, 0, -37], [-39, 0, -38]], count: 4, seed: 24 }));
    if (has(D, 'swan')) {
      const sw = D().swan({ seed: 25 });
      put(sw, Island.POND.x + 1.5, Island.POND.z + 0.5, (Island.pondY || 8) + 0.05, 1.2, g);
    }

    // crowds
    if (has(D, 'crowd')) {
      if (R.plazaWalk) g.add(D().crowd({ points: R.plazaWalk, count: 12, seed: 31, spread: 1.6, speed: 0.85, closed: true }));
      if (R.mainWalk) g.add(D().crowd({ points: R.mainWalk, count: 16, seed: 32, spread: 0.9, speed: 0.95, closed: true }));
      if (R.quayWalk) g.add(D().crowd({ points: R.quayWalk, count: 9, seed: 33, spread: 1.1, speed: 0.8, closed: true }));
      if (R.terraceWalk) g.add(D().crowd({ points: R.terraceWalk, count: 7, seed: 34, spread: 1.0, speed: 0.75, closed: true }));
    }
    for (const fn of ['dog', 'cat']) {
      if (!has(D, fn)) continue;
      for (let i = 0; i < 3; i++) {
        const s = site(1.2, 1.2, { near: [rng.bell() * 22, rng.bell() * 16], spread: 12, minRoad: 0.3, pad: 0.1, tries: 20, minY: 1.0, name: fn });
        if (s) put(D()[fn]({ seed: rng.int(1, 9e4) }), s.x, s.z, s.y, rng() * U.TAU, g);
      }
    }
    if (has(D, 'pigeons')) g.add(D().pigeons({ center: [Roads.PLAZA.x + 3, Roads.plazaY || 4.5, Roads.PLAZA.z - 2], count: 8, seed: 35 }));

    // sky
    if (has(D, 'birds')) {
      g.add(D().birds({ center: [-8, 32, -8], radius: 27, height: 32, count: 9, seed: 41 }));
      g.add(D().birds({ center: [26, 22, 26], radius: 16, height: 22, count: 6, seed: 42 }));
    }
    if (has(D, 'balloon')) g.add(D().balloon({ seed: 43, center: [-6, 0, -10], radius: 36, height: 32 }));

    // the cable car linking the town to the hilltop
    if (has(D, 'cableCar')) {
      g.add(D().cableCar({ a: [-12.0, TIERS.TOWN + 0.4, -30.0], b: [-32.0, TIERS.HILL + 0.6, -21.0], seed: 44, cabins: 2 }));
    }
    return g;
  }

  /* ============================================================
     6 · ATMOSPHERE — smoke, waterfalls, fireflies, petals, pools
     ============================================================ */
  function buildAtmosphere() {
    const g = G('fx');
    if (!has(FX, 'smoke')) return g;

    // chimney smoke on a selection of houses
    const houses = [];
    L.root.traverse((o) => {
      if (o.userData && o.userData.kind && /cottage|townhouse|villa|cafe|row|apartment|hotel|watermill|boathouse/.test(o.userData.kind)) houses.push(o);
    });
    rng.shuffle(houses);
    let smokes = 0;
    for (const o of houses) {
      if (smokes >= 11) break;
      if (!rng.chance(0.75)) continue;
      const box = new T.Box3().setFromObject(o);
      const fp = o.userData.footprint || { w: 5, d: 5 };
      const ox = rng.bell() * fp.w * 0.22, oz = rng.bell() * fp.d * 0.22;
      const c = Math.cos(o.rotation.y), s2 = Math.sin(o.rotation.y);
      g.add(FX().smoke({
        position: [o.position.x + ox * c - oz * s2, box.max.y + 0.35, o.position.z + ox * s2 + oz * c],
        seed: rng.int(1, 9e4), rate: rng.range(3.5, 6.5), size: rng.range(0.42, 0.62),
        spread: 0.22, rise: rng.range(0.9, 1.3),
      }));
      smokes++;
    }
    L.smokeCount = smokes;

    // waterfalls where the stream drops between terraces
    if (has(FX, 'waterfall')) {
      const sp = Geo.catmullPath(Island.STREAM.map((p) => [p[0], 0, p[1]]), false, 90).poly;
      const drops = [];
      for (let i = 2; i < sp.length - 2; i++) {
        const y0 = Island.heightAt(sp[i - 2][0], sp[i - 2][2]);
        const y1 = Island.heightAt(sp[i + 2][0], sp[i + 2][2]);
        drops.push({ i, d: y0 - y1, x: sp[i][0], z: sp[i][2], y: y0 });
      }
      drops.sort((a, b) => b.d - a.d);
      const used = [];
      let nf = 0;
      for (const dr of drops) {
        if (nf >= 3) break;
        if (dr.d < 0.7) break;
        if (used.some((u) => Math.hypot(u.x - dr.x, u.z - dr.z) < 9)) continue;
        used.push(dr);
        g.add(FX().waterfall({ position: [dr.x, dr.y + 0.3, dr.z], height: Math.min(4.2, dr.d + 0.9), width: 1.7, count: 120, seed: 50 + nf }));
        nf++;
      }
      L.waterfalls = nf;
    }

    // fireflies over the green tiers, petals under the sakura, motes in the sun
    if (has(FX, 'fireflies')) {
      for (const [x, z, r] of [[-40, -20, 9], [-33, 8, 8], [14, -41, 8], [-30, 28, 8], [4, -28, 7], [38, 2, 7]]) {
        g.add(FX().fireflies({ center: [x, Island.heightAt(x, z), z], radius: r, height: 2.8, count: 38, seed: rng.int(1, 9e4) }));
      }
    }
    if (has(FX, 'petals')) {
      const sak = [];
      L.root.traverse((o) => { if (o.userData && o.userData.kind === 'treeSakura') sak.push(o); });
      for (const t of sak.slice(0, 4)) {
        g.add(FX().petals({ center: [t.position.x, t.position.y, t.position.z], radius: 4.5, height: 6.5, count: 48, seed: rng.int(1, 9e4) }));
      }
    }
    if (has(FX, 'leaves')) {
      g.add(FX().leaves({ center: [-31.0, Island.heightAt(-31.0, -17.0), -17.0], radius: 6, height: 7, count: 34, seed: 61 }));
    }
    if (has(FX, 'dustMotes')) {
      g.add(FX().dustMotes({ center: [Roads.PLAZA.x, (Roads.plazaY || 4.5) + 1, Roads.PLAZA.z], radius: 12, height: 7, count: 44, seed: 62 }));
    }
    // light pools under every street lamp (cheap fake illumination)
    if (has(FX, 'lampPool') && L.lampPositions) {
      const step = Math.max(1, Math.ceil(L.lampPositions.length / 34));
      for (let i = 0; i < L.lampPositions.length; i += step) {
        const p = L.lampPositions[i];
        g.add(FX().lampPool({ position: [p[0], p[1] + 0.03, p[2]], color: P.lampWarm, radius: 2.6 }));
      }
    }
    // spray where the sea meets the rocks
    if (has(FX, 'seaSpray')) {
      for (let i = 0; i < 4; i++) {
        const a = [0.4, 2.3, 3.6, 5.1][i];
        for (let rr = 54; rr > 34; rr -= 1) {
          const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
          const s = Island.sample(x, z);
          if (s.land && s.y > 0.2 && s.y < 2.5) {
            g.add(FX().seaSpray({ position: [x, 0.25, z], dir: [Math.cos(a), 0, Math.sin(a)], seed: 70 + i }));
            break;
          }
        }
      }
    }
    if (has(FX, 'splash')) {
      for (const p of (Roads.piers || []).slice(0, 3)) {
        g.add(FX().splash({ position: [p[0], 0.06, p[2]], r: 1.1, seed: rng.int(1, 9e4) }));
      }
    }
    return g;
  }

  /* ============================================================
     BUILD
     ============================================================ */
  L.build = function (scene, opts) {
    opts = opts || {};
    rng = U.rng(opts.seed || 20250819);
    taken.length = 0;
    stats.placed = 0; stats.rejected = 0; stats.byKind = {}; stats.why = {}; stats.whyF = {};

    applyScales();
    for (const k in groups) delete groups[k];
    L.root = TOWN.group('town');
    buildRoadBoxes();
    buildStreamBoxes();
    const t0 = performance.now();

    // reserve the road corridors so nothing is ever built in the street
    buildSquare();
    buildCivic();
    buildTownStreets();
    buildHarbour();
    buildFair();
    buildTerrace();
    buildKnoll();
    buildHill();
    buildShore();
    buildInfill();
    buildGreen();
    buildFurniture();
    buildDynamics();
    buildAtmosphere();

    // safety net: flip any inverted solid before merging (a mis-wound mesh
    // renders as a hole, and this catches it whichever module produced it)
    const rep = Geo.repairOrientation(L.root);
    L.repaired = rep.fixed;
    if (rep.fixed) console.log('[TOWN] orientation repaired on ' + rep.fixed + ' of ' + rep.checked + ' solids');

    if (scene) scene.add(L.root);
    L.buildMs = performance.now() - t0;

    // collapse static detail into a handful of draw calls per district
    if (opts.merge !== false) {
      const m0 = performance.now();
      // dynamics/fx live in their own groups and are marked dynamic, so a
      // single pass over the root collapses every static district together
      Geo.mergeStatic(L.root);
      L.mergeMs = performance.now() - m0;
    }

    console.log('[TOWN] layout: ' + stats.placed + ' objects placed, ' + stats.rejected +
      ' rejected, ' + L.buildMs.toFixed(0) + 'ms build' +
      (L.mergeMs ? ' + ' + L.mergeMs.toFixed(0) + 'ms merge' : ''));
    return L.root;
  };

  L.groups = groups;
  console.log('[TOWN] layout ready');
})(window);
