import * as THREE from 'three';
import { GROUND_SIZE } from './layout';

/**
 * Flood surface: a single animated translucent plane that rises and recedes.
 * Cheap, readable, and it reads clearly against the bright city.
 */
export class Water {
  readonly mesh: THREE.Mesh;
  level = 0;
  target = 0;
  private uniforms = {
    uTime: { value: 0 },
    uOpacity: { value: 0.72 },
    uShallow: { value: new THREE.Color(0x6fd2ff) },
    uDeep: { value: new THREE.Color(0x1d6ec4) },
  };

  constructor() {
    const geo = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, 96, 96);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: `
        uniform float uTime;
        varying float vWave;
        varying vec3 vP;
        void main() {
          vec3 p = position;
          float w = sin( p.x * 0.09 + uTime * 1.5 ) * 0.34
                  + sin( p.z * 0.13 - uTime * 1.1 ) * 0.26
                  + sin( ( p.x + p.z ) * 0.05 + uTime * 0.7 ) * 0.3;
          p.y += w;
          vWave = w;
          vP = p;
          gl_Position = projectionMatrix * modelViewMatrix * vec4( p, 1.0 );
        }`,
      fragmentShader: `
        uniform float uOpacity; uniform vec3 uShallow; uniform vec3 uDeep;
        varying float vWave;
        varying vec3 vP;
        void main() {
          float d = clamp( length( vP.xz ) / 160.0, 0.0, 1.0 );
          vec3 c = mix( uShallow, uDeep, d * 0.75 );
          c += vWave * 0.18;
          float foam = smoothstep( 0.42, 0.62, vWave );
          c = mix( c, vec3( 0.92, 0.98, 1.0 ), foam * 0.5 );
          gl_FragColor = vec4( c, uOpacity );
        }`,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.mesh.position.y = -1;
  }

  reset(): void {
    this.level = 0;
    this.target = 0;
    this.mesh.visible = false;
    this.mesh.position.y = -1;
  }

  update(dt: number, simDt: number): void {
    this.uniforms.uTime.value += simDt;
    const rate = this.target > this.level ? 1.35 : 2.1;
    if (Math.abs(this.target - this.level) > 0.002) {
      this.level += Math.sign(this.target - this.level) * Math.min(Math.abs(this.target - this.level), rate * dt);
    }
    const visible = this.level > 0.04;
    this.mesh.visible = visible;
    if (visible) {
      this.mesh.position.y = this.level;
      this.uniforms.uOpacity.value = Math.min(0.78, 0.32 + this.level * 0.12);
    }
  }
}
