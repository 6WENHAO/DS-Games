/**
 * Sky and image-based lighting.
 *
 * The default environment is a stylised equirectangular HDRI generated at load
 * time in the project's own palette: banded altitude gradient, a hot sun disc
 * with a warm halo, three cloud decks quantised through the same stepped ramp
 * the grass uses, and a ground-haze hemisphere. It is a true floating-point
 * radiance map (the sun core sits far above 1.0), it drives the ambient probe,
 * and it is drawn as the visible sky.
 *
 * A photographic HDRI can be substituted at runtime — see loadCdnHdri() and the
 * README asset table.
 */
import * as THREE from 'three';
import { PALETTE, SUN } from '../core/config.js';
import { sunDir, shared, withShared } from '../core/env.js';
import { GLSL_MATH, GLSL_SHARED_UNIFORMS, GLSL_LIGHTING, GLSL_LIGHTING_FRAG } from './shaderChunks.js';

/* ------------------------------------------------------------------ *
 * 3D value noise on the sphere (seamless by construction)
 * ------------------------------------------------------------------ */
function hash3(ix, iy, iz, seed) {
  let n = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(iz, 2147483647) ^ Math.imul(seed, 362437);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}

function noise3(x, y, z, seed) {
  const ix = Math.floor(x); const iy = Math.floor(y); const iz = Math.floor(z);
  const fx = x - ix; const fy = y - iy; const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);
  const c000 = hash3(ix, iy, iz, seed);
  const c100 = hash3(ix + 1, iy, iz, seed);
  const c010 = hash3(ix, iy + 1, iz, seed);
  const c110 = hash3(ix + 1, iy + 1, iz, seed);
  const c001 = hash3(ix, iy, iz + 1, seed);
  const c101 = hash3(ix + 1, iy, iz + 1, seed);
  const c011 = hash3(ix, iy + 1, iz + 1, seed);
  const c111 = hash3(ix + 1, iy + 1, iz + 1, seed);
  const x00 = c000 + (c100 - c000) * ux;
  const x10 = c010 + (c110 - c010) * ux;
  const x01 = c001 + (c101 - c001) * ux;
  const x11 = c011 + (c111 - c011) * ux;
  const y0 = x00 + (x10 - x00) * uy;
  const y1 = x01 + (x11 - x01) * uy;
  return y0 + (y1 - y0) * uz;
}

