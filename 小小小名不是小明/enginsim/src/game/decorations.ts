import * as THREE from 'three';
import type { Track } from './track';
import { makeTreeTexture, makeChainlinkTexture, makeBannerTexture, toonMat } from './textures';

function curvePose(track: Track, t: number, lateral: number): { pos: THREE.Vector3; yaw: number } {
  const p = track.curve.getPointAt(t % 1);
  const tan = track.curve.getTangentAt(t % 1);
  const len = Math.hypot(tan.x, tan.z) || 1;
  const nx = -tan.z / len, nz = tan.x / len;
  return {
    pos: new THREE.Vector3(p.x + nx * lateral, p.y, p.z + nz * lateral),
    yaw: Math.atan2(tan.z, tan.x)
  };
}

function buildTrees(track: Track): THREE.Object3D {
  const tex = makeTreeTexture();
  const mat = toonMat({
    map: tex, alphaTest: 0.45, side: THREE.DoubleSide
  });
  const p1 = new THREE.PlaneGeometry(5.4, 8.1);
  p1.translate(0, 4.05, 0);
  const p2 = p1.clone();
  p2.rotateY(Math.PI / 2);

  const COUNT = 340;
  const m1 = new THREE.InstancedMesh(p1, mat, COUNT);
  const m2 = new THREE.InstancedMesh(p2, mat, COUNT);
  const mtx = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const col = new THREE.Color();
  let placed = 0, guard = 0;
  while (placed < COUNT && guard++ < 12000) {
    const ang = Math.random() * Math.PI * 2;
    const rad = Math.sqrt(Math.random());
    const x = Math.cos(ang) * rad * 300;
    const z = -85 + Math.sin(ang) * rad * 280;
    const d = track.distanceToCenter(x, z);
    if (d < track.halfWidth + 6.5) continue;
    const dense = d < 40 ? 1 : Math.random() < 0.55 ? 1 : 0;
    if (!dense) continue;
    const s = 0.65 + Math.random() * 1.0;
    q.setFromAxisAngle(up, Math.random() * Math.PI);
    mtx.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s, s * (0.9 + Math.random() * 0.25), s));
    m1.setMatrixAt(placed, mtx);
    m2.setMatrixAt(placed, mtx);
    col.setHSL(0.3 + Math.random() * 0.05, 0.35 + Math.random() * 0.2, 0.5 + Math.random() * 0.22);
    m1.setColorAt(placed, col);
    m2.setColorAt(placed, col);
    placed++;
  }
  m1.count = m2.count = placed;
  const g = new THREE.Group();
  g.add(m1, m2);
  return g;
}

function buildTireWalls(track: Track): THREE.Object3D {
  const tGeo = new THREE.TorusGeometry(0.37, 0.155, 6, 10);
  tGeo.rotateX(Math.PI / 2);
  const mat = toonMat({ color: 0x1c1e20 });
  const spots = [
    { t: 0.115, side: 1 }, { t: 0.24, side: 1 }, { t: 0.40, side: 1 },
    { t: 0.55, side: -1 }, { t: 0.80, side: 1 }, { t: 0.87, side: -1 }
  ];
  const perWall = 14 * 2 + 12;
  const mesh = new THREE.InstancedMesh(tGeo, mat, spots.length * perWall);
  const mtx = new THREE.Matrix4();
  const col = new THREE.Color();
  let n = 0;
  for (const spot of spots) {
    const { pos, yaw } = curvePose(track, spot.t, (track.halfWidth + 2.6) * spot.side);
    const tx = Math.cos(yaw), tz = Math.sin(yaw);
    const nx = -tz * spot.side, nz = tx * spot.side;
    for (let layer = 0; layer < 3; layer++) {
      const cnt = layer < 2 ? 14 : 12;
      const rowOff = layer < 2 ? layer * 0.78 : 0.39;
      const y = layer < 2 ? 0.16 : 0.47;
      for (let i = 0; i < cnt; i++) {
        const along = (i - cnt / 2) * 0.78;
        mtx.makeTranslation(
          pos.x + tx * along + nx * rowOff,
          pos.y + y,
          pos.z + tz * along + nz * rowOff
        );
        mesh.setMatrixAt(n, mtx);
        col.set(i % 4 === 0 ? 0xd8d4cc : 0x1c1e20);
        mesh.setColorAt(n, col);
        n++;
      }
    }
  }
  mesh.count = n;
  mesh.castShadow = true;
  return mesh;
}

