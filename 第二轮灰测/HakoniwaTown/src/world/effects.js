/**
 * 粒子与灯火效果：烟囱炊烟、火车蒸汽、喷泉水柱、瀑布水雾、
 * 夜晚萤火虫、路灯光晕，以及少量真实点光源。
 * 全部用 Points + 着色器实现，无需贴图，GPU 端计算轨迹。
 */
import * as THREE from 'three';
import { RNG, clamp, TAU } from '../lib/utils.js';

/** 由 main 在 resize 时更新，使粒子以世界尺寸显示 */
export const pointScale = { value: 700 };

function pointsMaterial(frag, extraUniforms = {}, extraVert = '', blending = THREE.AdditiveBlending) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uScale: pointScale,
      ...extraUniforms,
    },
    vertexShader: /* glsl */`
      attribute float aSeed;
      attribute float aSize;
      attribute float aSpeed;
      attribute vec3 aOrigin;
      attribute vec3 aDir;
      uniform float uTime; uniform float uScale;
      varying float vLife; varying float vSeed;
      ${extraVert}
      void main() {
        vec3 p = position;
        float life = 0.0;
        ${'' /* body 由各系统在 extraVert 中定义 particlePos() */}
        particlePos(p, life);
        vLife = life; vSeed = aSeed;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = aSize * (1.0 + life * 1.6) * uScale / max(0.6, -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    blending,
  });
}

const SOFT_CIRCLE = /* glsl */`
  float softCircle() {
    vec2 d = gl_PointCoord - 0.5;
    return smoothstep(0.5, 0.06, length(d));
  }