function fbm3(x, y, z, seed, octaves = 4) {
  let sum = 0; let amp = 0.5; let norm = 0; let f = 1;
  for (let o = 0; o < octaves; o += 1) {
    sum += amp * noise3(x * f, y * f, z * f, seed + o * 733);
    norm += amp;
    amp *= 0.5;
    f *= 2.07;
  }
  return sum / norm;
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Float32 -> IEEE half. Radiance maps ship as RGBA16F because WebGL2 filters
 * half-float textures without an extension, while linear filtering of RGBA32F
 * depends on OES_texture_float_linear.
 */
const toHalf = (() => {
  if (THREE.DataUtils && typeof THREE.DataUtils.toHalfFloat === 'function') {
    return (v) => THREE.DataUtils.toHalfFloat(Math.min(Math.max(v, -65504), 65504));
  }
  const f32 = new Float32Array(1);
  const i32 = new Int32Array(f32.buffer);
  return (val) => {
    f32[0] = Math.min(Math.max(val, -65504), 65504);
    const x = i32[0];
    let bits = (x >> 16) & 0x8000;
    const m = ((x >> 12) & 0x07ff) | 0x0800;
    const e = (x >> 23) & 0xff;
    if (e < 103) return bits;
    if (e > 142) return bits | 0x7c00;
    if (e < 113) return bits | ((m >> (114 - e)) + ((m >> (113 - e)) & 1));
    bits |= ((e - 112) << 10) | (((x >> 12) & 0x07ff) >> 1);
    return bits + ((x >> 12) & 1);
  };
})();

/** Wraps a linear RGBA float buffer as a filterable half-float texture. */
function halfTextureFromFloats(floats, width, height) {
  const half = new Uint16Array(floats.length);
  for (let i = 0; i < floats.length; i += 1) half[i] = toHalf(floats[i]);
  const tex = new THREE.DataTexture(half, width, height, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.colorSpace = THREE.NoColorSpace; // linear radiance, not display-referred
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

/** Stepped ramp with a soft band — the CPU twin of dshToonRamp. */
function toonRamp(x, steps, soft) {
  const s = clamp01(x) * steps;
  const f = Math.floor(s);
  const k = s - f;
  const b = Math.max(0.001, Math.min(0.5, soft));
  const t = clamp01((k - (0.5 - b)) / (2 * b));
  const e = t * t * (3 - 2 * t);
  return clamp01((f + e) / steps);
}

/* ------------------------------------------------------------------ *
 * Stylised HDRI generation
 * ------------------------------------------------------------------ */

export function generateStylizedHdri({ width = 512, height = 256 } = {}) {
  const data = new Float32Array(width * height * 4);

  const zenith = PALETTE.skyZenith;
  const horizon = PALETTE.skyHorizon;
  const haze = PALETTE.bounce;
  const sunCol = PALETTE.sun;
  const sd = sunDir;

  const cloudDeck = [
    { scale: 2.1, alt: 0.30, cover: 0.50, seed: 4211, gain: 1.0 },
    { scale: 4.4, alt: 0.16, cover: 0.60, seed: 9137, gain: 0.72 },
    { scale: 8.7, alt: 0.08, cover: 0.70, seed: 1777, gain: 0.45 },
  ];

  for (let py = 0; py < height; py += 1) {
    const v = (py + 0.5) / height;
    const theta = (v - 0.5) * Math.PI;        // -PI/2 .. PI/2
    const sy = Math.sin(theta);
    const cy = Math.cos(theta);

    for (let px = 0; px < width; px += 1) {
      const u = (px + 0.5) / width;
      const phi = (u - 0.5) * Math.PI * 2;    // matches three's equirectUv
      const dx = cy * Math.cos(phi);
      const dz = cy * Math.sin(phi);
      const dy = sy;

      const up = clamp01(dy);
      // Banded altitude gradient: the steps are wide near the zenith and tight
      // at the horizon, which is what gives the sky its poster-print look.
      const grad = toonRamp(Math.pow(up, 0.55), 7.0, 0.30);
      let r = horizon.r + (zenith.r - horizon.r) * grad;
      let g = horizon.g + (zenith.g - horizon.g) * grad;
      let b = horizon.b + (zenith.b - horizon.b) * grad;

      // Ground hemisphere: dim bounce haze so the probe picks up warm-green fill.
      if (dy < 0) {
        const t = clamp01(-dy * 2.2);
        const k = toonRamp(1 - t, 4.0, 0.28);
        r = haze.r * (0.30 + 0.55 * k) + horizon.r * 0.22 * k;
        g = haze.g * (0.30 + 0.55 * k) + horizon.g * 0.22 * k;
        b = haze.b * (0.30 + 0.55 * k) + horizon.b * 0.22 * k;
      }

      const sunDot = dx * sd.x + dy * sd.y + dz * sd.z;

      // Cloud decks, projected by altitude so they crowd towards the horizon.
      if (dy > -0.02) {
        const proj = 1.0 / Math.max(0.14, up + 0.14);
        let density = 0;
        let lit = 0;
        for (const deck of cloudDeck) {
          const s = deck.scale * proj * 0.22;
          const n = fbm3(dx * deck.scale + s * 0.0, up * 3.4 + deck.alt * 9.0, dz * deck.scale, deck.seed, 4);
          const d = clamp01((n - deck.cover) / 0.26) * deck.gain;
          density = Math.max(density, d);
          lit += d;
        }
        density = clamp01(density * (0.35 + 0.9 * clamp01(up * 2.4 + 0.15)));
        const shape = toonRamp(density, 3.0, 0.22);
        if (shape > 0.001) {
          // Sun-facing cloud edges go hot, the bodies stay cool violet-grey.
          const rim = clamp01(sunDot * 0.5 + 0.5);
          const litness = toonRamp(rim * (0.45 + 0.75 * clamp01(lit)), 3.0, 0.26);
          const cr = 0.42 + 0.85 * litness + 0.30 * litness * litness;
          const cg = 0.44 + 0.82 * litness + 0.24 * litness * litness;
          const cb = 0.52 + 0.76 * litness + 0.12 * litness * litness;
          const a = shape * 0.94;
          r = r * (1 - a) + cr * a * (0.55 + 0.75 * sunCol.r);
          g = g * (1 - a) + cg * a * (0.55 + 0.75 * sunCol.g);
          b = b * (1 - a) + cb * a * (0.55 + 0.75 * sunCol.b);
        }
      }

      // Sun: a small hard disc with two banded halos.
      const ang = Math.acos(Math.max(-1, Math.min(1, sunDot)));
      const disc = ang < 0.035 ? 1 : 0;
      const halo1 = Math.pow(clamp01(1 - ang / 0.24), 2.4);
      const halo2 = Math.pow(clamp01(1 - ang / 0.95), 3.6);
      const glow = toonRamp(halo1, 3.0, 0.35) * 1.6 + halo2 * 0.55;
      const sunGain = disc * 220.0 * SUN.intensity + glow * 2.4;
      r += sunCol.r * sunGain;
      g += sunCol.g * sunGain;
      b += sunCol.b * sunGain;

      const i = (py * width + px) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 1;
    }
  }

  const tex = halfTextureFromFloats(data, width, height);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.userData.source = 'procedural-stylized';
  tex.userData.radiance = data;   // kept for the build verifier and the probe
  return tex;
}

/* ------------------------------------------------------------------ *
 * Ambient probe: box-downsample the radiance map, then wrap-blur it
 * ------------------------------------------------------------------ */

function halfToFloat(h) {
  const s = (h & 0x8000) >> 15;
  const e = (h & 0x7c00) >> 10;
  const f = h & 0x03ff;
  if (e === 0) return (s ? -1 : 1) * 2 ** -14 * (f / 1024);
  if (e === 0x1f) return f ? 0 : (s ? -1 : 1) * 65504;
  return (s ? -1 : 1) * 2 ** (e - 15) * (1 + f / 1024);
}

/**
 * Reads any equirect radiance texture (Float32 / Uint16 half / Uint8) into
 * linear RGB floats. Also used by tools/smoke.mjs to audit the generated map.
 */
export function readRadiance(texture) {
  const img = texture.image;
  const { width, height } = img;
  if (texture.userData && texture.userData.radiance) {
    // The generator keeps its float buffer, so the probe reads full precision.
    const rgba = texture.userData.radiance;
    const out = new Float32Array(width * height * 3);
    for (let i = 0, o = 0; o < out.length; i += 4, o += 3) {
      out[o] = rgba[i];
      out[o + 1] = rgba[i + 1];
      out[o + 2] = rgba[i + 2];
    }
    return { data: out, width, height };
  }
  const src = img.data;
  const out = new Float32Array(width * height * 3);
  const channels = Math.max(3, Math.round(src.length / (width * height)));
  const isHalf = src instanceof Uint16Array;
  const isByte = src instanceof Uint8Array || src instanceof Uint8ClampedArray;
  for (let i = 0, o = 0; o < out.length; i += channels, o += 3) {
    if (isHalf) {
      out[o] = halfToFloat(src[i]);
      out[o + 1] = halfToFloat(src[i + 1]);
      out[o + 2] = halfToFloat(src[i + 2]);
    } else if (isByte) {
      out[o] = (src[i] / 255) ** 2.2;
      out[o + 1] = (src[i + 1] / 255) ** 2.2;
      out[o + 2] = (src[i + 2] / 255) ** 2.2;
    } else {
      out[o] = src[i];
      out[o + 1] = src[i + 1];
      out[o + 2] = src[i + 2];
    }
  }
  return { data: out, width, height };
}

export function buildIrradianceProbe(texture, { width = 64, height = 32, passes = 9 } = {}) {
  const src = readRadiance(texture);
  const small = new Float32Array(width * height * 3);

  const sx = src.width / width;
  const sy = src.height / height;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let r = 0; let g = 0; let b = 0; let n = 0;
      const y0 = Math.floor(y * sy);
      const y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
      const x0 = Math.floor(x * sx);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      for (let yy = y0; yy < y1; yy += 1) {
        for (let xx = x0; xx < x1; xx += 1) {
          const i = ((yy % src.height) * src.width + (xx % src.width)) * 3;
          // Clamp the sun core: an unblurred 220x spike would blow out the probe.
          r += Math.min(src.data[i], 12);
          g += Math.min(src.data[i + 1], 12);
          b += Math.min(src.data[i + 2], 12);
          n += 1;
        }
      }
      const o = (y * width + x) * 3;
      small[o] = r / n;
      small[o + 1] = g / n;
      small[o + 2] = b / n;
    }
  }

  // Separable wrap-around blur; several passes approximate a cosine lobe.
  let a = small;
  let b2 = new Float32Array(small.length);
  const K = [0.06136, 0.24477, 0.38774, 0.24477, 0.06136];
  for (let p = 0; p < passes; p += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let r = 0; let g = 0; let bb = 0;
        for (let k = -2; k <= 2; k += 1) {
          const xx = ((x + k) % width + width) % width;
          const i = (y * width + xx) * 3;
          const w = K[k + 2];
          r += a[i] * w; g += a[i + 1] * w; bb += a[i + 2] * w;
        }
        const o = (y * width + x) * 3;
        b2[o] = r; b2[o + 1] = g; b2[o + 2] = bb;
      }
    }
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let r = 0; let g = 0; let bb = 0;
        for (let k = -2; k <= 2; k += 1) {
          const yy = Math.max(0, Math.min(height - 1, y + k));
          const i = (yy * width + x) * 3;
          const w = K[k + 2];
          r += b2[i] * w; g += b2[i + 1] * w; bb += b2[i + 2] * w;
        }
        const o = (y * width + x) * 3;
        a[o] = r; a[o + 1] = g; a[o + 2] = bb;
      }
    }
  }

  const rgba = new Float32Array(width * height * 4);
  for (let i = 0, o = 0; o < rgba.length; i += 3, o += 4) {
    rgba[o] = a[i]; rgba[o + 1] = a[i + 1]; rgba[o + 2] = a[i + 2]; rgba[o + 3] = 1;
  }
  const tex = halfTextureFromFloats(rgba, width, height);
  tex.userData.radiance = rgba;
  return tex;
}

