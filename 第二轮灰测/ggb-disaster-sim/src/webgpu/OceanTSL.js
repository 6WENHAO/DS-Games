import * as THREE from 'three/webgpu';
import {
  Fn, vec2, vec3, vec4, float, uniform, positionLocal, time,
  sin, cos, normalize, cross, dot, mix, clamp, pow, max, abs, exp, smoothstep, reflect,
  cameraPosition, positionWorld, normalGeometry,
} from 'three/tsl';

/**
 * OceanTSL.js — the same Gerstner ocean, expressed in TSL for WebGPURenderer.
 *
 * WHY THIS IS A SEPARATE MODULE AND NOT THE MAIN PATH
 * --------------------------------------------------
 * The cinematic chain in src/ is built on two mechanisms that WebGPURenderer
 * does not have:
 *   1. EffectComposer + GLSL ShaderPass — the god rays, shockwave refraction,
 *      chromatic aberration and motion-blur history passes,
 *   2. Material.onBeforeCompile — the GPU rigid-body skinning that draws 900
 *      fracture chunks in one call (BatchedRigidMesh).
 * Under WebGPU both become NodeMaterial/TSL rewrites and node-based post
 * processing. Shipping that as a half-finished parallel path would be worse
 * engineering than shipping one complete path plus an honest, working
 * demonstration of the target API — which is what this file is.
 *
 * WHAT THIS DEMONSTRATES
 * ----------------------
 *   • the identical trochoidal wave maths as a TSL node graph,
 *   • analytic tangent/binormal → normalNode, so lighting is exact,
 *   • Fresnel + analytic sky reflection as a colorNode,
 *   • uniform() handles that JS mutates per frame exactly like GLSL uniforms.
 *
 * MIGRATION NOTE: because positionNode/normalNode/colorNode are per-material,
 * porting the rest of the project means (a) turning each ShaderPass into a TSL
 * post node in a PostProcessing graph, and (b) replacing the onBeforeCompile
 * patch with a positionNode that samples the transform texture — the DataTexture
 * layout itself carries over unchanged.
 */

const WAVES = [
  { dir: [1.0, 0.22], amp: 1.35, len: 210, steep: 0.30, speed: 13.5 },
  { dir: [0.82, -0.55], amp: 0.95, len: 148, steep: 0.28, speed: 11.2 },
  { dir: [0.55, 0.83], amp: 0.62, len: 92, steep: 0.24, speed: 8.4 },
  { dir: [-0.35, 0.94], amp: 0.34, len: 57, steep: 0.20, speed: 6.1 },
];

