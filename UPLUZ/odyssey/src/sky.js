import * as THREE from 'three';
import { PALETTE } from './shading.js';

// ---------------------------------------------------------------------------
// The sky is 45-60% of every frame and it is authored, not simulated.
// A 256x1 gradient LUT holds the entire mood of the game — an art director can
// repaint the world by editing one strip of pixels. Clouds are painted cards,
// not volumetrics: 3 ms cheaper AND more Ghibli.
// ---------------------------------------------------------------------------

function buildLut() {
  const N = 256;
  const data = new Uint8Array(N * 4);
  const zenith = new THREE.Color(PALETTE.skyHigh);
  const horizon = new THREE.Color(PALETTE.horizon);
  const below = new THREE.Color(0xe8dcc6);
  const c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    if (t < 0.5) {
      c.copy(below).lerp(horizon, Math.pow(t / 0.5, 0.6));
    } else {
      const k = (t - 0.5) / 0.5;
      c.copy(horizon).lerp(zenith, Math.pow(k, 0.72));
    }
    data[i * 4] = c.r * 255; data[i * 4 + 1] = c.g * 255;
    data[i * 4 + 2] = c.b * 255; data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, N, 1, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function cloudTexture() {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  // soft clustered blobs — one painted card, reused with rotation and scale
  const blobs = 11;
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * Math.PI * 2 + Math.random();
    const r = 26 + Math.random() * 44;
    const x = S / 2 + Math.cos(a) * (18 + Math.random() * 46);
    const y = S / 2 + Math.sin(a) * (10 + Math.random() * 22) * 0.6;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.42)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Sky {
  constructor(skyUniforms) {
    this.group = new THREE.Group();
    this.u = skyUniforms;

    const dome = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1, 4),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          uLut: { value: buildLut() },
          uSunDir: skyUniforms.uSunDir,
          uSunColor: skyUniforms.uSunColor,
          uTime: skyUniforms.uTime,
        },
        vertexShader: /* glsl */`
          varying vec3 vDir;
          void main() {
            vDir = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */`
          precision highp float;
          varying vec3 vDir;
          uniform sampler2D uLut;
          uniform vec3 uSunDir, uSunColor;
          uniform float uTime;
          void main() {
            vec3 d = normalize(vDir);
            // gentle warp so the horizon band reads as painted, not as a ramp
            float warp = sin(d.x * 6.0 + uTime * 0.03) * 0.006
                       + sin(d.z * 4.3 - uTime * 0.021) * 0.005;
            float t = clamp(d.y * 0.5 + 0.5 + warp, 0.0, 1.0);
            vec3 col = texture2D(uLut, vec2(t, 0.5)).rgb;
            float sd = max(dot(d, uSunDir), 0.0);
            col += uSunColor * pow(sd, 300.0) * 2.6;   // disc
            col += uSunColor * pow(sd, 7.0) * 0.26;    // fat soft halo
            gl_FragColor = vec4(col, 1.0);
          }`,
      }),
    );
    dome.scale.setScalar(3600);
    dome.renderOrder = 900;
    dome.frustumCulled = false;
    this.dome = dome;
    this.group.add(dome);

    // --- three parallax layers of painted cloud cards ---
    this.cloudTex = cloudTexture();
    this.layers = [];
    const layerCfg = [
      { count: 34, y: 340, spread: 2100, size: [420, 190], parallax: 0.88, alpha: 0.55 },
      { count: 44, y: 560, spread: 2900, size: [620, 250], parallax: 0.94, alpha: 0.42 },
      { count: 38, y: 880, spread: 3600, size: [880, 320], parallax: 0.97, alpha: 0.30 },
    ];
    for (const cfg of layerCfg) this.layers.push(this._makeCloudLayer(cfg));
  }

  _makeCloudLayer(cfg) {
    const quad = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.getAttribute('position'));
    geo.setAttribute('uv', quad.getAttribute('uv'));

    const pos = new Float32Array(cfg.count * 3);
    const scale = new Float32Array(cfg.count * 2);
    const rand = new Float32Array(cfg.count);
    for (let i = 0; i < cfg.count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = (0.25 + Math.random() * 0.75) * cfg.spread;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = cfg.y + (Math.random() - 0.5) * cfg.y * 0.35;
      pos[i * 3 + 2] = Math.sin(a) * r;
      const s = 0.6 + Math.random() * 0.9;
      scale[i * 2] = cfg.size[0] * s;
      scale[i * 2 + 1] = cfg.size[1] * s;
      rand[i] = Math.random();
    }
    geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(pos, 3));
    geo.setAttribute('aScale', new THREE.InstancedBufferAttribute(scale, 2));
    geo.setAttribute('aRand', new THREE.InstancedBufferAttribute(rand, 1));
    geo.instanceCount = cfg.count;

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTex: { value: this.cloudTex },
        uTime: this.u.uTime,
        uSunDir: this.u.uSunDir,
        uSunColor: this.u.uSunColor,
        uAlpha: { value: cfg.alpha },
        uCloud: { value: new THREE.Color(PALETTE.cloud) },
        uShade: { value: new THREE.Color(0xbcd3e0) },
      },
      vertexShader: /* glsl */`
        attribute vec3 aPos;
        attribute vec2 aScale;
        attribute float aRand;
        uniform float uTime;
        varying vec2 vUv;
        varying float vRand;
        varying vec3 vWorldDir;
        void main() {
          vUv = uv;
          vRand = aRand;
          vec3 p = aPos;
          p.x += sin(uTime * 0.011 + aRand * 6.28) * 90.0;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          mv.xy += position.xy * aScale;
          vWorldDir = normalize(p);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        precision highp float;
        uniform sampler2D uTex;
        uniform float uAlpha;
        uniform vec3 uCloud, uShade, uSunDir, uSunColor;
        varying vec2 vUv;
        varying float vRand;
        varying vec3 vWorldDir;
        void main() {
          float a = texture2D(uTex, vUv).a;
          if (a < 0.01) discard;
          // lit rim toward the sun, cool belly away from it
          float f = smoothstep(0.15, 0.9, vUv.y);
          vec3 col = mix(uShade, uCloud, f);
          float sd = max(dot(vWorldDir, uSunDir), 0.0);
          col += uSunColor * pow(sd, 3.0) * 0.35;
          gl_FragColor = vec4(col, a * uAlpha);
        }`,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 901;
    this.group.add(mesh);
    return { mesh, parallax: cfg.parallax };
  }

  update(camPos) {
    this.dome.position.copy(camPos);
    for (const l of this.layers) {
      l.mesh.position.set(camPos.x * l.parallax, 0, camPos.z * l.parallax);
    }
  }
}

// ---------------------------------------------------------------------------
// The Long One — 400 m, an 11-minute orbit, visible from most of the map.
// It is the compass, and it is the only level design the player ever notices.
// Spline animation lives entirely in the vertex shader: no skeleton, no CPU.
// ---------------------------------------------------------------------------
export class LongOne {
  constructor(skyUniforms) {
    const LEN = 400, RINGS = 56, RADIAL = 12;
    const pos = [], t = [], ang = [], idx = [];
    for (let r = 0; r <= RINGS; r++) {
      const u = r / RINGS;
      // whale-ish profile: blunt head, long taper, small fluke
      const rad = 26 * Math.sin(Math.pow(u, 0.55) * Math.PI) * (1 - u * 0.45) + 1.2;
      for (let a = 0; a < RADIAL; a++) {
        const th = (a / RADIAL) * Math.PI * 2;
        pos.push(Math.cos(th) * rad * 1.15, Math.sin(th) * rad * 0.62, (u - 0.5) * LEN);
        t.push(u); ang.push(th);
      }
    }
    for (let r = 0; r < RINGS; r++) {
      for (let a = 0; a < RADIAL; a++) {
        const a2 = (a + 1) % RADIAL;
        const i0 = r * RADIAL + a, i1 = r * RADIAL + a2;
        const i2 = (r + 1) * RADIAL + a, i3 = (r + 1) * RADIAL + a2;
        idx.push(i0, i2, i1, i1, i2, i3);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aU', new THREE.Float32BufferAttribute(t, 1));
    geo.setAttribute('aAng', new THREE.Float32BufferAttribute(ang, 1));
    geo.setIndex(idx);

    const mat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: Object.assign({}, {
        uTime: skyUniforms.uTime,
        uSunDir: skyUniforms.uSunDir,
        uSunColor: skyUniforms.uSunColor,
        uSkyColor: skyUniforms.uSkyColor,
        uBelly: { value: new THREE.Color(PALETTE.cloud) },
        uBack: { value: new THREE.Color(0x8fa9b8) },
      }),
      vertexShader: /* glsl */`
        attribute float aU;
        attribute float aAng;
        uniform float uTime;
        varying vec3 vNormalW;
        varying float vU;
        varying float vAng;
        void main() {
          vU = aU; vAng = aAng;
          vec3 p = position;
          // three sine harmonics travelling down the body
          float ph = aU * 6.0 - uTime * 0.55;
          p.x += sin(ph) * 5.5 * aU;
          p.y += sin(ph * 0.5 + 0.7) * 3.0 * aU + sin(uTime * 0.31) * 1.5;
          vec4 wp = modelMatrix * vec4(p, 1.0);
          vNormalW = normalize(mat3(modelMatrix) * normalize(vec3(position.x, position.y * 1.6, 0.0)));
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */`
        precision highp float;
        uniform vec3 uSunDir, uSunColor, uSkyColor, uBelly, uBack;
        varying vec3 vNormalW;
        varying float vU;
        varying float vAng;
        void main() {
          vec3 n = normalize(vNormalW);
          float belly = smoothstep(-0.2, -0.9, n.y);
          vec3 albedo = mix(uBack, uBelly, belly);
          float ndl = dot(n, uSunDir) * 0.5 + 0.5;
          float band = 0.34 + smoothstep(0.35, 0.5, ndl) * 0.35 + smoothstep(0.62, 0.78, ndl) * 0.31;
          vec3 col = albedo * (uSunColor * band + uSkyColor * 0.55);
          // it never gets closer, and it never resolves into detail
          gl_FragColor = vec4(col, 1.0);
        }`,
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 890;
    this.phase = 0.15;
  }

  update(dt, camPos) {
    this.phase += dt / 660;                 // 11-minute orbit
    const a = this.phase * Math.PI * 2;
    const R = 780;
    this.mesh.position.set(Math.cos(a) * R, 300 + Math.sin(a * 2) * 40, Math.sin(a) * R);
    this.mesh.rotation.y = -a + Math.PI / 2;
    this.mesh.rotation.z = Math.sin(a * 2) * 0.06;
  }
}

// ---------------------------------------------------------------------------
// Pollen and light motes. Procedural in the vertex shader from (seed, time):
// zero CPU cost, zero buffer uploads, wraps around the camera forever.
// ---------------------------------------------------------------------------
export class Motes {
  constructor(skyUniforms, count = 2000) {
    const seeds = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) seeds[i] = Math.random();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));

    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: skyUniforms.uTime,
        uCam: { value: new THREE.Vector3() },
        uColor: { value: new THREE.Color(PALETTE.butter) },
        uPixelRatio: { value: 1 },
        uSpan: { value: 48.0 },
      },
      vertexShader: /* glsl */`
        attribute vec3 aSeed;
        uniform float uTime, uSpan, uPixelRatio;
        uniform vec3 uCam;
        varying float vFade;
        void main() {
          vec3 base = aSeed * uSpan;
          // slow brownian drift
          base.x += sin(uTime * 0.21 + aSeed.y * 40.0) * 2.2;
          base.y += sin(uTime * 0.17 + aSeed.z * 33.0) * 1.4 + uTime * 0.25;
          base.z += cos(uTime * 0.19 + aSeed.x * 27.0) * 2.2;
          // wrap into a box that follows the camera
          vec3 p = mod(base - uCam + uSpan * 0.5, uSpan) - uSpan * 0.5 + uCam;
          vec4 mv = viewMatrix * vec4(p, 1.0);
          float d = -mv.z;
          vFade = smoothstep(0.5, 4.0, d) * (1.0 - smoothstep(uSpan * 0.35, uSpan * 0.5, d));
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (2.0 + aSeed.x * 3.5) * uPixelRatio * (14.0 / max(d, 1.0));
        }`,
      fragmentShader: /* glsl */`
        precision highp float;
        uniform vec3 uColor;
        varying float vFade;
        void main() {
          float r = length(gl_PointCoord - 0.5) * 2.0;
          float a = pow(1.0 - clamp(r, 0.0, 1.0), 2.0) * vFade * 0.30;
          if (a < 0.004) discard;
          gl_FragColor = vec4(uColor, a);
        }`,
    });

    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 800;
  }

  update(camPos, pixelRatio) {
    this.material.uniforms.uCam.value.copy(camPos);
    this.material.uniforms.uPixelRatio.value = pixelRatio;
  }
}