/* ------------------------------------------------------------------ *
 * Visible sky: a full-screen ray-reconstructed dome
 * ------------------------------------------------------------------ */

const SKY_VERT = /* glsl */ `
uniform mat4 uInvViewProj;
varying vec3 vDir;
varying vec3 vOrigin;
void main(){
  vec4 near = uInvViewProj * vec4(position.xy, -1.0, 1.0);
  vec4 far  = uInvViewProj * vec4(position.xy,  1.0, 1.0);
  vec3 p0 = near.xyz / near.w;
  vec3 p1 = far.xyz / far.w;
  vOrigin = p0;
  vDir = normalize(p1 - p0);
  gl_Position = vec4(position.xy, 1.0, 1.0);
}
`;

const SKY_FRAG = [GLSL_MATH, GLSL_SHARED_UNIFORMS, GLSL_LIGHTING, GLSL_LIGHTING_FRAG, /* glsl */ `
uniform sampler2D uSky;
uniform float uCloudHeight;
uniform float uSkyCloudGain;
varying vec3 vDir;
varying vec3 vOrigin;

void main(){
  vec3 dir = normalize(vDir);
  vec3 col = texture2D(uSky, dshDirToEquirect(dir)).rgb;

  // Drifting deck sampled from the *same* field that shadows the ground, so a
  // cloud overhead and the dark patch crossing the meadow are one object.
  if (dir.y > 0.012) {
    float t = (uCloudHeight - vOrigin.y) / dir.y;
    if (t > 0.0 && t < 4000.0) {
      vec2 hit = vOrigin.xz + dir.xz * t;
      float shade = dshCloudShadow(hit);                 // 1 = clear, uCloudDark = under cloud
      float dens = clamp((1.0 - shade) / max(1.0 - uCloudDark, 1e-3), 0.0, 1.0);
      float fade = smoothstep(0.012, 0.28, dir.y) * (1.0 - smoothstep(1200.0, 3200.0, t));
      dens *= fade * uSkyCloudGain;
      float lit = dshToonRamp(clamp(dot(dir, uSunDir) * 0.5 + 0.62, 0.0, 1.0), 3.0, 0.24);
      vec3 cloudCol = mix(uFogColor * 0.72, uSunColor * 1.25, lit);
      col = mix(col, cloudCol, dshToonRamp(dens, 3.0, 0.26) * 0.85);
    }
  }

  // Horizon haze ties the sky to the distance fog exactly.
  float horizon = 1.0 - smoothstep(0.0, 0.30, abs(dir.y));
  col = mix(col, uFogColor, horizon * 0.72);

  gl_FragColor = vec4(col, 1.0);
}
`].join('\n');

