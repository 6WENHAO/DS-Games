import * as THREE from 'three';
import { makeRockGradientTexture, toonMat } from './textures';

export function createBasinTerrain(): THREE.Mesh {
  const SEG = 180;
  const ROWS = 12;
  const R0 = 470, R1 = 1000;
  const MAX_H = 170;

  const ridge = (theta: number) =>
    0.55
    + 0.2 * Math.sin(theta * 3 + 1.7)
    + 0.15 * Math.sin(theta * 7 + 0.4)
    + 0.1 * Math.sin(theta * 13 + 2.9);

  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];

  for (let r = 0; r <= ROWS; r++) {
    const fr = r / ROWS;
    const radius = R0 + (R1 - R0) * fr;
    const ramp = Math.pow(Math.sin(Math.min(1, fr * 1.25) * Math.PI * 0.5), 1.6);
    for (let i = 0; i <= SEG; i++) {
      const theta = (i / SEG) * Math.PI * 2;
      const jitter = 1 + 0.06 * Math.sin(theta * 17 + r * 2.3);
      const h = MAX_H * ramp * ridge(theta) * jitter;
      pos.push(Math.cos(theta) * radius, h, Math.sin(theta) * radius);
      uv.push(theta * 14 / Math.PI, h / MAX_H);
    }
  }

  for (let r = 0; r < ROWS; r++) {
    for (let i = 0; i < SEG; i++) {
      const a = r * (SEG + 1) + i;
      const b = a + SEG + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, toonMat({
    map: makeRockGradientTexture()
  }));
  mesh.position.y = -0.5;
  return mesh;
}