function buildFences(track: Track): THREE.Object3D {
  const g = new THREE.Group();
  const tex = makeChainlinkTexture();
  tex.repeat.set(1, 1);
  const fenceMat = toonMat({
    map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false
  });
  const postGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6);
  const postMat = toonMat({ color: 0x707880 });

  const sections = [
    { t0: 0.03, t1: 0.20, side: 1 },
    { t0: 0.30, t1: 0.44, side: 1 },
    { t0: 0.52, t1: 0.635, side: -1 },
    { t0: 0.80, t1: 0.94, side: 1 }
  ];
  const posts: THREE.Matrix4[] = [];
  for (const sec of sections) {
    const steps = Math.max(8, Math.round((sec.t1 - sec.t0) * 160));
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    let arc = 0;
    let prev: THREE.Vector3 | null = null;
    for (let i = 0; i <= steps; i++) {
      const t = sec.t0 + (sec.t1 - sec.t0) * (i / steps);
      const { pos: p } = curvePose(track, t, (track.halfWidth + 3.8) * sec.side);
      if (prev) arc += p.distanceTo(prev);
      prev = p;
      pos.push(p.x, p.y + 0.05, p.z, p.x, p.y + 2.35, p.z);
      uv.push(arc / 2.3, 0, arc / 2.3, 1.15);
      if (i % 3 === 0) {
        posts.push(new THREE.Matrix4().makeTranslation(p.x, p.y + 1.2, p.z));
      }
    }
    for (let i = 0; i < steps; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, fenceMat));
  }
  const postMesh = new THREE.InstancedMesh(postGeo, postMat, posts.length);
  posts.forEach((m, i) => postMesh.setMatrixAt(i, m));
  g.add(postMesh);
  return g;
}

function buildPitBuilding(track: Track): THREE.Object3D {
  const g = new THREE.Group();
  const { pos, yaw } = curvePose(track, 0.965, track.halfWidth + 12);
  const wall = toonMat({ color: 0x9aa0a8 });
  const dark = toonMat({ color: 0x22262c });

  const main = new THREE.Mesh(new THREE.BoxGeometry(20, 4.6, 7.5), wall);
  main.position.y = 2.3;
  main.castShadow = true;
  g.add(main);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(21.4, 0.35, 8.8), dark);
  roof.position.y = 4.75;
  roof.castShadow = true;
  g.add(roof);

  for (let i = 0; i < 4; i++) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.1, 0.12), dark);
    door.position.set(-7.2 + i * 4.8, 1.55, -3.76);
    g.add(door);
  }

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 2),
    new THREE.MeshBasicMaterial({ map: makeBannerTexture('P I T', '#c8332a', '#ffffff') })
  );
  sign.position.set(0, 3.6, -3.83);
  sign.rotation.y = Math.PI;
  g.add(sign);

  g.position.copy(pos);
  g.rotation.y = -yaw;
  return g;
}

function buildGantry(track: Track): THREE.Object3D {
  const g = new THREE.Group();
  const { pos, yaw } = curvePose(track, 0.0, 0);
  const hw = track.halfWidth + 1.8;
  const metal = toonMat({ color: 0x3a4048 });

  for (const s of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 6.4, 0.55), metal);
    pillar.position.set(0, 3.2, hw * s);
    pillar.castShadow = true;
    g.add(pillar);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.25, hw * 2 + 0.6), metal);
  beam.position.y = 6.15;
  beam.castShadow = true;
  g.add(beam);

  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(hw * 2, 1.15),
    new THREE.MeshBasicMaterial({ map: makeBannerTexture('ENGINSIM V8 RACEWAY', '#12151c', '#ffb060', true), side: THREE.DoubleSide })
  );
  banner.position.y = 6.15;
  banner.rotation.y = -Math.PI / 2;
  banner.position.x = -0.32;
  g.add(banner);

  g.position.copy(pos);
  g.rotation.y = -yaw;
  return g;
}

function buildBillboards(track: Track): THREE.Object3D {
  const g = new THREE.Group();
  const ads: Array<[string, string, string]> = [
    ['V8  P O W E R', '#8f1e14', '#ffe9c8'],
    ['ENGINSIM AUDIO', '#101a2e', '#7fc4ee'],
    ['CROSSPLANE RACING', '#b06010', '#141414'],
    ['BURBLE  &  ROAR', '#e4e2da', '#8f1e14']
  ];
  const spots = [
    { t: 0.06, side: -1 }, { t: 0.335, side: -1 },
    { t: 0.60, side: 1 }, { t: 0.82, side: -1 }
  ];
  const legMat = toonMat({ color: 0x3a4048 });
  spots.forEach((spot, i) => {
    const { pos, yaw } = curvePose(track, spot.t, (track.halfWidth + 7) * spot.side);
    const board = new THREE.Group();
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 3.4),
      toonMat({ map: makeBannerTexture(...ads[i % ads.length]), side: THREE.DoubleSide })
    );
    panel.position.y = 3.6;
    panel.castShadow = true;
    board.add(panel);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.8, 0.25), legMat);
      leg.position.set(s * 3.6, 1.9, -0.15);
      leg.castShadow = true;
      board.add(leg);
    }
    board.position.copy(pos);
    board.rotation.y = -yaw + (spot.side > 0 ? Math.PI : 0);
    g.add(board);
  });
  return g;
}

export function buildDecorations(track: Track): THREE.Group {
  const g = new THREE.Group();
  g.add(
    buildTrees(track),
    buildTireWalls(track),
    buildFences(track),
    buildPitBuilding(track),
    buildGantry(track),
    buildBillboards(track)
  );
  return g;
}
