import * as THREE from 'three';
import { makeAsphaltTexture, makeCurbTexture, makeGrassTexture, makeCheckerTexture, makeRockGradientTexture, toonMat } from './textures';

const CONTROL_POINTS: Array<[number, number, number]> = [
  [-40, 0, 0.7], [60, 0, 0.7], [125, -25, 2.3], [155, -85, 4.3], [125, -150, 3.1], [45, -175, 1.3],
  [-25, -140, 0.7], [-90, -165, 2.5], [-155, -125, 5.3], [-175, -60, 6.3], [-145, 5, 3.3], [-95, 30, 1.3]
];

export const TUNNEL_T0 = 0.655;
export const TUNNEL_T1 = 0.775;

export class Track {
  curve: THREE.CatmullRomCurve3;
  halfWidth = 6;
  curbWidth = 1.15;
  group = new THREE.Group();
  private centers: THREE.Vector3[] = [];
  private N = 640;

  constructor() {
    const pts = CONTROL_POINTS.map(([x, z, y]) => new THREE.Vector3(x, y, z));
    this.curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5);
    this.build();
    this.buildGuardrails();
    this.buildTunnel();
    this.buildGrandstand();
  }

  private frame(t: number) {
    const p = this.curve.getPointAt(t % 1);
    const tan = this.curve.getTangentAt(t % 1);
    const len = Math.hypot(tan.x, tan.z) || 1;
    return { p, nx: -tan.z / len, nz: tan.x / len, tx: tan.x / len, tz: tan.z / len };
  }

  private build() {
    const N = this.N;
    const hw = this.halfWidth, cw = this.curbWidth;

    const roadPos: number[] = [], roadUv: number[] = [], roadIdx: number[] = [];
    const curbPos: number[] = [], curbUv: number[] = [], curbIdx: number[] = [];
    const skirtPos: number[] = [], skirtIdx: number[] = [];
    let arc = 0;
    let prev = this.curve.getPointAt(0);

    for (let i = 0; i <= N; i++) {
      const t = (i % N) / N;
      const { p, nx, nz } = this.frame(t);
      if (i > 0) arc += p.distanceTo(prev);
      prev = p;
      if (i < N) this.centers.push(p.clone());

      const y = p.y + 0.01;
      roadPos.push(p.x - nx * hw, y, p.z - nz * hw, p.x + nx * hw, y, p.z + nz * hw);
      roadUv.push(0, arc / 12, 1, arc / 12);

      for (const s of [-1, 1]) {
        const ix = p.x + nx * hw * s, iz = p.z + nz * hw * s;
        const ox = p.x + nx * (hw + cw) * s, oz = p.z + nz * (hw + cw) * s;
        curbPos.push(ix, p.y + 0.035, iz, ox, p.y + 0.02, oz);
        curbUv.push(0, arc / 2.6, 1, arc / 2.6);

        skirtPos.push(ox, p.y + 0.02, oz, ox, -0.1, oz);
      }
    }

    for (let i = 0; i < N; i++) {
      const a = i * 2;
      roadIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      for (const off of [0, 2]) {
        const b = i * 4 + off;
        curbIdx.push(b, b + 1, b + 4, b + 1, b + 5, b + 4);
        skirtIdx.push(b, b + 1, b + 4, b + 1, b + 5, b + 4);
      }
    }

    const mkGeo = (pos: number[], uv: number[] | null, idx: number[]) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    };

    const road = new THREE.Mesh(mkGeo(roadPos, roadUv, roadIdx), toonMat({ map: makeAsphaltTexture() }));
    road.receiveShadow = true;
    this.group.add(road);

    const curb = new THREE.Mesh(mkGeo(curbPos, curbUv, curbIdx), toonMat({ map: makeCurbTexture() }));
    curb.receiveShadow = true;
    this.group.add(curb);

    const skirt = new THREE.Mesh(
      mkGeo(skirtPos, null, skirtIdx),
      toonMat({ color: 0x527a40, side: THREE.DoubleSide })
    );
    this.group.add(skirt);

    const grassTex = makeGrassTexture();
    grassTex.repeat.set(120, 120);
    const grass = new THREE.Mesh(new THREE.CircleGeometry(1000, 48), toonMat({ map: grassTex }));
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.02;
    grass.receiveShadow = true;
    this.group.add(grass);

    const start = this.startPose();
    const checker = new THREE.Mesh(
      new THREE.PlaneGeometry(3, hw * 2),
      toonMat({ map: makeCheckerTexture() })
    );
    checker.rotation.x = -Math.PI / 2;
    checker.rotation.z = -start.yaw;
    checker.position.set(start.pos.x, start.pos.y + 0.025, start.pos.z);
    this.group.add(checker);
  }

  private buildGuardrails() {
    const N = 320;
    const hw = this.halfWidth;
    const railMat = toonMat({ color: 0xb8c2cc, side: THREE.DoubleSide });
    const postGeo = new THREE.BoxGeometry(0.13, 0.85, 0.13);
    const postMat = toonMat({ color: 0x4a525c });
    const postMats: THREE.Matrix4[] = [];

    for (const side of [-1, 1]) {
      const pos: number[] = [], idx: number[] = [];
      let vi = 0;
      let open = false;
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const inTunnel = t > TUNNEL_T0 - 0.01 && t < TUNNEL_T1 + 0.01;
        if (inTunnel) { open = false; continue; }
        const { p, nx, nz } = this.frame(t);
        const ox = p.x + nx * (hw + 1.8) * side;
        const oz = p.z + nz * (hw + 1.8) * side;
        pos.push(ox, p.y + 0.3, oz, ox, p.y + 0.78, oz);
        if (open) {
          const a = vi - 2;
          idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
        vi += 2;
        open = true;
        if (i % 4 === 0) {
          postMats.push(new THREE.Matrix4().makeTranslation(ox, p.y + 0.42, oz));
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      const rail = new THREE.Mesh(g, railMat);
      rail.castShadow = true;
      this.group.add(rail);
    }
    const posts = new THREE.InstancedMesh(postGeo, postMat, postMats.length);
    postMats.forEach((m, i) => posts.setMatrixAt(i, m));
    this.group.add(posts);
  }

  private buildTunnel() {
    const M = 46, K = 12;
    const hw = this.halfWidth + 2.6;
    const archH = 6.2;

    const wallPos: number[] = [], wallUv: number[] = [], wallIdx: number[] = [];
    for (let i = 0; i <= M; i++) {
      const t = TUNNEL_T0 + (TUNNEL_T1 - TUNNEL_T0) * (i / M);
      const { p, nx, nz } = this.frame(t);
      for (let k = 0; k <= K; k++) {
        const ang = Math.PI - (k / K) * Math.PI;
        const lx = Math.cos(ang) * hw;
        const ly = Math.sin(ang) * archH;
        wallPos.push(p.x + nx * lx, p.y + ly, p.z + nz * lx);
        wallUv.push(k / K * 4, i / M * 26);
      }
    }
    for (let i = 0; i < M; i++) {
      for (let k = 0; k < K; k++) {
        const a = i * (K + 1) + k;
        const b = a + K + 1;
        wallIdx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    const wallGeo = new THREE.BufferGeometry();
    wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(wallPos, 3));
    wallGeo.setAttribute('uv', new THREE.Float32BufferAttribute(wallUv, 2));
    wallGeo.setIndex(wallIdx);
    wallGeo.computeVertexNormals();
    const wall = new THREE.Mesh(wallGeo, toonMat({ color: 0x6a635a, side: THREE.DoubleSide }));
    this.group.add(wall);

    for (const tEnd of [TUNNEL_T0, TUNNEL_T1]) {
      const { p, tx, tz } = this.frame(tEnd);
      const portalGeo = new THREE.TorusGeometry(hw + 0.5, 1.0, 4, 18, Math.PI);
      const portal = new THREE.Mesh(portalGeo, toonMat({ color: 0x9aa0a8 }));
      portal.position.set(p.x, p.y + 0.5, p.z);
      portal.rotation.y = Math.atan2(tx, tz);
      portal.scale.set(1, archH / (hw + 0.5), 1);
      this.group.add(portal);
    }

    const rockTex = makeRockGradientTexture();
    const MM = 40, MK = 18;
    const W = 30;
    const shellW = hw + 1.2;
    const shellH = archH + 1.0;
    const mPos: number[] = [], mUv: number[] = [], mIdx: number[] = [];
    for (let i = 0; i <= MM; i++) {
      const u = i / MM;
      const t = TUNNEL_T0 + (TUNNEL_T1 - TUNNEL_T0) * u;
      const { p, nx, nz } = this.frame(t);
      const taper = Math.pow(Math.sin(Math.PI * u), 0.75);
      const H = 4 + 12.5 * taper;
      for (let k = 0; k <= MK; k++) {
        const lat = -W + (2 * W * k) / MK;
        const edge = 1 - Math.pow(Math.abs(lat) / W, 4);
        const shell = Math.abs(lat) < shellW
          ? Math.sqrt(1 - (lat / shellW) * (lat / shellW)) * shellH
          : 0;
        const bell = H * Math.exp(-(lat * lat) / (2 * 13 * 13));
        const jitter = Math.sin(i * 12.9898 + k * 78.233) * 0.9 * taper * (bell > shell ? 1 : 0.15);
        const h = Math.max(shell, bell * edge) + jitter;
        const y = Math.max(0, p.y * Math.min(1, edge * 1.4) + Math.max(0, h));
        mPos.push(p.x + nx * lat, y, p.z + nz * lat);
        mUv.push(k / MK * 5, THREE.MathUtils.clamp(y / 20, 0, 1));
      }
    }
    for (let i = 0; i < MM; i++) {
      for (let k = 0; k < MK; k++) {
        const a = i * (MK + 1) + k;
        const b = a + MK + 1;
        mIdx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const mGeo = new THREE.BufferGeometry();
    mGeo.setAttribute('position', new THREE.Float32BufferAttribute(mPos, 3));
    mGeo.setAttribute('uv', new THREE.Float32BufferAttribute(mUv, 2));
    mGeo.setIndex(mIdx);
    mGeo.computeVertexNormals();
    const mound = new THREE.Mesh(mGeo, toonMat({ map: rockTex, side: THREE.DoubleSide }));
    mound.castShadow = true;
    this.group.add(mound);
  }

  private buildGrandstand() {
    const g = new THREE.Group();
    const { p, nx, nz, tx, tz } = this.frame(0.035);
    const side = -1;
    const base = new THREE.Vector3(
      p.x + nx * (this.halfWidth + 11) * side, p.y, p.z + nz * (this.halfWidth + 11) * side
    );
    const yaw = Math.atan2(tz, tx);

    const stepMat = toonMat({ color: 0x8a9098 });
    const rows = 6;
    for (let r = 0; r < rows; r++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(26, 0.55, 1.5), stepMat);
      step.position.set(0, 0.28 + r * 0.62, -(r * 1.5));
      step.castShadow = true;
      g.add(step);
    }

    const crowdColors = [0xe05545, 0x3fae6a, 0x3a80d0, 0xd8a832, 0xe8e4dc, 0x9a55c8];
    const seatGeo = new THREE.BoxGeometry(0.34, 0.42, 0.34);
    const crowd = new THREE.InstancedMesh(seatGeo, toonMat({ color: 0xffffff }), rows * 30);
    const mtx = new THREE.Matrix4();
    const col = new THREE.Color();
    let n = 0;
    let s = 7;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < 30; i++) {
        if (rnd() < 0.25) continue;
        mtx.makeTranslation(-12.2 + i * 0.84 + (rnd() - 0.5) * 0.2, 0.78 + r * 0.62, -(r * 1.5) + (rnd() - 0.5) * 0.3);
        crowd.setMatrixAt(n, mtx);
        col.set(crowdColors[Math.floor(rnd() * crowdColors.length)]);
        crowd.setColorAt(n, col);
        n++;
      }
    }
    crowd.count = n;
    g.add(crowd);

    const roofMat = toonMat({ color: 0x38404c });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(27, 0.25, 10.5), roofMat);
    roof.position.set(0, 5.4, -3.8);
    roof.rotation.x = 0.1;
    roof.castShadow = true;
    g.add(roof);
    for (const px of [-12.5, 12.5]) {
      for (const pz of [0.5, -8]) {
        const pole = new THREE.Mesh(new THREE.BoxGeometry(0.22, 5.4, 0.22), roofMat);
        pole.position.set(px, 2.7, pz);
        g.add(pole);
      }
    }
    const wall = new THREE.Mesh(new THREE.BoxGeometry(26.6, 4.2, 0.3), toonMat({ color: 0x707880 }));
    wall.position.set(0, 2.1, -9.1);
    g.add(wall);

    g.position.copy(base);
    g.rotation.y = -yaw + Math.PI;
    this.group.add(g);
  }

  distanceToCenter(x: number, z: number): number {
    return this.nearestInfo(x, z).dist;
  }

  nearestInfo(x: number, z: number): { dist: number; t: number; y: number } {
    let best = Infinity, bi = 0;
    for (let i = 0; i < this.centers.length; i += 2) {
      const p = this.centers[i];
      const dx = p.x - x, dz = p.z - z;
      const d = dx * dx + dz * dz;
      if (d < best) { best = d; bi = i; }
    }
    let fi = bi, fd = best;
    for (let i = Math.max(0, bi - 2); i < Math.min(this.centers.length, bi + 3); i++) {
      const p = this.centers[i];
      const dx = p.x - x, dz = p.z - z;
      const d = dx * dx + dz * dz;
      if (d < fd) { fd = d; fi = i; }
    }
    return { dist: Math.sqrt(fd), t: fi / this.centers.length, y: this.centers[fi].y };
  }

  heightAt(x: number, z: number): number {
    return this.nearestInfo(x, z).y;
  }

  startPose(): { pos: THREE.Vector3; yaw: number } {
    const p = this.curve.getPointAt(0);
    const t = this.curve.getTangentAt(0);
    return { pos: p, yaw: Math.atan2(t.z, t.x) };
  }
}
