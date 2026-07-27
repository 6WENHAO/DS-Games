import * as THREE from 'three';
import { SHADING_GLSL, WIND_GLSL, PALETTE } from './shading.js';

// ---------------------------------------------------------------------------
// The traveller. Small, hooded, cloth-heavy, faceless — ~7% of frame height.
// Smallness is the point.
//
// Bloom (the glide resource) is displayed ONLY as the brightness and length of
// the cloth. There is no bar, and there is no HUD.
// ---------------------------------------------------------------------------

export class Avatar {
  constructor(skyUniforms) {
    this.group = new THREE.Group();

    const uniforms = Object.assign({}, skyUniforms, {
      uBloom: { value: 1 },
      uGlide: { value: 0 },
      uSpeed: { value: 0 },
      uCloth: { value: new THREE.Color(PALETTE.cloud) },
      uCloth2: { value: new THREE.Color(0xdfa77a) },
      uInk: { value: new THREE.Color(PALETTE.inkTeal) },
    });
    this.uniforms = uniforms;

    const clothMat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms,
      vertexShader: /* glsl */`
        uniform float uBloom, uGlide, uSpeed;
        varying vec3 vWorld;
        varying vec3 vNormalW;
        varying float vY;
        ${WIND_GLSL}
        void main() {
          vec3 p = position;
          float t = clamp(-p.y / 1.4 + 0.5, 0.0, 1.0);
          // the cloth lengthens as Bloom fills, and unfurls into a wing on glide
          float flutter = sin(uTime * 6.0 + p.y * 5.0 + p.x * 3.0) * 0.05
                        + sin(uTime * 3.1 + p.z * 4.0) * 0.035;
          p.xz *= 1.0 + uGlide * 1.9 * t;
          p.y -= t * (0.15 + uBloom * 0.35);
          p.x += flutter * t * (0.5 + uSpeed * 0.12);
          p.z += flutter * t * (0.4 + uGlide);
          vec4 w = modelMatrix * vec4(p, 1.0);
          vWorld = w.xyz;
          vNormalW = normalize(mat3(modelMatrix) * normal);
          vY = t;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */`
        precision highp float;
        uniform float uBloom;
        uniform vec3 uCloth, uCloth2;
        varying vec3 vWorld;
        varying vec3 vNormalW;
        varying float vY;
        ${SHADING_GLSL}
        void main() {
          vec3 viewDir = normalize(vWorld - cameraPosition);
          vec3 albedo = mix(uCloth, uCloth2, smoothstep(0.35, 1.0, vY));
          vec3 col = illustrated(vNormalW, albedo, 1.0);
          col += translucency(viewDir, vY * 1.3, uCloth);
          // Bloom IS the readout: the cloth simply glows more when you are full
          col *= 0.80 + uBloom * 0.42;
          col = applyFog(col, length(vWorld - cameraPosition), viewDir);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });

    const cloak = new THREE.Mesh(
      new THREE.ConeGeometry(0.42, 1.35, 14, 8, true),
      clothMat,
    );
    cloak.geometry.translate(0, 0.72, 0);
    this.group.add(cloak);

    const hoodMat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */`
        varying vec3 vWorld; varying vec3 vNormalW;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz; vNormalW = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */`
        precision highp float;
        uniform vec3 uCloth, uInk;
        varying vec3 vWorld; varying vec3 vNormalW;
        ${SHADING_GLSL}
        void main() {
          vec3 viewDir = normalize(vWorld - cameraPosition);
          // faceless: the front of the hood is the only true dark in the frame
          float face = smoothstep(0.25, 0.85, dot(normalize(vNormalW), -viewDir));
          vec3 albedo = mix(uCloth, uInk, face * 0.75);
          vec3 col = illustrated(vNormalW, albedo, 1.0);
          col = applyFog(col, length(vWorld - cameraPosition), viewDir);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 10), hoodMat);
    hood.position.y = 1.30;
    hood.scale.set(1, 1.15, 1.05);
    this.group.add(hood);

    this.group.frustumCulled = false;
  }

  update(dt, player) {
    this.group.position.copy(player.pos);
    // face the direction of travel, damped
    const cur = this.group.rotation.y;
    let d = player.facing - cur;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.group.rotation.y = cur + d * Math.min(1, dt * 8);
    // lean into the glide
    this.group.rotation.x = THREE.MathUtils.damp(
      this.group.rotation.x, player.gliding ? 0.34 : 0, 6, dt);

    this.uniforms.uBloom.value = THREE.MathUtils.damp(
      this.uniforms.uBloom.value, player.bloom, 5, dt);
    this.uniforms.uGlide.value = THREE.MathUtils.damp(
      this.uniforms.uGlide.value, player.gliding ? 1 : 0, 5, dt);
    this.uniforms.uSpeed.value = player.moveSpeed;
  }
}
