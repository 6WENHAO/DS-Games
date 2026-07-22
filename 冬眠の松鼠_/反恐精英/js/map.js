// ============================================================
//  map.js  -  builds a de_dust2-inspired arena.
//  Layout (top-down, z- = CT side/top, z+ = T side/bottom):
//
//     [ B SITE ]   [ CT SPAWN ]   [ A SITE ]      z (-)
//         |            |             |
//     B tunnels  <  MID lane  >   A long
//         |            |             |
//              [   T  SPAWN   ]                    z (+)
//
//  Two solid "buildings" divide the field into 3 lanes.
//  Catwalk (mid->A) and mid-window (mid->B) gaps included.
// ============================================================
import * as THREE from "three";
import { TEAM } from "./config.js";

function makeNoiseTexture(base, spots, spotColor, rep = 4) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < spots; i++) {
    const x = Math.random() * 128, y = Math.random() * 128;
    const r = Math.random() * 10 + 2;
    g.fillStyle = spotColor.replace("A", (Math.random() * 0.15 + 0.03).toFixed(2));
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rep, rep);
  return t;
}

export function buildMap(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const colliders = [];   // {minX,minZ,maxX,maxZ,minY,maxY,nav}
  const worldMeshes = []; // meshes for bullet raycasts

  // ---- textures / materials ----
  const groundTex = makeNoiseTexture("#b8a074", 500, "rgba(90,70,40,A)", 24);
  const wallTex = makeNoiseTexture("#c2a878", 260, "rgba(120,95,55,A)", 3);
  const wallTex2 = makeNoiseTexture("#a89268", 260, "rgba(90,70,45,A)", 2);
  const crateTex = makeNoiseTexture("#8a6a3a", 120, "rgba(60,40,20,A)", 1);

  const matGround = new THREE.MeshLambertMaterial({ map: groundTex });
  const matWall = new THREE.MeshLambertMaterial({ map: wallTex });
  const matWall2 = new THREE.MeshLambertMaterial({ map: wallTex2 });
  const matCrate = new THREE.MeshLambertMaterial({ map: crateTex });

  const B = 46; // half-extent of playable area

  // ---- ground ----
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(B * 2, B * 2), matGround);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);
  worldMeshes.push(ground);

  // helper: add a solid box (building/wall/crate) centered on ground
  function addBox(x, z, w, d, h, mat = matWall, opts = {}) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, h / 2 + (opts.y || 0), z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    worldMeshes.push(mesh);
    colliders.push({
      minX: x - w / 2, maxX: x + w / 2,
      minZ: z - d / 2, maxZ: z + d / 2,
      minY: opts.y || 0, maxY: (opts.y || 0) + h,
      nav: opts.nav !== false,
    });
    return mesh;
  }

  const WALL_H = 8;

  // ---- perimeter walls ----
  addBox(0, B, B * 2, 2, WALL_H, matWall2);   // +z (behind T)
  addBox(0, -B, B * 2, 2, WALL_H, matWall2);  // -z (behind CT)
  addBox(-B, 0, 2, B * 2, WALL_H, matWall2);  // -x
  addBox(B, 0, 2, B * 2, WALL_H, matWall2);   // +x

  // ---- lane divider buildings (with gaps for catwalk & mid window) ----
  // Right divider (between MID and A). Gap = catwalk (mid->A)
  addBox((6 + 24) / 2, (-8 + 4) / 2, 18, 12, WALL_H, matWall);          // R1 z[-8..4]
  addBox((6 + 24) / 2, (10 + 22) / 2, 18, 12, WALL_H, matWall);         // R2 z[10..22]
  // Left divider (between MID and B). Gap = mid window (mid->B)
  addBox((-24 - 6) / 2, (-8 + 6) / 2, 18, 14, WALL_H, matWall);         // L1 z[-8..6]
  addBox((-24 - 6) / 2, (12 + 22) / 2, 18, 10, WALL_H, matWall);        // L2 z[12..22]

  // ---- mid doors (thin wall with center gap) ----
  addBox(-4, 8, 4, 1.2, 5, matWall2);
  addBox(4, 8, 4, 1.2, 5, matWall2);

  // ---- cover crates (stackable, low, non-nav-blocking where possible) ----
  const crate = (x, z, s = 2, h = 2, y = 0) => addBox(x, z, s, s, h, matCrate, { y, nav: false });

  // A site crates
  crate(30, -24, 2.4, 2.4); crate(30, -24, 2.4, 2.0, 2.4); // stacked
  crate(36, -20, 2.2, 2.2);
  crate(26, -30, 2.6, 3.0);
  crate(38, -30, 2.2, 2.2);
  crate(22, -18, 2.0, 1.6); // "car"-ish
  // B site crates
  crate(-30, -24, 2.4, 2.4); crate(-30, -24, 2.4, 2.0, 2.4);
  crate(-36, -22, 2.2, 2.2);
  crate(-26, -30, 2.6, 3.0);
  crate(-38, -30, 2.2, 2.2);
  crate(-22, -16, 2.0, 1.6);
  // Mid / lane cover
  crate(0, 20, 2.4, 2.2);   // T side mid
  crate(0, -2, 2.0, 1.8);   // mid
  crate(34, 20, 2.4, 2.4);  // long
  crate(34, -2, 2.2, 2.0);  // long/A entrance
  crate(-34, 20, 2.4, 2.4); // tunnels
  crate(-34, -2, 2.2, 2.0); // B entrance
  crate(0, -34, 2.2, 1.6);  // CT spawn cover

  // ---- bombsite floor decals ----
  function siteDecal(x, z, letter, color) {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    g.clearRect(0, 0, 256, 256);
    g.strokeStyle = color; g.lineWidth = 10;
    g.strokeRect(16, 16, 224, 224);
    g.fillStyle = color; g.font = "bold 200px Arial"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(letter, 128, 138);
    const tex = new THREE.CanvasTexture(c);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 10),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.5, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.04, z);
    group.add(m);
  }
  siteDecal(32, -26, "A", "#ffdb4d");
  siteDecal(-32, -26, "B", "#ff7043");

  // ---- lighting ----
  const hemi = new THREE.HemisphereLight(0xfff4d6, 0x88724a, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0cc, 1.15);
  sun.position.set(40, 70, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 200;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  const amb = new THREE.AmbientLight(0xffffff, 0.25);
  scene.add(amb);

  // sky
  scene.background = new THREE.Color(0x9ec4e0);
  scene.fog = new THREE.Fog(0xcfd9dc, 60, 150);

  // ---- spawns ----
  const spawns = {
    [TEAM.T]: [
      new THREE.Vector3(-8, 0, 38), new THREE.Vector3(0, 0, 40), new THREE.Vector3(8, 0, 38),
      new THREE.Vector3(-4, 0, 42), new THREE.Vector3(4, 0, 42),
    ],
    [TEAM.CT]: [
      new THREE.Vector3(-8, 0, -38), new THREE.Vector3(0, 0, -40), new THREE.Vector3(8, 0, -38),
      new THREE.Vector3(-4, 0, -42), new THREE.Vector3(4, 0, -42),
    ],
  };

  // ---- bombsites ----
  const bombsites = {
    A: { center: new THREE.Vector3(32, 0, -26), minX: 22, maxX: 44, minZ: -40, maxZ: -12 },
    B: { center: new THREE.Vector3(-32, 0, -26), minX: -44, maxX: -22, minZ: -40, maxZ: -12 },
  };

  // ---- navigation graph (visibility grid) ----
  const nav = buildNav(colliders, B);

  return {
    group, colliders, worldMeshes, spawns, bombsites, nav,
    bounds: { minX: -B, maxX: B, minZ: -B, maxZ: B },
  };
}

