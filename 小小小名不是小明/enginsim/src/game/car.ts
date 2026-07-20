import * as THREE from 'three';
import { toonMat } from './textures';

export interface MuscleCar {
  group: THREE.Group;
  body: THREE.Group;
  wheels: { fl: THREE.Group; fr: THREE.Group; rl: THREE.Group; rr: THREE.Group };
  wheelRadius: number;
}

const paint = toonMat({ color: 0x2050c8 });
const redPaint = toonMat({ color: 0xd42818 });
const black = toonMat({ color: 0x1a1d22 });
const white = toonMat({ color: 0xf2f2ee });
const glass = toonMat({ color: 0x182030 });
const chrome = toonMat({ color: 0xccd4e0 });
const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2cc });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xee2818 });
const tire = toonMat({ color: 0x202226 });

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, rz = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.z = rz;
  m.castShadow = true;
  return m;
}

function makeWheel(radius: number): THREE.Group {
  const g = new THREE.Group();
  const tGeo = new THREE.CylinderGeometry(radius, radius, 0.32, 12);
  tGeo.rotateX(Math.PI / 2);
  const t = new THREE.Mesh(tGeo, tire);
  t.castShadow = true;
  const rGeo = new THREE.CylinderGeometry(radius * 0.56, radius * 0.56, 0.34, 8);
  rGeo.rotateX(Math.PI / 2);
  const r = new THREE.Mesh(rGeo, chrome);
  const hGeo = new THREE.BoxGeometry(radius * 0.9, 0.06, 0.36);
  const spoke = new THREE.Mesh(hGeo, black);
  g.add(t, r, spoke);
  return g;
}

export function createMuscleCar(): MuscleCar {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  body.add(box(4.7, 0.5, 1.88, paint, 0, 0.62, 0));
  body.add(box(4.45, 0.34, 1.8, paint, 0.05, 1.0, 0));
  body.add(box(1.95, 0.46, 1.58, paint, -0.5, 1.4, 0));

  body.add(box(0.1, 0.62, 1.5, glass, 0.62, 1.32, 0, -0.55));
  body.add(box(0.09, 0.5, 1.44, glass, -1.58, 1.34, 0, 0.62));
  body.add(box(0.06, 0.3, 0.05, paint, 0.62, 1.32, 0.76, -0.55));
  body.add(box(0.06, 0.3, 0.05, paint, 0.62, 1.32, -0.76, -0.55));

  body.add(box(0.78, 0.16, 0.62, black, 1.45, 1.24, 0));
  body.add(box(0.3, 0.06, 0.5, black, 1.15, 1.19, 0));

  body.add(box(2.3, 0.025, 0.3, white, 1.28, 1.18, 0.26));
  body.add(box(2.3, 0.025, 0.3, white, 1.28, 1.18, -0.26));
  body.add(box(1.95, 0.025, 0.3, white, -0.5, 1.64, 0.26));
  body.add(box(1.95, 0.025, 0.3, white, -0.5, 1.64, -0.26));
  body.add(box(1.0, 0.025, 0.3, white, -1.95, 1.19, 0.26));
  body.add(box(1.0, 0.025, 0.3, white, -1.95, 1.19, -0.26));

  body.add(box(0.4, 0.22, 1.92, black, 2.32, 0.45, 0));
  body.add(box(0.08, 0.24, 1.15, black, 2.36, 0.85, 0));
  body.add(box(0.08, 0.14, 0.42, lightMat, 2.36, 0.86, 0.62));
  body.add(box(0.08, 0.14, 0.42, lightMat, 2.36, 0.86, -0.62));

  body.add(box(0.09, 0.16, 1.55, tailMat, -2.37, 0.9, 0));
  body.add(box(0.3, 0.2, 1.9, black, -2.28, 0.45, 0));

  body.add(box(0.09, 0.2, 0.09, black, -1.95, 1.26, 0.62));
  body.add(box(0.09, 0.2, 0.09, black, -1.95, 1.26, -0.62));
  body.add(box(0.42, 0.07, 1.78, black, -2.02, 1.42, 0));

  const tipGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.28, 8);
  tipGeo.rotateZ(Math.PI / 2);
  for (const s of [-1, 1]) {
    const tip = new THREE.Mesh(tipGeo, chrome);
    tip.position.set(-2.42, 0.36, 0.48 * s);
    body.add(tip);
  }

  const wheelRadius = 0.35;
  const mk = (x: number, z: number) => {
    const steer = new THREE.Group();
    steer.position.set(x, wheelRadius, z);
    const spin = makeWheel(wheelRadius);
    steer.add(spin);
    group.add(steer);
    return steer;
  };
  const wheels = {
    fl: mk(1.42, -0.86),
    fr: mk(1.42, 0.86),
    rl: mk(-1.38, -0.86),
    rr: mk(-1.38, 0.86)
  };

  return { group, body, wheels, wheelRadius };
}

