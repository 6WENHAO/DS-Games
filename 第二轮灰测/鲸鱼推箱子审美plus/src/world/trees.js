/**
 * Procedural trees and the landscape composition.
 *
 * Five species are generated from the same low-poly kit (faceted tubes, jittered
 * icosahedral canopy blobs, cone tiers) and merged into one draw call. Every
 * canopy vertex carries a sway weight and its trunk's world anchor, so the
 * canopies bend on the same stop-motion wind clock as the grass.
 *
 * The layout is composed, not scattered: the framing pair reads as a proscenium
 * around the title view, a single specimen holds the third-line focal point,
 * groves come in odd numbers at receding depths, a conifer ridge closes the
 * horizon, understorey shrubs tie each mass to the ground, and the road corridor
 * and garden plot are left as open negative space.
 */
import * as THREE from 'three';
import { PALETTE } from '../core/config.js';
import { Rng, clamp, lerp } from './noise.js';
import { MeshAccumulator, makeTube, makeBlob, makeCone } from './geoBuilder.js';
import { createToonMaterial } from '../gfx/toonMaterial.js';
import { groundFrame } from '../core/cameraRig.js';
import { PLOT } from './plot.js';

/* ---------------- palettes ---------------- */

function ramp(colors, t) {
  const s = clamp(t, 0, 1) * (colors.length - 1);
  const i = Math.floor(s);
  const f = s - i;
  const a = colors[i];
  const b = colors[Math.min(colors.length - 1, i + 1)];
  return new THREE.Color(a.r + (b.r - a.r) * f, a.g + (b.g - a.g) * f, a.b + (b.b - a.b) * f);
}

/** Per-facet canopy colour: up-facing facets read lit, undersides read deep. */
function canopyPainter(colors, rng, dapple = 0.34) {
  return (normal) => {
    const up = clamp(normal.y * 0.5 + 0.5, 0, 1);
    const t = clamp(up * (1 - dapple) + rng.next() * dapple, 0, 1);
    return ramp(colors, t);
  };
}

function barkPainter(rng) {
  const colors = [PALETTE.bark, PALETTE.bark, PALETTE.barkLit];
  return (normal) => {
    const side = clamp(normal.x * 0.35 + normal.y * 0.5 + 0.5, 0, 1);
    return ramp(colors, clamp(side * 0.75 + rng.next() * 0.25, 0, 1));
  };
}

const LEAF_SUMMER = [PALETTE.leafDeep, PALETTE.leafMid, PALETTE.leafMid, PALETTE.leafLit];
const LEAF_PALE = [
  PALETTE.leafDeep.clone().lerp(PALETTE.leafMid, 0.4),
  PALETTE.leafMid.clone().lerp(PALETTE.grassLit, 0.35),
  PALETTE.leafLit,
  PALETTE.leafLit.clone().lerp(PALETTE.grassTip, 0.5),
];
const LEAF_CONIFER = [
  PALETTE.leafDeep.clone().multiplyScalar(0.72),
  PALETTE.leafDeep,
  PALETTE.leafMid.clone().lerp(PALETTE.leafDeep, 0.45),
  PALETTE.leafMid,
];
const LEAF_ORNAMENT = [
  PALETTE.leafDeep.clone().lerp(PALETTE.grassDry, 0.15),
  PALETTE.leafMid.clone().lerp(PALETTE.grassDry, 0.3),
  PALETTE.grassDry.clone().lerp(PALETTE.leafLit, 0.5),
  PALETTE.grassTip,
];

/* ---------------- trunk helper ---------------- */

function trunkSpine(height, lean, curve, rng, segments = 5) {
  const spine = [];
  const dir = new THREE.Vector2(Math.cos(lean), Math.sin(lean));
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const bend = curve * t * t;
    spine.push(new THREE.Vector3(dir.x * bend, height * t, dir.y * bend));
  }
  // Slight kink so no trunk is perfectly straight.
  for (let i = 1; i < spine.length - 1; i += 1) {
    spine[i].x += (rng.next() - 0.5) * height * 0.035;
    spine[i].z += (rng.next() - 0.5) * height * 0.035;
  }
  return spine;
}

