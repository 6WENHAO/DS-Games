/**
 * Static props: roadside stones, meadow boulders, a split-rail fence, the kerb
 * that borders the garden plot, a signpost and a bench.
 *
 * All merged into one draw call with the same toon material family as the trees,
 * minus the wind sway.
 */
import * as THREE from 'three';
import { PALETTE } from '../core/config.js';
import { Rng, clamp, lerp } from './noise.js';
import { MeshAccumulator, makeBlob, makeChamferBox, makeTube } from './geoBuilder.js';
import { createToonMaterial } from '../gfx/toonMaterial.js';
import { PLOT } from './plot.js';

function stonePainter(rng) {
  const cols = [
    PALETTE.stone.clone().multiplyScalar(0.62),
    PALETTE.stone,
    PALETTE.stoneLit,
    PALETTE.stoneLit.clone().lerp(new THREE.Color('#ffffff'), 0.18),
  ];
  return (normal) => {
    const up = clamp(normal.y * 0.5 + 0.5, 0, 1);
    const t = clamp(up * 0.72 + rng.next() * 0.28, 0, 1);
    const i = Math.min(cols.length - 1, Math.floor(t * cols.length));
    return cols[i];
  };
}

function woodPainter(rng, base = PALETTE.bark, lit = PALETTE.barkLit) {
  return (normal) => {
    const up = clamp(normal.y * 0.5 + 0.5, 0, 1);
    const t = clamp(up * 0.7 + rng.next() * 0.3, 0, 1);
    return base.clone().lerp(lit, t);
  };
}