export function createSkyDome(skyTexture) {
  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms: withShared({
      uSky: { value: skyTexture },
      uInvViewProj: { value: new THREE.Matrix4() },
      uCloudHeight: { value: 86.0 },
      uSkyCloudGain: { value: 1.0 },
    }),
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  mesh.matrixAutoUpdate = false;
  mesh.userData.updateCamera = (camera) => {
    const m = material.uniforms.uInvViewProj.value;
    m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).invert();
  };
  mesh.userData.setSky = (tex) => { material.uniforms.uSky.value = tex; };
  return mesh;
}

/* ------------------------------------------------------------------ *
 * Optional photographic HDRI
 * ------------------------------------------------------------------ */

/**
 * Loads a .hdr over the network and returns it mapped for equirect use.
 * Used only when the page is opened with ?hdri=<key>; see README.
 */
export async function loadCdnHdri(url) {
  const { RGBELoader } = await import('three/addons/loaders/RGBELoader.js');
  const loader = new RGBELoader();
  // Older builds default to half float; newer ones expose the type directly.
  if (typeof loader.setDataType === 'function') loader.setDataType(THREE.HalfFloatType);
  const tex = await loader.loadAsync(url);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.userData.source = url;
  return tex;
}

/** Curated CC0 sources, resolved in the browser. Documented in the README. */
export const HDRI_SOURCES = {
  meadow: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/kloofendal_48d_partly_cloudy_puresky_1k.hdr',
  sunset: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r166/examples/textures/equirectangular/venice_sunset_1k.hdr',
  quarry: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r166/examples/textures/equirectangular/quarry_01_1k.hdr',
};

/**
 * Resolves the environment: procedural by default, photographic on request,
 * falling back to procedural if the network fetch fails.
 * @returns {Promise<{sky: THREE.Texture, probe: THREE.Texture, source: string}>}
 */
export async function buildEnvironment(hdriKey = null) {
  let sky = null;
  let source = 'procedural';
  if (hdriKey && HDRI_SOURCES[hdriKey]) {
    try {
      sky = await loadCdnHdri(HDRI_SOURCES[hdriKey]);
      source = `polyhaven/three.js: ${hdriKey}`;
    } catch (err) {
      console.warn('[dsh] HDRI fetch failed, using the procedural sky instead:', err);
      sky = null;
    }
  }
  if (!sky) {
    sky = generateStylizedHdri({ width: 512, height: 256 });
    source = 'procedural stylised HDRI (this project)';
  }
  const probe = buildIrradianceProbe(sky);
  shared.uIrradiance.value = probe;
  return { sky, probe, source };
}