/* ---------------- species ---------------- */

const SPECIES = {
  /** Broadleaf: heavy trunk, branch spread, dome of overlapping canopy blobs. */
  oak(acc, base, scale, rng, phase) {
    const height = 4.6 * scale;
    const spine = trunkSpine(height, rng.next() * Math.PI * 2, height * 0.09, rng, 5);
    const radii = spine.map((_, i) => lerp(0.44, 0.17, i / (spine.length - 1)) * scale);
    const m = new THREE.Matrix4().makeTranslation(base.x, base.y, base.z);
    acc.add(makeTube(spine, radii, 6), m, {
      color: barkPainter(rng),
      sway: (p) => (clamp((p.y - base.y) / height, 0, 1) ** 1.7) * 0.34,
      origin: base,
      phase,
    });

    // Two lifted branches read as structure without adding real cost.
    for (let i = 0; i < 2; i += 1) {
      const a = rng.next() * Math.PI * 2;
      const at = lerp(0.52, 0.74, rng.next());
      const from = spine[Math.round(at * (spine.length - 1))].clone();
      const len = height * lerp(0.3, 0.46, rng.next());
      const br = [
        from,
        from.clone().add(new THREE.Vector3(Math.cos(a) * len * 0.45, len * 0.34, Math.sin(a) * len * 0.45)),
        from.clone().add(new THREE.Vector3(Math.cos(a) * len, len * 0.62, Math.sin(a) * len)),
      ];
      acc.add(makeTube(br, [0.16 * scale, 0.11 * scale, 0.06 * scale], 5), m, {
        color: barkPainter(rng),
        sway: (p) => (clamp((p.y - base.y) / height, 0, 1) ** 1.5) * 0.5,
        origin: base,
        phase,
      });
    }

    const paint = canopyPainter(LEAF_SUMMER, rng);
    const blobs = 5 + Math.floor(rng.next() * 3);
    const top = spine[spine.length - 1];
    for (let i = 0; i < blobs; i += 1) {
      const a = (i / blobs) * Math.PI * 2 + rng.next() * 0.7;
      const rad = lerp(0.55, 1.75, rng.next()) * scale;
      const r = lerp(1.5, 2.35, rng.next()) * scale;
      const cy = height * lerp(0.9, 1.28, rng.next()) - height * 0.05;
      const centre = new THREE.Vector3(
        base.x + top.x + Math.cos(a) * rad,
        base.y + cy,
        base.z + top.z + Math.sin(a) * rad,
      );
      const mm = new THREE.Matrix4().makeTranslation(centre.x, centre.y, centre.z);
      acc.add(makeBlob(r, { jitter: 0.26, squash: lerp(0.72, 0.95, rng.next()), rng }), mm, {
        color: paint,
        sway: 0.72 + rng.next() * 0.3,
        origin: base,
        phase,
      });
    }
    return { radius: 3.1 * scale, strength: 0.6, height: height * 1.35 };
  },

  /** Slim upright: pale foliage, vertical canopy, good for depth layers. */
  birch(acc, base, scale, rng, phase) {
    const height = 6.2 * scale;
    const spine = trunkSpine(height, rng.next() * Math.PI * 2, height * 0.05, rng, 5);
    const radii = spine.map((_, i) => lerp(0.2, 0.09, i / (spine.length - 1)) * scale);
    const m = new THREE.Matrix4().makeTranslation(base.x, base.y, base.z);
    const pale = [PALETTE.barkLit.clone().lerp(new THREE.Color('#e8e2d2'), 0.55), PALETTE.barkLit, PALETTE.bark];
    acc.add(makeTube(spine, radii, 5), m, {
      color: (normal) => ramp(pale, clamp(normal.y * 0.3 + 0.55 + (rng.next() - 0.5) * 0.4, 0, 1)),
      sway: (p) => (clamp((p.y - base.y) / height, 0, 1) ** 1.4) * 0.46,
      origin: base,
      phase,
    });

    const paint = canopyPainter(LEAF_PALE, rng, 0.4);
    const tiers = 3;
    for (let i = 0; i < tiers; i += 1) {
      const t = i / (tiers - 1);
      const r = lerp(1.5, 0.85, t) * scale;
      const centre = new THREE.Vector3(
        base.x + (rng.next() - 0.5) * 0.5 * scale,
        base.y + height * lerp(0.62, 1.12, t),
        base.z + (rng.next() - 0.5) * 0.5 * scale,
      );
      const mm = new THREE.Matrix4().makeTranslation(centre.x, centre.y, centre.z);
      acc.add(makeBlob(r, { jitter: 0.3, squash: 1.28, rng }), mm, {
        color: paint,
        sway: 0.8 + t * 0.28,
        origin: base,
        phase,
      });
    }
    return { radius: 1.9 * scale, strength: 0.4, height: height * 1.15 };
  },

  /** Conifer: cone tiers, dark silhouette. Reserved for the ridge line. */
  conifer(acc, base, scale, rng, phase) {
    const height = 7.5 * scale;
    const spine = trunkSpine(height * 0.55, rng.next() * 6.28, height * 0.02, rng, 3);
    const m = new THREE.Matrix4().makeTranslation(base.x, base.y, base.z);
    acc.add(makeTube(spine, [0.26 * scale, 0.2 * scale, 0.15 * scale, 0.1 * scale], 5), m, {
      color: barkPainter(rng),
      sway: 0.06,
      origin: base,
      phase,
    });

    const paint = canopyPainter(LEAF_CONIFER, rng, 0.3);
    const tiers = 4;
    for (let i = 0; i < tiers; i += 1) {
      const t = i / (tiers - 1);
      const r = lerp(1.85, 0.62, t) * scale;
      const h = lerp(2.5, 1.5, t) * scale;
      const y = base.y + lerp(0.16, 0.72, t) * height;
      const mm = new THREE.Matrix4().makeTranslation(
        base.x + (rng.next() - 0.5) * 0.22 * scale,
        y,
        base.z + (rng.next() - 0.5) * 0.22 * scale,
      );
      acc.add(makeCone(r, h, 7), mm, {
        color: paint,
        sway: 0.12 + t * 0.34,
        origin: base,
        phase,
      });
    }
    return { radius: 2.0 * scale, strength: 0.5, height: height * 1.05 };
  },

  /** Wide low ornamental: the specimen tree, a broad flat crown. */
  ornament(acc, base, scale, rng, phase) {
    const height = 3.9 * scale;
    const spine = trunkSpine(height, rng.next() * 6.28, height * 0.18, rng, 5);
    const radii = spine.map((_, i) => lerp(0.5, 0.2, i / (spine.length - 1)) * scale);
    const m = new THREE.Matrix4().makeTranslation(base.x, base.y, base.z);
    acc.add(makeTube(spine, radii, 6), m, {
      color: barkPainter(rng),
      sway: (p) => (clamp((p.y - base.y) / height, 0, 1) ** 1.8) * 0.3,
      origin: base,
      phase,
    });

    const paint = canopyPainter(LEAF_ORNAMENT, rng, 0.42);
    const blobs = 7;
    const top = spine[spine.length - 1];
    for (let i = 0; i < blobs; i += 1) {
      const a = (i / blobs) * Math.PI * 2 + rng.next() * 0.4;
      const rad = lerp(1.1, 2.5, rng.next()) * scale;
      const r = lerp(1.35, 2.0, rng.next()) * scale;
      const centre = new THREE.Vector3(
        base.x + top.x + Math.cos(a) * rad,
        base.y + height * lerp(0.92, 1.06, rng.next()),
        base.z + top.z + Math.sin(a) * rad,
      );
      const mm = new THREE.Matrix4().makeTranslation(centre.x, centre.y, centre.z);
      acc.add(makeBlob(r, { jitter: 0.24, squash: 0.56, rng }), mm, {
        color: paint,
        sway: 0.85 + rng.next() * 0.35,
        origin: base,
        phase,
      });
    }
    return { radius: 3.8 * scale, strength: 0.52, height: height * 1.2 };
  },

  /** Understorey shrub: ties tree masses to the ground plane. */
  shrub(acc, base, scale, rng, phase) {
    const paint = canopyPainter(LEAF_SUMMER, rng, 0.44);
    const blobs = 2 + Math.floor(rng.next() * 2);
    for (let i = 0; i < blobs; i += 1) {
      const a = rng.next() * Math.PI * 2;
      const rad = rng.next() * 0.65 * scale;
      const r = lerp(0.62, 1.1, rng.next()) * scale;
      const mm = new THREE.Matrix4().makeTranslation(
        base.x + Math.cos(a) * rad,
        base.y + r * lerp(0.5, 0.78, rng.next()),
        base.z + Math.sin(a) * rad,
      );
      acc.add(makeBlob(r, { jitter: 0.34, squash: 0.78, rng }), mm, {
        color: paint,
        sway: 0.55 + rng.next() * 0.3,
        origin: base,
        phase,
      });
    }
    return { radius: 1.35 * scale, strength: 0.34, height: 1.4 * scale };
  },
};