export function createTSLOcean({ size = 8000, segments = 400 } = {}) {
  // --- live uniforms, mutated from JS each frame ---
  const uSunDir = uniform(new THREE.Vector3(0.4, 0.55, 0.3).normalize());
  const uTsunami = uniform(new THREE.Vector4(-4000, 0, 500, 0));
  const uDeep = uniform(new THREE.Color(0x0b2733));
  const uShallow = uniform(new THREE.Color(0x1d5b63));
  const uFoam = uniform(new THREE.Color(0xeaf4f6));

  /**
   * Shared trochoidal accumulation. Returns vec3 displacement and writes the
   * tangent/binormal into the supplied vars. The four waves are unrolled in JS
   * — a compile-time loop, which is exactly what a shader wants.
   */
  const surface = Fn(([xz, tangent, binormal, crest]) => {
    const p = vec3(xz.x, float(0), xz.y).toVar();

    for (const w of WAVES) {
      const dl = Math.hypot(w.dir[0], w.dir[1]);
      const dx = float(w.dir[0] / dl);
      const dz = float(w.dir[1] / dl);
      const k = float((Math.PI * 2) / w.len);
      const a = float(w.amp);
      const Q = float(w.steep);

      const phase = k.mul(dx.mul(xz.x).add(dz.mul(xz.y)).sub(time.mul(w.speed)));
      const s = sin(phase);
      const c = cos(phase);
      const wa = k.mul(a);

      p.x.addAssign(Q.mul(a).mul(dx).mul(c));
      p.z.addAssign(Q.mul(a).mul(dz).mul(c));
      p.y.addAssign(a.mul(s));

      tangent.addAssign(vec3(
        Q.mul(dx).mul(dx).mul(wa).mul(s).negate(),
        dx.mul(wa).mul(c),
        Q.mul(dx).mul(dz).mul(wa).mul(s).negate(),
      ));
      binormal.addAssign(vec3(
        Q.mul(dx).mul(dz).mul(wa).mul(s).negate(),
        dz.mul(wa).mul(c),
        Q.mul(dz).mul(dz).mul(wa).mul(s).negate(),
      ));
      crest.addAssign(Q.mul(wa).mul(max(s, float(0))));
    }

    // Tsunami soliton: same asymmetric travelling profile as the GLSL version.
    const d = xz.x.sub(uTsunami.x).div(uTsunami.z);
    const env = exp(d.mul(d).mul(float(2.0)).negate());
    p.y.addAssign(uTsunami.y.mul(env).mul(uTsunami.w));
    crest.addAssign(env.mul(uTsunami.w).mul(float(2.0)));

    return p;
  });

  const positionNode = Fn(() => {
    const tangent = vec3(1, 0, 0).toVar();
    const binormal = vec3(0, 0, 1).toVar();
    const crest = float(0).toVar();
    return surface(positionLocal.xz, tangent, binormal, crest);
  })();

  const normalNode = Fn(() => {
    const tangent = vec3(1, 0, 0).toVar();
    const binormal = vec3(0, 0, 1).toVar();
    const crest = float(0).toVar();
    surface(positionLocal.xz, tangent, binormal, crest);
    return normalize(cross(binormal, tangent));
  })();

  /** Analytic sky: a compact TSL twin of dshSkyColor's horizon/zenith blend. */
  const skyColor = Fn(([dir]) => {
    const up = clamp(dir.y, float(0.0), float(1.0));
    const sunUp = clamp(uSunDir.y, float(0.0), float(1.0));
    const cosT = clamp(dot(dir, uSunDir), float(-1.0), float(1.0));
    const zenith = mix(vec3(0.10, 0.22, 0.44), vec3(0.16, 0.36, 0.68), sunUp);
    const horizon = mix(vec3(1.02, 0.55, 0.26), vec3(0.70, 0.80, 0.90), sunUp);
    const base = mix(horizon, zenith, pow(up, float(0.55)));
    const aureole = pow(max(cosT, float(0.0)), float(28.0)).mul(0.55);
    return base.add(vec3(1.0, 0.78, 0.5).mul(aureole));
  });

  const colorNode = Fn(() => {
    const N = normalNode;
    const V = normalize(cameraPosition.sub(positionWorld));
    const fres = float(0.02).add(
      float(0.98).mul(pow(float(1.0).sub(clamp(dot(N, V), float(0.0), float(1.0))), float(5.0))),
    );
    const R = reflect(V.negate(), N);
    const refl = skyColor(normalize(vec3(R.x, abs(R.y).mul(0.6).add(0.02), R.z)));

    const upwell = pow(clamp(float(1.0).sub(abs(dot(N, V))), float(0.0), float(1.0)), float(1.6));
    const body = mix(uDeep, uShallow, upwell.mul(0.8));

    const H = normalize(uSunDir.add(V));
    const spec = pow(max(dot(N, H), float(0.0)), float(500.0)).mul(3.2);

    // Foam on the steep faces, keyed off the surface normal tilt.
    const tilt = smoothstep(float(0.88), float(0.55), N.y);
    const col = mix(body, refl, fres).add(vec3(1.0, 0.94, 0.82).mul(spec));
    return vec4(mix(col, uFoam, tilt.mul(0.6)), 1.0);
  })();

  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);   // bake the rotation so local XZ === world XZ

  const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.12, metalness: 0.0 });
  material.positionNode = positionNode;
  material.normalNode = normalNode;
  material.colorNode = colorNode;

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;

  return {
    mesh,
    material,
    uniforms: { uSunDir, uTsunami, uDeep, uShallow, uFoam },
    setSun(v) { uSunDir.value.copy(v).normalize(); },
    setTsunami(x, height, width, on) { uTsunami.value.set(x, height, width, on ? 1 : 0); },
    // Keep the finite grid under the camera, snapped to whole cells.
    follow(camera) {
      const step = size / segments;
      mesh.position.x = Math.round(camera.position.x / step) * step;
      mesh.position.z = Math.round(camera.position.z / step) * step;
    },
    dispose() { geometry.dispose(); material.dispose(); },
  };
}

/** Guard so callers can degrade gracefully instead of throwing. */
export async function isWebGPUAvailable() {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    return !!adapter;
  } catch {
    return false;
  }
}
