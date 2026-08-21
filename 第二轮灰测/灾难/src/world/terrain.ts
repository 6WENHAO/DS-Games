import * as THREE from 'three';
import { Rng } from '../core/rng';
import { BLOCK, BLOCKS, CITY_HALF, CITY_SPAN, GROUND_SIZE, ROAD, blockMin } from './layout';

interface Tile {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  hex: number;
}

const ASPHALT = 0x606a75;
const SIDEWALK = 0xdfe3e0;
const PAVING = 0xf0e9dc;
const GRASS = 0x93cf7e;
const DASH = 0xf6f3e6;

/**
 * Non-destructible ground furniture: grass, road grid, sidewalks, lane markings
 * and crosswalks. One InstancedMesh, uploaded once.
 */
export class Terrain {
  readonly group = new THREE.Group();
  readonly mesh: THREE.InstancedMesh;
  readonly plane: THREE.Mesh;

  constructor(parkKeys: Set<string>) {
    const rng = new Rng(9182734);
    const tiles: Tile[] = [];

    // roads (both directions)
    for (let i = 0; i <= BLOCKS; i++) {
      const c = -CITY_HALF + i * (BLOCK + ROAD) + ROAD / 2;
      tiles.push({ x: c, y: 0.03, z: 0, sx: ROAD, sy: 0.06, sz: CITY_SPAN, hex: ASPHALT });
      tiles.push({ x: 0, y: 0.035, z: c, sx: CITY_SPAN, sy: 0.06, sz: ROAD, hex: ASPHALT });
    }

    // blocks: sidewalk frame + inner paving / lawn
    for (let bi = 0; bi < BLOCKS; bi++) {
      for (let bj = 0; bj < BLOCKS; bj++) {
        const x = blockMin(bi) + BLOCK / 2;
        const z = blockMin(bj) + BLOCK / 2;
        tiles.push({ x, y: 0.07, z, sx: BLOCK, sy: 0.14, sz: BLOCK, hex: SIDEWALK });
        const park = parkKeys.has(`${bi},${bj}`);
        tiles.push({
          x,
          y: 0.105,
          z,
          sx: BLOCK - 2.6,
          sy: 0.14,
          sz: BLOCK - 2.6,
          hex: park ? GRASS : PAVING,
        });
        if (park) {
          // winding path through the park
          tiles.push({ x, y: 0.12, z, sx: BLOCK - 2.6, sy: 0.15, sz: 2, hex: 0xe8dcc4 });
          tiles.push({ x, y: 0.12, z, sx: 2, sy: 0.15, sz: BLOCK - 2.6, hex: 0xe8dcc4 });
        }
      }
    }

    // lane dashes
    for (let i = 0; i <= BLOCKS; i++) {
      const c = -CITY_HALF + i * (BLOCK + ROAD) + ROAD / 2;
      for (let t = -CITY_HALF + 2; t < CITY_HALF - 1; t += 4.5) {
        if (Math.abs(((t + CITY_HALF) % (BLOCK + ROAD)) - ROAD / 2) < ROAD * 0.75) continue;
        tiles.push({ x: c, y: 0.075, z: t, sx: 0.3, sy: 0.07, sz: 1.8, hex: DASH });
        tiles.push({ x: t, y: 0.075, z: c, sx: 1.8, sy: 0.07, sz: 0.3, hex: DASH });
      }
    }

    // crosswalks at every intersection
    for (let i = 0; i <= BLOCKS; i++) {
      for (let j = 0; j <= BLOCKS; j++) {
        const cx = -CITY_HALF + i * (BLOCK + ROAD) + ROAD / 2;
        const cz = -CITY_HALF + j * (BLOCK + ROAD) + ROAD / 2;
        for (let k = -2; k <= 2; k++) {
          tiles.push({
            x: cx + k * 1.1,
            y: 0.08,
            z: cz + ROAD / 2 + 0.9,
            sx: 0.6,
            sy: 0.07,
            sz: 2.2,
            hex: DASH,
          });
          tiles.push({
            x: cx + ROAD / 2 + 0.9,
            y: 0.08,
            z: cz + k * 1.1,
            sx: 2.2,
            sy: 0.07,
            sz: 0.6,
            hex: DASH,
          });
        }
      }
    }

    // scattered countryside patches outside the grid so the model has a rim
    const FIELDS = [0x89c976, 0xa5d98d, 0xd9cf94, 0xc4b878, 0x9fd0a8, 0xe0d9a8, 0x7bb96b];
    for (let k = 0; k < 130; k++) {
      const a = rng.range(0, Math.PI * 2);
      const r = rng.range(CITY_HALF + 10, CITY_HALF + 190);
      const w = rng.range(10, 40);
      const d = rng.range(10, 40);
      tiles.push({
        x: Math.cos(a) * r,
        y: 0.05,
        z: Math.sin(a) * r,
        sx: w,
        sy: 0.1,
        sz: d,
        hex: rng.pick(FIELDS),
      });
      // ploughed rows for a toy farmland feel
      if (rng.bool(0.35)) {
        const rows = 4;
        for (let i = 0; i < rows; i++) {
          tiles.push({
            x: Math.cos(a) * r + (i - rows / 2) * (w / rows),
            y: 0.07,
            z: Math.sin(a) * r,
            sx: w / (rows * 2.6),
            sy: 0.1,
            sz: d * 0.92,
            hex: 0xb9a874,
          });
        }
      }
    }

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, mat, tiles.length);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    this.mesh.frustumCulled = false;
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      m.makeScale(t.sx, t.sy, t.sz);
      m.setPosition(t.x, t.y, t.z);
      this.mesh.setMatrixAt(i, m);
      c.setHex(t.hex);
      this.mesh.setColorAt(i, c);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    this.plane = new THREE.Mesh(
      new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE),
      new THREE.MeshLambertMaterial({ color: 0x8ec97b }),
    );
    this.plane.rotation.x = -Math.PI / 2;
    this.plane.receiveShadow = true;
    this.plane.position.y = 0;

    this.group.add(this.plane, this.mesh);
  }
}
