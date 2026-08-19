import * as THREE from 'three';

/**
 * 渐变天穹 + 日轮 + 霞光（ShaderMaterial 天球）
 */
export function createSky() {
  const uniforms = {
    uTop: { value: new THREE.Color(0x2a5c9e) },
    uMid: { value: new THREE.Color(0x93b8d6) },
    uBottom: { value: new THREE.Color(0xf6cd93) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color(0xffd2a1) },
    uSunSize: { value: 1.0 },
    uHaze: { value: 0.9 }
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      uniform vec3 uTop, uMid, uBottom, uSunColor, uSunDir;
      uniform float uSunSize, uHaze;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(uBottom, uMid, smoothstep(-0.02, 0.11, h));
        col = mix(col, uTop, smoothstep(0.07, 0.46, h));
        float sd = max(dot(d, normalize(uSunDir)), 0.0);
        col += uSunColor * pow(sd, 260.0) * 2.6 * uSunSize;             // 日轮
        col += uSunColor * pow(sd, 7.0) * 0.42 * uHaze;                 // 霞光
        col += uSunColor * pow(max(1.0 - abs(h), 0.0), 10.0) * 0.07;    // 地平雾带
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1200, 40, 24), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  mesh.name = 'sky';
  return { mesh, uniforms };
}