/* ---------------- composition ---------------- */

/**
 * @param {object} terrain
 * @param {{menu:object, play:object}} cameras camera configs from config.js
 */
export function composeLandscape(terrain, cameras) {
  const rng = new Rng(0x2f1a77);
  const acc = new MeshAccumulator({ sway: true, vertexColors: true });
  const shadeCircles = [];
  const placed = [];

  const menuFrame = groundFrame(cameras.menu.yaw);
  const menuTarget = cameras.menu.target;

  /** Screen-space placement helper for the title framing. */
  const shot = (right, depth) => new THREE.Vector3(
    menuTarget.x + menuFrame.right.x * right + menuFrame.depth.x * depth,
    0,
    menuTarget.z + menuFrame.right.z * right + menuFrame.depth.z * depth,
  );

  /**
   * Places one tree, nudging it off the road and off the garden plot. Returns
   * false when no clear spot was found within the search budget.
   */
  function place(species, pos, scale, { minGap = 2.6, tries = 14 } = {}) {
    let p = pos.clone();
    for (let attempt = 0; attempt < tries; attempt += 1) {
      const onRoad = terrain.samplePath(p.x, p.z) > 0.06;
      const onPlot = terrain.sampleLawn(p.x, p.z) > 0.02;
      const inPlotClearance = PLOT.edgeDistance(p.x, p.z) < 2.2;
      let tooClose = false;
      for (const q of placed) {
        if (q.distanceTo(p) < minGap) { tooClose = true; break; }
      }
      if (!onRoad && !onPlot && !inPlotClearance && !tooClose
          && Math.hypot(p.x, p.z) < terrain.half - 3) {
        const base = new THREE.Vector3(p.x, terrain.sampleHeight(p.x, p.z) - 0.12, p.z);
        const info = SPECIES[species](acc, base, scale, rng, rng.next());
        shadeCircles.push({ x: p.x, z: p.z, radius: info.radius * 1.5, strength: info.strength });
        placed.push(p.clone());
        return true;
      }
      // Walk away from the obstruction along a deterministic spiral.
      const a = attempt * 2.399;
      const step = 1.6 + attempt * 0.7;
      p = pos.clone().add(new THREE.Vector3(Math.cos(a) * step, 0, Math.sin(a) * step));
    }
    return false;
  }

  /* -- proscenium: two heavy oaks at the outer edges of the title framing -- */
  place('oak', shot(-25.5, 4.5), 1.42, { minGap: 4 });
  place('oak', shot(27.0, 1.0), 1.28, { minGap: 4 });
  place('shrub', shot(-22.0, 1.5), 1.15);
  place('shrub', shot(24.0, -2.5), 1.0);

  /* -- focal specimen on the right third, mid depth -- */
  place('ornament', shot(9.5, 21.0), 1.5, { minGap: 5 });
  place('shrub', shot(7.0, 17.5), 0.95);
  place('shrub', shot(12.5, 18.0), 0.85);

  /* -- grove of five, left third, further back -- */
  const groveA = shot(-15.0, 26.0);
  const groveOffsets = [[0, 0], [3.6, 2.2], [-3.2, 3.0], [1.4, 5.6], [-5.4, -1.4]];
  groveOffsets.forEach(([dx, dz], i) => {
    place(i % 2 === 0 ? 'oak' : 'birch', groveA.clone().add(new THREE.Vector3(dx, 0, dz)),
      lerp(0.95, 1.25, rng.next()), { minGap: 3.2 });
  });
  place('shrub', groveA.clone().add(new THREE.Vector3(1.0, 0, -3.0)), 1.05);

  /* -- grove of three, right, deepest layer -- */
  const groveB = shot(22.0, 31.0);
  [[0, 0], [4.2, 2.6], [-3.4, 3.4]].forEach(([dx, dz]) => {
    place('birch', groveB.clone().add(new THREE.Vector3(dx, 0, dz)), lerp(1.0, 1.3, rng.next()), { minGap: 3 });
  });

  /* -- a lone birch just off the road bend: reads as a waypoint -- */
  place('birch', shot(-4.0, 12.0), 1.1, { minGap: 3.2 });

  /* -- garden plot: a matched pair frames the road-side entrance -- */
  const boardPos = (u, v) => {
    const p = PLOT.toWorld(u, v, new THREE.Vector3());
    p.y = 0;
    return p;
  };
  place('ornament', boardPos(-PLOT.halfW - 3.6, -PLOT.halfD - 2.6), 1.05, { minGap: 3 });
  place('ornament', boardPos(PLOT.halfW + 3.6, -PLOT.halfD - 2.6), 1.05, { minGap: 3 });
  /* -- and heavy shade trees behind it, holding the far corners -- */
  place('oak', boardPos(PLOT.halfW + 5.2, PLOT.halfD + 4.6), 1.5, { minGap: 4 });
  place('oak', boardPos(-PLOT.halfW - 5.6, PLOT.halfD + 3.2), 1.2, { minGap: 4 });
  for (let i = 0; i < 8; i += 1) {
    const u = lerp(-PLOT.halfW - 1.5, PLOT.halfW + 1.5, rng.next());
    const v = PLOT.halfD + 2.4 + rng.next() * 2.6;
    place('shrub', boardPos(u, v), lerp(0.8, 1.15, rng.next()), { minGap: 2.2 });
  }

  /* -- conifer ridge: silhouette on the rim hills, closing the horizon -- */
  const ridgeCount = 46;
  for (let i = 0; i < ridgeCount; i += 1) {
    const a = (i / ridgeCount) * Math.PI * 2 + rng.next() * 0.06;
    const r = lerp(58, 71, rng.next());
    const p = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
    place(rng.next() < 0.78 ? 'conifer' : 'birch', p, lerp(0.9, 1.4, rng.next()), { minGap: 3.4, tries: 6 });
  }

  /* -- mid-distance filler at low density, keeping the basin floor open -- */
  for (let i = 0; i < 26; i += 1) {
    const a = rng.next() * Math.PI * 2;
    const r = lerp(30, 54, rng.next());
    const p = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
    const pick = rng.next();
    place(pick < 0.4 ? 'oak' : pick < 0.75 ? 'birch' : 'shrub', p, lerp(0.85, 1.25, rng.next()), { minGap: 4.5, tries: 5 });
  }

  const material = createToonMaterial({
    sway: true,
    vertexColors: true,
    rim: 0.2,
    translucency: 0.5,
    specular: 0.0,
    swayStrength: 0.2,
    shadeFloor: 0.02,
  });
  const mesh = acc.build(material, 'trees');

  /** Canopy occlusion query used to darken the grass beneath the masses. */
  const shadeQuery = (x, z) => {
    let s = 0;
    for (const c of shadeCircles) {
      const d = Math.hypot(x - c.x, z - c.z);
      if (d > c.radius) continue;
      s += (1 - (d / c.radius) ** 1.6) * c.strength;
    }
    return clamp(s, 0, 0.85);
  };

  return { mesh, material, shadeCircles, shadeQuery, count: placed.length };
}
