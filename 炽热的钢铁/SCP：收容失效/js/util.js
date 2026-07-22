window.SCP = window.SCP || {};
(function (S) {
  S.hashStr = function (str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
  S.mulberry32 = function (a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  S.makeRng = function (seedStr) {
    const f = S.mulberry32(S.hashStr(String(seedStr)));
    const rng = {
      next: f,
      range: (a, b) => a + f() * (b - a),
      int: (a, b) => Math.floor(a + f() * (b - a + 1)),
      pick: (arr) => arr[Math.floor(f() * arr.length)],
      chance: (p) => f() < p,
      shuffle: (arr) => {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(f() * (i + 1));
          const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        }
        return arr;
      }
    };
    return rng;
  };
  S.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  S.lerp = (a, b, t) => a + (b - a) * t;
  S.dist2d = (x1, z1, x2, z2) => Math.hypot(x2 - x1, z2 - z1);
  S.angleLerp = function (a, b, t) {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  };

  S.CELL = 8;
  S.worldX = (c) => (c - 4) * S.CELL;
  S.worldZ = (r) => -r * S.CELL;
  S.colOf = (x) => Math.round(x / S.CELL + 4);
  S.rowOf = (z) => Math.round(-z / S.CELL);

  S.texturedBoxGeo = function (w, h, d, uvScale) {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    const s = uvScale || 4;
    for (let f = 0; f < 6; f++) {
      for (let v = 0; v < 4; v++) {
        const i = f * 4 + v;
        uv.setXY(i, uv.getX(i) * dims[f][0] / s, uv.getY(i) * dims[f][1] / s);
      }
    }
    return g;
  };

  S.mergeGeos = function (list) {
    let total = 0;
    const parts = [];
    for (const item of list) {
      let g = item.geo.toNonIndexed ? item.geo.toNonIndexed() : item.geo;
      if (g.index) g = g.toNonIndexed();
      g.clearGroups();
      if (item.matrix) g.applyMatrix4(item.matrix);
      parts.push(g);
      total += g.attributes.position.count;
    }
    const pos = new Float32Array(total * 3);
    const nor = new Float32Array(total * 3);
    const uv = new Float32Array(total * 2);
    let o = 0;
    for (const g of parts) {
      pos.set(g.attributes.position.array, o * 3);
      nor.set(g.attributes.normal.array, o * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
      o += g.attributes.position.count;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return out;
  };

  S.boxAt = function (x, y, z, w, h, d, ry) {
    const m = new THREE.Matrix4();
    if (ry) {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0));
      m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
    } else {
      m.makeTranslation(x, y, z);
    }
    return m;
  };

  S.aabb = function (x, z, hw, hd, y0, y1) {
    return { x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd, y0: y0 === undefined ? 0 : y0, y1: y1 === undefined ? 3 : y1 };
  };
  S.pointInAabb = function (x, y, z, b) {
    return x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && y >= b.y0 && y <= b.y1;
  };
  S.circleVsAabb = function (px, pz, r, b) {
    const cx = S.clamp(px, b.x0, b.x1);
    const cz = S.clamp(pz, b.z0, b.z1);
    const dx = px - cx, dz = pz - cz;
    return dx * dx + dz * dz < r * r;
  };
  S.resolveCircle = function (px, pz, r, boxes) {
    let x = px, z = pz;
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (const b of boxes) {
        const cx = S.clamp(x, b.x0, b.x1);
        const cz = S.clamp(z, b.z0, b.z1);
        let dx = x - cx, dz = z - cz;
        let d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 < 1e-9) {
          const l = Math.min(x - b.x0, b.x1 - x);
          const t = Math.min(z - b.z0, b.z1 - z);
          if (l < t) { x = (x - b.x0 < b.x1 - x) ? b.x0 - r : b.x1 + r; }
          else { z = (z - b.z0 < b.z1 - z) ? b.z0 - r : b.z1 + r; }
        } else {
          const d = Math.sqrt(d2);
          x = cx + (dx / d) * r;
          z = cz + (dz / d) * r;
        }
        moved = true;
      }
      if (!moved) break;
    }
    return { x, z };
  };
})(window.SCP);