export function createSportsCar(): MuscleCar {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  body.add(box(4.3, 0.46, 1.86, redPaint, 0, 0.56, 0));
  body.add(box(4.0, 0.3, 1.78, redPaint, -0.1, 0.9, 0));

  body.add(box(1.1, 0.12, 1.7, redPaint, 1.6, 1.0, 0, -0.1));
  body.add(box(0.7, 0.1, 1.75, redPaint, 2.05, 0.92, 0, -0.18));

  body.add(box(1.75, 0.42, 1.5, redPaint, -0.35, 1.28, 0));
  body.add(box(1.15, 0.3, 1.3, redPaint, -0.45, 1.52, 0));
  body.add(box(0.1, 0.52, 1.34, glass, 0.5, 1.32, 0, -0.72));
  body.add(box(0.09, 0.44, 1.24, glass, -1.15, 1.36, 0, 0.85));
  body.add(box(0.08, 0.26, 0.5, glass, -0.35, 1.42, 0.72));
  body.add(box(0.08, 0.26, 0.5, glass, -0.35, 1.42, -0.72));

  body.add(box(1.3, 0.2, 1.76, redPaint, -1.7, 0.95, 0, 0.14));
  body.add(box(0.5, 0.08, 1.5, black, -1.98, 1.12, 0, 0.3));
  body.add(box(0.34, 0.06, 1.35, redPaint, -2.02, 1.2, 0, 0.32));

  for (let i = 0; i < 5; i++) {
    body.add(box(0.5, 0.02, 0.16, black, -1.72, 1.09 + i * 0.006, -0.56 + i * 0.28, 0.14));
  }

  body.add(box(0.36, 0.2, 1.9, black, 2.12, 0.42, 0));
  body.add(box(0.28, 0.18, 1.88, black, -2.1, 0.44, 0));

  const lampGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.1, 10);
  lampGeo.rotateZ(Math.PI / 2);
  for (const s of [-1, 1]) {
    const lamp = new THREE.Mesh(lampGeo, lightMat);
    lamp.position.set(2.18, 0.88, 0.62 * s);
    body.add(lamp);
  }
  body.add(box(0.07, 0.1, 1.5, tailMat, -2.16, 0.92, 0));

  const tipGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.24, 8);
  tipGeo.rotateZ(Math.PI / 2);
  for (const s of [-1, 1]) {
    const tip = new THREE.Mesh(tipGeo, chrome);
    tip.position.set(-2.24, 0.34, 0.22 * s);
    body.add(tip);
  }

  const wheelRadius = 0.33;
  const mk = (x: number, z: number) => {
    const steer = new THREE.Group();
    steer.position.set(x, wheelRadius, z);
    steer.add(makeWheel(wheelRadius));
    group.add(steer);
    return steer;
  };
  const wheels = {
    fl: mk(1.38, -0.84),
    fr: mk(1.38, 0.84),
    rl: mk(-1.32, -0.86),
    rr: mk(-1.32, 0.86)
  };

  return { group, body, wheels, wheelRadius };
}
