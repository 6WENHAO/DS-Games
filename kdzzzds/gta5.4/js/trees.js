/* trees.js — 树木:递归分叉骨架 → 锥台枝干合并;叶簇=写实 SVG 卡片;远景自动切公告板(LOD)
   3 树种(悬铃木/银杏/棕榈)× 2 变体,几何共享 */
window.G = window.G || {};
(function () {
  const U = G.U;
  const T = {};
  G.TREE = T;

  let mats = null, variants = null;
  function ensureMats() {
    if (mats) return;
    const t = G.TEX.t;
    const leaf = (tex) => new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.9, metalness: 0 });
    mats = {
      bark: new THREE.MeshStandardMaterial({ map: t.bark.map, normalMap: t.bark.nrm, roughness: 0.95 }),
      palm: new THREE.MeshStandardMaterial({ map: t.palmT.map, roughness: 0.95 }),
      leafPlane: leaf(t.leafA.map), leafDry: leaf(t.leafAdry.map),
      leafGinkgo: leaf(t.leafB.map), leafPalm: leaf(t.leafC.map),
      bill: [0, 1, 2].map(i => new THREE.MeshBasicMaterial({ map: t.treeBill[i].map, alphaTest: 0.4, side: THREE.DoubleSide, fog: true }))
    };
    /* 公告板受雾影响、亮度贴近实照 */
    mats.bill.forEach(m => { m.color = new THREE.Color(0x9aa398); });
  }

  /* 递归分叉骨架 → 段列表 */
  function skeleton(kind, rng) {
    const segs = [], tips = [];
    function grow(pos, dir, len, rad, depth, maxDepth) {
      const bend = new THREE.Vector3(U.rand(rng, -1, 1), U.rand(rng, 0.2, 0.9), U.rand(rng, -1, 1)).normalize();
      const end = pos.clone().addScaledVector(dir, len);
      const mid = pos.clone().addScaledVector(dir, len * 0.5).addScaledVector(bend, len * 0.08);
      segs.push({ a: pos.clone(), m: mid, b: end, r0: rad, r1: rad * 0.62, depth });
      if (depth >= maxDepth) { tips.push({ pos: end, dir: dir.clone() }); return; }
      const nb = depth === 0 ? U.randi(rng, 3, 4) : U.randi(rng, 2, 3);
      for (let i = 0; i < nb; i++) {
        const spread = kind === 'ginkgo' ? U.rand(rng, 0.3, 0.7) : U.rand(rng, 0.5, 1.0);
        const axis = new THREE.Vector3(U.rand(rng, -1, 1), U.rand(rng, -0.2, 0.4), U.rand(rng, -1, 1)).normalize();
        const nd = dir.clone().applyAxisAngle(axis, spread).normalize();
        if (nd.y < 0.05) nd.y = Math.abs(nd.y) + 0.1;
        nd.normalize();
        grow(end, nd, len * U.rand(rng, 0.6, 0.75), rad * 0.58, depth + 1, maxDepth);
      }
      if (depth >= 1 && rng() < 0.5) tips.push({ pos: end, dir: dir.clone() });
    }
    if (kind === 'palm') {
      /* 弯曲单干 */
      const h = U.rand(rng, 5.5, 7.5);
      const lean = new THREE.Vector3(U.rand(rng, -1, 1), 0, U.rand(rng, -1, 1)).normalize().multiplyScalar(U.rand(rng, 0.06, 0.16));
      let p = new THREE.Vector3(0, 0, 0);
      const n = 5;
      for (let i = 0; i < n; i++) {
        const d = new THREE.Vector3(lean.x * i, 1, lean.z * i).normalize();
        const np = p.clone().addScaledVector(d, h / n);
        segs.push({ a: p.clone(), m: p.clone().lerp(np, 0.5), b: np, r0: 0.16 * (1 - i / n * 0.4), r1: 0.16 * (1 - (i + 1) / n * 0.4), depth: i });
        p = np;
      }
      tips.push({ pos: p, dir: new THREE.Vector3(0, 1, 0) });
      return { segs, tips, height: p.y };
    }
    const trunkH = kind === 'ginkgo' ? U.rand(rng, 2.0, 2.6) : U.rand(rng, 2.2, 3.0);
    grow(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), trunkH, kind === 'ginkgo' ? 0.17 : 0.21, 0, 2);
    let hMax = 0; tips.forEach(t2 => hMax = Math.max(hMax, t2.pos.y));
    return { segs, tips, height: hMax };
  }

  /* 段 → 锥台圆柱合并 */
  function branchGeo(segs) {
    const list = [];
    const up = new THREE.Vector3(0, 1, 0);
    for (const s of segs) {
      for (const [p0, p1, r0, r1] of [[s.a, s.m, s.r0, (s.r0 + s.r1) / 2], [s.m, s.b, (s.r0 + s.r1) / 2, s.r1]]) {
        const dir = new THREE.Vector3().subVectors(p1, p0);
        const len = dir.length();
        if (len < 0.01) continue;
        const g = new THREE.CylinderGeometry(Math.max(0.015, r1), Math.max(0.02, r0), len, s.depth === 0 ? 8 : 5, 1, true);
        g.translate(0, len / 2, 0);
        g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir.normalize())));
        g.translate(p0.x, p0.y, p0.z);
        list.push(g);
      }
    }
    return U.mergeGeos(list);
  }

  /* 叶簇卡片 */
  function leafGeo(kind, tips, rng) {
    const cards = [], dryCards = [];
    if (kind === 'palm') {
      const t2 = tips[0];
      for (let i = 0; i < 3; i++) {
        const g = new THREE.PlaneGeometry(4.6, 4.6);
        g.rotateX(-Math.PI / 2 + U.rand(rng, -0.14, 0.14));
        g.rotateY(i / 3 * Math.PI + U.rand(rng, -0.2, 0.2));
        g.translate(t2.pos.x, t2.pos.y + 0.25 + i * 0.13, t2.pos.z);
        cards.push(g);
      }
      const g2 = new THREE.PlaneGeometry(4.0, 4.0);
      g2.rotateX(-Math.PI / 2);
      g2.translate(t2.pos.x, t2.pos.y + 0.66, t2.pos.z);
      cards.push(g2);
      return { cards: U.mergeGeos(cards), dry: null };
    }
    for (const tip of tips) {
      const n = U.randi(rng, 3, 5);
      for (let i = 0; i < n; i++) {
        const s = U.rand(rng, 1.5, 2.6) * (kind === 'ginkgo' ? 0.85 : 1);
        const g = new THREE.PlaneGeometry(s, s);
        const jitter = new THREE.Vector3(U.rand(rng, -0.7, 0.7), U.rand(rng, -0.3, 0.8), U.rand(rng, -0.7, 0.7));
        g.rotateX(U.rand(rng, -0.6, 0.6));
        g.rotateY(U.rand(rng, 0, U.TAU));
        g.rotateZ(U.rand(rng, -0.5, 0.5));
        g.translate(tip.pos.x + jitter.x, tip.pos.y + jitter.y, tip.pos.z + jitter.z);
        (kind === 'plane' && rng() < 0.14 ? dryCards : cards).push(g);
      }
    }
    return {
      cards: cards.length ? U.mergeGeos(cards) : null,
      dry: dryCards.length ? U.mergeGeos(dryCards) : null
    };
  }

  function buildVariant(kind, seed) {
    const rng = U.rng(seed);
    const sk = skeleton(kind, rng);
    const branches = branchGeo(sk.segs);
    const leaves = leafGeo(kind, sk.tips, rng);
    let crownR = 0.5, crownY = sk.height;
    sk.tips.forEach(t2 => { crownR = Math.max(crownR, Math.hypot(t2.pos.x, t2.pos.z) + 1.4); });
    return { kind, branches, leaves, height: sk.height + (kind === 'palm' ? 1.2 : 1.6), crownR };
  }

  T.init = function () {
    ensureMats();
    variants = {};
    const kinds = ['plane', 'ginkgo', 'palm'];
    kinds.forEach((k, ki) => {
      variants[k] = [];
      for (let v = 0; v < 2; v++) variants[k].push(buildVariant(k, 7000 + ki * 31 + v * 7));
    });
  };

  const KIND_IDX = { plane: 0, ginkgo: 1, palm: 2 };
  T.build = function (kind, seed) {
    ensureMats();
    if (!variants) T.init();
    const rng = U.rng(seed == null ? (Math.random() * 1e9) | 0 : seed + 1);
    const V = U.pick(rng, variants[kind]);
    const lod = new THREE.LOD();
    const near = new THREE.Group();
    const barkMat = kind === 'palm' ? mats.palm : mats.bark;
    const bm = new THREE.Mesh(V.branches, barkMat);
    bm.castShadow = true;
    near.add(bm);
    const leafMat = kind === 'palm' ? mats.leafPalm : (kind === 'ginkgo' ? mats.leafGinkgo : mats.leafPlane);
    if (V.leaves.cards) { const lm = new THREE.Mesh(V.leaves.cards, leafMat); lm.castShadow = true; near.add(lm); }
    if (V.leaves.dry) near.add(new THREE.Mesh(V.leaves.dry, mats.leafDry));
    lod.addLevel(near, 0);
    /* 远景:交叉双面板 */
    const far = new THREE.Group();
    const bw = V.crownR * 2.2, bh = V.height;
    for (let i = 0; i < 2; i++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), mats.bill[KIND_IDX[kind]]);
      p.position.y = bh / 2;
      p.rotation.y = i * Math.PI / 2 + 0.4;
      far.add(p);
    }
    lod.addLevel(far, 78);
    const scale = U.rand(rng, 0.85, 1.2);
    lod.scale.setScalar(scale);
    lod.rotation.y = rng() * U.TAU;
    return { group: lod, radius: 0.30 * scale, height: V.height * scale, crownR: V.crownR * scale };
  };
})();