export function createProps(terrain) {
  const rng = new Rng(0x7d31c1);
  const acc = new MeshAccumulator({ sway: false, vertexColors: true });
  const shadeCircles = [];
  const stone = stonePainter(rng);
  const wood = woodPainter(rng);
  const plankWood = woodPainter(rng, PALETTE.crateBand, PALETTE.crate);

  const put = (geo, pos, { rotY = 0, scale = 1, color }) => {
    const m = new THREE.Matrix4()
      .makeRotationY(rotY)
      .premultiply(new THREE.Matrix4().makeScale(scale, scale, scale));
    m.setPosition(pos.x, pos.y, pos.z);
    acc.add(geo, m, { color });
  };

  /* ---- stones along the road shoulder ---- */
  const road = terrain.road;
  for (let i = 0; i < 130; i += 1) {
    const t = rng.next();
    const d = t * road.length;
    const p = road.pointAtDistance(d, new THREE.Vector3());
    const tan = road.tangentAtDistance(d, new THREE.Vector3());
    const side = rng.next() < 0.5 ? 1 : -1;
    const off = lerp(1.9, 3.4, rng.next()) * side;
    const x = p.x - tan.z * off;
    const z = p.z + tan.x * off;
    if (Math.hypot(x, z) > terrain.half - 4) continue;
    if (terrain.sampleLawn(x, z) > 0.05) continue;
    const r = lerp(0.14, 0.42, rng.next() ** 1.7);
    const y = terrain.sampleHeight(x, z) + r * 0.32;
    put(makeBlob(r, { jitter: 0.4, squash: lerp(0.5, 0.8, rng.next()), rng }),
      new THREE.Vector3(x, y, z), { color: stone, rotY: rng.next() * 6.28 });
  }

  /* ---- meadow boulders: larger anchors for the composition ---- */
  for (let i = 0; i < 16; i += 1) {
    const a = rng.next() * Math.PI * 2;
    const rad = lerp(12, 50, rng.next());
    const x = Math.cos(a) * rad;
    const z = Math.sin(a) * rad;
    if (terrain.samplePath(x, z) > 0.05 || terrain.sampleLawn(x, z) > 0.02) continue;
    const r = lerp(0.7, 1.8, rng.next());
    const y = terrain.sampleHeight(x, z) + r * 0.28;
    put(makeBlob(r, { jitter: 0.42, squash: lerp(0.45, 0.7, rng.next()), rng }),
      new THREE.Vector3(x, y, z), { color: stone, rotY: rng.next() * 6.28 });
    shadeCircles.push({ x, z, radius: r * 2.1, strength: 0.3 });
  }

  /* ---- split-rail fence along one stretch of the road ---- */
  const fenceStart = road.length * 0.30;
  const fenceEnd = road.length * 0.46;
  const postGap = 2.4;
  const postCount = Math.floor((fenceEnd - fenceStart) / postGap);
  let prevTop = null;
  for (let i = 0; i <= postCount; i += 1) {
    const d = fenceStart + i * postGap;
    const p = road.pointAtDistance(d, new THREE.Vector3());
    const tan = road.tangentAtDistance(d, new THREE.Vector3());
    const off = 3.1;
    const x = p.x - tan.z * off;
    const z = p.z + tan.x * off;
    const groundY = terrain.sampleHeight(x, z);
    const height = lerp(1.02, 1.22, rng.next());
    put(makeChamferBox(0.15, height, 0.15, 0.03),
      new THREE.Vector3(x, groundY + height * 0.5 - 0.06, z),
      { color: wood, rotY: Math.atan2(tan.x, tan.z) });
    const top = new THREE.Vector3(x, groundY + height * 0.78, z);
    if (prevTop) {
      // Two rails per bay, sagging slightly.
      for (let r = 0; r < 2; r += 1) {
        const drop = r === 0 ? 0.0 : 0.34;
        const a = prevTop.clone().add(new THREE.Vector3(0, -drop, 0));
        const b = top.clone().add(new THREE.Vector3(0, -drop, 0));
        const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, -0.06, 0));
        acc.add(makeTube([a, mid, b], [0.055, 0.062, 0.055], 4),
          new THREE.Matrix4(), { color: wood });
      }
    }
    prevTop = top;
  }

  /* ---- kerb around the garden plot: the frame the puzzle sits inside ---- */
  const kerbStep = 1.5;
  const hw = PLOT.halfW;
  const hd = PLOT.halfD;
  // Corners in the plot's own frame, so the kerb squares up with the board.
  const corners = [
    new THREE.Vector2(-hw, -hd),
    new THREE.Vector2(hw, -hd),
    new THREE.Vector2(hw, hd),
    new THREE.Vector2(-hw, hd),
  ];
  const boardToWorld = (u, v) => PLOT.toWorld(u, v, new THREE.Vector3());
  for (let e = 0; e < 4; e += 1) {
    const a = corners[e];
    const b = corners[(e + 1) % 4];
    const len = a.distanceTo(b);
    const steps = Math.max(2, Math.round(len / kerbStep));
    for (let i = 0; i < steps; i += 1) {
      const t = (i + 0.5) / steps;
      const u = a.x + (b.x - a.x) * t;
      const v = a.y + (b.y - a.y) * t;
      // Leave a gap in the far edge: the road runs along that side of the plot,
      // so that is where the way in belongs.
      if (v > hd - 0.6 && Math.abs(u) < 2.6) continue;
      const ju = u + (rng.next() - 0.5) * 0.24;
      const jv = v + (rng.next() - 0.5) * 0.24;
      const p = boardToWorld(ju, jv);
      const along = lerp(1.05, 1.45, rng.next());
      const h = lerp(0.3, 0.46, rng.next());
      p.y = terrain.sampleHeight(p.x, p.z) + h * 0.42;
      const edgeDir = boardToWorld(b.x, b.y).sub(boardToWorld(a.x, a.y));
      // Local +Z is rotated onto the edge, so `along` runs with the kerb and the
      // 0.6 m face is what the lawn looks at.
      put(makeChamferBox(0.6, h, along, 0.07), p, {
        color: stone,
        rotY: Math.atan2(edgeDir.x, edgeDir.z) + (rng.next() - 0.5) * 0.18,
      });
    }
  }

  /* ---- stepping stones from the road up to the entrance ---- */
  const entrance = boardToWorld(0, hd + 0.5);
  const roadHit = road.nearest(entrance.x, entrance.z);
  const roadPoint = road.points[roadHit.index];
  for (let i = 0; i < 8; i += 1) {
    const t = (i + 0.5) / 8;
    const p = new THREE.Vector3().lerpVectors(roadPoint, entrance, t);
    p.x += (rng.next() - 0.5) * 0.5;
    p.z += (rng.next() - 0.5) * 0.5;
    const y = terrain.sampleHeight(p.x, p.z) + 0.06;
    put(makeChamferBox(lerp(0.7, 1.0, rng.next()), 0.16, lerp(0.6, 0.9, rng.next()), 0.05),
      new THREE.Vector3(p.x, y, p.z), { color: stone, rotY: rng.next() * 6.28 });
  }

  /* ---- signpost at the near corner, its boards turned to the viewer ---- */
  {
    const sp = boardToWorld(-hw - 1.5, -hd - 1.4);
    const gy = terrain.sampleHeight(sp.x, sp.z);
    const face = PLOT.rotation;
    put(makeChamferBox(0.16, 2.15, 0.16, 0.035),
      new THREE.Vector3(sp.x, gy + 1.02, sp.z), { color: wood, rotY: face });
    const board1 = boardToWorld(-hw - 1.0, -hd - 1.28);
    put(makeChamferBox(1.5, 0.52, 0.1, 0.05),
      new THREE.Vector3(board1.x, gy + 1.72, board1.z), { color: plankWood, rotY: face });
    put(makeChamferBox(1.1, 0.4, 0.09, 0.04),
      new THREE.Vector3(board1.x, gy + 1.16, board1.z), { color: plankWood, rotY: face });
    shadeCircles.push({ x: sp.x, z: sp.z, radius: 1.6, strength: 0.22 });
  }

  /* ---- bench inside the plot's near-right corner, facing the board ---- */
  {
    const bp = boardToWorld(hw + 1.5, -hd + 3.4);
    const gy = terrain.sampleHeight(bp.x, bp.z);
    const rotY = PLOT.rotation - Math.PI * 0.5;
    const rot = new THREE.Matrix4().makeRotationY(rotY);
    const part = (geo, dx, dy, dz) => {
      const mat = new THREE.Matrix4().copy(rot);
      const p = new THREE.Vector3(dx, 0, dz).applyMatrix4(rot);
      mat.setPosition(bp.x + p.x, gy + dy, bp.z + p.z);
      acc.add(geo, mat, { color: plankWood });
    };
    part(makeChamferBox(1.9, 0.12, 0.52, 0.04), 0, 0.5, 0);
    part(makeChamferBox(1.9, 0.44, 0.1, 0.04), 0, 0.78, -0.22);
    part(makeChamferBox(0.14, 0.5, 0.46, 0.03), -0.8, 0.25, 0);
    part(makeChamferBox(0.14, 0.5, 0.46, 0.03), 0.8, 0.25, 0);
    shadeCircles.push({ x: bp.x, z: bp.z, radius: 1.9, strength: 0.28 });
  }

  const material = createToonMaterial({
    vertexColors: true,
    rim: 0.18,
    specular: 0.05,
    translucency: 0.06,
    shadeFloor: 0.03,
  });
  const mesh = acc.build(material, 'props');
  return { mesh, material, shadeCircles };
}
