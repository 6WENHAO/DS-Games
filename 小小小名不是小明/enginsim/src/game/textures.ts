import * as THREE from 'three';

let toonGrad: THREE.DataTexture | null = null;
export function getToonGradient(): THREE.DataTexture {
  if (toonGrad) return toonGrad;
  const data = new Uint8Array([
    90, 90, 90, 255,
    145, 145, 145, 255,
    205, 205, 205, 255,
    255, 255, 255, 255
  ]);
  toonGrad = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  toonGrad.minFilter = THREE.NearestFilter;
  toonGrad.magFilter = THREE.NearestFilter;
  toonGrad.generateMipmaps = false;
  toonGrad.needsUpdate = true;
  return toonGrad;
}

export function toonMat(opts: THREE.MeshToonMaterialParameters): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ gradientMap: getToonGradient(), ...opts });
}

function canvasTexture(size: number, draw: (c: CanvasRenderingContext2D, s: number) => void): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c = cv.getContext('2d')!;
  draw(c, size);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function makeAsphaltTexture(): THREE.CanvasTexture {
  return canvasTexture(512, (c, s) => {
    c.fillStyle = '#3a3d42';
    c.fillRect(0, 0, s, s);
    for (let i = 0; i < 14000; i++) {
      const v = 40 + Math.random() * 40;
      c.fillStyle = `rgba(${v},${v},${v + 4},${0.25 + Math.random() * 0.4})`;
      c.fillRect(Math.random() * s, Math.random() * s, 1.6, 1.6);
    }
    for (let i = 0; i < 26; i++) {
      c.strokeStyle = `rgba(22,23,26,${0.12 + Math.random() * 0.2})`;
      c.lineWidth = 1;
      c.beginPath();
      let x = Math.random() * s, y = Math.random() * s;
      c.moveTo(x, y);
      for (let k = 0; k < 5; k++) {
        x += (Math.random() - 0.5) * 60;
        y += (Math.random() - 0.5) * 60;
        c.lineTo(x, y);
      }
      c.stroke();
    }
    const edge = s * 0.035;
    c.fillStyle = 'rgba(225,228,232,0.85)';
    c.fillRect(edge, 0, 5, s);
    c.fillRect(s - edge - 5, 0, 5, s);
    c.fillStyle = 'rgba(215,175,60,0.85)';
    const mid = s / 2;
    c.fillRect(mid - 7, 0, 4, s);
    c.fillRect(mid + 3, 0, 4, s);
  });
}

export function makeCurbTexture(): THREE.CanvasTexture {
  return canvasTexture(128, (c, s) => {
    c.fillStyle = '#c8332a';
    c.fillRect(0, 0, s, s / 2);
    c.fillStyle = '#e8e4dc';
    c.fillRect(0, s / 2, s, s / 2);
    for (let i = 0; i < 600; i++) {
      c.fillStyle = `rgba(30,30,30,${Math.random() * 0.12})`;
      c.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
  });
}

export function makeGrassTexture(): THREE.CanvasTexture {
  return canvasTexture(256, (c, s) => {
    c.fillStyle = '#4a7a3a';
    c.fillRect(0, 0, s, s);
    for (let i = 0; i < 9000; i++) {
      const g = 100 + Math.random() * 60;
      c.fillStyle = `rgba(${g * 0.45},${g},${g * 0.35},${0.3 + Math.random() * 0.4})`;
      c.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
  });
}

export function makeCheckerTexture(): THREE.CanvasTexture {
  return canvasTexture(128, (c, s) => {
    const n = 8, k = s / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        c.fillStyle = (i + j) % 2 ? '#e8e8e8' : '#141414';
        c.fillRect(i * k, j * k, k, k);
      }
    }
  });
}