`;

/* ------------------------------------------------------------ 炊烟 */
export function buildSmoke(scene, anchors, rng = new RNG(12)) {
  if (!anchors.length) return { update() {}, obj: null };
  const per = 12;
  const n = anchors.length * per;
  const position = new Float32Array(n * 3);
  const origin = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  const size = new Float32Array(n);
  const speed = new Float32Array(n);
  let i = 0;
  for (const a of anchors) {
    for (let k = 0; k < per; k++) {
      origin[i * 3] = a.x; origin[i * 3 + 1] = a.y; origin[i * 3 + 2] = a.z;
      position[i * 3] = a.x; position[i * 3 + 1] = a.y; position[i * 3 + 2] = a.z;
      seed[i] = rng.next();
      size[i] = rng.range(0.55, 1.0);
      speed[i] = rng.range(0.16, 0.26);
      i++;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geo.setAttribute('aOrigin', new THREE.BufferAttribute(origin, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
  const m = pointsMaterial(
    /* glsl */`
      ${SOFT_CIRCLE}
      uniform float uOpacity; uniform vec3 uColor;
      varying float vLife; varying float vSeed;
      void main() {
        float a = softCircle() * (1.0 - vLife) * 0.5 * smoothstep(0.0, 0.12, vLife);
        gl_FragColor = vec4(uColor, a * uOpacity);
      }
    `,
    { uColor: { value: new THREE.Color('#e8e4dc') } },
    /* glsl */`
      void particlePos(inout vec3 p, out float life) {
        life = fract(uTime * aSpeed + aSeed);
        float w = life * 3.4;
        p = aOrigin + vec3(
          sin(uTime * 0.55 + aSeed * 31.0) * w * 0.42 + w * 0.28,
          w * 1.15,
          cos(uTime * 0.47 + aSeed * 23.0) * w * 0.36
        );
      }
    `,
    THREE.NormalBlending
  );
  const pts = new THREE.Points(geo, m);
  pts.frustumCulled = false;
  pts.name = 'smoke';
  scene.add(pts);
  return {
    obj: pts,
    update(dt, elapsed, night) {
      m.uniforms.uTime.value = elapsed;
      m.uniforms.uOpacity.value = 0.55 + night * 0.25;
      m.uniforms.uColor.value.setRGB(0.91 - night * 0.35, 0.9 - night * 0.34, 0.87 - night * 0.3);
    },
  };
}

/* ------------------------------------------------------------ 喷泉 */
export function buildJets(scene, jets, rng = new RNG(77)) {
  if (!jets.length) return { update() {}, obj: null };
  const per = 26;
  const n = jets.length * per;
  const position = new Float32Array(n * 3);
  const origin = new Float32Array(n * 3);
  const dir = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  const size = new Float32Array(n);
  const speed = new Float32Array(n);
  let i = 0;
  for (const j of jets) {
    for (let k = 0; k < per; k++) {
      origin[i * 3] = j.x; origin[i * 3 + 1] = j.y; origin[i * 3 + 2] = j.z;
      position[i * 3] = j.x; position[i * 3 + 1] = j.y; position[i * 3 + 2] = j.z;
      dir[i * 3] = j.dir[0] * (1 + rng.jitter(0.15));
      dir[i * 3 + 1] = j.dir[1] * (1 + rng.jitter(0.1));
      dir[i * 3 + 2] = j.dir[2] * (1 + rng.jitter(0.15));
      seed[i] = rng.next();
      size[i] = rng.range(0.16, 0.3);
      speed[i] = rng.range(0.5, 0.72);
      i++;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geo.setAttribute('aOrigin', new THREE.BufferAttribute(origin, 3));
  geo.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
  const m = pointsMaterial(
    /* glsl */`
      ${SOFT_CIRCLE}
      uniform float uOpacity; uniform vec3 uColor;
      varying float vLife; varying float vSeed;
      void main() {
        float a = softCircle() * (0.85 - vLife * 0.7);
        gl_FragColor = vec4(uColor, a * uOpacity);
      }
    `,
    { uColor: { value: new THREE.Color('#dff4ff') } },
    /* glsl */`
      void particlePos(inout vec3 p, out float life) {
        life = fract(uTime * aSpeed + aSeed);
        float t = life * 1.5;
        p = aOrigin + aDir * vec3(1.6, 2.6, 1.6) * t;
        p.y -= 4.9 * t * t * 0.42;
      }
    `
  );
  const pts = new THREE.Points(geo, m);
  pts.frustumCulled = false;
  pts.name = 'jets';
  scene.add(pts);
  return {
    obj: pts,
    update(dt, elapsed) { m.uniforms.uTime.value = elapsed; },
  };
}

/* ------------------------------------------------------------ 瀑布水雾 */
export function buildMist(scene, falls, rng = new RNG(303)) {
  if (!falls.length) return { update() {}, obj: null };
  const per = 34;
  const n = falls.length * per;
  const position = new Float32Array(n * 3);
  const origin = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  const size = new Float32Array(n);
  const speed = new Float32Array(n);
  let i = 0;
  for (const f of falls) {
    for (let k = 0; k < per; k++) {
      origin[i * 3] = f.x + rng.jitter(1.1);
      origin[i * 3 + 1] = f.y + rng.range(-0.2, 0.5);
      origin[i * 3 + 2] = f.z + rng.jitter(1.1);
      position[i * 3] = origin[i * 3]; position[i * 3 + 1] = origin[i * 3 + 1]; position[i * 3 + 2] = origin[i * 3 + 2];
      seed[i] = rng.next();
      size[i] = rng.range(0.3, 0.66);
      speed[i] = rng.range(0.3, 0.5);
      i++;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geo.setAttribute('aOrigin', new THREE.BufferAttribute(origin, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
  const m = pointsMaterial(
    /* glsl */`
      ${SOFT_CIRCLE}
      uniform float uOpacity;
      varying float vLife; varying float vSeed;
      void main() {
        float a = softCircle() * sin(vLife * 3.1415) * 0.5;
        gl_FragColor = vec4(vec3(0.93, 0.97, 1.0), a * uOpacity);
      }
    `,
    {},
    /* glsl */`
      void particlePos(inout vec3 p, out float life) {
        life = fract(uTime * aSpeed + aSeed);
        p = aOrigin + vec3(
          sin(uTime * 1.3 + aSeed * 30.0) * life * 1.1,
          life * 1.9,
          cos(uTime * 1.1 + aSeed * 27.0) * life * 1.0
        );
      }
    `
  );
  const pts = new THREE.Points(geo, m);
  pts.frustumCulled = false;
  pts.name = 'mist';
  scene.add(pts);
  return { obj: pts, update(dt, elapsed) { m.uniforms.uTime.value = elapsed; } };
}

/* ------------------------------------------------------------ 萤火虫 */
export function buildFireflies(scene, spots, rng = new RNG(9090)) {
  const per = 16;
  const n = spots.length * per;
  const position = new Float32Array(n * 3);
  const origin = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  const size = new Float32Array(n);
  const speed = new Float32Array(n);
  let i = 0;
  for (const s of spots) {
    for (let k = 0; k < per; k++) {
      const a = rng.range(0, TAU), r = rng.range(0, s.r);
      origin[i * 3] = s.x + Math.cos(a) * r;
      origin[i * 3 + 1] = s.y + rng.range(0.3, 2.2);
      origin[i * 3 + 2] = s.z + Math.sin(a) * r;
      position[i * 3] = origin[i * 3]; position[i * 3 + 1] = origin[i * 3 + 1]; position[i * 3 + 2] = origin[i * 3 + 2];
      seed[i] = rng.next();
      size[i] = rng.range(0.09, 0.17);
      speed[i] = rng.range(0.05, 0.12);
      i++;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geo.setAttribute('aOrigin', new THREE.BufferAttribute(origin, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
  const m = pointsMaterial(
    /* glsl */`
      ${SOFT_CIRCLE}
      uniform float uOpacity;
      varying float vLife; varying float vSeed;
      void main() {
        float blink = pow(max(0.0, sin(vLife * 6.2831 + vSeed * 12.0)), 3.0);
        gl_FragColor = vec4(vec3(1.0, 0.94, 0.55), softCircle() * blink * uOpacity);
      }
    `,
    {},
    /* glsl */`
      void particlePos(inout vec3 p, out float life) {
        life = fract(uTime * aSpeed + aSeed);
        float t = uTime * 0.6 + aSeed * 40.0;
        p = aOrigin + vec3(sin(t) * 1.3, sin(t * 0.7 + 1.0) * 0.6, cos(t * 0.85) * 1.3);
      }
    `
  );
  const pts = new THREE.Points(geo, m);
  pts.frustumCulled = false;
  pts.name = 'fireflies';
  scene.add(pts);
  return {
    obj: pts,
    update(dt, elapsed, night) {
      m.uniforms.uTime.value = elapsed;
      m.uniforms.uOpacity.value = night;
      pts.visible = night > 0.05;
    },
  };
}

/* ------------------------------------------------------------ 灯光光晕 */
export function buildHalos(scene, positions, color = '#ffd9a0', size = 1.5) {
  if (!positions.length) return { update() {}, obj: null };
  const n = positions.length;
  const position = new Float32Array(n * 3);
  const origin = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  const sizes = new Float32Array(n);
  const speed = new Float32Array(n);
  positions.forEach((p, i) => {
    position[i * 3] = p.x; position[i * 3 + 1] = p.y; position[i * 3 + 2] = p.z;
    origin[i * 3] = p.x; origin[i * 3 + 1] = p.y; origin[i * 3 + 2] = p.z;
    seed[i] = i * 0.137;
    sizes[i] = size * (p.scale ?? 1);
    speed[i] = 0.3;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geo.setAttribute('aOrigin', new THREE.BufferAttribute(origin, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
  const m = pointsMaterial(
    /* glsl */`
      uniform float uOpacity; uniform vec3 uColor;
      varying float vLife; varying float vSeed;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float r = length(d) * 2.0;
        float a = pow(max(0.0, 1.0 - r), 2.4);
        gl_FragColor = vec4(uColor, a * uOpacity);
      }
    `,
    { uColor: { value: new THREE.Color(color) } },
    /* glsl */`
      void particlePos(inout vec3 p, out float life) {
        life = 0.0;
        p = aOrigin;
      }
    `
  );
  const pts = new THREE.Points(geo, m);
  pts.frustumCulled = false;
  pts.name = 'halos';
  scene.add(pts);
  return {
    obj: pts,
    update(dt, elapsed, night) {
      m.uniforms.uTime.value = elapsed;
      const flicker = 0.94 + Math.sin(elapsed * 7.3) * 0.03 + Math.sin(elapsed * 3.1) * 0.03;
      m.uniforms.uOpacity.value = night * 0.5 * flicker;
      pts.visible = night > 0.02;
    },
  };
}

/* ------------------------------------------------------------ 火车蒸汽（CPU 池） */
export function buildTrainSmoke(scene, count = 46) {
  const position = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const alpha = new Float32Array(count);
  const vel = [];
  for (let i = 0; i < count; i++) {
    position[i * 3 + 1] = -100;
    size[i] = 0.5;
    alpha[i] = 0;
    vel.push(new THREE.Vector3());
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uScale: pointScale, uOpacity: { value: 0.85 } },
    vertexShader: /* glsl */`
      attribute float aSize; attribute float aAlpha;
      uniform float uScale; varying float vA;
      void main() {
        vA = aAlpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uScale / max(0.6, -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      varying float vA; uniform float uOpacity;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.04, length(d));
        gl_FragColor = vec4(vec3(0.95, 0.95, 0.94), a * vA * uOpacity);
      }
    `,
    transparent: true, depthWrite: false,
  });
  const pts = new THREE.Points(geo, m);
  pts.frustumCulled = false;
  pts.name = 'trainSmoke';
  scene.add(pts);
  let cursor = 0, acc = 0;
  const life = new Float32Array(count);
  return {
    obj: pts,
    emit(x, y, z, vx, vz) {
      const i = cursor % count;
      cursor++;
      position[i * 3] = x; position[i * 3 + 1] = y; position[i * 3 + 2] = z;
      vel[i].set(vx * 0.2 + (Math.random() - 0.5) * 0.4, 1.5 + Math.random() * 0.9, vz * 0.2 + (Math.random() - 0.5) * 0.4);
      size[i] = 0.5 + Math.random() * 0.4;
      life[i] = 1;
    },
    update(dt) {
      for (let i = 0; i < count; i++) {
        if (life[i] <= 0) { alpha[i] = 0; continue; }
        life[i] -= dt * 0.42;
        position[i * 3] += vel[i].x * dt;
        position[i * 3 + 1] += vel[i].y * dt;
        position[i * 3 + 2] += vel[i].z * dt;
        vel[i].multiplyScalar(1 - dt * 0.7);
        vel[i].y = Math.max(0.45, vel[i].y);
        size[i] += dt * 1.5;
        alpha[i] = Math.max(0, life[i]) * 0.55;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aSize.needsUpdate = true;
      geo.attributes.aAlpha.needsUpdate = true;
    },
  };
}

/* ------------------------------------------------------------ 夜间点光源 */
export function buildNightLights(scene, spots) {
  const lights = [];
  for (const s of spots) {
    const l = new THREE.PointLight(new THREE.Color(s.color ?? '#ffc880'), 0, s.dist ?? 14, 1.6);
    l.position.set(s.x, s.y, s.z);
    l.castShadow = false;
    scene.add(l);
    lights.push({ l, base: s.intensity ?? 6, flicker: s.flicker ?? 0 });
  }
  return {
    lights,
    update(dt, elapsed, night) {
      for (let i = 0; i < lights.length; i++) {
        const e = lights[i];
        const f = e.flicker ? 1 + Math.sin(elapsed * (5 + i) + i) * 0.12 * e.flicker : 1;
        e.l.intensity = night * e.base * f;
        e.l.visible = night > 0.03;
      }
    },
  };
}
