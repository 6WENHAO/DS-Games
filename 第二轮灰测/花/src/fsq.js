// Full-screen triangle helper used by every offscreen/post pass.

import * as THREE from 'three';

const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);

const scene = new THREE.Scene();
const cam = new THREE.Camera();
const mesh = new THREE.Mesh(geo, null);
mesh.frustumCulled = false;
scene.add(mesh);

export const FS_VERT = /* glsl */ `
  varying vec2 vUv;
  void main(){
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export function fsMaterial(fragmentShader, uniforms, defines) {
  return new THREE.ShaderMaterial({
    uniforms,
    defines: defines || {},
    vertexShader: FS_VERT,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
  });
}

/** Draw `material` over `target` (null = canvas). `clear:false` keeps prior contents. */
export function blit(renderer, material, target, clear = true) {
  mesh.material = material;
  const prevAuto = renderer.autoClear;
  renderer.autoClear = clear;
  renderer.setRenderTarget(target || null);
  renderer.render(scene, cam);
  renderer.autoClear = prevAuto;
  renderer.setRenderTarget(null);
}

export function makeRT(w, h, opts = {}) {
  const rt = new THREE.WebGLRenderTarget(Math.max(1, Math.floor(w)), Math.max(1, Math.floor(h)), {
    type: opts.type || THREE.HalfFloatType,
    format: opts.format || THREE.RGBAFormat,
    minFilter: opts.filter || THREE.LinearFilter,
    magFilter: opts.filter || THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: !!opts.depth,
    stencilBuffer: false,
    generateMipmaps: false,
  });
  rt.texture.generateMipmaps = false;
  return rt;
}