// Segment vs AABB (2D, XZ) intersection test used for nav LOS & bullets-2D
export function segmentBlocked(colliders, x1, z1, x2, z2, pad = 0.4) {
  for (const c of colliders) {
    if (!c.nav) continue;
    const minX = c.minX - pad, maxX = c.maxX + pad, minZ = c.minZ - pad, maxZ = c.maxZ + pad;
    if (segAabb(x1, z1, x2, z2, minX, minZ, maxX, maxZ)) return true;
  }
  return false;
}

function segAabb(x1, z1, x2, z2, minX, minZ, maxX, maxZ) {
  // Liang-Barsky
  let t0 = 0, t1 = 1;
  const dx = x2 - x1, dz = z2 - z1;
  const p = [-dx, dx, -dz, dz];
  const q = [x1 - minX, maxX - x1, z1 - minZ, maxZ - z1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return false; }
    else {
      const r = q[i] / p[i];
      if (p[i] < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
      else { if (r < t0) return false; if (r < t1) t1 = r; }
    }
  }
  return true;
}

function buildNav(colliders, B) {
  const nodes = [];
  const step = 5;
  const inside = (x, z) => {
    for (const c of colliders) {
      if (!c.nav) continue;
      if (x > c.minX - 1.2 && x < c.maxX + 1.2 && z > c.minZ - 1.2 && z < c.maxZ + 1.2) return true;
    }
    return false;
  };
  for (let x = -B + 3; x <= B - 3; x += step) {
    for (let z = -B + 3; z <= B - 3; z += step) {
      if (!inside(x, z)) nodes.push({ x, z, id: nodes.length, edges: [] });
    }
  }
  const maxLink = step * 1.7;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d <= maxLink && !segmentBlocked(colliders, a.x, a.z, b.x, b.z, 0.6)) {
        a.edges.push({ to: j, cost: d });
        b.edges.push({ to: i, cost: d });
      }
    }
  }
  return { nodes };
}

// BFS/greedy path over nav graph -> returns array of {x,z}
export function findPath(nav, from, to) {
  const nodes = nav.nodes;
  if (!nodes.length) return [];
  const near = (p) => {
    let best = -1, bd = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const d = (nodes[i].x - p.x) ** 2 + (nodes[i].z - p.z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  };
  const s = near(from), g = near(to);
  if (s < 0 || g < 0) return [];
  // A*
  const open = [s];
  const came = new Array(nodes.length).fill(-1);
  const gScore = new Array(nodes.length).fill(Infinity);
  const fScore = new Array(nodes.length).fill(Infinity);
  gScore[s] = 0;
  const h = (i) => Math.hypot(nodes[i].x - nodes[g].x, nodes[i].z - nodes[g].z);
  fScore[s] = h(s);
  const inOpen = new Set([s]);
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (fScore[open[i]] < fScore[open[bi]]) bi = i;
    const cur = open.splice(bi, 1)[0];
    inOpen.delete(cur);
    if (cur === g) {
      const path = [];
      let n = cur;
      while (n !== -1) { path.push({ x: nodes[n].x, z: nodes[n].z }); n = came[n]; }
      return path.reverse();
    }
    for (const e of nodes[cur].edges) {
      const tentative = gScore[cur] + e.cost;
      if (tentative < gScore[e.to]) {
        came[e.to] = cur;
        gScore[e.to] = tentative;
        fScore[e.to] = tentative + h(e.to);
        if (!inOpen.has(e.to)) { open.push(e.to); inOpen.add(e.to); }
      }
    }
  }
  return [];
}