export function makeRockGradientTexture(): THREE.CanvasTexture {
  return canvasTexture(512, (c, s) => {
    const grad = c.createLinearGradient(0, s, 0, 0);
    grad.addColorStop(0.0, '#4e6a3c');
    grad.addColorStop(0.18, '#5c5f48');
    grad.addColorStop(0.45, '#6e6656');
    grad.addColorStop(0.72, '#7d7f85');
    grad.addColorStop(1.0, '#a8adb5');
    c.fillStyle = grad;
    c.fillRect(0, 0, s, s);
    for (let i = 0; i < 16000; i++) {
      const y = Math.random() * s;
      const v = 90 + Math.random() * 90;
      c.fillStyle = `rgba(${v},${v * 0.98},${v * 0.94},${0.05 + Math.random() * 0.12})`;
      c.fillRect(Math.random() * s, y, 2 + Math.random() * 3, 1.5);
    }
    for (let i = 0; i < 40; i++) {
      const y = Math.random() * s * 0.85;
      c.strokeStyle = `rgba(40,42,46,${0.08 + Math.random() * 0.14})`;
      c.lineWidth = 1 + Math.random() * 1.5;
      c.beginPath();
      let x = 0, yy = y;
      c.moveTo(x, yy);
      while (x < s) {
        x += 20 + Math.random() * 40;
        yy += (Math.random() - 0.5) * 14;
        c.lineTo(x, yy);
      }
      c.stroke();
    }
  });
}

export function makeTreeTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 384;
  const c = cv.getContext('2d')!;
  c.clearRect(0, 0, 256, 384);

  c.fillStyle = '#5a4030';
  c.beginPath();
  c.moveTo(118, 384);
  c.lineTo(124, 250);
  c.lineTo(132, 250);
  c.lineTo(138, 384);
  c.closePath();
  c.fill();
  c.strokeStyle = '#4a3426';
  c.lineWidth = 3;
  for (const [x1, y1, x2, y2] of [[126, 280, 96, 240], [130, 260, 160, 218], [127, 300, 88, 268]]) {
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  }

  const blob = (x: number, y: number, r: number, col: string) => {
    c.fillStyle = col;
    c.beginPath();
    for (let a = 0; a < Math.PI * 2; a += 0.4) {
      const rr = r * (0.82 + Math.random() * 0.36);
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.92;
      if (a === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath();
    c.fill();
  };
  blob(128, 150, 92, '#2a4d28');
  blob(88, 180, 58, '#2f5a2c');
  blob(170, 175, 56, '#2c5429');
  blob(128, 105, 66, '#38683188');
  blob(100, 130, 46, '#3f7536');
  blob(158, 122, 44, '#3a6e31');
  blob(128, 88, 38, '#478040');
  for (let i = 0; i < 260; i++) {
    const a = Math.random() * Math.PI * 2, d = Math.random();
    const x = 128 + Math.cos(a) * d * 88, y = 140 + Math.sin(a) * d * 78;
    const g = 90 + Math.random() * 70;
    c.fillStyle = `rgba(${g * 0.5},${g},${g * 0.42},0.5)`;
    c.fillRect(x, y, 3, 3);
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function makeChainlinkTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const c = cv.getContext('2d')!;
  c.clearRect(0, 0, 128, 128);
  c.strokeStyle = 'rgba(150,158,168,0.9)';
  c.lineWidth = 2.2;
  const k = 16;
  for (let i = -8; i < 18; i++) {
    c.beginPath();
    c.moveTo(i * k, 0);
    c.lineTo(i * k + 128, 128);
    c.stroke();
    c.beginPath();
    c.moveTo(i * k, 128);
    c.lineTo(i * k + 128, 0);
    c.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeBannerTexture(text: string, bg: string, fg: string, checker = false): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 192;
  const c = cv.getContext('2d')!;
  c.fillStyle = bg;
  c.fillRect(0, 0, 512, 192);
  if (checker) {
    const k = 16;
    for (let i = 0; i < 32; i++) {
      for (let j = 0; j < 2; j++) {
        c.fillStyle = (i + j) % 2 ? '#e8e8e8' : '#141414';
        c.fillRect(i * k, j * k, k, k);
        c.fillRect(i * k, 192 - (j + 1) * k, k, k);
      }
    }
  }
  c.fillStyle = fg;
  c.font = 'bold 58px Arial, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, 256, 98);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
